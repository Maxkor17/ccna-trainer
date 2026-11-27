// Service worker: тренажер повністю працює офлайн.
// Оболонка й банки питань — network-first з тайм-аутом 3 с (свіжа версія онлайн, миттєво з кешу при поганому зв'язку).
// Firebase SDK з gstatic кешується окремо, тож Firestore стартує офлайн зі своєю локальною базою й синхронізується пізніше.
// Під час кожного деплою CACHE оновлюється автоматично (див. .github/workflows/deploy.yml).
const CACHE = "ccna-__BUILD__";
const SDK = "ccna-firebase-sdk-v1";
const FILES = ["./","index.html","app-core.js","app-quiz.js","app-screens.js","app-tools.js","app-journal.js","app-extras.js","app-stp.js","app-main.js","app.css","firebase-config.js","questions-itn.js","questions-srwe.js","questions-notes.js","questions-extra.js","questions-netacad.js","questions-srwe2.js","questions-ensa.js","questions-figs.js","gen.js","gen2.js","gen3.js","cheats.js","pairs.js","glossary.js","questions-en.js","api.js","wlc.js","bash.js","questions-linux.js","tr-itn.js","tr-srwe.js","tr-srwe2.js","tr-ensa.js","tr-netacad.js","tr-figs.js","tr-notes.js","tr-extra.js","cli.js","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== SDK).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const timeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("timeout")), ms); p.then(v => { clearTimeout(t); res(v); }, err => { clearTimeout(t); rej(err); }); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.hostname === "www.gstatic.com" && u.pathname.startsWith("/firebasejs/")) { // версійовані файли SDK — cache-first
    e.respondWith(caches.open(SDK).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (u.origin !== location.origin) return; // Firestore/Auth — напряму (у них власний офлайн-режим)
  const net = fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; });
  e.respondWith(timeout(net, 3000).catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || net.catch(() => caches.match("index.html")))));
});
// Push-сповіщення (FCM): показуємо самі, бо SDK Firebase у service worker не підключено.
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { notification: { body: e.data && e.data.text() } }; }
  const n = d.notification || {}, extra = d.data || {};
  e.waitUntil(self.registration.showNotification(n.title || extra.title || "CCNA тренажер", { body: n.body || extra.body || "Час повторити питання", icon: "icon-192.png", badge: "icon-192.png", tag: "ccna-daily", data: { url: extra.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close(); const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => { for (const w of ws) if (w.url.startsWith(self.registration.scope)) { w.focus(); return w.navigate(url); } return clients.openWindow(url); }));
});
