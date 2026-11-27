// ================= CCNA v2.0: захист STP, storm control, RA guard, VRRP, OSPFv3, AAA, SCP/SFTP, діагностика =================
// --- root guard, loop guard ---
add("if","spanning-tree guard root",F((i,a,s)=>{ if(s.router||!i.switchport) return INV; i.stpGuard="root"; }));
add("if","spanning-tree guard loop",F((i,a,s)=>{ if(s.router||!i.switchport) return INV; i.stpGuard="loop"; }));
add("if","spanning-tree guard none",F(i=>{ i.stpGuard="none"; }));
add("if","no spanning-tree guard",F(i=>{ i.stpGuard=null; }));
add(C,"spanning-tree loopguard default",s=>{ if(s.router) return INV; s.loopguardDefault=true; });
add(C,"no spanning-tree loopguard default",s=>{ s.loopguardDefault=false; });
// --- storm control ---
const pctOk=w=>/^\d{1,3}(\.\d{1,2})?$/.test(w)&&Number(w)<=100;
add("if","storm-control broadcast level <w>",F((i,a,s)=>{ if(s.router||!pctOk(a[0])) return INV; i.storm=Object.assign({action:"drop"},i.storm,{bcast:Number(a[0]),low:Number(a[0])}); }));
add("if","storm-control broadcast level <w> <w>",F((i,a,s)=>{ if(s.router||!pctOk(a[0])||!pctOk(a[1])||Number(a[1])>Number(a[0])) return INV; i.storm=Object.assign({action:"drop"},i.storm,{bcast:Number(a[0]),low:Number(a[1])}); }));
add("if","storm-control multicast level <w>",F((i,a,s)=>{ if(s.router||!pctOk(a[0])) return INV; i.storm=Object.assign({action:"drop"},i.storm,{mcast:Number(a[0])}); }));
add("if","storm-control action shutdown",F((i,a,s)=>{ if(s.router) return INV; i.storm=Object.assign({},i.storm,{action:"shutdown"}); }));
add("if","storm-control action trap",F((i,a,s)=>{ if(s.router) return INV; i.storm=Object.assign({},i.storm,{trap:true}); }));
add("if","no storm-control action shutdown",F(i=>{ if(i.storm) i.storm.action="drop"; }));
add("if","no storm-control broadcast level",F(i=>{ if(i.storm) delete i.storm.bcast; }));
function showStorm(s,only){ let o="Interface  Filter State   Upper        Lower        Current\n---------  -------------  -----------  -----------  ----------\n";
  for(const i of Object.values(s.ifs).filter(x=>x.storm&&x.storm.bcast!=null&&(!only||x.name===only))) o+=pad(i.name,11)+pad(i.errdis==="storm-control"?"Shutdown":i._stormDrop?"Blocking":"Forwarding",15)+pad(i.storm.bcast.toFixed(2)+"%",13)+pad(i.storm.low.toFixed(2)+"%",13)+(i._stormDrop||i.errdis==="storm-control"?"97.31%":"0.00%")+"\n"; return o; }
