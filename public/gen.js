// Генератори розрахункових питань. Кожен повертає MC-питання з обчисленим розбором.
(function(){
const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const ip2s=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join(".");
const maskOf=p=>p===0?0:(0xFFFFFFFF<<(32-p))>>>0;
const bin8=n=>n.toString(2).padStart(8,"0");
let seq=0;
// Збирає MC із правильної відповіді та дистракторів (унікальні тексти).
function mc(base, correct, cExp, distr){
  const seen=new Set([correct]); const o=[[correct,"Правильно. "+cExp]];
  for(const [t,e] of distr){ if(o.length>=4) break; if(!seen.has(t)){seen.add(t);o.push([t,e]);} }
  return Object.assign({id:base.tid+"#"+(++seq)+"-"+Date.now().toString(36), gen:true, o, a:[0]}, base);
}

// ---------- Системи числення ----------
function gBin(){
  const mode=R(0,3);
  if(mode===0){ const n=R(1,254); const c=bin8(n);
    const d=[bin8(n^1),bin8(n^16),bin8(n^128),bin8((n+2)&255)].map(x=>[x,"Це "+parseInt(x,2)+", а не "+n+"."]);
    return mc({tid:"g-bin",t:"ITN5",k:"Двійкова система",q:"Переведіть "+n+" у двійкову систему (8 біт)."},c,"Розклад за вагами 128 64 32 16 8 4 2 1: "+weights(n)+".",d); }
  if(mode===1){ const n=R(1,254); const b=bin8(n);
    const d=[n^1,n^16,n^128,(n+4)&255].map(x=>[String(x),String(x)+" = "+bin8(x)+"."]);
    return mc({tid:"g-bin",t:"ITN5",k:"Двійкова система",q:"Переведіть "+b+" у десяткову систему."},String(n),weights(n)+" = "+n+".",d); }
  if(mode===2){ const n=R(16,255); const h=n.toString(16).toUpperCase().padStart(2,"0");
    const d=[n+16,n-1,parseInt(h.split("").reverse().join(""),16),n+10].filter(x=>x>=0&&x!==n).map(x=>[String(x),"0x"+x.toString(16).toUpperCase()+" = "+x+"."]);
    return mc({tid:"g-hex",t:"ITN5",k:"Шістнадцяткова система",q:"Чому дорівнює 0x"+h+" у десятковій системі?"},String(n),h[0]+"×16 + "+h[1]+" = "+parseInt(h[0],16)*16+" + "+parseInt(h[1],16)+" = "+n+".",d); }
  const n=R(16,255); const h=n.toString(16).toUpperCase().padStart(2,"0");
  const d=[(n+1)&255,(n^16),parseInt(h.split("").reverse().join(""),16),(n+32)&255].filter(x=>x!==n).map(x=>{const hx=x.toString(16).toUpperCase().padStart(2,"0");return ["0x"+hx,"0x"+hx+" = "+x+"."];});
  return mc({tid:"g-hex",t:"ITN5",k:"Шістнадцяткова система",q:"Переведіть "+n+" у шістнадцяткову систему."},"0x"+h,n+" = "+Math.floor(n/16)+"×16 + "+(n%16)+" → 0x"+h+".",d);
}
function weights(n){const w=[128,64,32,16,8,4,2,1].filter(x=>n&x);return w.join(" + ")||"0";}

// ---------- Субнетинг ----------
function rndHost(p){
  const first=pick([10,172,192]); let a;
  if(first===10) a=(10<<24)|(R(0,255)<<16)|(R(0,255)<<8)|R(1,254);
  else if(first===172) a=(172<<24)|(R(16,31)<<16)|(R(0,255)<<8)|R(1,254);
  else a=(192<<24)|(168<<16)|(R(0,255)<<8)|R(1,254);
  a>>>=0; const m=maskOf(p); const net=(a&m)>>>0, bc=(net|(~m>>>0))>>>0;
  if(a===net||a===bc) a=(net+1)>>>0;
  return {a,net,bc,m};
}
function blockInfo(p){ const oct=Math.floor((p-1)/8); const bits=p-oct*8; const blk=256>>bits; return {oct:oct+1,blk:blk===256?1:blk}; }
function gSubnet(){
  const p=R(17,30); const {a,net,bc,m}=rndHost(p); const bi=blockInfo(p);
  const size=Math.pow(2,32-p);
  const why="/"+p+" = "+ip2s(m)+". Крок у "+bi.oct+"-му октеті: "+(256-((m>>>(8*(4-bi.oct)))&255))+". ";
  const mode=R(0,3);
  if(mode===0){
    const d=[[ip2s(bc),"Це broadcast-адреса підмережі."],[ip2s((net+size)>>>0),"Це наступна підмережа."],[ip2s((net-size)>>>0),"Це попередня підмережа."],[ip2s((a&maskOf(Math.max(8,p-1)))>>>0),"Це мережа для /"+(p-1)+", а не /"+p+"."],[ip2s((a&maskOf(Math.min(30,p+1)))>>>0),"Це мережа для /"+(p+1)+"."]];
    return mc({tid:"g-net",t:"ITN11",k:"Адреса мережі",q:"Яка адреса мережі для хоста "+ip2s(a)+"/"+p+"?"},ip2s(net),why+"Мережа — "+ip2s(net)+", broadcast — "+ip2s(bc)+".",shuf(d));
  }
  if(mode===1){
    const d=[[ip2s(net),"Це адреса мережі."],[ip2s((bc-1)>>>0),"Це остання придатна адреса хоста."],[ip2s((bc+size)>>>0),"Це broadcast наступної підмережі."],[ip2s((a|(~maskOf(Math.max(8,p-1))>>>0))>>>0),"Це broadcast для /"+(p-1)+"."],[ip2s((a|(~maskOf(Math.min(30,p+1))>>>0))>>>0),"Це broadcast для /"+(p+1)+"."]];
    return mc({tid:"g-bc",t:"ITN11",k:"Broadcast-адреса",q:"Яка broadcast-адреса підмережі хоста "+ip2s(a)+"/"+p+"?"},ip2s(bc),why+"Мережа "+ip2s(net)+" + "+size+" адрес − 1 = "+ip2s(bc)+".",shuf(d));
  }
  if(mode===2){
    const c=ip2s((net+1)>>>0)+" – "+ip2s((bc-1)>>>0);
    const d=[[ip2s(net)+" – "+ip2s(bc),"Мережа та broadcast непридатні для хостів."],[ip2s((net+1)>>>0)+" – "+ip2s(bc),"Broadcast непридатна."],[ip2s(net)+" – "+ip2s((bc-1)>>>0),"Адреса мережі непридатна."],[ip2s((net+size+1)>>>0)+" – "+ip2s((bc+size-1)>>>0),"Це наступна підмережа."]];
    return mc({tid:"g-range",t:"ITN11",k:"Діапазон хостів",q:"Який діапазон придатних адрес хостів у підмережі "+ip2s(a)+"/"+p+"?"},c,why+"Перша — мережа + 1, остання — broadcast − 1.",shuf(d));
  }
  const need=R(3,Math.min(2000,size*2)); const pp=32-Math.ceil(Math.log2(need+2)); const hosts=Math.pow(2,32-pp)-2;
  const d=[["/"+(pp+1),"/"+(pp+1)+" дає лише "+(Math.pow(2,32-pp-1)-2)+" хостів."],["/"+(pp-1),"Працює, але це не найменша підмережа."],["/"+(pp+2),"Замало: "+(Math.pow(2,32-pp-2)-2)+" хостів."],["/"+(pp-2),"Надто велика."]];
  return mc({tid:"g-hosts",t:"ITN11",k:"Кількість хостів",q:"Яка найдовша довжина префікса (найменша підмережа) вмістить "+need+" хостів?"},"/"+pp,"Потрібно 2^h − 2 ≥ "+need+": h = "+(32-pp)+" біт хоста, тобто /"+pp+" ("+hosts+" хостів).",shuf(d));
}

// ---------- VLSM ----------
function gVlsm(){
  for(let tries=0;tries<50;tries++){
    const reqs=[R(50,120),R(20,60),R(8,28),2].map((h,i)=>({h,name:["LAN-A","LAN-B","LAN-C","WAN-лінк"][i]}));
    reqs.forEach(r=>r.p=32-Math.ceil(Math.log2(r.h+2)));
    const total=reqs.reduce((s,r)=>s+Math.pow(2,32-r.p),0); if(total>256) continue;
    const base=((192<<24)|(168<<16)|(R(1,250)<<8))>>>0;
    const sorted=reqs.slice().sort((x,y)=>x.p-y.p); let cur=base;
    for(const r of sorted){ r.net=cur; cur=(cur+Math.pow(2,32-r.p))>>>0; }
    // розподіл у порядку переліку (типова помилка)
    let cur2=base; const naive={}; for(const r of reqs){ const sz=Math.pow(2,32-r.p); cur2=Math.ceil((cur2-base)/sz)*sz+base; naive[r.name]=cur2; cur2+=sz; }
    const target=pick(reqs.filter(r=>r.name!=="LAN-A"));
    const c=ip2s(target.net)+"/"+target.p;
    const d=[[ip2s(target.net)+"/"+(target.p+1),"Префікс /"+(target.p+1)+" дає лише "+(Math.pow(2,32-target.p-1)-2)+" хостів — замало."],
      [ip2s(naive[target.name])+"/"+target.p,"Так вийде, якщо розподіляти в порядку переліку, а не від найбільшої."],
      [ip2s((target.net+Math.pow(2,32-target.p))>>>0)+"/"+target.p,"Це наступний блок того ж розміру."],
      [ip2s(target.net)+"/"+(target.p-1),"Надто великий блок — перекриє сусідні підмережі."]];
    const plan=sorted.map(r=>r.name+" ("+r.h+") → "+ip2s(r.net)+"/"+r.p).join("; ");
    return mc({tid:"g-vlsm",t:"ITN11",k:"VLSM",q:"Мережу "+ip2s(base)+"/24 ділять за VLSM, починаючи з найбільшої потреби. Яку підмережу отримає "+target.name+"?",
      c:reqs.map(r=>r.name+": хостів — "+r.h).join("\n")},c,"План: "+plan+".",shuf(d));
  }
}

// ---------- IPv6 ----------
const hx4=n=>n.toString(16).toUpperCase().padStart(4,"0");
function compress(hs){
  // hs — масив чисел. Найдовша послідовність нулів довжиною ≥2 (перша за рівності)
  let best=-1,bl=0; for(let i=0;i<8;){ if(hs[i]===0){let j=i;while(j<8&&hs[j]===0)j++; if(j-i>bl&&j-i>=2){best=i;bl=j-i;} i=j;} else i++; }
  const s=hs.map(h=>h.toString(16).toUpperCase());
  if(best<0) return s.join(":");
  return s.slice(0,best).join(":")+"::"+s.slice(best+bl).join(":");
}
function gIpv6(){
  for(let t=0;t<50;t++){
    const hs=[0x2001,0xDB8,0,0,0,0,0,0];
    const pattern=pick([[2,3],[2,3,4],[4,5,6],[2,3,5,6,7],[3,4,6,7]]);
    for(let i=2;i<8;i++) hs[i]=pattern.includes(i)?0:pick([R(1,15),R(16,255),R(256,4095),R(4096,65535)]);
    hs[7]=hs[7]||1;
    const full=hs.map(hx4).join(":"); const c=compress(hs);
    // дистрактори
    const s=hs.map(h=>h.toString(16).toUpperCase());
    const zeroIdx=[...Array(8).keys()].filter(i=>hs[i]===0);
    const d=[];
    // два ::
    if(zeroIdx.length>=4){ const alt=s.map((x,i)=>hs[i]===0?"":x).join(":").replace(/:{2,}/g,"::"); if((alt.match(/::/g)||[]).length>1) d.push([alt,"Подвійна двокрапка може бути лише один раз."]); }
    // неправильне видалення нулів (прибрані кінцеві нулі)
    const bad=hs.map(h=>{const x=h.toString(16).toUpperCase(); return x.length>1? x.replace(/0+$/,"")||"0" : x;});
    const badS=compress(hs).split(":").map((x,i)=>x).join(":");
    const wrongTrail=c.replace(/[0-9A-F]+/g,m=>m.length>1&&/0$/.test(m)?m.replace(/0+$/,""):m);
    if(wrongTrail!==c) d.push([wrongTrail,"Прибирати можна лише провідні нулі, а не кінцеві."]);
    // без скорочення нулів
    d.push([s.join(":"),"Валідна форма, але не найкоротша: послідовність нулів треба замінити на ::."]);
    // :: не на найдовшій групі
    const other=altCompress(hs); if(other && other!==c) d.push([other,"Скорочено не найдовшу групу нулів (за RFC 5952 — найдовшу, за рівності першу)."]);
    const o=mc({tid:"g-ipv6",t:"ITN12",k:"Скорочення IPv6",q:"Яке найкоротше правильне записання адреси "+full+"?"},c,"Прибираємо провідні нулі в кожному hextet-і та замінюємо найдовшу групу нульових hextet-ів на :: (один раз).",d);
    if(o.o.length>=3) return o;
  }
}
function altCompress(hs){
  const runs=[]; for(let i=0;i<8;){ if(hs[i]===0){let j=i;while(j<8&&hs[j]===0)j++; if(j-i>=1) runs.push([i,j-i]); i=j;} else i++; }
  if(runs.length<2) return null; runs.sort((a,b)=>a[1]-b[1]); const [st,l]=runs[0];
  const s=hs.map(h=>h.toString(16).toUpperCase());
  return s.slice(0,st).join(":")+"::"+s.slice(st+l).join(":");
}
function gEui(){
  const b=[R(0,255)&0xFC,R(0,255),R(0,255),R(0,255),R(0,255),R(0,255)];
  const mac=b.map(x=>x.toString(16).toUpperCase().padStart(2,"0")).join(":");
  const id=(f,ins)=>{const x=[b[0]^f,b[1],b[2],...ins,b[3],b[4],b[5]].map(v=>v.toString(16).padStart(2,"0").toUpperCase());return x[0]+x[1]+":"+x[2]+x[3]+":"+x[4]+x[5]+":"+x[6]+x[7];};
  const c=id(2,[0xFF,0xFE]);
  const d=[[id(0,[0xFF,0xFE]),"Не інвертовано 7-й біт (U/L) першого байта."],[id(2,[0xFE,0xFF]),"Вставлено FEFF замість FFFE."],[id(0,[0xFF,0xFF]),"Вставлено FFFF і не інвертовано біт."],[id(1,[0xFF,0xFE]),"Інвертовано не той біт (8-й замість 7-го)."]];
  return mc({tid:"g-eui",t:"ITN12",k:"EUI-64",q:"Який ідентифікатор інтерфейсу EUI-64 отримає хост з MAC "+mac+"?"},c,"MAC ділиться навпіл, посередині вставляється FFFE, у першому байті інвертується 7-й біт: "+b[0].toString(16).toUpperCase().padStart(2,"0")+" → "+(b[0]^2).toString(16).toUpperCase().padStart(2,"0")+".",shuf(d));
}

// ---------- STP ----------
const COST={"10 Мбіт/с":100,"100 Мбіт/с":19,"1 Гбіт/с":4,"10 Гбіт/с":2};
function rmac(){ return [R(0,255),R(0,255),R(0,255),R(0,255),R(0,255),R(0,255)].map(x=>x.toString(16).padStart(2,"0")).join("").replace(/(....)(....)(....)/,"$1.$2.$3"); }
function gStpRoot(){
  const vlan=pick([1,10,20,30,99]);
  const n=R(3,4); const names=["S1","S2","S3","S4"].slice(0,n);
  const base=[32768,32768,28672,24576,32768,61440,4096,8192];
  const sw=names.map(nm=>({nm,pr:pick(base),mac:rmac()}));
  if(Math.random()<0.5){ const p=pick(base); sw.forEach(s=>s.pr=p); } // рівні пріоритети → вирішує MAC
  const cmp=(a,b)=>a.pr-b.pr||(a.mac<b.mac?-1:a.mac>b.mac?1:0);
  const root=sw.slice().sort(cmp)[0];
  const minMac=sw.slice().sort((a,b)=>a.mac<b.mac?-1:1)[0];
  const tie=sw.every(s=>s.pr===sw[0].pr);
  const o=sw.map(s=>{
    if(s===root) return [s.nm,"Правильно. "+(tie?"Пріоритети однакові ("+(s.pr+vlan)+"), тож вирішує найменша MAC: "+s.mac+".":"Найменший пріоритет: "+s.pr+" + "+vlan+" = "+(s.pr+vlan)+".")];
    let e = s.pr>root.pr? "Пріоритет "+(s.pr+vlan)+" вищий, ніж у "+root.nm+" ("+(root.pr+vlan)+")." : "Пріоритет такий самий, але MAC "+s.mac+" більша за "+root.mac+".";
    if(s===minMac && !tie) e+=" Найменша MAC не допомагає, бо пріоритет порівнюється першим.";
    return [s.nm,e];
  });
  const ci=o.findIndex(x=>x[0]===root.nm);
  return {id:"g-stproot#"+(++seq)+"-"+Date.now().toString(36),tid:"g-stproot",gen:true,t:"SRWE5",k:"Вибір root bridge",
    q:"Який комутатор стане root bridge у VLAN "+vlan+"? (Показано базовий пріоритет без extended system ID.)",
    c:sw.map(s=>s.nm+": priority "+s.pr+", MAC "+s.mac).join("\n"),o,a:[ci]};
}
function gStpRootPort(){
  for(let t=0;t<50;t++){
    const speeds=Object.keys(COST);
    const nPorts=R(2,3); const ports=[];
    const neigh=["S1","S2","S3"]; const nb={};
    neigh.forEach(nm=>nb[nm]={nm,rpc:pick([4,8,19,23]),bid:pick([24586,32778,32778,28682])+"/"+rmac()});
    nb.S1.rpc=0; nb.S1.bid="24586/"+rmac(); // S1 — root
    const pl=["Gi0/1","Gi0/2","Fa0/3","Fa0/4"];
    for(let i=0;i<nPorts;i++){ const n=nb[pick(neigh)]; const sp=pl[i].startsWith("Gi")?pick(["1 Гбіт/с","1 Гбіт/с","100 Мбіт/с"]):"100 Мбіт/с";
      ports.push({p:pl[i],n,sp,cost:COST[sp],total:n.rpc+COST[sp]}); }
    if(new Set(ports.map(x=>x.n.nm)).size<ports.length && Math.random()<0.7) continue;
    // порівняння: total, потім BID сусіда, потім порт сусіда (тут — індекс)
    const cmpBid=(x,y)=>{const [p1,m1]=x.split("/"),[p2,m2]=y.split("/");return Number(p1)-Number(p2)||(m1<m2?-1:m1>m2?1:0);};
    const sorted=ports.slice().sort((a,b)=>a.total-b.total||cmpBid(a.n.bid,b.n.bid)||pl.indexOf(a.p)-pl.indexOf(b.p));
    const win=sorted[0]; const tie=sorted.length>1&&sorted[1].total===win.total;
    const o=ports.map(x=>{
      if(x===win) return [x.p,"Правильно. Вартість до root через "+x.p+": "+x.n.rpc+" + "+x.cost+" = "+x.total+"."+(tie?" Вартості рівні, тож вирішує менший BID сусіда.":"")];
      return [x.p, x.total>win.total? "Вартість "+x.n.rpc+" + "+x.cost+" = "+x.total+", більша за "+win.total+".":"Вартість така сама ("+x.total+"), але BID сусіда/порт гірший."];
    });
    o.push(["Root port не буде","У кожного не-root комутатора рівно один root port."]);
    return {id:"g-stprp#"+(++seq)+"-"+Date.now().toString(36),tid:"g-stprp",gen:true,t:"SRWE5",k:"Вибір root port",
      q:"S1 — root bridge. Який порт S4 стане root port? Вартості — короткий метод 802.1D.",
      c:"Порт S4  Сусід  Root path cost сусіда  Швидкість лінку\n"+ports.map(x=>x.p.padEnd(9)+x.n.nm.padEnd(7)+String(x.n.rpc).padEnd(23)+x.sp).join("\n")+"\n\nBID сусідів: "+neigh.filter(nm=>ports.some(x=>x.n.nm===nm)).map(nm=>nm+" "+nb[nm].bid.replace("/"," ")).join(", "),
      o,a:[ports.indexOf(win)]};
  }
}
function gStpCost(){
  const sp=Object.keys(COST); const hops=R(2,4); const path=[...Array(hops)].map(()=>pick(sp));
  const sum=path.reduce((s,x)=>s+COST[x],0);
  const d=[[String(sum+COST[path[0]]),"Перший лінк пораховано двічі."],[String(path.length*19),"Не всі лінки 100 Мбіт/с."],[String(sum-COST[path[path.length-1]]),"Не враховано останній лінк."],[String(sum*2),"Вартість рахується лише в напрямку до root, не двічі."]];
  return mc({tid:"g-stpcost",t:"SRWE5",k:"Вартість шляху STP",q:"Яка root path cost (короткий метод) для шляху з "+hops+" лінків до root bridge?",c:path.map((x,i)=>"Лінк "+(i+1)+": "+x).join("\n")},String(sum),path.map(x=>COST[x]).join(" + ")+" = "+sum+". (10 Мбіт/с — 100, 100 Мбіт/с — 19, 1 Гбіт/с — 4, 10 Гбіт/с — 2.)",shuf(d));
}
function gStpPrio(){
  const vlan=pick([1,10,20,30,99,100]); const base=pick([0,4096,8192,24576,28672,32768,61440]);
  const c=String(base+vlan);
  const d=[[String(base),"Не додано extended system ID (номер VLAN)."],[String(base+1),"Додається номер VLAN, а не 1 (крім VLAN 1)."],[String(base+vlan*4096),"Номер VLAN додається як є."],[String(32768+vlan),"Це значення за замовчуванням, а не налаштоване."]];
  return mc({tid:"g-stpprio",t:"SRWE5",k:"Пріоритет і BID",q:"На комутаторі задано spanning-tree vlan "+vlan+" priority "+base+". Який пріоритет BID покаже show spanning-tree vlan "+vlan+"?"},c,base+" + "+vlan+" (extended system ID = номер VLAN) = "+(base+vlan)+".",shuf(d));
}

const GENS={
  "g-bin":{f:gBin,name:"Двійкова / шістнадцяткова",t:"ITN5"},
  "g-subnet":{f:gSubnet,name:"Субнетинг",t:"ITN11"},
  "g-vlsm":{f:gVlsm,name:"VLSM",t:"ITN11"},
  "g-ipv6":{f:gIpv6,name:"Скорочення IPv6",t:"ITN12"},
  "g-eui":{f:gEui,name:"EUI-64",t:"ITN12"},
  "g-stproot":{f:gStpRoot,name:"STP: root bridge",t:"SRWE5"},
  "g-stprp":{f:gStpRootPort,name:"STP: root port",t:"SRWE5"},
  "g-stpcost":{f:gStpCost,name:"STP: вартість шляху",t:"SRWE5"},
  "g-stpprio":{f:gStpPrio,name:"STP: пріоритет BID",t:"SRWE5"}
};
window.GEN = {
  list: GENS,
  make(key){ const g=GENS[key]; return g? g.f(): null; },
  forTopics(topics){ return Object.entries(GENS).filter(([k,g])=>topics.has(g.t)).map(([k])=>k); },
  // назви концепцій за tid (для аналітики)
  conceptOf: {"g-bin":"Двійкова система","g-hex":"Шістнадцяткова система","g-net":"Адреса мережі","g-bc":"Broadcast-адреса","g-range":"Діапазон хостів","g-hosts":"Кількість хостів","g-vlsm":"VLSM","g-ipv6":"Скорочення IPv6","g-eui":"EUI-64","g-stproot":"Вибір root bridge","g-stprp":"Вибір root port","g-stpcost":"Вартість шляху STP","g-stpprio":"Пріоритет і BID"},
  topicOf: {"g-bin":"ITN5","g-hex":"ITN5","g-net":"ITN11","g-bc":"ITN11","g-range":"ITN11","g-hosts":"ITN11","g-vlsm":"ITN11","g-ipv6":"ITN12","g-eui":"ITN12","g-stproot":"SRWE5","g-stprp":"SRWE5","g-stpcost":"SRWE5","g-stpprio":"SRWE5"}
};
})();
