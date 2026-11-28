"use strict";
// Візуалізатор STP: покрокові вибори root bridge / root port / designated, режим «перевір себе», обрив лінку.
// Розрахунок ролей — той самий, що в CLI-симуляторі (CLI.Net → N.stp), тож результат збігається з show spanning-tree у лабах.
const STP_PRESETS = {
  tri: { name: "Трикутник", pos: { S1: [200, 40], S2: [80, 200], S3: [320, 200] },
    links: [["S1", "Gi0/1", "S2", "Gi0/1"], ["S1", "Gi0/2", "S3", "Gi0/1"], ["S2", "Fa0/1", "S3", "Fa0/1"]] },
  sq: { name: "Кільце з 4", pos: { S1: [80, 40], S2: [320, 40], S3: [80, 210], S4: [320, 210] },
    links: [["S1", "Gi0/1", "S2", "Gi0/1"], ["S1", "Gi0/2", "S3", "Gi0/1"], ["S2", "Fa0/1", "S4", "Fa0/1"], ["S3", "Fa0/1", "S4", "Fa0/2"]] },
  mesh: { name: "Кільце + діагональ", pos: { S1: [80, 40], S2: [320, 40], S3: [80, 210], S4: [320, 210] },
    links: [["S1", "Gi0/1", "S2", "Gi0/1"], ["S1", "Gi0/2", "S3", "Gi0/1"], ["S2", "Fa0/1", "S4", "Fa0/1"], ["S3", "Fa0/1", "S4", "Fa0/2"], ["S1", "Fa0/1", "S4", "Fa0/3"]] },
  par: { name: "Подвійний лінк", pos: { S1: [200, 40], S2: [80, 210], S3: [320, 210] },
    links: [["S1", "Gi0/1", "S2", "Gi0/1"], ["S1", "Gi0/2", "S2", "Gi0/2"], ["S1", "Fa0/1", "S3", "Fa0/1"], ["S2", "Fa0/2", "S3", "Fa0/2"]] }
};
let STPV = null;
function stpNew(preset) {
  const P = STP_PRESETS[preset] || STP_PRESETS.tri; const names = Object.keys(P.pos);
  const prios = shuffle([24576, 28672, 32768, 32768, 32768, 32768]).slice(0, names.length);
  const macs = new Set(); const mac = () => { let m; do { m = "0019.e8" + (16 + Math.floor(Math.random() * 239)).toString(16).padStart(2, "0") + "." + (Math.floor(Math.random() * 255)).toString(16).padStart(2, "0") + "00"; } while (macs.has(m)); macs.add(m); return m; };
  const devices = {}; names.forEach((n, k) => { const p = prios[k], m = mac(); devices[n] = { type: "switch", mac: m, setup: s => { if (p !== 32768) s.stpPrio = { 1: p }; } }; });
  STPV = { preset, step: 0, mode: STPV ? STPV.mode : "learn", N: CLI.Net({ devices, links: P.links.map(l => l.slice()) }), guess: { root: null, ports: {} }, checked: false, cut: [], prev: null };
  STPV.N.recompute();
}
const stpInfo = () => STPV.N.stp(1) || {};
const stpBid = (d) => { const s = STPV.N.dev[d]; const p = (s.stpPrio[1] !== undefined ? s.stpPrio[1] : 32768) + 1; return { p, mac: s.mac }; };
const stpBidTxt = d => { const b = stpBid(d); return b.p + " · " + b.mac; };
const ROLE_UA = { Root: "Root port", Desg: "Designated", Altn: "Alternate (BLK)" };
function stpEnds() { // кінці лінків з ролями
  const info = stpInfo(); const P = STP_PRESETS[STPV.preset];
  return P.links.map(([a, pa, b, pb], k) => { const down = STPV.N.dev[a].ifs[pa].shutdown;
    const role = (d, p) => { if (down) return null; const r = info[d] && info[d].roles[p]; return r ? r[0] : null; };
    const ca = STPV.N.dev[a].ifs[pa].stpCost || (pa.startsWith("Gi") ? 4 : 19), cb = STPV.N.dev[b].ifs[pb].stpCost || (pb.startsWith("Gi") ? 4 : 19); return { k, a, pa, b, pb, down, ra: role(a, pa), rb: role(b, pb), cost: ca === cb ? ca : ca + "/" + cb }; });
}
function stpSVG() {
  const P = STP_PRESETS[STPV.preset], info = stpInfo(), ends = stpEnds(); const step = STPV.mode === "learn" ? STPV.step : 9; const quiz = STPV.mode !== "learn";
  const pairN = {}, pairK = {}; const pk = e => [e.a, e.b].sort().join("|"); ends.forEach(e => pairN[pk(e)] = (pairN[pk(e)] || 0) + 1);
  const col = r => r === "Root" ? "var(--ok)" : r === "Desg" ? "var(--accent)" : r === "Altn" ? "var(--bad)" : "var(--muted)";
  const short = r => r === "Root" ? "R" : r === "Desg" ? "D" : r === "Altn" ? "A" : "?";
  let g = "";
  for (const e of ends) {
    const [x1, y1] = P.pos[e.a], [x2, y2] = P.pos[e.b]; const k = pk(e); const idx = pairK[k] = (pairK[k] === undefined ? 0 : pairK[k] + 1); const off = (idx - (pairN[k] - 1) / 2) * 14;
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ox = -dy / L * off, oy = dx / L * off; const X1 = x1 + ox, Y1 = y1 + oy, X2 = x2 + ox, Y2 = y2 + oy;
    const blocked = !quiz && step >= 4 && (e.ra === "Altn" || e.rb === "Altn");
    g += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="${e.down ? "var(--bad)" : blocked ? "var(--bad)" : "var(--muted)"}" stroke-width="${e.down ? 2 : 3}" ${e.down || blocked ? 'stroke-dasharray="6 5"' : ""} opacity="${e.down ? .5 : 1}"/>`;
    g += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="transparent" stroke-width="16" data-act="stpcut" data-k="${e.k}" style="cursor:pointer"><title>${e.down ? "Відновити лінк" : "Обірвати лінк"} ${e.a} ${e.pa} — ${e.b} ${e.pb}</title></line>`;
    g += `<text x="${(X1 + X2) / 2}" y="${(Y1 + Y2) / 2 - 6}" font-size="10" text-anchor="middle" fill="var(--muted)" paint-order="stroke" stroke="var(--card)" stroke-width="3">${e.down ? "✂ обрив" : "cost " + e.cost}</text>`;
    for (const [d, p, r, fx, fy] of [[e.a, e.pa, e.ra, X1 + dx * 0.27, Y1 + dy * 0.27], [e.b, e.pb, e.rb, X2 - dx * 0.27, Y2 - dy * 0.27]]) {
      if (e.down) continue; const key = d + "|" + p;
      let show = null, c = "var(--muted)";
      if (quiz) { const gss = STPV.guess.ports[key]; show = gss ? short(gss) : "?"; c = gss ? col(gss) : "var(--muted)"; if (STPV.checked) c = gss === r ? "var(--ok)" : "var(--bad)"; }
      else if ((r === "Root" && step >= 2) || (r === "Desg" && step >= 3) || (r === "Altn" && step >= 4)) { show = short(r); c = col(r); }
      g += `<g ${quiz && !STPV.checked ? `data-act="stpport" data-key="${key}" style="cursor:pointer"` : ""}><circle cx="${fx}" cy="${fy}" r="11" fill="var(--card)" stroke="${c}" stroke-width="2"/><text x="${fx}" y="${fy + 4}" font-size="11" font-weight="700" text-anchor="middle" fill="${c}">${show || "·"}</text></g>`;
      g += `<text x="${fx}" y="${fy + 22}" font-size="9" text-anchor="middle" fill="var(--muted)" paint-order="stroke" stroke="var(--card)" stroke-width="3">${p}</text>`;
    }
  }
  for (const [n, [x, y]] of Object.entries(P.pos)) {
    const isRoot = info[n] && info[n].rootName === n; const showRoot = quiz ? STPV.guess.root === n : step >= 1 && isRoot;
    const stroke = quiz && STPV.checked && STPV.guess.root === n ? (isRoot ? "var(--ok)" : "var(--bad)") : showRoot ? "var(--warn)" : "var(--accent)";
    g += `<g ${quiz && !STPV.checked ? `data-act="stproot" data-n="${n}" style="cursor:pointer"` : ""}><rect x="${x - 52}" y="${y - 20}" width="104" height="40" rx="7" fill="var(--accent-soft)" stroke="${stroke}" stroke-width="${showRoot ? 3 : 2}"/>
      <text x="${x}" y="${y - 4}" font-size="12" font-weight="700" text-anchor="middle" fill="var(--text)">${showRoot ? "👑 " : ""}${n}</text>
      <text x="${x}" y="${y + 11}" font-size="9" text-anchor="middle" fill="var(--muted)">${stpBidTxt(n)}</text></g>`;
  }
  return `<div class="topo"><svg viewBox="0 0 400 250" role="img" aria-label="Топологія STP">${g}</svg></div>`;
}
function stpExplain() {
  const info = stpInfo(); const names = Object.keys(STP_PRESETS[STPV.preset].pos); const s = STPV.step; const L = [];
  const cmp = (a, b) => { const A = stpBid(a), B = stpBid(b); return A.p - B.p || (A.mac < B.mac ? -1 : A.mac > B.mac ? 1 : 0); };
  if (s === 0) { L.push("<b>Крок 0. Старт.</b> Кожен комутатор вважає root себе й надсилає BPDU зі своїм Bridge ID (BID) = пріоритет + VLAN ID (sys-id-ext) + MAC-адреса.");
    L.push("BID: " + names.map(n => `<b>${n}</b> ${stpBidTxt(n)}`).join("; ") + ".");
    L.push("Cost портів (коротка шкала IEEE 802.1D-1998): FastEthernet = 19, GigabitEthernet = 4."); }
  if (s >= 1) { const roots = [...new Set(names.map(n => info[n] && info[n].rootName))];
    L.push(`<b>Крок 1. Root bridge.</b> Перемагає найменший BID: спершу порівнюють пріоритет, а за рівності — MAC.`);
    for (const r of roots) { const others = names.filter(n => info[n] && info[n].rootName === r && n !== r);
      L.push(`👑 <b>${r}</b> (${stpBidTxt(r)})` + (others.length ? ": " + others.map(n => { const A = stpBid(r), B = stpBid(n); return A.p !== B.p ? `пріоритет ${A.p} < ${B.p} (${n})` : `пріоритети рівні, MAC ${A.mac} < ${B.mac} (${n})`; }).join("; ") : " — ізольований сегмент, сам собі root.")); }
    if (roots.length > 1) L.push("Мережа розпалася на кілька сегментів — у кожному свій root."); }
  if (s >= 2) { L.push("<b>Крок 2. Root port</b> — на кожному не-root комутаторі один порт з найменшим сумарним cost до root. За рівності: менший BID сусіда, потім менший Port ID сусіда (priority.number).");
    for (const n of names) { const I = info[n]; if (!I || I.rootName === n || !I.rootPort) continue; const c = I.cands || [];
      const why = c.length > 1 ? (c[0].cost !== c[1].cost ? `${c[0].cost} < ${c[1].cost} через ${c[1].port}` : cmp(c[0].via, c[1].via) !== 0 ? `cost рівний (${c[0].cost}), але BID сусіда ${c[0].via} менший, ніж у ${c[1].via}` : `cost і сусід однакові — менший Port ID сусіда (${c[0].npid.pr}.${c[0].npid.num} < ${c[1].npid.pr}.${c[1].npid.num})`) : "єдиний шлях";
      L.push(`<b>${n}</b>: root port <b>${I.rootPort}</b> (cost до root ${I.cost}; ${why}).`); } }
  if (s >= 3) { L.push("<b>Крок 3. Designated port</b> — на кожному сегменті один порт, що пересилає трафік у бік від root: виграє комутатор із меншим cost до root, за рівності — менший BID. Усі порти root bridge — designated.");
    for (const e of (info._edges || [])) { const A = info[e.a], B = info[e.b]; const aD = A.roles[e.pa] && A.roles[e.pa][0] === "Desg", bD = B.roles[e.pb] && B.roles[e.pb][0] === "Desg"; const w = aD ? [e.a, e.pa, A.cost, e.b, B.cost] : bD ? [e.b, e.pb, B.cost, e.a, A.cost] : null; if (!w) continue;
      L.push(`${e.a} ${e.pa} — ${e.b} ${e.pb}: designated <b>${w[0]} ${w[1]}</b> (` + (w[2] !== w[4] ? `cost до root ${w[2]} < ${w[4]}` : `cost рівний (${w[2]}), BID ${w[0]} менший`) + ")."); } }
  if (s >= 4) { const alt = []; for (const n of names) for (const [p, r] of Object.entries((info[n] || {}).roles || {})) if (r[0] === "Altn") alt.push(n + " " + p);
    L.push(`<b>Крок 4. Решта портів — Alternate (BLK)</b>: ${alt.length ? alt.join(", ") : "немає (петель немає)"}. Вони не пересилають кадри, але слухають BPDU й готові замінити root port.`);
    L.push("<b>Збіжність.</b> 802.1D: Blocking → Listening (15 с) → Learning (15 с) → Forwarding, після обриву ще до 20 с Max Age — до 50 с. RSTP (rapid-pvst): Discarding → Learning → Forwarding, Alternate одразу стає Root, а designated-порти домовляються через proposal/agreement — зазвичай менше 1–2 с. PortFast-порти (edge) переходять у Forwarding одразу."); }
  return L.map(x => `<p class="small" style="margin:6px 0">${x}</p>`).join("");
}
function stpQuizResult() {
  const info = stpInfo(); const ends = stpEnds(); let ok = 0, n = 0; const bad = [];
  const rootOk = STPV.guess.root && info[STPV.guess.root] && info[STPV.guess.root].rootName === STPV.guess.root; n++; if (rootOk) ok++; else bad.push("Root bridge: правильно — " + Object.keys(info).find(k => k !== "_edges" && info[k].rootName === k));
  for (const e of ends) for (const [d, p, r] of [[e.a, e.pa, e.ra], [e.b, e.pb, e.rb]]) { if (e.down || !r) continue; n++; const g = STPV.guess.ports[d + "|" + p]; if (g === r) ok++; else bad.push(`${d} ${p}: ${g ? ROLE_UA[g] : "не вказано"} → правильно ${ROLE_UA[r]}`); }
  return `<p style="margin:6px 0"><b>${ok}/${n}</b> правильно${ok === n ? " 🎉" : ""}</p>` + (bad.length ? `<ul class="small" style="margin:4px 0;padding-left:18px">${bad.map(x => `<li>${esc(x)}</li>`).join("")}</ul><p class="small muted">Перемкніться в «Покроково», щоб побачити, чому саме так.</p>` : "");
}
function stpDiff() { if (!STPV.prev) return ""; const now = stpInfo(); const ch = [];
  for (const [n, I] of Object.entries(now)) { if (n === "_edges") continue; const O = STPV.prev[n] || { roles: {} };
    if (O.rootName !== I.rootName) ch.push(`${n}: новий root — ${I.rootName}`);
    for (const p of new Set([...Object.keys(O.roles || {}), ...Object.keys(I.roles)])) { const a = (O.roles || {})[p], b = I.roles[p]; if (!a || !b || a[0] !== b[0]) ch.push(`${n} ${p}: ${a ? ROLE_UA[a[0]] : "—"} → ${b ? ROLE_UA[b[0]] : "— (лінк обірвано)"}`); } }
  return ch.length ? `<div class="card"><h2>Що змінилося після ${esc(STPV.lastAction || "зміни")}</h2><ul class="small" style="margin:0;padding-left:18px">${ch.map(x => `<li>${esc(x)}</li>`).join("")}</ul><p class="small muted" style="margin:6px 0 0">З 802.1D такий перерахунок займає до 30–50 с, з RSTP — 1–2 с. Тому в мережах зазвичай вмикають spanning-tree mode rapid-pvst.</p></div>` : `<div class="card"><p class="small" style="margin:0">Після ${esc(STPV.lastAction || "зміни")} ролі портів не змінилися.</p></div>`; }
