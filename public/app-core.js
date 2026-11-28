"use strict";
// Дані, утиліти, стан, сховище (Firebase), push. Файли app-*.js — звичайні скрипти зі спільною глобальною областю; порядок підключення див. index.html.
// ================= Дані =================
const TOPICS = [
 ["ITN1","ITN","1","Мережі сьогодні"],["ITN2","ITN","2","Базова конфігурація комутатора й кінцевих пристроїв"],
 ["ITN3","ITN","3","Протоколи та моделі"],["ITN4","ITN","4","Фізичний рівень"],["ITN5","ITN","5","Системи числення"],
 ["ITN6","ITN","6","Канальний рівень"],["ITN7","ITN","7","Комутація Ethernet"],["ITN8","ITN","8","Мережевий рівень"],
 ["ITN9","ITN","9","Розв'язання адрес"],["ITN10","ITN","10","Базова конфігурація маршрутизатора"],["ITN11","ITN","11","IPv4-адресація"],
 ["ITN12","ITN","12","IPv6-адресація"],["ITN13","ITN","13","ICMP"],["ITN14","ITN","14","Транспортний рівень"],
 ["ITN15","ITN","15","Прикладний рівень"],["ITN16","ITN","16","Основи мережевої безпеки"],["ITN17","ITN","17","Побудова невеликої мережі"],
 ["SRWE1","SRWE","1","Базове налаштування пристроїв"],["SRWE2","SRWE","2","Принципи комутації"],["SRWE3","SRWE","3","VLAN"],
 ["SRWE4","SRWE","4","Маршрутизація між VLAN"],["SRWE5","SRWE","5","Принципи роботи STP"],["SRWE6","SRWE","6","EtherChannel"],
 ["SRWE7","SRWE","7","DHCPv4"],["SRWE8","SRWE","8","SLAAC і DHCPv6"],["SRWE9","SRWE","9","FHRP"],["SRWE10","SRWE","10","Принципи безпеки LAN"],
 ["SRWE11","SRWE","11","Налаштування безпеки комутатора"],["SRWE12","SRWE","12","Принципи WLAN"],["SRWE13","SRWE","13","Налаштування WLAN"],
 ["SRWE14","SRWE","14","Принципи маршрутизації"],["SRWE15","SRWE","15","Статична маршрутизація"],["SRWE16","SRWE","16","Діагностика статичних маршрутів"],
 ["ENSA1","ENSA","1","Принципи OSPFv2"],["ENSA2","ENSA","2","Налаштування OSPFv2"],["ENSA3","ENSA","3","Принципи мережевої безпеки"],
 ["ENSA4","ENSA","4","Принципи ACL"],["ENSA5","ENSA","5","Налаштування ACL"],["ENSA6","ENSA","6","NAT для IPv4"],["ENSA7","ENSA","7","Принципи WAN"],
 ["ENSA8","ENSA","8","VPN і IPsec"],["ENSA9","ENSA","9","QoS"],["ENSA10","ENSA","10","Керування мережею"],["ENSA11","ENSA","11","Проєктування мережі"],
 ["ENSA12","ENSA","12","Діагностика мережі"],["ENSA13","ENSA","13","Віртуалізація мережі"],["ENSA14","ENSA","14","Автоматизація мережі"],
 ["LNX1","LNX","1","Файли, права, журнали"],["LNX2","LNX","2","Процеси і сервіси systemd"],["LNX3","LNX","3","Мережа в Linux"],["LNX4","LNX","4","Bash-скрипти і cron"],["LNX5","LNX","5","Git"],["LNX6","LNX","6","CI/CD, YAML, Python, контейнери"],
 ["LNX7","LNX","7","Python для мереж: Netmiko, NAPALM"],["LNX8","LNX","8","RESTCONF, NETCONF, YANG"],["LNX9","LNX","9","Git і CI для конфігурацій"],
 ["LNX10","LNX","10","Аналіз журналів і алертів"],["LNX11","LNX","11","Атаки в захопленнях пакетів"],["LNX12","LNX","12","Харденінг за CIS"]
].map(([id,g,n,name])=>({id,g,n,name}));
const TMAP = Object.fromEntries(TOPICS.map(t=>[t.id,t]));
const QB_BASE = [...(window.QB_ITN||[]), ...(window.QB_SRWE||[]), ...(window.QB_NOTES||[]), ...(window.QB_EXTRA||[]), ...(window.QB_SRWE2||[]), ...(window.QB_ENSA||[]), ...(window.QB_NETACAD||[]), ...(window.QB_FIGS||[]), ...(window.QB_EN||[]), ...(window.QB_LNX||[]), ...(window.QB_ENSA2||[]), ...(window.QB_V2||[]), ...(window.QB_V2B||[]), ...(window.QB_SIM||[]), ...(window.QB_PRACT||[]), ...(window.QB_MORE||[]), ...(window.QB_DND||[]), ...(window.QB_AUTO||[])];
let customQs = [];
let QB = QB_BASE.slice();
let QMAP = Object.fromEntries(QB.map(q=>[q.id,q]));
function trq(q){ const t=window.QB_TR&&window.QB_TR[q.id]; if(!t) return q;
  const n=Object.assign({},q,{q:t.q,_uk:q.q,_tr:1});
  if(t.o&&q.o) n.o=q.o.map((p,i)=>{ const r=t.o[i]; return r?[r[0]===0?p[0]:r[0], r[1]]:p; });
  ["items","pairs","e","cfg","cats"].forEach(k=>{ if(t[k]!=null) n[k]=t[k]; });
  if(t.parts&&q.parts) n.parts=q.parts.map((p,i)=>{ const r=t.parts[i]; return r? Object.assign({},p,{q:r.q,o:p.o.map((x,j)=>r.o&&r.o[j]?[r.o[j][0],r.o[j][1]]:x)}) : p; });
  if(t.intro) n.intro=t.intro; return n; }
