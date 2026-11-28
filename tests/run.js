// Автотести тренажера: банки питань, генератори, CLI-лаби, troubleshooting, REST API лаба.
// Запуск: node tests/run.js  (exit code 1 при будь-якій помилці)
const path=require("path"); const P=f=>path.join(__dirname,"..","public",f);
global.window={}; global.btoa=s=>Buffer.from(s).toString("base64"); global.atob=s=>Buffer.from(s,"base64").toString();
const files=["wlc","bash","questions-linux","questions-itn","questions-srwe","questions-notes","questions-extra","questions-srwe2","questions-ensa","questions-netacad","questions-ensa2","questions-v2","questions-v2b","glossary2","questions-simlet","questions-more","questions-dnd","questions-auto","questions-practice","questions-figs","questions-en","glossary","cheats","pairs","gen","gen2","gen3","api","cli"];
for(const f of files) require(P(f+".js"));
for(const f of require("fs").readdirSync(path.join(__dirname,"..","public")).filter(f=>/^tr-.*\.js$/.test(f))) require(P(f));
let fails=0, checks=0; const fail=m=>{ fails++; console.error("✗ "+m); }; const ok=(c,m)=>{ checks++; if(!c) fail(m); };
// ---- теми з app.js ----
const app=require("fs").readdirSync(path.join(__dirname,"..","public")).filter(f=>/^app-.*\.js$/.test(f)).sort().map(f=>require("fs").readFileSync(P(f),"utf8")).join("\n");
const topicIds=new Set([...app.matchAll(/\["((?:ITN|SRWE|ENSA|LNX)\d+)","/g)].map(m=>m[1]));
ok(topicIds.size>=47,"знайдено теми в app.js: "+topicIds.size);
// ---- банки ----
const banks=Object.keys(window).filter(k=>k.startsWith("QB_")&&Array.isArray(window[k])); const ids=new Set(); let total=0;
for(const b of banks) for(const q of window[b]){ total++;
  ok(!ids.has(q.id),"дубль id "+q.id); ids.add(q.id); ok(topicIds.has(q.t),q.id+": невідома тема "+q.t); ok(typeof q.q==="string"&&q.q.length>3,q.id+": порожнє питання");
  const t=q.type||"mc";
  if(t==="mc"){ ok(Array.isArray(q.o)&&q.o.length>=2,q.id+": мало варіантів"); ok(Array.isArray(q.a)&&q.a.length&&q.a.every(i=>i>=0&&i<q.o.length),q.id+": хибний індекс відповіді"); ok(q.o.every(o=>Array.isArray(o)&&o[0]),q.id+": порожній варіант"); }
  else if(t==="order") ok(Array.isArray(q.items)&&q.items.length>=3,q.id+": order без items");
  else if(t==="match") ok(Array.isArray(q.pairs)&&q.pairs.length>=2,q.id+": match без pairs");
  else if(t==="cat") ok(Array.isArray(q.cats)&&q.cats.length>=2&&Array.isArray(q.items)&&q.items.length>=q.cats.length&&q.items.every(x=>Array.isArray(x)&&x[1]>=0&&x[1]<q.cats.length)&&q.cats.every((_,ci)=>q.items.some(x=>x[1]===ci)),q.id+": некоректний cat");
  else if(t==="cmd") ok(Array.isArray(q.ans)&&q.ans.length,q.id+": cmd без ans");
  else if(t==="fill") ok(/\[\[.+?\]\]/.test(q.cfg||""),q.id+": fill без пропусків");
  else if(t==="simlet") ok(Array.isArray(q.ex)&&q.ex.length&&q.ex.every(x=>x[0]&&x[1])&&Array.isArray(q.parts)&&q.parts.length>=2&&q.parts.every(p=>p.q&&p.o.length>=2&&p.a.length&&p.a.every(i=>i>=0&&i<p.o.length)),q.id+": некоректний simlet");
  else fail(q.id+": невідомий тип "+t); }
console.log("Питань у банках:",total);
// переклад
const CYR=/[а-яіїєґ]/i; const allQ={}; for(const b of banks) for(const q of window[b]) allQ[q.id]=q;
if(window.QB_TR){ for(const [id,tr] of Object.entries(window.QB_TR)){ const q=allQ[id]; ok(!!q,"переклад для неіснуючого "+id); if(!q) continue; ok(!CYR.test(tr.q),"переклад "+id+": кирилиця в питанні");
  if(q.o){ ok(Array.isArray(tr.o)&&tr.o.length===q.o.length,"переклад "+id+": кількість варіантів "+(tr.o||[]).length+"≠"+q.o.length); (tr.o||[]).forEach((o,i)=>{ const t=o[0]===0?(q.o[i]||[])[0]:o[0]; ok(!CYR.test(t||""),"переклад "+id+": варіант "+i+" не перекладено: "+t); ok(!CYR.test(o[1]||""),"переклад "+id+": пояснення "+i); }); }
  if(q.items) ok(Array.isArray(tr.items)&&tr.items.length===q.items.length&&!tr.items.some(x=>CYR.test(x)),"переклад "+id+": items"); if(q.pairs) ok(Array.isArray(tr.pairs)&&tr.pairs.length===q.pairs.length&&!tr.pairs.flat().some(x=>CYR.test(x)),"переклад "+id+": pairs"); if(tr.e) ok(!CYR.test(tr.e),"переклад "+id+": e"); if(q.parts) ok(Array.isArray(tr.parts)&&tr.parts.length===q.parts.length&&tr.parts.every((p,i)=>!CYR.test(p.q)&&p.o.length===q.parts[i].o.length&&p.o.every(o=>!CYR.test(o[0])&&!CYR.test(o[1]))),"переклад "+id+": parts"); if(q.ex) ok(q.ex.every(x=>!CYR.test(x[1])),"simlet "+id+": кирилиця у виводі"); if(q.e&&CYR.test(q.e)) ok(!!tr.e,"переклад "+id+": бракує пояснення"); if(q.cfg&&CYR.test(q.cfg)) ok(!!tr.cfg,"переклад "+id+": cfg кирилицею"); if(tr.cfg){ const bl=x=>(x.match(/\[\[[^\]]+\]\]/g)||[]).join("|"); ok(bl(tr.cfg)===bl(q.cfg),"переклад "+id+": пропуски cfg"); } }
  const untr=Object.keys(allQ).filter(id=>!window.QB_TR[id]&&allQ[id].src!=="en"&&!id.startsWith("lx")); console.log("Перекладів:",Object.keys(window.QB_TR).length,"· без перекладу:",untr.length); }
// ---- генератори ----
const G=window.GEN;
for(const k of Object.keys(G.list)){ for(let i=0;i<300;i++){ let q; try{ q=G.make(k); }catch(e){ fail(k+": виняток "+e.message); break; } if(!q) continue;
  const t=q.type||"mc"; if(t==="mc"){ const texts=q.o.map(o=>o[0]); if(new Set(texts).size!==texts.length||q.o.length<3||!q.a.every(i=>i<q.o.length)){ fail(k+": некоректний mc "+JSON.stringify(texts)); break; } }
  if(t==="match"&&!(q.pairs.length>=2)){ fail(k+": match"); break; } if(t==="fill"&&!/\[\[/.test(q.cfg)){ fail(k+": fill"); break; } checks++; } }
console.log("Генераторів:",Object.keys(G.list).length);
// ---- CLI ----
const C=window.CLI;
function solveSingle(sc){ const ses=C.startScenario(sc); for(const raw of sc.sol.split("\n")){ const l=raw.trim(); if(!l||l.startsWith("(")) continue; ses.exec(l); } return ses.state; }
for(const sc of C.SCEN){ const st=solveSingle(sc); const r=sc.check(st); ok(r.every(x=>x[0]),"лаба "+sc.id+": "+r.filter(x=>!x[0]).map(x=>x[1]).join("; ")); }
for(const sc of C.NETSCEN){ const fresh=C.startNet(sc); const before=sc.check(fresh.N).every(x=>x[0]); ok(!before,"лаба "+sc.id+" виконана без жодних дій");
  const N=C.solveNet(sc); const r=sc.check(N); ok(r.every(x=>x[0]),"лаба "+sc.id+": "+r.filter(x=>!x[0]).map(x=>x[1]).join("; "));
  let t=null; for(let k=0;k<5&&!t;k++) t=C.troubleshoot(sc,1); ok(!!t,"troubleshooting не згенерувався для "+sc.id); }
console.log("Лаб:",C.SCEN.length+C.NETSCEN.length);
// ---- шлях пакета ----
{ const N=C.solveNet(C.NETSCEN.find(s=>s.id==="net-roas")); N.counting=true; N.ping("PC1","192.168.20.12"); N.counting=false; ok(N.lastFlow&&N.lastFlow.fwd.length>5&&N.lastFlow.back.length>5,"шлях пакета не записано"); }
// ---- пісочниця: збереження/відновлення ----
{ const sb={devs:{R1:{type:"router"},PC1:{type:"pc"},PC2:{type:"pc"}},links:[["PC1","Fa0","R1","Gi0/0"],["PC2","Fa0","R1","Gi0/1"]]}; let N=C.netFromSaved(sb); const s=C.sessionsFor(N);
  for(const c of ["en","conf t","int g0/0","ip add 10.0.0.1 255.255.255.0","no sh","int g0/1","ip add 10.0.1.1 255.255.255.0","no sh","end"]) s.R1.exec(c);
  s.PC1.exec("ipconfig /static 10.0.0.10 255.255.255.0 10.0.0.1"); s.PC2.exec("ipconfig /static 10.0.1.10 255.255.255.0 10.0.1.1");
  const N2=C.netFromSaved(JSON.parse(JSON.stringify(C.saveNet(N)))); ok(N2.ping("PC1","10.0.1.10").ok,"пісочниця: відновлена мережа не працює"); }
// ---- REST API ----
{ const A=window.APILAB, st=A.newState(); const r1=A.handle(st,{method:"POST",url:"/dna/system/api/v1/auth/token",headers:"Authorization: Basic "+btoa("devnet:Cisco123!")}); ok(r1.code===200,"API: токен");
  const h="X-Auth-Token: "+st.token+"\nContent-Type: application/json"; ok(A.handle(st,{method:"GET",url:"/dna/intent/api/v1/network-device?role=ACCESS",headers:h}).body.response.length===2,"API: фільтр");
  ok(A.handle(st,{method:"POST",url:"/dna/intent/api/v1/vlan",headers:h,body:'{"vlanId":30,"name":"GUEST"}'}).code===201,"API: POST"); ok(A.handle(st,{method:"DELETE",url:"/dna/intent/api/v1/vlan/99",headers:h}).code===204,"API: DELETE"); }
// ---- Linux ----
for(const sc of window.BASH.SCEN){ const ses=window.BASH.start(sc); ok(!sc.check(ses.state).every(x=>x[0]),"bash "+sc.id+" виконана без дій"); for(const l of sc.sol.split("\n")) ses.exec(l); const r=sc.check(ses.state); ok(r.every(x=>x[0]),"bash "+sc.id+": "+r.filter(x=>!x[0]).map(x=>x[1]).join("; ")); }
// ---- WLC ----
{ const W=window.WLC, st=W.newState(); const vals={}; const $=sel=>{ const id=sel.slice(1); return id in vals? {value:String(vals[id]),type:typeof vals[id]==="boolean"?"checkbox":"text",checked:vals[id]} : null; };
  const go=(op,v,data)=>{ Object.assign(vals,v||{}); W.handle(st,op,{dataset:data||{}},$); };
  go("newif"); go("saveif",{i_name:"guest",i_vlan:30,i_ip:"192.168.30.2",i_mask:"255.255.255.0",i_gw:"192.168.30.1",i_dhcp:"192.168.30.1"});
  go("newrad"); go("saverad",{r_ip:"10.0.0.50",r_sec:"s3cret",r_port:1812,r_en:"Enabled"});
  go("newwlan"); go("savewlan",{w_id:2,w_prof:"GUEST",w_ssid:"Guest-WiFi",w_en:true,w_if:"guest",w_l2:"WPA2",w_ci:"AES",w_akm:"PSK",w_psk:"Welcome2026",w_aaa:""});
  go("newwlan"); go("savewlan",{w_id:3,w_prof:"CORP",w_ssid:"Corp",w_en:true,w_if:"management",w_l2:"WPA2",w_ci:"AES",w_akm:"802.1X",w_psk:"",w_aaa:"10.0.0.50"});
  go("delwlan",null,{v:"1"}); const d=W.done(st); ok(Object.values(d).every(Boolean),"WLC: "+JSON.stringify(d)); }
// ---- Ansible ----
{ global.CLI=window.CLI; require(P("ansible.js")); const A=window.ANSIBLE; const L=A.newLab();
  ok(A.TASKS.every(t=>!t.ok(L)),"Ansible: завдання виконані без плейбуків");
  const Y=A.parseYaml("- a: 1\n  b: [x, 'y z']\n  c:\n    - {id: 3, n: q}\n    - k: v\n      m: true\n"); ok(JSON.stringify(Y)==='[{"a":1,"b":["x","y z"],"c":[{"id":3,"n":"q"},{"k":"v","m":true}]}]',"YAML: "+JSON.stringify(Y));
  let bad=false; try{ A.parseYaml("- a: 1\n   b: 2"); }catch(e){ bad=true; } ok(bad,"YAML: неправильний відступ має давати помилку");
  const vl="- hosts: switches\n  gather_facts: false\n  vars:\n    vlans:\n      - {id: 30, name: GUEST}\n      - {id: 40, name: VOICE}\n  tasks:\n    - cisco.ios.ios_config:\n        parents: \"vlan {{ item.id }}\"\n        lines: \"name {{ item.name }}\"\n      loop: \"{{ vlans }}\"\n";
  const runs=[A.SAMPLE,vl,vl,"- hosts: all\n  gather_facts: false\n  tasks:\n    - cisco.ios.ios_config:\n        lines: ntp server 10.1.1.123\n        save_when: modified\n- hosts: switches\n  gather_facts: false\n  tasks:\n    - cisco.ios.ios_command:\n        commands: show vlan brief\n      register: vlans_out\n    - debug:\n        var: vlans_out.stdout_lines\n"].map(src=>A.run(L,src));
  ok(runs.every(r=>r.ok),"Ansible: плейбуки без помилок"); ok(runs[1].changed===2&&runs[2].changed===0,"Ansible: ідемпотентність ("+runs[1].changed+"/"+runs[2].changed+")");
  { const res="- hosts: switches\n  gather_facts: false\n  tasks:\n    - cisco.ios.ios_vlans:\n        config:\n          - vlan_id: 50\n            name: MGMT\n          - vlan_id: 60\n            name: CAMERAS\n        state: merged\n    - cisco.ios.ios_interfaces:\n        config:\n          - name: GigabitEthernet0/1\n            description: UPLINK\n    - cisco.ios.ios_l2_interfaces:\n        config:\n          - name: GigabitEthernet0/1\n            mode: trunk\n            trunk:\n              native_vlan: 99\n";
    const before=JSON.stringify(L.N.dev.S1.vlans); const ck=A.run(L,res,{check:true,diff:true}); ok(ck.ok&&ck.check&&ck.changed>0,"Ansible --check: передбачає зміни"); ok(JSON.stringify(L.N.dev.S1.vlans)===before&&!L.N.dev.S1.ifs["Gi0/1"].desc,"Ansible --check: пристрої не змінено");
    ok(/\+ vlan 50/.test(ck.text)&&/\+\s+name MGMT/.test(ck.text)&&/\+\s+switchport trunk native vlan 99/.test(ck.text),"Ansible --diff: рядки + для VLAN і trunk");
    const r1=A.run(L,res,{diff:true}), r2=A.run(L,res); ok(r1.ok&&r1.changed>0&&r2.ok&&r2.changed===0,"Ansible: resource-модулі ідемпотентні ("+r1.changed+"/"+r2.changed+")");
    const del=A.run(L,"- hosts: switches\n  gather_facts: false\n  tasks:\n    - ios_vlans:\n        config:\n          - vlan_id: 60\n        state: deleted\n",{diff:true}); ok(del.ok&&/- vlan 60/.test(del.text)&&!L.N.dev.S2.vlans[60],"Ansible: ios_vlans state: deleted");
    ok(!A.run(L,"- hosts: S1\n  gather_facts: false\n  tasks:\n    - ios_vlans:\n        state: merged\n").ok,"Ansible: resource-модуль без config — помилка");
    ok(A.cfgDiff("interface G1\n description A\n","interface G1\n description B\n").join("|")==="  interface G1|-   description A|+   description B","Ansible: cfgDiff"); }
  const r=A.TASKS.filter(t=>!t.ok(L)).map(t=>t.id); ok(!r.length,"Ansible: не виконано "+r.join(","));
  { const L2=A.newLab(); const r2=A.run(L2,"- hosts: R1\n  gather_facts: false\n  tasks:\n    - ios_config:\n        lines: |\n          ntp server 1.1.1.1\n          ip domain-name x.lab\n"); ok(r2.ok&&(L2.N.dev.R1.svc.ntp||[]).includes("1.1.1.1"),"Ansible: багаторядковий lines: | розбивається на команди"); }
  ok(!A.run(L,"- hosts: S1\n  gather_facts: false\n  tasks:\n    - ios_command:\n        commands: configure terminal\n").ok,"Ansible: ios_command не має приймати conf t"); }
// ---- експорт лаб для containerlab ----
{ global.TextEncoder=require("util").TextEncoder; global.Blob=require("buffer").Blob; global.CLI=window.CLI; require(P("labexport.js")); const X=window.LABEXPORT;
  ok(X.crc32(new TextEncoder().encode("123456789"))===0xCBF43926,"CRC32 еталон");
  for(const sc of window.CLI.NETSCEN){ try{ const N=window.CLI.startNet(sc).N; const r=X.build(sc,N); const names=r.files.map(f=>f[0]); const nets=Object.keys(N.dev).filter(d=>/switch|router/.test(N.dev[d].type));
      ok(names.includes("topology.clab.yml")&&names.includes("README.md")&&names.includes("solution.md")&&nets.every(d=>names.includes("configs/"+d+".cfg.partial")),"експорт "+sc.id+": усі файли");
      const y=r.files[1][1]; ok(N.links.every(l=>y.includes('"'+l.a+":")&&y.includes('"'+l.b+":")),"експорт "+sc.id+": усі лінки в topology.clab.yml");
      ok(!/(Gi|Fa|GigabitEthernet|FastEthernet)\d+\/\d+/.test(r.files.filter(f=>/configs\//.test(f[0])).map(f=>f[1]).join("\n").split("\n").filter(l=>!/^!/.test(l)).join("\n")),"експорт "+sc.id+": у конфігах лишились порти тренажера"); }
    catch(e){ ok(false,"експорт "+sc.id+": "+e.message); } } }
// ---- картки команд ----
{ require(P("cmdcards.js")); const CC=window.CMDCARDS; const C=window.CLI;
  const sample={"<n>":"10","<ip>":"10.1.1.1","<mask>":"255.255.255.0","<if>":"g0/1","<w>":"TEST","<list>":"10","<v6>":"2001:db8::1","<rest>":"permit ip any any"};
  const special={"if|ipv6 address <w>":"ipv6 address 2001:db8::1/64","config|ipv6 route <w> <v6>":"ipv6 route ::/0 2001:db8::1","if|channel-group <n> mode <w>":"channel-group 1 mode active","if|switchport port-security violation <w>":"switchport port-security violation restrict","config|spanning-tree mode <w>":"spanning-tree mode rapid-pvst","line|transport input <rest>":"transport input ssh","config|logging trap <w>":"logging trap warnings","config|snmp-server community <w> <w>":"snmp-server community X ro","raguard|device-role <w>":"device-role host","if|ip access-group <w> <w>":"ip access-group 1 in","config|aaa authentication login <w> <rest>":"aaa authentication login default group tacacs+ local","dhcp|option 43 hex <w>":"option 43 hex f104.0a0a.0a05","dhcp6|address prefix <w>":"address prefix 2001:db8::/64","if|storm-control broadcast level <w>":"storm-control broadcast level 20","config|errdisable recovery cause <w>":"errdisable recovery cause psecure-violation","if|tunnel source <w>":"tunnel source g0/1","config|ip nat inside source list <w> interface <if> overload":"ip nat inside source list 1 interface g0/1 overload","if|duplex <w>":"duplex full","router|network <ip> <ip> area <w>":"network 10.0.0.0 0.0.0.255 area 0","if|ipv6 ospf <n> area <w>":"ipv6 ospf 1 area 0"};
  for(const [k,d] of Object.entries(CC.D)){ const [mode,pat]=k.split("|"); const cmd=special[k]||pat.split(" ").map(t=>sample[t]||t).join(" "); const c=C.canonOf(mode,cmd);
    ok(!!c&&c.pat===pat,"картка "+k+": шаблону немає в граматиці (отримано "+(c&&c.pat)+")"); ok(window.TOPICS_IDS?true:topicIds.has(d[0]),"картка "+k+": тема "+d[0]); ok(!CYR.test(d[2]),"картка "+k+": кирилиця в EN");
    if(c){ const q=CC.card({mode,pat,full:c.full,lab:"X"},false); ok(q&&!/\{\d\}|…/.test(q.q)&&q.ans[0]===c.full,"картка "+k+": текст «"+(q&&q.q)+"»"); } } }
// ---- злиття денних записів (журнал і час між пристроями) ----
{ const src=app.match(/function mergeDay\(o,v\)\{[\s\S]*?\n  return r; \}/); ok(!!src,"mergeDay не знайдено в app-*.js");
  if(src){ const mergeDay=new Function(src[0]+"; return mergeDay;")(); const r=mergeDay({n:5,c:4,m:10,log:[{ts:1,min:30,k:"pt"}],note:"a",jts:5},{n:3,c:3,m:12,log:[{ts:1,min:30,k:"pt"},{ts:2,min:15,k:"na"}],note:"b",jts:9});
    ok(r.n===5&&r.c===4,"mergeDay: відповіді"); ok(r.m===12,"mergeDay: хвилини"); ok(r.log.length===2,"mergeDay: журнал без дублів"); ok(r.note==="b","mergeDay: новіший чек-ін"); } }
// ---- співбесіда ----
{ require(P("interview-data.js")); require(P("interview-data2.js")); require(P("interview-srwe.js")); const I=window.INTERVIEW; ok(I.Q.length>=80,"співбесіда: питань "+I.Q.length); ok(I.SC.length>=4,"співбесіда: ситуацій");
  const seen=new Set(); for(const q of I.Q){ ok(!seen.has(q.id),"співбесіда: дубль "+q.id); seen.add(q.id); ok(!!I.CATS[q.cat]&&I.LVL[q.lvl],"співбесіда: категорія/рівень "+q.id); ok(q.ua&&q.en&&q.model&&q.points.length>=3,"співбесіда: поля "+q.id);
    ok(!/[А-Яа-яІіЇїЄєҐґ]/.test(q.en),"співбесіда: кирилиця в EN "+q.id);
    let re=[]; try{ re=q.points.map(p=>new RegExp(p.k,"i")); }catch(e){ fail("співбесіда: регулярка "+q.id+": "+e.message); continue; }
    const hit=re.filter(r=>r.test(q.model)).length; ok(hit/re.length>=0.7,"співбесіда: еталон "+q.id+" покриває "+hit+"/"+re.length);
    ok(re.filter(r=>r.test("Не знаю, треба подумати про це питання")).length===0,"співбесіда: хибна автопозначка "+q.id); }
  for(const s of I.SC){ ok(s.steps.length>=3&&s.steps.every(x=>x.say&&x.reveal&&x.points.length>=3),"ситуація "+s.id); for(const st of s.steps) for(const [,k] of st.points) try{ new RegExp(k,"i"); }catch(e){ fail("ситуація "+s.id+": "+k); } } }
// ---- перехід v1.1 → v2.0: посилання на пункти існують ----
{ const bp=require("fs").readFileSync(P("app-blueprint.js"),"utf8"); const ids=v=>{ const blk=bp.split('"'+v+'": { name')[1].split(/\n  "v|\n\};/)[0]; return new Set([...blk.matchAll(/\["(\d\.\d+)", "/g)].map(m=>m[1])); };
  const v1=ids("v1.1"), v2=ids("v2.0"); ok(v1.size>=50&&v2.size>=25,"blueprint: пункти v1.1 "+v1.size+", v2.0 "+v2.size);
  const diff=bp.match(/const BP_DIFF = (\[[\s\S]*?\n\]);/); ok(!!diff,"BP_DIFF не знайдено");
  if(diff){ const D=new Function("return "+diff[1])(); for(const [k,t,,n2,n1] of D){ ok(["new","up","gone"].includes(k),"BP_DIFF тип "+t); if(n2) ok(v2.has(n2),"BP_DIFF "+t+": немає v2.0 "+n2); if(n1) ok(v1.has(n1),"BP_DIFF "+t+": немає v1.1 "+n1); } } }
// ---- практичні вправи SRWE: генератори виводів, знайди помилку, плитки, аналізатор, генератор, довідники ----
{ const TMAP0=Object.fromEntries([...topicIds].map(t=>[t,1])); const fs=require("fs"); global.CLI=window.CLI; const R=f=>fs.readFileSync(P(f),"utf8"); const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const G=new Function("shuffle",R("app-show.js").replace(/let SHV[\s\S]*$/,"")+";return SHOW_GEN;")(shuffle);
  for(const [k,g] of Object.entries(G)){ ok(/^(ITN|SRWE|ENSA)\d+$/.test(g.t),"show "+k+": тема"); for(let i=0;i<150;i++){ const it=g.make(); if(it.aText!=null) it.a=it.o.indexOf(it.aText);
    ok(it.a>=0&&it.a<it.o.length,"show "+k+": немає правильної відповіді «"+it.q+"»"); ok(new Set(it.o).size===it.o.length,"show "+k+": дублі варіантів"); ok(!!it.why&&it.L.length>2,"show "+k+": пояснення/вивід"); if(it.key!=null) ok(it.key>=0&&!!it.L[it.key],"show "+k+": ключовий рядок"); } }
  const D=new Function("shuffle","SH_P","prog",R("app-drills.js").replace(/let BGV[\s\S]*?(?=const CB =)/,"").replace(/let CBV[\s\S]*$/,"")+";return {BUGS,CB};")(shuffle,a=>a[0],{});
  const bids=new Set(); for(const [id,t,task,lines,bugs] of D.BUGS){ ok(!bids.has(id),"bugs: дубль "+id); bids.add(id); ok(!!TMAP0[t],"bugs "+id+": тема"); ok(bugs.length>=3,"bugs "+id+": мало варіантів");
    for(const [i,w,ex] of bugs){ ok(i>=0&&i<lines.length,"bugs "+id+": рядок "+i); ok(w!==lines[i]&&w.trim()!==lines[i].trim(),"bugs "+id+": помилка збігається з правильним рядком"); ok(/^\s/.test(w)===/^\s/.test(lines[i]),"bugs "+id+": відступ рядка "+i); ok(ex.length>20,"bugs "+id+": пояснення"); } }
  for(const c of D.CB){ ok(c.mode&&c.task&&c.ans,"cb: поля "+c.id); ok(c.dis.length>=2,"cb "+c.ans+": мало зайвих плиток"); ok(!c.dis.some(d=>c.ans.split(" ").includes(d)),"cb "+c.ans+": зайва плитка є у відповіді"); }
  const CC=new Function("lsGet","esc",R("app-confcheck.js").replace(/\/\/ ---- екран ----[\s\S]*$/,"")+";return {ccCheck,ccSyntax,ccIf,ccRange};")(()=>"",x=>x);
  ok(CC.ccIf("GigabitEthernet0/1")==="Gi0/1"&&CC.ccIf("Serial0/0/0")==="Se0/0/0"&&CC.ccIf("Port-channel1")==="Po1","ccIf"); ok(CC.ccRange("FastEthernet0/1 - 3, gi0/1").join()==="Fa0/1,Fa0/2,Fa0/3,Gi0/1","ccRange");
  const sample=R("app-confcheck.js").match(/const CC_SAMPLE = `([\s\S]*?)`;/)[1]; const r1=CC.ccCheck(sample); const has=re=>r1.F.some(f=>re.test(f.msg));
  ok(r1.devs.length===3,"аналізатор: 3 пристрої у прикладі"); ok(has(/різні області/),"аналізатор: OSPF area"); ok(has(/hello\/dead/),"аналізатор: таймери"); ok(has(/різні режими/),"аналізатор: EtherChannel режими"); ok(has(/лише deny/),"аналізатор: ACL deny"); ok(has(/PortFast без BPDU guard/),"аналізатор: PortFast"); ok(has(/Telnet/),"аналізатор: Telnet"); ok(has(/режим порту не вказано/),"аналізатор: DTP на порту з access vlan");
  const r2=CC.ccCheck("hostname A\ninterface Gi0/0\n ip address 10.0.0.1 255.255.255.0\n standby 1 ip 10.0.0.254\n===\nhostname B\ninterface Gi0/0\n ip address 10.0.0.1 255.255.255.128\n standby 1 ip 10.0.0.253\n"); ok(r2.F.some(f=>/дублікат IP/.test(f.msg))&&r2.F.some(f=>/різні маски/.test(f.msg))&&r2.F.some(f=>/різні віртуальні/.test(f.msg)),"аналізатор: дубль IP, маски, HSRP VIP");
  const CG=new Function("lsGet","esc","dkey",R("app-confcheck.js").replace(/\/\/ ---- екран ----[\s\S]*$/,"")+R("app-confgen.js").replace(/let CGV[\s\S]*$/,"")+";return {cgBuild,CG_DEF,cgDiff};")(()=>({}),x=>x,()=>"2026-01-01");
  for(const role of ["access","l3","router"]){ const out=CG.cgBuild(Object.assign({},CG.CG_DEF,{role,defRoute:role==="access"?"":"10.0.0.1",ntp:"10.0.0.5",syslog:"10.0.0.6"})); const rr=CC.ccCheck(out);
    ok(!rr.F.some(f=>f.sev!=="info"),"генератор "+role+": аналізатор знайшов "+rr.F.filter(f=>f.sev!=="info").map(f=>f.msg).join("; ")); ok(rr.sec[0].score===rr.sec[0].n,"генератор "+role+": захищеність "+rr.sec[0].score+"/"+rr.sec[0].n);
    const bad=CC.ccSyntax(rr.devs[0].lines).filter(l=>l!=="ip address dhcp"); ok(!bad.length,"генератор "+role+": симулятор не прийняв "+bad.join(" | ")); }
  const REFX=new Function(R("app-ref.js").replace(/\/\/ ---- екрани ----[\s\S]*$/,"")+";return {REF,RUNBOOKS};")();
  for(const r of REFX.REF){ ok(!!TMAP0[r.t]&&/^.+ \(.+\)$/.test(r.n),"довідник: назва/тема "+r.n); ok(r.rule&&r.cfg&&r.ver&&r.brk&&r.cards.length>=2,"довідник: поля "+r.n); }
  for(const [k,b] of Object.entries(REFX.RUNBOOKS)){ ok(!!TMAP0[b.t]&&b.n[b.start],"діагностика "+k+": тема/старт"); const seen=new Set(); const st=[b.start];
    while(st.length){ const id=st.pop(); if(seen.has(id)) continue; seen.add(id); const x=b.n[id]; ok(!!x,"діагностика "+k+": немає вузла "+id); if(!x) continue; ok(!!x.fix||(!!x.s&&((x.o||[]).length||x.go)),"діагностика "+k+"/"+id+": порожній вузол"); if(x.go) ok(!!REFX.RUNBOOKS[x.go],"діагностика "+k+": go "+x.go); for(const [,nx] of x.o||[]) st.push(nx); }
    ok(seen.size===Object.keys(b.n).length,"діагностика "+k+": недосяжні вузли "+Object.keys(b.n).filter(n=>!seen.has(n)).join(",")); }
  const PT=new Function("flags","patch",R("app-srwe.js").replace(/const mdGet[\s\S]*$/,"")+";return PT_ACT;")({},()=>{}); for(const a of PT){ ok(!!TMAP0[a[1]]&&a[3].length&&a[4].length&&a[5].length,"PT "+a[0]+": поля"); }
  const EC=new Function(R("app-ec.js").replace(/let EC_M[\s\S]*$/,"")+";return {ecRun};")(); const exp={"active|active":1,"active|passive":1,"passive|passive":0,"desirable|auto":1,"auto|auto":0,"on|on":1,"on|active":0,"desirable|passive":0};
  for(const [k,v] of Object.entries(exp)){ const [a,b]=k.split("|"); ok(EC.ecRun(a,b,"none").up===!!v,"EtherChannel "+k); } ok(EC.ecRun("active","active","speed").f1.includes("s"),"EtherChannel: різна швидкість → s"); }
// ---- пакет покроково, VLSM, документація, челенджі, Skills Assessment ----
{ const TMAP1=Object.fromEntries([...topicIds].map(t=>[t,1])); const QBall=Object.values(allQ); const TMAPall=Object.fromEntries([...topicIds].map(t=>[t,{g:t.replace(/\d+$/,"")}])); const qtypeT=q=>q.type||"mc"; const ip2nT=x=>x.split(".").reduce((a,b)=>a*256+ +b,0); const fs=require("fs"); const R=f=>fs.readFileSync(P(f),"utf8"); global.CLI=window.CLI;
  ok(window.INTERVIEW.Q.filter(q=>q.cat==="srwe").length>=20&&window.INTERVIEW.Q.filter(q=>q.cat==="srwe").every(q=>TMAP1[q.t]),"поясни вголос: теми SRWE");
  const PW=new Function(R("app-packet.js").replace(/let PWV[\s\S]*$/,"")+";return {pwBuild,PW_SCN};")();
  for(const [scn,x] of Object.entries(PW.PW_SCN)) for(const f of Object.keys(x.faults)){ const st=PW.pwBuild(scn,f); ok(st.length>=(f==="none"?4:2),"пакет "+scn+"/"+f+": кроків "+st.length);
    for(const s of st){ ok(s.q&&s.q.a>=0&&s.q.a<s.q.o.length&&new Set(s.q.o).size===s.q.o.length&&s.pre&&s.post&&s.T,"пакет "+scn+"/"+f+": крок"); if(s.link) ok(s.link.every(n=>/^(PC[123]|S[12]|R1|ISP|SRV)$/.test(n)),"пакет: вузол"); }
    ok(!!st[st.length-1].fail===(f!=="none"),"пакет "+scn+"/"+f+": поломка має зупинити пакет"); ok(st.filter(s=>s.fail).length<=1,"пакет: одна точка збою"); }
  const CCs=R("app-confcheck.js").replace(/\/\/ ---- екран ----[\s\S]*$/,"");
  const VL=new Function("lsGet","esc","dkey",CCs+R("app-confgen.js").replace(/let CGV[\s\S]*$/,"")+R("app-vlsm.js").replace(/let VLV[\s\S]*$/,"")+";return {vlPlan,cgBuild,CG_DEF,ccCheck};")(()=>({}),x=>x,()=>"2026-01-01");
  const pl=VL.vlPlan({base:"192.168.0.0/22",reserve:20,firstVlan:10,step:10,dhcpSkip:10,rows:"USERS 120\nVOICE 60\nPRINTERS 20\nLINK-R1-ISP 2"}); ok(!pl.err&&pl.rows.length===4,"VLSM: план");
  if(!pl.err){ const u=pl.rows.find(r=>r.name==="USERS"); ok(u.len===24&&u.net==="192.168.0.0"&&u.gw==="192.168.0.1","VLSM: USERS /24 першою ("+u.net+"/"+u.len+")"); ok(pl.rows.find(r=>r.name==="LINK-R1-ISP").len===30,"VLSM: лінк /30"); const v=pl.rows.find(r=>r.name==="VOICE"); ok(v.len===25&&v.net==="192.168.1.0","VLSM: VOICE /25 (60×1.2=72)");
    let prev=-1; for(const r of pl.rows){ const n=ip2nT(r.net); ok(n>prev,"VLSM: без перекриття"); prev=n+2**(32-r.len)-1; }
    const out=VL.cgBuild(Object.assign({},VL.CG_DEF,{role:"router",host:"R1",vlans:pl.rows.filter(r=>r.vlan).map(r=>`${r.vlan} ${r.name} ${r.gw}/${r.len}`).join("\n")})); const cr=VL.ccCheck(out); ok(!cr.F.some(f=>f.sev==="err"),"VLSM → генератор: без помилок"); }
  ok(!!VL.vlPlan({base:"10.0.0.0/28",rows:"A 50"}).err,"VLSM: нестача місця"); ok(!!VL.vlPlan({base:"10.0.0.5/24",rows:"A 5"}).err,"VLSM: не адреса мережі");
  const ND=new Function("lsGet","esc","dkey",CCs+R("app-netdoc.js").replace(/let NDV[\s\S]*?(?=const ND_SAMPLE)/,"").replace(/VIEWS\.netdoc[\s\S]*$/,"")+";return {ndParse,ndMd,ND_SAMPLE};")(()=>"",x=>x,()=>"2026-01-01");
  const nr=ND.ndParse(ND.ND_SAMPLE); ok(nr.L.length===4&&nr.D.ISP&&nr.D.ISP.type==="router"&&nr.D.S2.type==="switch","документація: приклад ("+nr.L.length+" лінків)"); ok(/```mermaid[\s\S]*R1 ---\|"Gi0\/0 ↔ Gi0\/1"\| S1/.test(ND.ndMd(nr)),"документація: Mermaid");
  { const {N,ses}=CLI.startNet({def:()=>({devices:{R1:{type:"router"},S1:{type:"switch"},S2:{type:"switch"}},links:[["R1","Gi0/0","S1","Gi0/1"],["S1","Fa0/24","S2","Fa0/24"]]})}); ses.R1.exec("en"); ses.R1.exec("conf t"); ses.R1.exec("int g0/0"); ses.R1.exec("ip address 10.0.0.1 255.255.255.0"); ses.R1.exec("no sh"); ses.R1.exec("end"); N.recompute();
    let t=""; for(const d of ["R1","S1","S2"]){ ses[d].exec("en"); t+=d+"#show cdp neighbors\n"+ses[d].exec("show cdp neighbors")+"\n"+d+"#show ip interface brief\n"+ses[d].exec("show ip interface brief")+"\n"; } t+="S1#show cdp neighbors detail\n"+ses.S1.exec("show cdp neighbors detail");
    const r2=ND.ndParse(t); ok(r2.L.length===2,"документація: виводи симулятора → 2 лінки ("+JSON.stringify(r2.L)+")"); ok(r2.D.R1.ifs["Gi0/0"]&&r2.D.R1.ifs["Gi0/0"].ip==="10.0.0.1","документація: адреси"); }
  const CHs=R("app-challenge.js"); const CH=new Function("QB","QB_BASE","TMAP","qtype",CHs.replace(/let CHV[\s\S]*?(?=VIEWS\.challenge)/,"").replace(/VIEWS\.challenge[\s\S]*$/,"")+";return {chPick,chId,chWeekKey};")(QBall,QBall,TMAPall,qtypeT);
  const p1=CH.chPick("week-2026-W48",["SRWE"],15), p2=CH.chPick("week-2026-W48",["SRWE"],15), p3=CH.chPick("week-2026-W49",["SRWE"],15); ok(p1.length===15&&p1.join()===p2.join()&&p1.join()!==p3.join(),"челендж: детермінований набір"); ok(/^\d{4}-W\d\d$/.test(CH.chWeekKey()),"челендж: тиждень");
  const SA=new Function("lsGet","esc",CCs+CHs.match(/const chRng = [^\n]*\n/)[0]+R("app-sa.js").replace(/VIEWS\.sa = [\s\S]*$/,"")+";return {saGen,saGrade,saSolution,saVlanBrief,ccSyntax};")(()=>null,x=>x);
  for(let k=0;k<25;k++){ const Pp=SA.saGen("t"+k); const S=SA.saSolution(Pp); const text=["R1","S1","S2"].map(h=>"Building configuration...\n"+S[h].join("\n")+(h!=="R1"?"\n"+h+"#show vlan brief\n"+SA.saVlanBrief(Pp):"")).join("\n"); const G=SA.saGrade(Pp,text);
    ok(G.pct===100,"SA "+k+": еталон дає "+G.pct+"% ("+G.T.filter(t=>!t.ok).map(t=>t.txt).join("; ")+")"); if(k<3) for(const h of ["R1","S1","S2"]) ok(!SA.ccSyntax(S[h]).length,"SA: симулятор приймає еталон "+h); }
  { const Pp=SA.saGen("x"); ok(SA.saGrade(Pp,"").pct===0,"SA: порожня відповідь — 0%"); const S=SA.saSolution(Pp); const bad=S.R1.map(l=>l.replace(/^ipv6 unicast-routing$/,"!")).join("\n"); const G=SA.saGrade(Pp,"Building configuration...\n"+bad); ok(G.T.find(t=>/IPv6/.test(t.sec)).ok===false,"SA: без ipv6 unicast-routing — мінус"); } }
// ---- тестер ACL, журнали, захоплення, двійник, ліниве завантаження ----
{ const fs=require("fs"); const R=f=>fs.readFileSync(P(f),"utf8"); const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const A=new Function("prog","tlabel","esc",R("app-acl.js").replace(/let ACV[\s\S]*$/,"")+";return {aclParse,aclEval,aclPkt,aclShadow,ACL_TASKS};")({},x=>x,x=>x);
  const sol={a1:"access-list 10 deny 192.168.20.0 0.0.0.255\naccess-list 10 permit any",a2:"access-list 5 permit host 192.168.1.10\naccess-list 5 permit 10.0.0.0 0.255.255.255",a3:"ip access-list extended W\n permit tcp 172.16.0.0 0.0.255.255 host 10.1.1.10 eq 80\n permit tcp 172.16.0.0 0.0.255.255 host 10.1.1.10 eq 443\n deny ip 172.16.0.0 0.0.255.255 host 10.1.1.10\n permit ip any any",a4:"access-list 120 deny icmp 192.168.10.0 0.0.0.255 192.168.20.0 0.0.0.255 echo\naccess-list 120 permit ip any any",a5:"ip access-list extended WAN-IN\n permit tcp any 203.0.113.0 0.0.0.255 established\n permit udp host 8.8.8.8 eq 53 203.0.113.0 0.0.0.255",a6:"access-list 130 permit tcp host 192.168.99.5 10.0.0.0 0.255.255.255 eq 22\naccess-list 130 deny tcp any 10.0.0.0 0.255.255.255 eq 22\naccess-list 130 permit ip any any",a7:"access-list 20 deny 192.168.5.0 0.0.0.127\naccess-list 20 permit any",a8:"ip access-list extended G\n permit udp 172.31.0.0 0.0.0.255 any eq 53\n permit tcp 172.31.0.0 0.0.0.255 any eq 80\n permit tcp 172.31.0.0 0.0.0.255 any eq 443\n permit udp 172.31.0.0 0.0.0.255 any eq 67"};
  for(const T of A.ACL_TASKS){ ok(!!sol[T.id],"ACL: еталон для "+T.id); const Pp=A.aclParse(sol[T.id]); ok(!Pp.errs.length,"ACL "+T.id+": помилки розбору "+Pp.errs); const acl=Object.values(Pp.acls).pop(); for(const [l,exp,ex] of T.pk){ const pk=A.aclPkt(l); ok(!!pk,"ACL "+T.id+": пакет «"+l+"»"); if(pk) ok(A.aclEval(acl,Object.assign(pk,ex||{})).act===exp,"ACL "+T.id+": «"+l+"» має бути "+exp); }
    const empty=Object.values(A.aclParse("access-list 1 permit any").acls)[0]; ok(!T.pk.every(([l,exp,ex])=>A.aclEval(empty,Object.assign(A.aclPkt(l),ex||{})).act===exp),"ACL "+T.id+": тест не проходить з permit any"); }
  { const Pp=A.aclParse("access-list 101 permit ip any any\naccess-list 101 deny tcp any any eq 22\naccess-list 1 deny 10.0.0.0 255.0.0.0\nip access-list extended X\n permit tcp any any eq foo"); ok(A.aclShadow(Pp.acls["101"]).length===1,"ACL: затінений рядок"); ok(Pp.acls["1"].rules[0].warn.length>0,"ACL: маска замість wildcard"); ok(Pp.errs.length===1,"ACL: невідомий порт — помилка розбору"); }
  { const Pp=A.aclParse("access-list 100 permit tcp any host 10.0.0.1 range 20 21\naccess-list 100 permit udp any any gt 1023"); const acl=Pp.acls["100"]; ok(A.aclEval(acl,A.aclPkt("1.1.1.1 10.0.0.1 tcp 21")).act==="permit"&&A.aclEval(acl,A.aclPkt("1.1.1.1 10.0.0.1 tcp 22")).act==="deny"&&A.aclEval(acl,A.aclPkt("1.1.1.1 2.2.2.2 udp 5000")).act==="permit","ACL: range і gt"); }
  const SHs=R("app-show.js").replace(/let SHV[\s\S]*$/,""); const LG=new Function("shuffle","record",SHs+R("app-logs.js").replace(/let LGV[\s\S]*$/,"")+";return {LOGS,LG_SEV};")(shuffle,()=>{});
  for(const g of LG.LOGS.map((_,i)=>i)){ for(let k=0;k<20;k++){ const it=LG.LOGS[g](); const m=it.m.match(/^%([A-Z0-9_]+)-(\d)-([A-Z0-9_]+): \S/); ok(!!m,"журнал "+g+": формат «"+it.m+"»"); ok(it.a>=0&&it.a<it.o.length&&new Set(it.o).size===it.o.length&&it.why,"журнал "+g+": варіанти"); } }
  const PC=new Function("shuffle",SHs+R("app-pcap.js").replace(/let PCV[\s\S]*$/,"")+";return PCAP;")(shuffle);
  for(const [k,g] of Object.entries(PC)) for(let i=0;i<60;i++){ const it=g(); ok(it.L.length>=2&&it.L.every(p=>p.t&&p.src&&p.dst&&p.proto&&p.info&&p.tree.length),"захоплення "+k+": пакети"); ok(it.a>=0&&it.a<it.o.length&&new Set(it.o).size===it.o.length&&it.why,"захоплення "+k+": питання «"+it.q+"» "+JSON.stringify(it.o)); if(it.key!=null) ok(!!it.L[it.key],"захоплення "+k+": ключовий пакет"); }
  { const dk=(d=new Date())=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); const day=k=>{ const d=new Date(); d.setDate(d.getDate()+k); return dk(d); };
    const fl={}; for(let i=10;i>=1;i--) fl["rd:"+day(-i)]={on:false,s:700-10*i,v:"v2.0"};
    const FC=new Function("lsGet","lsSet","dkey","TOPICS","topicReady","opts","fwPlan","flags","exams","daily","passForecast","bpVer","patch","setTimeout","VIEWS","ACTS","saveDownload",R("app-forecast.js")+";return {icsBuild,icsFold,rdPlan,rdDay,rdIso};")(
      (k,d)=>d,()=>{},dk,[{id:"SRWE3",g:"SRWE",name:"VLANs; trunks, DTP"},{id:"SRWE5",g:"SRWE",name:"STP"},{id:"ENSA1",g:"ENSA",name:"OSPF"}],()=>({p:0.3,n:9,seen:3}),{examDate:day(30)},()=>({items:[{date:day(29),k:1,tasks:[["light","Легке повторення",""]]},{date:day(28),k:2,tasks:[["mock","Повна симуляція","120 питань"]]}]}),fl,[],{},()=>({score:700,ver:"v2.0",gaps:[]}),()=>"v2.0",()=>{},()=>{},{},{},()=>{});
    ok(FC.rdIso(FC.rdDay("2026-03-29"))==="2026-03-29"&&FC.rdDay("2026-03-30")-FC.rdDay("2026-03-29")===1,"прогноз: дні без зсуву часових поясів");
    const PL=FC.rdPlan(); ok(PL.T.slope>7&&PL.T.slope<13,"прогноз: нахил тренду ≈10/день ("+PL.T.slope+")"); ok(PL.eta>0&&PL.eta<20&&PL.proj>=825&&PL.tone!=="bad","прогноз: дата 825 і вердикт ("+PL.eta+", "+PL.proj+")");
    const ics=FC.icsBuild({time:"19:30",dur:60,dows:[1,2,3,4,5,6,0],course:"SRWE",rem:15,weeks:8}); const T=ics.text, Ls=T.split("\r\n");
    ok(T.startsWith("BEGIN:VCALENDAR\r\n")&&T.endsWith("END:VCALENDAR\r\n"),"ics: обгортка VCALENDAR і CRLF"); ok(Ls.every(l=>Buffer.byteLength(l)<=75),"ics: рядки ≤ 75 байт (folding)");
    ok((T.match(/BEGIN:VEVENT/g)||[]).length===(T.match(/END:VEVENT/g)||[]).length&&ics.P.ev.length>=25,"ics: події збалансовані ("+ics.P.ev.length+")");
    ok(T.includes("DTSTART;VALUE=DATE:"+day(30).replace(/-/g,""))&&ics.P.ev.every(e=>e.iso<day(30)),"ics: день іспиту і всі блоки до нього"); ok(ics.P.ev.some(e=>e.cat==="final"&&/симуляція/.test(e.title)&&e.dur>=120),"ics: фінішні дні з повною симуляцією");
    ok(/SUMMARY:CCNA SRWE3/.test(T)&&/VLANs\\; trunks\\, DTP/.test(T)&&/TRIGGER:-PT15M/.test(T),"ics: модулі, екранування ; і , та нагадування");
    ok(FC.icsFold("X".repeat(200)).split("\r\n ").every(l=>l.length<=75)&&FC.icsFold("Ж".repeat(60)).split("\r\n ").every(l=>Buffer.byteLength(l)<=75),"ics: folding UTF-8"); }
  { const SF=new Function("lsGet","render","VIEWS","ACTS",R("app-shift.js")+";return {shCats};")((k,d)=>d,function(){},{},{});
    const cs=[["R1: у правилі NAT для list 1 прибрано overload / змінено ACL","nat"],["S2: на trunk GigabitEthernet0/1 (до S1) увімкнено spanning-tree bpduguard — порт пішов у err-disabled","l2"],["S1: з Gi0/1 прибрано ip dhcp snooping trust — DHCPOFFER від сервера відкидаються","sec"],["R1: у пулі DHCP LAN хибний default-router","dhcp"],["S1: інтерфейс FastEthernet0/1 (до PC1) адміністративно вимкнено — потрібен no shutdown","l1"],["R2: прибрано ip ospf cost 50 з Gi0/1","route"],["S1: видалено VLAN 20 (порти в ній неактивні)","vlan"]];
    for(const [f,c] of cs) ok(SF.shCats([f])[0]===c,"черговий: категорія «"+f.slice(4,40)+"» → "+c+" ("+SF.shCats([f])+")");
    let miss=0; for(let k=0;k<120;k++){ const pool=window.CLI.NETSCEN.filter(s=>!s.discover); const t=window.CLI.troubleshoot(pool[k%pool.length],1); if(t) for(const f of t.faults) if(!SF.shCats([f]).length){ miss++; ok(false,"черговий: поломка без категорії: "+f); } } ok(!miss,"черговий: усі поломки мають категорію"); }
  { const GM=new Function("lsGet","lsSet","customQs","topicReady","dkey","VIEWS","ACTS",R("app-gapmap.js")+";return {gapCompute,gapMd,GAP_C};")((k,d)=>({names:["CCNA/SRWE/STP root bridge.md","EtherChannel LACP.md","VLAN basics.md"],ts:1}),()=>{},[{src:"n",file:"VLAN basics.md",t:"SRWE3",q:"Що таке VLAN?",ans:"x"},{src:"n",file:"STP root bridge.md",t:"SRWE5",q:"Як обирається root bridge?",ans:"BID"}],t=>t==="SRWE5"?{p:0.4,n:10,seen:8}:null,()=>"2026-01-01",{},{});
    const G=GM.gapCompute(); const row=c=>G.rows.find(r=>r.c.startsWith(c)); ok(G.rows.length===GM.GAP_C.length&&G.names.length===3,"прогалини: рядки і нотатки");
    ok(row("STP").st==="weak"&&row("EtherChannel").st==="nocards"&&row("VLAN").st==="unseen"&&row("NAT").st==="none","прогалини: статуси ("+["STP","EtherChannel","VLAN","NAT"].map(c=>row(c).st)+")");
    const md=GM.gapMd(G); ok(/^---\ntags: \[ccna, moc, gaps\]/.test(md)&&/\[\[ENSA6 NAT \/? ?PAT\]\]|\[\[ENSA6 NAT PAT\]\]/.test(md)&&/\[\[STP root bridge\]\]/.test(md),"прогалини: MOC .md з посиланнями"); }
  const idx=R("index.html"), sw=R("sw.js"), lz=R("app-lazy.js"); const lazyFiles=[...lz.matchAll(/"((?:app|interview)-[\w-]+\.js)"/g)].map(m=>m[1]);
  ok(lazyFiles.length>=15,"ліниві модулі: "+lazyFiles.length); for(const f of lazyFiles){ ok(fs.existsSync(P(f)),"лінивий файл існує: "+f); ok(!idx.includes('src="'+f+'"'),"лінивий файл не в index.html: "+f); ok(sw.includes('"'+f+'"'),"лінивий файл кешує service worker: "+f); }
  for(const f of [...idx.matchAll(/src="([\w.-]+\.js)"/g)].map(m=>m[1])) ok(sw.includes('"'+f+'"'),"sw.js кешує "+f); }
console.log(fails? "\n❌ Помилок: "+fails+" (перевірок "+checks+")" : "\n✅ Усі перевірки пройдено ("+checks+")");
process.exit(fails?1:0);