// --- IPv6 RA guard ---
add(C,"ipv6 nd raguard policy <w>",(s,a,ctx)=>{ if(s.router) return INV; s.raPol=s.raPol||{}; if(!s.raPol[a[0]]) s.raPol[a[0]]={role:"host"}; ctx.mode="raguard"; ctx.pol=a[0]; });
add(C,"no ipv6 nd raguard policy <w>",(s,a)=>{ if(s.raPol) delete s.raPol[a[0]]; });
const RG="raguard"; add(RG,"exit",(s,a,ctx)=>{ctx.mode="config";}); add(RG,"end",(s,a,ctx)=>{ctx.mode="exec";});
add(RG,"device-role <w>",(s,a,ctx)=>{ const r=["host","router","monitor","switch"].find(x=>x.startsWith(a[0].toLowerCase())); if(!r) return INV; s.raPol[ctx.pol].role=r; });
add("if","ipv6 nd raguard attach-policy <w>",F((i,a,s)=>{ if(s.router) return INV; if(!(s.raPol||{})[a[0]]) return "% Policy "+a[0]+" not found"; i.raGuard=a[0]; }));
add("if","ipv6 nd raguard",F((i,a,s)=>{ if(s.router) return INV; i.raGuard="(default)"; }));
add("if","no ipv6 nd raguard",F(i=>{ i.raGuard=null; })); add("if","no ipv6 nd raguard attach-policy",F(i=>{ i.raGuard=null; }));
const raRole=(s,i)=>!i.raGuard?null: i.raGuard==="(default)"?"host" : ((s.raPol||{})[i.raGuard]||{role:"host"}).role;
// --- VRRP (класичний синтаксис IOS) ---
const vrrpG=(i,g)=>{ i.vrrp=i.vrrp||{}; if(!i.vrrp[g]) i.vrrp[g]={ip:null,prio:100,preempt:true}; return i.vrrp[g]; };
add("if","vrrp <n> ip <ip>",F((i,a)=>{ if(i.switchport&&!i.svi) return INV; if(a[0]<1||a[0]>255) return INV; vrrpG(i,a[0]).ip=a[1]; }));
add("if","vrrp <n> priority <n>",F((i,a)=>{ if(a[1]<1||a[1]>254) return INV; vrrpG(i,a[0]).prio=a[1]; }));
add("if","vrrp <n> preempt",F((i,a)=>{ vrrpG(i,a[0]).preempt=true; }));
add("if","no vrrp <n> preempt",F((i,a)=>{ vrrpG(i,a[0]).preempt=false; }));
add("if","vrrp <n> description <rest>",F((i,a)=>{ vrrpG(i,a[0]).desc=a[1]; }));
add("if","no vrrp <n>",F((i,a)=>{ if(i.vrrp) delete i.vrrp[a[0]]; }));
// --- OSPFv3 ---
add(C,"ipv6 router ospf <n>",(s,a,ctx)=>{ if(!s.l3) return INV; if(!s.ospf6||s.ospf6.pid!==a[0]) s.ospf6={pid:a[0],rid:null,passive:[],defOrig:false,defAlways:false};
  ctx.mode="rtr6"; if(!s.ospf6.rid&&!Object.values(s.ifs).some(i=>i.ip)) return "%OSPFv3-4-NORTRID: Process OSPFv3-"+a[0]+"-IPv6 could not pick a router-id, please configure manually"; });
add(C,"no ipv6 router ospf <n>",(s)=>{ s.ospf6=null; });
const R6="rtr6"; add(R6,"exit",(s,a,ctx)=>{ctx.mode="config";}); add(R6,"end",(s,a,ctx)=>{ctx.mode="exec";}); add(R6,"do <rest>",(s,a,ctx)=>ctx.runIn("exec",a[0]));
add(R6,"router-id <ip>",(s,a)=>{ s.ospf6.rid=a[0]; });
add(R6,"passive-interface <if>",(s,a)=>{ if(!s.ospf6.passive.includes(a[0])) s.ospf6.passive.push(a[0]); });
add(R6,"no passive-interface <if>",(s,a)=>{ s.ospf6.passive=s.ospf6.passive.filter(x=>x!==a[0]); });
add(R6,"default-information originate",(s)=>{ s.ospf6.defOrig=true; s.ospf6.defAlways=false; });
add(R6,"default-information originate always",(s)=>{ s.ospf6.defOrig=true; s.ospf6.defAlways=true; });
add(R6,"auto-cost reference-bandwidth <n>",(s,a)=>{ s.ospf6.refbw=a[0]; });
add("if","ipv6 ospf <n> area <w>",F((i,a,s)=>{ if(!s.l3||(i.switchport&&!i.svi)) return INV; const ar=areaNum(a[1]); if(ar===null) return INV; i.ospf6={pid:a[0],area:ar}; if(!s.ospf6) s.ospf6={pid:a[0],rid:null,passive:[],defOrig:false,defAlways:false}; }));
add("if","no ipv6 ospf <n> area <w>",F(i=>{ i.ospf6=null; }));
add("if","ipv6 ospf cost <n>",F((i,a)=>{ if(a[0]<1||a[0]>65535) return INV; i.ospf6Cost=a[0]; }));
add("if","ipv6 ospf priority <n>",F((i,a)=>{ if(a[0]>255) return INV; i.ospf6Prio=a[0]; }));
add("if","no ipv6 ospf cost",F(i=>{ i.ospf6Cost=null; }));
// --- AAA, TACACS+, RADIUS, SCP ---
const AAA=s=>{ if(!s.aaa) s.aaa={on:false,login:{},authz:{},acct:{}}; return s.aaa; };
add(C,"aaa new-model",s=>{ AAA(s).on=true; });
add(C,"no aaa new-model",s=>{ AAA(s).on=false; });
const aaaMethods=t=>{ const w=t.toLowerCase().split(/\s+/); const out=[]; for(let k=0;k<w.length;k++){ if(w[k]==="group"&&["tacacs+","radius"].includes(w[k+1])){ out.push(w[k+1]); k++; } else if(["local","none","enable","line"].includes(w[k])) out.push(w[k]); else return null; } return out.length?out:null; };
add(C,"aaa authentication login <w> <rest>",(s,a)=>{ if(!AAA(s).on) return INV; const m=aaaMethods(a[1]); if(!m) return INV; s.aaa.login[a[0]]=m; });
add(C,"no aaa authentication login <w>",(s,a)=>{ delete AAA(s).login[a[0]]; });
add(C,"aaa authorization exec <w> <rest>",(s,a)=>{ if(!AAA(s).on) return INV; const m=aaaMethods(a[1]); if(!m) return INV; s.aaa.authz[a[0]]=m; });
add(C,"aaa accounting exec <w> <rest>",(s,a)=>{ if(!AAA(s).on) return INV; s.aaa.acct[a[0]]=a[1]; });
add(C,"tacacs server <w>",(s,a,ctx)=>{ s.tacacs=s.tacacs||{}; if(!s.tacacs[a[0]]) s.tacacs[a[0]]={ip:null,key:null,port:49}; ctx.mode="tacsrv"; ctx.srv=a[0]; });
add(C,"no tacacs server <w>",(s,a)=>{ if(s.tacacs) delete s.tacacs[a[0]]; });
add(C,"radius server <w>",(s,a,ctx)=>{ s.radius=s.radius||{}; if(!s.radius[a[0]]) s.radius[a[0]]={ip:null,key:null,auth:1812,acct:1813}; ctx.mode="radsrv"; ctx.srv=a[0]; });
add(C,"no radius server <w>",(s,a)=>{ if(s.radius) delete s.radius[a[0]]; });
for(const [M,T] of [["tacsrv","tacacs"],["radsrv","radius"]]){ add(M,"exit",(s,a,ctx)=>{ctx.mode="config";}); add(M,"end",(s,a,ctx)=>{ctx.mode="exec";});
  add(M,"address ipv4 <ip>",(s,a,ctx)=>{ s[T][ctx.srv].ip=a[0]; }); add(M,"key <rest>",(s,a,ctx)=>{ s[T][ctx.srv].key=a[0].replace(/^[07]\s+/,""); }); }