// Переклади (tr-*.js, ≈ 75 КБ) потрібні лише англійському режиму — вантажимо їх на вимогу.
const TR_FILES=["tr-itn.js","tr-srwe.js","tr-srwe2.js","tr-ensa.js","tr-netacad.js","tr-figs.js","tr-notes.js","tr-extra.js"]; let trP=null;
function loadTR(){ if(window.__trLoaded) return Promise.resolve(); if(!trP){ trP=Promise.all(TR_FILES.map(f=>new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=f; s.onload=res; s.onerror=()=>rej(new Error("не завантажено "+f)); document.head.appendChild(s); }))).then(()=>{ window.__trLoaded=true; }); trP.catch(()=>{ trP=null; }); } return trP; }
function rebuildQB(){ const base=opts.lang==="en"?QB_BASE.map(trq):QB_BASE; QB = base.concat(customQs.filter(q=>TMAP[q.t])); QMAP = Object.fromEntries(QB.map(q=>[q.id,q])); }
const COURSES=[["ITN","Вступ до мереж"],["SRWE","Комутація, маршрутизація, бездротові мережі"],["ENSA","Корпоративні мережі, безпека, автоматизація"],["LNX","Після CCNA: Linux, DevOps, автоматизація, безпека"]];
const GEN = window.GEN, CLI = window.CLI;
const TID2GEN = {"g-showstp":"g-showstp","g-showtrunk":"g-showtrunk","g-showec":"g-showec","g-showint":"g-showint","g-lpm":"g-lpm","g-ad":"g-ad","g-wild":"g-wild","g-ospfcost":"g-ospfcost","g-rid":"g-rid","g-bin":"g-bin","g-hex":"g-bin","g-net":"g-subnet","g-bc":"g-subnet","g-range":"g-subnet","g-hosts":"g-subnet","g-vlsm":"g-vlsm","g-ipv6":"g-ipv6","g-eui":"g-eui","g-stproot":"g-stproot","g-stprp":"g-stprp","g-stpcost":"g-stpcost","g-stpprio":"g-stpprio"};
const INT_DAYS = [0,1,3,7,16,35], DAY = 864e5;
// Реєстри для модулів: VIEWS[назва]={html(), after?()} — власні екрани; ACTS[data-act]=(el,ev)=>… — власні дії.
const VIEWS = {}, ACTS = {};
const LS = {sandbox:"ccna.sandbox.v1",snaps:"ccna.snaps.v1",custom:"ccna.custom.v1",prog:"ccna.prog.v1",exams:"ccna.exams.v1",sel:"ccna.sel.v1",opts:"ccna.opts.v1",daily:"ccna.daily.v1",flags:"ccna.flags.v1",labs:"ccna.labs.v1"};
const TYPE_NAME = {simlet:"Симлет: кілька питань до виводів команд",sim:"Практичне завдання (CLI)", mc:"", order:"Розставте по порядку", match:"Зіставте", cmd:"Введіть команду", fill:"Заповніть пропуски", flash:"Картка"};

