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
  await act('[data-act="train"]'); await page.waitForSelector('[data-act="pick"], #cmdin, .fillin, [data-act="flashshow"], [data-act="catpick"], [data-act="ord"], [data-act="match"], [data-act="spick"], #tin', { timeout: 3000 });
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
  await page.evaluate(() => { view = "home"; render(); }); await act('[data-act="ccna"][data-n="40"][data-en="1"]'); await page.waitForFunction(() => typeof S !== "undefined" && S && S.en, null, { timeout: 8000 });
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
await step("невідома мережа: CDP відкриває сусідів, карта перевіряється", async () => {
  await page.evaluate(() => { view = "labs"; render(); }); await act('[data-act="lab"][data-id="net-discover"]');
  const n0 = await page.locator('[data-act="labdev"]').count(); if (n0 !== 1) throw new Error("на старті видно вкладок: " + n0);
  await page.fill("#tin", "enable"); await page.press("#tin", "Enter"); await page.fill("#tin", "show cdp neighbors"); await page.press("#tin", "Enter"); await page.waitForTimeout(100);
  const n1 = await page.locator('[data-act="labdev"]').count(); if (n1 < 2) throw new Error("CDP не відкрив сусідів");
  await page.evaluate(() => { document.querySelector("#dmap").value = CLI.discoverTruth(LAB.N).text; }); await act('[data-act="labcheck"]');
  const bad = await page.evaluate(() => [...document.querySelectorAll("#labres li")].filter(li => li.textContent.startsWith("❌")).length); if (bad) throw new Error("правильна карта не зарахована"); await home(); });
await step("debug: OSPF-сусідство і DHCP у консолі", async () => {
  const r = await page.evaluate(() => { const sc = CLI.NETSCEN.find(s => s.id === "net-debug"); const { N, ses } = CLI.startNet(sc); ses.R1.exec("enable"); ses.R1.exec("debug ip ospf adj"); const m = N.recompute().map(x => x[1]).join("\n"); return m; });
  if (!/Mismatched hello/.test(r)) throw new Error("немає Mismatched hello: " + r.slice(0, 200)); });
await step("перетягни в категорію: тап і drag-and-drop, перевірка", async () => {
  await page.evaluate(() => { startSession("train", [QMAP["dd-ec"]], "DnD"); });
  const items = await page.evaluate(() => QMAP["dd-ec"].items.map(x => x[1]));
  const first = await page.evaluate(() => S.order[0][0]);
  await page.locator(`[data-act="catpick"][data-i="${first}"]`).dragTo(page.locator(`[data-catdrop="${items[first]}"]`).first());
  for (let i = 0; i < items.length; i++) { if (await page.evaluate(i => (S.ans[0] || [])[i] != null, i)) continue; await act(`[data-act="catpick"][data-i="${i}"]`); const sel = await page.evaluate(() => S.catSel); await act(`[data-act="catdrop"][data-c="${items[i]}"]`); if (sel !== i) throw new Error("catSel=" + sel + " i=" + i + " view=" + await page.evaluate(() => view)); if (await page.evaluate(i => (S.ans[0] || [])[i] == null, i)) throw new Error("drop не спрацював для " + i + ": " + await page.evaluate(c => { const b = document.querySelector(`[data-catdrop="${c}"]`); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e.outerHTML.slice(0, 150) + " | sel=" + S.catSel; }, items[i])); }
  const ok = await page.evaluate(() => isCorrect(S.items[0], S.ans[0])); if (!ok) throw new Error("відповідь не зарахована: " + JSON.stringify(await page.evaluate(() => S.ans[0])));
  await page.evaluate(() => doCheck()); await has("✅"); await home(); });
