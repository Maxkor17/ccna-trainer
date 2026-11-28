"use strict";
// Завантаження рідко потрібних модулів на вимогу: головний екран стартує швидше, а інструменти підтягуються при першому відкритті.
// Файли все одно кешує service worker, тож офлайн усе працює.
const LAZY = {
  iv: ["interview-data.js", "interview-data2.js", "interview-srwe.js", "app-interview.js"],
  tools: ["app-confcheck.js", "app-confgen.js", "app-srwe.js", "app-ref.js", "app-examstats.js", "app-vlsm.js", "app-netdoc.js", "app-sa.js", "app-acl.js", "app-forecast.js", "app-gapmap.js"],
  practice: ["app-drills.js", "app-ec.js", "app-packet.js", "app-logs.js", "app-pcap.js", "app-english.js", "app-shift.js"] };
const LAZY_ACTS = { iv: ["interview", "feyn", "ivgo", "ivdue", "ivsc"], tools: ["confcheck", "confgen", "vlsm", "netdoc", "modtrack", "ptguide", "ptopen", "ref", "refopen", "runbook", "rbopen", "sa", "acl", "traps", "blindtoggle", "readiness", "icsview", "gapmap"], practice: ["bugs", "cbuild", "eclab", "packet", "logs", "pcap", "english", "shift"] };
const lazyP = {};
function loadLazy(g) { if (g === "all") return Promise.all(Object.keys(LAZY).map(loadLazy)); if (lazyP[g]) return lazyP[g];
  const one = f => new Promise((res, rej) => { if (document.querySelector('script[data-lazy="' + f + '"]')) return res(); const s = document.createElement("script"); s.src = f; s.async = false; s.dataset.lazy = f; s.onload = res; s.onerror = () => rej(new Error("не завантажено " + f)); document.head.appendChild(s); });
  lazyP[g] = LAZY[g].reduce((p, f) => p.then(() => one(f)), Promise.resolve()); lazyP[g].catch(() => { delete lazyP[g]; }); return lazyP[g]; }
for (const [g, acts] of Object.entries(LAZY_ACTS)) for (const a of acts) if (!ACTS[a]) { const stub = (el, ev) => { if (el && el.dataset) el.dataset.busy = "1"; loadLazy(g).then(() => { const f = ACTS[a]; if (f && !f._stub) f(el, ev); }).catch(e => alert("Не вдалося завантажити модуль: " + e.message + ". Перевірте з'єднання.")); }; stub._stub = true; ACTS[a] = stub; }
// фонове довантаження після старту, коли мережа вільна
addEventListener("load", () => setTimeout(() => { const go = () => loadLazy("all").catch(() => {}); if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 8000 }); else go(); }, 4000));