// Концепції для аналітики (за темою + ключовими словами)
const CONCEPTS = {
 SRWE1:[["Завантаження й відновлення",/boot|POST|ROMMON|register|0x21|flash_init|BOOT|кнопк.*Mode|відновлен|завантаж/i],["LED-індикатори",/індикатор|LED|SYST|RPS|SPEED/i],["SSH і віддалений доступ",/SSH|RSA|vty|domain|K9|transport|Telnet/i],["Лічильники й стан інтерфейсів",/runts|giants|CRC|collision|ignored|overrun|line protocol|administratively|duplex|MDIX|лічильник/i],["SVI і керування",/SVI|default-gateway|керуван/i],["CLI, історія, show",/історі|Ctrl|history|show version|NVRAM|копі|збереж/i]],
 SRWE2:[["Методи комутації",/store|cut-through|fast-forward|fragment|FCS|затримк|швидкост/i],["MAC-таблиця",/MAC-табл|mac address-table|навча|старін|запис|Source MAC|переїха|переключ/i],["Домени колізій і broadcast",/домен|хаб|broadcast|мікросегмент|multicast/i],["Буферизація й ASIC",/буфер|ASIC/i]],
 SRWE3:[["DTP",/DTP|dynamic|nonegotiate/i],["Native VLAN і VLAN hopping",/native|hopping|double/i],["Voice VLAN і QoS",/голос|voice|CoS|телефон|qos/i],["VTP",/VTP/i],["Діапазони та збереження VLAN",/vlan\.dat|діапазон|1006|1005|зберіга|перезаванта|no vlan|VLAN 1\b/i],["802.1Q-тег",/802\.1Q|TPID|VLAN ID|тег/i],["Trunk: allowed і перевірка",/allowed|trunk/i],["Призначення портів",/access|порт/i]],
 SRWE4:[["Router-on-a-stick",/субінтерфейс|router-on-a-stick|dot1Q|G0\/0\.|ROAS/i],["L3-комутатор і SVI",/SVI|L3|ip routing|routed|no switchport|interface vlan/i],["Legacy inter-VLAN",/legacy/i],["Діагностика шлюзу й портів",/шлюз|gateway|ipconfig|не пінгує/i]],
 SRWE5:[["PortFast і BPDU Guard",/portfast|bpdu/i],["Вибір root bridge",/root bridge|BID|пріоритет|priority|root primary/i],["Root port і вартість",/root port|вартіст|cost/i],["Ролі портів",/роль|alternate|backup|designated|Altn/i],["Стани й таймери",/стан|listening|learning|blocking|forward delay|таймер|discarding/i],["Петлі й шторми",/петл|шторм|storm|TTL|дублю|лягла/i],["Версії STP",/PVST|MST|RSTP|rapid/i]],
 SRWE6:[["Режими PAgP/LACP",/PAgP|LACP|active|passive|desirable|\bauto\b|mode on|\bon\b/i],["Вимоги до портів",/збіга|швидк|suspended|\(s\)|різн|FastEthernet/i],["Балансування",/баланс|load-balance|хеш|потік/i],["Налаштування й перевірка",/channel-group|summary|port-channel|show|BW/i]]
};
function textOf(q){ return [q.q, ...(q.parts||[]).flatMap(p=>[p.q,...p.o.map(o=>o[0])]), ...(q.o||[]).map(o=>o[0]), ...(q.items||[]), ...((q.pairs||[]).flat()), ...(Array.isArray(q.ans)?q.ans:[q.ans||""]), q.cfg||""].join(" "); }
function conceptOf(id){
  const q=QMAP[id]; if(!q){ return GEN.conceptOf[id]||"Розрахунки"; }
  if(q.k) return q.k;
  const rules=CONCEPTS[q.t]; if(rules){ const s=q.q; for(const [n,re] of rules) if(re.test(s)) return n; const all=textOf(q); for(const [n,re] of rules) if(re.test(all)) return n; }
  return TMAP[q.t].name;
}
function topicOfId(id){ return QMAP[id]? QMAP[id].t : (GEN.topicOf[id]||null); }

