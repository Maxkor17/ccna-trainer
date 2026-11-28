"use strict";
// «5 хвилин»: одна кнопка — коротка суміш з черги повторення і 3 практичних вправ під слабкі місця. Панель кроку показується над будь-яким екраном вправи.
let MICRO = null;
const MICRO_KINDS = { show: ["📟 Вивід show", "showread"], bug: ["🐞 Знайди помилку", "bugs"], cb: ["🧩 Збери команду", "cbuild"], log: ["📜 Журнал", "logs"], pcap: ["🦈 Захоплення", "pcap"] };
function microAcc(pfx) { const a = Object.entries(prog).filter(([k]) => k.startsWith(pfx)); if (!a.length) return 0.5; return a.reduce((x, [, r]) => x + (r.c || 0), 0) / Math.max(1, a.reduce((x, [, r]) => x + (r.c || 0) + (r.w || 0), 0)); }
function microSteps() { const pref = { show: "sh-", bug: "bg-", cb: "cb-", log: "lg-", pcap: "pc-" }; const kinds = Object.keys(MICRO_KINDS).filter(k => typeof ACTS[MICRO_KINDS[k][1]] === "function").map(k => [k, microAcc(pref[k]) + Math.random() * 0.25]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(x => x[0]);
  return [{ k: "rev" }].concat(kinds.map(k => ({ k }))); }
function microGo() { const st = MICRO.steps[MICRO.i]; if (!st) { view = "micro"; render(); scrollTop(); return; }
  if (st.k === "rev") { let items = reviewQueue().slice(0, 3); if (items.length < 3) { const weak = TOPICS.filter(t => t.g !== "LNX").map(t => [t.id, topicReady(t.id)]).filter(([, r]) => r && r.seen).sort((a, b) => a[1].p - b[1].p).slice(0, 3).map(x => x[0]); items = items.concat(pickTraining(new Set(weak.length ? weak : TOPICS.filter(t => t.g === "SRWE").map(t => t.id)), 3 - items.length)); }
    startSession("train", items.slice(0, 3), "⚡ 5 хвилин"); S.micro = true; render(); scrollTop(); return; }
  ACTS[MICRO_KINDS[st.k][1]](); }
function microBar() { const st = MICRO.steps[MICRO.i]; const name = st.k === "rev" ? "🔁 3 питання з повторення" : MICRO_KINDS[st.k][0];
  return `<div class="card micro-bar"><div class="row"><span class="grow small"><b>⚡ 5 хвилин</b> · крок ${MICRO.i + 1}/${MICRO.steps.length}: ${name}</span><button class="mini" data-act="micronext">${MICRO.i >= MICRO.steps.length - 1 ? "Завершити ✓" : "Далі →"}</button><button class="mini ghost" data-act="microquit">✕</button></div><div class="progress"><i style="width:${Math.round(MICRO.i / MICRO.steps.length * 100)}%"></i></div></div>`; }
(function () { const base = render; render = function () { base(); if (!MICRO || view === "micro" || view === "home") return; const st = MICRO.steps[MICRO.i]; const want = st && (st.k === "rev" ? ["quiz", "summary", "result"] : [MICRO_KINDS[st.k][1]]); if (want && want.includes(view)) { const a = $("#app"); if (a) a.insertAdjacentHTML("afterbegin", microBar()); } }; })();
VIEWS.micro = { html: () => { const m = MICRO; const sec = m ? Math.round((Date.now() - m.t0) / 1000) : 0; const html = `<div class="card"><h2>⚡ 5 хвилин — готово</h2><p style="margin:6px 0">Чотири короткі вправи за ${Math.floor(sec / 60)} хв ${sec % 60} с. Так можна займатися в дорозі чи на перерві — головне регулярно.</p>
    <div class="row"><button class="primary" data-act="micro">Ще 5 хвилин</button><button data-act="home">На головну</button></div></div>`; MICRO = null; return html; } };
let microPatched = false; function microPatch() { if (microPatched || typeof showSummary !== "function") return; microPatched = true; const bs = showSummary; showSummary = function () { bs(); if (MICRO && S && S.micro) { const a = $("#app"); if (a) a.insertAdjacentHTML("afterbegin", microBar()); } }; }
ACTS.micro = () => { microPatch(); MICRO = { steps: microSteps(), i: 0, t0: Date.now() }; microGo(); };
ACTS.micronext = () => { if (!MICRO) return; if (S && S.micro) S = null; MICRO.i++; microGo(); };
ACTS.microquit = () => { MICRO = null; if (S && S.micro) S = null; view = "home"; render(); };
