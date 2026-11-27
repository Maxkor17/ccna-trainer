"use strict";
// Фокус і дисципліна: Pomodoro, тижневий огляд, віхи до іспиту.
// Тижневі огляди ("wk:<тиждень>") і віхи ("ms:<id>") зберігаються у flags з on:false — синхронізуються між пристроями.

// ---- 12. Pomodoro ----
const POMO_KEY = "ccna.pomo.v1";
let POMO = lsGet(POMO_KEY, null);
const pomoSave = () => lsSet(POMO_KEY, POMO);
const pomoLeft = () => !POMO ? 0 : POMO.paused != null ? POMO.paused : Math.max(0, POMO.end - Date.now());
const mmss = ms => { const s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
function pomoFocusing() { return !!(POMO && POMO.phase === "focus" && POMO.paused == null); }
function pomoStart(focus, brk, kind) { POMO = { phase: "focus", dur: focus, brk, kind, end: Date.now() + focus * 60000, started: Date.now(), paused: null }; pomoSave(); pomoDraw(); try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {} }
function pomoLog(min) { if (min < 1) return; const dk = dkey(); const log = ((daily[dk] || {}).log || []).concat([{ ts: Date.now(), min, k: POMO.kind || "app", note: "🍅 фокус-сесія" }]); setDay(dk, { log }); }
function pomoAlert(text) { try { document.title = "⏰ " + text; setTimeout(() => document.title = "CCNA тренажер", 8000); } catch (e) {}
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
  try { const A = window.AudioContext || window.webkitAudioContext; if (A) { const c = new A(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.15, c.currentTime); o.start(); o.stop(c.currentTime + 0.6); } } catch (e) {}
  try { if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") new Notification("CCNA тренажер", { body: text, icon: "icon-192.png" }); } catch (e) {} }
function pomoTick() { if (!POMO) return; if (POMO.paused == null && Date.now() >= POMO.end) {
    if (POMO.phase === "focus") { pomoLog(POMO.dur); POMO.done = (POMO.done || 0) + 1; POMO.phase = "break"; POMO.end = Date.now() + POMO.brk * 60000; pomoAlert("Фокус " + POMO.dur + " хв завершено — перерва " + POMO.brk + " хв"); }
    else { pomoAlert("Перерва скінчилася — наступна фокус-сесія?"); POMO = Object.assign(POMO, { phase: "idle", paused: null }); }
    pomoSave(); if (view === "home") render(); }
  pomoDraw(); }
function pomoDraw() { let el = document.getElementById("pomo"); if (!POMO || POMO.phase === "idle") { if (POMO && POMO.phase === "idle") { if (!el) { el = document.createElement("div"); el.id = "pomo"; document.body.appendChild(el); }
      el.className = "pomo idle"; el.innerHTML = `🍅 ${POMO.done || 0} · <button class="mini" data-act="pomoagain">Ще ${POMO.dur} хв</button><button class="mini ghost" data-act="pomoclose">✕</button>`; return; } if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "pomo"; document.body.appendChild(el); }
  const f = POMO.phase === "focus"; el.className = "pomo " + (f ? "focus" : "brk");
  el.innerHTML = `<span>${f ? "🍅 Фокус" : "☕ Перерва"}</span><b>${mmss(pomoLeft())}</b><button class="mini" data-act="pomopause">${POMO.paused != null ? "▶" : "⏸"}</button><button class="mini ghost" data-act="pomostop" title="Зупинити">■</button>`; }
setInterval(pomoTick, 1000); setTimeout(pomoDraw, 50);
function pomoCard() { if (POMO && POMO.phase !== "idle") return "";
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🍅 Фокус-сесія</h2><span class="small muted">${POMO && POMO.done ? "сьогодні: " + POMO.done : ""}</span></div>
    <p class="small muted" style="margin:6px 0">Таймер працює навіть поза тренажером: працюйте в Packet Tracer чи NetAcad, а час сам запишеться в журнал.</p>
    <div class="row"><select id="pomokind" style="width:auto"><option value="app">🧩 Тренажер</option>${Object.entries(KINDS).map(([k, [i, n]]) => `<option value="${k}">${i} ${n}</option>`).join("")}</select>
      <button class="primary" data-act="pomostart" data-f="25" data-b="5">25 / 5</button><button data-act="pomostart" data-f="50" data-b="10">50 / 10</button><button class="ghost" data-act="fullscreen" title="Повний екран">⛶</button></div></div>`; }
ACTS.pomostart = el => { pomoStart(Number(el.dataset.f), Number(el.dataset.b), ($("#pomokind") || {}).value || "app"); if (view === "home") render(); };
ACTS.pomoagain = () => { pomoStart(POMO.dur, POMO.brk, POMO.kind); };
ACTS.pomoclose = () => { POMO = null; pomoSave(); pomoDraw(); if (view === "home") render(); };
ACTS.pomopause = () => { if (!POMO) return; if (POMO.paused != null) { POMO.end = Date.now() + POMO.paused; POMO.paused = null; } else POMO.paused = Math.max(0, POMO.end - Date.now()); pomoSave(); pomoDraw(); };
ACTS.pomostop = () => { if (!POMO) return; if (POMO.phase === "focus") { const done = Math.round((POMO.dur * 60000 - pomoLeft()) / 60000); pomoLog(done); } POMO = null; pomoSave(); pomoDraw(); if (view === "home") render(); };
ACTS.fullscreen = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} };
if (typeof KINDS !== "undefined" && !KINDS.app) KINDS.app = ["🧩", "Тренажер (фокус)"];

// ---- 13. Тижневий огляд ----
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return y + "-W" + String(w).padStart(2, "0"); }
function weekDays(wk) { const [y, w] = wk.split("-W").map(Number); const j4 = new Date(y, 0, 4); const mon = new Date(j4); mon.setDate(j4.getDate() - ((j4.getDay() + 6) % 7) + (w - 1) * 7); return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return dkey(d); }); }
function reviewWeek() { const d = new Date(); const dow = d.getDay(); if (dow === 1) d.setDate(d.getDate() - 1); return isoWeek(d); } // у понеділок — огляд минулого тижня
function weekStats(wk) { const days = weekDays(wk); let n = 0, c = 0, m = 0, ck = 0, active = 0; const kinds = {};
  for (const k of days) { const x = daily[k] || {}; n += x.n || 0; c += x.c || 0; const mm = dayMin(x); m += mm; if (x.jts) ck++; if (dayActive(x)) active++; if (x.m) kinds.app = (kinds.app || 0) + x.m; for (const e of x.log || []) kinds[e.k] = (kinds[e.k] || 0) + (e.min || 0); }
  const t0 = new Date(days[0]).getTime(), t1 = t0 + 7 * 864e5; const labsDone = Object.values(labs).filter(v => v.done && v.done >= t0 && v.done < t1).length; const ex = exams.filter(e => e.ts >= t0 && e.ts < t1);
  return { days, n, c, m, ck, active, kinds, labsDone, ex }; }
function weekMd(wk) { const st = weekStats(wk), r = flags["wk:" + wk] || {}; const acc = st.n ? Math.round(st.c / st.n * 100) + "%" : "—";
  const L = ["---", "tags: [ccna, weekly-review]", "week: " + wk, "---", "# CCNA — тижневий огляд " + wk, "", "## Підсумок", "", "| Показник | Значення |", "|---|---|", "| Активних днів | " + st.active + "/7 |", "| Відповідей | " + st.n + " (точність " + acc + ") |", "| Час навчання | " + fmtMin(st.m) + " |", "| Чек-інів | " + st.ck + " |", "| Лаб виконано | " + st.labsDone + " |", "| Екзаменів/симуляцій | " + st.ex.length + (st.ex.length ? " (найкращий " + Math.max(...st.ex.map(e => e.pct)) + "%)" : "") + " |", ""];
  if (r.win || r.block || r.focus) L.push("## Рефлексія", "", "**Що вдалося:** " + (r.win || "—"), "", "**Що заважало:** " + (r.block || "—"), "", "**Фокус наступного тижня:** " + (r.focus || "—"), "");
  L.push("## Дні", ""); for (const k of st.days) { const x = daily[k]; if (!x || !(dayActive(x) || x.note || x.plan)) continue; L.push("### " + fmtDay(k), ""); if (x.n) L.push("- Відповідей: " + x.n); if (dayMin(x)) L.push("- Час: " + fmtMin(dayMin(x))); for (const e of x.log || []) L.push("- " + ((KINDS[e.k] || ["📖", e.k])[1]) + " — " + fmtMin(e.min) + (e.note ? " · " + e.note : "")); if (x.note) L.push("- Вивчив: " + x.note.replace(/\n/g, " ")); if (x.plan) L.push("- План: " + x.plan.replace(/\n/g, " ")); L.push(""); }
  return L.join("\n"); }
function weekCard() { const wk = reviewWeek(); const dow = new Date().getDay(); const r = flags["wk:" + wk]; if (r && r.saved) return ""; if (dow !== 0 && dow !== 1) return "";
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🗓 Тижневий огляд ${wk}</h2><button class="primary mini" data-act="weekview" data-w="${wk}">Відкрити</button></div><p class="small muted" style="margin:6px 0 0">5 хвилин підсумків тижня й план на наступний — найкращий захист від «я ж нібито вчився».</p></div>`; }
VIEWS.week = { html: () => { const wk = window._wk || reviewWeek(); const st = weekStats(wk); const r = flags["wk:" + wk] || {}; const acc = st.n ? Math.round(st.c / st.n * 100) + "%" : "—"; const prev = weekStats(isoWeek(new Date(new Date(st.days[0]).getTime() - 3 * 864e5)));
  const weak = TOPICS.map(t => ({ t, r: topicReady(t.id) })).filter(x => x.r && x.r.seen >= 3 && x.t.g !== "LNX").sort((a, b) => a.r.p - b.r.p).slice(0, 3);
  const ta = (id, label, v) => `<label class="small muted" for="${id}">${label}</label><textarea id="${id}" class="jt" maxlength="1500">${esc(v || "")}</textarea>`;
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🗓 Тиждень ${wk}</h2><button class="mini" data-act="weekshift" data-d="-7">←</button><button class="mini" data-act="weekshift" data-d="7">→</button><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:4px 0 8px">${fmtDay(st.days[0])} — ${fmtDay(st.days[6])}</p>
    <table><tr><th></th><th class="num">Цей</th><th class="num">Минулий</th></tr><tr><td>Активних днів</td><td class="num">${st.active}/7</td><td class="num">${prev.active}/7</td></tr><tr><td>Відповідей</td><td class="num">${st.n}</td><td class="num">${prev.n}</td></tr><tr><td>Точність</td><td class="num">${acc}</td><td class="num">${prev.n ? Math.round(prev.c / prev.n * 100) + "%" : "—"}</td></tr><tr><td>Час</td><td class="num">${fmtMin(st.m)}</td><td class="num">${fmtMin(prev.m)}</td></tr><tr><td>Чек-інів</td><td class="num">${st.ck}</td><td class="num">${prev.ck}</td></tr><tr><td>Лаб виконано</td><td class="num">${st.labsDone}</td><td class="num">${prev.labsDone}</td></tr></table>
    ${weak.length ? `<p class="small" style="margin:8px 0 0">Найслабші теми зараз: ${weak.map(x => `${tlabel(x.t.id)} ${esc(x.t.name)} (${Math.round(x.r.p * 100)}%)`).join("; ")}</p>` : ""}</div>
  <div class="card"><h2>Рефлексія</h2>${ta("wkwin", "Що вдалося цього тижня", r.win)}${ta("wkblock", "Що заважало (і що з цим зроблю)", r.block)}${ta("wkfocus", "Фокус наступного тижня: 1–3 конкретні цілі", r.focus)}
    <div class="row"><span class="small muted grow">${r.saved ? "збережено " + fmtDate(r.ts) : ""}</span><button data-act="weekmd" data-w="${wk}">📒 Нотатка для Obsidian</button><button class="primary" data-act="weeksave" data-w="${wk}">Зберегти</button></div></div>
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.weekview = el => { window._wk = el.dataset.w || reviewWeek(); view = "week"; render(); scrollTop(); };
ACTS.weekshift = el => { const d = new Date(weekDays(window._wk || reviewWeek())[0]); d.setDate(d.getDate() + Number(el.dataset.d)); window._wk = isoWeek(d); render(); };
ACTS.weeksave = el => { const wk = el.dataset.w; const v = id => (($("#" + id) || {}).value || "").trim(); const rec = { on: false, saved: true, ts: Date.now(), win: v("wkwin"), block: v("wkblock"), focus: v("wkfocus") }; flags["wk:" + wk] = rec; patch({ flags: { ["wk:" + wk]: rec } }); render(); };
ACTS.weekmd = el => saveDownload("CCNA " + el.dataset.w + ".md", weekMd(el.dataset.w), "text/markdown");

// ---- 14. Віхи до іспиту ----
const MS_METRICS = { "course:ITN": "Готовність ITN, %", "course:SRWE": "Готовність SRWE, %", "course:ENSA": "Готовність ENSA, %", sims: "Симуляцій CCNA ≥ 825", hours: "Годин навчання загалом", labs: "CLI-лаб виконано", manual: "Вручну (позначка)" };
function msList() { return Object.entries(flags).filter(([k, f]) => k.startsWith("ms:") && f.name && !f.del).map(([k, f]) => Object.assign({ key: k }, f)).sort((a, b) => a.due.localeCompare(b.due)); }
function msValue(m) { if (m.metric.startsWith("course:")) return Math.round(courseReady(m.metric.slice(7)).p * 100);
  if (m.metric === "sims") return exams.filter(e => e.ccna && e.n >= 40 && 300 + 700 * e.correct / e.n >= 825).length;
  if (m.metric === "hours") return Math.floor(Object.values(daily).reduce((a, x) => a + dayMin(x), 0) / 60);
  if (m.metric === "labs") return ALLSCEN().filter(s => labs[s.id] && labs[s.id].ok).length; return m.done ? 1 : 0; }
function msState(m) { const v = msValue(m), tgt = m.metric === "manual" ? 1 : m.target; const prog = Math.min(1, v / Math.max(1, tgt)); const now = Date.now(), t0 = m.created || m.ts, t1 = new Date(m.due + "T23:59").getTime();
  const exp = Math.min(1, Math.max(0, (now - t0) / Math.max(1, t1 - t0))); const st = prog >= 1 ? "done" : now > t1 ? "late" : prog + 0.05 >= exp ? "ok" : "behind";
  return { v, tgt, prog, exp, st, days: Math.ceil((t1 - now) / 864e5) }; }
const MS_ST = { done: ["✅", "досягнуто", "--ok"], ok: ["🟢", "у графіку", "--ok"], behind: ["🟠", "відстаєте", "--warn"], late: ["🔴", "прострочено", "--bad"] };
function msRow(m, edit) { const s = msState(m); const [i, t, c] = MS_ST[s.st];
  return `<div class="kv" style="align-items:flex-start"><span><b>${esc(m.name)}</b><br><span class="small muted">${esc(MS_METRICS[m.metric] || "")}: ${m.metric === "manual" ? (s.v ? "так" : "ні") : s.v + " / " + s.tgt} · до ${esc(new Date(m.due).toLocaleDateString("uk-UA"))}${s.st !== "done" && s.days >= 0 ? " (" + s.days + " дн.)" : ""}</span>
    <div class="bar wide" style="margin:4px 0 0"><i style="width:${Math.round(s.prog * 100)}%;background:var(${c})"></i></div></span>
    <span class="row" style="flex-wrap:nowrap"><span class="small" style="color:var(${c});white-space:nowrap">${i} ${t}</span>${edit ? (m.metric === "manual" ? `<button class="mini" data-act="msdone" data-k="${m.key}">${m.done ? "↺" : "✓"}</button>` : "") + `<button class="mini ghost" data-act="msdel" data-k="${m.key}">✕</button>` : ""}</span></div>`; }
function milesCard() { const L = msList(); if (!L.length) return opts.examDate ? `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🎯 Віхи до іспиту</h2><button class="mini" data-act="msview">Налаштувати</button></div><p class="small muted" style="margin:6px 0 0">Розбийте шлях до ${esc(new Date(opts.examDate).toLocaleDateString("uk-UA"))} на проміжні цілі — тренажер покаже, чи встигаєте.</p></div>` : "";
  const open = L.filter(m => msState(m).st !== "done").slice(0, 3);
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🎯 Віхи</h2><span class="small muted">${L.length - open.length >= 0 ? L.filter(m => msState(m).st === "done").length + "/" + L.length : ""}</span><button class="mini" data-act="msview">усі</button></div>${(open.length ? open : L.slice(-1)).map(m => msRow(m, false)).join("")}</div>`; }
VIEWS.miles = { html: () => { const L = msList(); const today = dkey();
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🎯 Віхи до іспиту</h2><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:6px 0">Кожна віха — показник, ціль і дата. «У графіку» означає, що прогрес не менший за частку часу, що минула з моменту створення віхи.</p>
    ${L.length ? L.map(m => msRow(m, true)).join("") : `<p class="small muted">Віх ще немає.</p>`}
    ${opts.examDate ? `<button class="mini" data-act="mssuggest" style="margin-top:8px">✨ Запропонувати віхи від дати іспиту (${esc(new Date(opts.examDate).toLocaleDateString("uk-UA"))})</button>` : `<p class="small muted">Вкажіть дату іспиту в «🗓 План до екзамену», щоб отримати готовий набір віх.</p>`}</div>
  <div class="card"><h2>Нова віха</h2><input type="text" id="msname" maxlength="80" placeholder="Назва, напр. «SRWE закрито»"><div class="row" style="margin-top:6px"><select id="msmetric" style="width:auto">${Object.entries(MS_METRICS).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("")}</select>
    <input type="number" id="mstarget" min="1" max="1000" value="75" style="width:80px"><input type="date" id="msdue" min="${today}" style="width:auto"></div>
    <div class="row" style="margin-top:6px"><span class="small grow" id="msmsg" style="color:var(--bad)"></span><button class="primary" data-act="msadd">Додати</button></div></div>
  <button class="ghost" data-act="home">На головну</button>`; } };
function msPut(m) { const key = m.key || ("ms:" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)); const rec = Object.assign({ on: false, ts: Date.now(), created: Date.now() }, m); delete rec.key; flags[key] = rec; patch({ flags: { [key]: rec } }); }
ACTS.msview = () => { view = "miles"; render(); scrollTop(); };
ACTS.msadd = () => { const v = id => ($("#" + id) || {}).value || ""; const name = v("msname").trim(), metric = v("msmetric"), target = Number(v("mstarget")), due = v("msdue"); const msg = $("#msmsg");
  if (!name || !due || (metric !== "manual" && !(target > 0))) { if (msg) msg.textContent = "Вкажіть назву, ціль і дату"; return; } msPut({ name, metric, target: metric === "manual" ? 1 : target, due }); render(); };
ACTS.msdel = el => { const rec = Object.assign({}, flags[el.dataset.k], { del: true, ts: Date.now() }); flags[el.dataset.k] = rec; patch({ flags: { [el.dataset.k]: rec } }); render(); };
ACTS.msdone = el => { const rec = Object.assign({}, flags[el.dataset.k], { done: !flags[el.dataset.k].done, ts: Date.now() }); flags[el.dataset.k] = rec; patch({ flags: { [el.dataset.k]: rec } }); render(); };
ACTS.mssuggest = () => { const ex = new Date(opts.examDate); const before = d => { const x = new Date(ex); x.setDate(x.getDate() - d); const k = dkey(x); return k < dkey() ? dkey() : k; }; const have = new Set(msList().map(m => m.metric));
  const S2 = [["SRWE на 75%", "course:SRWE", 75, before(56)], ["ENSA на 75%", "course:ENSA", 75, before(21)], ["60 годин навчання", "hours", 60, before(10)], ["25 CLI-лаб", "labs", 25, before(14)], ["3 симуляції ≥ 825", "sims", 3, before(3)], ["Зареєструватися на іспит (Pearson VUE)", "manual", 1, before(30)]];
  for (const [name, metric, target, due] of S2) if (!have.has(metric)) msPut({ name, metric, target, due }); render(); };
