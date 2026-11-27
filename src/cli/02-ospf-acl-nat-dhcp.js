// ================= OSPF / ACL / NAT / DHCP =================
const n2ipT=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join(".");
const areaNum=a=>{ if(/^\d+$/.test(a)) return Number(a); if(ipRe.test(a)) return ipToN(a)>>>0; return null; };
function wildMatch(ip,net,wild){ const w=ipToN(wild); return ((ipToN(ip)&~w)>>>0)===((ipToN(net)&~w)>>>0); }
function ospfAreaOf(s,i){ if(!s.ospf||!i.ip) return null; if(i.ospfArea!==null&&i.ospfArea!==undefined) return i.ospfArea;
  const m=s.ospf.nets.filter(n=>wildMatch(i.ip,n.net,n.wild)).sort((a,b)=>maskLen(a.wild)-maskLen(b.wild)); return m.length? m[0].area : null; }
function ospfPassive(s,n){ const o=s.ospf; if(!o) return false; if(s.ifs[n]&&s.ifs[n].loop) return false; return o.passiveDefault? !o.nonPassive.includes(n) : o.passive.includes(n); }
function autoRid(s){ const ups=Object.values(s.ifs).filter(i=>i.ip&&ifStatus(s,i)[1]==="up"); const lo=ups.filter(i=>i.loop); const c=lo.length?lo:ups; if(!c.length) return null; return c.slice().sort((a,b)=>ipToN(b.ip)-ipToN(a.ip))[0].ip; }
function effRid(s){ return s.ospf? (s.ospf.ridActive||s.ospf.rid||autoRid(s)||"0.0.0.0") : null; }
function ifBw(i){ if(i.bw) return i.bw; if(i.loop) return 8000000; return /^Fa/.test(i.name)?100000:1000000; }
function ospfCostOf(s,i){ if(i.ospfCost) return i.ospfCost; if(i.loop) return 1; return Math.max(1,Math.floor(s.ospf.refbw*1000/ifBw(i))); }
function freezeRid(s){ if(s.ospf&&!s.ospf.ridActive){ const r=s.ospf.rid||autoRid(s); if(r) s.ospf.ridActive=r; } }
const newOspf=pid=>({pid,rid:null,ridActive:null,nets:[],passive:[],nonPassive:[],passiveDefault:false,refbw:100,defOrig:false,defAlways:false});
add(C,"router ospf <n>",(s,a,ctx)=>{ if(!s.l3) return INV; if(a[0]<1||a[0]>65535) return INV; if(!s.ospf||s.ospf.pid!==a[0]) s.ospf=newOspf(a[0]); ctx.mode="router"; });
add(C,"no router ospf <n>",(s,a)=>{ if(s.ospf&&s.ospf.pid===a[0]) s.ospf=null; });
const RT="router";
add(RT,"exit",(s,a,ctx)=>{ctx.mode="config";}); add(RT,"end",(s,a,ctx)=>{ctx.mode="exec";});
add(RT,"network <ip> <ip> area <w>",(s,a)=>{ const ar=areaNum(a[2]); if(ar===null) return INV; s.ospf.nets=s.ospf.nets.filter(n=>!(n.net===a[0]&&n.wild===a[1])); s.ospf.nets.push({net:a[0],wild:a[1],area:ar}); freezeRid(s); });
add(RT,"no network <ip> <ip> area <w>",(s,a)=>{ s.ospf.nets=s.ospf.nets.filter(n=>!(n.net===a[0]&&n.wild===a[1])); });
add(RT,"router-id <ip>",(s,a)=>{ const was=s.ospf.ridActive; s.ospf.rid=a[0]; if(was&&was!==a[0]) return "% OSPF: Reload or use \"clear ip ospf process\" command, for this to take effect"; });
add(RT,"no router-id",(s)=>{ s.ospf.rid=null; });
add(RT,"passive-interface default",(s)=>{ s.ospf.passiveDefault=true; s.ospf.nonPassive=[]; });
add(RT,"no passive-interface default",(s)=>{ s.ospf.passiveDefault=false; s.ospf.passive=[]; });
add(RT,"passive-interface <if>",(s,a)=>{ if(!s.ifs[a[0]]) return INV; const o=s.ospf; if(o.passiveDefault) o.nonPassive=o.nonPassive.filter(x=>x!==a[0]); else if(!o.passive.includes(a[0])) o.passive.push(a[0]); });
add(RT,"no passive-interface <if>",(s,a)=>{ if(!s.ifs[a[0]]) return INV; const o=s.ospf; if(o.passiveDefault){ if(!o.nonPassive.includes(a[0])) o.nonPassive.push(a[0]); } else o.passive=o.passive.filter(x=>x!==a[0]); });
add(RT,"auto-cost reference-bandwidth <n>",(s,a)=>{ s.ospf.refbw=a[0]; return "% OSPF: Reference bandwidth is changed.\n        Please ensure reference bandwidth is consistent across all routers."; });
add(RT,"default-information originate",(s)=>{ s.ospf.defOrig=true; s.ospf.defAlways=false; });
add(RT,"default-information originate always",(s)=>{ s.ospf.defOrig=true; s.ospf.defAlways=true; });
add(RT,"no default-information originate",(s)=>{ s.ospf.defOrig=false; });
add(RT,"do <rest>",(s,a,ctx)=>ctx.runIn("exec",a[0]));
add("if","ip ospf cost <n>",F((i,a)=>{ if(a[0]<1||a[0]>65535) return INV; i.ospfCost=a[0]; }));
add("if","no ip ospf cost",F(i=>{i.ospfCost=null;}));
add("if","ip ospf priority <n>",F((i,a)=>{ if(a[0]>255) return INV; i.ospfPrio=a[0]; }));
add("if","no ip ospf priority",F(i=>{ i.ospfPrio=1; }));
add("if","ip ospf hello-interval <n>",F((i,a)=>{ i.hello=a[0]; if(!i.deadSet) i.dead=a[0]*4; }));
add("if","ip ospf dead-interval <n>",F((i,a)=>{ i.dead=a[0]; i.deadSet=true; }));
add("if","no ip ospf hello-interval",F(i=>{ i.hello=10; if(!i.deadSet) i.dead=40; }));
add("if","no ip ospf dead-interval",F(i=>{ i.deadSet=false; i.dead=i.hello*4; }));
add("if","ip ospf <n> area <w>",F((i,a,s)=>{ const ar=areaNum(a[1]); if(ar===null) return INV; if(!s.ospf) s.ospf=newOspf(a[0]); i.ospfArea=ar; i.ospfPid=a[0]; freezeRid(s); }));
add("if","no ip ospf <n> area <w>",F(i=>{ i.ospfArea=null; i.ospfPid=null; }));
add("if","ip ospf network point-to-point",F(i=>{ i.ospfP2p=true; }));
add("if","no ip ospf network point-to-point",F(i=>{ i.ospfP2p=false; }));
add("if","bandwidth <n>",F((i,a)=>{ i.bw=a[0]; }));
add("if","no bandwidth",F(i=>{ i.bw=null; }));
for(const m of ["user","exec"]){
  add(m,"show ip ospf neighbor",(s)=>s.net&&s.ospf? s.net.ospfNbrShow(s) : "");
  add(m,"show ip ospf interface brief",(s)=>s.net&&s.ospf? s.net.ospfIfBrief(s) : "");
  add(m,"show ip ospf",(s)=>s.ospf? " Routing Process \"ospf "+s.ospf.pid+"\" with ID "+effRid(s)+"\n Start time: 00:01:12.345, Time elapsed: 00:12:34.567\n Supports only single TOS(TOS0) routes\n Reference bandwidth unit is "+s.ospf.refbw+" mbps\n    Area BACKBONE(0)\n        Number of interfaces in this area is "+Object.values(s.ifs).filter(i=>ospfAreaOf(s,i)!==null&&ifStatus(s,i)[1]==="up").length : "%OSPF: Router process not running");
  add(m,"show ip protocols",(s)=>showProtocols(s));
  add(m,"show ip route ospf",(s)=>showRoute(s,"O"));
  add(m,"show ip route connected",(s)=>showRoute(s,"C"));
  add(m,"show access-lists",(s)=>showAcls(s,null)); add(m,"show ip access-lists",(s)=>showAcls(s,null)); add(m,"show access-lists <w>",(s,a)=>showAcls(s,a[0])); add(m,"show ip access-lists <w>",(s,a)=>showAcls(s,a[0]));
  add(m,"show ip nat translations",(s)=>showNat(s)); add(m,"show ip nat statistics",(s)=>showNatStats(s));
  add(m,"show ip dhcp binding",(s)=>showDhcpBind(s)); add(m,"show ip dhcp pool",(s)=>showDhcpPool(s));
  add(m,"show ip interface <if>",(s,a)=>showIpIf(s,a[0]));
}
add("exec","clear ip ospf process",(s,a,ctx)=>{ if(!s.ospf) return ""; ctx.prompt={text:"Reset ALL OSPF processes? [no]: ",fn:v=>{ if(/^y/i.test(v)){ s.ospf.ridActive=s.ospf.rid||autoRid(s); return "%OSPF-5-ADJCHG: Process "+s.ospf.pid+", Nbr state changed to DOWN (Interface down or detached)\n(Тренажер: процес перезапущено, Router ID = "+effRid(s)+")"; } return ""; }}; return ""; });
add("exec","clear ip nat translation *",(s)=>{ s.nat.table=[]; });
add("exec","clear ip dhcp binding *",(s)=>{ s.dhcp.bind={}; });
function showProtocols(s){ if(!s.ospf) return "";
  const o=s.ospf; const pas=Object.values(s.ifs).filter(i=>ospfPassive(s,i.name)&&!i.sub).map(i=>"    "+longIf(i.name));
  return "*** IP Routing is NSF aware ***\n\nRouting Protocol is \"ospf "+o.pid+"\"\n  Outgoing update filter list for all interfaces is not set\n  Incoming update filter list for all interfaces is not set\n  Router ID "+effRid(s)+"\n"+(o.defOrig?"  It is an autonomous system boundary router\n":"")+"  Number of areas in this router is 1. 1 normal 0 stub 0 nssa\n  Maximum path: 4\n  Routing for Networks:\n"+o.nets.map(n=>"    "+n.net+" "+n.wild+" area "+n.area).join("\n")+
   (Object.values(s.ifs).some(i=>i.ospfPid)?"\n  Routing on Interfaces Configured Explicitly (Area 0):\n"+Object.values(s.ifs).filter(i=>i.ospfPid).map(i=>"    "+longIf(i.name)).join("\n"):"")+
   (pas.length?"\n  Passive Interface(s):\n"+pas.join("\n"):"")+"\n  Routing Information Sources:\n    Gateway         Distance      Last Update\n"+(s.net?s.net.ospfSources(s).map(r=>"    "+r.padEnd(16)+"110           00:05:12").join("\n"):"")+"\n  Distance: (default is 110)"; }
