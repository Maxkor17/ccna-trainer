// ---------- «Невідома мережа»: генератор, еталон і перевірка карти ----------
const DISC_NAMES=[["CORE","SW-CORE"],["DIST","SW-DIST"],["ACC","SW-ACC"],["EDGE","R-EDGE"],["BR","R-BR"]];
function discoverNet(){ const rnd=n=>Math.floor(Math.random()*n); const pick=a=>a[rnd(a.length)];
  const nSw=3+rnd(3), nR=1+rnd(2); const names=[]; const sws=[], rs=[]; const used=new Set();
  for(let i=0;i<nSw;i++){ let n; do{ n=pick(["SW-CORE","SW-DIST1","SW-DIST2","SW-ACC1","SW-ACC2","SW-ACC3","SW-LAB","SW-FLOOR2","SW-SRV"]); }while(used.has(n)); used.add(n); sws.push(n); }
  for(let i=0;i<nR;i++){ let n; do{ n=pick(["R-EDGE","R-BRANCH","R-WAN","R-DMZ"]); }while(used.has(n)); used.add(n); rs.push(n); }
  const all=sws.concat(rs); const devices={}; const free={}; let ipn=11;
  for(const n of sws){ devices[n]={type:"switch",setup:(s=>{ const ip="10.99.0."+(s._ipn); s.ifs.Vlan1=Object.assign(newIf("Vlan1"),{svi:true,ip,mask:M24,shutdown:false}); })}; free[n]=rng("Fa0/",1,24).concat(["Gi0/1","Gi0/2"]); }
  for(const n of rs){ devices[n]={type:"router"}; free[n]=["Gi0/0","Gi0/1","Gi0/2"]; }
  const takeP=(n,pref)=>{ const f=free[n]; let k=pref==="gi"?f.findIndex(p=>/^Gi/.test(p)):-1; if(k<0) k=rnd(f.length); if(pref!=="gi"&&/^Gi/.test(f[k])&&f.some(p=>/^Fa/.test(p))&&rnd(2)) k=f.findIndex(p=>/^Fa/.test(p))+rnd(4); k=Math.min(Math.max(k,0),f.length-1); return f.splice(k,1)[0]; };
  const links=[]; const order=sws.slice().sort(()=>Math.random()-0.5);
  for(let i=1;i<order.length;i++){ const a=order[i], b=order[rnd(i)]; links.push([a,takeP(a,"gi"),b,takeP(b)]); }
  if(order.length>=3&&rnd(2)){ const a=order[order.length-1], b=order[0]; if(!links.some(l=>(l[0]===a&&l[2]===b)||(l[0]===b&&l[2]===a))) links.push([a,takeP(a),b,takeP(b)]); }
  rs.forEach((r,i)=>{ const sw=pick(sws); links.push([r,"Gi0/"+i,sw,takeP(sw,"gi")]); free[r]=free[r].filter(p=>p!=="Gi0/"+i); });
  // адреси: комутатори — Vlan1, маршрутизатори — інтерфейс до комутатора
  const ips={}; sws.forEach(n=>{ ips[n]=ipn++; }); rs.forEach((r,i)=>{ ips[r]=1+i; });
  for(const n of sws){ const k=ips[n]; devices[n].setup=s=>{ s.ifs.Vlan1=Object.assign(newIf("Vlan1"),{svi:true,ip:"10.99.0."+k,mask:M24,shutdown:false}); for(const p of Object.keys(s.ifs)) if(/^(Fa|Gi)/.test(p)&&links.some(l=>(l[0]===n&&l[1]===p)||(l[2]===n&&l[3]===p))) s.ifs[p].mode="trunk"; }; }
  rs.forEach((r,i)=>{ const p=links.find(l=>l[0]===r)[1]; devices[r].setup=s=>{ IP(s,p,"10.99.0."+(1+i),M24); }; });
  // кілька ПК на access-портах
  let pcs=0; for(const n of sws) if(rnd(3)>0){ pcs++; const nm="PC"+pcs; devices[nm]={type:"pc",ip:"10.99.0."+(100+pcs),mask:M24}; links.push([nm,"Fa0",n,takeP(n)]); }
  const start=order[0]; return {devices,links,start}; }
