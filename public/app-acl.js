"use strict";
// Тестер ACL: розбір стандартних/розширених (нумерованих і іменованих) ACL, перевірка пакетів «на якому рядку спрацює»,
// пошук рядків, що ніколи не спрацюють, підозрілих wildcard, поради з розміщення; задачі «напиши ACL під вимогу».
const ACL_LS = "ccna.acl";
const ACL_PORTS = { www: 80, http: 80, https: 443, ftp: 21, "ftp-data": 20, ssh: 22, telnet: 23, smtp: 25, domain: 53, dns: 53, pop3: 110, ntp: 123, snmp: 161, syslog: 514, tftp: 69, bootps: 67, bootpc: 68, isakmp: 500 };
const aclN = s => { const p = String(s).split("."); if (p.length !== 4 || p.some(x => !/^\d{1,3}$/.test(x) || +x > 255)) return null; return ((+p[0] << 24) >>> 0) + (+p[1] << 16) + (+p[2] << 8) + +p[3]; };
const aclS = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
function aclAddr(tok, i, warn) { // повертає [{a, w}, nextIndex]
  const t = (tok[i] || "").toLowerCase(); if (t === "any") return [{ a: 0, w: 0xffffffff, txt: "any" }, i + 1];
  if (t === "host") { const a = aclN(tok[i + 1]); if (a == null) throw new Error("після host має бути IP"); return [{ a, w: 0, txt: "host " + tok[i + 1] }, i + 2]; }
  const a = aclN(tok[i]); if (a == null) throw new Error("очікувалась адреса, any або host, а не «" + (tok[i] || "") + "»");
  const w = aclN(tok[i + 1]); if (w == null) return [{ a, w: 0, txt: tok[i] }, i + 1]; // стандартний ACL допускає адресу без wildcard = host
  if (((a & w) >>> 0) !== 0) warn.push(`${tok[i]} ${tok[i + 1]}: в адресі є біти, які wildcard ігнорує — IOS збереже ${aclS((a & ~w) >>> 0)} ${tok[i + 1]}`);
  if (/^255\./.test(tok[i + 1]) || /^(128|192|224|240|248|252|254)\.0\.0\.0$/.test(tok[i + 1]) && tok[i + 1] !== "0.0.0.0") warn.push(`${tok[i + 1]} схожа на маску підмережі, а не wildcard (для /24 — 0.0.0.255)`);
  else { const b = w.toString(2).padStart(32, "0"); if (!/^0*1*$/.test(b)) warn.push(`${tok[i + 1]} — несуцільна wildcard: так можна, але зазвичай це помилка`); }
  return [{ a: (a & ~w) >>> 0, w, txt: tok[i] + " " + tok[i + 1] }, i + 2]; }
function aclPort(tok, i) { const op = (tok[i] || "").toLowerCase(); const pv = x => { if (/^\d+$/.test(x)) return +x; const v = ACL_PORTS[String(x).toLowerCase()]; if (v == null) throw new Error("невідомий порт «" + x + "»"); return v; };
  if (op === "eq" || op === "neq" || op === "gt" || op === "lt") return [{ op, v: pv(tok[i + 1]) }, i + 2]; if (op === "range") return [{ op, v: pv(tok[i + 1]), v2: pv(tok[i + 2]) }, i + 3]; return [null, i]; }