// ---------- ACL ----------
const PORTS={www:80,http:80,ftp:21,"ftp-data":20,ssh:22,telnet:23,smtp:25,domain:53,bootps:67,bootpc:68,tftp:69,pop3:110,ntp:123,snmp:161,https:443};
const PNAME={80:"www",21:"ftp",20:"ftp-data",23:"telnet",25:"smtp",53:"domain",67:"bootps",68:"bootpc",69:"tftp",110:"pop3",123:"ntp",161:"snmp"};
function parseAddr(t,k){ const x=t[k]; if(!x) return null; const l=x.toLowerCase();
  if(l==="any") return [{any:true},k+1];
  if(l==="host"&&ipRe.test(t[k+1]||"")) return [{ip:t[k+1],wild:"0.0.0.0"},k+2];
  if(ipRe.test(x)&&ipRe.test(t[k+1]||"")){ const w=ipToN(t[k+1]); return [{ip:n2ipT((ipToN(x)&~w)>>>0),wild:t[k+1]},k+2]; }
  if(ipRe.test(x)) return [{ip:x,wild:"0.0.0.0"},k+1];
  return null; }
function parsePort(t,k){ const op=(t[k]||"").toLowerCase(); if(!["eq","neq","gt","lt","range"].includes(op)) return [null,k];
  const pv=v=>/^\d+$/.test(v||"")?Number(v):PORTS[(v||"").toLowerCase()]; const a=pv(t[k+1]); if(a===undefined) return [false,k];
  if(op==="range"){ const b=pv(t[k+2]); if(b===undefined) return [false,k]; return [{op,a,b},k+3]; } return [{op,a},k+2]; }
