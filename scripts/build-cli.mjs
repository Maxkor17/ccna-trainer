// Збирає public/cli.js із фрагментів src/cli/*.js (у порядку назв файлів).
// Фрагменти — частини одного IIFE: окремо вони не є валідним JS, перевіряється лише зібраний файл.
// node scripts/build-cli.mjs          — зібрати
// node scripts/build-cli.mjs --check  — перевірити, що public/cli.js відповідає фрагментам (для CI)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(ROOT, "src", "cli"), out = path.join(ROOT, "public", "cli.js");
const files = fs.readdirSync(dir).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
const built = files.map(f => fs.readFileSync(path.join(dir, f), "utf8")).join("");
if (process.argv.includes("--check")) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  if (cur !== built) { console.error("✗ public/cli.js не відповідає src/cli/*.js — виконайте: node scripts/build-cli.mjs"); process.exit(1); }
  console.log("✓ public/cli.js зібрано з " + files.length + " фрагментів"); process.exit(0);
}
fs.writeFileSync(out, built); console.log("public/cli.js ← " + files.length + " фрагментів, " + built.split("\n").length + " рядків");