await step("картки команд: команда з лаби → картка → повторення", async () => {
  await page.evaluate(() => { view = "labs"; render(); }); await act('[data-act="lab"][data-id="lab-vlan"]');
  for (const c of ["enable", "conf t", "vlan 10", "name USERS", "interface fa0/1", "sw mo acc", "sw acc vl 10"]) { await page.fill("#tin", c); await page.press("#tin", "Enter"); }
  const n = await page.evaluate(() => ccAll().length); if (n < 3) throw new Error("карток: " + n);
  await page.evaluate(() => { opts.homeTab = "prac"; view = "home"; render(); }); await has("Картки команд"); await act('[data-act="ccrun"]'); await has("Команда з ваших лаб");
  const q = await page.evaluate(() => S.items.find(x => /access vlan/.test(x.ans[0]))); if (!q || q.ans[0] !== "switchport access vlan 10") throw new Error("немає картки access vlan: " + JSON.stringify(q));
  await page.evaluate(() => { opts.homeTab = "all"; }); await home(); });
await step("запис у vault через GitHub API (мок)", async () => {
  const puts = [];
  await page.route(/api\.github\.com/, async r => { const u = r.request().url(), m = r.request().method();
    if (/\/repos\/[^/]+\/[^/]+$/.test(u)) return r.fulfill({ contentType: "application/json", body: JSON.stringify({ default_branch: "main" }) });
    if (m === "GET") return r.fulfill({ status: 404, body: "{}" });
    if (m === "PUT") { const b = JSON.parse(r.request().postData()); puts.push({ path: decodeURIComponent(u.split("/contents/")[1]), text: Buffer.from(b.content, "base64").toString("utf8"), branch: b.branch, auth: r.request().headers().authorization }); return r.fulfill({ status: 201, contentType: "application/json", body: "{}" }); }
    return r.fulfill({ status: 404, body: "" }); });
  await page.evaluate(() => { localStorage.setItem("ccna.ghtoken", "test-token"); opts.obRepo = "test/vault"; opts.obBranch = ""; prog["e1-2"] = Object.assign({}, prog["e1-2"] || {}, { w: 2, c: 0, s: 2, b: 0, d: 0, l: 0, k: 0 }); view = "custom"; render(); });
  await page.evaluate(() => pushVault(false)); await page.waitForFunction(() => /Записано|актуально|Помилка/.test((document.querySelector("#obmsg") || {}).textContent || ""), null, { timeout: 5000 });
  const msg = await page.evaluate(() => document.querySelector("#obmsg").textContent); if (!/Записано/.test(msg)) throw new Error(msg);
  const mod = puts.find(p => /\/Помилки\/.+\.md$/.test(p.path)); const moc = puts.find(p => /SRWE — готовність\.md$/.test(p.path));
  if (!mod || !/## Картки/.test(mod.text) || !/#flashcards\/(ITN|SRWE|ENSA)/.test(mod.text) || !moc || !/\| Модуль \|/.test(moc.text)) throw new Error("нотатки модулів/MOC: " + JSON.stringify(puts.map(p => p.path)));
  if (puts.length < 5 || !puts.some(p => /Картки з помилок\.md$/.test(p.path) && /::/.test(p.text)) || !puts.every(p => p.branch === "main" && p.auth === "Bearer test-token")) throw new Error(JSON.stringify(puts.map(p => p.path)));
  await page.unroute(/api\.github\.com/); await page.evaluate(() => { localStorage.removeItem("ccna.ghtoken"); delete opts.obRepo; }); await home(); });
await step("аудіорежим: озвучення питання, відповідь, пояснення", async () => {
  await page.evaluate(() => { window.__said = []; const fake = { getVoices: () => [], cancel() {}, speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 5); }, onvoiceschanged: null };
    Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true }); window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    localStorage.setItem("ccna.audio", JSON.stringify({ rate: 1, auto: false })); opts.homeTab = "prac"; view = "home"; render(); });
  await act('[data-act="audstart"]'); await page.waitForTimeout(150);
  const q = await page.evaluate(() => ({ q: AUD.items[0].q, a: AUD.items[0].a[0], said: window.__said.join(" | ") }));
  if (!q.said.includes(q.q.slice(0, 20).replace(/\s+/g, " "))) throw new Error("питання не озвучено: " + q.said.slice(0, 200));
  await act(`[data-act="audpick"][data-k="${q.a}"]`); await page.waitForTimeout(100);
  const after = await page.evaluate(() => ({ said: window.__said.slice(-2).join(" "), ok: AUD.ok, phase: AUD.phase })); if (after.ok !== 1 || !/Правильно|Correct/.test(after.said)) throw new Error(JSON.stringify(after));
  await act('[data-act="audnext"]'); await act('[data-act="audstop"]'); await page.evaluate(() => { opts.homeTab = "all"; }); });