function parseAce(type,toks){
  const act=(toks[0]||"").toLowerCase(); if(act!=="permit"&&act!=="deny") return null;
  if(type==="std"){ const r=parseAddr(toks,1); if(!r) return null; let k=r[1]; const log=(toks[k]||"").toLowerCase()==="log"; if(log) k++; if(k!==toks.length) return null; return {act,proto:"ip",src:r[0],dst:{any:true},log}; }
  const proto=(toks[1]||"").toLowerCase(); if(!["ip","icmp","tcp","udp","ospf","gre","esp"].includes(proto)) return null;
  const sa=parseAddr(toks,2); if(!sa) return null; let k=sa[1], sp=null, dp=null, icmpType=null;
  if(proto==="tcp"||proto==="udp"){ const r=parsePort(toks,k); if(r[0]===false) return null; sp=r[0]; k=r[1]; }
  const da=parseAddr(toks,k); if(!da) return null; k=da[1];
  if(proto==="tcp"||proto==="udp"){ const r=parsePort(toks,k); if(r[0]===false) return null; dp=r[0]; k=r[1]; }
  if(proto==="icmp"&&toks[k]&&["echo","echo-reply","unreachable","time-exceeded"].includes(toks[k].toLowerCase())){ icmpType=toks[k].toLowerCase(); k++; }
  let est=false; if(proto==="tcp"&&(toks[k]||"").toLowerCase()==="established"){ est=true; k++; }
  const log=(toks[k]||"").toLowerCase()==="log"; if(log) k++;
  if(k!==toks.length) return null;
  return {act,proto,src:sa[0],sp,dst:da[0],dp,icmpType,est,log}; }
