// Аудіорежим: тренажер читає питання й варіанти вголос (Web Speech API), відповідь — великими кнопками A–D,
// після відповіді озвучує правильний варіант і пояснення та сам переходить далі. Для дороги й прогулянок.
let AUD = null;
const AUD_LS = "ccna.audio";
function audSay(parts, onend) { const sy = window.speechSynthesis; if (!sy) { if (onend) onend(); return; } sy.cancel();
  const st = lsGet(AUD_LS, { rate: 1, auto: true }); const en = AUD && AUD.en; const lang = en ? "en-US" : "uk-UA";
  const vs = sy.getVoices(); const v = vs.find(x => x.lang && x.lang.toLowerCase().startsWith(en ? "en" : "uk")) || null;
  const list = parts.filter(Boolean).map(t => audClean(t)); let i = 0; AUD && (AUD.speaking = true);
  const next = () => { if (!AUD || AUD.stopped) return; if (i >= list.length) { AUD.speaking = false; audDraw(); if (onend) onend(); return; }
    const u = new SpeechSynthesisUtterance(list[i++]); u.lang = lang; if (v) u.voice = v; u.rate = st.rate || 1; u.onend = next; u.onerror = next; sy.speak(u); };
  next(); }
function audClean(t) { return String(t).replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, "").replace(/\s+/g, " ").replace(/\b(Gi|Fa)(\d)/g, (m, a, n) => (a === "Gi" ? "Gigabit " : "Fast ") + n).replace(/\//g, " / ").trim(); }
function audPool() { const now = Date.now(); const ok = q => qtype(q) === "mc" && Array.isArray(q.a) && q.a.length === 1 && !q.c && !q.fig && q.o.length <= 5 && q.q.length < 400;
  const rev = reviewQueue().filter(ok); const fresh = pickTraining(sel.size ? sel : new Set(TOPICS.filter(t => t.g !== "LNX").map(t => t.id)), 60).filter(q => !q.gen && ok(q));
  const seen = new Set(); return rev.concat(fresh).filter(q => !seen.has(q.id) && seen.add(q.id)).slice(0, 20); }
function audStart() { if (!window.speechSynthesis) { alert("Цей браузер не вміє синтезувати мову. Спробуйте Chrome або Safari."); return; }
  const items = audPool(); if (!items.length) { alert("Немає питань для аудіорежиму: оберіть теми на вкладці «Практика»"); return; }
  AUD = { items, i: 0, phase: "q", ans: null, ok: 0, n: 0, en: opts.lang === "en", stopped: false }; view = "audio"; render(); audAsk(); }
function audAsk() { const q = AUD.items[AUD.i]; AUD.phase = "q"; AUD.ans = null; audDraw();
  audSay([(AUD.en ? "Question " : "Питання ") + (AUD.i + 1) + ".", q.q].concat(q.o.map((o, k) => (AUD.en ? "Option " : "Варіант ") + "ABCDE"[k] + ". " + o[0]))); }
function audAnswer(k) { if (!AUD || AUD.phase !== "q") return; const q = AUD.items[AUD.i]; const good = q.a[0] === k; AUD.phase = "a"; AUD.ans = k; AUD.n++; if (good) AUD.ok++;
  record(recId(q), good); audDraw(); const st = lsGet(AUD_LS, { rate: 1, auto: true }); const c = q.o[q.a[0]];
  audSay([good ? (AUD.en ? "Correct." : "Правильно.") : (AUD.en ? "Not quite. The correct answer is " : "Ні. Правильна відповідь — ") + (good ? "" : "ABCDE"[q.a[0]] + ". " + c[0] + "."), c[1]],
    () => { if (st.auto && AUD && AUD.phase === "a" && !AUD.stopped) setTimeout(() => { if (AUD && AUD.phase === "a" && !AUD.stopped) audNext(); }, 900); }); }
function audNext() { if (!AUD) return; if (AUD.i >= AUD.items.length - 1) { AUD.phase = "done"; audDraw(); audSay([(AUD.en ? "Done. Correct: " : "Готово. Правильно: ") + AUD.ok + (AUD.en ? " of " : " з ") + AUD.n + "."]); return; } AUD.i++; audAsk(); }
function audDraw() { if (view === "audio") { const a = $("#app"); if (a) a.innerHTML = VIEWS.audio.html(); } }
VIEWS.audio = { html: () => { if (!AUD) return `<div class="card"><p>Аудіосесію не розпочато.</p><button data-act="audstart" class="primary">Почати</button></div>`;
  const st = lsGet(AUD_LS, { rate: 1, auto: true }); const q = AUD.items[AUD.i];
  if (AUD.phase === "done") return `<div class="card"><h2>🎧 Аудіосесію завершено</h2><p class="big">${AUD.ok} / ${AUD.n}</p><div class="row"><button class="primary" data-act="audstart">Ще 20 питань</button><button data-act="audstop">На головну</button></div></div>`;
  return `<div class="card"><div class="qmeta"><span>🎧 Аудіорежим · ${AUD.i + 1}/${AUD.items.length}</span><span>✅ ${AUD.ok}/${AUD.n}</span></div>
    <p class="small muted" style="margin:4px 0">${tlabel(q.t)} · ${esc(TMAP[q.t] ? TMAP[q.t].name : "")}</p><p style="font-size:1.1em;margin:6px 0">${esc(q.q)}</p>
    <div class="audgrid">${q.o.map((o, k) => { const cls = AUD.phase === "a" ? (k === q.a[0] ? "ok" : k === AUD.ans ? "bad" : "") : ""; return `<button class="audbtn ${cls}" data-act="audpick" data-k="${k}" ${AUD.phase !== "q" ? "disabled" : ""}><b>${"ABCDE"[k]}</b><span>${esc(o[0])}</span></button>`; }).join("")}</div>
    ${AUD.phase === "a" ? `<p class="small" style="margin:8px 0">${esc(q.o[q.a[0]][1] || "")}</p>` : ""}
    <div class="row" style="margin-top:8px"><button data-act="audrepeat">🔁 Повторити</button>${AUD.phase === "a" ? `<button class="primary" data-act="audnext">Далі →</button>` : ""}<button data-act="audstop">✕ Завершити</button></div>
    <div class="row" style="margin-top:6px"><span class="small muted">Швидкість:</span>${[0.85, 1, 1.15, 1.3].map(r => `<button class="seg ${st.rate === r ? "on" : ""}" data-act="audrate" data-r="${r}">${r}×</button>`).join("")}<label class="small"><input type="checkbox" data-act="audauto" ${st.auto ? "checked" : ""}> далі автоматично</label></div>
    <p class="small muted" style="margin:8px 0 0">Питання з виводами show і схемами пропускаються — їх незручно слухати. ${AUD.en ? "" : "Якщо голос читає з акцентом, у системі не встановлено український голос; можна перемкнути мову тренажера на English у налаштуваннях."}</p></div>`; } };
ACTS.audstart = () => audStart();
ACTS.audpick = el => audAnswer(Number(el.dataset.k));
ACTS.audnext = () => audNext();
ACTS.audrepeat = () => { if (!AUD) return; if (AUD.phase === "q") audAsk(); else { const q = AUD.items[AUD.i]; audSay([q.o[q.a[0]][0], q.o[q.a[0]][1]]); } };
ACTS.audstop = () => { if (AUD) AUD.stopped = true; try { speechSynthesis.cancel(); } catch (e) {} AUD = null; view = "home"; render(); };
ACTS.audrate = el => { const st = lsGet(AUD_LS, { rate: 1, auto: true }); st.rate = Number(el.dataset.r); lsSet(AUD_LS, st); audDraw(); };
ACTS.audauto = () => { const st = lsGet(AUD_LS, { rate: 1, auto: true }); st.auto = !st.auto; lsSet(AUD_LS, st); audDraw(); };
if (window.speechSynthesis) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch (e) {} }
setInterval(() => { if (AUD && view !== "audio") { AUD.stopped = true; try { speechSynthesis.cancel(); } catch (e) {} AUD = null; } }, 1000);
