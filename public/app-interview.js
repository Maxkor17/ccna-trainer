// Режим технічної співбесіди: відкриті питання, відповідь голосом або текстом, самоперевірка за ключовими пунктами,
// еталонна відповідь, співбесіди-ситуації з кількох кроків і підсумок з порадами. Пропущене — в інтервальне повторення.
let IV = null;
const IV_LS = "ccna.iv", IV_HIST = "ccna.iv.hist";
const ivSet = () => lsGet(IV_LS, { cats: ["net", "lnx", "sec", "soft"], lvl: 0, n: 8, en: false });
const ivRec = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const FILLERS = /(?<!\p{L})(ну|типу|короче|як би|е+|ем+|ммм+|um+|uh+|erm|you know|basically|kind of)(?!\p{L})/giu;
function ivDue() { const now = Date.now(); return INTERVIEW.Q.filter(x => { const r = prog["iv:" + x.id]; return r && r.d <= now; }); }
function ivAuto(points, text) { return points.map(p => { try { return new RegExp(p.k, "i").test(text || ""); } catch (e) { return false; } }); }
function ivStart(kind, arg) { const st = ivSet(); let items;
  if (kind === "sc") { const s = INTERVIEW.SC.find(x => x.id === arg); items = s.steps.map((x, i) => ({ kind: "step", id: s.id + "#" + i, cat: s.cat, title: s.title, ua: x.say, en: x.say, points: x.points.map(([t, k]) => ({ t, k })), reveal: x.reveal, last: i === s.steps.length - 1 })); }
  else if (kind === "due") items = shuffle(ivDue()).slice(0, st.n);
  else { const pool = INTERVIEW.Q.filter(x => st.cats.includes(x.cat) && (!st.lvl || x.lvl === st.lvl)); const fresh = pool.filter(x => !prog["iv:" + x.id]); items = shuffle(fresh).concat(shuffle(pool.filter(x => prog["iv:" + x.id]))).slice(0, st.n); }
  if (!items.length) { alert("Немає питань для вибраних розділів"); return; }
  IV = { kind, items, i: 0, phase: "ask", t0: Date.now(), ans: "", checks: [], res: [], en: !!st.en, rec: null }; view = "interview"; render(); scrollTop(); }
function ivStopRec() { if (IV && IV.rec) { try { IV.rec.stop(); } catch (e) {} IV.rec = null; } }
function ivDictate() { const R = ivRec(); if (!R || !IV) return; if (IV.rec) { ivStopRec(); render(); return; }
  const r = new R(); r.lang = IV.en ? "en-US" : "uk-UA"; r.continuous = true; r.interimResults = true; let base = ($("#ivans") || {}).value || IV.ans || "";
  r.onresult = ev => { let fin = "", tmp = ""; for (let k = ev.resultIndex; k < ev.results.length; k++) { const t = ev.results[k][0].transcript; if (ev.results[k].isFinal) fin += t + " "; else tmp += t; } if (fin) base = (base + " " + fin).replace(/\s+/g, " ").trim(); const ta = $("#ivans"); if (ta) ta.value = (base + " " + tmp).trim(); IV.ans = base; };
  r.onerror = ev => { const m = $("#ivmsg"); if (m) m.textContent = "Розпізнавання: " + (ev.error === "not-allowed" ? "немає доступу до мікрофона" : ev.error); };
  r.onend = () => { if (IV && IV.rec === r) { IV.rec = null; const b = $("#ivmic"); if (b) b.textContent = "🎙 Диктувати"; } };
  try { r.start(); IV.rec = r; const b = $("#ivmic"); if (b) b.textContent = "⏹ Зупинити"; } catch (e) { alert("Не вдалося увімкнути мікрофон: " + e.message); } }
