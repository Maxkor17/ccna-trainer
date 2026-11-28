"use strict";
// «Коли я буду готовий?»: щоденні знімки прогнозованого бала (flags "rd:<дата>", on:false — синхронізуються між пристроями),
// тренд за останні тижні, прогноз дати досягнення 825, вердикт щодо дати іспиту і скільки годин на тиждень потрібно.
// Плюс експорт розкладу підготовки в календар (.ics): навчальні блоки за модулями, фінішний тиждень, іспит, нагадування.
const RD_PASS = 825, RD_SAFE = 860;
function rdSnap() { try { const f = passForecast(bpVer()); const k = "rd:" + dkey(); const o = flags[k]; if (o && o.s === f.score) return; const r = { on: false, s: f.score, v: f.ver, ts: Date.now() }; flags[k] = r; patch({ flags: { [k]: r } }); } catch (e) { } }
setTimeout(rdSnap, 1500);
const rdDay = iso => { const [y, m, d] = iso.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const rdIso = n => new Date(n * 864e5).toISOString().slice(0, 10);
function rdSeries() { const ver = bpVer(); const allp = Object.entries(flags).filter(([k, v]) => k.startsWith("rd:") && v && typeof v.s === "number"); const same = allp.filter(([, v]) => !v.v || v.v === ver);
  const pts = (same.length >= 3 ? same : allp).map(([k, v]) => ({ d: k.slice(3), s: v.s, k: "snap" }));
  const sims = exams.filter(e => e.ccna && (e.bp || "v1.1") === ver && e.n >= 40).map(e => ({ d: dkey(new Date(e.ts)), s: Math.round(300 + 700 * e.correct / e.n), k: "sim" }));
  return { pts: pts.sort((a, b) => a.d < b.d ? -1 : 1), sims: sims.sort((a, b) => a.d < b.d ? -1 : 1), ver }; }
function rdMinutes(from, to) { let m = 0; for (const [k, v] of Object.entries(daily)) if (k >= from && k <= to) m += (v && v.m) || 0; return m; }
// Лінійна регресія за знімками останніх 28 днів (свіжіші важать більше); симуляції додаються з вагою 2
function rdTrend() { const S = rdSeries(); const today = rdDay(dkey()); const win = S.pts.concat(S.sims.map(x => Object.assign({ w2: 1 }, x))).filter(p => today - rdDay(p.d) <= 28);
  const cur = passForecast(S.ver).score; if (win.length < 3 || new Set(win.map(p => p.d)).size < 3) return { S, cur, slope: null, n: win.length };
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0; for (const p of win) { const x = rdDay(p.d) - today; const w = (p.w2 ? 2 : 1) * Math.exp(x / 14); sw += w; sx += w * x; sy += w * p.s; sxx += w * x * x; sxy += w * x * p.s; }
  const den = sw * sxx - sx * sx; if (Math.abs(den) < 1e-9) return { S, cur, slope: null, n: win.length }; const slope = (sw * sxy - sx * sy) / den; const icpt = (sy - slope * sx) / sw;
  const resid = Math.sqrt(win.reduce((a, p) => a + (p.s - (icpt + slope * (rdDay(p.d) - today))) ** 2, 0) / win.length);
  return { S, cur, slope, icpt, resid, n: win.length }; }
function rdPlan() { const T = rdTrend(); const today = dkey(); const from = rdIso(rdDay(today) - 13); const min14 = rdMinutes(from, today); const hpw = Math.round(min14 / 2 / 6) / 10;
  const firstSnap = T.S.pts.find(p => p.d >= from); const gain14 = firstSnap ? T.cur - firstSnap.s : null; const eff = gain14 != null && min14 >= 60 && gain14 > 0 ? gain14 / (min14 / 60) : null; // балів за годину
  const exam = opts.examDate || null; const daysLeft = exam ? rdDay(exam) - rdDay(today) : null; const base = T.slope != null ? T.icpt : T.cur;
  const at = d => Math.min(1000, Math.round(base + (T.slope || 0) * d)); const proj = daysLeft != null && T.slope != null ? at(daysLeft) : null;
  const eta = T.cur >= RD_PASS ? 0 : T.slope != null && T.slope > 0.05 ? Math.ceil((RD_PASS - base) / T.slope) : null;
  const need = Math.max(0, RD_SAFE - T.cur); const hoursNeed = eff ? need / eff : null; const weeks = daysLeft != null ? Math.max(0.5, daysLeft / 7) : null; const hpwNeed = hoursNeed != null && weeks ? Math.round(hoursNeed / weeks * 10) / 10 : null;
  let verdict, tone;
  if (T.cur >= RD_SAFE) { verdict = "Ви вже на рівні здачі із запасом — головне не втратити форму: симуляція раз на 2–3 дні і черга повторення."; tone = "ok"; }
  else if (!exam) { verdict = eta != null ? `За поточним темпом ${RD_PASS} буде приблизно ${rdHuman(eta)} (${rdIso(rdDay(today) + eta)}). Вкажіть дату іспиту в налаштуваннях — і я скажу, чи встигаєте.` : "Темп поки не видно: потрібні знімки щонайменше за 3 різні дні. Вкажіть дату іспиту в налаштуваннях."; tone = eta != null ? "warn" : "muted"; }
  else if (daysLeft < 0) { verdict = "Дата іспиту вже минула — оновіть її в налаштуваннях."; tone = "muted"; }
  else if (proj == null) { verdict = `До іспиту ${daysLeft} дн. Тренд ще не визначений (мало даних) — займайтесь щодня, і за 3–4 дні з'явиться прогноз.`; tone = "muted"; }
  else if (proj >= RD_SAFE) { verdict = `Встигаєте: за трендом на день іспиту ≈ ${proj} балів.`; tone = "ok"; }
  else if (proj >= RD_PASS) { verdict = `На межі: на день іспиту ≈ ${proj} — це прохідний бал, але без запасу. Додайте годин або зосередьтеся на слабких доменах.`; tone = "warn"; }
  else { verdict = `Не встигаєте за поточним темпом: на день іспиту ≈ ${proj} (треба ${RD_PASS}).${eta != null ? ` ${RD_PASS} буде ≈ ${rdIso(rdDay(today) + eta)} — розгляньте перенесення іспиту або збільшіть навантаження.` : ""}`; tone = "bad"; }
  return { T, min14, hpw, gain14, eff, exam, daysLeft, proj, eta, hoursNeed, hpwNeed, verdict, tone }; }
function rdHuman(d) { return d <= 1 ? "вже завтра" : d < 14 ? `за ${d} дн.` : d < 70 ? `за ${Math.round(d / 7)} тиж.` : `за ${Math.round(d / 30)} міс.`; }
function rdChart(P) { const W = 440, H = 230, L = 38, R = 8, Tp = 12, B = 24; const today = rdDay(dkey()); const S = P.T.S;
  const all = S.pts.concat(S.sims); const x0 = Math.min(today - 28, ...all.map(p => rdDay(p.d))); const x1 = Math.max(today + 7, P.exam && P.daysLeft >= 0 ? rdDay(P.exam) : (P.eta != null ? Math.min(today + P.eta, today + 120) : today + 14));
  const X = d => L + (d - x0) / Math.max(1, x1 - x0) * (W - L - R), Y = s => Tp + (1000 - Math.max(300, Math.min(1000, s))) / 700 * (H - Tp - B);
  let g = ""; for (const s of [400, 500, 600, 700, 800, 900, 1000]) g += `<line x1="${L}" x2="${W - R}" y1="${Y(s)}" y2="${Y(s)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${Y(s) + 4}" text-anchor="end" font-size="12" fill="var(--muted)">${s}</text>`;
  g += `<line x1="${L}" x2="${W - R}" y1="${Y(RD_PASS)}" y2="${Y(RD_PASS)}" stroke="var(--ok)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${W - R}" y="${Y(RD_PASS) - 5}" text-anchor="end" font-size="12" fill="var(--ok)">${RD_PASS} — прохідний</text>`;
  g += `<line x1="${X(today)}" x2="${X(today)}" y1="${Tp}" y2="${H - B}" stroke="var(--muted)" stroke-width="1"/><text x="${X(today)}" y="${H - 8}" text-anchor="middle" font-size="12" fill="var(--muted)">сьогодні</text>`;
  if (P.exam && P.daysLeft >= 0) g += `<line x1="${X(rdDay(P.exam))}" x2="${X(rdDay(P.exam))}" y1="${Tp}" y2="${H - B}" stroke="var(--bad)" stroke-width="1.5"/><text x="${X(rdDay(P.exam))}" y="${H - 8}" text-anchor="${X(rdDay(P.exam)) > W - 50 ? "end" : "middle"}" font-size="12" fill="var(--bad)">іспит ${P.exam.slice(5)}</text>`;
  if (S.pts.length) g += `<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${S.pts.map(p => X(rdDay(p.d)) + "," + Y(p.s)).join(" ")}"/>` + S.pts.map(p => `<circle cx="${X(rdDay(p.d))}" cy="${Y(p.s)}" r="2.5" fill="var(--accent)"><title>${p.d}: ${p.s}</title></circle>`).join("");
  g += S.sims.map(p => `<rect x="${X(rdDay(p.d)) - 4}" y="${Y(p.s) - 4}" width="8" height="8" fill="none" stroke="var(--warn)" stroke-width="2"><title>Симуляція ${p.d}: ${p.s}</title></rect>`).join("");
  if (P.T.slope != null) { const xe = x1 - today; g += `<line x1="${X(today)}" y1="${Y(P.T.icpt)}" x2="${X(x1)}" y2="${Y(P.T.icpt + P.T.slope * xe)}" stroke="var(--accent)" stroke-width="2" stroke-dasharray="6 5" opacity=".8"/>`;
    const band = Math.max(15, P.T.resid || 0); g += `<polygon points="${X(today)},${Y(P.T.icpt + band)} ${X(x1)},${Y(P.T.icpt + P.T.slope * xe + band * 1.6)} ${X(x1)},${Y(P.T.icpt + P.T.slope * xe - band * 1.6)} ${X(today)},${Y(P.T.icpt - band)}" fill="var(--accent)" opacity=".08"/>`; }
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Тренд прогнозованого бала">${g}</svg>`; }
VIEWS.readiness = { html: () => { rdSnap(); const P = rdPlan(); const T = P.T; const col = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)", muted: "var(--muted)" }[P.tone];
  const wk = T.slope != null ? Math.round(T.slope * 7) : null;
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">📈 Коли я буду готовий?</h2><button class="mini ghost" data-act="home">✕</button></div>
    <p style="margin:10px 0 6px;color:${col}"><b>${esc(P.verdict)}</b></p>
    <div class="kv"><span>Прогноз зараз (${esc(T.S.ver)})</span><b>${T.cur}</b></div>
    <div class="kv"><span>Темп</span><span>${wk == null ? "ще невідомий" : (wk >= 0 ? "+" : "") + wk + " балів/тиждень"}</span></div>
    ${P.exam ? `<div class="kv"><span>До іспиту</span><span>${P.daysLeft} дн. (${esc(P.exam)})</span></div>` : ""}
    ${P.proj != null ? `<div class="kv"><span>Прогноз на день іспиту</span><b style="color:${P.proj >= RD_PASS ? "var(--ok)" : "var(--bad)"}">${P.proj}</b></div>` : ""}
    ${P.eta != null && P.eta > 0 ? `<div class="kv"><span>${RD_PASS} за трендом</span><span>${rdIso(rdDay(dkey()) + P.eta)} (${rdHuman(P.eta)})</span></div>` : ""}
    <div class="kv"><span>Час навчання за 14 днів</span><span>${Math.round(P.min14 / 6) / 10} год (≈ ${P.hpw} год/тиж)</span></div>
    ${P.eff ? `<div class="kv"><span>Віддача</span><span>≈ ${Math.round(P.eff * 10) / 10} бала за годину</span></div>` : ""}
    ${P.hpwNeed != null && T.cur < RD_SAFE ? `<div class="kv"><span>Потрібно до ${RD_SAFE} (із запасом)</span><b>≈ ${P.hpwNeed} год/тиж</b></div>` : ""}
    ${rdChart(P)}
    <p class="small muted" style="margin:4px 0 0">Лінія — щоденні знімки прогнозованого бала (той самий, що в «🔮 Прогноз здачі»), квадрати — симуляції на 40+ питань, пунктир — тренд за 28 днів (свіжі дні важать більше) з коридором похибки. Знімок робиться автоматично щодня, коли ви відкриваєте застосунок.</p></div>
  <div class="card"><h2>Що зробити, щоб прискорити</h2><ul class="small" style="margin:0;padding-left:18px">${(passForecast(T.S.ver).gaps || []).slice(0, 4).map(g => `<li>Слабка тема <b>${esc(g.id)}</b> — ${esc(g.name || tlabel(g.id))}</li>`).join("")}<li>Повна симуляція раз на 3–4 дні: вона важить у прогнозі найбільше</li><li>Черга повторення: ${reviewQueue().length} карток</li></ul>
    <div class="row" style="margin-top:8px"><button class="primary" data-act="icsview">📅 Розклад у календар (.ics)</button><button data-act="bpview">Карта тем</button></div></div>
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.readiness = () => { view = "readiness"; render(); scrollTop(); };
// ---------- Експорт розкладу в календар (.ics) ----------
const ICS_LS = "ccna.ics"; const ICS_DOW = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const icsOpt = () => Object.assign({ time: "19:00", dur: 60, dows: [1, 2, 3, 4, 5, 6], course: "SRWE", rem: 15, weeks: 8 }, lsGet(ICS_LS, {}));
const icsEsc = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function icsFold(line) { const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line; const out = []; let cur = "", n = 0; for (const ch of line) { const b = enc.encode(ch).length; if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; n = 0; } cur += ch; n += b; } out.push(cur); return out.join("\r\n "); }
const icsDT = (iso, hm) => iso.replace(/-/g, "") + "T" + hm.replace(":", "") + "00";
function icsAddMin(hm, m) { const [h, mm] = hm.split(":").map(Number); const t = h * 60 + mm + m; return String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); }
function icsPlan(o) { const today = dkey(); const start = rdDay(today) + 1; const exam = opts.examDate && opts.examDate > today ? opts.examDate : null; const end = exam ? rdDay(exam) - 1 : start + o.weeks * 7 - 1;
  const fw = exam ? (fwPlan() || { items: [] }).items.filter(x => x.date > today && x.k > 0) : []; const fwDays = new Map(fw.map(x => [x.date, x]));
  const mods = TOPICS.filter(t => o.course === "all" ? ["ITN", "SRWE", "ENSA"].includes(t.g) : t.g === o.course).filter(t => { const m = typeof mdStat === "function" ? mdStat(t.id) : null; const r = topicReady(t.id); return !(m && m.done) && !(r && r.p >= 0.8); });
  const isSlot = d => { const iso = rdIso(d); return !fwDays.has(iso) && o.dows.includes(new Date(iso + "T12:00:00").getDay()); };
  let slots = 0; for (let d = start; d <= end; d++) if (isSlot(d)) slots++;
  const per = slots >= mods.length * 3 ? 3 : slots >= mods.length * 2 ? 2 : 1; const short = slots < mods.length ? mods.length - slots : 0;
  const ev = []; let mi = 0, rot = 0;
  for (let d = start; d <= end; d++) { const iso = rdIso(d);
    if (fwDays.has(iso)) { const it = fwDays.get(iso); const long = it.tasks.some(t => t[0] === "mock"); ev.push({ iso, time: o.time, dur: long ? 150 : o.dur, title: "CCNA фініш: " + it.tasks.map(t => t[1]).join(" + "), desc: it.tasks.map(t => t[1] + (t[2] ? " — " + t[2] : "")).join("\n"), cat: "final" }); continue; }
    if (!isSlot(d)) continue;
    if (mi < mods.length) { const t = mods[mi]; const m = typeof mdGet === "function" ? mdGet(t.id) : {}; const pts = typeof PT_ACT !== "undefined" ? PT_ACT.filter(a => a[1] === t.id && !(m.pt || []).includes(a[0])) : [];
      const read = m.read ? "повторити конспект і картки" : "прочитати модуль NetAcad і зробити нотатку в Obsidian", lab = pts.length ? "Packet Tracer: " + pts.map(a => a[2]).slice(0, 2).join("; ") : "лаба в симуляторі + 20 питань", ex = "екзамен модуля (мета ≥ 80%) і розбір помилок";
      const plan = per === 3 ? [[m.read ? "повторення конспекту" : "читання модуля", read], [pts.length ? "Packet Tracer" : "лаба в симуляторі", lab], ["екзамен модуля", ex]] : per === 2 ? [["читання + практика", read + "; " + lab], ["екзамен модуля", ex]] : [["модуль за один день", read + "; " + lab + "; " + ex]];
      const [ttl, what] = plan[rot];
      ev.push({ iso, time: o.time, dur: o.dur, title: `CCNA ${t.id}: ${ttl}`, desc: `${t.id}. ${t.name}\nСьогодні: ${what}.\nПісля — 10 хв черги повторення в тренажері.`, cat: "module" }); rot++; if (rot >= per) { rot = 0; mi++; } }
    else ev.push({ iso, time: o.time, dur: o.dur, title: (d - start) % 4 === 3 ? "CCNA: симуляція 40 питань" : "CCNA: повторення + слабкі теми", desc: "Черга повторення, потім слабкі теми з «🔮 Прогноз здачі».", cat: "review" }); }
  return { ev, exam, start: rdIso(start), end: rdIso(end), mods, per, slots, short }; }
function icsBuild(o) { const P = icsPlan(o); const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""); const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CCNA Trainer//UA", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:CCNA підготовка"];
  const alarm = (min, t) => ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(t), "TRIGGER:-PT" + min + "M", "END:VALARM"];
  P.ev.forEach((e, i) => { L.push("BEGIN:VEVENT", "UID:ccna-" + e.iso + "-" + i + "@ccna-trainer", "DTSTAMP:" + stamp, "DTSTART:" + icsDT(e.iso, e.time), "DTEND:" + icsDT(e.iso, icsAddMin(e.time, e.dur)), "SUMMARY:" + icsEsc(e.title), "DESCRIPTION:" + icsEsc(e.desc), "CATEGORIES:" + icsEsc(e.cat === "final" ? "CCNA,Фініш" : "CCNA")); if (o.rem) L.push(...alarm(o.rem, e.title)); L.push("END:VEVENT"); });
  if (P.exam) { const nx = rdIso(rdDay(P.exam) + 1).replace(/-/g, ""); L.push("BEGIN:VEVENT", "UID:ccna-exam-" + P.exam + "@ccna-trainer", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + P.exam.replace(/-/g, ""), "DTEND;VALUE=DATE:" + nx, "SUMMARY:" + icsEsc("🎯 Іспит CCNA 200-301"), "DESCRIPTION:" + icsEsc("Два документи з фото, прийти за 30 хв. Без нових тем напередодні."), "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc("Завтра іспит CCNA"), "TRIGGER:-PT15H", "END:VALARM", "END:VEVENT"); }
  L.push("END:VCALENDAR"); return { text: L.map(icsFold).join("\r\n") + "\r\n", P }; }
VIEWS.icsview = { html: () => { const o = icsOpt(); const { P } = icsBuild(o); const by = {}; for (const e of P.ev) by[e.cat] = (by[e.cat] || 0) + 1;
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">📅 Розклад у календар</h2><button class="mini ghost" data-act="readiness">← Прогноз</button></div>
    <p class="small muted" style="margin:6px 0 8px">Файл .ics відкривається Google Calendar, Outlook, Apple Calendar: навчальні блоки за модулями (читання → Packet Tracer → екзамен модуля), фінішний план останніх днів із симуляціями, день іспиту, нагадування.</p>
    <div class="row"><label class="small">Час <input type="time" id="icstime" value="${esc(o.time)}"></label><label class="small">Тривалість <select id="icsdur">${[30, 45, 60, 90, 120].map(m => `<option ${o.dur === m ? "selected" : ""} value="${m}">${m} хв</option>`).join("")}</select></label><label class="small">Нагадування <select id="icsrem">${[0, 10, 15, 30, 60].map(m => `<option ${o.rem === m ? "selected" : ""} value="${m}">${m ? "за " + m + " хв" : "без"}</option>`).join("")}</select></label></div>
    <div class="row" style="margin-top:6px">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button class="seg ${o.dows.includes(d) ? "on" : ""}" data-act="icsdow" data-d="${d}">${ICS_DOW[d]}</button>`).join("")}</div>
    <div class="row" style="margin-top:6px"><label class="small">Курс <select id="icscourse">${[["SRWE", "SRWE"], ["ENSA", "ENSA"], ["all", "усі CCNA (ITN+SRWE+ENSA)"]].map(([v, t]) => `<option ${o.course === v ? "selected" : ""} value="${v}">${t}</option>`).join("")}</select></label>${opts.examDate ? "" : `<label class="small">Тижнів <input type="number" id="icsweeks" min="1" max="26" value="${o.weeks}" style="width:70px"></label>`}<button class="mini" data-act="icssave">Оновити</button></div>
    <p class="small" style="margin:10px 0 4px">${P.start} → ${P.exam ? P.exam + " (іспит)" : P.end} · подій: <b>${P.ev.length + (P.exam ? 1 : 0)}</b> (модулі ${by.module || 0}, повторення ${by.review || 0}, фініш ${by.final || 0}${P.exam ? ", іспит 1" : ""}) · модулів у черзі: ${P.mods.length} (${P.per === 3 ? "3 заняття на модуль: читання → практика → екзамен" : P.per === 2 ? "2 заняття на модуль — днів замало для трьох" : "1 заняття на модуль — дуже щільно"})</p>
    ${P.short ? `<p class="small" style="margin:0 0 6px;color:var(--bad)">Не вміщається ${P.short} модул${P.short === 1 ? "ь" : "ів"}: додайте днів тижня, перенесіть іспит або позначте вже пройдені модулі в трекері NetAcad.</p>` : ""}
    ${P.exam ? "" : `<p class="small muted" style="margin:0 0 6px">Дату іспиту не вказано — розклад на ${o.weeks} тиж. Вкажіть дату в налаштуваннях, щоб додати фінішний тиждень і день іспиту.</p>`}
    <div class="row"><button class="primary" data-act="icsdl">⬇ ccna-plan.ics</button></div>
    <details style="margin-top:8px"><summary class="small">Перші 14 подій</summary><ul class="small" style="padding-left:18px">${P.ev.slice(0, 14).map(e => `<li><b>${e.iso.slice(5)} ${ICS_DOW[new Date(e.iso + "T12:00:00").getDay()]} ${e.time}</b> · ${esc(e.title)} <span class="muted">(${e.dur} хв)</span></li>`).join("")}</ul></details></div>
  <button class="ghost" data-act="home">На головну</button>`; } };
const icsRead = () => { const o = icsOpt(); const v = id => ($("#" + id) || {}).value; if (v("icstime")) o.time = v("icstime"); if (v("icsdur")) o.dur = Number(v("icsdur")); if (v("icsrem") != null) o.rem = Number(v("icsrem")); if (v("icscourse")) o.course = v("icscourse"); if (v("icsweeks")) o.weeks = Math.max(1, Math.min(26, Number(v("icsweeks")) || 8)); lsSet(ICS_LS, o); return o; };
ACTS.icsview = () => { view = "icsview"; render(); scrollTop(); };
ACTS.icssave = () => { icsRead(); render(); };
ACTS.icsdow = el => { const o = icsRead(); const d = Number(el.dataset.d); o.dows = o.dows.includes(d) ? o.dows.filter(x => x !== d) : o.dows.concat(d); if (!o.dows.length) o.dows = [d]; lsSet(ICS_LS, o); render(); };
ACTS.icsdl = () => { const o = icsRead(); saveDownload("ccna-plan.ics", icsBuild(o).text, "text/calendar;charset=utf-8"); };