add("tacsrv","port <n>",(s,a,ctx)=>{ s.tacacs[ctx.srv].port=a[0]; });
add("radsrv","address ipv4 <ip> auth-port <n> acct-port <n>",(s,a,ctx)=>{ Object.assign(s.radius[ctx.srv],{ip:a[0],auth:a[1],acct:a[2]}); });
add("line","login authentication <w>",(s,a,ctx)=>{ if(!AAA(s).on) return INV; (ctx.line==="vty"?s.vty:s.con).authList=a[0]; });
add("line","no login authentication",(s,a,ctx)=>{ (ctx.line==="vty"?s.vty:s.con).authList=null; });
add(C,"ip scp server enable",s=>{ if(!AAA(s).on) return "% AAA authorization must be enabled for SCP (aaa new-model + aaa authorization exec)"; s.scpServer=true; });
add(C,"no ip scp server enable",s=>{ s.scpServer=false; });
add("line","exec-timeout <n> <n>",(s,a,ctx)=>{ (ctx.line==="vty"?s.vty:s.con).execTimeout=[a[0],a[1]]; });
add(C,"banner motd <rest>",(s,a)=>{ s.motd=a[0].replace(/^(.)(.*)\1$/,"$2"); });
add(C,"security passwords min-length <n>",(s,a)=>{ if(a[0]<1||a[0]>16) return INV; s.pwMin=a[0]; });
add(C,"login block-for <n> attempts <n> within <n>",(s,a)=>{ s.loginBlock=a.slice(); });
add(C,"no ip http server",s=>{ s.httpOff=true; }); add(C,"ip http server",s=>{ s.httpOff=false; });
for(const m of ["exec"]){
  for(const src of ["running-config","startup-config"]) add(m,"copy "+src+" <w>",(s,a)=>{ if(!/^(scp|sftp|tftp|ftp):/i.test(a[0])) return INV; if(src==="startup-config"&&!s.saved) return "%Error opening nvram:/startup-config (No such file or directory)"; return s.net? s.net.fileCopy(s,a[0],src) : "%Error opening "+a[0]+" (Network is unreachable)"; });
}
// --- extended ping ---
for(const m of ["user","exec"]){
  add(m,"ping <ip> source <w>",(s,a)=>s.net? s.net.pingCli(s,a[0],{src:a[1]}) : INV);
  add(m,"ping <ip> repeat <n>",(s,a)=>s.net? s.net.pingCli(s,a[0],{repeat:a[1]}) : INV);
  add(m,"ping <ip> size <n>",(s,a)=>s.net? s.net.pingCli(s,a[0],{size:a[1]}) : INV);
  add(m,"ping <ip> source <w> repeat <n>",(s,a)=>s.net? s.net.pingCli(s,a[0],{src:a[1],repeat:a[2]}) : INV);
  add(m,"ping <ip> repeat <n> source <w>",(s,a)=>s.net? s.net.pingCli(s,a[0],{src:a[2],repeat:a[1]}) : INV);
}
// --- show ---
function showVrrp(s,brief){ let o=brief?"Interface          Grp Pri Time  Own Pre State   Master addr     Group addr\n":"";
  for(const i of Object.values(s.ifs)) for(const [g,v] of Object.entries(i.vrrp||{})){ const st=s.net? s.net.vrrpState(s.devName,i.name,Number(g)) : {state:"Init",master:"unknown",prio:v.prio,own:false};
    if(brief) o+=pad(i.name,19)+pad(g,4)+pad(st.prio,4)+pad("3"+String(609-st.prio).padStart(3,"0"),6)+pad(st.own?"Y":"",4)+pad(v.preempt?"Y":"",4)+pad(st.state,8)+pad(st.master,16)+(v.ip||"unknown")+"\n";
    else o+=longIf(i.name)+" - Group "+g+(v.desc?"\n  "+v.desc:"")+"\n  State is "+st.state+"\n  Virtual IP address is "+(v.ip||"unknown")+"\n  Virtual MAC address is 0000.5e00.01"+Number(g).toString(16).padStart(2,"0")+"\n  Advertisement interval is 1.000 sec\n  Preemption "+(v.preempt?"enabled":"disabled")+"\n  Priority is "+st.prio+(st.own?" (IP address owner)":"")+"\n  Master Router is "+st.master+(st.state==="Master"?" (local)":"")+", priority is "+st.mprio+"\n  Master Advertisement interval is 1.000 sec\n  Master Down interval is 3.609 sec\n\n"; }
  return o.trimEnd(); }
