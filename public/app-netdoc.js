"use strict";
// Документація мережі з виводів: show cdp/lldp neighbors (detail), show ip interface brief, show vlan brief з кількох пристроїв →
// схема топології, таблиці лінків і адрес, експорт у .md з діаграмою Mermaid для Obsidian.
const ND_LS = "ccna.netdoc";
const ND_IF = "(?:[A-Za-z]{2,}-?[A-Za-z]*)\\s?\\d+(?:/\\d+)*(?:\\.\\d+)?";
function ndShort(n) { return n.replace(/\..*$/, "").replace(/\(.*\)$/, ""); }
function ndParse(text) {
  const D = {}, L = []; const dev = n => D[n] = D[n] || { name: n, ifs: {}, vlans: null, type: null, ip: null, platform: "" };
  const blocks = []; let cur = null;
  for (const raw of String(text || "").replace(/\r/g, "").split("\n")) { const m = raw.match(/^([A-Za-z0-9_.-]+)[#>]\s*(sh(?:ow)?\s+.*)$/i); if (m) { cur = { host: m[1], cmd: m[2].toLowerCase(), lines: [] }; blocks.push(cur); continue; } if (cur) cur.lines.push(raw); }
  const addLink = (a, pa, b, pb) => { pa = ccIf(pa.replace(/\s+/g, "")); pb = ccIf(pb.replace(/\s+/g, "")); b = ndShort(b); dev(b);
    if (!L.some(l => (l.a === a && l.pa === pa && l.b === b && l.pb === pb) || (l.a === b && l.pa === pb && l.b === a && l.pb === pa))) L.push({ a, pa, b, pb }); };
  const typeOf = (cap, plat) => /\bR\b|Router/.test(cap) || /ISR|router|C8\d|C1\d{3}/i.test(plat) ? "router" : /\bS\b|Switch/.test(cap) || /WS-C|C9\d{3}|switch/i.test(plat) ? "switch" : /\bP\b|Phone/i.test(cap) ? "phone" : /AIR|AP/.test(plat) ? "ap" : "host";
  for (const b of blocks) { const me = dev(b.host); const ls = b.lines;
    if (/(cdp|lldp) nei\S*\s+det/.test(b.cmd) || /(cdp|lldp) entry/.test(b.cmd)) { let e = null; const flush = () => { if (e && e.id && e.local && e.port) { addLink(b.host, e.local, e.id, e.port); const o = dev(ndShort(e.id)); if (e.ip) o.ip = o.ip || e.ip; if (e.plat) o.platform = e.plat; o.type = o.type || typeOf(e.cap || "", e.plat || ""); } };
      for (const l of ls) { let m; if (/^-{5,}/.test(l)) { flush(); e = {}; continue; } e = e || {};
        if ((m = l.match(/^(?:Device ID|System Name):\s*(\S+)/i))) e.id = m[1]; else if ((m = l.match(/IP(?:v4)? address:\s*(\d+\.\d+\.\d+\.\d+)/i)) && !e.ip) e.ip = m[1];
        else if ((m = l.match(/^Platform:\s*([^,]+),\s*Capabilities:\s*(.*)$/i))) { e.plat = m[1].trim(); e.cap = m[2]; }
        else if ((m = l.match(/^Interface:\s*([^,]+),\s*Port ID \(outgoing port\):\s*(\S+)/i))) { e.local = m[1].trim(); e.port = m[2]; }
        else if ((m = l.match(/^Local Intf:\s*(\S+)/i))) e.local = m[1]; else if ((m = l.match(/^Port id:\s*(\S+)/i))) e.port = m[1]; else if ((m = l.match(/^System Capabilities:\s*(.*)/i))) e.cap = m[1]; }
      flush(); continue; }
    if (/(cdp|lldp) nei/.test(b.cmd)) { let hdr = false; const rows = []; for (const l of ls) { if (/Device ID\s+Local Intr?f/i.test(l)) { hdr = true; continue; } if (!hdr || !l.trim() || /^Total/i.test(l)) continue;
        if (/^\S+\s*$/.test(l) && rows.length >= 0) { rows.push(l.trim()); continue; } if (/^\s+/.test(l) && rows.length && /^\S+$/.test(rows[rows.length - 1])) { rows[rows.length - 1] += " " + l.trim(); continue; } rows.push(l.trim()); }
      const re = new RegExp("^(\\S+)\\s+(" + ND_IF + ")\\s+(\\d+)\\s+(.*?)\\s*(" + ND_IF + ")$");
      for (const r of rows) { const m = r.match(re); if (!m) continue; const mid = m[4]; const plat = (mid.match(/\s{1,}(\S+(?:\s\S+)?)$/) || [])[1] || ""; addLink(b.host, m[2], m[1], m[5]); const o = dev(ndShort(m[1])); o.type = o.type || typeOf(mid, plat); if (plat && !o.platform) o.platform = plat; }
      continue; }
    if (/ip int\S* br/.test(b.cmd)) { for (const l of ls) { const m = l.match(/^(\S+)\s+(\S+)\s+(YES|NO)\s+(\S+)\s+(up|down|administratively down|deleted)\s+(up|down)\s*$/); if (!m) continue; me.ifs[ccIf(m[1])] = { ip: m[2] === "unassigned" ? null : m[2], st: m[5], pr: m[6], method: m[4] }; } continue; }
    if (/vlan br/.test(b.cmd)) { me.vlans = ccVlanBrief(ls.join("\n")); me.type = me.type || "switch"; continue; } }
  for (const d of Object.values(D)) { if (!d.type) d.type = /^R|rtr|router/i.test(d.name) ? "router" : /^S|sw/i.test(d.name) || d.vlans ? "switch" : "host"; if (!d.ip) { const up = Object.entries(d.ifs).find(([, i]) => i.ip && i.st === "up"); if (up) d.ip = up[1].ip; } }
  return { D, L, blocks: blocks.length }; }
function ndSVG(R) { const ds = Object.values(R.D); const lay = { router: 0, switch: 1, ap: 2, phone: 2, host: 2 }; const rows = [[], [], []]; for (const d of ds) rows[lay[d.type] != null ? lay[d.type] : 2].push(d);
  const used = rows.filter(r => r.length); const W = 480, H = Math.max(150, used.length * 115); const pos = {}; used.forEach((r, k) => r.forEach((d, j) => { pos[d.name] = [Math.round(W * (j + 1) / (r.length + 1)), 45 + k * 110]; }));
  const ic = { router: "⭘", switch: "▦", ap: "📶", phone: "☎", host: "🖥" };
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${R.L.map(l => { const [x1, y1] = pos[l.a], [x2, y2] = pos[l.b]; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--accent)" stroke-width="2"/><text x="${x1 + (x2 - x1) * 0.32}" y="${y1 + (y2 - y1) * 0.32 - 3}" font-size="11" stroke="var(--card)" stroke-width="3" paint-order="stroke" text-anchor="middle" fill="var(--muted)">${esc(l.pa)}</text><text x="${x1 + (x2 - x1) * 0.68}" y="${y1 + (y2 - y1) * 0.68 - 3}" font-size="11" stroke="var(--card)" stroke-width="3" paint-order="stroke" text-anchor="middle" fill="var(--muted)">${esc(l.pb)}</text>`; }).join("")}
    ${ds.map(d => { const [x, y] = pos[d.name]; return `<g><rect x="${x - 52}" y="${y - 20}" width="104" height="40" rx="${d.type === "router" ? 17 : 5}" fill="var(--card)" stroke="var(--line)" stroke-width="1.5"/><text x="${x}" y="${y - 2}" text-anchor="middle" font-size="14" font-weight="600" fill="var(--text)">${ic[d.type] || ""} ${esc(d.name.length > 12 ? d.name.slice(0, 11) + "…" : d.name)}</text><text x="${x}" y="${y + 14}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc((d.ip || d.platform || "").slice(0, 16))}</text></g>`; }).join("")}</svg>`; }
function ndMd(R) { const id = n => n.replace(/[^A-Za-z0-9_]/g, "_"); const L = ["---", "tags: [мережа, документація]", "updated: " + dkey(), "---", "# Схема мережі", "", "```mermaid", "graph TD"];
  for (const d of Object.values(R.D)) L.push(`  ${id(d.name)}${d.type === "router" ? `(("${d.name}"))` : `["${d.name}${d.ip ? "<br>" + d.ip : ""}"]`}`);
  for (const l of R.L) L.push(`  ${id(l.a)} ---|"${l.pa} ↔ ${l.pb}"| ${id(l.b)}`); L.push("```", "", "## Лінки", "", "| Пристрій | Порт | Сусід | Порт сусіда |", "|---|---|---|---|"); for (const l of R.L) L.push(`| ${l.a} | ${l.pa} | ${l.b} | ${l.pb} |`);
  const addr = Object.values(R.D).flatMap(d => Object.entries(d.ifs).filter(([, i]) => i.ip).map(([n, i]) => [d.name, n, i.ip, i.method, i.st + "/" + i.pr]));
  if (addr.length) { L.push("", "## Адреси", "", "| Пристрій | Інтерфейс | IP | Метод | Стан |", "|---|---|---|---|---|"); for (const r of addr) L.push("| " + r.join(" | ") + " |"); }
  for (const d of Object.values(R.D).filter(d => d.vlans)) { L.push("", "## VLAN " + d.name, "", "| VLAN | Ім'я | Порти |", "|---|---|---|"); for (const [v, x] of Object.entries(d.vlans)) if (+v < 1002) L.push(`| ${v} | ${x.name} | ${x.ports.join(", ")} |`); }
  return L.join("\n") + "\n"; }
let NDV = null;
const ND_SAMPLE = `R1#show cdp neighbors
Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID
S1               Gig 0/0           163            S I     WS-C2960- Gig 0/1
ISP.corp.local
                 Gig 0/1           150            R B S I   ISR4321  Gig 0/0/0
R1#show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     unassigned      YES unset  up                    up
GigabitEthernet0/0.10  192.168.10.1    YES manual up                    up
GigabitEthernet0/1     203.0.113.2     YES DHCP   up                    up
S1#show cdp neighbors
Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID
R1               Gig 0/1           150             R B S I  ISR4321   Gig 0/0
S2               Fas 0/24          170              S I     WS-C2960- Fas 0/24
SEP001122334455  Fas 0/5           140             H P M    IP Phone  Port 1
S1#show vlan brief
VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Fa0/7, Fa0/8
10   USERS                            active    Fa0/1, Fa0/2, Fa0/5
99   MGMT                             active
`;
VIEWS.netdoc = { html: () => { NDV = NDV || { text: lsGet(ND_LS, ""), R: null };
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🗺 Документація мережі з виводів</h2><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:6px 0">Вставте разом з рядками запрошення (<code>S1#show cdp neighbors</code>) виводи з усіх пристроїв: <code>show cdp neighbors</code> або <code>detail</code>, <code>show lldp neighbors</code>, <code>show ip interface brief</code>, <code>show vlan brief</code>. Тренажер намалює схему й складе таблиці — збережіть у Obsidian як .md з діаграмою Mermaid.</p>
    <textarea id="ndtext" rows="10" style="width:100%;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px">${esc(NDV.text)}</textarea>
    <div class="row" style="margin-top:8px"><button class="primary" data-act="ndrun">Побудувати</button><button data-act="ndsample">Приклад</button></div></div>
  ${NDV.R ? (NDV.R.L.length || Object.keys(NDV.R.D).length ? `<div class="card"><h2>Схема <span class="small muted">${Object.keys(NDV.R.D).length} пристр. · ${NDV.R.L.length} лінк.</span></h2>${ndSVG(NDV.R)}
      <div class="row" style="margin-top:6px"><button class="primary" data-act="ndmd">⬇ .md для Obsidian</button><button data-act="ndtwin">🧪 Цифровий двійник у пісочниці</button>${typeof ghPut === "function" && opts.obRepo ? `<button data-act="ndpush">⬆ У vault</button>` : ""}</div><span class="small muted" id="ndmsg"></span></div>
    <div class="card"><h2>Лінки</h2><table><tr><th>Пристрій</th><th>Порт</th><th>Сусід</th><th>Порт</th></tr>${NDV.R.L.map(l => `<tr><td>${esc(l.a)}</td><td>${esc(l.pa)}</td><td>${esc(l.b)}</td><td>${esc(l.pb)}</td></tr>`).join("")}</table>
      ${Object.values(NDV.R.D).some(d => Object.values(d.ifs).some(i => i.ip)) ? `<h3>Адреси</h3><table><tr><th>Пристрій</th><th>Інтерфейс</th><th>IP</th><th>Стан</th></tr>${Object.values(NDV.R.D).flatMap(d => Object.entries(d.ifs).filter(([, i]) => i.ip).map(([n, i]) => `<tr><td>${esc(d.name)}</td><td>${esc(n)}</td><td>${esc(i.ip)}${i.method === "DHCP" ? " <span class='small muted'>DHCP</span>" : ""}</td><td class="small">${esc(i.st)}/${esc(i.pr)}</td></tr>`)).join("")}</table>` : ""}</div>`
    : `<div class="card"><p class="small" style="margin:0">Не знайдено жодного виводу. Перевірте, що перед кожним виводом є рядок запрошення, наприклад <code>S1#show cdp neighbors</code>.</p></div>`) : ""}
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.netdoc = () => { view = "netdoc"; render(); scrollTop(); };
ACTS.ndrun = () => { NDV.text = ($("#ndtext") || {}).value || ""; lsSet(ND_LS, NDV.text.length < 80000 ? NDV.text : ""); NDV.R = ndParse(NDV.text); render(); };
ACTS.ndsample = () => { NDV.text = ND_SAMPLE; NDV.R = ndParse(ND_SAMPLE); render(); };
ACTS.ndmd = () => saveDownload("Схема мережі.md", ndMd(NDV.R), "text/markdown");
ACTS.ndpush = async () => { const m = $("#ndmsg"); try { const tok = localStorage.getItem(GH_TOK) || ""; if (!tok) throw new Error("немає токена GitHub (розділ «Імпорт з GitHub»)"); const dir = (opts.obWriteDir || "CCNA/Тренажер").replace(/^\/|\/$/g, ""); let br = opts.obBranch; if (!br) br = (await ghJson("https://api.github.com/repos/" + opts.obRepo, tok)).default_branch; await ghPut(opts.obRepo, br, dir + "/Схема мережі.md", ndMd(NDV.R), tok); if (m) m.textContent = "Записано у vault ✅"; } catch (e) { if (m) m.textContent = "Помилка: " + e.message; } };
// ---- цифровий двійник: схема → пісочниця симулятора з тими ж пристроями, лінками, адресами й VLAN ----
function ndTwin(R) { const notes = []; const nameOf = {}; const used = new Set();
  for (const n of Object.keys(R.D)) { let s = n.replace(/[^\w-]/g, "").replace(/^[^A-Za-z]+/, "") || "D"; s = s.slice(0, 20); let k = s, i = 2; while (used.has(k)) k = s.slice(0, 18) + i++; used.add(k); nameOf[n] = k; if (k !== n) notes.push(`${n} → ${k} (ім'я пристрою)`); }
  const ds = Object.values(R.D); const svis = d => Object.entries(d.ifs).filter(([n, i]) => /^Vlan\d+$/.test(n) && i.ip); const isL3 = d => d.type === "switch" && svis(d).length > 1;
  const tp = d => d.type === "router" ? "router" : d.type === "switch" ? "switch" : "pc"; const avail = { router: ["Gi0/0", "Gi0/1", "Gi0/2"], switch: [...Array.from({ length: 24 }, (_, k) => "Fa0/" + (k + 1)), "Gi0/1", "Gi0/2"], pc: ["Fa0"] };
  const free = {}; for (const d of ds) free[d.name] = avail[tp(d)].slice(); const map = {}; const pmap = (d, p) => { const key = d.name + "|" + p; if (map[key]) return map[key]; const F = free[d.name]; let q = F.includes(p) ? p : F.find(x => x.slice(0, 2) === p.slice(0, 2)) || F[0]; if (!q) return null; F.splice(F.indexOf(q), 1); map[key] = q; if (q !== p && tp(d) !== "pc") notes.push(`${d.name} ${p} → ${q}`); return q; };
  const links = []; for (const l of R.L) { const A = R.D[l.a], B = R.D[l.b]; const pa = pmap(A, l.pa), pb = pmap(B, l.pb); if (!pa || !pb) { notes.push(`лінк ${l.a} ${l.pa} — ${l.b} ${l.pb} пропущено: у симуляторі немає вільного порту`); continue; } links.push([nameOf[l.a], pa, nameOf[l.b], pb, A, B]); }
  const devices = {}; for (const d of ds) devices[nameOf[d.name]] = tp(d) === "pc" ? { type: "pc" } : { type: tp(d), l3: isL3(d) };
  const { N, ses } = CLI.startNet({ def: () => ({ devices, links: links.map(x => x.slice(0, 4)) }) }); const cmds = {}; const C = (d, ...c) => (cmds[nameOf[d.name]] = cmds[nameOf[d.name]] || []).push(...c);
  for (const d of ds) { if (tp(d) === "pc") continue;
    if (d.type === "router") for (const [n, i] of Object.entries(d.ifs)) { if (!i.ip && i.method !== "DHCP") continue; const [base, sub] = n.split("."); const b = map[d.name + "|" + base] || (avail.router.includes(base) && free[d.name].includes(base) ? (free[d.name].splice(free[d.name].indexOf(base), 1), map[d.name + "|" + base] = base) : null); if (!b) { notes.push(`${d.name} ${n} пропущено: немає відповідного порту`); continue; }
      if (sub) C(d, "interface " + b, "no shutdown", "interface " + b + "." + sub, "encapsulation dot1Q " + sub, "ip address " + i.ip + " 255.255.255.0"); else C(d, "interface " + b, i.method === "DHCP" ? "ip address dhcp" : "ip address " + i.ip + " 255.255.255.0", "no shutdown"); }
    if (d.type === "switch") { if (d.vlans) for (const [v, x] of Object.entries(d.vlans)) { if (+v === 1 || +v >= 1002) continue; C(d, "vlan " + v, "name " + x.name.slice(0, 32)); for (const p of x.ports) { const q = map[d.name + "|" + p] || (free[d.name].includes(p) ? p : null); if (q) C(d, "interface " + q, "switchport mode access", "switchport access vlan " + v); } }
      for (const [n, i] of svis(d)) C(d, "interface " + n, "ip address " + i.ip + " 255.255.255.0", "no shutdown"); if (isL3(d)) C(d, "ip routing"); } }
  for (const [a, pa, b, pb, A, B] of links) { const trunkTo = (X, Y) => Y.type === "switch" || (Y.type === "router" && Object.keys(Y.ifs).some(n => n.includes("."))); if (A.type === "switch" && trunkTo(A, B)) C(A, "interface " + pa, "switchport mode trunk"); if (B.type === "switch" && trunkTo(B, A)) C(B, "interface " + pb, "switchport mode trunk"); }
  for (const [d, list] of Object.entries(cmds)) { const s = ses[d]; s.exec("enable"); s.exec("configure terminal"); for (const c of list) s.exec(c); s.exec("end"); }
  N.recompute(); const types = {}; for (const d of ds) types[nameOf[d.name]] = isL3(d) ? "l3" : tp(d); const data = CLI.saveNet(N, types); data.ts = Date.now();
  if (ds.some(d => Object.values(d.ifs).some(i => i.ip))) notes.unshift("Маски з show ip interface brief не видно — встановлено /24; виправте в пісочниці за потреби.");
  return { data, notes }; }
ACTS.ndtwin = () => { const { data, notes } = ndTwin(NDV.R); if (!sbValid(data)) { alert("Не вдалося побудувати топологію для пісочниці"); return; } if (!confirm("Відкрити схему як пісочницю симулятора (" + Object.keys(data.devs).length + " пристроїв)? Ваша поточна пісочниця буде замінена." + (notes.length ? "\n\nЗауваження:\n" + notes.slice(0, 12).join("\n") : ""))) return;
  lsSet(LS.sandbox, data); if (store.mode === "db") queueWrite(() => store.db.doc("sandbox/main").set({ json: JSON.stringify(data), ts: data.ts })); openSandbox(data); };
