// Додаткові генератори: читання show-виводів, ACL wildcard, OSPF, longest match, AD.
(function(){
const G=window.GEN; if(!G) return;
const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const ip2s=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join(".");
const maskOf=p=>p===0?0:(0xFFFFFFFF<<(32-p))>>>0;
let seq=0;
const uid=t=>t+"#"+(++seq)+"-"+Date.now().toString(36);
function mc(base, correct, cExp, distr){
  const seen=new Set([correct]); const o=[[correct,"Правильно. "+cExp]];
  for(const [t,e] of distr){ if(o.length>=4) break; if(!seen.has(t)){seen.add(t);o.push([t,e]);} }
  return Object.assign({id:uid(base.tid), gen:true, o, a:[0]}, base);
}
const rmac=()=>[R(0,255),R(0,255),R(0,255),R(0,255),R(0,255),R(0,255)].map(x=>x.toString(16).padStart(2,"0")).join("").replace(/(....)(....)(....)/,"$1.$2.$3");

// ---------- show spanning-tree ----------
function gShowStp(){
  const vlan=pick([1,10,20,30]); const iAmRoot=Math.random()<0.35;
  const myPr=pick([24576,28672,32768]), myMac=rmac();
  const rootPr=iAmRoot?myPr:pick([4096,8192,24576].filter(p=>p<myPr).concat([myPr])); let rootMac=iAmRoot?myMac:rmac(); if(!iAmRoot&&rootPr===myPr&&rootMac>=myMac) rootMac="0000"+rootMac.slice(4);
  const ports=shuf(["Gi0/1","Gi0/2","Fa0/1","Fa0/2","Fa0/3","Fa0/24"]).slice(0,R(3,5)).sort();
  const roles={};
  if(iAmRoot){ ports.forEach(p=>roles[p]=["Desg","FWD"]); }
  else{ const rp=pick(ports.filter(p=>p.startsWith("Gi")).concat(ports)); roles[rp]=["Root","FWD"]; const others=ports.filter(p=>p!==rp);
    const alt=Math.random()<0.8&&others.length?pick(others):null; others.forEach(p=>roles[p]=p===alt?["Altn","BLK"]:["Desg","FWD"]); }
  const cost=p=>p.startsWith("Gi")?4:19;
  const out="VLAN"+String(vlan).padStart(4,"0")+"\n  Spanning tree enabled protocol rstp\n  Root ID    Priority    "+(rootPr+vlan)+"\n             Address     "+rootMac+"\n"+(iAmRoot?"             This bridge is the root\n":"             Cost        "+cost(Object.keys(roles).find(p=>roles[p][0]==="Root"))+"\n")+
    "  Bridge ID  Priority    "+(myPr+vlan)+"  (priority "+myPr+" sys-id-ext "+vlan+")\n             Address     "+myMac+"\n\nInterface        Role Sts Cost      Prio.Nbr Type\n---------------- ---- --- --------- -------- ----\n"+
    ports.map((p,i)=>p.padEnd(17)+roles[p][0]+" "+roles[p][1]+" "+String(cost(p)).padEnd(10)+"128."+(i+1)+"    P2p").join("\n");
  const kind=R(0,2);
  if(kind===0){
    return mc({tid:"g-showstp",t:"SRWE5",k:"Читання show spanning-tree",q:"За виводом визначте: чи є цей комутатор root bridge для VLAN "+vlan+"?",c:out},
      iAmRoot?"Так — «This bridge is the root», усі порти Desg":"Ні — Root ID відрізняється від Bridge ID і є root port",
      iAmRoot?"Root ID і Bridge ID збігаються, а root port відсутній.":"Root ID ("+(rootPr+vlan)+", "+rootMac+") ≠ Bridge ID; у не-root комутатора є рівно один порт Root.",
      [[iAmRoot?"Ні — пріоритет "+(myPr+vlan)+" завеликий":"Так — у нього є designated-порти","Designated-порти є і в не-root комутаторів; дивіться на Root ID vs Bridge ID."],["Неможливо визначити з виводу","Можна: рядок «This bridge is the root» або порівняння Root ID і Bridge ID."],["Так — бо протокол rstp","Протокол не визначає роль комутатора."]]);
  }
  if(kind===1 && !iAmRoot){
    const rp=Object.keys(roles).find(p=>roles[p][0]==="Root");
    return mc({tid:"g-showstp",t:"SRWE5",k:"Читання show spanning-tree",q:"Через який порт цей комутатор досягає root bridge?",c:out},rp,"Роль Root позначає порт з найкращим шляхом до root bridge.",
      ports.filter(p=>p!==rp).map(p=>[p,"Роль "+roles[p][0]+" — це не root port."]).concat([["Через усі FWD-порти","Root port лише один."]]));
  }
  const blk=Object.keys(roles).filter(p=>roles[p][1]==="BLK");
  const c=blk.length?blk.join(", "):"Жоден";
  return mc({tid:"g-showstp",t:"SRWE5",k:"Читання show spanning-tree",q:"Які порти заблоковані STP для VLAN "+vlan+"?",c:out},c,blk.length?"Стан BLK (роль Altn) — резервний шлях до root, трафік не пересилається.":"Усі порти у стані FWD.",
    [[blk.length?"Жоден":ports[0],"Дивіться колонку Sts: BLK — заблокований."],[ports.filter(p=>roles[p][0]==="Desg")[0]||"Gi0/9","Desg — у стані FWD."],["Усі, крім Root","Designated-порти пересилають трафік."]]);
}

// ---------- show interfaces trunk ----------
function gShowTrunk(){
  const vlans=[10,20,30,40]; const target=pick(vlans);
  const scenario=pick(["notallowed","native","notactive","ok"]);
  const allowed=vlans.filter(v=>scenario==="notallowed"?v!==target:true).concat([99]);
  const active=allowed.filter(v=>scenario==="notactive"?v!==target:true);
  const nat1=99, nat2=scenario==="native"?1:99;
  const out="S1# show interfaces trunk\n\nPort        Mode   Encapsulation  Status    Native vlan\nGi0/1       on     802.1q         trunking  "+nat1+"\n\nPort        Vlans allowed on trunk\nGi0/1       "+allowed.join(",")+"\n\nPort        Vlans allowed and active in management domain\nGi0/1       "+active.join(",")+"\n\nS2# show interfaces trunk | include Gi0/1\nGi0/1       on     802.1q         trunking  "+nat2;
  const ans={notallowed:["VLAN "+target+" не дозволено на trunk-у S1","Немає у «Vlans allowed on trunk» — switchport trunk allowed vlan add "+target+"."],
    native:["Native VLAN mismatch (S1 — 99, S2 — 1)","Нетегований трафік змішується, CDP пише NATIVE_VLAN_MISMATCH; VLAN "+target+" може працювати, але проблему треба виправити."],
    notactive:["VLAN "+target+" не створено на S1 (немає серед active)","Дозволено, але відсутній у «allowed and active» — vlan "+target+" на S1."],
    ok:["З trunk-ом усе гаразд — шукати причину деінде (access-порти, IP, шлюз)","Trunking, native збігається, VLAN "+target+" дозволений і активний."]};
  const d=Object.entries(ans).filter(([k])=>k!==scenario).map(([k,v])=>[v[0],"Не відповідає виводу: перевірте відповідні рядки."]);
  return mc({tid:"g-showtrunk",t:"SRWE3",k:"Читання show interfaces trunk",q:"Хости VLAN "+target+" на S1 і S2 не спілкуються. Що показує вивід?",c:out},ans[scenario][0],ans[scenario][1],shuf(d));
}

// ---------- show etherchannel summary ----------
function gShowEc(){
  const proto=pick(["LACP","PAgP"]); const sc=pick(["ok","susp","standalone","down"]);
  const fl={ok:["SU","P","P"],susp:["SU","P","s"],standalone:["SD","I","I"],down:["SD","D","D"]}[sc];
  const out="Flags:  D - down        P - bundled in port-channel\n        I - stand-alone s - suspended\n        S - Layer2      U - in use\n\nGroup  Port-channel  Protocol    Ports\n------+-------------+-----------+------------------------\n1      Po1("+fl[0]+")       "+proto+"      Gi0/1("+fl[1]+")  Gi0/2("+fl[2]+")";
  const ans={ok:["Канал працює: обидва порти в bundle","Po1(SU) — L2 і in use, порти (P) — у bundle."],
    susp:["Gi0/2 suspended — його налаштування не збігаються з іншими членами","(s) — suspended: перевірте speed/duplex, VLAN, режим trunk/access."],
    standalone:["Протокол не узгодив канал — порти працюють окремо","(I) — stand-alone: сусід не налаштований або режими несумісні ("+(proto==="LACP"?"passive+passive":"auto+auto")+")."],
    down:["Фізичні лінки down","(D) на портах — інтерфейси не підняті (кабель, shutdown)."]};
  const d=Object.entries(ans).filter(([k])=>k!==sc).map(([k,v])=>[v[0],"Не відповідає прапорцям у виводі."]);
  return mc({tid:"g-showec",t:"SRWE6",k:"Читання show etherchannel summary",q:"Що показує вивід show etherchannel summary?",c:out},ans[sc][0],ans[sc][1],shuf(d));
}

// ---------- show interfaces (лічильники) ----------
function gShowInt(){
  const sc=pick(["duplex","crc","admin","l2","ok","giants"]);
  const n=()=>R(120,9000);
  const lines={status:"FastEthernet0/5 is up, line protocol is up (connected)",in:"  0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored",out:"  0 output errors, 0 collisions, 0 interface resets",late:"  0 babbles, 0 late collision, 0 deferred",giants:"  0 runts, 0 giants, 0 throttles"};
  let ans;
  if(sc==="duplex"){ const x=n(); lines.out="  "+x+" output errors, "+R(10,90)+" collisions, 0 interface resets"; lines.late="  0 babbles, "+x+" late collision, 0 deferred"; ans=["Невідповідність дуплексу","Late collisions — класична ознака duplex mismatch."]; }
  if(sc==="crc"){ const x=n(); lines.in="  "+x+" input errors, "+x+" CRC, "+R(5,50)+" frame, 0 overrun, 0 ignored"; ans=["Фізична проблема: кабель, роз'єм або EMI","Зростають CRC і frame — пошкоджені кадри на вході."]; }
  if(sc==="admin"){ lines.status="FastEthernet0/5 is administratively down, line protocol is down (disabled)"; ans=["Інтерфейс вимкнено командою shutdown","Потрібно no shutdown."]; }
  if(sc==="l2"){ lines.status="FastEthernet0/5 is up, line protocol is down (notconnect)"; ans=["Проблема 2-го рівня або на іншому кінці (сигнал є, протокол не піднявся)","up/down — фізичний рівень працює, канальний — ні."]; }
  if(sc==="giants"){ const x=n(); lines.giants="  0 runts, "+x+" giants, 0 throttles"; lines.in="  "+x+" input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored"; ans=["Кадри більші за допустимий розмір — NIC або невідповідність MTU","Лічильник giants."]; }
  if(sc==="ok"){ ans=["Помилок на інтерфейсі немає — проблему шукати вище (IP, VLAN, маршрутизація)","Лічильники нульові, стан up/up."]; }
  const out=[lines.status,"  Hardware is Fast Ethernet, address is 0019.e86a.1a05","  Full-duplex, 100Mb/s, media type is 10/100BaseTX","  ...",lines.giants,lines.in,lines.out,lines.late].join("\n");
  const all={duplex:"Невідповідність дуплексу",crc:"Фізична проблема: кабель, роз'єм або EMI",admin:"Інтерфейс вимкнено командою shutdown",l2:"Проблема 2-го рівня або на іншому кінці (сигнал є, протокол не піднявся)",giants:"Кадри більші за допустимий розмір — NIC або невідповідність MTU",ok:"Помилок на інтерфейсі немає — проблему шукати вище (IP, VLAN, маршрутизація)"};
  const d=Object.entries(all).filter(([k])=>k!==sc).map(([k,v])=>[v,"Вивід цього не показує."]);
  return mc({tid:"g-showint",t:"SRWE1",k:"Читання show interfaces",q:"Користувач на Fa0/5 скаржиться на мережу. Що показує вивід?",c:out},ans[0],ans[1],shuf(d));
}

// ---------- ACL wildcard ----------
function gWild(){
  const p=pick([8,16,20,22,24,25,26,27,28,29,30]);
  const base=((pick([10,172,192])<<24)|(R(0,255)<<16)|(R(0,255)<<8)|R(0,255))>>>0; const net=(base&maskOf(p))>>>0; const wc=(~maskOf(p))>>>0;
  const last=(net|wc)>>>0;
  const mode=R(0,1);
  const q= mode? "Яка пара «адреса wildcard» в ACL охоплює діапазон "+ip2s(net)+" – "+ip2s(last)+"?" : "Яка wildcard-маска відповідає мережі "+ip2s(net)+"/"+p+"?";
  const c= mode? ip2s(net)+" "+ip2s(wc) : ip2s(wc);
  const alt=(pp)=>ip2s((~maskOf(pp))>>>0);
  const d= mode? [[ip2s(net)+" "+ip2s(maskOf(p)),"Це маска підмережі, а не wildcard."],[ip2s(net)+" "+alt(Math.min(32,p+1)),"Охоплює лише половину діапазону."],[ip2s(net)+" "+alt(Math.max(1,p-1)),"Охоплює вдвічі більше адрес."],[ip2s(last)+" "+ip2s(wc),"Адреса має бути початком блоку."]]
    : [[ip2s(maskOf(p)),"Це маска підмережі."],[alt(Math.min(32,p+1)),"Wildcard для /"+Math.min(32,p+1)+"."],[alt(Math.max(1,p-1)),"Wildcard для /"+Math.max(1,p-1)+"."],["0.0.0.0","Це host."]];
  return mc({tid:"g-wild",t:"ENSA4",k:"Wildcard-маски",q},c,"Wildcard = 255.255.255.255 − маска (/"+p+" → "+ip2s(maskOf(p))+" → "+ip2s(wc)+").",shuf(d));
}

// ---------- OSPF cost ----------
function gOspfCost(){
  const ref=pick([100,1000,10000,100000]); const bws=[["10 Мбіт/с",10],["100 Мбіт/с",100],["1 Гбіт/с",1000],["10 Гбіт/с",10000]];
  const [name,bw]=pick(bws); const cost=Math.max(1,Math.floor(ref/bw));
  const d=[[String(Math.max(1,Math.floor(100/bw))),"Це для reference bandwidth 100 за замовчуванням."],[String(ref/bw<1?0:Math.round(ref/bw)*10),"Неправильна формула."],[String(Math.max(1,Math.floor(ref/bw))+1),"Обчислення: ref / bw."],[String(bw),"Це пропускна здатність, а не вартість."]].filter(x=>x[0]!==String(cost));
  return mc({tid:"g-ospfcost",t:"ENSA2",k:"Вартість OSPF",q:"auto-cost reference-bandwidth "+ref+". Яка вартість OSPF інтерфейсу "+name+"?"},String(cost),"Cost = reference bandwidth / bandwidth = "+ref+" / "+bw+(ref/bw<1?" < 1, тому мінімум 1.":" = "+cost+"."),shuf(d));
}

// ---------- OSPF router ID ----------
function gRid(){
  const a=()=>[R(1,223),R(0,255),R(0,255),R(1,254)].join(".");
  const phys=[a(),a(),a()], loops=Math.random()<0.6?[a(),a()].slice(0,R(1,2)):[];
  const cfg=Math.random()<0.3?[R(1,9),R(1,9),R(1,9),R(1,9)].join("."):null;
  const n=s=>s.split(".").reduce((x,o)=>x*256+Number(o),0);
  const max=arr=>arr.slice().sort((x,y)=>n(y)-n(x))[0];
  const c=cfg||(loops.length?max(loops):max(phys));
  const why=cfg?"Команда router-id має найвищий пріоритет.":loops.length?"router-id не задано — береться найвища адреса loopback.":"Немає router-id і loopback — найвища адреса активного інтерфейсу.";
  const txt=(cfg?"router ospf 1\n router-id "+cfg+"\n!\n":"")+phys.map((ip,i)=>"interface GigabitEthernet0/"+i+"\n ip address "+ip+" 255.255.255.0").join("\n")+(loops.length?"\n"+loops.map((ip,i)=>"interface Loopback"+i+"\n ip address "+ip+" 255.255.255.255").join("\n"):"");
  const d=[...phys,...loops].filter(x=>x!==c).map(x=>[x,loops.includes(x)?"Loopback, але не найвища або router-id задано вручну.":"Фізичний інтерфейс — має нижчий пріоритет."]);
  return mc({tid:"g-rid",t:"ENSA1",k:"Router ID OSPF",q:"Який router ID отримає OSPF?",c:txt},c,why,shuf(d));
}

// ---------- Longest prefix match ----------
function gLpm(){
  for(let t=0;t<50;t++){
    const o1=pick([10,172,192]); const b2=o1===172?R(16,31):R(0,255);
    const base=((o1<<24)|(b2<<16))>>>0;
    const routes=[]; const hops=["10.0.0.2","10.0.0.6","10.0.0.10","10.0.0.14"];
    routes.push({net:base,p:16,nh:hops[0]});
    const third=R(0,255); routes.push({net:(base|(third<<8))>>>0,p:24,nh:hops[1]});
    const p3=pick([20,21,22]); routes.push({net:((base|(third<<8))&maskOf(p3))>>>0,p:p3,nh:hops[2]});
    routes.push({net:0,p:0,nh:hops[3]});
    const choose=R(0,3); let dst;
    if(choose===0) dst=(routes[1].net|R(1,254))>>>0;
    else if(choose===1){ dst=((routes[2].net)|((R(0,Math.pow(2,24-p3)-1))<<8)|R(1,254))>>>0; if(((dst&maskOf(24))>>>0)===routes[1].net) continue; }
    else if(choose===2){ dst=(base|((R(0,255))<<8)|R(1,254))>>>0; if(((dst&maskOf(p3))>>>0)===routes[2].net) continue; }
    else dst=(((o1===10?11:o1===172?173:193)<<24)|(R(0,255)<<16)|(R(0,255)<<8)|R(1,254))>>>0;
    const match=routes.filter(r=>((dst&maskOf(r.p))>>>0)===r.net).sort((a,b)=>b.p-a.p);
    const best=match[0];
    const table="Gateway of last resort is "+hops[3]+" to network 0.0.0.0\n\n"+routes.slice(0,3).map(r=>"O     "+ip2s(r.net)+"/"+r.p+" [110/2] via "+r.nh).join("\n")+"\nS*    0.0.0.0/0 [1/0] via "+hops[3];
    const o=routes.map(r=>[r.nh, r===best? "Правильно. Збігаються: "+match.map(m=>"/"+m.p).join(", ")+" — обрано найдовший /"+best.p+".": (match.includes(r)?"/"+r.p+" теж збігається, але коротший.":"/"+r.p+" не охоплює "+ip2s(dst)+".")]);
    return {id:uid("g-lpm"),tid:"g-lpm",gen:true,t:"SRWE14",k:"Longest prefix match",q:"Через який next-hop маршрутизатор перешле пакет на "+ip2s(dst)+"?",c:table,o,a:[routes.indexOf(best)]};
  }
}

// ---------- Адміністративна відстань ----------
function gAd(){
  const src=shuf([["Static",1,"S"],["EIGRP",90,"D"],["OSPF",110,"O"],["RIP",120,"R"],["eBGP",20,"B"]]).slice(0,3);
  const net=[R(10,192),R(0,255),R(0,255),0].join(".")+"/24";
  const best=src.slice().sort((a,b)=>a[1]-b[1])[0];
  const o=src.map(s=>[s[0]+" ("+s[2]+")", s===best?"Правильно. Найменша AD — "+s[1]+".":"AD "+s[1]+" більша за "+best[1]+"."]);
  o.push(["Усі три з балансуванням","Балансування — лише між рівноцінними маршрутами одного джерела."]);
  return {id:uid("g-ad"),tid:"g-ad",gen:true,t:"SRWE14",k:"Адміністративна відстань",q:"Маршрут до "+net+" відомий з кількох джерел: "+src.map(s=>s[0]).join(", ")+". Який буде в таблиці маршрутизації?",o,a:[src.indexOf(best)]};
}

const add=(k,f,name,t,concept)=>{ G.list[k]={f,name,t}; G.conceptOf[k]=concept; G.topicOf[k]=t; };
add("g-showstp",gShowStp,"show spanning-tree","SRWE5","Читання show spanning-tree");
add("g-showtrunk",gShowTrunk,"show interfaces trunk","SRWE3","Читання show interfaces trunk");
add("g-showec",gShowEc,"show etherchannel summary","SRWE6","Читання show etherchannel summary");
add("g-showint",gShowInt,"show interfaces (лічильники)","SRWE1","Читання show interfaces");
add("g-lpm",gLpm,"Longest prefix match","SRWE14","Longest prefix match");
add("g-ad",gAd,"Адміністративна відстань","SRWE14","Адміністративна відстань");
add("g-wild",gWild,"ACL: wildcard","ENSA4","Wildcard-маски");
add("g-ospfcost",gOspfCost,"OSPF: вартість","ENSA2","Вартість OSPF");
add("g-rid",gRid,"OSPF: router ID","ENSA1","Router ID OSPF");
})();