function ivDone() { ivStopRec(); const ta = $("#ivans"); IV.ans = ta ? ta.value : IV.ans; IV.dur = Math.round((Date.now() - IV.t0) / 1000); const it = IV.items[IV.i]; IV.checks = ivAuto(it.points, IV.ans); IV.phase = "rate"; render(); }
function ivNext() { const it = IV.items[IV.i]; const cov = it.points.length ? IV.checks.filter(Boolean).length / it.points.length : 0; const words = (IV.ans.match(/\S+/g) || []).length; const fill = (IV.ans.match(FILLERS) || []).length;
  IV.res.push({ id: it.id, cat: it.cat, q: IV.en ? it.en : it.ua, cov, dur: IV.dur, words, fill, missed: it.points.filter((p, k) => !IV.checks[k]).map(p => p.t), kind: it.kind || "q" });
  if (it.kind !== "step") record("iv:" + it.id, cov >= 0.7);
  if (IV.i >= IV.items.length - 1) { IV.phase = "done"; const h = lsGet(IV_HIST, []); h.unshift({ ts: Date.now(), kind: IV.kind, n: IV.res.length, cov: IV.res.reduce((a, r) => a + r.cov, 0) / IV.res.length, dur: Math.round(IV.res.reduce((a, r) => a + r.dur, 0) / IV.res.length) }); lsSet(IV_HIST, h.slice(0, 30)); }
  else { IV.i++; IV.phase = "ask"; IV.ans = ""; IV.checks = []; IV.t0 = Date.now(); }
  render(); scrollTop(); }
const ivFmt = s => s >= 60 ? Math.floor(s / 60) + " хв " + (s % 60) + " с" : s + " с";
function ivSetup() { const st = ivSet(); const due = ivDue().length; const h = lsGet(IV_HIST, []); const R = !!ivRec();
  return `<div class="card"><h2>🎤 Технічна співбесіда</h2><p class="small muted" style="margin:0 0 8px">Відповідайте вголос або текстом, як на справжній співбесіді, потім звірте відповідь із ключовими пунктами, які очікує інтерв'юер, і з еталоном на 30–60 секунд. Тренажер сам позначає пункти, які знайде у вашій відповіді за ключовими словами, — виправте позначки чесно. Невраховані питання повернуться в повторення.</p>
   <div class="small muted">Розділи</div><div class="chips">${Object.entries(INTERVIEW.CATS).map(([k, l]) => `<button class="seg ${st.cats.includes(k) ? "on" : ""}" data-act="ivcat" data-c="${k}">${l} <span class="muted">${INTERVIEW.Q.filter(x => x.cat === k).length}</span></button>`).join("")}</div>
   <div class="row" style="margin-top:8px"><span class="small muted">Рівень:</span>${[[0, "Усі"], [1, "Junior"], [2, "Middle"], [3, "Каверзні"]].map(([v, l]) => `<button class="seg ${st.lvl === v ? "on" : ""}" data-act="ivopt" data-k="lvl" data-v="${v}">${l}</button>`).join("")}</div>
   <div class="row" style="margin-top:6px"><span class="small muted">Питань:</span>${[5, 8, 12].map(v => `<button class="seg ${st.n === v ? "on" : ""}" data-act="ivopt" data-k="n" data-v="${v}">${v}</button>`).join("")}<span class="small muted" style="margin-left:8px">Мова:</span>${[[false, "Українська"], [true, "English"]].map(([v, l]) => `<button class="seg ${!!st.en === v ? "on" : ""}" data-act="ivopt" data-k="en" data-v="${v}">${l}</button>`).join("")}</div>
   <div class="row" style="margin-top:10px"><button class="primary" data-act="ivgo">▶ Почати співбесіду</button><button data-act="ivdue" ${due ? "" : "disabled"}>🔁 Повторити слабкі (${due})</button></div>
   <p class="small muted" style="margin:8px 0 0">${R ? "🎙 Диктування доступне: браузер перетворить мовлення на текст (потрібен дозвіл на мікрофон)." : "Розпізнавання мовлення в цьому браузері недоступне — відповідайте текстом або вголос самі собі з таймером. Найкраще диктування працює в Chrome і Edge."}</p></div>
  <div class="card"><h2>🧩 Співбесіди-ситуації</h2><p class="small muted" style="margin:0 0 8px">Інтерв'юер описує проблему, ви кажете, що робитимете, — і отримуєте нову інформацію (виводи команд, журнали), як на живій співбесіді.</p>
   ${INTERVIEW.SC.map(s => `<div class="row" style="margin:4px 0"><span class="grow">${INTERVIEW.CATS[s.cat].split(" ")[0]} ${esc(s.title)} <span class="small muted">· ${s.steps.length} кроки</span></span><button class="mini" data-act="ivsc" data-id="${s.id}">Почати</button></div>`).join("")}</div>
  ${h.length ? `<div class="card"><h2>Історія</h2><table><tr><th>Коли</th><th class="num">Питань</th><th class="num">Покриття</th><th class="num">Сер. час</th></tr>${h.slice(0, 8).map(x => `<tr><td>${new Date(x.ts).toLocaleDateString("uk-UA")}</td><td class="num">${x.n}</td><td class="num">${Math.round(x.cov * 100)}%</td><td class="num">${ivFmt(x.dur)}</td></tr>`).join("")}</table></div>` : ""}
  <button class="ghost" data-act="home">На головну</button>`; }
