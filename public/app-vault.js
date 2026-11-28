"use strict";
// Obsidian: картки з помилок по модулях у форматі vault («## Картки» + #flashcards/<курс>), нотатка-MOC з готовністю модулів,
// посилання obsidian:// — відкрити нотатку, з якої картка, або дописати картку у «Вхідні картки» одним дотиком.
const obClean = t => String(t || "").replace(/::/g, ":").replace(/\s*\n\s*/g, " ").trim();
function vaultModuleNotes(dir) { const by = {};
  for (const [id, r] of Object.entries(prog)) { const q = QMAP[id]; if (!q || !(r.w > 0)) continue; (by[q.t] = by[q.t] || []).push([q, r]); }
  return Object.entries(by).map(([t, arr]) => { const T = TMAP[t]; arr.sort((a, b) => (b[1].w - b[1].c * 0.3) - (a[1].w - a[1].c * 0.3));
    const L = ["---", "tags: [ccna, " + T.g.toLowerCase() + ", помилки]", "updated: " + dkey(), "---", "# Помилки " + tlabel(t) + " — " + T.name, "", "> Згенеровано тренажером. Пов'язано: [[" + T.g + " — готовність]]", "", "## Картки", "", "#flashcards/" + T.g, ""];
    for (const [q, r] of arr.slice(0, 60)) L.push(obClean(q.q) + "::" + obClean(ansText(q)) + (r.w > 1 ? " (помилок: " + r.w + ")" : ""));
    return [dir + "/Помилки/" + tlabel(t) + " " + T.name.replace(/[\\/:*?"<>|#^[\]]/g, "") + ".md", L.join("\n") + "\n"]; }); }
function vaultMoc(course) { const mods = TOPICS.filter(t => t.g === course); const L = ["---", "tags: [ccna, " + course.toLowerCase() + ", moc]", "updated: " + dkey(), "---", "# " + course + " — готовність", "", "| Модуль | Тренажер | Пройдено | Module exam | PT | Статус |", "|---|---|---|---|---|---|"];
  for (const t of mods) { const s = typeof mdStat === "function" ? mdStat(t.id) : { r: topicReady(t.id) || { p: 0, n: 0, seen: 0 }, m: { pt: [], exam: null }, pts: [], done: false };
    L.push(`| ${tlabel(t.id)} ${t.name} | ${s.r.seen ? Math.round(s.r.p * 100) + "%" : "—"} | ${s.r.seen}/${s.r.n} | ${s.m.exam != null ? s.m.exam + "%" : "—"} | ${s.pts.length ? s.m.pt.filter(x => s.pts.some(a => a[0] === x)).length + "/" + s.pts.length : "—"} | ${s.done ? "✅" : s.r.seen ? "⏳" : "⬜"} |`); }
  const weak = mods.map(t => [t, topicReady(t.id)]).filter(([, r]) => r && r.seen && r.p < 0.6).sort((a, b) => a[1].p - b[1].p);
  if (weak.length) { L.push("", "## Слабкі модулі", ""); for (const [t, r] of weak) L.push(`- ${tlabel(t.id)} ${t.name} — ${Math.round(r.p * 100)}%`); }
  L.push("", "## Нотатки з помилками", "", ...mods.filter(t => Object.entries(prog).some(([id, r]) => QMAP[id] && QMAP[id].t === t.id && r.w > 0)).map(t => `- [[${tlabel(t.id)} ${t.name.replace(/[\\/:*?"<>|#^[\]]/g, "")}]]`));
  return L.join("\n") + "\n"; }
function vaultExtraFiles(dir) { const courses = [...new Set(Object.keys(prog).map(id => QMAP[id] && TMAP[QMAP[id].t] && TMAP[QMAP[id].t].g).filter(Boolean))].filter(c => c !== "LNX"); if (!courses.includes("SRWE")) courses.push("SRWE");
  return courses.map(c => [dir + "/" + c + " — готовність.md", vaultMoc(c)]).concat(vaultModuleNotes(dir)); }
// ---- obsidian:// ----
const obUri = (act, p) => "obsidian://" + act + "?" + Object.entries(p).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
function obButtons(q) { if (!opts.obVault || !q || q.gen) return ""; const B = [];
  if (q.src === "n" && q.file) B.push(`<a class="mini linkbtn" href="${esc(obUri("open", { vault: opts.obVault, file: q.file.replace(/\.md$/i, "") }))}">📓 Відкрити нотатку</a>`);
  const T = TMAP[q.t]; const card = obClean(q.q) + "::" + obClean(ansText(q)) + " #flashcards/" + (T ? T.g : "CCNA");
  B.push(`<a class="mini linkbtn" href="${esc(obUri("new", { vault: opts.obVault, file: (opts.obWriteDir || "CCNA/Тренажер") + "/Вхідні картки", content: "\n" + card, append: "true" }))}">📝 Картку в Obsidian</a>`);
  return `<div class="row" style="margin:4px 0">${B.join("")}</div>`; }
ACTS.obvault = () => { const v = (($("#obvault") || {}).value || "").trim(); opts.obVault = v; lsSet(LS.opts, opts); const m = $("#obmsg"); if (m) m.textContent = v ? "Vault «" + v + "» збережено: після помилки з'явиться кнопка «Картку в Obsidian»." : "Назву vault очищено."; };
// ---- тижневий звіт: розширені розділи для «Тиждень <wk>.md» ----
function weekExtraMd(wk) { const days = weekDays(wk); const t0 = new Date(days[0]).getTime(), t1 = t0 + 7 * 864e5; const L = [];
  const inW = r => r && r.l >= t0 && r.l < t1; const byT = {}; for (const [id, r] of Object.entries(prog)) { const q = QMAP[id]; if (!q || !inW(r)) continue; (byT[q.t] = byT[q.t] || 0); byT[q.t]++; }
  const touched = Object.entries(byT).map(([t, n]) => [t, n, topicReady(t) || { p: 0 }]).sort((a, b) => b[1] - a[1]);
  if (touched.length) { L.push("## Теми тижня", "", "| Модуль | Питань тренував | Готовність зараз |", "|---|---|---|"); for (const [t, n, r] of touched.slice(0, 12)) L.push(`| ${tlabel(t)} ${TMAP[t].name} | ${n} | ${Math.round(r.p * 100)}% |`); L.push(""); }
  const pr = (pfx, name) => { const a = Object.entries(prog).filter(([k, r]) => k.startsWith(pfx) && inW(r)); if (!a.length) return null; const c = a.reduce((x, [, r]) => x + (r.k ? 1 : 0), 0); return `- ${name}: ${a.length} вправ (останні відповіді правильні: ${c})`; };
  const P = [pr("sh-", "Читання виводів"), pr("bg-", "Знайди помилку"), pr("cb-", "Збери команду"), pr("pw-", "Пакет покроково"), pr("iv:", "Співбесіда")].filter(Boolean);
  const W = lsGet("ccna.chweek", {})[wk]; if (W && W.best) P.push(`- Челендж тижня: найкраще ${W.best.correct}/15, спроб ${W.tries}`);
  const sa = lsGet("ccna.sa.hist", []).filter(x => x.ts >= t0 && x.ts < t1); if (sa.length) P.push(`- Skills Assessment: ${sa.length} спроб, найкраще ${Math.max(...sa.map(x => x.pct))}%`);
  if (P.length) L.push("## Практика", "", ...P, "");
  const md = TOPICS.filter(t => t.g === "SRWE").map(t => [t, typeof mdStat === "function" ? mdStat(t.id) : null]).filter(([, s]) => s);
  if (md.length) { const done = md.filter(([, s]) => s.done).length; L.push("## Модулі SRWE", "", `Готово ${done}/${md.length}. [[SRWE — готовність]]`, ""); }
  const plan = []; const fw = typeof fwPlan === "function" ? fwPlan() : null;
  if (fw && fw.days >= 0 && fw.days <= 14) { for (const d of fw.items.filter(x => x.date > dkey()).slice(0, 7)) plan.push(`- [ ] ${d.date}: ${d.tasks.map(t => t[1]).join(", ")}`); }
  else { const next = md.find(([, s]) => !s.done); if (next) plan.push(`- [ ] ${tlabel(next[0].id)} ${next[0].name}: ${["прочитати теорію", "виконати Packet Tracer", "скласти module exam ≥ 80%", "підтягнути тренажер ≥ 70%"].filter((_, k) => !next[1].parts[k]).join(", ")}`);
    const weak = TOPICS.filter(t => t.g !== "LNX").map(t => [t, topicReady(t.id)]).filter(([, r]) => r && r.seen >= 5 && r.p < 0.7).sort((a, b) => a[1].p - b[1].p).slice(0, 3);
    for (const [t, r] of weak) plan.push(`- [ ] Тренувати ${tlabel(t.id)} ${t.name} (зараз ${Math.round(r.p * 100)}%)`);
    const rq = typeof reviewQueue === "function" ? reviewQueue().length : 0; if (rq) plan.push(`- [ ] Розібрати чергу повторення (${rq})`); plan.push("- [ ] Челендж тижня — побити минулий результат"); }
  if (plan.length) L.push("## План на наступний тиждень", "", ...plan, "");
  return L; }