VIEWS.stpviz = { html: () => {
  if (!STPV) stpNew("tri"); const names = Object.keys(STP_PRESETS[STPV.preset].pos); const quiz = STPV.mode !== "learn"; const pred = STPV.mode === "predict";
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🌳 STP покроково</h2><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:6px 0">Розрахунок той самий, що в CLI-лабах (PVST+, VLAN 1). Натисніть на лінк, щоб обірвати або відновити його.</p>
    <div class="chips">${Object.entries(STP_PRESETS).map(([k, p]) => `<button class="seg ${STPV.preset === k ? "on" : ""}" data-act="stpnew" data-p="${k}">${p.name}</button>`).join("")}<button class="seg" data-act="stpnew" data-p="${STPV.preset}">🎲 Нові пріоритети/MAC</button></div>
    <div class="chips"><button class="seg ${!quiz ? "on" : ""}" data-act="stpmode" data-m="learn">📖 Покроково</button><button class="seg ${quiz && !pred ? "on" : ""}" data-act="stpmode" data-m="quiz">✍ Перевір себе</button><button class="seg ${pred ? "on" : ""}" data-act="stpmode" data-m="predict">🔮 Передбач зміну</button></div>
    ${stpSVG()}
    <p class="small muted" style="margin:4px 0">Позначки: <b style="color:var(--ok)">R</b> — root port, <b style="color:var(--accent)">D</b> — designated, <b style="color:var(--bad)">A</b> — alternate (BLK); пунктир — заблокований або обірваний лінк.</p>
    ${quiz ? `${pred ? `<div class="rb-step small" style="margin:6px 0"><b>До зміни:</b> ${esc(STPV.before)}<br><b>Зміна:</b> ${esc(STPV.change)}<br>${STPV.checked ? "" : "Яким стане дерево? Позначте новий root і ролі всіх портів."}</div>` : ""}<p class="small" style="margin:6px 0">${STPV.checked ? "" : "Натисніть на комутатор, який стане root bridge, а потім на кожен кружечок біля порту, щоб обрати роль (R → D → A)."}</p>${STPV.checked ? stpQuizResult() : ""}
      <div class="row">${STPV.checked ? `<button class="primary" data-act="stpnew" data-p="${STPV.preset}">Нова задача</button>` : `<button class="primary" data-act="stpcheck">Перевірити</button>`}</div>`
    : `<div class="row"><button data-act="stpstep" data-d="-1" ${STPV.step <= 0 ? "disabled" : ""}>← Назад</button><span class="grow small muted" style="text-align:center">крок ${STPV.step} з 4</span><button class="primary" data-act="stpstep" data-d="1" ${STPV.step >= 4 ? "disabled" : ""}>Далі →</button></div>${stpExplain()}`}
  </div>
  ${STPV.prev ? stpDiff() : ""}
  <div class="card"><h2>Пріоритети (spanning-tree vlan 1 priority)</h2>${names.map(n => `<div class="kv"><span>${n} <span class="muted small">${stpBidTxt(n)}</span></span><span class="row"><button class="mini" data-act="stpprio" data-n="${n}" data-d="-4096">−4096</button><button class="mini" data-act="stpprio" data-n="${n}" data-d="4096">+4096</button></span></div>`).join("")}</div>
  <button class="ghost" data-act="home">На головну</button>`; } };
const stpSnap = () => JSON.parse(JSON.stringify(stpInfo(), (k, v) => k === "_edges" || k === "cands" ? undefined : v));
ACTS.stpviz = () => { view = "stpviz"; render(); scrollTop(); };
ACTS.stpnew = el => { if (STPV && STPV.mode === "predict") stpPredict(el.dataset.p); else stpNew(el.dataset.p); render(); };
ACTS.stpmode = el => { STPV.mode = el.dataset.m; STPV.checked = false; STPV.guess = { root: null, ports: {} }; STPV.prev = null; if (STPV.mode === "predict") stpPredict(STPV.preset); render(); };
ACTS.stpstep = el => { STPV.step = Math.max(0, Math.min(4, STPV.step + Number(el.dataset.d))); render(); };
ACTS.stproot = el => { STPV.guess.root = el.dataset.n; render(); };
ACTS.stpport = el => { const k = el.dataset.key; const cyc = [undefined, "Root", "Desg", "Altn"]; const i = cyc.indexOf(STPV.guess.ports[k]); STPV.guess.ports[k] = cyc[(i + 1) % cyc.length]; render(); };
ACTS.stpcheck = () => { STPV.checked = true; render(); };
ACTS.stpcut = el => { const [a, pa, b, pb] = STP_PRESETS[STPV.preset].links[Number(el.dataset.k)]; STPV.prev = stpSnap(); const i = STPV.N.dev[a].ifs[pa]; i.shutdown = !i.shutdown;
  STPV.lastAction = (i.shutdown ? "обриву " : "відновлення ") + a + " " + pa + " — " + b + " " + pb; STPV.N.recompute(); STPV.checked = false; if (STPV.mode === "learn") STPV.step = 4; render(); };
ACTS.stpprio = el => { const s = STPV.N.dev[el.dataset.n]; const cur = s.stpPrio[1] !== undefined ? s.stpPrio[1] : 32768; const nv = Math.max(0, Math.min(61440, cur + Number(el.dataset.d)));
  STPV.prev = stpSnap(); s.stpPrio[1] = nv; STPV.lastAction = "зміни пріоритету " + el.dataset.n + " на " + nv; STPV.checked = false; if (STPV.mode === "learn") STPV.step = 4; render(); };

// ---- «Передбач зміну»: обрив лінку, новий пріоритет або cost — спершу прогноз, потім перевірка ----
function stpSummary() { const I = stpInfo(); const names = Object.keys(STP_PRESETS[STPV.preset].pos); const root = names.find(n => I[n] && I[n].rootName === n);
  const alt = names.flatMap(n => Object.entries((I[n] || {}).roles || {}).filter(([, r]) => r[0] === "Altn").map(([p]) => n + " " + p)); const rps = names.filter(n => I[n] && I[n].rootPort).map(n => n + " " + I[n].rootPort);
  return "root " + root + "; root ports: " + (rps.join(", ") || "—") + "; заблоковано: " + (alt.join(", ") || "нічого"); }
function stpPredict(preset) { for (let tries = 0; tries < 20; tries++) { stpNew(preset); STPV.mode = "predict"; const before = stpSummary(); const I = stpInfo(); const P = STP_PRESETS[STPV.preset]; const names = Object.keys(P.pos); const root = names.find(n => I[n] && I[n].rootName === n);
    const kind = SH_P(["cut", "cut", "prio", "cost"]); let change = "";
    if (kind === "cut") { const cand = P.links.map((l, k) => [l, k]).filter(([[a, pa, b, pb]]) => { const ra = (I[a].roles[pa] || [])[0], rb = (I[b].roles[pb] || [])[0]; return ra === "Root" || rb === "Root"; }); if (!cand.length) continue; const [[a, pa, b, pb]] = SH_P(cand); STPV.N.dev[a].ifs[pa].shutdown = true; change = `обрив лінку ${a} ${pa} — ${b} ${pb}`; }
    else if (kind === "prio") { const n = SH_P(names.filter(x => x !== root)); const s = STPV.N.dev[n]; s.stpPrio[1] = SH_P([0, 4096, 8192]); change = `spanning-tree vlan 1 priority ${s.stpPrio[1]} на ${n}`; }
    else { const n = SH_P(names.filter(x => x !== root && I[x].rootPort)); if (!n) continue; const p = I[n].rootPort; STPV.N.dev[n].ifs[p].stpCost = SH_P([50, 100]); change = `spanning-tree cost ${STPV.N.dev[n].ifs[p].stpCost} на ${n} ${p} (зараз це root port)`; }
    STPV.N.recompute(); if (stpSummary() === before) continue; STPV.before = before; STPV.change = change; STPV.checked = false; STPV.guess = { root: null, ports: {} }; return; } }