const addrM=(sp,ip)=> sp.any || wildMatch(ip,sp.ip,sp.wild);
const portM=(p,v)=>{ if(!p) return true; if(v==null) return false; switch(p.op){case "eq":return v===p.a;case "neq":return v!==p.a;case "gt":return v>p.a;case "lt":return v<p.a;case "range":return v>=p.a&&v<=p.b;} return false; };
function aceMatch(type,e,pkt){
  if(type==="std") return addrM(e.src,pkt.src);
  if(e.proto!=="ip"&&e.proto!==pkt.proto) return false;
  if(!addrM(e.src,pkt.src)||!addrM(e.dst,pkt.dst)) return false;
  if(e.proto==="tcp"||e.proto==="udp"){ if(!portM(e.sp,pkt.sport)||!portM(e.dp,pkt.dport)) return false; if(e.est&&!pkt.reply) return false; }
  if(e.proto==="icmp"&&e.icmpType){ if(e.icmpType==="echo"&&pkt.reply) return false; if(e.icmpType==="echo-reply"&&!pkt.reply) return false; if(!["echo","echo-reply"].includes(e.icmpType)) return false; }
  return true; }
function evalAcl(acl,pkt,count){ for(const r of acl.rules){ if(r.remark) continue; if(aceMatch(acl.type,r,pkt)){ if(count) r.hits=(r.hits||0)+1; return {permit:r.act==="permit",rule:r}; } } return {permit:false,rule:null}; }
const fmtAddr=(type,a)=> a.any?"any": a.wild==="0.0.0.0"? (type==="std"?a.ip:"host "+a.ip) : (type==="std"? a.ip+", wildcard bits "+a.wild : a.ip+" "+a.wild);
const fmtAddrRun=a=> a.any?"any": a.wild==="0.0.0.0"? "host "+a.ip : a.ip+" "+a.wild;
const fmtPort=p=> !p?"": " "+p.op+" "+(p.op==="range"? p.a+" "+p.b : (PNAME[p.a]||p.a));
function aceText(acl,r,run){ if(r.remark) return "remark "+r.remark; const A=run?fmtAddrRun:(a=>fmtAddr(acl.type,a));
  if(acl.type==="std") return r.act+(run?" ":(r.act==="deny"?"   ":" "))+A(r.src)+(r.log?" log":"");
  return r.act+" "+r.proto+" "+A(r.src)+fmtPort(r.sp)+" "+A(r.dst)+fmtPort(r.dp)+(r.icmpType?" "+r.icmpType:"")+(r.est?" established":"")+(r.log?" log":""); }
