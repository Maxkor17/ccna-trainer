// Автотести тренажера: банки питань, генератори, CLI-лаби, troubleshooting, REST API лаба.
// Запуск: node tests/run.js  (exit code 1 при будь-якій помилці)
const path=require("path"); const P=f=>path.join(__dirname,"..","public",f);
global.window={}; global.btoa=s=>Buffer.from(s).toString("base64"); global.atob=s=>Buffer.from(s,"base64").toString();
const files=["wlc","bash","questions-linux","questions-itn","questions-srwe","questions-notes","questions-extra","questions-srwe2","questions-ensa","questions-netacad","questions-ensa2","questions-v2","questions-simlet","questions-more","questions-practice","questions-figs","questions-en","glossary","cheats","pairs","gen","gen2","gen3","api","cli"];
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
  const t=C.troubleshoot(sc,1); ok(!!t,"troubleshooting не згенерувався для "+sc.id); }
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
  const r=A.TASKS.filter(t=>!t.ok(L)).map(t=>t.id); ok(!r.length,"Ansible: не виконано "+r.join(","));
  ok(!A.run(L,"- hosts: S1\n  gather_facts: false\n  tasks:\n    - ios_command:\n        commands: configure terminal\n").ok,"Ansible: ios_command не має приймати conf t"); }
// ---- злиття денних записів (журнал і час між пристроями) ----
{ const src=app.match(/function mergeDay\(o,v\)\{[\s\S]*?\n  return r; \}/); ok(!!src,"mergeDay не знайдено в app-*.js");
  if(src){ const mergeDay=new Function(src[0]+"; return mergeDay;")(); const r=mergeDay({n:5,c:4,m:10,log:[{ts:1,min:30,k:"pt"}],note:"a",jts:5},{n:3,c:3,m:12,log:[{ts:1,min:30,k:"pt"},{ts:2,min:15,k:"na"}],note:"b",jts:9});
    ok(r.n===5&&r.c===4,"mergeDay: відповіді"); ok(r.m===12,"mergeDay: хвилини"); ok(r.log.length===2,"mergeDay: журнал без дублів"); ok(r.note==="b","mergeDay: новіший чек-ін"); } }
console.log(fails? "\n❌ Помилок: "+fails+" (перевірок "+checks+")" : "\n✅ Усі перевірки пройдено ("+checks+")");
process.exit(fails?1:0);
