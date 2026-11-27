// Браузерний smoke-тест тренажера: відкриває сайт у Chromium (локальний режим, без Firebase)
// і проходить основні сценарії. Будь-яка помилка JS на сторінці або невдалий крок → exit 1.
// Запуск: npm install --prefix tests && npx --prefix tests playwright install chromium && node tests/smoke.mjs
// Локально можна вказати свій Chrome: CHROME_PATH=/usr/bin/google-chrome node tests/smoke.mjs
// SHOTS=1 — зберегти скриншоти в tests/shots/.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const SHOTS = process.env.SHOTS ? path.join(path.dirname(fileURLToPath(import.meta.url)), "shots") : null;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname); const f = path.join(ROOT, u === "/" ? "index.html" : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] } : {});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/gstatic|Failed to load resource|net::ERR/i.test(m.text())) errors.push("console: " + m.text()); });
await page.route(/gstatic\.com|googleapis\.com/, r => r.abort());
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let fails = 0, n = 0;
const step = async (name, fn) => {
  n++; const before = errors.length;
  try { await fn(); if (errors.length > before) throw new Error(errors.slice(before).join("\n")); console.log("✓ " + name); }
  catch (e) { fails++; console.error("✗ " + name + "\n   " + String(e.message || e).split("\n").slice(0, 6).join("\n   ")); }
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, String(n).padStart(2, "0") + ".png"), fullPage: true }).catch(() => {});
};
const act = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(80); };
const home = async () => { await page.evaluate(() => { view = "home"; S = null; render(); }); };
const has = async (text) => { if (!(await page.getByText(text, { exact: false }).count())) throw new Error("немає тексту: " + text); };

await page.goto(BASE + "index.html");
await page.waitForTimeout(800);

await step("головна відкривається", async () => { await has("Денна норма"); await has("Чек-ін дня"); });
await step("вкладки головної: Практика, Прогрес, Інструменти, Усе", async () => {
  await act('[data-act="hometab"][data-v="prac"]'); await has("Тест модуля"); await has("Симуляція CCNA");
  await act('[data-act="hometab"][data-v="prog"]'); await has("Статистика");
  await act('[data-act="hometab"][data-v="tools"]'); await has("Інструменти");
  await act('[data-act="hometab"][data-v="all"]'); await has("Денна норма"); await has("Тест модуля"); });
await step("тренування: відповідь і перевірка", async () => {
  await act('[data-act="train"]'); await page.waitForSelector('[data-act="pick"], #cmdin, .fillin, [data-act="flashshow"]', { timeout: 3000 });
  const pick = page.locator('[data-act="pick"]'); if (await pick.count()) await pick.first().click();
  const chk = page.locator("#checkbtn"); if (await chk.count() && await chk.isEnabled()) await chk.click();
  await home();
});
await step("запис часу і чек-ін", async () => {
  await act('[data-act="logopen"]'); await act('[data-act="logmin"][data-v="30"]'); await page.fill("#lnote", "smoke"); await act('[data-act="logadd"]');
  await page.fill("#jnote", "smoke note"); await page.fill("#jplan", "smoke plan"); await act('[data-act="jsave"]');
  const d = await page.evaluate(() => daily[dkey()]); if (!d || !d.log || !d.log.length || d.note !== "smoke note") throw new Error("дані дня не збережено: " + JSON.stringify(d));
});
await step("активність і досягнення", async () => { await act('[data-act="progress"]'); await has("Журнал навчання"); await home(); });
await step("статистика", async () => { await page.evaluate(() => { view = "stats"; render(); bindChart(); }); await page.waitForTimeout(100); await home(); });
await step("CLI-лаба: команда в терміналі", async () => {
  await act('[data-act="labs"]'); await page.waitForTimeout(100);
  await page.evaluate(() => openLab(CLI.NETSCEN[0].id)); await page.waitForTimeout(100);
  const ti = page.locator("#tin"); if (!(await ti.count())) throw new Error("немає поля терміналу #tin");
  await ti.fill("enable"); await ti.press("Enter"); await ti.fill("show vlan brief"); await ti.press("Enter");
  await home();
});
await step("STP покроково: кроки, перевір себе, обрив лінку", async () => {
  await page.evaluate(() => { view = "stpviz"; render(); }); await has("STP покроково");
  for (let i = 0; i < 4; i++) await act('[data-act="stpstep"][data-d="1"]'); await has("Alternate (BLK)");
  await page.locator('[data-act="stpcut"]').first().dispatchEvent("click"); await has("Що змінилося");
  await act('[data-act="stpmode"][data-m="quiz"]'); await page.locator('[data-act="stproot"]').first().dispatchEvent("click");
  await page.locator('[data-act="stpport"]').first().dispatchEvent("click"); await act('[data-act="stpcheck"]'); await has("правильно");
  await act('[data-act="stpnew"][data-p="par"]'); await home(); });
