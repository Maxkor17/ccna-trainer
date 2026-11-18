// Генератори зі схемами: ролі портів STP, вибори DR/BDR, шлях OSPF, трасування ACL, NAT, заповнення конфігурації.
(function(){
const G=window.GEN; if(!G) return;
const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const ip2n=s=>s.split(".").reduce((a,o)=>a*256+Number(o),0)>>>0;
const n2ip=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join(".");
const maskOf=p=>p===0?0:(0xFFFFFFFF<<(32-p))>>>0;
let seq=0; const uid=t=>t+"#"+(++seq)+"-"+Date.now().toString(36);
function mc(base, correct, cExp, distr){
  const seen=new Set([correct]); const o=[[correct,"Правильно. "+cExp]];
  for(const [t,e] of distr){ if(o.length>=4) break; if(!seen.has(t)){seen.add(t);o.push([t,e]);} }
  return Object.assign({id:uid(base.tid), gen:true, o, a:[0]}, base);
}
const rmac=()=>{ const h=()=>R(0,255).toString(16).padStart(2,"0"); return "00"+h()+"."+h()+h()+"."+h()+h(); };

// ---------- STP: ролі всіх портів у трикутнику ----------
function gStpRoles(){
  const names=["S1","S2","S3"]; const pr={}, mac={};
  const prs=shuf([pick([4096,8192,24576,28672,32768]),32768,32768]);
  names.forEach((n,i)=>{ pr[n]=prs[i]; mac[n]=rmac(); });
  const bidLess=(a,b)=>pr[a]!==pr[b]? pr[a]<pr[b] : mac[a]<mac[b];
  const links=[["S1","S2"],["S1","S3"],["S2","S3"]].map(([a,b])=>({a,b,sp:Math.random()<0.65?"Gi":"Fa"}));
  const cnt={S1:{Gi:0,Fa:0},S2:{Gi:0,Fa:0},S3:{Gi:0,Fa:0}};
  for(const l of links){ l.pa=l.sp+"0/"+(++cnt[l.a][l.sp]); l.pb=l.sp+"0/"+(++cnt[l.b][l.sp]); l.cost=l.sp==="Gi"?4:19; }
  const root=names.slice().sort((a,b)=>bidLess(a,b)?-1:1)[0];
  const dist={}; names.forEach(n=>dist[n]=n===root?0:Infinity);
  for(let k=0;k<3;k++) for(const l of links){ if(dist[l.a]+l.cost<dist[l.b]) dist[l.b]=dist[l.a]+l.cost; if(dist[l.b]+l.cost<dist[l.a]) dist[l.a]=dist[l.b]+l.cost; }
  const rp={}; const why=[];
  for(const n of names){ if(n===root) continue;
    const c=links.filter(l=>l.a===n||l.b===n).map(l=>{ const me=l.a===n?l.pa:l.pb, nb=l.a===n?l.b:l.a, np=l.a===n?l.pb:l.pa; return {me,nb,np,c:dist[nb]+l.cost}; });
    c.sort((x,y)=>x.c-y.c|| (bidLess(x.nb,y.nb)?-1:bidLess(y.nb,x.nb)?1:0) || x.np.localeCompare(y.np));
    rp[n]=c[0].me; why.push(n+": root port "+c[0].me+" (вартість до root "+c[0].c+(c[1]&&c[1].c===c[0].c?", нічия за вартістю — вирішує BID сусіда/ID порту":"")+")"); }
  const pairs=[];
  for(const l of links){
    let aD; if(l.a===root) aD=true; else if(l.b===root) aD=false; else aD= dist[l.a]<dist[l.b] || (dist[l.a]===dist[l.b] && bidLess(l.a,l.b));
    const role=(n,p,isD)=> rp[n]===p? "Root port" : isD? "Designated" : "Alternate (блокується)";
    pairs.push([l.a+" "+l.pa, role(l.a,l.pa,aD)],[l.b+" "+l.pb, role(l.b,l.pb,!aD)]);
    if(l.a!==root&&l.b!==root) why.push("Сегмент "+l.a+"–"+l.b+": designated — "+(aD?l.a:l.b)+(dist[l.a]===dist[l.b]?" (однакова вартість до root, нижчий BID)":" (менша вартість до root)"));
  }
  const pos={S1:[50,4],S2:[19,46],S3:[81,46]};
  const fig={h:64,nodes:names.map(n=>({id:n,t:"sw",x:pos[n][0],y:pos[n][1],sub:"prio "+pr[n]+" · "+mac[n]})),links:links.map(l=>({a:l.a,b:l.b,la:l.pa,lb:l.pb,m:(l.sp==="Gi"?"1 Гбіт/с":"100 Мбіт/с")}))};
  return {id:uid("g-stproles"),tid:"g-stproles",gen:true,type:"match",t:"SRWE5",k:"Ролі портів STP",fig,choices:["Root port","Designated","Alternate (блокується)"],
    q:"Визначте роль кожного порту в STP (вартості 802.1D: 1 Гбіт/с = 4, 100 Мбіт/с = 19; у пріоритеті вже враховано VLAN 1).",
    pairs:shuf(pairs),e:"Root bridge — "+root+" (найменший BID: пріоритет, потім MAC). Усі порти root bridge — designated. "+why.join(". ")+". Порт, що не root і не designated, — alternate (блокується)."};
}
// ---------- OSPF: вибори DR/BDR ----------
function gDrBdr(){
  const n=R(3,4); const rs=[]; const usedRid=new Set();
  for(let i=1;i<=n;i++){ let rid; do{ rid=pick([R(1,9)+"."+R(1,9)+"."+R(1,9)+"."+R(1,9), "10.0.0."+R(1,99), "192.168.1."+R(1,254)]); }while(usedRid.has(rid)); usedRid.add(rid);
    rs.push({id:"R"+i,prio:pick([0,1,1,1,10,100,255]),rid}); }
  if(rs.every(r=>r.prio===0)) rs[0].prio=1;
  const el=rs.filter(r=>r.prio>0).sort((a,b)=>b.prio-a.prio||ip2n(b.rid)-ip2n(a.rid));
  const dr=el[0], bdr=el[1]; const askB=Math.random()<0.4&&bdr;
  const fig={h:46,nodes:[{id:"SW",t:"sw",x:50,y:30,l:"S1"}].concat(rs.map((r,i)=>({id:r.id,t:"r",x:10+i*(80/(n-1)),y:2,sub:"prio "+r.prio+" · RID "+r.rid}))),links:rs.map(r=>({a:r.id,b:"SW"}))};
  const target=askB?bdr:dr;
  const distr=rs.filter(r=>r!==target).map(r=>[r.id, r.prio===0? r.id+" має priority 0 — він ніколи не стає DR чи BDR." : r===dr&&askB? r.id+" стане DR (найвищий пріоритет/RID), а BDR — наступний." : r===bdr&&!askB? r.id+" стане лише BDR — у нього нижчий пріоритет або RID." : r.id+": пріоритет "+r.prio+", RID "+r.rid+" — програє за пріоритетом/RID."]);
  distr.push(["Жоден — DR обирають лише на point-to-point","Навпаки: на point-to-point DR/BDR не обирають, а на спільному Ethernet-сегменті — обирають."]);
  return mc({tid:"g-drbdr",t:"ENSA1",k:"Вибори DR/BDR",fig,q:"Усі маршрутизатори запустили OSPF одночасно на спільному сегменті. Хто стане "+(askB?"BDR":"DR")+"?"},target.id,
    "Порівнюємо спершу пріоритет інтерфейсу (вищий кращий; 0 — не бере участі), за рівності — Router ID (вищий кращий). Порядок: "+el.map(r=>r.id+" ("+r.prio+", "+r.rid+")").join(" > ")+". DR — "+dr.id+(bdr?", BDR — "+bdr.id:"")+".",shuf(distr));
}
// ---------- OSPF: найкращий шлях за вартістю ----------
function gOspfPath(){
  const nodes=["R1","R2","R3","R4"]; const pos={R1:[8,26],R2:[50,2],R3:[50,50],R4:[92,26]};
  const ed=[["R1","R2"],["R1","R3"],["R2","R4"],["R3","R4"],["R2","R3"]].map(([a,b])=>({a,b,c:pick([1,1,2,5,10,10,20,64])}));
  const dist={R1:0}, prev={}; nodes.forEach(n=>{ if(n!=="R1") dist[n]=Infinity; }); const done=new Set();
  while(done.size<4){ const u=nodes.filter(n=>!done.has(n)).sort((a,b)=>dist[a]-dist[b])[0]; done.add(u); for(const e of ed){ const v=e.a===u?e.b:e.b===u?e.a:null; if(!v) continue; if(dist[u]+e.c<dist[v]){ dist[v]=dist[u]+e.c; prev[v]=[u]; } else if(dist[u]+e.c===dist[v]&&!(prev[v]||[]).includes(u)) (prev[v]=prev[v]||[]).push(u); } }
  const lan=4; const total=dist.R4+1;
  const paths=[]; const walk=(n,acc)=>{ if(n==="R1"){ paths.push(["R1"].concat(acc)); return; } for(const p of prev[n]||[]) walk(p,[n].concat(acc)); }; walk("R4",[]);
  const allPaths=[["R1","R2","R4"],["R1","R3","R4"],["R1","R2","R3","R4"],["R1","R3","R2","R4"]].map(p=>({p,c:p.slice(1).reduce((s,n,i)=>s+ed.find(e=>(e.a===p[i]&&e.b===n)||(e.b===p[i]&&e.a===n)).c,0)}));
  const fig={h:60,nodes:nodes.map(n=>({id:n,t:"r",x:pos[n][0],y:pos[n][1]})).concat([{id:"LAN",t:"pc",x:92,y:52,l:"LAN R4",sub:"cost 1"}]),links:ed.map(e=>({a:e.a,b:e.b,m:"cost "+e.c,mdy:-6})).concat([{a:"R4",b:"LAN"}])};
  if(paths.length>1||Math.random()<0.5){
    return mc({tid:"g-ospfpath",t:"ENSA2",k:"Найкращий шлях OSPF",fig,q:"Яку метрику (вартість) матиме на R1 маршрут до LAN за R4? Вартості вказано для кожного лінку, LAN-інтерфейс R4 має cost 1."},String(total),
      "Найкоротший шлях: "+paths.map(p=>p.join("→")).join(" або ")+" = "+dist.R4+", плюс cost LAN-інтерфейсу 1 → "+total+". OSPF сумує вартості вихідних інтерфейсів уздовж шляху.",
      allPaths.filter(x=>x.c+1!==total).map(x=>[String(x.c+1),"Це вартість шляху "+x.p.join("→")+" (+1 за LAN) — він не найкращий."]).concat([[String(dist.R4),"Забули додати вартість LAN-інтерфейсу R4."],[String(paths[0].length-1),"Це кількість переходів (як у RIP), а OSPF рахує суму вартостей."]]));
  }
  const nh=paths[0][1];
  return mc({tid:"g-ospfpath",t:"ENSA2",k:"Найкращий шлях OSPF",fig,q:"Через який сусідній маршрутизатор R1 відправлятиме трафік у LAN за R4?"},nh,
    "Найкоротший шлях "+paths[0].join("→")+" має вартість "+dist.R4+" (+1 за LAN). Next-hop — перший маршрутизатор на цьому шляху.",
    [[nh==="R2"?"R3":"R2","Шлях через нього дорожчий: "+allPaths.filter(x=>x.p[1]!==nh).map(x=>x.p.join("→")+"="+x.c).join(", ")+"."],["Через обидва порівну (ECMP)","Балансування було б лише за однакової вартості, а тут вона різна."],["R4 напряму","R1 і R4 не з'єднані напряму."]]);
}
// ---------- ACL: який рядок спрацює ----------
function gAclTrace(){
  const X=R(1,4)*10, Y=X+10, srvH=R(10,50);
  const netX="192.168."+X+".0", netY="192.168."+Y+".0", srv="10.1.1."+srvH;
  const rules=shuf([
    {t:"deny tcp "+netX+" 0.0.0.255 host "+srv+" eq 22",m:p=>p.proto==="tcp"&&p.sn===X&&p.dst===srv&&p.port===22},
    {t:"permit tcp "+netX+" 0.0.0.255 host "+srv+" eq www",m:p=>p.proto==="tcp"&&p.sn===X&&p.dst===srv&&p.port===80},
    {t:"deny icmp any host "+srv+" echo",m:p=>p.proto==="icmp"&&p.dst===srv},
    {t:"permit ip "+netY+" 0.0.0.255 any",m:p=>p.sn===Y}]).slice(0,3).concat(Math.random()<0.5?[{t:"permit ip any any",m:()=>true}]:[]);
  const pk=pick([{proto:"tcp",port:22,txt:"SSH (TCP 22)"},{proto:"tcp",port:80,txt:"HTTP (TCP 80)"},{proto:"icmp",port:null,txt:"ping (ICMP echo)"},{proto:"tcp",port:443,txt:"HTTPS (TCP 443)"}]);
  const sn=pick([X,Y]); const p={proto:pk.proto,port:pk.port,sn,dst:srv};
  const idx=rules.findIndex(r=>r.m(p)); const cfg="ip access-list extended FILTER\n"+rules.map((r,i)=>" "+((i+1)*10)+" "+r.t).join("\n");
  const ans= idx<0? "Заборонено неявним deny any в кінці ACL" : (rules[idx].t.startsWith("permit")?"Дозволено":"Заборонено")+" рядком "+((idx+1)*10);
  const d=[]; for(let i=0;i<rules.length;i++){ const t=(rules[i].t.startsWith("permit")?"Дозволено":"Заборонено")+" рядком "+((i+1)*10); if(t!==ans) d.push([t, rules[i].m(p)? "Цей рядок теж збігся б, але ACL зупиняється на першому збігу." : "Рядок "+((i+1)*10)+" не відповідає пакету (джерело, протокол чи порт інші)."]); }
  if(ans.indexOf("неявним")<0) d.push(["Заборонено неявним deny any в кінці ACL","До неявного deny пакет не доходить — раніше спрацьовує явний рядок."]);
  d.push(["ACL не перевіряє цей пакет — він вихідний","Напрямок важить для розміщення, але якщо ACL застосовано на шляху пакета, його перевіряють."]);
  return mc({tid:"g-acltrace",t:"ENSA5",k:"Трасування ACL",c:cfg,q:"ACL застосовано на вхід інтерфейсу, до якого підключена мережа джерела. Хост 192.168."+sn+"."+R(2,200)+" надсилає "+pk.txt+" на "+srv+". Що станеться?"},ans,
    "Рядки перевіряються згори донизу до першого збігу. "+(idx<0?"Жоден рядок не збігся, тож спрацьовує неявний deny any.":"Перший збіг — рядок "+((idx+1)*10)+": "+rules[idx].t+"."),shuf(d));
}
// ---------- NAT: читання таблиці трансляцій ----------
function gNat(){
  const kind=pick(["pat","static","dyn"]); const pub="209.165.200."+R(225,230); const hosts=shuf([10,11,12,20,21]).slice(0,3).map(h=>"192.168.1."+h); const ext="198.51.100."+R(2,200);
  let rows=[], ans, e;
  if(kind==="pat"){ rows=hosts.map((h,i)=>["tcp",pub+":"+(1024+i),h+":"+(49152+R(1,800)),ext+":80",ext+":80"]); ans="PAT (NAT overload)"; e="Усі внутрішні хости мають одну inside global адресу "+pub+" і розрізняються портами — це PAT."; }
  if(kind==="static"){ rows=[["---","209.165.200.229",hosts[0],"---","---"],["tcp","209.165.200.229:80",hosts[0]+":80",ext+":51000",ext+":51000"]]; ans="Статичний NAT"; e="Рядок «--- 209.165.200.229 "+hosts[0]+" --- ---» — постійне відображення один-до-одного, створене командою ip nat inside source static."; }
  if(kind==="dyn"){ rows=hosts.map((h,i)=>["icmp","209.165.200."+(241+i)+":1",h+":1",ext+":1",ext+":1"]); ans="Динамічний NAT з пулу"; e="Кожен внутрішній хост отримав окрему адресу з пулу (209.165.200.241, .242, …) — це динамічний NAT без overload."; }
  const c="R1# show ip nat translations\nPro  Inside global         Inside local          Outside local         Outside global\n"+rows.map(r=>r[0].padEnd(5)+r[1].padEnd(22)+r[2].padEnd(22)+r[3].padEnd(22)+r[4]).join("\n");
  if(Math.random()<0.5) return mc({tid:"g-nat",t:"ENSA6",k:"Типи NAT",c,q:"Який тип NAT видно з цього виводу?"},ans,e,[["PAT (NAT overload)","Для PAT характерна одна inside global адреса з різними портами."],["Статичний NAT","Статичний запис має «---» у стовпці протоколу і зовнішніх адрес."],["Динамічний NAT з пулу","Динамічний NAT дає кожному хосту окрему публічну адресу."],["NAT64","NAT64 перекладає між IPv6 та IPv4 — тут лише IPv4."]]);
  const r=pick(rows.filter(x=>x[0]!=="---")); const q=pick([["inside local",2,"приватна адреса хоста всередині мережі, як її бачать внутрішні пристрої"],["inside global",1,"адреса, якою внутрішній хост представлений в Інтернеті"],["outside global",4,"справжня адреса зовнішнього хоста"]]);
  const opts=[[r[1],"Inside global"],[r[2],"Inside local"],[r[4],"Outside global / outside local"]].filter(x=>x[0]!==r[q[1]]);
  return mc({tid:"g-nat",t:"ENSA6",k:"Терміни NAT",c,q:"Для рядка з inside local "+r[2]+" — яка адреса є «"+q[0]+"»?"},r[q[1]],q[0]+" — це "+q[2]+".",opts.map(x=>[x[0],"Це "+x[1]+", а не "+q[0]+"."]).concat([["192.168.1.1","Це адреса шлюзу, у таблиці трансляцій її немає."]]));
}
// ---------- Заповнення конфігурації ----------
function gFill(){
  const k=R(0,2);
  if(k===0){ const p=pick([22,23,24,26,27,28,30]); const base=ip2n("10."+R(0,255)+"."+R(0,255)+".0")&maskOf(p); const w=n2ip(~maskOf(p)>>>0); const net=n2ip(base);
    const area=pick([0,0,1]);
    return {id:uid("g-fill"),tid:"g-fill",gen:true,type:"fill",t:"ENSA2",k:"Wildcard у network",q:"Увімкніть OSPF process 10 на інтерфейсах мережі "+net+"/"+p+" в area "+area+".",cfg:"R1(config)# router ospf [[10]]\nR1(config-router)# network "+net+" [["+w+"]] area [["+area+"]]",e:"Wildcard — інверсія маски /"+p+": 255.255.255.255 − маска = "+w+"."};
  }
  if(k===1){ const X=R(1,25)*10; const dir=pick(["out","in"]);
    const std=dir==="out";
    if(std) return {id:uid("g-fill"),tid:"g-fill",gen:true,type:"fill",t:"ENSA5",k:"Стандартний ACL",q:"Заборонити мережі 192.168."+X+".0/24 доступ до серверної мережі за Gi0/2; решту трафіку дозволити. Стандартний ACL 10, ближче до призначення.",
      cfg:"R1(config)# access-list 10 [[deny]] 192.168."+X+".0 [[0.0.0.255]]\nR1(config)# access-list 10 [[permit]] any\nR1(config)# interface g0/2\nR1(config-if)# ip [[access-group]] 10 [[out]]",e:"Стандартний ACL фільтрує лише за джерелом, тому його ставлять ближче до призначення — на вихід інтерфейсу до серверів. Без permit any спрацював би неявний deny для всього."};
    return {id:uid("g-fill"),tid:"g-fill",gen:true,type:"fill",t:"ENSA5",k:"Розширений ACL",q:"Дозволити з 192.168."+X+".0/24 лише HTTPS до 10.1.1.10, решту трафіку з цієї мережі до сервера заборонити, інше — дозволити. Розширений ACL, ближче до джерела (Gi0/0).",
      cfg:"R1(config)# ip access-list [[extended]] WEB\nR1(config-ext-nacl)# permit [[tcp]] 192.168."+X+".0 0.0.0.255 host 10.1.1.10 eq [[443]]\nR1(config-ext-nacl)# deny ip 192.168."+X+".0 0.0.0.255 [[host]] 10.1.1.10\nR1(config-ext-nacl)# permit ip any [[any]]\nR1(config)# interface g0/0\nR1(config-if)# ip access-group WEB [[in]]",e:"Розширений ACL розрізняє протокол і порт, тому його ставлять ближче до джерела, на вхід інтерфейсу LAN."};
  }
  return {id:uid("g-fill"),tid:"g-fill",gen:true,type:"fill",t:"ENSA6",k:"PAT",q:"Налаштуйте PAT: мережа 192.168.1.0/24 (Gi0/0) виходить в Інтернет через адресу Gi0/1.",
    cfg:"R1(config)# access-list 1 permit 192.168.1.0 [[0.0.0.255]]\nR1(config)# ip nat inside source list 1 [[interface]] g0/1 [[overload]]\nR1(config)# interface g0/0\nR1(config-if)# ip nat [[inside]]\nR1(config)# interface g0/1\nR1(config-if)# ip nat [[outside]]",e:"overload вмикає PAT — усі хости ділять одну адресу інтерфейсу, розрізняючись портами. Обов'язково позначити inside і outside."};
}

// ---------- Автоматизація: HTTP/REST ----------
function gHttp(){
  const k=R(0,1);
  if(k===0){ const c=pick([[200,"OK — успішний GET/PUT"],[201,"Created — ресурс створено (POST)"],[204,"No Content — успішно, без тіла (часто DELETE)"],[400,"Bad Request — помилка в запиті/JSON"],[401,"Unauthorized — немає або недійсна автентифікація"],[403,"Forbidden — автентифіковано, але немає прав"],[404,"Not Found — ресурсу не існує"],[405,"Method Not Allowed — метод не підтримується ресурсом"],[409,"Conflict — конфлікт стану (наприклад, вже існує)"],[500,"Internal Server Error — помилка на сервері"]]);
    const sit={200:"GET /api/v1/vlan успішно повернув список",201:"POST /api/v1/vlan створив нову VLAN",204:"DELETE /api/v1/vlan/30 виконано, тіла відповіді немає",400:"у тілі POST пропущено кому в JSON",401:"запит без заголовка X-Auth-Token",403:"токен дійсний, але користувач має роль лише для читання і пробує DELETE",404:"GET /api/v1/vlan/777 — такої VLAN немає",405:"POST на ресурс, який підтримує лише GET",409:"POST створює VLAN 30, а вона вже існує",500:"контролер аварійно завершив обробку запиту"}[c[0]];
    return mc({tid:"g-http",t:"ENSA14",k:"Коди HTTP",q:"Який код відповіді REST API найімовірніший: "+sit+"?"},String(c[0]),c[1]+".",shuf([200,201,204,400,401,403,404,405,409,500].filter(x=>x!==c[0])).slice(0,4).map(x=>[String(x),"Код "+x+" означає інше."])); }
  const op=pick([["створити новий об'єкт","POST","POST створює ресурс у колекції."],["отримати дані без змін","GET","GET лише читає, безпечний та ідемпотентний."],["повністю замінити існуючий об'єкт","PUT","PUT замінює ресурс цілком і є ідемпотентним."],["частково змінити поле об'єкта","PATCH","PATCH змінює лише передані поля."],["видалити об'єкт","DELETE","DELETE видаляє ресурс."]]);
  return mc({tid:"g-http",t:"ENSA14",k:"Методи HTTP",q:"Який метод HTTP відповідає дії «"+op[0]+"» у REST API (CRUD)?"},op[1],op[2],[["GET","GET — лише читання."],["POST","POST — створення."],["PUT","PUT — повна заміна."],["PATCH","PATCH — часткова зміна."],["DELETE","DELETE — видалення."]].filter(x=>x[0]!==op[1]));
}
function gJson(){
  const devs=shuf([["R1","10.0.0.1","17.9.4"],["SW1","10.0.0.11","17.6.5"],["SW2","10.0.0.12","16.12.4"],["R2","10.0.0.2","17.3.1"]]).slice(0,3);
  const i=R(0,2); const field=pick([["hostname",0],["ip",1],["version",2]]);
  const json='{\n  "response": [\n'+devs.map(d=>'    {"hostname": "'+d[0]+'", "ip": "'+d[1]+'", "version": "'+d[2]+'"}').join(",\n")+'\n  ],\n  "count": '+devs.length+'\n}';
  if(Math.random()<0.5) return mc({tid:"g-json",t:"ENSA14",k:"Розбір JSON",c:json,q:"Що поверне вираз data[\"response\"]["+i+"][\""+field[0]+"\"] (Python), якщо data — цей JSON?"},devs[i][field[1]],
    "Індекси списку починаються з 0, тож ["+i+"] — "+(i+1)+"-й елемент; далі береться ключ \""+field[0]+"\".",devs.filter((_,k)=>k!==i).map(d=>[d[field[1]],"Це значення іншого елемента списку — перевірте індекс (рахунок з 0)."]).concat([[String(devs.length),"Це значення ключа count."],["KeyError","Ключ існує, помилки не буде."]]));
  const bad=pick([["{'hostname': 'R1'}","Одинарні лапки — у JSON рядки й ключі лише в подвійних лапках."],["{\"hostname\": \"R1\",}","Кома після останнього елемента (trailing comma) у JSON заборонена."],["{hostname: \"R1\"}","Ключ без лапок — у JSON ключі завжди рядки в подвійних лапках."],["{\"enabled\": True}","Булеві значення в JSON — true/false з малої літери."]]);
  return mc({tid:"g-json",t:"ENSA14",k:"Синтаксис JSON",q:"Який із фрагментів — НЕвалідний JSON?"},bad[0],bad[1],[["{\"hostname\": \"R1\", \"vlans\": [10, 20]}","Валідний: об'єкт із рядком і масивом."],["[{\"id\": 1}, {\"id\": 2}]","Валідний: масив об'єктів."],["{\"enabled\": false, \"mtu\": 1500}","Валідний: булеве значення і число."],["{\"descr\": null}","Валідний: null дозволений."]]);
}

// ---------- Терміни UA ↔ EN ----------
function gTerm(){ const G=window.GLOSSARY||[]; if(G.length<5) return null; const e=pick(G); const toEn=Math.random()<0.6;
  const others=shuf(G.filter(x=>x!==e)).slice(0,3);
  return mc({tid:"g-term",t:e[2],k:"Терміни англійською",q:toEn?"Як англійською (як на іспиті CCNA) називається «"+e[0]+"»?":"What is the Ukrainian equivalent of «"+e[1]+"»?"},toEn?e[1]:e[0],"«"+e[0]+"» = "+e[1]+".",others.map(x=>[toEn?x[1]:x[0],"Це «"+x[0]+"» = "+x[1]+"."]));
}
const add=(k,f,name,t,concept)=>{ G.list[k]={f,name,t}; G.conceptOf[k]=concept; G.topicOf[k]=t; };
add("g-stproles",gStpRoles,"STP: ролі портів (схема)","SRWE5","Ролі портів STP");
add("g-drbdr",gDrBdr,"OSPF: DR/BDR (схема)","ENSA1","Вибори DR/BDR");
add("g-ospfpath",gOspfPath,"OSPF: найкращий шлях (схема)","ENSA2","Найкращий шлях OSPF");
add("g-acltrace",gAclTrace,"ACL: який рядок спрацює","ENSA5","Трасування ACL");
add("g-nat",gNat,"NAT: таблиця трансляцій","ENSA6","Типи та терміни NAT");
add("g-fill",gFill,"Заповни конфігурацію","ENSA5","Заповнення конфігурації");
add("g-term",gTerm,"Терміни UA ↔ EN","ITN1","Терміни англійською");
add("g-http",gHttp,"REST: коди й методи HTTP","ENSA14","REST API");
add("g-json",gJson,"JSON: розбір і синтаксис","ENSA14","Формати даних");
})();