function aclParse(text) { const acls = {}, errs = [], apply = []; let cur = null;
  for (const [ln, raw] of String(text || "").replace(/\r/g, "").split("\n").entries()) { const l = raw.trim(); if (!l || l.startsWith("!")) continue; let m; const tok = l.split(/\s+/);
    try {
      if ((m = l.match(/^ip access-list (standard|extended)\s+(\S+)/i))) { cur = acls[m[2]] = acls[m[2]] || { name: m[2], type: m[1].toLowerCase(), rules: [] }; continue; }
      if ((m = l.match(/^(?:interface\s+(\S+))/i))) { cur = { _if: m[1] }; continue; }
      if ((m = l.match(/^ip access-group\s+(\S+)\s+(in|out)/i))) { apply.push({ acl: m[1], dir: m[2].toLowerCase(), ifn: cur && cur._if || "?" }); continue; }
      if ((m = l.match(/^access-class\s+(\S+)\s+in/i))) { apply.push({ acl: m[1], dir: "vty", ifn: "line vty" }); continue; }
      let body = null, acl = null;
      if ((m = l.match(/^access-list\s+(\d+)\s+(.*)$/i))) { const n = +m[1]; acl = acls[m[1]] = acls[m[1]] || { name: m[1], type: (n < 100 || (n >= 1300 && n < 2000)) ? "standard" : "extended", rules: [] }; body = m[2]; }
      else if (cur && cur.rules && /^(\d+\s+)?(permit|deny|remark)\b/i.test(l)) { acl = cur; body = l.replace(/^\d+\s+/, ""); }
      else { if (/^(line|router|hostname|end|exit)\b/i.test(l)) cur = null; continue; }
      const t = body.split(/\s+/); const act = t[0].toLowerCase(); if (act === "remark") continue; if (act !== "permit" && act !== "deny") throw new Error("очікувалось permit або deny");
      const warn = []; const r = { act, line: ln + 1, txt: body.trim(), warn };
      if (acl.type === "standard") { const [s, k] = aclAddr(t, 1, warn); r.src = s; r.proto = "ip"; r.dst = { a: 0, w: 0xffffffff, txt: "any" }; if (t[k] && t[k].toLowerCase() === "log") r.log = true; else if (t[k]) throw new Error("зайве «" + t[k] + "» у стандартному ACL (він перевіряє лише джерело)"); }
      else { const pr = (t[1] || "").toLowerCase(); if (!["ip", "tcp", "udp", "icmp", "ospf", "esp", "gre", "ahp", "eigrp"].includes(pr) && !/^\d+$/.test(pr)) throw new Error("невідомий протокол «" + t[1] + "»"); r.proto = pr;
        let [s, k] = aclAddr(t, 2, warn); r.src = s; if (pr === "tcp" || pr === "udp") { const [p, k2] = aclPort(t, k); r.sp = p; k = k2; }
        const [d, k3] = aclAddr(t, k, warn); r.dst = d; k = k3; if (pr === "tcp" || pr === "udp") { const [p, k4] = aclPort(t, k); r.dp = p; k = k4; }
        while (k < t.length) { const x = t[k].toLowerCase(); if (x === "established" && pr === "tcp") r.est = true; else if (x === "log") r.log = true; else if (pr === "icmp" && /^(echo|echo-reply|unreachable|time-exceeded)$/.test(x)) r.icmp = x; else throw new Error("незрозуміло «" + t[k] + "»"); k++; }
        if ((r.sp || r.dp) && !["tcp", "udp"].includes(pr)) throw new Error("порти можна вказувати лише для tcp/udp"); }
      acl.rules.push(r);
    } catch (e) { errs.push(`рядок ${ln + 1}: ${e.message} — «${l}»`); } }
  return { acls, errs, apply }; }
const aclPM = (p, v) => !p || (v != null && (p.op === "eq" ? v === p.v : p.op === "neq" ? v !== p.v : p.op === "gt" ? v > p.v : p.op === "lt" ? v < p.v : v >= p.v && v <= p.v2));
const aclAM = (x, ip) => ((ip & ~x.w) >>> 0) === x.a;
function aclMatch(r, pk) { if (!aclAM(r.src, pk.s) || !aclAM(r.dst, pk.d)) return false; if (r.proto === "ip") return true; if (r.proto !== pk.proto) return false;
  if (r.proto === "tcp" || r.proto === "udp") { if (r.dp && !aclPM(r.dp, pk.dp)) return false; if (r.sp && !aclPM(r.sp, pk.sp)) return false; if (r.est && !pk.est) return false; } if (r.icmp && pk.icmp && r.icmp !== pk.icmp) return false; return true; }
function aclEval(acl, pk) { for (let i = 0; i < acl.rules.length; i++) if (aclMatch(acl.rules[i], pk)) return { act: acl.rules[i].act, i }; return { act: "deny", i: -1 }; }
function aclPkt(line) { // "192.168.10.5 -> 10.1.1.10 tcp 80", "10.0.0.1 8.8.8.8 icmp", "… tcp 443 est"
  const t = String(line).replace(/->|→/g, " ").trim().split(/\s+/); const s = aclN(t[0]), d = aclN(t[1]); if (s == null || d == null) return null; const proto = (t[2] || "ip").toLowerCase();
  const pk = { s, d, proto, txt: line.trim() }; if (proto === "tcp" || proto === "udp") { const v = t[3]; pk.dp = /^\d+$/.test(v || "") ? +v : ACL_PORTS[(v || "").toLowerCase()]; pk.sp = 50000; if (t.includes("est") || t.includes("established")) pk.est = true; }
  if (proto === "icmp") pk.icmp = t[3] || "echo"; return pk; }
