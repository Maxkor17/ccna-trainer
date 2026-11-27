"use strict";
// Ефективність навчання: причина помилки, «Сесія дня», власні пояснення, звіти про помилки в питаннях.
// Власні пояснення зберігаються у flags під ключем "my:<id>" (on:false — не вважаються «сумнівними»),
// тож синхронізуються тим самим механізмом, що й позначки, без змін схеми бази.

// ---- 8. Причина помилки ----
const WHY = { nk: ["🤷", "Не знав"], ina: ["😵", "Неуважно прочитав"], mix: ["🔀", "Переплутав з іншим"], calc: ["🧮", "Помилка в розрахунку"] };
function whyChips(q, k) { const cur = S.why && S.why[k];
  return `<div class="whybox"><div class="small muted" style="margin:6px 0 4px">Чому помилка? Один клік — і тренажер підкаже, що лікувати.</div><div class="chips">${Object.entries(WHY).map(([key, [i, n]]) => `<button class="seg ${cur === key ? "on" : ""}" data-act="why" data-w="${key}">${i} ${n}</button>`).join("")}</div></div>`; }
ACTS.why = el => { const k = S.i, q = S.items[k], id = recId(q), r = prog[id]; if (!r) return; S.why = S.why || {}; const key = el.dataset.w, prev = S.why[k]; if (prev === key) return;
  const whys = Object.assign({}, r.whys); if (prev) whys[prev] = Math.max(0, (whys[prev] || 1) - 1); whys[key] = (whys[key] || 0) + 1;
  const r2 = Object.assign({}, r, { why: key, whys }); prog[id] = r2; S.why[k] = key; patch({ q: { [id]: r2 } }); render(); };
function whyStats() { const tot = { nk: 0, ina: 0, mix: 0, calc: 0 }, byT = {}; const items = { nk: [], ina: [], mix: [], calc: [] };
  for (const [id, r] of Object.entries(prog)) { if (!r.whys) continue; const t = topicOfId(id); for (const [k, n] of Object.entries(r.whys)) { if (!n || !(k in tot)) continue; tot[k] += n; if (t) { byT[t] = byT[t] || { nk: 0, ina: 0, mix: 0, calc: 0 }; byT[t][k] += n; } items[k].push(id); } }
  return { tot, byT, items, n: Object.values(tot).reduce((a, b) => a + b, 0) }; }
function whyCard() { const w = whyStats(); if (!w.n) return `<div class="card"><h2>Чому я помиляюсь</h2><p class="small muted" style="margin:0">Після хибної відповіді в тренуванні оберіть причину (не знав, неуважно, переплутав, розрахунок), і тут з'явиться аналіз.</p></div>`;
  const top = Object.entries(w.tot).sort((a, b) => b[1] - a[1]); const main = top[0][0];
  const advice = { nk: "Головне — прогалини в знаннях: читайте шпаргалку теми перед тренуванням і робіть «Тест модуля» для найслабших тем.", ina: "Головне — неуважність: читайте питання двічі, шукайте «Оберіть два», заперечення (НЕ, неправильне) і конкретні номери VLAN/портів.", mix: "Головне — плутанина схожих понять: відкрийте «🧠 Що я плутаю» і пройдіть порівняльні таблиці.", calc: "Головне — розрахунки: щодня 5 хвилин «⚡ Швидкісних тренувань» із субнетингу." }[main];
  const nkT = Object.entries(w.byT).filter(([, x]) => x.nk).sort((a, b) => b[1].nk - a[1].nk).slice(0, 4);
  return `<div class="card"><h2>Чому я помиляюсь <span class="small muted">${w.n}</span></h2>
    ${top.map(([k, n]) => `<div class="kv"><span>${WHY[k][0]} ${WHY[k][1]}</span><span class="row" style="flex-wrap:nowrap"><span class="bar" style="width:110px"><i style="width:${Math.round(n / w.n * 100)}%;background:var(${k === "nk" ? "--bad" : k === "ina" ? "--warn" : "--accent"})"></i></span><b style="min-width:34px;text-align:right">${Math.round(n / w.n * 100)}%</b></span></div>`).join("")}
    <p class="small" style="margin:8px 0 4px">${advice}</p>
    ${nkT.length ? `<p class="small muted" style="margin:0">Найбільше «не знав»: ${nkT.map(([t, x]) => `${tlabel(t)} ${esc(TMAP[t].name)} (${x.nk})`).join("; ")}</p>` : ""}
    ${w.items.ina.length ? `<button class="mini" data-act="whytrain" data-w="ina" style="margin-top:8px">Повторити «неуважні» (${new Set(w.items.ina).size})</button>` : ""}</div>`; }