const numType=n=>{ n=Number(n); if((n>=1&&n<=99)||(n>=1300&&n<=1999)) return "std"; if((n>=100&&n<=199)||(n>=2000&&n<=2699)) return "ext"; return null; };
function aclAdd(s,name,type,toks,seq){
  let acl=s.acls[name]; if(!acl) acl=s.acls[name]={type,rules:[],named:!/^\d+$/.test(name)}; if(acl.type!==type) return "% Access-list type conflicts with prior definition";
  const nextSeq=()=> (acl.rules.length?Math.max(...acl.rules.map(r=>r.seq)):0)+10;
  if((toks[0]||"").toLowerCase()==="remark"){ acl.rules.push({seq:seq||nextSeq(),remark:toks.slice(1).join(" ")}); acl.rules.sort((a,b)=>a.seq-b.seq); return; }
  const e=parseAce(type,toks); if(!e) return INV;
  if(seq&&acl.rules.some(r=>r.seq===seq)) return "% Duplicate sequence number";
  e.seq=seq||nextSeq(); e.hits=0; acl.rules.push(e); acl.rules.sort((a,b)=>a.seq-b.seq); }
add(C,"access-list <n> <rest>",(s,a)=>{ const t=numType(a[0]); if(!t) return INV; return aclAdd(s,String(a[0]),t,a[1].split(/\s+/)); });
add(C,"no access-list <n>",(s,a)=>{ delete s.acls[String(a[0])]; });
const aclMode=(type)=>(s,a,ctx)=>{ if(/^\d+$/.test(a[0])&&numType(a[0])!==type) return INV; const x=s.acls[a[0]]; if(x&&x.type!==type) return "% A named "+(x.type==="std"?"standard":"extended")+" IP access list with this name already exists"; if(!x) s.acls[a[0]]={type,rules:[],named:!/^\d+$/.test(a[0])}; ctx.mode="acl"; ctx.acl=a[0]; ctx.aclType=type; };
add(C,"ip access-list standard <w>",aclMode("std")); add(C,"ip access-list extended <w>",aclMode("ext"));
add(C,"no ip access-list standard <w>",(s,a)=>{ delete s.acls[a[0]]; }); add(C,"no ip access-list extended <w>",(s,a)=>{ delete s.acls[a[0]]; });
const AC="acl";
add(AC,"exit",(s,a,ctx)=>{ctx.mode="config";}); add(AC,"end",(s,a,ctx)=>{ctx.mode="exec";}); add(AC,"do <rest>",(s,a,ctx)=>ctx.runIn("exec",a[0]));
add(AC,"permit <rest>",(s,a,ctx)=>aclAdd(s,ctx.acl,ctx.aclType,["permit"].concat(a[0].split(/\s+/))));
add(AC,"deny <rest>",(s,a,ctx)=>aclAdd(s,ctx.acl,ctx.aclType,["deny"].concat(a[0].split(/\s+/))));
add(AC,"remark <rest>",(s,a,ctx)=>aclAdd(s,ctx.acl,ctx.aclType,["remark"].concat(a[0].split(/\s+/))));
add(AC,"<n> permit <rest>",(s,a,ctx)=>aclAdd(s,ctx.acl,ctx.aclType,["permit"].concat(a[1].split(/\s+/)),a[0]));
add(AC,"<n> deny <rest>",(s,a,ctx)=>aclAdd(s,ctx.acl,ctx.aclType,["deny"].concat(a[1].split(/\s+/)),a[0]));
add(AC,"<n> remark <rest>",(s,a,ctx)=>aclAdd(s,ctx.acl,ctx.aclType,["remark"].concat(a[1].split(/\s+/)),a[0]));
add(AC,"no <n>",(s,a,ctx)=>{ const x=s.acls[ctx.acl]; x.rules=x.rules.filter(r=>r.seq!==a[0]); });
add("if","ip access-group <w> <w>",F((i,a)=>{ const d=a[1].toLowerCase(); if(!["in","out"].includes(d)) return INV; if(i.switchport&&!i.svi) return INV; if(d==="in") i.aclIn=a[0]; else i.aclOut=a[0]; }));
add("if","no ip access-group <w> <w>",F((i,a)=>{ const d=a[1].toLowerCase(); if(d==="in") i.aclIn=null; else i.aclOut=null; }));
add("line","access-class <w> in",(s,a,ctx)=>{ if(ctx.line==="vty") s.vty.acl=a[0]; });
add("line","no access-class <w> in",(s,a,ctx)=>{ if(ctx.line==="vty") s.vty.acl=null; });
function showAcls(s,only){ let o=""; for(const [n,acl] of Object.entries(s.acls)){ if(only&&n!==only) continue;
  o+=(acl.type==="std"?"Standard":"Extended")+" IP access list "+n+"\n"; for(const r of acl.rules) o+="    "+r.seq+" "+aceText(acl,r)+(r.hits?" ("+r.hits+" match"+(r.hits>1?"es":"")+")":"")+"\n"; } return o.trimEnd(); }