await step("нові лаби: EtherChannel, port-security, snooping, DHCPv6", async () => {
  for (const id of ["net-ec-lacp", "net-psec", "net-snoop", "net-dhcpv6"]) { await page.evaluate(i => openLab(i), id); await page.waitForTimeout(60);
    const ti = page.locator("#tin"); await ti.fill("ipconfig /all"); await ti.press("Enter"); }
  await home(); });
await step("симлет: відповіді на всі частини і перевірка", async () => {
  await page.evaluate(() => startSession("train", [QB.find(q => q.type === "simlet")], "simlet"));
  const parts = await page.evaluate(() => S.items[0].parts.length);
  for (let i = 0; i < parts; i++) await page.locator(`[data-act="spick"][data-p="${i}"]`).first().click();
  await page.locator("#checkbtn").click(); await page.waitForTimeout(100);
  if (!(await page.evaluate(() => !!S.checked[0]))) throw new Error("симлет не перевірено"); await home(); });
await step("карта покриття v1.1/v2.0 і прогноз", async () => {
  await page.evaluate(() => { view = "bpview"; render(); }); await has("Карта покриття CCNA"); await has("Прогноз здачі");
  await act('[data-act="bpver"][data-v="v1.1"]'); await has("Network Fundamentals".slice(0, 0) || "Основи мереж");
  await act('[data-act="bpver"][data-v="v2.0"]'); await has("AI, операції й керування");
  await page.locator('[data-act="bptrain"]').first().click(); await page.waitForTimeout(80);
  if (await page.evaluate(() => view) !== "quiz") throw new Error("тренування за темою blueprint не стартувало");
  await page.evaluate(() => { opts.bp = "auto"; }); await home(); });
await step("англійський режим: симлет і нові питання перекладено", async () => {
  const bad = await page.evaluate(() => { opts.lang = "en"; rebuildQB(); const CY = /[а-яіїєґ]/i; const r = QB.filter(q => /^(e\d+x|v2-|sl-|pf-|po-)/.test(q.id)).filter(q => CY.test(q.q) || (q.parts || []).some(p => CY.test(p.q))).map(q => q.id); opts.lang = "mix"; rebuildQB(); return r; });
  if (bad.length) throw new Error("без перекладу: " + bad.join(", ")); });
await step("сесія дня стартує з лабою наприкінці", async () => {
  await act('[data-act="dayrun"]'); const r = await page.evaluate(() => ({ v: view, n: S.items.length, last: (S.items[S.items.length - 1] || {}).type }));
  if (r.v !== "quiz" || r.n < 5 || r.last !== "sim") throw new Error(JSON.stringify(r)); await home(); });
