// Модульні тести двигуна симулятора: розбір команд, DTP, EtherChannel, STP, ACL, LPM.
// Запуск: node tests/cli-unit.js
const path=require("path"); global.window={}; global.btoa=s=>Buffer.from(s).toString("base64"); global.atob=s=>Buffer.from(s,"base64").toString();
require(path.join(__dirname,"..","public","cli.js")); const C=window.CLI;
let fails=0, n=0; const ok=(c,m)=>{ n++; if(!c){ fails++; console.error("✗ "+m); } };
const net=(def,cmds)=>{ const {N,ses}=C.startNet({def:()=>def}); for(const [d,list] of Object.entries(cmds||{})){ ses[d].exec("enable"); ses[d].exec("conf t"); for(const c of list) ses[d].exec(c); ses[d].exec("end"); } N.recompute(); return {N,ses}; };
// ---- розбір ----
ok(C.normIf("gi0/1")==="Gi0/1"&&C.normIf("fa 0/24")==="Fa0/24"&&C.normIf("po1")==="Po1"&&C.normIf("g0/0.10")==="Gi0/0.10","normIf");
ok(JSON.stringify(C.parseList("10,20,30-32"))==="[10,20,30,31,32]"&&C.parseList("10,,20")===null,"parseList");
{ const s=C.Session(C.newState({hostname:"S1"})); s.exec("en"); ok(/#$/.test(s.prompt()),"en → привілейований режим"); s.exec("conf t"); s.exec("int fa0/1"); ok(/config-if/.test(s.prompt()),"int fa0/1"); s.exec("sw mo acc"); s.exec("sw acc vl 10");
  ok(s.state.ifs["Fa0/1"].accessVlan===10,"скорочення sw acc vl 10"); ok(/Invalid input/.test(s.exec("switchport foo")),"неправильна команда → Invalid input");
  s.exec("end"); ok(/access vlan 10/.test(s.exec("sh run | i access vlan")),"фільтр | include"); ok(/^Number of lines/.test(s.exec("show run | count interface")),"фільтр | count"); }
// ---- DTP ----
const two=(ma,mb,extra)=>net({devices:{S1:{type:"switch"},S2:{type:"switch"}},links:[["S1","Gi0/1","S2","Gi0/1"]]},{S1:["interface gi0/1","switchport mode "+ma].concat(extra&&extra.S1||[]),S2:["interface gi0/1","switchport mode "+mb].concat(extra&&extra.S2||[])}).N;
const DTP=[["dynamic auto","dynamic auto","access"],["dynamic auto","dynamic desirable","trunk"],["dynamic auto","trunk","trunk"],["dynamic auto","access","access"],["dynamic desirable","dynamic desirable","trunk"],["dynamic desirable","trunk","trunk"],["dynamic desirable","access","access"],["trunk","trunk","trunk"],["access","access","access"]];
for(const [a,b,want] of DTP){ const N=two(a,b); const op=N.dev.S1.ifs["Gi0/1"]._oper||N.dev.S1.ifs["Gi0/1"].mode; ok(op===want,"DTP "+a+" + "+b+" → "+want+" (отримано "+op+")"); }
{ const N=two("trunk","dynamic auto",{S1:["switchport nonegotiate"]}); ok((N.dev.S2.ifs["Gi0/1"]._oper||"")!=="trunk","nonegotiate: dynamic auto навпроти не стає trunk"); }
// ---- EtherChannel ----
const ec=(ma,mb)=>net({devices:{S1:{type:"switch"},S2:{type:"switch"}},links:[["S1","Gi0/1","S2","Gi0/1"],["S1","Gi0/2","S2","Gi0/2"]]},{S1:["interface range gi0/1 - 2","channel-group 1 mode "+ma],S2:["interface range gi0/1 - 2","channel-group 1 mode "+mb]}).N;
const EC=[["active","passive",true],["active","active",true],["passive","passive",false],["desirable","auto",true],["desirable","desirable",true],["auto","auto",false],["on","on",true],["active","desirable",false]];
for(const [a,b,want] of EC){ const N=ec(a,b); const got=["Gi0/1","Gi0/2"].every(p=>N.dev.S1.ifs[p]._ec==="P"); ok(got===want,"EtherChannel "+a+" + "+b+" → "+(want?"P":"не зібрано")+" (отримано "+N.dev.S1.ifs["Gi0/1"]._ec+")"); }
{ const {N}=net({devices:{S1:{type:"switch"},S2:{type:"switch"}},links:[["S1","Gi0/1","S2","Gi0/1"],["S1","Gi0/2","S2","Gi0/2"]]},{S1:["interface range gi0/1 - 2","switchport mode trunk","channel-group 1 mode active","interface gi0/2","switchport trunk allowed vlan 10"],S2:["interface range gi0/1 - 2","switchport mode trunk","channel-group 1 mode active"]});
  ok(N.dev.S1.ifs["Gi0/2"]._ec==="s"||N.dev.S1.ifs["Gi0/2"]._ec!=="P","EtherChannel: член з іншими параметрами не входить у канал"); }
// ---- STP ----
{ const tri={devices:{S1:{type:"switch",mac:"0019.0000.0001"},S2:{type:"switch",mac:"0019.0000.0002"},S3:{type:"switch",mac:"0019.0000.0003"}},links:[["S1","Gi0/1","S2","Gi0/1"],["S2","Gi0/2","S3","Gi0/2"],["S3","Gi0/1","S1","Gi0/2"]]};
  const cmds={S1:["interface range gi0/1 - 2","switchport mode trunk"],S2:["interface range gi0/1 - 2","switchport mode trunk"],S3:["interface range gi0/1 - 2","switchport mode trunk"]};
  let st=net(tri,cmds).N.stp(1); ok(st.S2.rootName==="S1"&&st.S3.rootName==="S1","STP: root — найменший MAC при рівних пріоритетах");
  const blk=Object.entries(st).flatMap(([d,x])=>Object.entries(x.roles||{}).filter(([,r])=>r[1]==="BLK").map(([p])=>d+" "+p)); ok(blk.length===1&&/^S3 /.test(blk[0]),"STP: блокується один порт на комутаторі з найгіршим BID ("+blk.join(",")+")");
  cmds.S3=cmds.S3.concat(["spanning-tree vlan 1 priority 4096"]); st=net(tri,cmds).N.stp(1); ok(st.S1.rootName==="S3","STP: priority 4096 робить S3 root"); }
// ---- ACL і LPM ----
{ const def={devices:{R1:{type:"router"},PC1:{type:"pc",ip:"192.168.1.10",mask:"255.255.255.0",gw:"192.168.1.1"},PC2:{type:"pc",ip:"192.168.1.20",mask:"255.255.255.0",gw:"192.168.1.1"},Srv:{type:"server",ip:"10.0.0.5",mask:"255.255.255.0",gw:"10.0.0.1",services:[22,80]}},links:[["PC1","Fa0","R1","Gi0/0"],["Srv","Fa0","R1","Gi0/1"]]};
  const base=["interface g0/0","ip address 192.168.1.1 255.255.255.0","no shutdown","interface g0/1","ip address 10.0.0.1 255.255.255.0","no shutdown","exit"];
  let N=net(def,{R1:base.concat(["access-list 1 deny host 192.168.1.10","access-list 1 permit any","interface g0/1","ip access-group 1 out"])}).N;
  ok(!N.flow("PC1","10.0.0.5","icmp").ok,"стандартний ACL: deny host блокує PC1");
  N=net(def,{R1:base.concat(["access-list 1 permit host 192.168.1.99","interface g0/1","ip access-group 1 out"])}).N; ok(!N.flow("PC1","10.0.0.5","icmp").ok,"неявний deny any у кінці ACL");
  N=net(def,{R1:base.concat(["access-list 2 permit 192.168.1.0 0.0.0.7","interface g0/1","ip access-group 2 out"])}).N; ok(!N.flow("PC1","10.0.0.5","icmp").ok,"wildcard 0.0.0.7 не охоплює .10");
  N=net(def,{R1:base.concat(["ip access-list extended WEB","permit tcp any host 10.0.0.5 eq 80","exit","interface g0/0","ip access-group WEB in"])}).N;
  ok(N.flow("PC1","10.0.0.5","tcp",80).ok&&!N.flow("PC1","10.0.0.5","tcp",22).ok&&!N.flow("PC1","10.0.0.5","icmp").ok,"розширений ACL: лише TCP 80");
  N=net(def,{R1:base.concat(["ip access-list extended WEB","deny tcp any any eq 80","permit tcp any any eq 80","permit ip any any","exit","interface g0/0","ip access-group WEB in"])}).N; ok(!N.flow("PC1","10.0.0.5","tcp",80).ok,"ACL: перший збіг виграє");
  N=net(def,{R1:base.concat(["ip route 172.16.0.0 255.255.0.0 10.0.0.5","ip route 172.16.5.0 255.255.255.0 192.168.1.20"])}).N; const t=C.sessionsFor(N).R1; t.exec("enable"); const r=t.exec("show ip route 172.16.5.9");
  ok(/172\.16\.5\.0/.test(r)&&/192\.168\.1\.20/.test(r),"LPM: show ip route обирає найдовший префікс"); }
console.log(fails? "\n❌ Модульні тести: помилок "+fails+" з "+n : "\n✅ Модульні тести симулятора: "+n+" перевірок");
process.exit(fails?1:0);