// ================= Утиліти =================
const $ = s=>document.querySelector(s);
const esc = s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
const shuffle = a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const clone=o=>JSON.parse(JSON.stringify(o));
const tlabel = id=>{const t=TMAP[id];return t?t.g+" "+t.n:id;};
const fmtDate = ts=>new Date(ts).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
const dkey = (d=new Date())=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const qtype = q=>q.type||"mc";
const recId = q=>q.tid||q.id;

// ================= Стан =================
let prog = lsGet(LS.prog,{}), exams = lsGet(LS.exams,[]), daily = lsGet(LS.daily,{}), flags = lsGet(LS.flags,{}), labs = lsGet(LS.labs,{});
let sel = new Set(lsGet(LS.sel,["SRWE1","SRWE2","SRWE3","SRWE4","SRWE5","SRWE6"]));
let opts = Object.assign({train:20, exam:40, src:"all", goal:20, tgoal:60,theme:"auto", fs:16, shuffle:true, sound:false, modTopic:"SRWE1", examDate:"", lang:"mix", enTerms:false}, lsGet(LS.opts,{}));
if(opts.notesOnly){ opts.src="n"; delete opts.notesOnly; }
let view = "home", S = null, LAB = null, searchQ = "";

// ================= Сховище =================
const store = {db:null, ref:null, mode:"loading", chain:Promise.resolve(), err:null, user:null, F:null, unsub:null, authErr:""};
function setStatus(){
  const el=$("#status"); el.title="";
  if(store.err){el.className="chip err";el.textContent="⚠ Помилка збереження";el.title=store.err;return;}
  if(store.mode==="loading"){el.className="chip";el.textContent="☁ Підключення…";return;}
  if(store.mode==="db"&&!navigator.onLine){el.className="chip warn";el.textContent="📴 Офлайн";el.title="Прогрес зберігається на пристрої й синхронізується, щойно з'явиться інтернет.";return;}
  if(store.mode==="db"){el.className="chip";el.textContent="☁ Синхронізовано";el.title=(store.user&&store.user.email)||"";return;}
  if(store.mode==="signedout"){el.className="chip warn";el.textContent="Не виконано вхід";return;}
  el.className="chip warn";el.textContent="⚠ Лише на цьому пристрої";el.title="Firebase не налаштовано або недоступний — робіть резервні копії.";
}
// ---------- Firebase (Auth + Firestore) ----------
const FB_VER="10.12.2";
async function loadFirebase(){
  const cfg=window.FIREBASE_CONFIG; if(!cfg||!cfg.apiKey||/ВСТАВ/i.test(cfg.apiKey)) return null;
  const base="https://www.gstatic.com/firebasejs/"+FB_VER+"/";
  const [appM,authM,fsM]=await Promise.all([import(base+"firebase-app.js"),import(base+"firebase-auth.js"),import(base+"firebase-firestore.js")]);
  const app=appM.initializeApp(cfg); const auth=authM.getAuth(app);
  let db; try{ db=fsM.initializeFirestore(app,{localCache:fsM.persistentLocalCache({tabManager:fsM.persistentMultipleTabManager()})}); }catch(e){ db=fsM.getFirestore(app); }
  return {authM,fsM,auth,db,app};
}
// ---- Push-сповіщення (Firebase Cloud Messaging) ----
const VAPID="BEt1UWcuzuRLI94i1YjFQyRz1KcQAturkR-gqBpsgA0cWZAGtldFRBOsU5JQcokUtgFzpGFL9Engwh6s4aondr0";
async function pushEnable(){
  if(store.mode!=="db"||!store.F) throw new Error("Спершу увійдіть в акаунт (push прив'язується до нього)");
  if(!("Notification" in window)||!("serviceWorker" in navigator)) throw new Error("Цей браузер не підтримує push. На iPhone — спершу встановіть тренажер на початковий екран (iOS 16.4+).");
  const perm=await Notification.requestPermission(); if(perm!=="granted") throw new Error("Дозвіл на сповіщення не надано");
  const m=await import("https://www.gstatic.com/firebasejs/"+FB_VER+"/firebase-messaging.js");
  if(!(await m.isSupported())) throw new Error("FCM не підтримується в цьому браузері");
  const reg=await navigator.serviceWorker.ready; const token=await m.getToken(m.getMessaging(store.F.app),{vapidKey:VAPID,serviceWorkerRegistration:reg});
  const id=hashStr(token); const [h,mi]=(opts.remind||"19:00").split(":").map(Number);
  await store.db.doc("push/"+id).set({token,hour:h,minute:mi||0,tz:Intl.DateTimeFormat().resolvedOptions().timeZone||"Europe/Kyiv",goal:opts.goal,tgoal:opts.tgoal,ua:navigator.userAgent.slice(0,120),ts:Date.now()});
  opts.pushId=id; lsSet(LS.opts,opts); return id; }