await step("причина помилки, власне пояснення, звіт про помилку", async () => {
  await page.evaluate(() => { const q = QB.find(x => x.type === undefined && x.o && x.a.length === 1 && x.id.startsWith("e8x")); startSession("train", [q], "t"); const wrong = q.o.findIndex((_, i) => !q.a.includes(i)); S.ans[0] = [wrong]; render(); });
  await act("#checkbtn"); await act('[data-act="why"][data-w="ina"]');
  if (!(await page.evaluate(() => (prog[recId(S.items[0])].whys || {}).ina === 1))) throw new Error("причину не збережено");
  await act('[data-act="myedit"]'); await page.fill("#mytext", "ESP шифрує, AH — ні"); await act('[data-act="mysave"]'); await has("Моє пояснення");
  await act('[data-act="flagerr"]'); await page.fill("#flagnote", "тест"); await act('[data-act="flagnote"]');
  await home(); await act('[data-act="issues"]'); await has("Питання на виправлення"); await has("Мої пояснення");
  const md = await page.evaluate(() => issuesMd()); if (!/тест/.test(md)) throw new Error("немає коментаря в Markdown");
  const ob = await page.evaluate(() => obsidianMd()); if (!/Мої пояснення/.test(ob)) throw new Error("пояснення не потрапили в експорт Obsidian");
  await page.evaluate(() => { view = "stats"; render(); bindChart(); }); await has("Чому я помиляюсь"); await home(); });
await step("Pomodoro: старт, пауза, стоп пише час у журнал", async () => {
  await page.evaluate(() => { pomoStart(25, 5, "pt"); POMO.end = Date.now() + 1000; }); await page.waitForSelector("#pomo");
  await page.locator('[data-act="pomopause"]').click(); await page.locator('[data-act="pomopause"]').click();
  await page.waitForTimeout(2600); const ph = await page.evaluate(() => POMO && POMO.phase); if (ph !== "break") throw new Error("фокус не перейшов у перерву: " + ph);
  const log = await page.evaluate(() => (daily[dkey()].log || []).some(e => e.min === 25 && e.k === "pt")); if (!log) throw new Error("25 хв не записано в журнал");
  await page.locator('[data-act="pomostop"]').click(); if (await page.locator("#pomo").count()) throw new Error("віджет не зник"); });
await step("тижневий огляд: збереження й нотатка Obsidian", async () => {
  await page.evaluate(() => { window._wk = isoWeek(new Date()); view = "week"; render(); }); await has("Рефлексія");
  await page.fill("#wkwin", "лаби STP"); await page.fill("#wkfocus", "ENSA 1–2"); await act('[data-act="weeksave"]');
  const md = await page.evaluate(() => weekMd(isoWeek(new Date()))); if (!/лаби STP/.test(md) || !/weekly-review/.test(md)) throw new Error("нотатка неповна"); await home(); });
await step("віхи: пропозиції від дати іспиту і статуси", async () => {
  await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 90); opts.examDate = dkey(d); view = "miles"; render(); });
  await act('[data-act="mssuggest"]'); const n = await page.evaluate(() => msList().length); if (n < 5) throw new Error("віх: " + n);
  await page.locator('[data-act="msdone"]').first().click(); await home(); await has("🎯 Віхи"); await page.evaluate(() => { opts.examDate = ""; }); });
await step("тікет: скарга, таймер, оцінка після виправлення", async () => {
  await page.evaluate(() => { view = "labs"; render(); }); await act('[data-act="tsstart"][data-tk="1"]'); await has("Скарга"); await has("⏱");
  const sc = await page.evaluate(() => { const sol = CLI.solveNet(LAB.sc); LAB.N = sol; LAB.ses = CLI.sessionsFor(sol); LAB.hist = ["show run"]; checkLab(); return LAB.ts.tk.score; });
  if (!(sc > 0)) throw new Error("немає оцінки: " + sc); await has("закрито"); await home(); });
await step("Ansible: запуск плейбука, PLAY RECAP, прогрес", async () => {
  await page.evaluate(() => { view = "labs"; render(); }); await act('[data-act="ansible"]'); await has("site.yml");
  await act('[data-act="ansrun"]'); await has("PLAY RECAP"); await has("ok=1"); await home(); });
await step("CCNA англійською: англійські питання, час на питання, мова відновлюється", async () => {
  const before = await page.evaluate(() => opts.lang);
  await page.evaluate(() => { view = "home"; render(); }); await act('[data-act="ccna"][data-n="40"][data-en="1"]');
  const cyr = await page.evaluate(() => S.items.filter(q => /[а-яіїєґ]/i.test(q.q)).length); if (cyr) throw new Error("питань з кирилицею: " + cyr);
  await page.waitForTimeout(1100); await page.evaluate(() => { S.i = 1; render(); finishExam(); }); await has("Час на питання");
  const after = await page.evaluate(() => opts.lang); if (after !== before) throw new Error("мова не відновилась: " + after); await home(); });