await step("Python-лаба (Pyodide): Netmiko, NAPALM, RESTCONF, NETCONF", async () => {
  const PYD = path.join(path.dirname(fileURLToPath(import.meta.url)), "node_modules", "pyodide");
  await page.route(/cdn\.jsdelivr\.net\/npm\/pyodide@/, r => { const f = path.join(PYD, new URL(r.request().url()).pathname.split("/").pop()); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
    const ct = f.endsWith(".wasm") ? "application/wasm" : /\.m?js$/.test(f) ? "text/javascript" : f.endsWith(".json") ? "application/json" : "application/octet-stream"; return r.fulfill({ status: 200, contentType: ct, headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync(f) }); });
  await page.evaluate(() => { view = "labs"; render(); }); await act('[data-act="pylab"]'); await has("script.py");
  await page.evaluate(() => { document.querySelector("#pysrc").value = `from netmiko import ConnectHandler
from napalm import get_network_driver
import requests
for ip in ["10.0.0.1","10.0.0.11","10.0.0.12"]:
    with ConnectHandler(device_type="cisco_ios", host=ip, username="admin", password="Cisco123!") as c:
        print(c.find_prompt())
d = get_network_driver("ios")("10.0.0.1","admin","Cisco123!"); d.open(); d.load_merge_candidate(config="ntp server 10.1.1.123"); print(d.compare_config()); d.commit_config()
r = requests.get("https://10.0.0.1/restconf/data/ietf-interfaces:interfaces", headers={"Accept":"application/yang-data+json"}, auth=("admin","Cisco123!"))
print("REST", r.status_code)`; });
  await act('[data-act="pyrun"]'); await page.waitForFunction(() => PYL && !PYL.busy && PYL.out, null, { timeout: 90000 });
  const out = await page.evaluate(() => PYL.out); if (!/R1#[\s\S]*S2#[\s\S]*\+ntp server 10\.1\.1\.123[\s\S]*REST 200/.test(out)) throw new Error(out.slice(0, 400));
  const done = await page.evaluate(() => PYLAB.TASKS.filter(t => t.ok(PYL.lab)).map(t => t.id)); if (!done.includes("loop") || !done.includes("napalm") || !done.includes("rget")) throw new Error("завдання: " + done);
  await page.unroute(/cdn\.jsdelivr\.net\/npm\/pyodide@/); await home(); });
await step("поширення пісочниці посиланням: упакування → відкриття", async () => {
  page.once("dialog", d => d.accept());
  const r = await page.evaluate(async () => { const d = { devs: { R1: { type: "router" }, S1: { type: "switch" }, PC1: { type: "pc", ip: "192.168.1.10", mask: "255.255.255.0", gw: "192.168.1.1" } }, links: [["R1", "Gi0/0", "S1", "Gi0/1"], ["PC1", "Fa0", "S1", "Fa0/1"]] };
    const code = await packSb(d); history.replaceState(null, "", location.pathname + "#sb=" + code); await sbOpenShared(); await new Promise(r => setTimeout(r, 100));
    return { len: code.length, view, devs: LAB && LAB.N ? Object.keys(LAB.N.dev).sort().join(",") : "" }; });
  if (r.view !== "lab" || r.devs !== "PC1,R1,S1") throw new Error(JSON.stringify(r)); await home(); });
await step("співбесіда: питання, диктування, автопозначки, повторення", async () => {
  await page.evaluate(() => { class FakeRec { start() { setTimeout(() => { this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "ну VLAN ділить мережу на широкомовні домени, між комутаторами trunk 802.1Q з тегом, native VLAN без тегу, а між VLAN маршрутизація через SVI" }], { isFinal: true })] }); }, 10); } stop() { setTimeout(() => this.onend && this.onend(), 5); } }
    window.SpeechRecognition = FakeRec; localStorage.setItem("ccna.iv", JSON.stringify({ cats: ["net"], lvl: 1, n: 2, en: false })); opts.homeTab = "prac"; view = "home"; render(); });
  await has("Технічна співбесіда"); await act('[data-act="interview"]'); await has("Співбесіди-ситуації");
  await page.evaluate(() => { ivStart("q"); IV.items[0] = INTERVIEW.Q.find(q => q.id === "n-vlan"); render(); });
  await act('[data-act="ivmic"]'); await page.waitForTimeout(80); await act('[data-act="ivmic"]'); await page.waitForTimeout(40);
  const v = await page.$eval("#ivans", e => e.value); if (!/trunk/.test(v)) throw new Error("диктування не потрапило в поле: " + v);
  await act('[data-act="ivdone"]'); await has("Еталонна відповідь"); await has("слів-паразитів");
  const c = await page.evaluate(() => IV.checks.filter(Boolean).length); if (c < 4) throw new Error("автопозначок замало: " + c);
  await page.locator('[data-act="ivchk"]:not(:checked)').first().click(); await act('[data-act="ivnext"]');
  await page.evaluate(() => { IV.ans = ""; }); await act('[data-act="ivdone"]'); await act('[data-act="ivnext"]'); await has("Підсумок співбесіди");
  const r = await page.evaluate(() => [prog["iv:n-vlan"] && prog["iv:n-vlan"].c, ivDue().length]); if (r[0] !== 1) throw new Error("SR: " + JSON.stringify(r));
  await act('[data-act="ivquit"]'); await act('[data-act="ivsc"][data-id="sc-dhcp"]'); await has("Інтерв'юер"); await act('[data-act="ivdone"]'); await has("Що відповідає інтерв'юер"); await has("169.254.12.7");
  await act('[data-act="ivnext"]'); await has("2/3"); await page.evaluate(() => { IV = null; opts.homeTab = "all"; }); await home(); });
