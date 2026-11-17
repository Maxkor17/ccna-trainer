// Service worker: кешує оболонку додатка, щоб тренажер відкривався офлайн.
// Під час кожного деплою CACHE оновлюється автоматично (див. .github/workflows/deploy.yml).
const CACHE = "ccna-__BUILD__";
const FILES = ["./","index.html","firebase-config.js","questions-itn.js","questions-srwe.js","questions-notes.js","questions-extra.js","questions-netacad.js","gen.js","cli.js","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Firebase та CDN — напряму
  // network-first: свіжа версія, якщо є інтернет; кеш — офлайн
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