function showIpIf(s,n){ const i=s.ifs[n]; if(!i) return INV; const [st,pr]=ifStatus(s,i);
  return longIf(n)+" is "+st+", line protocol is "+pr+"\n"+(i.ip?"  Internet address is "+i.ip+"/"+maskLen(i.mask)+"\n  Broadcast address is 255.255.255.255\n":"  Internet protocol processing disabled\n")+(i.helper&&i.helper.length?"  Helper addresses are "+i.helper.join(", ")+"\n":"  Helper address is not set\n")+"  Outgoing Common access list is not set\n  Outgoing access list is "+(i.aclOut||"not set")+"\n  Inbound Common access list is not set\n  Inbound  access list is "+(i.aclIn||"not set")+"\n  Proxy ARP is enabled\n  ..."+(i.natIn?"\n  IP NAT inside":"")+(i.natOut?"\n  IP NAT outside":""); }
// ---------- NAT ----------
add("if","ip nat inside",F(i=>{ i.natIn=true; i.natOut=false; }));
add("if","ip nat outside",F(i=>{ i.natOut=true; i.natIn=false; }));
add("if","no ip nat inside",F(i=>{ i.natIn=false; }));
add("if","no ip nat outside",F(i=>{ i.natOut=false; }));
add(C,"ip nat inside source static <ip> <ip>",(s,a)=>{ if(s.nat.statics.some(x=>x.local===a[0]||x.global===a[1])) return "% "+a[0]+" already mapped"; s.nat.statics.push({local:a[0],global:a[1]}); });
add(C,"no ip nat inside source static <ip> <ip>",(s,a)=>{ s.nat.statics=s.nat.statics.filter(x=>!(x.local===a[0]&&x.global===a[1])); });
add(C,"ip nat pool <w> <ip> <ip> netmask <mask>",(s,a)=>{ if(!maskOk(a[3])) return "%Invalid netmask"; if(ipToN(a[2])<ipToN(a[1])) return "%End address less than start address"; s.nat.pools[a[0]]={start:a[1],end:a[2],mask:a[3]}; });
add(C,"ip nat pool <w> <ip> <ip> prefix-length <n>",(s,a)=>{ if(a[3]<1||a[3]>30) return INV; const m=n2ipT((0xffffffff<<(32-a[3]))>>>0); s.nat.pools[a[0]]={start:a[1],end:a[2],mask:m}; });
add(C,"no ip nat pool <w>",(s,a)=>{ delete s.nat.pools[a[0]]; });
const natDyn=(s,r)=>{ s.nat.dyn=s.nat.dyn.filter(x=>x.acl!==r.acl); s.nat.dyn.push(r); };
add(C,"ip nat inside source list <w> pool <w>",(s,a)=>natDyn(s,{acl:a[0],pool:a[1],overload:false}));
add(C,"ip nat inside source list <w> pool <w> overload",(s,a)=>natDyn(s,{acl:a[0],pool:a[1],overload:true}));
add(C,"ip nat inside source list <w> interface <if> overload",(s,a)=>{ if(!s.ifs[a[1]]) return INV; natDyn(s,{acl:a[0],ifc:a[1],overload:true}); });
add(C,"no ip nat inside source list <w> <rest>",(s,a)=>{ s.nat.dyn=s.nat.dyn.filter(x=>x.acl!==a[0]); });
function showNat(s){ let o="Pro  Inside global         Inside local          Outside local         Outside global\n";
  for(const t of s.nat.table) o+=t.proto.padEnd(5)+(t.ig+(t.port?":"+t.port:"")).padEnd(22)+(t.il+(t.port?":"+t.lport:"")).padEnd(22)+(t.og+(t.port?":"+t.port:"")).padEnd(22)+t.og+(t.port?":"+t.port:"")+"\n";
  for(const x of s.nat.statics) o+="---  "+x.global.padEnd(22)+x.local.padEnd(22)+"---                   ---\n";
  return o.trimEnd(); }