ACTS.whytrain = el => { const ids = [...new Set(whyStats().items[el.dataset.w])]; const list = ids.map(id => QMAP[id]).filter(Boolean); if (!list.length) return; startSession("train", shuffle(list).slice(0, 20), "Повтор: " + WHY[el.dataset.w][1].toLowerCase()); };

// ---- 9. Сесія дня ----
function dayWeakTopic() { const cand = TOPICS.filter(t => t.g !== "LNX").map(t => ({ t, r: topicReady(t.id) })).filter(x => x.r && x.r.seen >= 3).sort((a, b) => a.r.p - b.r.p);
  if (cand.length) return cand[0].t.id; const s = [...sel].find(id => TMAP[id] && TMAP[id].g !== "LNX" && topicStats(id).seen < topicStats(id).n); return s || "SRWE1"; }
function daySession() { const used = new Set(); const out = []; const add = q => { const id = recId(q); if (!q || used.has(id)) return; used.add(id); out.push(q); };
  reviewQueue().slice(0, 10).forEach(add); const wt = dayWeakTopic(); pickTraining(new Set([wt]), 8).forEach(add);
  const gk = GEN.forTopics(new Set([wt, ...[...sel].filter(t => TMAP[t] && TMAP[t].g !== "LNX")])); for (let i = 0; i < Math.min(2, gk.length); i++) { const g = GEN.make(gk[Math.floor(Math.random() * gk.length)]); if (g) add(g); }
  const labC = ALLSCEN().filter(s => !s.bash && !s.sb && TMAP[s.t] && TMAP[s.t].g !== "LNX" && !(labs[s.id] && labs[s.id].ok)); const due = labsDue(); const lab = due[0] || labC.find(s => s.t === wt) || labC.find(s => sel.has(s.t)) || labC[0];
  const sim = lab && simQ(lab.id); if (sim && due[0] === lab) sim.q = "🔁 Повторення лаби: " + lab.title; return { list: out.concat(sim ? [sim] : []), wt, lab, rep: due[0] === lab, nRev: Math.min(10, reviewQueue().length) }; }
function dayCard() { const rq = reviewQueue().length; const wt = dayWeakTopic();
  return `<div class="card daycard"><div class="row"><h2 class="grow" style="margin:0">▶ Сесія дня</h2><button class="primary" data-act="dayrun">Почати</button></div>
    <p class="small muted" style="margin:6px 0 0">Одна кнопка замість вибору: ${rq ? `повторення за розкладом (${Math.min(10, rq)}), ` : ""}найслабша тема <b>${tlabel(wt)} ${esc(TMAP[wt].name)}</b>, 2 розрахунки й ${labsDue().length ? `повторення лаби (на черзі: ${labsDue().length})` : "одна нова CLI-лаба"} наприкінці. ≈ 20–30 хв.</p></div>`; }
ACTS.dayrun = () => { const d = daySession(); if (!d.list.length) return; startSession("train", d.list, "Сесія дня"); };

// ---- 10. Власні пояснення ----
const myKey = id => "my:" + id;
function mineBox(q) { const id = recId(q), m = flags[myKey(id)];
  if (window._myEdit === id) return `<div class="mybox"><label class="small muted" for="mytext">Поясніть своїми словами, чому правильна саме ця відповідь — так краще запам'ятовується. Пояснення піде в експорт для Obsidian.</label>
    <textarea id="mytext" class="jt" maxlength="2000">${esc((m && m.mine) || "")}</textarea><div class="row"><span class="grow"></span><button class="ghost mini" data-act="mycancel">Скасувати</button><button class="primary mini" data-act="mysave" data-id="${esc(id)}">Зберегти</button></div></div>`;
  if (m && m.mine) return `<div class="mybox"><div class="row"><b class="small grow">✍ Моє пояснення</b><button class="mini ghost" data-act="myedit" data-id="${esc(id)}">✎</button></div><div class="small" style="white-space:pre-wrap">${esc(m.mine)}</div></div>`;
  return `<button class="mini ghost" data-act="myedit" data-id="${esc(id)}" style="margin-top:6px">✍ Пояснити своїми словами</button>`; }
