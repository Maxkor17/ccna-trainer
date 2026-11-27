// Мок Firestore у пам'яті (зберігається в localStorage "__mockfs", щоб пережити перезавантаження сторінки).
// Підтримує те, що використовує тренажер: doc/collection, get/set(merge)/update/delete, getDocs, onSnapshot, deleteField.
const W = globalThis; const DB = W.__FS = JSON.parse(localStorage.getItem("__mockfs") || "{}");
const DEL = { __del: true }; const subs = [];
const copy = v => JSON.parse(JSON.stringify(v));
const merge = (a, b) => { for (const [k, v] of Object.entries(b)) { if (v === DEL) { delete a[k]; continue; }
  if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) merge(a[k], v); else a[k] = copy(v); } return a; };
const notify = () => { localStorage.setItem("__mockfs", JSON.stringify(DB)); for (const f of subs.slice()) f(); };
const snap = p => ({ id: p.split("/").pop(), exists: () => p in DB, data: () => p in DB ? copy(DB[p]) : undefined, metadata: {} });
const docsOf = c => Object.keys(DB).filter(p => p.startsWith(c.path + "/") && !p.slice(c.path.length + 1).includes("/")).sort().map(snap);
export const deleteField = () => DEL;
export const initializeFirestore = () => ({}), getFirestore = () => ({}), persistentLocalCache = () => ({}), persistentMultipleTabManager = () => ({});
export const doc = (db, ...p) => ({ type: "doc", path: p.join("/") });
export const collection = (db, ...p) => ({ type: "col", path: p.join("/") });
export const query = c => c, orderBy = () => null, limit = () => null;
export async function getDoc(r) { return snap(r.path); }
export async function setDoc(r, d, o) { DB[r.path] = o && o.merge ? merge(DB[r.path] || {}, d) : merge({}, d); notify(); }
export async function updateDoc(r, d) { if (!(r.path in DB)) throw new Error("not-found: " + r.path); merge(DB[r.path], d); notify(); }
export async function deleteDoc(r) { delete DB[r.path]; notify(); }
export async function addDoc(c, d) { const id = Math.random().toString(36).slice(2); DB[c.path + "/" + id] = copy(d); notify(); return { id }; }
export async function getDocs(c) { return { docs: docsOf(c) }; }
export function onSnapshot(r, cb) { const fire = () => cb(r.type === "doc" ? snap(r.path) : { docs: docsOf(r) }); const f = () => setTimeout(fire, 0); subs.push(f); f(); return () => { const i = subs.indexOf(f); if (i >= 0) subs.splice(i, 1); }; }
W.__mock = { setDoc, updateDoc, doc };