function showTacacs(s){ const L=[]; for(const [n,t] of Object.entries(s.tacacs||{})){ const ok=s.net&&t.ip? s.net.aaaReach(s,t.ip,"tcp",t.port||49) : false; L.push("Tacacs+ Server - public  :\n               Server name: "+n+"\n            Server address: "+(t.ip||"0.0.0.0")+"\n               Server port: "+(t.port||49)+"\n              Socket opens: "+(ok?3:0)+"\n            Socket closes: "+(ok?3:0)+"\n             Socket aborts: 0\n             Socket errors: "+(ok?0:3)+"\n           Socket Timeouts: "+(ok?0:3)+"\n   Failed Connect Attempts: "+(ok?0:3)+"\n        Total Packets Sent: "+(ok?6:0)+"\n        Total Packets Recv: "+(ok?6:0)+"\n                    Status: "+(ok?"ALIVE":"DEAD")); } return L.join("\n\n")||"No TACACS+ servers configured"; }
function showLog(s){ const v=s.svc||{}; const buf=(s.logBuf||[]); return "Syslog logging: enabled (0 messages dropped, 0 flushes, 0 overruns)\n    Console logging: level debugging, "+buf.length+" messages logged\n    Monitor logging: level debugging, 0 messages logged\n    Buffer logging:  level debugging, "+buf.length+" messages logged\n    Trap logging: level "+(v.trap||"informational")+"\n"+(v.hosts||[]).map(h=>"        Logging to "+h+"  (udp port 514, audit disabled, link up)").join("\n")+"\n\nLog Buffer (8192 bytes):\n"+buf.join("\n"); }
for(const m of ["user","exec"]){
  add(m,"show storm-control",s=>showStorm(s)); add(m,"show storm-control <if>",(s,a)=>showStorm(s,a[0])); add(m,"show storm-control <if> broadcast",(s,a)=>showStorm(s,a[0]));
  add(m,"show ipv6 nd raguard policy",s=>Object.entries(s.raPol||{}).map(([n,p])=>"Policy "+n+" configuration:\n  device-role "+p.role+"\nPolicy "+n+" is applied on the following targets:\nTarget               Type  Policy               Feature        Target range\n"+Object.values(s.ifs).filter(i=>i.raGuard===n).map(i=>pad(i.name,21)+pad("PORT",6)+pad(n,21)+pad("RA guard",15)+"vlan all").join("\n")).join("\n\n"));
  add(m,"show vrrp brief",s=>showVrrp(s,true)); add(m,"show vrrp",s=>showVrrp(s,false));
  add(m,"show ipv6 ospf neighbor",s=>s.net? s.net.ospf6NbrShow(s) : ""); add(m,"show ipv6 ospf interface brief",s=>s.net? s.net.ospf6IfBrief(s) : "");
  add(m,"show ipv6 route ospf",s=>showRoute6(s,"O")); add(m,"show ipv6 protocols",s=>s.ospf6? "IPv6 Routing Protocol is \"connected\"\nIPv6 Routing Protocol is \"ND\"\nIPv6 Routing Protocol is \"ospf "+s.ospf6.pid+"\"\n  Router ID "+(s.net?s.net.ospf6Rid(s):s.ospf6.rid||"0.0.0.0")+"\n  Number of areas: 1 normal, 0 stub, 0 nssa\n  Interfaces (Area 0):\n"+Object.values(s.ifs).filter(i=>i.ospf6).map(i=>"    "+longIf(i.name)).join("\n") : "IPv6 Routing Protocol is \"connected\"\nIPv6 Routing Protocol is \"ND\"");
  add(m,"show tacacs",s=>showTacacs(s)); add(m,"show aaa servers",s=>showTacacs(s));
  add(m,"show logging",s=>showLog(s));
  add(m,"show mac address-table aging-time",s=>"Global Aging Time:  "+(s.macAging==null?300:s.macAging)+"\nVlan    Aging Time\n----    ----------");
  add(m,"show mac address-table static",s=>"          Mac Address Table\n-------------------------------------------\n\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n"+(s.macStatic||[]).map(x=>String(x.v).padStart(4)+"    "+pad(x.mac,18)+"STATIC      "+x.port).join("\n"));
  add(m,"show interfaces tunnel <n>",(s,a)=>{ const n="Tunnel"+a[0]; const i=s.ifs["Tu"+a[0]]; if(!i) return INV; const [st,pr]=ifStatus(s,i); return n+" is "+st+", line protocol is "+pr+"\n  Hardware is Tunnel\n  Internet address is "+(i.ip?i.ip+"/"+maskLen(i.mask):"unassigned")+"\n  MTU 17916 bytes, BW 100 Kbit/sec, DLY 50000 usec,\n  Tunnel source "+(i.tunSrc?(s.ifs[i.tunSrc]?s.ifs[i.tunSrc].ip+" ("+longIf(i.tunSrc)+")":i.tunSrc):"UNKNOWN")+", destination "+(i.tunDst||"UNKNOWN")+"\n  Tunnel protocol/transport GRE/IP\n    Key disabled, sequencing disabled\n    Checksumming of packets disabled\n  Tunnel TTL 255"; });
}
// --- MAC-таблиця (SRWE 2) ---
add(C,"mac address-table aging-time <n>",(s,a)=>{ if(s.router||a[0]>1000000||(a[0]>0&&a[0]<10)) return INV; s.macAging=a[0]; });
add(C,"mac address-table static <w> vlan <n> interface <if>",(s,a)=>{ if(s.router||!macRe.test(a[0])||!s.vlans[a[1]]||!s.ifs[a[2]]) return INV; s.macStatic=(s.macStatic||[]).filter(x=>!(x.mac===a[0].toLowerCase()&&x.v===a[1])); s.macStatic.push({mac:a[0].toLowerCase(),v:a[1],port:a[2]}); });
add(C,"no mac address-table static <w> vlan <n>",(s,a)=>{ s.macStatic=(s.macStatic||[]).filter(x=>!(x.mac===a[0].toLowerCase()&&x.v===a[1])); });
add("exec","clear mac address-table dynamic",s=>{ s.macCleared=Date.now(); });
// --- GRE (ENSA 8) ---
add("if","tunnel source <w>",F((i,a,s)=>{ if(!i.name.startsWith("Tu")) return INV; const n=normIf(a[0]); i.tunSrc=n&&s.ifs[n]?n:(ipRe.test(a[0])?a[0]:null); if(!i.tunSrc) return INV; }));
add("if","tunnel destination <ip>",F((i,a)=>{ if(!i.name.startsWith("Tu")) return INV; i.tunDst=a[0]; }));
add("if","tunnel mode gre ip",F(()=>{}));
// running-config
function v2RunIf(s,i){ const L=[]; if(i.stpGuard) L.push(" spanning-tree guard "+i.stpGuard);
  if(i.storm){ if(i.storm.bcast!=null) L.push(" storm-control broadcast level "+i.storm.bcast.toFixed(2)+(i.storm.low!==i.storm.bcast?" "+i.storm.low.toFixed(2):"")); if(i.storm.mcast!=null) L.push(" storm-control multicast level "+i.storm.mcast.toFixed(2)); if(i.storm.action==="shutdown") L.push(" storm-control action shutdown"); if(i.storm.trap) L.push(" storm-control action trap"); }
  if(i.raGuard) L.push(i.raGuard==="(default)"?" ipv6 nd raguard":" ipv6 nd raguard attach-policy "+i.raGuard); return L.concat(qosRunIf(i)); }