function showNatStats(s){ const ins=Object.values(s.ifs).filter(i=>i.natIn).map(i=>longIf(i.name)), outs=Object.values(s.ifs).filter(i=>i.natOut).map(i=>longIf(i.name));
  return "Total active translations: "+(s.nat.statics.length+s.nat.table.length)+" ("+s.nat.statics.length+" static, "+s.nat.table.length+" dynamic; "+s.nat.table.filter(t=>t.port).length+" extended)\nOutside interfaces:\n  "+(outs.join(", ")||"")+"\nInside interfaces: \n  "+(ins.join(", ")||"")+"\nHits: "+s.nat.hits+"  Misses: "+s.nat.miss+"\nDynamic mappings:\n"+s.nat.dyn.map(d=>"-- Inside Source\n[Id: 1] access-list "+d.acl+(d.pool?" pool "+d.pool:" interface "+longIf(d.ifc))+" refcount "+s.nat.table.filter(t=>t.acl===d.acl).length+(d.pool&&s.nat.pools[d.pool]?"\n pool "+d.pool+": netmask "+s.nat.pools[d.pool].mask+"\n\tstart "+s.nat.pools[d.pool].start+" end "+s.nat.pools[d.pool].end:"")).join("\n"); }
// ---------- DHCP ----------
add(C,"ip dhcp excluded-address <ip>",(s,a)=>{ s.dhcp.excl.push([a[0],a[0]]); });
add(C,"ip dhcp excluded-address <ip> <ip>",(s,a)=>{ if(ipToN(a[1])<ipToN(a[0])) return INV; s.dhcp.excl.push([a[0],a[1]]); });
add(C,"no ip dhcp excluded-address <ip> <ip>",(s,a)=>{ s.dhcp.excl=s.dhcp.excl.filter(x=>!(x[0]===a[0]&&x[1]===a[1])); });
add(C,"no ip dhcp excluded-address <ip>",(s,a)=>{ s.dhcp.excl=s.dhcp.excl.filter(x=>!(x[0]===a[0]&&x[1]===a[0])); });
add(C,"ip dhcp pool <w>",(s,a,ctx)=>{ if(!s.l3) return INV; if(!s.dhcp.pools[a[0]]) s.dhcp.pools[a[0]]={name:a[0],net:null,mask:null,gw:null,dns:null,domain:null}; ctx.mode="dhcp"; ctx.pool=a[0]; });
add(C,"no ip dhcp pool <w>",(s,a)=>{ delete s.dhcp.pools[a[0]]; });
const DH="dhcp";
add(DH,"exit",(s,a,ctx)=>{ctx.mode="config";}); add(DH,"end",(s,a,ctx)=>{ctx.mode="exec";}); add(DH,"do <rest>",(s,a,ctx)=>ctx.runIn("exec",a[0]));
add(DH,"network <ip> <mask>",(s,a,ctx)=>{ if(!maskOk(a[1])) return "% Invalid mask"; const p=s.dhcp.pools[ctx.pool]; p.net=n2ipT((ipToN(a[0])&ipToN(a[1]))>>>0); p.mask=a[1]; });
add(DH,"default-router <ip>",(s,a,ctx)=>{ s.dhcp.pools[ctx.pool].gw=a[0]; });
add(DH,"no default-router",(s,a,ctx)=>{ s.dhcp.pools[ctx.pool].gw=null; });
add(DH,"dns-server <ip>",(s,a,ctx)=>{ s.dhcp.pools[ctx.pool].dns=a[0]; });
add(DH,"dns-server <ip> <ip>",(s,a,ctx)=>{ s.dhcp.pools[ctx.pool].dns=a[0]+" "+a[1]; });
add(DH,"domain-name <w>",(s,a,ctx)=>{ s.dhcp.pools[ctx.pool].domain=a[0]; });
add(DH,"lease <n>",()=>{}); add(DH,"lease <n> <n>",()=>{}); add(DH,"lease <n> <n> <n>",()=>{}); add(DH,"lease infinite",()=>{});
add("if","ip helper-address <ip>",F((i,a)=>{ if(i.switchport&&!i.svi) return "% IP addresses may not be configured on L2 links."; if(!i.helper.includes(a[0])) i.helper.push(a[0]); }));
add("if","no ip helper-address <ip>",F((i,a)=>{ i.helper=i.helper.filter(x=>x!==a[0]); }));
add("if","no ip helper-address",F(i=>{ i.helper=[]; }));
function showDhcpBind(s){ let o="Bindings from all pools not associated with VRF:\nIP address          Client-ID/              Lease expiration        Type\n                    Hardware address/\n                    User name\n";
  for(const [ip,b] of Object.entries(s.dhcp.bind)) o+=ip.padEnd(20)+b.cid.padEnd(24)+"Nov 18 2026 09:30 PM    Automatic\n"; return o.trimEnd(); }
