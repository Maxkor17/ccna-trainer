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
await step("налаштування", async () => { await page.evaluate(() => { view = "settings"; render(); }); await has("Норма часу"); await home(); });

for (const extra of (globalThis.SMOKE_EXTRA || [])) await step(extra.name, () => extra.fn({ page, act, home, has }));

await browser.close(); server.close();
console.log(fails ? `\n❌ Smoke: ${fails}/${n} кроків з помилками` : `\n✅ Smoke: усі ${n} кроків пройдено`);
process.exit(fails ? 1 : 0);
