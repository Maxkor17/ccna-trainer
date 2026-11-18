// Щогодини (GitHub Actions): для кожного пристрою з увімкненим push перевіряє денну норму і надсилає нагадування.
import admin from "firebase-admin";
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!sa.project_id) { console.log("FIREBASE_SERVICE_ACCOUNT не задано — пропускаю"); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore(), fcm = admin.messaging();
const SITE = "https://maxkor17.github.io/ccna-trainer/";
const local = (tz, d = new Date()) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map(x => [x.type, x.value])); return { key: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) }; };
const force = process.env.FORCE === "1";
const snap = await db.collectionGroup("push").get(); let sent = 0, skipped = 0, removed = 0;
for (const doc of snap.docs) {
  const p = doc.data(); const uid = doc.ref.parent.parent.id; const tz = p.tz || "Europe/Kyiv"; const now = local(tz);
  if (!force && now.hour !== p.hour) { skipped++; continue; }
  if (!force && p.lastSent === now.key) { skipped++; continue; }
  const st = (await db.doc(`users/${uid}/progress/state`).get()).data() || {};
  const daily = st.daily || {}; const goal = p.goal || 20; const today = (daily[now.key] || {}).n || 0;
  if (today >= goal && !force) { await doc.ref.update({ lastSent: now.key }); skipped++; continue; }
  let streak = 0; const d = new Date(); for (let i = 1; i < 400; i++) { d.setDate(d.getDate() - 1); const k = local(tz, d).key; if (((daily[k] || {}).n || 0) >= goal) streak++; else break; }
  const due = Object.values(st.q || {}).filter(r => r && r.d && r.d <= Date.now()).length;
  const left = Math.max(0, goal - today);
  const title = streak >= 2 ? `🔥 Серія ${streak} дн. під загрозою` : "📚 CCNA: час для навчання";
  const body = `Сьогодні ${today}/${goal} — ще ${left} до норми.` + (due ? ` До повторення: ${due}.` : "") + " 10 хвилин вистачить.";
  try {
    await fcm.send({ token: p.token, notification: { title, body }, data: { url: SITE, title, body }, webpush: { fcmOptions: { link: SITE }, notification: { icon: SITE + "icon-192.png", tag: "ccna-daily" } } });
    await doc.ref.update({ lastSent: now.key }); sent++;
  } catch (e) {
    const code = e.errorInfo && e.errorInfo.code; console.log("помилка", code || e.message);
    if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code || "")) { await doc.ref.delete(); removed++; }
  }
}
console.log(`Пристроїв: ${snap.size}, надіслано: ${sent}, пропущено: ${skipped}, видалено недійсних: ${removed}`);