const aclCovers = (a, b) => ((a.w & b.w) >>> 0) === b.w && ((b.a & ~a.w) >>> 0) === a.a; // a ⊇ b
function aclShadow(acl) { const out = []; const R = acl.rules;
  for (let j = 1; j < R.length; j++) for (let i = 0; i < j; i++) { const a = R[i], b = R[j]; if (!aclCovers(a.src, b.src) || !aclCovers(a.dst, b.dst)) continue;
    if (a.proto !== "ip" && a.proto !== b.proto) continue; if (a.dp && !(b.dp && b.dp.op === "eq" && aclPM(a.dp, b.dp.v))) continue; if (a.sp && !(b.sp && b.sp.op === "eq" && aclPM(a.sp, b.sp.v))) continue; if (a.est && !b.est) continue; if (a.icmp && a.icmp !== b.icmp) continue;
    out.push({ j, i, same: a.act === b.act }); break; } return out; }
function aclAdvice(acl, apply) { const A = []; const ap = apply.filter(x => x.acl === acl.name);
  if (!acl.rules.some(r => r.act === "permit")) A.push("Немає жодного permit — через неявний deny any ACL блокує весь трафік.");
  const last = acl.rules[acl.rules.length - 1]; if (last && last.act === "deny" && last.src.w === 0xffffffff && last.dst.w === 0xffffffff && last.proto === "ip") A.push("Явний deny any у кінці нічого не змінює (неявний deny уже є), але з log корисний для статистики.");
  if (!ap.length) A.push(acl.type === "standard" ? "ACL ще не застосовано. Стандартний ACL ставлять якомога ближче до призначення: ip access-group " + acl.name + " out на інтерфейсі в бік мережі, яку захищаєте (або access-class для VTY)." : "ACL ще не застосовано. Розширений ACL ставлять ближче до джерела: ip access-group " + acl.name + " in на інтерфейсі, куди трафік входить з мережі джерела.");
  for (const x of ap) if (acl.type === "standard" && x.dir === "in") A.push(`Стандартний ACL на ${x.ifn} in: він заблокує джерело для всіх напрямків, а не лише до потрібної мережі — частіше його ставлять out ближче до призначення.`);
  return A; }