await step("перехід на v2.0: що змінюється, симуляція потрібної версії", async () => {
  await page.evaluate(() => { opts.homeTab = "prac"; view = "home"; render(); }); await act('[data-act="bpdiff"]'); await has("Нове у v2.0"); await has("OSPFv3"); await has("Немає у списку тем v2.0");
  const pbp = await page.evaluate(() => opts.bp); await act('[data-act="ccna"][data-n="40"][data-bp="v2.0"]'); const r = await page.evaluate(() => [S && S.bp, S && S.items.length, opts.bp]);
  if (r[0] !== "v2.0" || r[1] !== 40 || r[2] !== pbp) throw new Error(JSON.stringify(r)); await page.evaluate(() => { S = null; opts.homeTab = "all"; }); await home(); });
await step("фінішний тиждень: план за датою, позначки, чек-лист", async () => {
  await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 6); opts.examDate = dkey(d); exams.unshift({ ts: Date.now(), n: 120, correct: 100, pct: 83, dur: 6600, per: {}, ccna: true, bp: bpVer(), en: true }); view = "home"; opts.homeTab = "today"; render(); });
  await has("Фінішний тиждень"); await act('[data-act="final"]'); await has("Чек-лист готовності"); await has("День іспиту"); await has("Логістика"); await has("Темп ≤ 60 с");
  const p = await page.evaluate(() => { const p = fwPlan(); return [p.items.length, p.items[0].k, p.items.filter(x => x.tasks.some(t => t[0] === "mock")).length]; }); if (p[0] !== 7 || p[1] !== 6 || p[2] < 2) throw new Error(JSON.stringify(p));
  const cb = page.locator('[data-act="fwdone"]:not([disabled])').first(); await cb.click(); await page.waitForTimeout(60);
  const f = await page.evaluate(() => Object.entries(flags).filter(([k, v]) => k.startsWith("fw:") && v.done).length); if (f < 1) throw new Error("позначка дня не збереглася");
  await page.evaluate(() => { exams.shift(); opts.examDate = ""; opts.homeTab = "all"; }); await home(); });