function v2RunL3(i){ const L=[]; for(const [g,v] of Object.entries(i.vrrp||{})){ if(v.desc) L.push(" vrrp "+g+" description "+v.desc); if(v.ip) L.push(" vrrp "+g+" ip "+v.ip); if(v.prio!==100) L.push(" vrrp "+g+" priority "+v.prio); if(!v.preempt) L.push(" no vrrp "+g+" preempt"); }
  if(i.ospf6) L.push(" ipv6 ospf "+i.ospf6.pid+" area "+i.ospf6.area); if(i.ospf6Cost) L.push(" ipv6 ospf cost "+i.ospf6Cost); if(i.ospf6Prio!=null) L.push(" ipv6 ospf priority "+i.ospf6Prio);
  if(i.tunSrc) L.push(" tunnel source "+(i.tunSrc.includes(".")?i.tunSrc:longIf(i.tunSrc))); if(i.tunDst) L.push(" tunnel destination "+i.tunDst); return L.concat(qosRunIf(i)); }
function v2RunGlobal(s){ const L=[]; if(s.aaa&&s.aaa.on){ L.push("aaa new-model"); for(const [n,m] of Object.entries(s.aaa.login)) L.push("aaa authentication login "+n+" "+m.map(x=>x==="tacacs+"||x==="radius"?"group "+x:x).join(" ")); for(const [n,m] of Object.entries(s.aaa.authz)) L.push("aaa authorization exec "+n+" "+m.map(x=>x==="tacacs+"||x==="radius"?"group "+x:x).join(" ")); for(const [n,v] of Object.entries(s.aaa.acct)) L.push("aaa accounting exec "+n+" "+v); L.push("!"); }
  for(const [n,t] of Object.entries(s.tacacs||{})){ L.push("tacacs server "+n); if(t.ip) L.push(" address ipv4 "+t.ip); if(t.key) L.push(" key 7 "+hmac(t.key).replace(/\./g,"").toUpperCase()); if(t.port!==49) L.push(" port "+t.port); L.push("!"); }
  for(const [n,t] of Object.entries(s.radius||{})){ L.push("radius server "+n); if(t.ip) L.push(" address ipv4 "+t.ip+" auth-port "+t.auth+" acct-port "+t.acct); if(t.key) L.push(" key 7 "+hmac(t.key).replace(/\./g,"").toUpperCase()); L.push("!"); }
  if(s.scpServer) L.push("ip scp server enable"); if(s.httpOff) L.push("no ip http server"); if(s.pwMin) L.push("security passwords min-length "+s.pwMin); if(s.loginBlock) L.push("login block-for "+s.loginBlock[0]+" attempts "+s.loginBlock[1]+" within "+s.loginBlock[2]);
  if(s.loopguardDefault) L.push("spanning-tree loopguard default"); for(const [n,p] of Object.entries(s.raPol||{})) L.push("ipv6 nd raguard policy "+n," device-role "+p.role,"!");
  if(s.macAging!=null) L.push("mac address-table aging-time "+s.macAging); for(const x of s.macStatic||[]) L.push("mac address-table static "+x.mac+" vlan "+x.v+" interface "+longIf(x.port));
  if(s.ospf6){ L.push("ipv6 router ospf "+s.ospf6.pid); if(s.ospf6.rid) L.push(" router-id "+s.ospf6.rid); for(const p of s.ospf6.passive) L.push(" passive-interface "+longIf(p)); if(s.ospf6.defOrig) L.push(" default-information originate"+(s.ospf6.defAlways?" always":"")); L.push("!"); }
  if(s.motd) L.push("banner motd ^C"+s.motd+"^C"); return L; }

