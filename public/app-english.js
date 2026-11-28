"use strict";
// Англійська для іспиту: колода термінів UA↔EN з інтервальним повторенням і читання англійських питань на швидкість.
const EN_RD = "ccna.enread";
let ENV = { mode: "terms" };
const enKey = g => "en:" + g[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function enTermNew() { const G = window.GLOSSARY || []; const now = Date.now(); const due = G.filter(g => { const r = prog[enKey(g)]; return r && r.d <= now; }); const fresh = G.filter(g => !prog[enKey(g)]);
  const g = SH_P(due.length ? due : fresh.length ? fresh : G); const dir = Math.random() < 0.5 ? "ua" : "en"; const same = G.filter(x => x !== g && x[2] === g[2]); const pool = shuffle(same.length >= 3 ? same : G.filter(x => x !== g)).slice(0, 3);
  const opts = shuffle([g].concat(pool)); ENV = Object.assign(ENV, { g, dir, o: opts, a: opts.indexOf(g), pick: null, n: ENV.n || 0, ok: ENV.ok || 0, due: due.length, fresh: fresh.length }); }
async function enReadNew() { if (typeof loadTR === "function") { try { await loadTR(); } catch (e) {} } const TRm = window.QB_TR || {}; const base = QB_BASE.filter(q => !q.gen && TRm[q.id] && TRm[q.id].q && q.q.length > 40 && q.q.length < 400);
  const q = SH_P(base); const others = shuffle(base.filter(x => x.t === q.t && x.id !== q.id)).slice(0, 3); const pad = others.length < 3 ? shuffle(base.filter(x => x.id !== q.id && !others.includes(x))).slice(0, 3 - others.length) : []; const opts = shuffle([q].concat(others, pad));
  ENV = Object.assign(ENV, { q, en: TRm[q.id].q, o: opts, a: opts.indexOf(q), t0: Date.now(), read: null, pick: null }); view = "english"; render(); }
const enWords = t => (String(t).match(/\S+/g) || []).length;
VIEWS.english = { html: () => { const M = ENV.mode; const H = lsGet(EN_RD, []); const avg = H.length ? Math.round(H.slice(0, 20).reduce((a, x) => a + x.wpm, 0) / Math.min(20, H.length)) : null;
  const tabs = `<div class="chips" style="margin-top:6px"><button class="seg ${M === "terms" ? "on" : ""}" data-act="enmode" data-m="terms">🔤 Терміни (${(window.GLOSSARY || []).length})</button><button class="seg ${M === "read" ? "on" : ""}" data-act="enmode" data-m="read">📖 Читання на швидкість</button></div>`;
  let body = "";
  if (M === "terms") { if (!ENV.g) enTermNew(); const { g, dir, o, a, pick } = ENV; const done = pick != null;
    body = `<p class="small muted" style="margin:0 0 6px">Нових: ${ENV.fresh} · на повторення: ${ENV.due} · ${tlabel(g[2])}</p><div class="qtext" style="font-size:1.25em">${esc(dir === "ua" ? g[0] : g[1])}</div><p class="small muted">${dir === "ua" ? "Як це англійською?" : "Як це українською?"}</p>
      ${o.map((x, i) => { let c = "opt"; if (done) { if (i === a) c += " ok"; else if (i === pick) c += " bad"; } return `<button class="${c}" data-act="enpick" data-i="${i}" ${done ? "disabled" : ""}><span class="mk">${letters[i]}.</span>${esc(dir === "ua" ? x[1] : x[0])}</button>`; }).join("")}
      ${done ? `<div class="verdict ${pick === a ? "ok" : "bad"}">${pick === a ? "Правильно!" : "Неправильно"}</div><p class="small">${esc(g[0])} — <b>${esc(g[1])}</b></p><div class="navbar"><button class="primary" data-act="ennext">Далі →</button></div>` : ""}`; }
  else { if (!ENV.q) { enReadNew(); return `<div class="card">${tabs}<p class="small muted">Завантажую англійські тексти…</p></div>`; } const done = ENV.pick != null;
    body = `<p class="small muted" style="margin:0 0 6px">Прочитайте питання англійською й натисніть «Прочитав» — потім оберіть, про що воно. Середня швидкість: ${avg ? avg + " слів/хв" : "—"} (на іспиті ≈ 1 хв на питання разом з відповіддю).</p>
      ${ENV.read == null || done ? `<div class="qtext" lang="en" style="font-size:1.08em">${esc(ENV.en)}</div>` : `<p class="small muted" style="margin:0 0 6px">Текст сховано — відповідайте з пам'яті, як після одного прочитання на іспиті.</p>`}
      ${ENV.read == null ? `<div class="navbar"><button class="primary" data-act="enread">✓ Прочитав (${enWords(ENV.en)} слів)</button></div>`
        : `<p class="small muted">Читання: ${ENV.read} с · ${Math.round(enWords(ENV.en) / Math.max(1, ENV.read) * 60)} слів/хв. Про що питання?</p>${ENV.o.map((x, i) => { let c = "opt"; if (done) { if (i === ENV.a) c += " ok"; else if (i === ENV.pick) c += " bad"; } return `<button class="${c}" data-act="enrpick" data-i="${i}" ${done ? "disabled" : ""}><span class="mk">${letters[i]}.</span>${esc(x.q.length > 170 ? x.q.slice(0, 167) + "…" : x.q)}</button>`; }).join("")}
        ${done ? `<div class="verdict ${ENV.pick === ENV.a ? "ok" : "bad"}">${ENV.pick === ENV.a ? "Зрозуміли правильно!" : "Зміст зрозуміли не так"}</div><div class="navbar"><button class="primary" data-act="enrnext">Наступне →</button></div>` : ""}`}`;
    if (H.length) body += `<h3>Останні спроби</h3><div class="small muted">${H.slice(0, 10).map(x => `${x.wpm} сл/хв ${x.ok ? "✅" : "❌"}`).join(" · ")}</div>`; }
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🇬🇧 Англійська для іспиту</h2><button class="mini ghost" data-act="home">✕</button></div>${tabs}</div><div class="card">${body}</div><button class="ghost" data-act="home">На головну</button>`; } };
ACTS.english = () => { ENV = { mode: "terms" }; view = "english"; render(); scrollTop(); };
ACTS.enmode = el => { ENV.mode = el.dataset.m; ENV.q = null; ENV.g = null; render(); };
ACTS.enpick = el => { if (ENV.pick != null) return; ENV.pick = Number(el.dataset.i); const ok = ENV.pick === ENV.a; ENV.n++; if (ok) ENV.ok++; record(enKey(ENV.g), ok); render(); };
ACTS.ennext = () => { ENV.g = null; render(); };
ACTS.enread = () => { ENV.read = Math.max(1, Math.round((Date.now() - ENV.t0) / 1000)); render(); };
ACTS.enrpick = el => { if (ENV.pick != null) return; ENV.pick = Number(el.dataset.i); const ok = ENV.pick === ENV.a; const H = lsGet(EN_RD, []); H.unshift({ ts: Date.now(), wpm: Math.round(enWords(ENV.en) / ENV.read * 60), ok }); lsSet(EN_RD, H.slice(0, 100)); record("enr-" + ENV.q.id, ok); render(); };
ACTS.enrnext = () => { ENV.q = null; enReadNew(); };