await step("SRWE руками: читання виводів, знайди помилку, плитки", async () => {
  await page.evaluate(() => { opts.homeTab = "prac"; view = "home"; render(); }); await act('[data-act="showread"]'); await has("Читання виводів");
  await page.locator('.shl[data-act="shline"]').first().click(); if (!(await page.locator(".shn").count())) throw new Error("пояснення рядка не з'явилось");
  const a = await page.evaluate(() => SHV.it.a); await act(`[data-act="shpick"][data-i="${a}"]`); await has("Правильно!"); await act('[data-act="shnext"]');
  await page.evaluate(() => ACTS.bugs()); const bl = await page.evaluate(() => BGV.bugs.map(b => b[0])); for (const i of bl) await act(`[data-act="bgpick"][data-i="${i}"]`); await act('[data-act="bgcheck"]'); await has("Має бути");
  await page.evaluate(() => ACTS.cbuild()); const toks = await page.evaluate(() => CBV.it.ans.split(" ")); for (const t of toks) { const i = await page.evaluate(t => CBV.tiles.find(x => x.t === t && !CBV.line.includes(x.i)).i, t); await act(`[data-act="cbadd"][data-i="${i}"]`); } await act('[data-act="cbcheck"]'); await has("Правильно!");
  const r = await page.evaluate(() => [Object.keys(prog).some(k => k.startsWith("sh-")), Object.keys(prog).some(k => k.startsWith("bg-")), !!prog["cb-" + CBV.it.id]]); if (r.some(x => !x)) throw new Error("SR не записано: " + r); await page.evaluate(() => { opts.homeTab = "all"; }); await home(); });
await step("STP передбач зміну й EtherChannel: таблиця режимів", async () => {
  await page.evaluate(() => ACTS.stpviz()); await act('[data-act="stpmode"][data-m="predict"]'); await has("До зміни"); await act('[data-act="stpcheck"]');
  await page.evaluate(() => ACTS.eclab()); const cells = await page.locator('[data-act="ecpick"]').count(); if (cells !== 25) throw new Error("клітинок " + cells);
  await act('[data-act="ecmis"][data-k="native"]'); await has("suspended"); await act('[data-act="ecquiz"]'); await act('[data-act="ecans"]'); await home(); });
await step("аналізатор і генератор конфігурацій", async () => {
  await page.evaluate(() => ACTS.confcheck()); await act('[data-act="ccsample"]'); await act('[data-act="ccrun2"]'); await has("різні області"); await has("Захищеність");
  await page.evaluate(() => ACTS.confgen()); await act('[data-act="cgrole"][data-r="router"]'); await act('[data-act="cggen"]'); await has("encapsulation dot1Q 10"); await has("ip nat inside source list NAT-INSIDE");
  await page.fill("#cgold", "hostname R1\nip http server\n"); await act('[data-act="cgdiff"]'); await has("Лише в старій"); await home(); });
await step("трекер модулів, Packet Tracer, довідник, діагностика, пастки", async () => {
  await page.evaluate(() => ACTS.modtrack()); await act('[data-act="mdopen"][data-t="SRWE3"]'); await act('[data-act="mdread"][data-t="SRWE3"]'); await page.fill("#mdex-SRWE3", "90"); await act('[data-act="mdexam"][data-t="SRWE3"]');
  const f = await page.evaluate(() => flags["md:SRWE3"]); if (!f || !f.read || f.exam !== 90 || f.on !== false) throw new Error(JSON.stringify(f));
  await act('[data-act="ptopen"][data-p="trunk"]'); await has("Configure Trunks"); await page.fill("#pttext", "hostname S1\ninterface gi0/1\n switchport mode trunk\n switchport trunk native vlan 99\n"); await act('[data-act="ptcheck"]'); await has("Що вимагає активність");
  await page.evaluate(() => ACTS.ref()); await has("LACP (Link Aggregation Control Protocol)"); await page.evaluate(() => ACTS.runbook()); await act('[data-act="rbopen"][data-k="err"]'); await act('[data-act="rbgo"]'); await has("Рішення");
  await page.evaluate(() => ACTS.traps()); await has("Пастки й час"); await home(); });