ACTS.myedit = el => { window._myEdit = el.dataset.id; render(); const t = $("#mytext"); if (t) t.focus(); };
ACTS.mycancel = () => { window._myEdit = null; render(); };
ACTS.mysave = el => { const id = el.dataset.id; const text = (($("#mytext") || {}).value || "").trim(); const q = QMAP[id] || (S && S.items[S.i]);
  const rec = text ? { on: false, mine: text.slice(0, 2000), ts: Date.now(), snip: q ? q.q.slice(0, 140) : "" } : { on: false, ts: Date.now() }; flags[myKey(id)] = rec; patch({ flags: { [myKey(id)]: rec } }); window._myEdit = null; render(); };
function myList() { return Object.entries(flags).filter(([k, f]) => k.startsWith("my:") && f.mine).map(([k, f]) => ({ id: k.slice(3), f, q: QMAP[k.slice(3)] })).sort((a, b) => b.f.ts - a.f.ts); }

// ---- 11. Звіт про помилку в питанні ----
const isErrFlag = f => f && f.on && f.kind === "err";
ACTS.flagerr = el => { const id = el.dataset.id; const cur = flags[id]; const rec = isErrFlag(cur) ? { on: false, ts: Date.now() } : { on: true, kind: "err", ts: Date.now(), snip: el.dataset.snip, note: (cur && cur.note) || "" }; flags[id] = rec; patch({ flags: { [id]: rec } }); render(); };
function issuesList() { return Object.entries(flags).filter(([id, f]) => isErrFlag(f)).map(([id, f]) => ({ id, f, q: QMAP[id] })).sort((a, b) => b.f.ts - a.f.ts); }
function issuesMd() { const L = ["# CCNA тренажер — питання на виправлення", "", "Згенеровано " + new Date().toLocaleString("uk-UA"), ""];
  for (const { id, f, q } of issuesList()) { L.push("## " + id + (q ? " · " + tlabel(q.t) : ""), "", "**Питання:** " + (q ? q.q : f.snip || ""), ""); if (q) L.push("**Поточна правильна відповідь у банку:** " + ansText(q), ""); L.push("**Що не так:** " + (f.note || "(коментар не додано)"), ""); }
  return L.join("\n"); }