async function pushDisable(){ if(opts.pushId&&store.db){ try{ await store.db.doc("push/"+opts.pushId).delete(); }catch(e){} }
  try{ const m=await import("https://www.gstatic.com/firebasejs/"+FB_VER+"/firebase-messaging.js"); await m.deleteToken(m.getMessaging(store.F.app)); }catch(e){} delete opts.pushId; lsSet(LS.opts,opts); }
async function pushSync(){ if(!opts.pushId||store.mode!=="db") return; const [h,mi]=(opts.remind||"19:00").split(":").map(Number); try{ await store.db.doc("push/"+opts.pushId).update({hour:h,minute:mi||0,goal:opts.goal,tgoal:opts.tgoal,ts:Date.now()}); }catch(e){} }
const plain=o=>JSON.parse(JSON.stringify(o)); // Firestore не приймає undefined
function makeDb(F,uid){
  const {fsM,db}=F;
  const wrapDoc=r=>({
    get:async()=>{ const s=await fsM.getDoc(r); return {exists:s.exists(),data:()=>s.data()}; },
    set:d=>fsM.setDoc(r,plain(d)),
    update:d=>fsM.setDoc(r,plain(d),{merge:true}),
    delete:()=>fsM.deleteDoc(r),
    onSnapshot:(n,e)=>fsM.onSnapshot(r,s=>n({exists:s.exists(),data:()=>s.data(),metadata:s.metadata}),e),
    delField:f=>fsM.updateDoc(r,{[f]:fsM.deleteField()})
  });
  return {
    doc:p=>wrapDoc(fsM.doc(db,"users",uid,...p.split("/"))),
    collection:p=>{ const c=fsM.collection(db,"users",uid,...p.split("/"));
      return {add:d=>fsM.addDoc(c,plain(d)),
        getAll:async()=>{ const s=await fsM.getDocs(c); return s.docs.map(d=>({id:d.id,data:()=>d.data()})); },
        onSnapshot:(n,e)=>fsM.onSnapshot(c,s=>n(s.docs.map(d=>({id:d.id,data:()=>d.data()}))),e),
        orderBy:(f,dir)=>({limit:n=>({get:async()=>{ const s=await fsM.getDocs(fsM.query(c,fsM.orderBy(f,dir),fsM.limit(n))); return {docs:s.docs.map(d=>({data:()=>d.data()}))}; }})})}; }
  };
}
async function initStore(){
  setStatus();
  try{ store.F=await loadFirebase(); }catch(e){ store.F=null; console.error(e); }
  if(!store.F){ store.mode="local"; setStatus(); rerenderPassive(); return; }
  store.F.authM.onAuthStateChanged(store.F.auth, async user=>{
    if(store.unsub){ try{store.unsub();}catch(e){} store.unsub=null; }
    if(store.unsubD){ try{store.unsubD();}catch(e){} store.unsubD=null; }
    store.user=user;
    if(!user){ store.db=null; store.ref=null; store.mode="signedout"; setStatus(); rerenderPassive(); return; }
    store.mode="loading"; setStatus(); await connectDb(makeDb(store.F,user.uid));
  });
}
async function connectDb(db){
  try{
    store.db=db; store.ref=db.doc("progress/state");
    const snap = await Promise.race([store.ref.get(), sleep(15000).then(()=>{throw new Error("timeout");})]);
    // Денні записи живуть в окремих документах users/{uid}/daily/{YYYY-MM} (ліміт одного документа Firestore — 1 МБ).
    // Старе поле daily у progress/state переносимо: спершу пишемо місячні документи, і лише після успіху прибираємо поле.
    const months=await db.collection("daily").getAll(); const remoteDaily={}; for(const m of months) Object.assign(remoteDaily,(m.data()||{}).days||{});
    const legacy=snap.exists?((snap.data()||{}).daily||{}):{};
    if(snap.exists){ const d=snap.data()||{}; prog=mergeByTs(prog,d.q||{},"l"); flags=mergeByTs(flags,d.flags||{},"ts"); labs=mergeByTs(labs,d.labs||{},"ts"); }
    daily=mergeDaily(mergeDaily(daily,remoteDaily),legacy);
    let monthOk=true; try{ await writeMonths(db,daily); }catch(e){ monthOk=false; console.error("daily → місячні документи:",e); }
    store.monthMode=monthOk;
    await store.ref.set(Object.assign({q:prog,flags,labs,updated:Date.now()}, monthOk?{dailyV:2}:{daily}, snap.exists?{}:{created:Date.now()}));
    cacheAll();
    try{ const es=await db.collection("exams").orderBy("ts","desc").limit(100).get(); const remote=es.docs.map(d=>d.data()); const have=new Set(remote.map(e=>e.ts));
      for(const e of exams){ if(!have.has(e.ts)){ try{await db.collection("exams").add(e);}catch(_){} remote.push(e);} }
      exams=remote.sort((a,b)=>b.ts-a.ts); lsSet(LS.exams,exams); }catch(e){}
    try{ const cs=await db.collection("custom").orderBy("ts","desc").limit(1000).get(); const remote=cs.docs.map(d=>d.data()).filter(q=>q&&q.id); const ids=new Set(remote.map(q=>q.id));
      for(const q of customQs){ if(!ids.has(q.id)){ try{await db.doc("custom/"+q.id).set(q);}catch(_){} remote.push(q);} }
      customQs=remote; lsSet(LS.custom,customQs); rebuildQB(); }catch(e){}
    store.mode="db"; setStatus(); setTimeout(autoBackup,3000);
    store.db.doc("sandbox/main").get().then(d=>{ if(!d.exists) return; const x=d.data(); const loc=lsGet(LS.sandbox,null); if(x&&x.json&&(!loc||!loc.ts||x.ts>loc.ts)) lsSet(LS.sandbox,JSON.parse(x.json)); }).catch(()=>{});
    store.unsub=store.ref.onSnapshot(s=>{ if(!s.exists) return; const d=s.data()||{}; prog=clone(d.q||{}); flags=clone(d.flags||{}); labs=clone(d.labs||{});
      if(!store.monthMode){ const tk=dkey(), loc=daily[tk]; daily=clone(d.daily||{}); if(loc&&(loc.m||0)>((daily[tk]||{}).m||0)) daily[tk]=Object.assign({n:0,c:0},daily[tk],{m:loc.m}); }
      else if(d.daily&&Object.keys(d.daily).length){ // старий клієнт (до оновлення кешу) дописав daily у спільний документ — переносимо
        const leg=d.daily; daily=mergeDaily(daily,leg); const ms=new Set(Object.keys(leg).map(monthOf)); queueWrite(async()=>{ await writeMonths(store.db,daily,ms); await store.ref.delField("daily"); }); }
      cacheAll(); rerenderPassive(); },()=>{});
    if(store.monthMode) store.unsubD=db.collection("daily").onSnapshot(list=>{ const all={}; for(const m of list) Object.assign(all,(m.data()||{}).days||{});
      const tk=dkey(), loc=daily[tk]; daily=all; if(loc&&(loc.m||0)>((daily[tk]||{}).m||0)) daily[tk]=Object.assign({n:0,c:0},daily[tk],{m:loc.m}); cacheAll(); rerenderPassive(); },()=>{});
    rerenderPassive();
  }catch(e){ console.error(e); store.db=null; store.ref=null; store.mode="local"; store.err=e.message||String(e); setStatus(); rerenderPassive(); }
}
function mergeByTs(a,b,f){ const out=clone(a||{}); for(const [k,v] of Object.entries(b||{})){ if(!out[k]||(v[f]||0)>=(out[k][f]||0)) out[k]=v; } return out; }
// Денний запис: n/c — відповіді, m — хвилини в тренажері, log — записи навчання поза ним, note/plan/jts — чек-ін дня.
function mergeDay(o,v){ if(!o) return v; if(!v) return o;
  const big=(v.n||0)>=(o.n||0)?v:o; const r=Object.assign({},o,v,{n:big.n||0,c:big.c||0});
  if(o.m||v.m) r.m=Math.max(o.m||0,v.m||0);
  const L=[...(o.log||[]),...(v.log||[])]; if(L.length){ const seen=new Set(); r.log=L.filter(e=>e&&!seen.has(e.ts)&&seen.add(e.ts)).sort((a,b)=>a.ts-b.ts); }
  const j=(v.jts||0)>=(o.jts||0)?v:o; for(const f of ["note","plan","jts"]){ if(j[f]!==undefined) r[f]=j[f]; else delete r[f]; }
  return r; }
