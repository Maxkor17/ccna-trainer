"use strict";
// Інтерфейс іспиту як у Pearson VUE (CCNA): верхня панель з таймером, «Question X of Y», лише «Next», без тем і підказок,
// попередження про відповідь без вибору; наприкінці — звіт у стилі Cisco Score Report.
(function () { const baseQ = renderQuiz; renderQuiz = function () { if (!(S && S.vue && S.mode === "exam")) return baseQ(); qtMark(); const k = S.i, q = S.items[k], ans = S.ans[k]; const last = k >= S.items.length - 1;
  return `<div class="vue"><div class="vue-top"><span>Cisco CCNA 200-301</span><span>Question ${k + 1} of ${S.items.length}</span><span>⏱ <span id="timer">${fmtLeft(S.deadline - Date.now())}</span></span></div>
    <div class="vue-body"><div class="qtext">${esc(q.q)}</div>${renderBody(q, k, ans, false, true)}</div>
    ${S.vueWarn === k ? `<div class="vue-warn">${hasAnswer(q, ans) ? "" : "Ви не обрали відповідь. На іспиті Cisco повернутися до питання не можна — без відповіді воно зарахується як неправильне. "}Натисніть ${last ? "End Exam" : "Next"} ще раз, щоб продовжити.</div>` : ""}
    <div class="vue-bot"><span class="small">${S.items.filter((x, i) => hasAnswer(x, S.ans[i])).length} answered</span><button class="vue-btn" data-act="vuenext">${last ? "End Exam" : "Next &gt;"}</button></div></div>
  <button class="ghost" data-act="quit">✕ Вийти (іспит не зарахується)</button>`; };
  const baseR = renderResult; renderResult = function () { const h = baseR(); if (!(S && S.vue && S.result)) return h; const e = S.result; const sc = Math.round(300 + 700 * e.correct / e.n); const dom = {};
    for (const [t, [c, n]] of Object.entries(e.per)) { const d = domainOf(t, e.bp); dom[d] = dom[d] || [0, 0]; dom[d][0] += c; dom[d][1] += n; }
    const D = (SIM_DOMAINS[e.bp || bpVer()] || DOMAINS).filter(([d]) => dom[d]);
    return `<div class="vue"><div class="vue-top"><span>Score Report</span><span>CCNA 200-301 ${esc(e.bp || "")}</span></div><div class="vue-body">
      <p style="margin:0 0 4px">Candidate: ${esc(lsGet("ccna.chname", "") || "—")} · ${new Date(e.ts).toLocaleDateString("en-GB")}</p>
      <p style="margin:0 0 10px;font-size:18px"><b>${sc >= 825 ? "PASS" : "FAIL"}</b> · Your score: <b>${sc}</b> · Passing score: 825<span class="small"> (орієнтир — Cisco не публікує)</span></p>
      <div style="position:relative;height:16px;background:#e3e7ec;border-radius:3px;margin-bottom:14px"><div style="width:${(sc - 300) / 7}%;height:100%;background:${sc >= 825 ? "#2e7d32" : "#c62828"};border-radius:3px"></div><div style="position:absolute;left:${(825 - 300) / 7}%;top:-3px;bottom:-3px;border-left:2px dashed #111"></div></div>
      <table style="width:100%">${D.map(([d, w]) => { const [c, n] = dom[d]; const p = Math.round(c / n * 100); return `<tr><td style="width:45%">${esc(d)} <span class="small">(${Math.round(w * 100)}%)</span></td><td><div style="height:12px;background:#e3e7ec;border-radius:2px"><div style="width:${p}%;height:100%;background:#1f3b57;border-radius:2px"></div></div></td><td class="num" style="width:48px">${p}%</td></tr>`; }).join("")}</table>
      <p class="small" style="margin:10px 0 0">Як і в справжньому звіті, видно лише відсотки за розділами — без переліку питань. Розбір помилок нижче.</p></div></div>` + h; };
})();
ACTS.vuestart = el => { const en = el.dataset.en === "1"; const n = Number(el.dataset.n) || 100; const go = () => { startCcna(n, en); if (!S) return; S.vue = true; S.deadline = Date.now() + 120 * 60000; render(); scrollTop(); };
  if (en && !window.__trLoaded) { el.disabled = true; el.textContent = "⏳ Завантажую англійські тексти…"; loadTR().then(go).catch(() => { el.disabled = false; alert("Не вдалося завантажити переклади"); }); } else go(); };
ACTS.vuenext = () => { const k = S.i; const q = S.items[k]; if (S.vueWarn !== k && !hasAnswer(q, S.ans[k])) { S.vueWarn = k; render(); return; } S.vueWarn = null; if (k >= S.items.length - 1) { finishExam(); return; } S.i++; render(); scrollTop(); };