function discoverTruth(N){ const net=Object.keys(N.dev).filter(d=>N.dev[d].type==="switch"||N.dev[d].type==="router"); const L=[];
  for(const l of N.links) if(net.includes(l.a)&&net.includes(l.b)) L.push([l.a,l.pa,l.b,l.pb]);
  const text=L.map(l=>l[0]+" "+l[1]+" — "+l[2]+" "+l[3]).concat(net.map(d=>d+" "+N.mgmtIp(d))).join("\n"); return {net,links:L,text}; }
function discoverParse(text){ const links=[], ips={}; const bad=[];
  for(const raw of String(text||"").split("\n")){ const t=raw.trim(); if(!t||t.startsWith("#")) continue;
    let m=t.match(/^([\w.-]+)\s+((?:[A-Za-z-]+)\s*\d+(?:\/\d+)*)\s*(?:—|–|-|<->|<-+>|=+|,|\s)\s*([\w.-]+)\s+((?:[A-Za-z-]+)\s*\d+(?:\/\d+)*)$/);
    if(m){ const pa=normIf(m[2]), pb=normIf(m[4]); if(pa&&pb){ links.push([m[1].toUpperCase(),pa,m[3].toUpperCase(),pb]); continue; } }
    m=t.match(/^([\w.-]+)\s*[:\s]\s*(\d+\.\d+\.\d+\.\d+)$/); if(m){ ips[m[1].toUpperCase()]=m[2]; continue; } bad.push(t); }
  return {links,ips,bad}; }
function discoverCheck(N){ const T=discoverTruth(N); const U=discoverParse(N._map); const key=l=>[l[0].toUpperCase()+" "+l[1],l[2].toUpperCase()+" "+l[3]].sort().join(" — ");
  const want=new Set(T.links.map(key)), got=new Set(U.links.map(key)); const miss=[...want].filter(k=>!got.has(k)), extra=[...got].filter(k=>!want.has(k));
  const devs=new Set(U.links.flatMap(l=>[l[0],l[2]]).concat(Object.keys(U.ips))); const missDev=T.net.filter(d=>!devs.has(d.toUpperCase()));
  const badIp=T.net.filter(d=>U.ips[d.toUpperCase()]!==N.mgmtIp(d));
  return [[!missDev.length,"Знайдено всі мережеві пристрої ("+T.net.length+")"+(missDev.length&&N._map?" — бракує: "+missDev.length:"")],
    [!!N._map&&!miss.length,"Усі лінки між пристроями ("+want.size+")"+(miss.length&&N._map?" — бракує: "+miss.length:"")],
    [!!N._map&&!extra.length,"Немає зайвих або помилкових лінків"+(extra.length?": "+extra.join("; "):"")],
    [!!N._map&&!badIp.length,"IP керування вказано для кожного пристрою"+(badIp.length&&N._map?" — не так або немає: "+badIp.length:"")],
    [!U.bad.length,"Усі рядки карти розпізнано"+(U.bad.length?": «"+U.bad.slice(0,2).join("», «")+"»":"")]]; }
function showCdpDetail(s){ if(!s.net) return ""; const N=s.net; const R=N.cdpNbrs(s.devName); if(!R.length) return "";
  return R.map(r=>{ const od=N.dev[r.dev]; const ip=N.mgmtIp(r.dev); const nv=s.ifs[r.me]&&s.ifs[r.me].nativeVlan||1;
    return "-------------------------\nDevice ID: "+r.dev+"\nEntry address(es): \n"+(ip?"  IP address: "+ip+"\n":"")+"Platform: "+(od.type==="router"?"cisco ISR4321":"cisco WS-C2960-24TT-L")+",  Capabilities: "+(od.type==="router"?"Router Source-Route-Bridge":"Switch IGMP")+"\nInterface: "+longIf(r.me)+",  Port ID (outgoing port): "+longIf(r.po)+"\nHoldtime : 160 sec\n\nVersion :\nCisco IOS Software, "+(od.type==="router"?"ISR Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 16.9.4":"C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE11")+"\n\nadvertisement version: 2\n"+(od.type==="router"?"":"Native VLAN: "+nv+"\n")+"Duplex: full\nManagement address(es): \n"+(ip?"  IP address: "+ip+"\n":""); }).join("\n")+"\n\nTotal cdp entries displayed : "+R.length; }
