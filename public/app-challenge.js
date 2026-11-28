"use strict";
// Челенджі: посилання з однаковим набором питань для друга (без сервера: усе в адресі), порівняння результатів за питаннями,
// і щотижневий челендж «побий свій рекорд» — той самий набір усього тижня.
const CH_LS = "ccna.ch", CH_WK = "ccna.chweek", CH_NAME = "ccna.chname";
const chRng = seed => { let h = 1779033703 ^ seed.length; for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } let a = h >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const chPool = courses => { const base = new Set(QB_BASE.map(q => q.id)); return QB.filter(q => base.has(q.id) && !q.gen && TMAP[q.t] && courses.includes(TMAP[q.t].g) && qtype(q) !== "flash").sort((a, b) => a.id < b.id ? -1 : 1); };
function chPick(seed, courses, n) { const r = chRng(seed); const pool = chPool(courses).slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } return pool.slice(0, n).map(q => q.id); }
const chId = ids => { let h = 0; for (const c of ids.join(",")) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
const chName = () => lsGet(CH_NAME, "") || "Я";
function chWeekKey() { const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return y + "-W" + String(w).padStart(2, "0"); }
function chStart(ch) { const items = ch.ids.map(id => QMAP[id]).filter(Boolean); if (items.length < ch.ids.length * 0.8) { alert("Частини питань цього челенджу немає у вашій версії тренажера — оновіть сторінку."); return; }
  startSession("exam", items, "🏁 " + ch.title); S.challenge = ch; S.deadline = Date.now() + items.length * 75 * 1000; render(); scrollTop(); }
function chDone(e) { const ch = S.challenge; const res = { name: chName(), correct: e.correct, n: e.n, dur: e.dur, bits: e.tok.join(""), ts: e.ts };
  const all = lsGet(CH_LS, {}); const prev = all[ch.id]; if (!prev || res.correct > prev.correct || (res.correct === prev.correct && res.dur < prev.dur)) all[ch.id] = Object.assign({ ch }, res); lsSet(CH_LS, all);
  if (ch.week) { const W = lsGet(CH_WK, {}); const w = W[ch.week] || { tries: 0, best: null }; w.tries++; if (!w.best || res.correct > w.best.correct || (res.correct === w.best.correct && res.dur < w.best.dur)) w.best = res; W[ch.week] = w; lsSet(CH_WK, W); }
  CHV = { mode: "done", ch, res, other: CHV && CHV.other && CHV.other.ch && CHV.other.ch.id === ch.id ? CHV.other : null }; S = null; view = "challenge"; render(); scrollTop(); }
async function chLink(kind, obj) { return location.origin + location.pathname + "#" + kind + "=" + await packSb(obj); }
async function chShare(kind, obj, msg) { const url = await chLink(kind, obj); try { if (navigator.share) { await navigator.share({ title: "CCNA челендж", text: msg, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; } try { await navigator.clipboard.writeText(msg + "\n" + url); alert("Посилання скопійовано"); } catch (e) { prompt("Скопіюйте посилання:", url); } }
async function chOpenShared() { const m = location.hash.match(/^#(ch|chr)=(.+)$/); if (!m) return; try { const d = await unpackSb(m[2]); history.replaceState(null, "", location.pathname);
    if (m[1] === "ch") { if (!d || !Array.isArray(d.ids) || !d.ids.length) throw new Error("bad"); CHV = { mode: "intro", ch: d }; }
    else { if (!d || !d.ch || !Array.isArray(d.ch.ids) || typeof d.r !== "object") throw new Error("bad"); CHV = { mode: "cmp", ch: d.ch, other: d.r }; }
    view = "challenge"; render(); scrollTop(); } catch (e) { alert("Не вдалося відкрити челендж: посилання пошкоджене."); } }
const chFmt = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
function chCmp(ch, me, other) { const qs = ch.ids.map(id => QMAP[id]); const b1 = (me && me.bits) || "", b2 = (other && other.bits) || "";
  const row = (r, lab) => r ? `<div class="kv"><span>${esc(lab)}</span><b>${r.correct}/${r.n} · ${Math.round(r.correct / r.n * 100)}% · ${chFmt(r.dur)}</b></div>` : `<div class="kv"><span>${esc(lab)}</span><span class="muted">ще не проходив</span></div>`;
  let verdict = ""; if (me && other) { verdict = me.correct > other.correct || (me.correct === other.correct && me.dur < other.dur) ? "🏆 Ви попереду!" : me.correct === other.correct && me.dur === other.dur ? "🤝 Нічия" : "💪 " + esc(other.name) + " попереду — є куди рости"; }
  return `${row(me, chName() + " (ви)")}${row(other, other ? other.name : "Суперник")}${verdict ? `<p style="margin:6px 0"><b>${verdict}</b></p>` : ""}
    ${me && other ? `<h3>За питаннями</h3><div style="overflow-x:auto"><table><tr><th>#</th><th>Тема</th><th>Ви</th><th>${esc(other.name)}</th></tr>${qs.map((q, k) => `<tr${b1[k] !== b2[k] ? ' style="background:var(--warn-soft)"' : ""}><td>${k + 1}</td><td class="small">${q ? tlabel(q.t) : "—"}</td><td>${b1[k] === "1" ? "✅" : "❌"}</td><td>${b2[k] === "1" ? "✅" : "❌"}</td></tr>`).join("")}</table></div><p class="small muted">Жовтим — питання, де результати різні: варто розібрати разом.</p>` : ""}`; }
let CHV = null;
VIEWS.challenge = { html: () => { CHV = CHV || { mode: "home" }; const my = lsGet(CH_LS, {}); const C = CHV;
  const nameBox = `<div class="row" style="margin:6px 0"><span class="small">Ваше ім'я в челенджах:</span><input id="chname" value="${esc(lsGet(CH_NAME, ""))}" placeholder="Ім'я" style="width:140px"><button class="mini" data-act="chname">OK</button></div>`;
  if (C.mode === "intro") { const mine = my[C.ch.id]; return `<div class="card"><h2>🏁 ${esc(C.ch.title)}</h2><p class="small" style="margin:6px 0">${esc(C.ch.by || "Друг")} запрошує вас пройти ${C.ch.ids.length} питань. Відповіді не показуються до кінця, ≈ 75 с на питання.</p>${nameBox}
      ${mine ? `<p class="small">Ви вже проходили: ${mine.correct}/${mine.n} за ${chFmt(mine.dur)}.</p>` : ""}<div class="row"><button class="primary" data-act="chgo">${mine ? "Пройти ще раз" : "Почати"}</button><button data-act="chhome">До челенджів</button></div></div>`; }
  if (C.mode === "done" || C.mode === "cmp") { const me = my[C.ch.id] || null; const shown = C.mode === "done" ? C.res : me;
    return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🏁 ${esc(C.ch.title)}</h2><button class="mini ghost" data-act="chhome">✕</button></div>${C.mode === "done" ? `<p style="margin:8px 0"><b>Ваш результат: ${C.res.correct}/${C.res.n} (${Math.round(C.res.correct / C.res.n * 100)}%) за ${chFmt(C.res.dur)}</b></p>` : ""}
      ${chCmp(C.ch, shown, C.other)}
      <div class="row" style="margin-top:8px">${shown ? `<button class="primary" data-act="chsendres">📤 Надіслати свій результат</button>` : `<button class="primary" data-act="chgo">Пройти цей челендж</button>`}<button data-act="chsendch">🔗 Запросити ще когось</button>${C.ch.week ? "" : ""}</div></div>
    <button class="ghost" data-act="chhome">До челенджів</button>`; }
  const wk = chWeekKey(); const W = lsGet(CH_WK, {}); const wkeys = Object.keys(W).sort().reverse().slice(0, 6); const cur = W[wk]; const prevK = wkeys.find(k => k < wk); const prevB = prevK && W[prevK].best;
  const st = lsGet("ccna.chset", { courses: ["SRWE"], n: 20 });
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🏁 Челенджі</h2><button class="mini ghost" data-act="home">✕</button></div>${nameBox}</div>
  <div class="card"><h2>📅 Челендж тижня ${wk}</h2><p class="small muted" style="margin:0 0 6px">15 питань SRWE, однакові весь тиждень. Проходьте скільки завгодно разів — рахується найкращий результат; у понеділок новий набір.</p>
    <div class="kv"><span>Ваш рекорд цього тижня</span><b>${cur && cur.best ? `${cur.best.correct}/15 · ${chFmt(cur.best.dur)} · спроб ${cur.tries}` : "—"}</b></div>${prevB ? `<div class="kv"><span>Минулий тиждень (${prevK})</span><span>${prevB.correct}/15 · ${chFmt(prevB.dur)}</span></div>` : ""}
    <div class="row" style="margin-top:6px"><button class="primary" data-act="chweek">▶ ${cur ? "Побити рекорд" : "Почати"}</button><button data-act="chweekshare">🔗 Кинути виклик другу</button></div>
    ${wkeys.length > 1 ? `<div class="small muted" style="margin-top:6px">${wkeys.map(k => `${k}: ${W[k].best ? W[k].best.correct + "/15" : "—"}`).join(" · ")}</div>` : ""}</div>
  <div class="card"><h2>👥 Челендж для друга</h2><p class="small muted" style="margin:0 0 6px">Посилання містить сам набір питань — сервер не потрібен. Друг проходить і надсилає вам своє посилання з результатом, а ви бачите порівняння за кожним питанням.</p>
    <div class="chips">${["ITN", "SRWE", "ENSA"].map(c => `<button class="seg ${st.courses.includes(c) ? "on" : ""}" data-act="chcourse" data-c="${c}">${c}</button>`).join("")}</div>
    <div class="row" style="margin-top:6px"><span class="small muted">Питань:</span>${[10, 20, 30].map(n => `<button class="seg ${st.n === n ? "on" : ""}" data-act="chn" data-n="${n}">${n}</button>`).join("")}</div>
    <div class="row" style="margin-top:8px"><button class="primary" data-act="chnew">Створити й пройти</button></div></div>
  ${Object.keys(my).length ? `<div class="card"><h2>Мої челенджі</h2>${Object.entries(my).sort((a, b) => b[1].ts - a[1].ts).slice(0, 10).map(([id, r]) => `<div class="kv"><span class="small">${esc(r.ch.title)}</span><span><b>${r.correct}/${r.n}</b> <button class="mini" data-act="chopen" data-id="${id}">Відкрити</button></span></div>`).join("")}</div>` : ""}
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.challenge = () => { CHV = { mode: "home" }; view = "challenge"; render(); scrollTop(); };
ACTS.chhome = () => ACTS.challenge();
ACTS.chname = () => { lsSet(CH_NAME, (($("#chname") || {}).value || "").trim().slice(0, 30)); render(); };
ACTS.chcourse = el => { const st = lsGet("ccna.chset", { courses: ["SRWE"], n: 20 }); const c = el.dataset.c; st.courses = st.courses.includes(c) ? st.courses.filter(x => x !== c) : st.courses.concat(c); if (!st.courses.length) st.courses = [c]; lsSet("ccna.chset", st); render(); };
ACTS.chn = el => { const st = lsGet("ccna.chset", { courses: ["SRWE"], n: 20 }); st.n = Number(el.dataset.n); lsSet("ccna.chset", st); render(); };
ACTS.chnew = () => { const st = lsGet("ccna.chset", { courses: ["SRWE"], n: 20 }); const ids = chPick(String(Date.now()) + Math.random(), st.courses, st.n); const ch = { v: 1, id: chId(ids), ids, title: st.courses.join("+") + " · " + ids.length + " питань", by: chName(), t: Date.now() }; CHV = { mode: "intro", ch }; chStart(ch); };
ACTS.chweek = () => { const wk = chWeekKey(); const ids = chPick("week-" + wk, ["SRWE"], 15); chStart({ v: 1, id: chId(ids), ids, title: "Челендж тижня " + wk, by: chName(), week: wk, t: Date.now() }); };
ACTS.chweekshare = () => { const wk = chWeekKey(); const ids = chPick("week-" + wk, ["SRWE"], 15); chShare("ch", { v: 1, id: chId(ids), ids, title: "Челендж тижня " + wk, by: chName(), t: Date.now() }, chName() + " кидає тобі виклик: CCNA челендж тижня " + wk); };
ACTS.chgo = () => chStart(CHV.ch);
ACTS.chopen = el => { const r = lsGet(CH_LS, {})[el.dataset.id]; if (r) { CHV = { mode: "cmp", ch: r.ch, other: null }; render(); } };
ACTS.chsendch = () => { const ch = Object.assign({}, CHV.ch); delete ch.week; chShare("ch", ch, chName() + " кидає тобі виклик: " + ch.title); };
ACTS.chsendres = () => { const me = lsGet(CH_LS, {})[CHV.ch.id]; if (!me) return; const ch = Object.assign({}, CHV.ch); delete ch.week; chShare("chr", { ch, r: { name: chName(), correct: me.correct, n: me.n, dur: me.dur, bits: me.bits } }, `${chName()}: ${me.correct}/${me.n} у челенджі «${ch.title}». Твій хід!`); };
