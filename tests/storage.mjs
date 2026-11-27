// Інтеграційний тест сховища: міграція денних записів зі старого поля progress/state.daily
// в окремі документи users/{uid}/daily/{YYYY-MM}. Firebase підмінено моками з tests/firebase-mock/.
// Запуск: node tests/storage.mjs (потрібен Playwright, як і для smoke.mjs).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.join(HERE, "..", "public"); const MOCK = path.join(HERE, "firebase-mock");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, "http://x").pathname); const f = path.join(ROOT, u === "/" ? "index.html" : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r)); const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] } : {});
const ctx = await browser.newContext(); const page = await ctx.newPage(); const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.route(/gstatic\.com\/firebasejs\/[^/]+\/(firebase-[a-z]+\.js)/, r => { const name = r.request().url().split("/").pop(); const f = path.join(MOCK, name);
  if (!fs.existsSync(f)) return r.abort(); r.fulfill({ status: 200, headers: { "content-type": "text/javascript", "access-control-allow-origin": "*" }, body: fs.readFileSync(f, "utf8") }); });
await page.route(/googleapis\.com|accounts\.google/, r => r.abort());
const SEED = { "users/u1/progress/state": { q: { "e1-1": { s: 1, c: 1, w: 0, b: 1, d: 0, l: 1700000000000, k: 1 } }, daily: { "2026-10-05": { n: 30, c: 25 }, "2026-11-20": { n: 12, c: 10, note: "old note", jts: 1 } }, flags: {}, labs: {}, updated: 1 } };
await page.addInitScript(seed => { if (!localStorage.getItem("__mockfs")) localStorage.setItem("__mockfs", seed); }, JSON.stringify(SEED));

let fails = 0; const ok = (c, m) => { if (c) console.log("✓ " + m); else { fails++; console.error("✗ " + m); } };
const ready = async () => { await page.waitForFunction(() => typeof store !== "undefined" && store.mode === "db", null, { timeout: 8000 }); await page.waitForTimeout(150); };
const fsData = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__FS)));

await page.goto(BASE + "index.html"); await ready();
let db = await fsData(); const today = await page.evaluate(() => dkey()); const tm = today.slice(0, 7);
ok(db["users/u1/daily/2026-10"] && db["users/u1/daily/2026-10"].days["2026-10-05"].n === 30, "жовтневий запис перенесено в daily/2026-10");
ok(db["users/u1/daily/2026-11"] && db["users/u1/daily/2026-11"].days["2026-11-20"].note === "old note", "листопадовий чек-ін перенесено в daily/2026-11");
ok(!("daily" in db["users/u1/progress/state"]) && db["users/u1/progress/state"].dailyV === 2, "старе поле daily прибрано з progress/state");
ok(await page.evaluate(() => daily["2026-10-05"].n === 30 && daily["2026-11-20"].note === "old note"), "у застосунку видно всі старі дні");

await page.evaluate(() => record("e1-2", true)); await page.waitForTimeout(150);
db = await fsData(); ok((db["users/u1/daily/" + tm] || { days: {} }).days[today] && db["users/u1/daily/" + tm].days[today].n >= 1, "нова відповідь записалась у місячний документ");
ok(!("daily" in db["users/u1/progress/state"]) && db["users/u1/progress/state"].q["e1-2"], "прогрес питань лишився в progress/state, daily туди не пишеться");

await page.evaluate(() => setDay(dkey(), { log: [{ ts: 1, min: 40, k: "pt", note: "lab" }] })); await page.waitForTimeout(150);
db = await fsData(); ok(db["users/u1/daily/" + tm].days[today].log[0].min === 40 && db["users/u1/daily/" + tm].days[today].n >= 1, "журнал часу додано без втрати лічильника відповідей");

// Старий клієнт (ще не оновив кеш) пише daily у спільний документ — новий має перенести й прибрати поле.
await page.evaluate(t => __mock.updateDoc(__mock.doc(null, "users", "u1", "progress", "state"), { daily: { [t]: { n: 50, c: 40 } } }), today); await page.waitForTimeout(400);
db = await fsData(); ok(!("daily" in db["users/u1/progress/state"]), "запис старого клієнта перенесено, поле знову прибрано");
ok(db["users/u1/daily/" + tm].days[today].n === 50 && db["users/u1/daily/" + tm].days[today].log.length === 1, "дані старого клієнта злито з новими (n=50, журнал на місці)");

await page.reload(); await ready();
ok(await page.evaluate(t => daily["2026-10-05"].n === 30 && daily[t].n === 50 && daily[t].log.length === 1, today), "після перезавантаження всі дні на місці");
db = await fsData(); ok(!("daily" in db["users/u1/progress/state"]), "повторне підключення не повертає поле daily");
ok(errors.length === 0, "без помилок JS" + (errors.length ? ": " + errors.join("; ") : ""));

await browser.close(); server.close();
console.log(fails ? `\n❌ Сховище: помилок ${fails}` : "\n✅ Сховище: міграція і синхронізація працюють");
process.exit(fails ? 1 : 0);