function showDhcpPool(s){ return Object.values(s.dhcp.pools).map(p=>"\nPool "+p.name+" :\n Utilization mark (high/low)    : 100 / 0\n Total addresses                : "+(p.mask?Math.pow(2,32-maskLen(p.mask))-2:0)+"\n Leased addresses               : "+Object.values(s.dhcp.bind).filter(b=>b.pool===p.name).length+"\n Excluded addresses             : "+s.dhcp.excl.length+"\n 1 subnet is currently in the pool :\n Current index        IP address range                    Leased/Excluded/Total\n "+(p.net||"0.0.0.0").padEnd(20)+(p.net||"")+" - "+(p.net?n2ipT((ipToN(p.net)|~ipToN(p.mask))>>>0):"")).join("\n"); }
function l3extra(i){ const L=[]; for(const h of i.helper||[]) L.push(" ip helper-address "+h); if(i.aclIn) L.push(" ip access-group "+i.aclIn+" in"); if(i.aclOut) L.push(" ip access-group "+i.aclOut+" out");
  for(const x of i.v6||[]) L.push(" ipv6 address "+(x.eui?v6fmt(v6net(v6parse(x.addr),64))+"/64 eui-64":x.addr+"/"+x.len)); if(i.llStatic) L.push(" ipv6 address "+i.llStatic+" link-local"); if(i.v6on&&!(i.v6||[]).length&&!i.llStatic) L.push(" ipv6 enable");
  for(const [g,h] of Object.entries(i.hsrp||{})){ if(h.ip) L.push(" standby "+g+" ip "+h.ip); if(h.prio!==100) L.push(" standby "+g+" priority "+h.prio); if(h.preempt) L.push(" standby "+g+" preempt"); } if(i.hsrpV===2) L.push(" standby version 2"); if(i.cdpOff) L.push(" no cdp enable");
  if(i.natIn) L.push(" ip nat inside"); if(i.natOut) L.push(" ip nat outside"); if(i.ospfPid) L.push(" ip ospf "+i.ospfPid+" area "+i.ospfArea); if(i.ospfCost) L.push(" ip ospf cost "+i.ospfCost); if(i.ospfPrio!==1) L.push(" ip ospf priority "+i.ospfPrio);
  if(i.hello!==10) L.push(" ip ospf hello-interval "+i.hello); if(i.deadSet) L.push(" ip ospf dead-interval "+i.dead); if(i.ospfP2p) L.push(" ip ospf network point-to-point"); if(i.bw) L.push(" bandwidth "+i.bw); L.push(...v6ndRun(i)); L.push(...v2RunL3(i)); return L; }

