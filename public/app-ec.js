"use strict";
// EtherChannel: таблиця всіх пар режимів і «що станеться, якщо…» з різними параметрами членів. Рахує той самий двигун, що й CLI-лаби.
const EC_MODES = ["active", "passive", "desirable", "auto", "on"];
const EC_MIS = { none: "Параметри однакові", allowed: "Gi0/2 на S1: allowed vlan 10", native: "Gi0/2 на S1: native vlan 99", speed: "Gi0/2 на S1: speed 100", access: "Gi0/2 на S1: switchport mode access" };
function ecRun(m1, m2, mis) {
  const def = { devices: { S1: { type: "switch" }, S2: { type: "switch" } }, links: [["S1", "Gi0/1", "S2", "Gi0/1"], ["S1", "Gi0/2", "S2", "Gi0/2"]] }; const { N, ses } = CLI.startNet({ def: () => def });
  const cfg = (d, mode, extra) => { const s = ses[d]; s.exec("enable"); s.exec("configure terminal"); s.exec("interface range gi0/1 - 2"); s.exec("switchport mode trunk"); s.exec("channel-group 1 mode " + mode); for (const c of extra || []) s.exec(c); s.exec("end"); };
  const ex = { none: [], allowed: ["interface gi0/2", "switchport trunk allowed vlan 10"], native: ["interface gi0/2", "switchport trunk native vlan 99"], speed: ["interface gi0/2", "speed 100"], access: ["interface gi0/2", "switchport mode access"] }[mis || "none"];
  cfg("S1", m1, ex); cfg("S2", m2); N.recompute(); N.recompute();
  const f = d => ["Gi0/1", "Gi0/2"].map(p => N.dev[d].ifs[p]._ec || "-"); const why = ["Gi0/1", "Gi0/2"].map(p => N.dev.S1.ifs[p]._ecWhy).filter(Boolean);
  return { f1: f("S1"), f2: f("S2"), up: f("S1").includes("P"), sh1: ses.S1.exec("show etherchannel summary"), sh2: ses.S2.exec("show etherchannel summary"), log: (N.dev.S1.logBuf || []).concat((N.dev.S2.logBuf || []).map(x => "S2 " + x)).filter(x => /%EC|%LINEPROTO-5-UPDOWN: Line protocol on Interface Port/.test(x)), why }; }
const ecOut = r => r.f1.every(x => x === "P") ? 0 : r.f1.includes("P") ? 1 : 2;
const ecProto = m => ["active", "passive"].includes(m) ? "LACP" : ["desirable", "auto"].includes(m) ? "PAgP" : "без протоколу";
function ecExplain(a, b, r) { if (r.up && r.f1.every(x => x === "P")) return `${a} + ${b}: ${a === "on" ? "обидва боки on — канал без узгодження." : `${ecProto(a)} узгоджено: хоча б один бік ініціює (${["active", "desirable"].includes(a) ? a : b}).`}`;
  if (r.f1.includes("P") && r.f1.includes("s")) return "Один член має інші параметри — його призупинено (s), канал працює на решті портів.";
  if (ecProto(a) !== ecProto(b)) return `${ecProto(a)} і ${ecProto(b)} — різні протоколи (або один бік on без протоколу), узгодження не відбудеться. На реальному обладнанні бік з on вважає порти зібраними, а інший — ні: можливі петлі, і EtherChannel misconfig guard переводить порти в err-disabled.`;
  return `${a} + ${b}: жоден бік не ініціює узгодження ${ecProto(a)} — порти лишаються stand-alone (I), STP заблокує один з лінків.`; }