function mergeDaily(a,b){ const out=clone(a||{}); for(const [k,v] of Object.entries(b||{})) out[k]=mergeDay(out[k],v); return out; }
function cacheAll(){ lsSet(LS.prog,prog); lsSet(LS.daily,daily); lsSet(LS.flags,flags); lsSet(LS.labs,labs); }
function authErrText(e){ const c=(e&&e.code)||""; return ({"auth/invalid-credential":"Невірний email або пароль.","auth/wrong-password":"Невірний пароль.","auth/user-not-found":"Користувача не знайдено — натисніть «Створити акаунт».","auth/email-already-in-use":"Такий email уже зареєстровано — натисніть «Увійти».","auth/weak-password":"Пароль має бути щонайменше 6 символів.","auth/invalid-email":"Некоректний email.","auth/popup-blocked":"Браузер заблокував вікно входу — дозвольте спливаючі вікна або увійдіть через email.","auth/popup-closed-by-user":"Вікно входу закрито.","auth/unauthorized-domain":"Цей домен не додано в Firebase → Authentication → Settings → Authorized domains.","auth/operation-not-allowed":"Цей спосіб входу не увімкнено в Firebase → Authentication → Sign-in method."}[c])||(e&&e.message)||String(e); }
async function doAuth(kind){
  const F=store.F; if(!F) return; store.authErr="";
  try{
    if(kind==="google"){ await F.authM.signInWithPopup(F.auth,new F.authM.GoogleAuthProvider()); }
    else { const em=$("#authEmail").value.trim(), pw=$("#authPass").value;
      if(kind==="signup") await F.authM.createUserWithEmailAndPassword(F.auth,em,pw); else await F.authM.signInWithEmailAndPassword(F.auth,em,pw); }
  }catch(e){ store.authErr=authErrText(e); render(); }
}
function authCard(){
  if(store.mode!=="signedout") return "";
  return `<div class="card"><h2>Вхід</h2><p class="small muted" style="margin:0 0 8px">Увійдіть, щоб прогрес зберігався в хмарі й синхронізувався між пристроями. Без входу прогрес лишається лише в цьому браузері.</p>
    <button class="primary" data-act="authgoogle" style="width:100%">Увійти через Google</button>
    <div class="small muted" style="text-align:center;margin:8px 0">або email і пароль</div>
    <input type="text" id="authEmail" placeholder="email" autocomplete="username" inputmode="email" style="margin-bottom:6px">
    <input type="password" id="authPass" placeholder="пароль (від 6 символів)" autocomplete="current-password" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--card);color:var(--text);font:inherit">
    <div class="row" style="margin-top:8px"><button class="grow" data-act="authlogin">Увійти</button><button class="grow" data-act="authsignup">Створити акаунт</button></div>
    ${store.authErr?`<div class="note">${esc(store.authErr)}</div>`:""}</div>`;
}
function queueWrite(fn){ store.chain=store.chain.then(fn).then(()=>{ if(store.err){store.err=null;setStatus();} }).catch(e=>{store.err=(e&&e.message)||String(e&&e.code||e);setStatus();}); }
const monthOf=k=>String(k).slice(0,7);
function groupMonths(dl){ const m={}; for(const [k,v] of Object.entries(dl||{})) (m[monthOf(k)]=m[monthOf(k)]||{})[k]=v; return m; }
function writeMonths(db,dl,only){ return Promise.all(Object.entries(groupMonths(dl)).filter(([m])=>!only||only.has(m)).map(([m,days])=>db.doc("daily/"+m).set({days,updated:Date.now()}))); }
function patch(obj){ cacheAll(); if(store.mode!=="db") return; const o=Object.assign({},obj); const dl=o.daily; delete o.daily;
  if(dl&&store.monthMode){ for(const [m,days] of Object.entries(groupMonths(dl))) queueWrite(()=>store.db.doc("daily/"+m).update({days,updated:Date.now()})); }
  else if(dl) o.daily=dl;
  if(Object.keys(o).length) queueWrite(()=>store.ref.update(Object.assign(o,{updated:Date.now()}))); }
function saveAll(){ cacheAll(); if(store.mode!=="db") return;
  if(store.monthMode){ queueWrite(()=>writeMonths(store.db,daily)); queueWrite(()=>store.ref.set({q:prog,flags,labs,updated:Date.now(),dailyV:2})); }
  else queueWrite(()=>store.ref.set({q:prog,daily,flags,labs,updated:Date.now()})); }
function saveExam(e){ exams.unshift(e); lsSet(LS.exams,exams); if(store.mode==="db") queueWrite(()=>store.db.collection("exams").add(e)); }
function rerenderPassive(){ if(!["home","stats","progress"].includes(view)) return;
  const a=document.activeElement; if(a&&a.closest&&a.closest("#app")&&(a.tagName==="TEXTAREA"||(a.tagName==="INPUT"&&!/checkbox|radio/.test(a.type)))) return; // не збивати введення
  render(); }