for(const m of ["user","exec"]){ add(m,"show ip dhcp conflict",s=>{ const c=Object.entries((s.dhcp||{}).conflicts||{}); return "IP address        Detection method   Detection time          VRF\n"+c.map(([ip,t])=>ip.padEnd(18)+"Ping".padEnd(19)+new Date(t).toUTCString().slice(5,25)).join("\n"); }); }
add("exec","clear ip dhcp conflict *",s=>{ if(s.dhcp) s.dhcp.conflicts={}; return ""; });
for(const m of ["user","exec"]){ add(m,"show cdp neighbors detail",s=>showCdpDetail(s)); add(m,"show cdp entry <w>",(s,a)=>{ const t=showCdpDetail(s).split("-------------------------\n").find(x=>x.startsWith("Device ID: "+a[0]+"\n")); return t? "-------------------------\n"+t.trim() : ""; }); }
const NETSCEN=[
 {id:"net-trunk",net:true,t:"SRWE3",title:"Два комутатори: VLAN і trunk",
  topo:"PC1 (VLAN10) — S1 Fa0/1      S2 Fa0/1 — PC2 (VLAN10)\nPC3 (VLAN20) — S1 Fa0/2      S2 Fa0/2 — PC4 (VLAN20)\n                S1 Gi0/1 ════ S2 Gi0/1",
  task:["На S1 VLAN 10/20 і access-порти вже є. На S2 — нічого.","Створіть VLAN 10 і 20 на S2, Fa0/1 → VLAN 10, Fa0/2 → VLAN 20 (access).","Зробіть Gi0/1 між S1 і S2 trunk-ом з native VLAN 99 на обох (створіть VLAN 99).","Перевірте: PC1 → ping 192.168.10.12, PC3 → ping 192.168.20.14."],
  def:()=>({devices:{S1:{type:"switch",vlans:{10:"Users",20:"Admin"},setup:s=>{s.ifs["Fa0/1"].mode="access";s.ifs["Fa0/1"].accessVlan=10;s.ifs["Fa0/2"].mode="access";s.ifs["Fa0/2"].accessVlan=20;}},S2:{type:"switch"},
    PC1:{type:"pc",ip:"192.168.10.11",mask:"255.255.255.0",gw:"192.168.10.1"},PC2:{type:"pc",ip:"192.168.10.12",mask:"255.255.255.0",gw:"192.168.10.1"},PC3:{type:"pc",ip:"192.168.20.13",mask:"255.255.255.0",gw:"192.168.20.1"},PC4:{type:"pc",ip:"192.168.20.14",mask:"255.255.255.0",gw:"192.168.20.1"}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC3","Fa0","S1","Fa0/2"],["PC2","Fa0","S2","Fa0/1"],["PC4","Fa0","S2","Fa0/2"],["S1","Gi0/1","S2","Gi0/1"]]}),
  check:N=>{const a=N.dev.S1.ifs["Gi0/1"],b=N.dev.S2.ifs["Gi0/1"]; return [[pass(N,"PC1","192.168.10.12"),"PC1 ↔ PC2 (VLAN 10) пінгуються"],[pass(N,"PC3","192.168.20.14"),"PC3 ↔ PC4 (VLAN 20) пінгуються"],[operTrunk(a)&&operTrunk(b),"Gi0/1 — trunk з обох боків"],[a.nativeVlan===99&&b.nativeVlan===99,"Native VLAN 99 на обох кінцях"],[!pass(N,"PC1","192.168.20.14"),"VLAN 10 і 20 ізольовані (без маршрутизатора)"]];},
  sol:"S2:\nenable\nconf t\nvlan 10\nvlan 20\nvlan 99\nexit\ninterface fa0/1\n switchport mode access\n switchport access vlan 10\ninterface fa0/2\n switchport mode access\n switchport access vlan 20\ninterface gi0/1\n switchport mode trunk\n switchport trunk native vlan 99\nend\n\nS1:\nenable\nconf t\nvlan 99\ninterface gi0/1\n switchport mode trunk\n switchport trunk native vlan 99\nend"},
 {id:"net-roas",net:true,t:"SRWE4",title:"Router-on-a-stick",
  topo:"PC1 (VLAN10) — S1 Fa0/1\nPC2 (VLAN20) — S1 Fa0/2\n                S1 Gi0/1 ════ R1 Gi0/0",
  task:["S1: VLAN 10/20 і access-порти вже налаштовано.","Зробіть S1 Gi0/1 trunk-ом.","R1: субінтерфейси Gi0/0.10 (192.168.10.1/24) і Gi0/0.20 (192.168.20.1/24), увімкніть Gi0/0.","Перевірте: PC1 → ping 192.168.20.12."],
  def:()=>({devices:{S1:{type:"switch",vlans:{10:"Users",20:"Admin"},setup:s=>{s.ifs["Fa0/1"].mode="access";s.ifs["Fa0/1"].accessVlan=10;s.ifs["Fa0/2"].mode="access";s.ifs["Fa0/2"].accessVlan=20;}},R1:{type:"router"},
    PC1:{type:"pc",ip:"192.168.10.11",mask:"255.255.255.0",gw:"192.168.10.1"},PC2:{type:"pc",ip:"192.168.20.12",mask:"255.255.255.0",gw:"192.168.20.1"}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["S1","Gi0/1","R1","Gi0/0"]]}),
  check:N=>{const r=N.dev.R1.ifs; return [[operTrunk(N.dev.S1.ifs["Gi0/1"]),"S1 Gi0/1 — trunk"],[r["Gi0/0.10"]&&r["Gi0/0.10"].encap===10,"Gi0/0.10 — encapsulation dot1Q 10"],[r["Gi0/0.20"]&&r["Gi0/0.20"].encap===20,"Gi0/0.20 — encapsulation dot1Q 20"],[!r["Gi0/0"].shutdown,"Gi0/0 увімкнено"],[pass(N,"PC1","192.168.10.1"),"PC1 пінгує свій шлюз"],[pass(N,"PC1","192.168.20.12"),"PC1 ↔ PC2 через R1"]];},
  sol:"S1:\nenable\nconf t\ninterface gi0/1\n switchport mode trunk\nend\n\nR1:\nenable\nconf t\ninterface gi0/0.10\n encapsulation dot1Q 10\n ip address 192.168.10.1 255.255.255.0\ninterface gi0/0.20\n encapsulation dot1Q 20\n ip address 192.168.20.1 255.255.255.0\ninterface gi0/0\n no shutdown\nend"},
 {id:"net-fix",net:true,t:"SRWE4",title:"Знайди й виправ: маршрутизація між VLAN",
  topo:"PC1 (VLAN10) — S1 Fa0/1\nPC2 (VLAN20) — S1 Fa0/2\n                S1 Gi0/1 ════ R1 Gi0/0",
  task:["Скарга: PC1 не бачить PC2, і PC2 не пінгує свій шлюз 192.168.20.1.","Знайдіть і виправте всі помилки на S1 і R1 (ПК налаштовано правильно).","Корисно: show interfaces trunk, show vlan brief, show run, show ip interface brief, ping з ПК."],
  def:()=>({devices:{S1:{type:"switch",vlans:{10:"Users",20:"Admin"},setup:s=>{s.ifs["Fa0/1"].mode="access";s.ifs["Fa0/1"].accessVlan=10;s.ifs["Fa0/2"].mode="access";s.ifs["Fa0/2"].accessVlan=20;s.ifs["Gi0/1"].mode="trunk";s.ifs["Gi0/1"].allowed=[10];}},
    R1:{type:"router",setup:s=>{s.ifs["Gi0/0"].shutdown=false; s.ifs["Gi0/0.10"]=Object.assign(newIf("Gi0/0.10"),{switchport:false,sub:true,encap:10,native:false,ip:"192.168.10.1",mask:"255.255.255.0"}); s.ifs["Gi0/0.20"]=Object.assign(newIf("Gi0/0.20"),{switchport:false,sub:true,encap:30,native:false,ip:"192.168.20.1",mask:"255.255.255.0"});}},
    PC1:{type:"pc",ip:"192.168.10.11",mask:"255.255.255.0",gw:"192.168.10.1"},PC2:{type:"pc",ip:"192.168.20.12",mask:"255.255.255.0",gw:"192.168.20.1"}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["S1","Gi0/1","R1","Gi0/0"]]}),
  check:N=>[[pass(N,"PC2","192.168.20.1"),"PC2 пінгує шлюз 192.168.20.1"],[pass(N,"PC1","192.168.20.12"),"PC1 ↔ PC2"]],
  sol:"S1:\nenable\nconf t\ninterface gi0/1\n switchport trunk allowed vlan add 20\nend\n\nR1:\nenable\nconf t\ninterface gi0/0.20\n encapsulation dot1Q 20\n ip address 192.168.20.1 255.255.255.0\nend\n\n(Після зміни encapsulation IOS прибирає IP з субінтерфейсу — задайте його знову.)"},
 {id:"net-static",net:true,t:"SRWE15",title:"Статична маршрутизація між двома маршрутизаторами",
  topo:"PC1 192.168.1.10 — R1 Gi0/0      R2 Gi0/0 — PC2 192.168.2.10\n                    R1 Gi0/1 ════ R2 Gi0/1   (10.0.0.0/30)",
  task:["Інтерфейси R1 і R2 вже мають адреси й увімкнені.","Налаштуйте статичні маршрути, щоб PC1 і PC2 пінгували одне одного.","Підказка: маршрут потрібен в обох напрямках. Перевірте show ip route і tracert з ПК."],
  def:()=>({devices:{R1:{type:"router",setup:s=>{Object.assign(s.ifs["Gi0/0"],{ip:"192.168.1.1",mask:"255.255.255.0",shutdown:false});Object.assign(s.ifs["Gi0/1"],{ip:"10.0.0.1",mask:"255.255.255.252",shutdown:false});}},
    R2:{type:"router",setup:s=>{Object.assign(s.ifs["Gi0/0"],{ip:"192.168.2.1",mask:"255.255.255.0",shutdown:false});Object.assign(s.ifs["Gi0/1"],{ip:"10.0.0.2",mask:"255.255.255.252",shutdown:false});}},
    PC1:{type:"pc",ip:"192.168.1.10",mask:"255.255.255.0",gw:"192.168.1.1"},PC2:{type:"pc",ip:"192.168.2.10",mask:"255.255.255.0",gw:"192.168.2.1"}},
    links:[["PC1","Fa0","R1","Gi0/0"],["PC2","Fa0","R2","Gi0/0"],["R1","Gi0/1","R2","Gi0/1"]]}),
  check:N=>[[pass(N,"PC1","192.168.2.10"),"PC1 ↔ PC2"],[N.dev.R1.routes.length>0,"Статичний маршрут на R1"],[N.dev.R2.routes.length>0,"Статичний маршрут на R2"]],
  sol:"R1:\nenable\nconf t\nip route 192.168.2.0 255.255.255.0 10.0.0.2\nend\n\nR2:\nenable\nconf t\nip route 192.168.1.0 255.255.255.0 10.0.0.1\nend"},
 {id:"net-stp",net:true,t:"SRWE5",title:"STP: обери root bridge",
  topo:"        S1\n  Gi0/1 ║  ║ Gi0/2\n  Gi0/1 ║  ║ Gi0/1\n     S2 ═══ S3   (S2 Gi0/2 ═ S3 Gi0/2)",
  task:["Три комутатори з'єднано трикутником, усе за замовчуванням.","Подивіться show spanning-tree на кожному: хто root і який порт заблоковано?","Зробіть S2 root bridge для VLAN 1, а S3 — резервним root.","Перевірте, що на S2 «This bridge is the root»."],
  def:()=>({devices:{S1:{type:"switch",mac:"0019.e811.1a00"},S2:{type:"switch",mac:"0019.e822.1a00"},S3:{type:"switch",mac:"0019.e833.1a00"}},
    links:[["S1","Gi0/1","S2","Gi0/1"],["S1","Gi0/2","S3","Gi0/1"],["S2","Gi0/2","S3","Gi0/2"]]}),
  check:N=>{const i=N.stp(1)||{}; const pr=d=>N.dev[d].stpPrio[1]!==undefined?N.dev[d].stpPrio[1]:32768; return [[i.S2&&i.S2.rootName==="S2","S2 — root bridge для VLAN 1"],[pr("S3")<pr("S1")&&pr("S3")>pr("S2"),"S3 — резервний root (пріоритет між S2 і S1)"]];},
  sol:"S2:\nenable\nconf t\nspanning-tree vlan 1 root primary\nend\n\nS3:\nenable\nconf t\nspanning-tree vlan 1 root secondary\nend\n\nshow spanning-tree"},
