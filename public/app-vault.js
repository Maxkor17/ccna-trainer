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