await step("перша спроба без варіантів і підсвітка пасток", async () => {
  await page.evaluate(() => { opts.blind = true; const q = QB.find(q => qtype(q) === "mc" && /\bNOT\b|НЕ/.test(q.q)); startSession("train", [q], "t"); render(); });
  if (!(await page.locator("#blindin").count())) throw new Error("немає поля першої спроби"); if (!(await page.locator("mark.trap").count())) throw new Error("пастку не підсвічено");
  await page.fill("#blindin", "моя версія"); await act('[data-act="blindshow"]'); if (!(await page.locator('[data-act="pick"]').count())) throw new Error("варіанти не показано"); await has("Ваша відповідь: моя версія");
  await page.evaluate(() => { opts.blind = false; S = null; }); await home(); });
await step("пакет покроково: сценарій з поломкою", async () => {
  await page.evaluate(() => ACTS.packet()); await act('[data-act="pwscn"][data-k="inter"]'); await act('[data-act="pwfault"][data-k="acl"]');
  for (let i = 0; i < 10; i++) { const a = await page.evaluate(() => PWV.steps[PWV.i].q.a); await act(`[data-act="pwans"][data-i="${a}"]`); if (!(await page.locator('[data-act="pwnext"]').count())) break; await act('[data-act="pwnext"]'); }
  await has("Пакет загубився тут"); await has("Destination net unreachable"); await home(); });
await step("Skills Assessment: завдання, еталон → 100%, історія", async () => {
  await page.evaluate(() => { lsSet(SA_CUR, null); ACTS.sa(); }); await act('[data-act="sanew"]'); await has("Таблиця адрес");
  const t = await page.evaluate(() => { const c = lsGet(SA_CUR, null); const P = saGen(c.seed); const S = saSolution(P); return ["R1", "S1", "S2"].map(h => "Building configuration...\n" + S[h].join("\n") + (h !== "R1" ? "\n" + h + "#show vlan brief\n" + saVlanBrief(P) : "")).join("\n"); });
  await page.fill("#satext", t); await act('[data-act="sacheck"]'); await has("(100%)"); await act('[data-act="safinish"]'); const h = await page.evaluate(() => lsGet(SA_HIST, [])); if (!h.length || h[0].pct !== 100) throw new Error(JSON.stringify(h)); await home(); });
await step("VLSM → генератор, документація мережі, поясни вголос", async () => {
  await page.evaluate(() => ACTS.vlsm()); await act('[data-act="vlrun"]'); await has("192.168.0.0/24"); await act('[data-act="vltogen"]'); await act('[data-act="cggen"]'); await has("ip dhcp pool USERS");
  await page.evaluate(() => ACTS.netdoc()); await act('[data-act="ndsample"]'); await has("SEP001122334455");
  await page.evaluate(() => ivStart("feyn", "SRWE5")); await has("Поясни тему SRWE"); await page.evaluate(() => { IV = null; }); await home(); });
await step("челенджі: тиждень, посилання з результатом друга", async () => {
  await page.evaluate(() => ACTS.challenge()); await act('[data-act="chweek"]'); const n = await page.evaluate(() => S && S.challenge && S.items.length); if (n !== 15) throw new Error("питань " + n);
  await page.evaluate(() => finishExam()); await has("Ваш результат");
  const link = await page.evaluate(async () => { const ch = Object.assign({}, CHV.ch); delete ch.week; return await chLink("chr", { ch, r: { name: "Друг", correct: 15, n: 15, dur: 300, bits: "1".repeat(15) } }); });
  await page.goto(link); await page.waitForFunction(() => typeof view !== "undefined" && view === "challenge" && CHV && CHV.mode === "cmp", null, { timeout: 5000 }); await has("За питаннями"); await has("Друг попереду");
  const wk = await page.evaluate(() => lsGet(CH_WK, {})[chWeekKey()]); if (!wk || wk.tries < 1) throw new Error("рекорд тижня не записано"); await home(); });
await step("налаштування", async () => { await page.evaluate(() => { view = "settings"; render(); }); await has("Норма часу"); await home(); });

for (const extra of (globalThis.SMOKE_EXTRA || [])) await step(extra.name, () => extra.fn({ page, act, home, has }));

await browser.close(); server.close();
console.log(fails ? `\n❌ Smoke: ${fails}/${n} кроків з помилками` : `\n✅ Smoke: усі ${n} кроків пройдено`);
process.exit(fails ? 1 : 0);
