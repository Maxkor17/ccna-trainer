// Фазинг симулятора: команди з граматики з випадковими аргументами, обрізанням і сміттям на всіх пристроях усіх лаб
// (до й після розв'язання). Падає, якщо exec кидає виняток або у виводі з'являється undefined/NaN/[object Object].
// Запуск: node tests/fuzz.js   (ITER=200 SEED=7 — довший прогін)
global.window={}; global.btoa=s=>Buffer.from(s).toString("base64"); global.atob=s=>Buffer.from(s,"base64").toString();
const fs=require("fs"); const SRC=fs.readFileSync(require("path").join(__dirname,"..","public","cli.js"),"utf8"); require(require("path").join(__dirname,"..","public","cli.js")); const C=window.CLI;
// витягуємо шаблони команд з граматики
const pats={}; const re=/add\(\s*("?[\w]+"?|C|DH|R6|CM|PM|PC2|m)\s*,\s*"([^"]+)"/g; let m;
while((m=re.exec(SRC))){ let mode=m[1].replace(/"/g,""); const map={C:"config",DH:"dhcp",R6:"rtr6",CM:"cmap",PM:"pmap",PC2:"pmapc",m:"exec",M:"exec",RT:"router",AC:"acl",D6M:"dhcp6",RG:"raguard"}; mode=map[mode]||mode; (pats[mode]=pats[mode]||new Set()).add(m[2]); }
for(const mm of SRC.matchAll(/\["(show [^"]+)",/g)) (pats.exec=pats.exec||new Set()).add(mm[1]);
const P={}; for(const k in pats) P[k]=[...pats[k]]; 
let seed=Number(process.env.SEED||12345); const rnd=n=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed%n; }; const pick=a=>a[rnd(a.length)];
const WORDS=["test","TEST1","ef","af41","host","any","in","out","10","active","trap","shutdown","root","loop","none","router","default","local","yes","cisco","K3y!","GUEST","class-default"];
const fill=(p,d)=>p.replace(/<(\w+)>/g,(_,t)=>{ const ifs=Object.keys(d.ifs); return t==="if"?pick(ifs.concat(["gi0/1","fa0/1","po1","vlan 10","lo0","tu0","g0/0.10"])):t==="n"?String(pick([0,1,2,10,20,99,150,4094,65535,100000])):t==="ip"?pick(["10.0.0.1","192.168.1.1","0.0.0.0","255.255.255.255","8.8.8.8","10.255.0.2"]):t==="mask"?pick(["255.255.255.0","255.255.255.252","0.0.0.255","255.0.255.0"]):t==="v6"?pick(["2001:db8::1","fe80::1","::"]):t==="list"?pick(["10","10,20","1-4094","5-3"]):t==="rest"?pick(["x","10 20","group tacacs+ local","ef af41","#hi#"]):pick(WORDS); });
let exc=0, cmds=0; const fails=new Map();
const run=(S,dn,line)=>{ cmds++; try{ const o=S[dn].exec(line); if(typeof o!=="string") throw new Error("не рядок: "+typeof o); const bad=o.match(/.{0,40}(\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b|Infinity).{0,30}/); if(bad){ const k="ВИВІД: "+line.split(" ").slice(0,3).join(" ")+" → "+bad[0].replace(/\s+/g," "); if(!fails.has(k)) fails.set(k,dn+" ("+(N0?N0.id:"")+")> "+line); } }catch(e){ exc++; const k=e.message.slice(0,90); if(!fails.has(k)) fails.set(k,dn+"> "+line+" :: "+(e.stack||"").split("\n")[1]); } };
const ITER=Number(process.env.ITER||40);
let N0=null; for(const sc of C.NETSCEN){ N0=sc; for(const solved of [false,true]){
  let N,S; try{ if(solved){ N=C.solveNet(sc); S=C.sessionsFor(N); } else ({N,ses:S}=C.startNet(sc)); }catch(e){ exc++; fails.set("start "+sc.id,e.message); continue; }
  for(const [dn,d] of Object.entries(N.dev)){ if(!S[dn]) continue; const isPc=/^(pc|server)$/.test(d.type);
    if(isPc){ for(const c of ["ipconfig","ipconfig /all","ipconfig /renew","ipconfig /release","arp -a","ping 8.8.8.8","ping www.corp.lab","tracert 10.0.0.1","nslookup www.corp.lab","nslookup -type=mx corp.lab","dig -x 10.1.1.20","dig @10.1.1.53 x","ssh -l admin 192.168.1.1","ssh bob@1.2.3.4","telnet 192.168.1.1","curl 10.1.1.10","ip a","ifconfig","ip route","netstat -rn","route get default","getmac","stormtest","stormtest stop","dns list","dns add A x.lab 1.2.3.4","dns del x.lab","dns add bad","ipconfig /dns 10.1.1.53","ping","ping -6 2001:db8::1","ipconfig /slaac","netsh interface ip set address Ethernet0 dhcp","help","rm -rf /","ping -t 1.1.1.1","",";;;"]) run(S,dn,c); N.recompute(); continue; }
    run(S,dn,"enable");
    for(const p of P.exec) run(S,dn,fill(p,d));
    run(S,dn,"conf t");
    for(let k=0;k<ITER;k++){ const mode=pick(["config","config","if","if","line","router","acl","dhcp","rtr6","cmap","pmap","pmapc","raguard","tacsrv","dhcp6","vlan"]);
      if(mode==="if") run(S,dn,"interface "+pick(Object.keys(d.ifs).concat(["range fa0/1 - 3","vlan 99","g0/0.20","tunnel 1","lo5","po2"])));
      else if(mode==="line") run(S,dn,"line vty 0 4"); else if(mode==="router") run(S,dn,"router ospf 1"); else if(mode==="acl") run(S,dn,"ip access-list extended FZ"); else if(mode==="dhcp") run(S,dn,"ip dhcp pool FZ"); else if(mode==="rtr6") run(S,dn,"ipv6 router ospf 1"); else if(mode==="cmap") run(S,dn,"class-map FZ"); else if(mode==="pmap") run(S,dn,"policy-map FZ"); else if(mode==="pmapc"){ run(S,dn,"policy-map FZ"); run(S,dn,"class class-default"); } else if(mode==="raguard") run(S,dn,"ipv6 nd raguard policy FZ"); else if(mode==="tacsrv") run(S,dn,"tacacs server FZ"); else if(mode==="dhcp6") run(S,dn,"ipv6 dhcp pool FZ6"); else if(mode==="vlan") run(S,dn,"vlan 77");
      const list=P[mode]||P.config; let c=fill(pick(list),d); if(rnd(5)===0) c=c.split(" ").slice(0,1+rnd(3)).join(" "); if(rnd(9)===0) c=c+" garbage"; if(rnd(12)===0) c="no "+c; run(S,dn,c); if(rnd(4)===0){ run(S,dn,"exit"); } if(rnd(7)===0){ try{ N.recompute(); }catch(e){ exc++; fails.set("recompute "+e.message.slice(0,80),sc.id+" "+dn+" after "+c+" :: "+(e.stack||"").split("\n")[1]); } } }
    run(S,dn,"end"); for(const p of P.exec) run(S,dn,fill(p,d)); run(S,dn,"write memory"); run(S,dn,"copy running-config startup-config"); run(S,dn,""); }
  try{ N.recompute(); sc.check(N); }catch(e){ exc++; fails.set("check "+sc.id+" "+e.message.slice(0,60),(e.stack||"").split("\n")[1]); }
  try{ C.figOf(N,[]); }catch(e){ exc++; fails.set("figOf "+sc.id,e.message); }
  try{ for(const [a] of Object.entries(N.dev)) for(const [b,db] of Object.entries(N.dev)) if(db.ip) N.ping(a,db.ip); }catch(e){ exc++; fails.set("ping "+sc.id+" "+e.message.slice(0,60),(e.stack||"").split("\n")[1]); }
}}
// одиночні сценарії
for(const sc of C.SCEN){ const s=C.startScenario(sc); s.exec("enable"); s.exec("conf t"); for(let k=0;k<ITER;k++){ cmds++; try{ s.exec(fill(pick(P.config.concat(P.if||[])),s.state)); }catch(e){ exc++; fails.set(e.message.slice(0,90),sc.id); } } try{ sc.check(s.state); }catch(e){ exc++; fails.set("check1 "+sc.id,e.message); } }
for(const [k,v] of fails) console.log("✗",k,"\n   ",v);
console.log(fails.size? "\n❌ Фазинг: проблем "+fails.size+" (команд "+cmds+")" : "\n✅ Фазинг симулятора: "+cmds+" команд без винятків");
process.exit(fails.size?1:0);