await step("повторення лаб: через 7 днів лаба повертається в сесію дня", async () => {
  const r = await page.evaluate(() => { const id = CLI.NETSCEN[0].id; const keep = labs[id]; labs[id] = { ok: true, done: Date.now() - 8 * 864e5, last: Date.now() - 8 * 864e5, reps: 0, tries: 1 };
    const d = daySession(); const due = labDue(id); const rec = labNext(id, labs[id], true); labs[id] = rec; const after = labDue(id); if (keep) labs[id] = keep; else delete labs[id];
    return { lab: d.lab && d.lab.id, rep: d.rep, due, reps: rec.reps, after, id }; });
  if (r.lab !== r.id || !r.rep || !r.due || r.reps !== 1 || r.after) throw new Error(JSON.stringify(r)); });
await step("імпорт карток з GitHub-репозиторію vault (мок API)", async () => {
  await page.route(/api\.github\.com|raw\.githubusercontent\.com/, r => { const u = r.request().url();
    if (/\/git\/trees\//.test(u)) return r.fulfill({ contentType: "application/json", body: JSON.stringify({ tree: [{ path: "CCNA/SRWE/VLAN.md", type: "blob", sha: "a1" }, { path: "Daily/2026.md", type: "blob", sha: "b2" }, { path: ".obsidian/x.md", type: "blob", sha: "c3" }] }) });
    if (/\/repos\/[^/]+\/[^/]+$/.test(u)) return r.fulfill({ contentType: "application/json", body: JSON.stringify({ default_branch: "main" }) });
    if (/VLAN\.md/.test(u)) return r.fulfill({ contentType: "text/plain", body: "# VLAN\nЯкий діапазон нормальних VLAN?::1–1005\n" });
    return r.fulfill({ status: 404, body: "" }); });
  await page.evaluate(() => { view = "custom"; render(); }); await has("Імпорт з GitHub");
  await page.evaluate(() => { document.querySelector("#ghrepo").closest("details").open = true; }); await page.fill("#ghrepo", "test/vault"); await page.fill("#ghpath", "CCNA"); await act('[data-act="ghimport"]');
  await page.waitForFunction(() => customQs.some(q => /нормальних VLAN/.test(q.q || "")), null, { timeout: 4000 });
  await page.unroute(/api\.github\.com|raw\.githubusercontent\.com/); await home(); });
await step("моніторинг помилок: запис і показ у «На виправлення»", async () => {
  await page.evaluate(() => { ERRMON.capture({ message: "TypeError: x is undefined", src: location.origin + "/app-quiz.js", line: 42, col: 9, stack: "at f (app-quiz.js:42:9)" }); view = "issues"; render(); });
  await has("Помилки в роботі тренажера"); await has("x is undefined"); await page.evaluate(() => ERRMON.clear()); await home(); });
await step("кожна лаба є в списку лаб", async () => {
  const miss = await page.evaluate(() => { view = "labs"; render(); const have = new Set([...document.querySelectorAll('[data-act="lab"]')].map(b => b.dataset.id)); return ALLSCEN().filter(s => !s.sb && !have.has(s.id)).map(s => s.id); });
  if (miss.length) throw new Error("немає в списку: " + miss.join(", ")); await home(); });
await step("налаштування", async () => { await page.evaluate(() => { view = "settings"; render(); }); await has("Норма часу"); await home(); });

for (const extra of (globalThis.SMOKE_EXTRA || [])) await step(extra.name, () => extra.fn({ page, act, home, has }));

await browser.close(); server.close();
console.log(fails ? `\n❌ Smoke: ${fails}/${n} кроків з помилками` : `\n✅ Smoke: усі ${n} кроків пройдено`);
process.exit(fails ? 1 : 0);