VIEWS.interview = { html: () => { if (!IV) return ivSetup(); const it = IV.items[IV.i]; const qtext = IV.en ? it.en : it.ua; const head = `<div class="qmeta"><span>${INTERVIEW.CATS[it.cat]}${it.lvl ? " · " + INTERVIEW.LVL[it.lvl] : ""}${it.kind === "step" ? " · " + esc(it.title) : ""}</span><span>${IV.phase === "done" ? "" : (IV.i + 1) + "/" + IV.items.length}</span></div>`;
  if (IV.phase === "done") return ivSummary();
  if (IV.phase === "ask") return `<div class="card">${head}<p style="font-size:1.1em;margin:8px 0">${esc(qtext)}</p>
     <div class="row"><button class="mini" data-act="ivsay">🔊 Прочитати</button><span class="small muted" id="ivtimer">⏱ 0:00</span><span class="small muted" id="ivmsg"></span></div>
     <textarea id="ivans" rows="7" placeholder="${IV.en ? "Your answer…" : "Ваша відповідь… (або продиктуйте)"}" style="width:100%;margin-top:8px">${esc(IV.ans)}</textarea>
     <div class="row" style="margin-top:8px">${ivRec() ? `<button id="ivmic" data-act="ivmic">${IV.rec ? "⏹ Зупинити" : "🎙 Диктувати"}</button>` : ""}<button class="primary" data-act="ivdone">Готово — показати ключові пункти</button></div>
     <p class="small muted" style="margin:6px 0 0">Орієнтир: 45–90 секунд, структура «що це → як працює → приклад із практики».</p></div><button class="ghost" data-act="ivquit">✕ Завершити</button>`;
  const words = (IV.ans.match(/\S+/g) || []).length, fill = (IV.ans.match(FILLERS) || []).length; const cov = IV.checks.filter(Boolean).length;
  return `<div class="card">${head}<p style="margin:6px 0"><b>${esc(qtext)}</b></p>
     <div class="kv"><span>Час відповіді</span><span>${ivFmt(IV.dur)}${IV.dur < 20 ? " — закоротко" : IV.dur > 150 ? " — задовго" : ""}</span></div><div class="kv"><span>Слів</span><span>${words}${fill ? ` · слів-паразитів: ${fill}` : ""}</span></div>
     <h3>Ключові пункти <span class="small muted">${cov}/${it.points.length}</span></h3>
     <ul class="checklist">${it.points.map((p, k) => `<li><label><input type="checkbox" data-act="ivchk" data-k="${k}" ${IV.checks[k] ? "checked" : ""}> ${esc(p.t)}</label></li>`).join("")}</ul>
     ${it.kind === "step" ? `<h3>Що відповідає інтерв'юер</h3><pre style="white-space:pre-wrap">${esc(it.reveal)}</pre>` : `<details open><summary><b>Еталонна відповідь</b></summary><p class="small" style="margin:6px 0">${esc(it.model)}</p></details>`}
     ${IV.ans ? `<details><summary class="small muted">Ваша відповідь</summary><p class="small">${esc(IV.ans)}</p></details>` : ""}
     <div class="row" style="margin-top:8px"><button class="primary" data-act="ivnext">${IV.i >= IV.items.length - 1 ? "Підсумок" : "Далі →"}</button></div></div>`; } };
function ivSummary() { const R = IV.res; const avg = R.reduce((a, r) => a + r.cov, 0) / R.length, dur = Math.round(R.reduce((a, r) => a + r.dur, 0) / R.length), fill = R.reduce((a, r) => a + r.fill, 0);
  const byCat = {}; for (const r of R) (byCat[r.cat] = byCat[r.cat] || []).push(r.cov);
  const tips = []; if (dur < 30) tips.push("Відповіді короткі: розкривайте «як працює» і додавайте приклад із власної практики."); if (dur > 120) tips.push("Відповіді задовгі: тримайтеся 60–90 секунд, деталі інтерв'юер спитає сам.");
  if (fill > R.length) tips.push("Багато слів-паразитів — краще коротка пауза, ніж «ну, типу»."); if (avg < 0.6) tips.push("Покриття нижче 60%: повторіть ключові пункти слабких питань — вони вже в черзі повторення.");
  if (!tips.length) tips.push("Гарна співбесіда! Спробуйте рівень «Каверзні» або англійську.");
  return `<div class="card"><h2>📋 Підсумок співбесіди</h2><div class="kv"><span>Покриття ключових пунктів</span><b style="color:${avg >= 0.75 ? "var(--ok)" : avg >= 0.55 ? "var(--warn)" : "var(--bad)"}">${Math.round(avg * 100)}%</b></div><div class="kv"><span>Середній час відповіді</span><span>${ivFmt(dur)}</span></div>
    <table><tr><th>Розділ</th><th class="num">Покриття</th></tr>${Object.entries(byCat).map(([c, a]) => `<tr><td>${INTERVIEW.CATS[c]}</td><td class="num">${Math.round(a.reduce((x, y) => x + y, 0) / a.length * 100)}%</td></tr>`).join("")}</table>
    <h3>Поради</h3><ul>${tips.map(t => `<li class="small">${esc(t)}</li>`).join("")}</ul>
    <h3>Що не прозвучало</h3>${R.filter(r => r.missed.length).map(r => `<details><summary class="small">${esc(r.q.slice(0, 90))} <span class="muted">· ${Math.round(r.cov * 100)}%</span></summary><ul>${r.missed.map(m => `<li class="small">${esc(m)}</li>`).join("")}</ul></details>`).join("") || `<p class="small muted">Усі ключові пункти згадано ✅</p>`}
    <div class="row" style="margin-top:10px"><button class="primary" data-act="ivagain">Ще одна співбесіда</button><button data-act="ivquit">До налаштувань</button></div></div>`; }
ACTS.interview = () => { IV = null; view = "interview"; render(); scrollTop(); };
ACTS.ivcat = el => { const st = ivSet(); const c = el.dataset.c; st.cats = st.cats.includes(c) ? st.cats.filter(x => x !== c) : st.cats.concat(c); if (!st.cats.length) st.cats = [c]; lsSet(IV_LS, st); render(); };
ACTS.ivopt = el => { const st = ivSet(); let v = el.dataset.v; v = v === "true" ? true : v === "false" ? false : Number(v); st[el.dataset.k] = v; lsSet(IV_LS, st); render(); };
ACTS.ivgo = () => ivStart("q"); ACTS.ivdue = () => ivStart("due"); ACTS.ivsc = el => ivStart("sc", el.dataset.id);
ACTS.ivmic = () => ivDictate(); ACTS.ivdone = () => ivDone(); ACTS.ivnext = () => ivNext();
ACTS.ivchk = el => { IV.checks[Number(el.dataset.k)] = el.checked; render(); };
ACTS.ivsay = () => { const it = IV.items[IV.i]; try { const u = new SpeechSynthesisUtterance(IV.en ? it.en : it.ua); u.lang = IV.en ? "en-US" : "uk-UA"; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} };
ACTS.ivquit = () => { ivStopRec(); IV = null; render(); scrollTop(); };
ACTS.ivagain = () => { const k = IV.kind === "sc" ? "q" : IV.kind; ivStart(k); };
setInterval(() => { const el = $("#ivtimer"); if (el && IV && IV.phase === "ask") { const s = Math.floor((Date.now() - IV.t0) / 1000); el.textContent = "⏱ " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); } if (IV && view !== "interview") { ivStopRec(); } }, 1000);
document.addEventListener("input", ev => { if (ev.target && ev.target.id === "ivans" && IV) IV.ans = ev.target.value; });
