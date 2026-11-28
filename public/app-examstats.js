"use strict";
// Аналіз пасток і часу: де помилки через неуважне читання, а де через незнання; які типи питань «з'їдають» час у симуляціях.
const XT_NAME = { mc: "Вибір відповіді", simlet: "Симлет", sim: "Практичне (CLI)", order: "Порядок", match: "Зіставлення", cmd: "Введіть команду", fill: "Пропуски", cat: "Перетягни в категорію", calc: "Розрахунок (генератор)", flash: "Картка" };
function xtStats() {
  const rows = Object.entries(prog).filter(([id]) => QMAP[id]); const acc = a => { const c = a.reduce((x, [, r]) => x + (r.c || 0), 0), w = a.reduce((x, [, r]) => x + (r.w || 0), 0); return { n: c + w, p: c + w ? c / (c + w) : null }; };
  const trap = rows.filter(([id]) => hasTrap(QMAP[id])), plain = rows.filter(([id]) => !hasTrap(QMAP[id]));
  const whys = { nk: 0, ina: 0, mix: 0, calc: 0 }; for (const [, r] of Object.entries(prog)) for (const [k, n] of Object.entries(r.whys || {})) if (k in whys) whys[k] += n || 0;
  const T = {}; const slow = []; let sims = 0;
  for (const e of exams) { if (!e.tq || !e.ids) continue; sims++; e.tq.forEach((sec, k) => { const id = e.ids[k]; const q = id && QMAP[id]; const ty = q ? qtype(q) : "calc"; const x = T[ty] = T[ty] || { n: 0, s: 0, ok: 0 }; x.n++; x.s += sec || 0; x.ok += e.tok ? e.tok[k] : 0; if (q && sec) slow.push([sec, q, e.tok ? e.tok[k] : null]); }); }
  slow.sort((a, b) => b[0] - a[0]); return { trap: acc(trap), plain: acc(plain), whys, T, slow: slow.slice(0, 6), sims };
}
VIEWS.traps = { html: () => { const X = xtStats(); const pc = x => x.p == null ? "—" : Math.round(x.p * 100) + "%"; const wsum = Object.values(X.whys).reduce((a, b) => a + b, 0);
  const types = Object.entries(X.T).map(([k, v]) => [k, v, v.s / v.n]).sort((a, b) => b[2] - a[2]); const all = types.reduce((a, [, v]) => a + v.s, 0);
  const advice = []; if (X.trap.p != null && X.plain.p != null && X.trap.n >= 10 && X.trap.p < X.plain.p - 0.08) advice.push(`На питаннях з пастками у формулюванні точність нижча на ${Math.round((X.plain.p - X.trap.p) * 100)} п.п. Перед вибором перечитуйте питання: NOT/НЕ, кількість відповідей, BEST.`);
  if (wsum >= 5 && X.whys.ina / wsum >= 0.25) advice.push(`${Math.round(X.whys.ina / wsum * 100)}% помилок ви самі позначили як «неуважно прочитав» — це найдешевші бали: читайте варіанти до кінця.`);
  const slowT = types.find(([, , a]) => a > 90); if (slowT) advice.push(`«${XT_NAME[slowT[0]] || slowT[0]}» забирає в середньому ${Math.round(slowT[2])} с — тренуйте цей тип окремо, на іспиті ≈ 60 с на питання.`);
  if (!advice.length) advice.push(X.sims ? "Явних проблем з часом і пастками не видно." : "Пройдіть симуляцію CCNA або екзамен — з'явиться аналіз часу.");
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🪤 Пастки й час</h2><button class="mini ghost" data-act="home">✕</button></div>
    <div class="row" style="margin-top:8px"><button class="seg ${opts.traps !== false ? "on" : ""}" data-act="traptoggle">🖍 Підсвічувати пастки в тренуванні</button><button class="seg ${opts.blind ? "on" : ""}" data-act="blindtoggle">🙈 Перша спроба без варіантів</button></div>
    <p class="small muted" style="margin:6px 0 0">Підсвітка: NOT/НЕ, EXCEPT, BEST, «оберіть два» тощо. На екзамені й у симуляціях її немає, як і на справжньому іспиті.</p></div>
  <div class="card"><h2>Поради</h2><ul class="small">${advice.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div>
  <div class="card"><h2>Точність</h2><div class="kv"><span>Питання з пастками у формулюванні</span><b>${pc(X.trap)} <span class="small muted">(${X.trap.n})</span></b></div><div class="kv"><span>Без пасток</span><b>${pc(X.plain)} <span class="small muted">(${X.plain.n})</span></b></div>
    ${wsum ? `<h3>Причини помилок (ваші позначки)</h3>${Object.entries(WHY).map(([k, [i, n]]) => `<div class="kv"><span>${i} ${n}</span><span>${X.whys[k]} · ${Math.round(X.whys[k] / wsum * 100)}%</span></div>`).join("")}` : `<p class="small muted">Позначайте причину помилки після неправильної відповіді — тут з'явиться розподіл.</p>`}</div>
  <div class="card"><h2>Час за типами питань <span class="small muted">${X.sims} екзаменів/симуляцій</span></h2>${types.length ? `<table><tr><th>Тип</th><th class="num">Питань</th><th class="num">Сер. час</th><th class="num">Точність</th><th class="num">Частка часу</th></tr>${types.map(([k, v, a]) => `<tr><td>${esc(XT_NAME[k] || k)}</td><td class="num">${v.n}</td><td class="num" style="color:${a > 90 ? "var(--bad)" : a > 60 ? "var(--warn)" : "inherit"}">${Math.round(a)} с</td><td class="num">${Math.round(v.ok / v.n * 100)}%</td><td class="num">${all ? Math.round(v.s / all * 100) : 0}%</td></tr>`).join("")}</table>` : `<p class="small muted">Немає даних про час — він записується в екзаменах і симуляціях.</p>`}
    ${X.slow.length ? `<h3>Найдовші питання</h3>${X.slow.map(([s, q, ok]) => `<div class="kv" style="align-items:flex-start"><span class="small">${ok ? "✅" : ok === 0 ? "❌" : ""} ${esc(q.q.slice(0, 110))}${q.q.length > 110 ? "…" : ""}</span><b>${s} с</b></div>`).join("")}` : ""}</div>
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.traps = () => { view = "traps"; render(); scrollTop(); };