VIEWS.issues = { html: () => { const L = issuesList(), M = myList(), F = Object.entries(flags).filter(([k, f]) => f.on && f.kind !== "err" && !k.startsWith("my:"));
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🛠 Питання на виправлення <span class="small muted">${L.length}</span></h2><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:6px 0">Позначайте в тесті «⚠ Помилка в питанні» й пишіть, що не так. Тут — список із поточною відповіддю банку; його можна скопіювати як Markdown (наприклад, у GitHub issue або попросити Claude виправити).</p>
    ${L.length ? `<div class="row"><button class="mini" data-act="issuescopy">📋 Копіювати як Markdown</button><button class="mini" data-act="issuesdl">⬇ Завантажити .md</button><span class="small muted" id="issuesmsg"></span></div>` : ""}</div>
  ${L.map(({ id, f, q }) => `<div class="card"><div class="small muted">${esc(id)}${q ? " · " + tlabel(q.t) : ""}</div><p style="margin:4px 0">${esc(q ? q.q : f.snip || "")}</p>${q ? `<p class="small" style="margin:0 0 4px">У банку правильна: <b>${esc(ansText(q))}</b></p>` : ""}
    <div class="row"><input type="text" value="${esc(f.note || "")}" placeholder="Що саме неправильно? Яка правильна відповідь і чому?" data-issue="${esc(id)}"><button class="mini" data-act="issuenote" data-id="${esc(id)}">Зберегти</button><button class="mini" data-act="issuedone" data-id="${esc(id)}">✅ Виправлено</button></div></div>`).join("")}
  ${M.length ? `<div class="card"><h2>✍ Мої пояснення <span class="small muted">${M.length}</span></h2>${M.slice(0, 50).map(({ id, f, q }) => `<details><summary class="small">${esc((q ? q.q : f.snip || id).slice(0, 120))}</summary><div class="small" style="white-space:pre-wrap;margin:4px 0 8px">${esc(f.mine)}</div></details>`).join("")}<p class="small muted" style="margin:6px 0 0">Усі пояснення потрапляють в «📒 Експорт в Obsidian».</p></div>` : ""}
  ${F.length ? `<div class="card"><h2>⚑ Позначені як сумнівні <span class="small muted">${F.length}</span></h2>${F.slice(0, 30).map(([id, f]) => `<div class="kv"><span class="small">${esc((QMAP[id] ? QMAP[id].q : f.snip || id).slice(0, 110))}${f.note ? `<br><span class="muted">${esc(f.note)}</span>` : ""}</span><button class="mini ghost" data-act="unflag" data-id="${esc(id)}">✕</button></div>`).join("")}</div>` : ""}
  ${errCard()}
  <button class="ghost" data-act="home">На головну</button>`; } };
function errCard() { const loc = (window.ERRMON ? ERRMON.list() : []); const rem = window._errRemote || []; const seen = new Set(loc.map(e => e.msg + "|" + e.src + "|" + e.line));
  const all = loc.map(e => Object.assign({ where: "цей пристрій" }, e)).concat(rem.filter(e => !seen.has(e.msg + "|" + e.src + "|" + e.line)).map(e => Object.assign({ where: "інший пристрій" }, e))).sort((a, b) => b.ts - a.ts);
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🐞 Помилки в роботі тренажера <span class="small muted">${all.length}</span></h2></div>
    <p class="small muted" style="margin:6px 0">Тренажер сам записує збої JavaScript (повідомлення, файл і рядок, екран, браузер)${store.mode === "db" ? " і зберігає їх у вашому хмарному профілі" : " у цьому браузері"}. Скопіюйте список і надішліть розробнику — так помилки виправляються швидше.</p>
    ${all.length ? all.slice(0, 20).map(e => `<details><summary class="small"><b>${esc(e.msg.slice(0, 140))}</b> <span class="muted">· ${esc(e.src || "?")}:${e.line} · ×${e.n || 1} · ${new Date(e.ts).toLocaleString("uk-UA")} · ${esc(e.where)}</span></summary><pre class="small" style="white-space:pre-wrap">${esc((e.stack || "без стеку") + "\nЕкран: " + (e.view || "—") + "\n" + (e.ua || ""))}</pre></details>`).join("") : `<p class="small muted" style="margin:0">Помилок не зафіксовано ✅</p>`}
    <div class="row" style="margin-top:8px">${store.mode === "db" ? `<button class="mini" data-act="errload">☁ Завантажити з інших пристроїв</button>` : ""}${all.length ? `<button class="mini" data-act="errcopy">📋 Копіювати як Markdown</button><button class="mini ghost" data-act="errclear">Очистити локальні</button>` : ""}<span class="small muted" id="errmsg"></span></div></div>`; }
ACTS.errload = async () => { const m = $("#errmsg"); try { window._errRemote = (await ERRMON.remote()) || []; render(); } catch (e) { if (m) m.textContent = "Не вдалося: " + e.message; } };
ACTS.errcopy = async () => { const loc = ERRMON.list(); const list = loc.concat((window._errRemote || []).filter(r => !loc.some(e => e.msg === r.msg && e.line === r.line))); const m = $("#errmsg"); try { await navigator.clipboard.writeText(ERRMON.md(list)); if (m) m.textContent = "Скопійовано"; } catch (e) { saveDownload("ccna-errors-" + dkey() + ".md", ERRMON.md(list), "text/markdown"); } };
ACTS.errclear = () => { if (!confirm("Очистити локальний журнал помилок?")) return; ERRMON.clear(); render(); };
ACTS.issues = () => { view = "issues"; render(); scrollTop(); };
ACTS.issuenote = el => { const id = el.dataset.id; const inp = document.querySelector(`[data-issue="${CSS.escape(id)}"]`); const rec = Object.assign({}, flags[id], { note: (inp ? inp.value : "").slice(0, 500), ts: Date.now() }); flags[id] = rec; patch({ flags: { [id]: rec } }); render(); };
ACTS.issuedone = el => { const id = el.dataset.id; const rec = { on: false, ts: Date.now(), resolved: true }; flags[id] = rec; patch({ flags: { [id]: rec } }); render(); };
ACTS.issuescopy = async () => { const m = $("#issuesmsg"); try { await navigator.clipboard.writeText(issuesMd()); if (m) m.textContent = "Скопійовано"; } catch (e) { if (m) m.textContent = "Не вдалося — скористайтеся завантаженням"; } };
ACTS.issuesdl = () => saveDownload("ccna-issues-" + dkey() + ".md", issuesMd(), "text/markdown");
