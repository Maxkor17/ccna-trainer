// Фінішний тиждень: план на останні дні перед іспитом (симуляції через день, слабкі домени, повторення, легкий останній день)
// і чек-лист готовності з конкретними цифрами. Позначки днів — у flags "fw:<дата>" з on:false (синхронізуються між пристроями).
const FW_PASS = 825;
const fwScore = e => Math.round(300 + 700 * e.correct / e.n);
const fwDay = (iso, k) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - k); return dkey(d); };
function fwExamsOn(day) { return exams.filter(e => e.ccna && dkey(new Date(e.ts)) === day); }
function fwPlan() {
  if (!opts.examDate) return null; const ver = bpVer(); const f = passForecast(ver); const today = dkey();
  const days = Math.round((new Date(opts.examDate + "T12:00:00") - new Date(today + "T12:00:00")) / 864e5); if (days < 0) return { days, items: [], ver, f };
  const span = Math.min(10, days); const gaps = f.gaps.length ? f.gaps : f.cov.flatMap(d => d.items.map(x => Object.assign({ dom: d.id }, x))).filter(x => x.n).sort((a, b) => (a.ready || 0) - (b.ready || 0)).slice(0, 5);
  const weakD = (f.weak.length ? f.weak : f.cov.slice().sort((a, b) => a.ready - b.ready)).slice(0, 2); let gi = 0; const items = [];
  for (let k = span; k >= 0; k--) { const date = fwDay(opts.examDate, k); const t = [];
    if (k === 0) { t.push(["exam", "День іспиту", "Легкий сніданок, без нових тем. Чек-лист нижче."]); }
    else if (k === 1) { t.push(["light", "Легке повторення", "Не більше 30–40 хвилин: шпаргалки й 20 питань з повторення. Жодних нових тем і повних симуляцій."], ["review", "Повторення (до 20)", ""], ["cheat", "Шпаргалки", ""], ["logist", "Логістика", "Документ з фото, час і адреса центру Pearson VUE (або перевірка кімнати й комп'ютера для OnVUE), ранній сон."]); }
    else if (k % 2 === 0) { const en = k === 4 || (k === 2 && !exams.some(e => e.ccna && e.en)); t.push(["mock", en ? "Повна симуляція англійською" : "Повна симуляція", "120 питань / 120 хвилин без пауз, як на іспиті. Потім 30 хв розбору помилок.", en]); if (k > 2) t.push(["review", "Повторення помилок", ""]); }
    else { const g = gaps[gi++ % Math.max(1, gaps.length)]; if (g) t.push(["gap", "Слабка тема " + g.id, g.name, g.id]); const d = weakD[(gi - 1) % Math.max(1, weakD.length)]; if (d) t.push(["dom", "Домен " + d.id + ". " + d.ua, "Коротка симуляція 40 питань і тренування тем домену.", d.id]); t.push(["ts", "Лаба «знайди несправність»", ver === "v2.0" ? "Діагностика — головний акцент v2.0." : "Пошук несправностей перевіряють і в питаннях-симуляціях."], ["review", "Повторення", ""]); }
    const auto = t.some(x => x[0] === "mock") ? fwExamsOn(date).some(e => e.n >= 100) : false; const fl = flags["fw:" + date];
    items.push({ k, date, tasks: t, done: !!(fl && fl.done) || auto, auto, past: date < today, today: date === today }); }
  return { days, items, ver, f };
}
function fwCheck() {
  const ver = bpVer(); const f = passForecast(ver); const sims = exams.filter(e => e.ccna && (e.bp || "v1.1") === ver && e.n >= 40).slice(0, 3);
  const avg = sims.length ? Math.round(sims.reduce((a, e) => a + fwScore(e), 0) / sims.length) : null; const full = exams.filter(e => e.ccna && e.n >= 100);
  const lowD = f.cov.filter(d => d.ready < 0.7); const rq = reviewQueue().length; const last = full[0]; const spq = last ? Math.round(last.dur / last.n) : null; const enDone = exams.some(e => e.ccna && e.en);
  return [
    { ok: sims.length >= 3 && avg >= FW_PASS, t: "Три останні симуляції " + ver + " ≥ " + FW_PASS, v: sims.length ? `середнє ${avg} (${sims.map(fwScore).join(", ")})${sims.length < 3 ? ` · пройдено ${sims.length}/3` : ""}` : "ще немає симуляцій цієї версії" },
    { ok: !lowD.length, t: "Усі домени ≥ 70%", v: lowD.length ? lowD.map(d => `${d.id}. ${d.ua} — ${Math.round(d.ready * 100)}%`).join("; ") : f.cov.map(d => `${d.id}: ${Math.round(d.ready * 100)}%`).join(" · ") },
    { ok: rq <= 30, t: "Черга повторення ≤ 30", v: `зараз ${rq}` },
    { ok: !!full.length, t: "Хоча б одна повна симуляція (120 питань)", v: full.length ? `пройдено ${full.length}, остання ${fwScore(full[0])}` : "ще не було" },
    { ok: spq != null && spq <= 60, t: "Темп ≤ 60 с на питання в повній симуляції", v: spq == null ? "немає даних" : `${spq} с у останній` },
    { ok: enDone, t: "Симуляція англійською", v: enDone ? "є" : "іспит лише англійською — пройдіть хоча б коротку" }];
}
function fwCard() { const p = fwPlan(); if (!p || p.days < 0 || p.days > 14) return ""; const ch = fwCheck(); const ok = ch.filter(x => x.ok).length;
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🏁 Фінішний тиждень</h2><span class="small muted">${p.days ? "до іспиту " + p.days + " дн." : "іспит сьогодні"}</span></div>
    <p class="small" style="margin:6px 0">Готовність за чек-листом: <b>${ok}/${ch.length}</b>. ${(p.items.find(x => x.today) || {}).tasks ? "Сьогодні: " + esc(p.items.find(x => x.today).tasks.map(t => t[1]).join(", ")) : ""}</p><button class="primary" data-act="final">Відкрити план і чек-лист</button></div>`; }
function fwTaskBtn(t, date) { const [k, , , a] = t;
  if (k === "mock") return `<button class="mini" data-act="ccna" data-n="120"${a ? ` data-en="1"` : ""} style="white-space:nowrap">▶ 120</button>`;
  if (k === "review") return `<button class="mini" data-act="review">▶</button>`; if (k === "cheat") return `<button class="mini" data-act="cheat">▶</button>`;
  if (k === "gap") return `<button class="mini" data-act="bptrain" data-item="${bpVer()}|${a}">▶</button>`; if (k === "dom") return `<button class="mini" data-act="fwdom" data-d="${a}" style="white-space:nowrap">▶ 40</button>`;
  if (k === "ts") return `<button class="mini" data-act="tsstart" data-n="1">▶</button>`; return ""; }
VIEWS.final = { html: () => { const p = fwPlan(); const ch = fwCheck(); const ok = ch.filter(x => x.ok).length;
  if (!p) return `<div class="card"><h2>🏁 Фінішний тиждень</h2><p class="small muted">Вкажіть дату іспиту — план на останні 10 днів складеться автоматично.</p><input type="date" id="examdate" style="width:auto"></div>
    <div class="card"><h2>✅ Чек-лист готовності</h2>${fwCheckHtml(ch)}</div><button class="ghost" data-act="home">На головну</button>`;
  const startIn = p.items.length && p.items[0].date > dkey() ? Math.round((new Date(p.items[0].date) - new Date(dkey())) / 864e5) : 0;
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🏁 Фінішний тиждень</h2><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small" style="margin:6px 0">Іспит ${esc(new Date(opts.examDate).toLocaleDateString("uk-UA"))} (${esc(BLUEPRINTS[p.ver].name)})${p.days >= 0 ? " · через " + p.days + " дн." : " — дата минула."} ${startIn ? `План стартує через ${startIn} дн.; до того — звичайний «План до екзамену».` : ""}</p>
    <p class="small muted" style="margin:0">Прогноз: ${p.f.score} / 1000 · ${esc(p.f.verdict)}. Повні симуляції — через день, між ними — найслабші теми й лаби діагностики, останній день — легкий.</p></div>
  <div class="card"><h2>✅ Чек-лист готовності <span class="small muted">${ok}/${ch.length}</span></h2>${fwCheckHtml(ch)}
    <p class="small muted" style="margin:6px 0 0">Cisco не публікує прохідний бал і може його змінювати; ${FW_PASS} — поширений орієнтир. ${ok === ch.length ? "Усі пункти виконано — ви готові 💪" : ok >= ch.length - 1 ? "Майже все готово." : "Якщо до іспиту більше тижня і пунктів бракує багато, перенесення дати теж нормальне рішення — умови й терміни перенесення дивіться у своєму записі Pearson VUE."}</p></div>
  ${p.items.map(d => `<div class="card" style="${d.today ? "border-color:var(--accent)" : d.past && !d.done ? "opacity:.7" : ""}"><div class="row"><h2 class="grow" style="margin:0">${d.k === 0 ? "🎯 " : ""}${esc(new Date(d.date + "T12:00:00").toLocaleDateString("uk-UA", { weekday: "short", day: "numeric", month: "short" }))} <span class="small muted">${d.k ? "за " + d.k + " дн." : "іспит"}${d.today ? " · сьогодні" : ""}</span></h2>
      ${d.k ? `<label class="small"><input type="checkbox" data-act="fwdone" data-d="${d.date}" ${d.done ? "checked" : ""} ${d.auto ? "disabled" : ""}> ${d.auto ? "виконано (симуляцію пройдено)" : "виконано"}</label>` : ""}</div>
      ${d.tasks.map(t => `<div class="kv" style="align-items:flex-start"><span><b>${esc(t[1])}</b>${t[2] ? `<br><span class="small muted">${esc(t[2])}</span>` : ""}</span>${fwTaskBtn(t, d.date)}</div>`).join("")}
      ${d.k === 0 ? `<ul class="checklist small"><li>☐ Документи, що посвідчують особу, — за вимогами з підтвердження запису Pearson VUE; ім'я має збігатися з профілем Cisco</li><li>☐ Прибути за 15–30 хв; для OnVUE — тест системи заздалегідь, чистий стіл, кімната без сторонніх</li><li>☐ На іспиті не можна повертатися до попередніх питань — не застрягайте: орієнтир ≈ 1 хв на питання</li><li>☐ Лаби й drag-and-drop — уважно читайте, що саме просять</li><li>☐ Після іспиту запишіть домени, де було важко, — знадобиться для перескладання або наступного рівня</li></ul>` : ""}</div>`).join("")}
  <button class="ghost" data-act="home">На головну</button>`; } };
function fwCheckHtml(ch) { return `<ul class="checklist">${ch.map(x => `<li>${x.ok ? "✅" : "❌"} <b>${esc(x.t)}</b><br><span class="small muted">${esc(x.v)}</span></li>`).join("")}</ul>`; }
ACTS.final = () => { view = "final"; render(); scrollTop(); };
ACTS.fwdone = el => { const k = "fw:" + el.dataset.d; const rec = { on: false, done: el.checked, ts: Date.now() }; flags[k] = rec; patch({ flags: { [k]: rec } }); render(); };
ACTS.fwdom = el => { const ver = bpVer(); const dom = (SIM_DOMAINS[ver] || [])[Number(el.dataset.d) - 1]; if (!dom) return; const set = new Set(dom[2]); startSession("train", pickTraining(set, 40), "Домен " + el.dataset.d + ": " + dom[0]); render(); scrollTop(); };