let ECV = { a: "active", b: "passive", mis: "none", quiz: null };
let EC_M = null;
VIEWS.eclab = { html: () => { if (!EC_M) { EC_M = {}; for (const a of EC_MODES) for (const b of EC_MODES) EC_M[a + "|" + b] = ecRun(a, b, "none"); } const M = EC_M;
  const q = ECV.quiz; const cur = q ? q : { a: ECV.a, b: ECV.b, mis: ECV.mis }; const r = ecRun(cur.a, cur.b, cur.mis); const show = !q || q.pick != null;
  const outc = ecOut; const O = ["Канал зібрано, обидва порти (P)", "Канал працює, але один порт (s) suspended", "Канал не зібрано (порти I або s)"];
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🔗 EtherChannel: режими й наслідки</h2><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:6px 0">S1 і S2 з'єднані двома лінками Gi0/1–2, обидва в channel-group 1, trunk. Натисніть клітинку — побачите вивід і журнал з обох боків.</p>
    <table class="ectab"><tr><th>S1 \\ S2</th>${EC_MODES.map(b => `<th>${b}</th>`).join("")}</tr>${EC_MODES.map(a => `<tr><th>${a}</th>${EC_MODES.map(b => { const x = M[a + "|" + b]; return `<td data-act="ecpick" data-a="${a}" data-b="${b}" style="cursor:pointer;text-align:center;${!q && ECV.a === a && ECV.b === b ? "outline:2px solid var(--accent);" : ""}background:${x.up ? "var(--ok-soft)" : "var(--bad-soft)"}">${x.up ? "✅" : "❌"}</td>`; }).join("")}</tr>`).join("")}</table>
    <p class="small muted" style="margin:6px 0 0">LACP: active ініціює, passive відповідає. PAgP: desirable ініціює, auto відповідає. on — без протоколу, лише з on.</p></div>
  <div class="card"><div class="row"><h2 class="grow" style="margin:0">${q ? "🎲 Передбачте результат" : "Що станеться, якщо…"}</h2>${q ? "" : `<button class="mini" data-act="ecquiz">🎲 Задача</button>`}</div>
    ${q ? `<p style="margin:6px 0"><b>S1: ${q.a}, S2: ${q.b}</b>. ${esc(EC_MIS[q.mis])}.</p>${O.map((o, i) => { let c = "opt"; if (q.pick != null) { if (i === outc(r)) c += " ok"; else if (i === q.pick) c += " bad"; } return `<button class="${c}" data-act="ecans" data-i="${i}" ${q.pick != null ? "disabled" : ""}>${esc(o)}</button>`; }).join("")}`
      : `<div class="chips" style="margin:6px 0">${Object.entries(EC_MIS).map(([k, n]) => `<button class="seg ${ECV.mis === k ? "on" : ""}" data-act="ecmis" data-k="${k}">${esc(n)}</button>`).join("")}</div><p style="margin:6px 0"><b>S1: ${ECV.a} · S2: ${ECV.b}</b></p>`}
    ${show ? `<p class="small" style="margin:6px 0">${esc(ecExplain(cur.a, cur.b, r))}${r.why.length ? " Причина: " + esc(r.why.join("; ")) + "." : ""}</p>
      <div class="small muted">S1# show etherchannel summary</div><pre>${esc(r.sh1.split("\n").slice(-3).join("\n"))}</pre><div class="small muted">S2# show etherchannel summary</div><pre>${esc(r.sh2.split("\n").slice(-3).join("\n"))}</pre>
      ${r.log.length ? `<div class="small muted">Журнал</div><pre style="white-space:pre-wrap">${esc(r.log.join("\n"))}</pre>` : ""}
      ${q ? `<div class="navbar"><button class="primary" data-act="ecquiz">Наступна задача →</button><button data-act="ecexit">До таблиці</button></div>` : ""}` : ""}</div>
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.eclab = () => { ECV.quiz = null; view = "eclab"; render(); scrollTop(); };
ACTS.ecpick = el => { ECV.quiz = null; ECV.a = el.dataset.a; ECV.b = el.dataset.b; render(); };
ACTS.ecmis = el => { ECV.mis = el.dataset.k; render(); };
ACTS.ecquiz = () => { const okPairs = []; for (const a of EC_MODES) for (const b of EC_MODES) okPairs.push([a, b]); const [a, b] = SH_P(okPairs); ECV.quiz = { a, b, mis: SH_P(["none", "none", "allowed", "speed", "native", "access"]), pick: null }; render(); };
ACTS.ecans = el => { const q = ECV.quiz; q.pick = Number(el.dataset.i); const r = ecRun(q.a, q.b, q.mis); const o = ecOut(r); record("ec-lab", q.pick === o); render(); };
ACTS.ecexit = () => { ECV.quiz = null; render(); };