// ---- задачі ----
const ACL_TASKS = [
  { id: "a1", t: "ENSA4", q: "Стандартний ACL 10: мережа 192.168.20.0/24 не має доступу до LAN 192.168.10.0/24, решта — має.", pk: [["192.168.20.5 192.168.10.10", "deny"], ["192.168.20.200 192.168.10.1", "deny"], ["192.168.30.5 192.168.10.10", "permit"], ["10.1.1.1 192.168.10.10", "permit"]] },
  { id: "a2", t: "ENSA4", q: "Стандартний ACL 5: лише хост 192.168.1.10 і мережа 10.0.0.0/8 можуть підключатися до VTY (access-class).", pk: [["192.168.1.10 192.168.1.1", "permit"], ["192.168.1.11 192.168.1.1", "deny"], ["10.200.3.4 192.168.1.1", "permit"], ["172.16.0.1 192.168.1.1", "deny"]] },
  { id: "a3", t: "ENSA5", q: "Розширений ACL WEB-ONLY: мережа 172.16.0.0/16 може відкривати лише HTTP і HTTPS на сервері 10.1.1.10; усе інше з 172.16.0.0/16 до сервера — заборонено; інший трафік дозволено.", pk: [["172.16.4.4 10.1.1.10 tcp 80", "permit"], ["172.16.4.4 10.1.1.10 tcp 443", "permit"], ["172.16.4.4 10.1.1.10 tcp 22", "deny"], ["172.16.4.4 10.1.1.10 icmp", "deny"], ["172.16.4.4 8.8.8.8 udp 53", "permit"], ["192.168.1.5 10.1.1.10 tcp 22", "permit"]] },
  { id: "a4", t: "ENSA5", q: "Розширений ACL: заборонити ping (echo) з мережі 192.168.10.0/24 до 192.168.20.0/24, решту дозволити.", pk: [["192.168.10.5 192.168.20.5 icmp echo", "deny"], ["192.168.10.5 192.168.20.5 tcp 80", "permit"], ["192.168.20.5 192.168.10.5 icmp echo", "permit"], ["192.168.10.5 8.8.8.8 icmp echo", "permit"]] },
  { id: "a5", t: "ENSA5", q: "Розширений ACL на WAN-інтерфейсі in: пускати з Інтернету лише відповіді на TCP-сесії, ініційовані зсередини (established), і DNS-відповіді від 8.8.8.8 (udp, source port 53) до мережі 203.0.113.0/24.", pk: [["93.184.216.34 203.0.113.10 tcp 50000 est", "permit"], ["93.184.216.34 203.0.113.10 tcp 22", "deny"], ["8.8.8.8 203.0.113.10 udp 53", "permit", { sp: 53, dp: 50000 }], ["1.2.3.4 203.0.113.10 udp 53", "deny", { sp: 1234, dp: 53 }]] },
  { id: "a6", t: "ENSA5", q: "Розширений ACL: адмін-ПК 192.168.99.5 — SSH до будь-якого пристрою мережі 10.0.0.0/8; решті заборонено SSH у 10.0.0.0/8; інший трафік дозволено.", pk: [["192.168.99.5 10.1.2.3 tcp 22", "permit"], ["192.168.99.6 10.1.2.3 tcp 22", "deny"], ["192.168.99.6 10.1.2.3 tcp 443", "permit"], ["172.16.1.1 10.9.9.9 tcp 22", "deny"]] },
  { id: "a7", t: "ENSA4", q: "Стандартний ACL 20: заборонити адреси 192.168.5.0–192.168.5.127, дозволити 192.168.5.128–192.168.5.255 та всі інші мережі.", pk: [["192.168.5.10 10.0.0.1", "deny"], ["192.168.5.127 10.0.0.1", "deny"], ["192.168.5.128 10.0.0.1", "permit"], ["192.168.6.10 10.0.0.1", "permit"]] },
  { id: "a8", t: "ENSA5", q: "Розширений ACL: дозволити гостьовій мережі 172.31.0.0/24 лише DNS (udp 53) і HTTP/HTTPS до будь-кого, і DHCP (udp 67) до будь-кого; решту заборонити.", pk: [["172.31.0.20 8.8.8.8 udp 53", "permit"], ["172.31.0.20 1.1.1.1 tcp 443", "permit"], ["172.31.0.20 255.255.255.255 udp 67", "permit"], ["172.31.0.20 10.1.1.1 tcp 22", "deny"], ["172.31.0.20 8.8.8.8 icmp", "deny"]] }
];
let ACV = null;
function aclTestAll(text, pkts) { const P = aclParse(text); const names = Object.keys(P.acls); const acl = P.acls[ACV && ACV.sel && P.acls[ACV.sel] ? ACV.sel : names[names.length - 1]]; return { P, acl, res: acl ? pkts.map(pk => Object.assign({ pk }, aclEval(acl, pk))) : [] }; }
VIEWS.acl = { html: () => { ACV = ACV || Object.assign({ text: "access-list 110 deny tcp 192.168.10.0 0.0.0.255 host 10.1.1.10 eq 22\naccess-list 110 permit tcp 192.168.10.0 0.0.0.255 any eq 22\naccess-list 110 permit ip 192.168.10.0 0.0.0.255 any\naccess-list 110 deny tcp 192.168.10.0 0.0.0.255 any eq 80\n!\ninterface GigabitEthernet0/1\n ip access-group 110 in", pk: "192.168.10.5 -> 10.1.1.10 tcp 22\n192.168.10.5 -> 10.1.1.20 tcp 22\n192.168.10.5 -> 8.8.8.8 tcp 80\n192.168.20.5 -> 10.1.1.10 icmp", task: null, run: false }, lsGet(ACL_LS, {}));
  const T = ACV.task && ACL_TASKS.find(x => x.id === ACV.task); const pk = T ? T.pk.map(([l, , ex]) => Object.assign(aclPkt(l), ex || {})) : ACV.pk.split("\n").map(aclPkt).filter(Boolean);
  const R = ACV.run ? aclTestAll(ACV.text, pk) : null; const names = R ? Object.keys(R.P.acls) : [];
  const sh = R && R.acl ? aclShadow(R.acl) : []; let pass = null; if (R && T) pass = R.res.every((x, k) => x.act === T.pk[k][1]);
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🛂 Тестер ACL</h2><button class="mini ghost" data-act="home">✕</button></div>
    <div class="chips" style="margin-top:6px"><button class="seg ${!T ? "on" : ""}" data-act="actask" data-id="">Вільний режим</button>${ACL_TASKS.map((x, i) => `<button class="seg ${T && T.id === x.id ? "on" : ""}" data-act="actask" data-id="${x.id}">${(prog["acl-" + x.id] || {}).k ? "✅" : ""}Задача ${i + 1}</button>`).join("")}</div>
    ${T ? `<div class="rb-step" style="margin:8px 0"><b>${esc(T.q)}</b><div class="small muted">${tlabel(T.t)} · Напишіть ACL — тренажер прожене ${T.pk.length} тестових пакетів.</div></div>` : `<p class="small muted" style="margin:6px 0">ACL (нумерований або ip access-list) і, за бажання, interface + ip access-group. Пакети — по рядку: <code>джерело -> призначення протокол порт</code>, для відповіді на TCP-сесію додайте <code>est</code>.</p>`}
    <textarea id="actext" rows="8" style="width:100%;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px">${esc(ACV.text)}</textarea>
    ${T ? "" : `<label class="small" style="display:block;margin-top:6px">Пакети<textarea id="acpk" rows="4" style="width:100%;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px">${esc(ACV.pk)}</textarea></label>`}
    <div class="row" style="margin-top:8px"><button class="primary" data-act="acrun">Перевірити</button></div></div>
  ${R ? `<div class="card">${R.P.errs.length ? `<p class="small" style="color:var(--bad)">${R.P.errs.map(esc).join("<br>")}</p>` : ""}
    ${!R.acl ? `<p class="small">ACL не знайдено.</p>` : `${names.length > 1 ? `<div class="chips">${names.map(n => `<button class="seg ${R.acl.name === n ? "on" : ""}" data-act="acsel" data-n="${esc(n)}">${esc(n)}</button>`).join("")}</div>` : ""}
      <h2>ACL ${esc(R.acl.name)} <span class="small muted">${R.acl.type === "standard" ? "стандартний" : "розширений"}</span></h2>
      <div class="shout">${R.acl.rules.map((r, i) => { const s = sh.find(x => x.j === i); const hits = R.res.filter(x => x.i === i).length; return `<div class="shl ${s ? "bad" : ""}">${String((i + 1) * 10).padStart(3)} ${esc(r.txt)}${hits ? `  (${hits} збіг.)` : ""}</div>${s ? `<div class="shn">⚠️ Ніколи не спрацює: рядок ${(s.i + 1) * 10} вище вже охоплює ці пакети${s.same ? " з тією ж дією — рядок зайвий" : " з протилежною дією — порядок неправильний"}.</div>` : ""}${r.warn.length ? `<div class="shn">⚠️ ${esc(r.warn.join("; "))}</div>` : ""}`; }).join("")}<div class="shl muted">    (неявний deny any)${R.res.some(x => x.i < 0) ? `  (${R.res.filter(x => x.i < 0).length} збіг.)` : ""}</div></div>
      <h3>Пакети</h3>${R.res.map((x, k) => { const exp = T ? T.pk[k][1] : null; const okk = exp ? x.act === exp : null; return `<div class="kv" style="align-items:flex-start"><span class="small"><code>${esc(x.pk.txt)}</code><br>${x.i < 0 ? "неявний deny any" : "рядок " + (x.i + 1) * 10 + ": " + esc(R.acl.rules[x.i].txt)}</span><b style="color:${okk === false ? "var(--bad)" : x.act === "permit" ? "var(--ok)" : "var(--warn)"}">${x.act === "permit" ? "permit" : "deny"}${exp ? (okk ? " ✅" : " ❌ (треба " + exp + ")") : ""}</b></div>`; }).join("")}
      ${pass != null ? `<div class="verdict ${pass ? "ok" : "bad"}">${pass ? "Задачу виконано!" : "Не всі пакети обробляються як треба"}</div>` : ""}
      <h3>Поради</h3><ul class="small">${aclAdvice(R.acl, R.P.apply).map(a => `<li>${esc(a)}</li>`).join("") || "<li>Зауважень немає.</li>"}</ul>`}</div>` : ""}
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.acl = () => { view = "acl"; render(); scrollTop(); };
ACTS.actask = el => { ACV.task = el.dataset.id || null; ACV.run = false; if (ACV.task) { ACV.saveText = ACV.saveText || ACV.text; ACV.text = ""; ACV.taskText = true; } else { ACV.text = ACV.saveText || ACV.text; ACV.saveText = null; } render(); };
ACTS.acsel = el => { ACV.sel = el.dataset.n; render(); };
ACTS.acrun = () => { ACV.text = ($("#actext") || {}).value || ""; const p = $("#acpk"); if (p) ACV.pk = p.value; ACV.run = true; if (!ACV.task) lsSet(ACL_LS, { text: ACV.text, pk: ACV.pk });
  else { const T = ACL_TASKS.find(x => x.id === ACV.task); const R = aclTestAll(ACV.text, T.pk.map(([l, , ex]) => Object.assign(aclPkt(l), ex || {}))); if (R.acl) record("acl-" + T.id, R.res.every((x, k) => x.act === T.pk[k][1])); } render(); };
