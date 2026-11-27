// Мінісимулятор Cisco IOS (Catalyst 2960 / L3-комутатор) для навчальних сценаріїв.
(function(){
"use strict";
const IFTYPES=[["fastethernet","Fa","FastEthernet"],["gigabitethernet","Gi","GigabitEthernet"],["port-channel","Po","Port-channel"],["vlan","Vlan","Vlan"],["loopback","Lo","Loopback"],["tunnel","Tu","Tunnel"]];
function normIf(s){
  const m=String(s).trim().match(/^([a-z-]+)\s*(\d+(?:\/\d+)*(?:\.\d+)?)$/i); if(!m) return null;
  const t=m[1].toLowerCase(); const hit=IFTYPES.filter(([full])=>full.startsWith(t));
  if(hit.length!==1) return null; return hit[0][1]+m[2];
}
function longIf(n){ const t=IFTYPES.find(x=>n.startsWith(x[1])); return t? t[2]+n.slice(t[1].length): n; }
function parseList(s){ // "10,20,30-32" → [10,20,30,31,32]
  if(!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(s)) return null; const out=[];
  for(const part of s.split(",")){ const [a,b]=part.split("-").map(Number); if(b!==undefined){ if(b<a||b-a>4094) return null; for(let i=a;i<=b;i++) out.push(i);} else out.push(a); }
  if(out.some(v=>v<1||v>4094)) return null; return [...new Set(out)].sort((x,y)=>x-y);
}
function fmtList(arr){ if(!arr.length) return "none"; const a=arr.slice().sort((x,y)=>x-y); const out=[]; let s=a[0],p=a[0];
  for(let i=1;i<=a.length;i++){ if(a[i]===p+1){p=a[i];continue;} out.push(s===p?String(s):(p===s+1?s+","+p:s+"-"+p)); s=p=a[i]; } return out.join(","); }
const ipRe=/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const ipToN=s=>s.split(".").reduce((a,o)=>(a*256)+Number(o),0);
const maskOk=s=>{ if(!ipRe.test(s)) return false; const n=ipToN(s); const inv=(~n)>>>0; return ((inv+1)&inv)===0 && n!==0; };
const maskLen=s=>{let n=ipToN(s),c=0;while(n){c+=n&1;n=Math.floor(n/2);}return c;};

function newIf(name){ return {name,shutdown:false,mode:"dynamic auto",accessVlan:1,voiceVlan:null,nativeVlan:1,allowed:null,nonegotiate:false,portfast:false,bpduguard:false,chGroup:null,chMode:null,switchport:true,ip:null,mask:null,desc:null,speed:"auto",duplex:"auto",ospfCost:null,ospfPrio:1,hello:10,dead:40,deadSet:false,ospfArea:null,ospfPid:null,ospfP2p:false,aclIn:null,aclOut:null,natIn:false,natOut:false,helper:[],bw:null,loop:false}; }
function newState(opt){
  opt=opt||{};
  const s={hostname:opt.hostname||"S1",l3:!!opt.l3||!!opt.router,router:!!opt.router,routes:[],vlans:opt.router?{}:{1:{name:"default"}},ifs:{},ipRouting:!!opt.router,defaultGw:null,domain:null,rsaBits:0,users:{},
    enableSecret:null,servicePwEnc:false,noDomainLookup:false,sshVer:null,vty:{transport:"all",login:null,password:null},con:{login:null,password:null},
    stpMode:"pvst",stpPrio:{},portfastDefault:false,bpduguardDefault:false,lb:"src-mac",mac:"0019.e8"+String(Math.floor(Math.random()*90)+10)+".1a00",saved:false,ospf:null,acls:{},nat:{statics:[],pools:{},dyn:[],table:[],hits:0,miss:0,ports:1024},dhcp:{pools:{},excl:[],bind:{}}};
  if(opt.router){ for(let i=0;i<=2;i++) s.ifs["Gi0/"+i]=Object.assign(newIf("Gi0/"+i),{switchport:false,shutdown:true}); }
  else{
  for(let i=1;i<=24;i++) s.ifs["Fa0/"+i]=newIf("Fa0/"+i);
  for(let i=1;i<=2;i++) s.ifs["Gi0/"+i]=newIf("Gi0/"+i);
  s.ifs["Vlan1"]=Object.assign(newIf("Vlan1"),{svi:true,shutdown:true});
  }
  if(opt.vlans) for(const [id,name] of Object.entries(opt.vlans)) s.vlans[id]={name};
  if(opt.setup) opt.setup(s);
  return s;
}
const isPhys=n=>/^(Fa|Gi)/.test(n);
function ensureIf(s,n){ if(s.ifs[n]) return s.ifs[n];
  if(n.startsWith("Po")){ s.ifs[n]=newIf(n); return s.ifs[n]; }
  if(s.l3 && /^Lo\d+$/.test(n)){ s.ifs[n]=Object.assign(newIf(n),{switchport:false,loop:true}); return s.ifs[n]; }
  if(s.router && /^Gi0\/\d+\.\d+$/.test(n) && s.ifs[n.split(".")[0]]){ s.ifs[n]=Object.assign(newIf(n),{switchport:false,sub:true,encap:null,native:false}); return s.ifs[n]; }
  if(s.l3 && /^Tu\d+$/.test(n)){ s.ifs[n]=Object.assign(newIf(n),{switchport:false,tunnel:true,shutdown:false}); return s.ifs[n]; }
  if(s.router) return null;
  if(n.startsWith("Vlan")){ const id=Number(n.slice(4)); if(!(id>=1&&id<=4094)) return null; s.ifs[n]=Object.assign(newIf(n),{svi:true}); return s.ifs[n]; }
  return null; }
function operTrunk(i){ if(!i.switchport) return false; if(i._oper) return i._oper==="trunk"; return i.mode==="trunk"; }
function allowedOf(i){ return i.allowed? i.allowed : null; } // null = all

// ---------- Граматика ----------
// Елементи: літерал (нижній регістр) або плейсхолдер: <n> число, <w> слово, <list> список VLAN, <if> інтерфейс, <ip>, <mask>, <rest> решта рядка
const G={}; const add=(mode,pat,fn)=>{(G[mode]=G[mode]||[]).push({p:pat.split(" "),fn});};
const SHOWS=[
 ["show vlan brief",(s)=>showVlanBrief(s)],["show vlan",(s)=>showVlanBrief(s)],
 ["show interfaces trunk",(s)=>showTrunk(s)],["show interfaces <if> switchport",(s,a)=>showSwitchport(s,a[0])],
 ["show interfaces status",(s)=>showStatus(s)],["show interfaces <if>",(s,a)=>showIface(s,a[0])],
 ["show running-config",(s)=>showRun(s)],["show running-config interface <if>",(s,a)=>showRunIf(s,a[0])],["show startup-config",(s)=>s.saved?showRun(s.saved):"startup-config is not present"],
 ["show ip interface brief",(s)=>showIpBrief(s)],["show etherchannel summary",(s)=>showEc(s)],
 ["show spanning-tree",(s)=>showStp(s,null)],["show spanning-tree vlan <n>",(s,a)=>showStp(s,a[0])],["show ip ssh",(s)=>showSsh(s)],
 ["show ip route",(s)=>showRoute(s)],["show history",(s,a,ctx)=>ctx.history.slice(-10).join("\n")],["show version",(s)=>"Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE\n...\nConfiguration register is 0xF"]
];
for(const [p,f] of SHOWS){ add("user",p,f); add("exec",p,f); }
add("user","enable",(s,a,ctx)=>{ctx.mode="exec";});
add("user","exit",(s,a,ctx)=>{ctx.mode="user"; return "";});
add("exec","disable",(s,a,ctx)=>{ctx.mode="user";});
add("exec","exit",(s,a,ctx)=>{ctx.mode="user";});
add("exec","configure terminal",(s,a,ctx)=>{ctx.mode="config"; return "Enter configuration commands, one per line.  End with CNTL/Z.";});
add("exec","copy running-config startup-config",(s)=>{s.saved=dumpState(Object.assign({},s,{saved:false})); return "Destination filename [startup-config]? \nBuilding configuration...\n[OK]";});
add("exec","write memory",(s)=>{s.saved=dumpState(Object.assign({},s,{saved:false})); return "Building configuration...\n[OK]";});
add("exec","enable",()=>{});
for(const m of ["user","exec"]){
  add(m,"ping <ip>",(s,a)=>s.net? s.net.pingCli(s,a[0]) : "Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to "+a[0]+", timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)");
  add(m,"traceroute <ip>",(s,a)=>s.net? s.net.traceCli(s,a[0]) : "% Немає мережі в цьому сценарії");
  add(m,"show cdp neighbors",(s)=>s.net? s.net.cdp(s) : "");
  add(m,"show ip route static",(s)=>showRoute(s,"S"));
}

// --- глобальна конфігурація ---
const C="config";
add(C,"end",(s,a,ctx)=>{ctx.mode="exec";});
add(C,"exit",(s,a,ctx)=>{ctx.mode="exec";});
add(C,"do <rest>",(s,a,ctx)=>ctx.runIn("exec",a[0]));
add(C,"hostname <w>",(s,a)=>{s.hostname=a[0];});
add(C,"vlan <list>",(s,a,ctx)=>{ const l=parseList(a[0]); if(!l) return INV; for(const v of l){ if(v>=1002&&v<=1005) return "%Default VLAN "+v+" may not be modified."; if(!s.vlans[v]) s.vlans[v]={name:"VLAN"+String(v).padStart(4,"0")}; } ctx.mode="vlan"; ctx.vlan=l; });
add(C,"no vlan <list>",(s,a)=>{ const l=parseList(a[0]); if(!l) return INV; for(const v of l){ if(v===1) return "%Default VLAN 1 may not be deleted."; delete s.vlans[v]; } });
add(C,"interface range <rest>",(s,a,ctx)=>{ const r=parseRange(a[0]); if(!r||!r.length) return INV; r.forEach(n=>ensureIf(s,n)); if(r.some(n=>!s.ifs[n])) return INV; ctx.mode="if"; ctx.ifs=r; });
add(C,"interface <if>",(s,a,ctx)=>{ const it=ensureIf(s,a[0]); if(!it) return INV; ctx.mode="if"; ctx.ifs=[a[0]]; });
add(C,"ip default-gateway <ip>",(s,a)=>{s.defaultGw=a[0];});
add(C,"no ip default-gateway",(s)=>{s.defaultGw=null;});
add(C,"ip routing",(s)=>{ if(!s.l3) return INV; s.ipRouting=true; });
const addRoute=(s,net,mask,nh,ifc,ad)=>{ if(!maskOk(mask)&&mask!=="0.0.0.0") return "% Inconsistent address and mask"; if(((ipToN(net)&ipToN(mask))>>>0)!==ipToN(net)) return "%Inconsistent address and mask"; s.routes=s.routes.filter(r=>!(r.net===net&&r.mask===mask&&r.nh===nh&&r.ifc===ifc)); s.routes.push({net,mask,nh,ifc,ad:ad||1}); };
add(C,"ip route <ip> <mask> <ip>",(s,a)=>addRoute(s,a[0],a[1],a[2],null,1));
add(C,"ip route <ip> <mask> <ip> <n>",(s,a)=>addRoute(s,a[0],a[1],a[2],null,a[3]));
add(C,"ip route <ip> <mask> <if>",(s,a)=>{ if(!s.ifs[a[2]]) return INV; return addRoute(s,a[0],a[1],null,a[2],1); });
add(C,"ip route <ip> <mask> <if> <ip>",(s,a)=>{ if(!s.ifs[a[2]]) return INV; return addRoute(s,a[0],a[1],a[3],a[2],1); });
add(C,"no ip route <ip> <mask> <ip>",(s,a)=>{ s.routes=s.routes.filter(r=>!(r.net===a[0]&&r.mask===a[1]&&r.nh===a[2])); });
add(C,"no ip route <ip> <mask> <if>",(s,a)=>{ s.routes=s.routes.filter(r=>!(r.net===a[0]&&r.mask===a[1]&&r.ifc===a[2])); });
add(C,"no ip routing",(s)=>{s.ipRouting=false;});
add(C,"ip domain-name <w>",(s,a)=>{s.domain=a[0];});
add(C,"ip domain name <w>",(s,a)=>{s.domain=a[0];});
add(C,"no ip domain-lookup",(s)=>{s.noDomainLookup=true;});
add(C,"no ip domain lookup",(s)=>{s.noDomainLookup=true;});
add(C,"ip ssh version <n>",(s,a)=>{ if(a[0]!==1&&a[0]!==2) return INV; if(a[0]===2&&s.rsaBits<768) return "Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2)."; s.sshVer=a[0]; });
const genKey=(s,bits)=>{ if(!s.domain) return "% Please define a domain-name first."; if(s.hostname==="Switch"||s.hostname==="Router") return "% Please define a hostname other than "+s.hostname+"."; if(!(bits>=360&&bits<=4096)) return INV; s.rsaBits=bits; return "The name for the keys will be: "+s.hostname+"."+s.domain+"\n% The key modulus size is "+bits+" bits\n% Generating "+bits+" bit RSA keys, keys will be non-exportable...\n[OK] (elapsed time was 1 seconds)\n*Mar 1 00:12:31.123: %SSH-5-ENABLED: SSH "+(bits>=768?"1.99":"1.5")+" has been enabled"; };
add(C,"crypto key generate rsa",(s,a,ctx)=>{ if(!s.domain) return "% Please define a domain-name first."; ctx.prompt={text:"How many bits in the modulus [512]: ",fn:(v)=>genKey(s,Number(v)||512)}; return "The name for the keys will be: "+s.hostname+"."+s.domain+"\nChoose the size of the key modulus in the range of 360 to 4096 for your\n  General Purpose Keys. Choosing a key modulus greater than 512 may take\n  a few minutes."; });
add(C,"crypto key generate rsa modulus <n>",(s,a)=>genKey(s,a[0]));
add(C,"crypto key generate rsa general-keys modulus <n>",(s,a)=>genKey(s,a[0]));
add(C,"username <w> secret <w>",(s,a)=>{s.users[a[0]]={secret:true};});
add(C,"username <w> privilege <n> secret <w>",(s,a)=>{s.users[a[0]]={secret:true,priv:a[1]};});
add(C,"username <w> password <w>",(s,a)=>{s.users[a[0]]={secret:false};});
add(C,"enable secret <w>",(s,a)=>{s.enableSecret=a[0];});
add(C,"service password-encryption",(s)=>{s.servicePwEnc=true;});
add(C,"line vty <n> <n>",(s,a,ctx)=>{ctx.mode="line";ctx.line="vty";});
add(C,"line console <n>",(s,a,ctx)=>{ctx.mode="line";ctx.line="con";});
add(C,"spanning-tree mode <w>",(s,a)=>{ const m=["pvst","rapid-pvst","mst"].find(x=>x.startsWith(a[0].toLowerCase())); if(!m) return INV; s.stpMode=m; });
add(C,"spanning-tree vlan <list> priority <n>",(s,a)=>{ const l=parseList(a[0]); if(!l) return INV; if(a[1]%4096||a[1]>61440) return "% Bridge Priority must be in increments of 4096.\n% Allowed values are:\n  0     4096  8192  12288 16384 20480 24576 28672\n  32768 36864 40960 45056 49152 53248 57344 61440"; l.forEach(v=>s.stpPrio[v]=a[1]); });
add(C,"spanning-tree vlan <list> root primary",(s,a)=>{ const l=parseList(a[0]); if(!l) return INV; l.forEach(v=>s.stpPrio[v]=24576); });
add(C,"spanning-tree vlan <list> root secondary",(s,a)=>{ const l=parseList(a[0]); if(!l) return INV; l.forEach(v=>s.stpPrio[v]=28672); });
add(C,"spanning-tree portfast default",(s)=>{s.portfastDefault=true; return "%Warning: this command enables portfast by default on all interfaces. You\n should now disable portfast explicitly on switched ports leading to hubs,\n switches and bridges as they may create temporary bridging loops.";});
add(C,"spanning-tree portfast bpduguard default",(s)=>{s.bpduguardDefault=true;});
add(C,"port-channel load-balance <w>",(s,a)=>{ const ok=["src-mac","dst-mac","src-dst-mac","src-ip","dst-ip","src-dst-ip"]; if(!ok.includes(a[0].toLowerCase())) return INV; s.lb=a[0].toLowerCase(); });

// --- VLAN ---
add("vlan","name <w>",(s,a,ctx)=>{ ctx.vlan.forEach(v=>s.vlans[v].name=a[0]); });
add("vlan","exit",(s,a,ctx)=>{ctx.mode="config";});
add("vlan","end",(s,a,ctx)=>{ctx.mode="exec";});

// --- лінії ---
add("line","transport input <rest>",(s,a,ctx)=>{ const v=a[0].toLowerCase().split(/\s+/); const ok=["ssh","telnet","all","none"]; const full=v.map(x=>ok.find(o=>o.startsWith(x))); if(full.some(x=>!x)) return INV; if(ctx.line==="vty") s.vty.transport=full.sort().join(" "); });
add("line","login local",(s,a,ctx)=>{ (ctx.line==="vty"?s.vty:s.con).login="local"; });
add("line","login",(s,a,ctx)=>{ const L=ctx.line==="vty"?s.vty:s.con; if(!L.password) { L.login="line"; return "% Login disabled on line, until 'password' is set"; } L.login="line"; });
add("line","password <w>",(s,a,ctx)=>{ (ctx.line==="vty"?s.vty:s.con).password=a[0]; });
add("line","exit",(s,a,ctx)=>{ctx.mode="config";});
add("line","end",(s,a,ctx)=>{ctx.mode="exec";});

// --- інтерфейс ---
const isErr=r=>typeof r==="string"&&(r===INV||/^(% Command rejected|% IP addresses|Command rejected|Bad mask)/.test(r));
const F=(fn)=>(s,a,ctx)=>{ const msgs=[];
  for(const n of ctx.ifs){
    const r=fn(s.ifs[n],a,s,n); if(isErr(r)) return r; if(typeof r==="string"&&!msgs.includes(r)) msgs.push(r);
    // налаштування port-channel поширюються на порти-члени
    if(n.startsWith("Po")){ const g=Number(n.slice(2)); for(const m of Object.values(s.ifs)) if(m.chGroup===g) fn(m,a,s,m.name); }
  }
  return msgs.join("\n"); };
const L2only=(i)=>i.svi? INV : (!i.switchport? "% Command rejected: interface is not a switchport (no switchport configured)." : null);
add("if","exit",(s,a,ctx)=>{ctx.mode="config";});
add("if","end",(s,a,ctx)=>{ctx.mode="exec";});
add("if","shutdown",F(i=>{i.shutdown=true; i.errdis=null;}));
add("if","no shutdown",F(i=>{i.shutdown=false; i.errdis=null;}));
add("if","description <rest>",F((i,a)=>{i.desc=a[0];}));
add("if","switchport mode access",F(i=>L2only(i)||void(i.mode="access")));
add("if","switchport mode trunk",F(i=>L2only(i)||void(i.mode="trunk")));
add("if","switchport mode dynamic auto",F(i=>L2only(i)||void(i.mode="dynamic auto")));
add("if","switchport mode dynamic desirable",F(i=>L2only(i)||void(i.mode="dynamic desirable")));
add("if","switchport access vlan <n>",F((i,a,s)=>{ const e=L2only(i); if(e) return e; if(a[0]<1||a[0]>4094) return INV; if(!s.vlans[a[0]]){ s.vlans[a[0]]={name:"VLAN"+String(a[0]).padStart(4,"0")}; i.accessVlan=a[0]; return "% Access VLAN does not exist. Creating vlan "+a[0]; } i.accessVlan=a[0]; }));
add("if","no switchport access vlan",F(i=>{i.accessVlan=1;}));
add("if","switchport voice vlan <n>",F((i,a,s)=>{ const e=L2only(i); if(e) return e; if(!s.vlans[a[0]]) s.vlans[a[0]]={name:"VLAN"+String(a[0]).padStart(4,"0")}; i.voiceVlan=a[0]; }));
add("if","no switchport voice vlan",F(i=>{i.voiceVlan=null;}));
add("if","switchport trunk native vlan <n>",F((i,a)=>L2only(i)||void(i.nativeVlan=a[0])));
add("if","no switchport trunk native vlan",F(i=>{i.nativeVlan=1;}));
add("if","switchport trunk allowed vlan <list>",F((i,a)=>{ const e=L2only(i); if(e) return e; const l=parseList(a[0]); if(!l) return INV; i.allowed=l; }));
add("if","switchport trunk allowed vlan add <list>",F((i,a)=>{ const e=L2only(i); if(e) return e; const l=parseList(a[0]); if(!l) return INV; if(i.allowed) i.allowed=[...new Set([...i.allowed,...l])].sort((x,y)=>x-y); }));
add("if","switchport trunk allowed vlan remove <list>",F((i,a)=>{ const e=L2only(i); if(e) return e; const l=parseList(a[0]); if(!l) return INV; const base=i.allowed||Array.from({length:4094},(_,k)=>k+1); i.allowed=base.filter(v=>!l.includes(v)); }));
add("if","switchport trunk allowed vlan all",F(i=>{i.allowed=null;}));
add("if","switchport trunk allowed vlan none",F(i=>{i.allowed=[];}));
add("if","switchport trunk encapsulation dot1q",F(()=>{}));
add("if","switchport nonegotiate",F(i=>{ if(i.mode.startsWith("dynamic")) return "Command rejected: Conflict between 'nonegotiate' and 'dynamic' status."; i.nonegotiate=true; }));
add("if","no switchport nonegotiate",F(i=>{i.nonegotiate=false;}));
add("if","switchport",F((i,a,s)=>{ if(i.svi) return INV; i.switchport=true; i.ip=null; }));
add("if","no switchport",F((i,a,s)=>{ if(i.svi||s.router) return INV; if(!s.l3) return INV; i.switchport=false; }));
add("if","encapsulation dot1q <n>",F((i,a,s)=>{ if(!s.router||!i.sub) return INV; i.encap=a[0]; i.native=false; }));
add("if","encapsulation dot1q <n> native",F((i,a,s)=>{ if(!s.router||!i.sub) return INV; i.encap=a[0]; i.native=true; }));
add("if","ip address <ip> <mask>",F((i,a,s)=>{ if(!i.svi && i.switchport) return "% IP addresses may not be configured on L2 links."; if(i.sub && !i.encap) return "% Configuring IP routing on a LAN subinterface is only allowed if that\nsubinterface is already configured as part of an IEEE 802.10, IEEE 802.1Q,\nor ISL vLAN."; if(!maskOk(a[1])) return "Bad mask "+a[1]+" for address "+a[0]; i.ip=a[0]; i.mask=a[1]; }));
add("if","no ip address",F(i=>{i.ip=null;i.mask=null;}));
add("if","channel-group <n> mode <w>",F((i,a,s,n)=>{ if(!isPhys(n)) return INV; const m=["active","passive","desirable","auto","on"].find(x=>x.startsWith(a[1].toLowerCase())); if(!m) return INV; i.chGroup=a[0]; i.chMode=m; const po="Po"+a[0]; if(!s.ifs[po]){ s.ifs[po]=newIf(po); Object.assign(s.ifs[po],{mode:i.mode,accessVlan:i.accessVlan,nativeVlan:i.nativeVlan,allowed:i.allowed,switchport:i.switchport}); return "Creating a port-channel interface Port-channel "+a[0]; } }));
add("if","no channel-group",F(i=>{i.chGroup=null;i.chMode=null;}));
add("if","spanning-tree portfast",F(i=>{ i.portfast=true; return "%Warning: portfast should only be enabled on ports connected to a single\n host. Connecting hubs, concentrators, switches, bridges, etc... to this\n interface  when portfast is enabled, can cause temporary bridging loops.\n Use with CAUTION"; }));
add("if","no spanning-tree portfast",F(i=>{i.portfast=false;}));
add("if","spanning-tree bpduguard enable",F(i=>{i.bpduguard=true;}));
add("if","spanning-tree bpduguard disable",F(i=>{i.bpduguard=false;}));
add("if","no spanning-tree bpduguard",F(i=>{i.bpduguard=false;}));
add("if","speed <w>",F((i,a)=>{i.speed=a[0];}));
add("if","duplex <w>",F((i,a)=>{i.duplex=a[0];}));

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

// ================= HSRP і мережеві сервіси =================
const hsrpG=(i,g)=>{ i.hsrp=i.hsrp||{}; if(!i.hsrp[g]) i.hsrp[g]={ip:null,prio:100,preempt:false}; return i.hsrp[g]; };
add("if","standby <n> ip <ip>",F((i,a)=>{ if(i.switchport&&!i.svi) return INV; if(a[0]>4095) return INV; hsrpG(i,a[0]).ip=a[1]; }));
add("if","standby <n> priority <n>",F((i,a)=>{ if(a[1]>255) return INV; hsrpG(i,a[0]).prio=a[1]; }));
add("if","standby <n> preempt",F((i,a)=>{ hsrpG(i,a[0]).preempt=true; }));
add("if","no standby <n> preempt",F((i,a)=>{ hsrpG(i,a[0]).preempt=false; }));
add("if","no standby <n>",F((i,a)=>{ if(i.hsrp) delete i.hsrp[a[0]]; }));
add("if","standby version <n>",F((i,a)=>{ if(a[0]!==1&&a[0]!==2) return INV; i.hsrpV=a[0]; }));
for(const m of ["user","exec"]){
  add(m,"show standby brief",(s)=>{ let o="                     P indicates configured to preempt.\n                     |\nInterface   Grp  Pri P State   Active          Standby         Virtual IP\n";
    for(const i of Object.values(s.ifs)) for(const [g,h] of Object.entries(i.hsrp||{})){ const st=s.net? s.net.hsrpState(s.devName,i.name,Number(g)) : {state:"Init",active:"unknown",standby:"unknown"};
      o+=i.name.padEnd(12)+g.padEnd(5)+String(h.prio).padEnd(4)+(h.preempt?"P ":"  ")+st.state.padEnd(8)+st.active.padEnd(16)+st.standby.padEnd(16)+(h.ip||"unknown")+"\n"; } return o.trimEnd(); });
  add(m,"show standby",(s)=>{ let o=""; for(const i of Object.values(s.ifs)) for(const [g,h] of Object.entries(i.hsrp||{})){ const st=s.net? s.net.hsrpState(s.devName,i.name,Number(g)) : {state:"Init",active:"unknown",standby:"unknown"};
      o+=longIf(i.name)+" - Group "+g+(i.hsrpV===2?" (version 2)":"")+"\n  State is "+st.state+"\n  Virtual IP address is "+(h.ip||"unknown")+"\n  Active virtual MAC address is "+(i.hsrpV===2?"0000.0c9f.f"+Number(g).toString(16).padStart(3,"0"):"0000.0c07.ac"+Number(g).toString(16).padStart(2,"0"))+"\n  Hello time 3 sec, hold time 10 sec\n  Preemption "+(h.preempt?"enabled":"disabled")+"\n  Active router is "+st.active+"\n  Standby router is "+st.standby+"\n  Priority "+h.prio+" (default 100)\n"; } return o.trimEnd(); });
  add(m,"show ntp associations",(s)=>{ const v=s.svc&&s.svc.ntp||[]; if(!v.length) return "%NTP is not enabled."; return "  address         ref clock       st   when   poll reach  delay  offset   disp\n"+v.map(x=>"*~"+x.padEnd(15)+"127.127.1.1      3     12     64   377  1.204  -0.315   0.937").join("\n")+"\n * sys.peer, # selected, + candidate, - outlyer, x falseticker, ~ configured"; });
  add(m,"show ntp status",(s)=>{ const v=s.svc&&s.svc.ntp||[]; return v.length?"Clock is synchronized, stratum 4, reference is "+v[0]:"Clock is unsynchronized, stratum 16, no reference clock"; });
  add(m,"show snmp community",(s)=>((s.svc&&s.svc.snmp)||[]).map(c=>"Community name: "+c.name+"\nCommunity Index: "+c.name+"\nstorage-type: nonvolatile        active access-list: "+(c.acl||"")+"\n"+(c.rw?"read-write":"read-only")).join("\n\n"));
  add(m,"show lldp neighbors",(s)=>s.svc&&s.svc.lldp? (s.net? s.net.cdp(s).replace("Capability Codes: R - Router, S - Switch, H - Host","Capability codes:\n    (R) Router, (B) Bridge, (T) Telephone"):"") : "% LLDP is not enabled");
  add(m,"show clock",(s)=>"*"+new Date().toTimeString().slice(0,8)+".123 UTC "+new Date().toDateString());
}
const SV=s=>{ s.svc=s.svc||{ntp:[],hosts:[],trap:null,snmp:[],lldp:false,cdp:true,tsLog:false,buffered:null,location:null,contact:null}; return s.svc; };
add(C,"ntp server <ip>",(s,a)=>{ const v=SV(s); if(!v.ntp.includes(a[0])) v.ntp.push(a[0]); });
add(C,"no ntp server <ip>",(s,a)=>{ const v=SV(s); v.ntp=v.ntp.filter(x=>x!==a[0]); });
add(C,"logging host <ip>",(s,a)=>{ const v=SV(s); if(!v.hosts.includes(a[0])) v.hosts.push(a[0]); });
add(C,"logging <ip>",(s,a)=>{ const v=SV(s); if(!v.hosts.includes(a[0])) v.hosts.push(a[0]); });
add(C,"no logging host <ip>",(s,a)=>{ const v=SV(s); v.hosts=v.hosts.filter(x=>x!==a[0]); });
const LVL=["emergencies","alerts","critical","errors","warnings","notifications","informational","debugging"];
add(C,"logging trap <w>",(s,a)=>{ const w=a[0].toLowerCase(); const l=/^\d$/.test(w)?LVL[Number(w)]:LVL.find(x=>x.startsWith(w)); if(!l) return INV; SV(s).trap=l; });
add(C,"logging buffered <n>",(s,a)=>{ SV(s).buffered=a[0]; });
add(C,"service timestamps log datetime msec",(s)=>{ SV(s).tsLog=true; });
add(C,"service timestamps log datetime",(s)=>{ SV(s).tsLog=true; });
add(C,"snmp-server community <w> <w>",(s,a)=>{ const t=a[1].toLowerCase(); if(!["ro","rw"].includes(t)) return INV; const v=SV(s); v.snmp=v.snmp.filter(x=>x.name!==a[0]); v.snmp.push({name:a[0],rw:t==="rw"}); });
add(C,"snmp-server community <w> <w> <w>",(s,a)=>{ const t=a[1].toLowerCase(); if(!["ro","rw"].includes(t)) return INV; const v=SV(s); v.snmp=v.snmp.filter(x=>x.name!==a[0]); v.snmp.push({name:a[0],rw:t==="rw",acl:a[2]}); });
add(C,"no snmp-server community <w>",(s,a)=>{ const v=SV(s); v.snmp=v.snmp.filter(x=>x.name!==a[0]); });
add(C,"snmp-server location <rest>",(s,a)=>{ SV(s).location=a[0]; });
add(C,"snmp-server contact <rest>",(s,a)=>{ SV(s).contact=a[0]; });
add(C,"lldp run",(s)=>{ SV(s).lldp=true; });
add(C,"no lldp run",(s)=>{ SV(s).lldp=false; });
add(C,"cdp run",(s)=>{ SV(s).cdp=true; });
add(C,"no cdp run",(s)=>{ SV(s).cdp=false; });
add("if","no cdp enable",F(i=>{ i.cdpOff=true; }));
add("if","cdp enable",F(i=>{ i.cdpOff=false; }));
function svcRun(s){ const v=s.svc; if(!v) return []; const L=[];
  if(v.tsLog) L.push("service timestamps log datetime msec"); if(v.buffered) L.push("logging buffered "+v.buffered); if(v.trap) L.push("logging trap "+v.trap); for(const h of v.hosts) L.push("logging host "+h);
  for(const c of v.snmp) L.push("snmp-server community "+c.name+" "+(c.rw?"RW":"RO")+(c.acl?" "+c.acl:"")); if(v.location) L.push("snmp-server location "+v.location); if(v.contact) L.push("snmp-server contact "+v.contact);
  if(!v.cdp) L.push("no cdp run"); if(v.lldp) L.push("lldp run"); for(const n of v.ntp) L.push("ntp server "+n); return L; }

// ================= IPv6 =================
const V6MAX=(1n<<128n)-1n;
function v6parse(s){ s=String(s||"").toLowerCase(); if(!/^[0-9a-f:]+$/.test(s)||s.indexOf(":")<0||(s.match(/::/g)||[]).length>1) return null;
  const dbl=s.includes("::"); const [h,t]=dbl?s.split("::"):[s,""]; const hp=h?h.split(":"):[], tp=t?t.split(":"):[];
  let parts; if(dbl){ const fill=8-hp.length-tp.length; if(fill<1) return null; parts=hp.concat(Array(fill).fill("0"),tp); } else parts=hp;
  if(parts.length!==8||parts.some(p=>!/^[0-9a-f]{1,4}$/.test(p))) return null; return parts.reduce((a,p)=>(a<<16n)|BigInt(parseInt(p,16)),0n); }
function v6fmt(n){ const g=[]; for(let i=7;i>=0;i--) g.push(Number((n>>BigInt(i*16))&0xffffn).toString(16).toUpperCase());
  let bs=-1,bl=0; for(let i=0;i<8;){ if(g[i]==="0"){ let j=i; while(j<8&&g[j]==="0") j++; if(j-i>bl&&j-i>=2){ bs=i; bl=j-i; } i=j; } else i++; }
  if(bs<0) return g.join(":"); return g.slice(0,bs).join(":")+"::"+g.slice(bs+bl).join(":"); }
const v6mask=len=>len===0?0n:(V6MAX ^ ((1n<<BigInt(128-len))-1n));
const v6net=(a,len)=>a & v6mask(len);
const v6same=(a,b,len)=>{ const x=v6parse(a), y=v6parse(b); return x!==null&&y!==null&&v6net(x,len)===v6net(y,len); };
const v6eq=(a,b)=>{ const x=v6parse(a), y=v6parse(b); return x!==null&&x===y; };
function v6pfx(t){ const m=String(t).match(/^([0-9a-fA-F:]+)\/(\d{1,3})$/); if(!m) return null; const a=v6parse(m[1]); const len=Number(m[2]); if(a===null||len>128) return null; return {a,len,addr:v6fmt(a)}; }
function hmac(key){ let h=5381; for(let i=0;i<key.length;i++) h=((h<<5)+h+key.charCodeAt(i))>>>0; const x=h.toString(16).padStart(8,"0"); return "00"+x.slice(0,2)+"."+x.slice(2,6)+"."+x.slice(6,8)+"0"+(key.length%10); }
function eui64(mac){ const h=mac.replace(/\./g,""); const b=[]; for(let i=0;i<12;i+=2) b.push(parseInt(h.slice(i,i+2),16)); b[0]^=0x02; const by=b.slice(0,3).concat([0xff,0xfe],b.slice(3)); return by.reduce((a,x)=>(a<<8n)|BigInt(x),0n); }
const ifMac=(s,i)=>hmac((s.mac||"")+"|"+i.name.split(".")[0]);
const v6ll=(s,i)=>v6fmt((0xfe80n<<112n)|eui64(ifMac(s,i)));
const v6on=i=>!!(i.v6on||(i.v6&&i.v6.length));
function v6list(s,i){ if(!i||!v6on(i)) return []; return [{addr:i.llStatic||v6ll(s,i),len:64,ll:true}].concat(i.v6||[]); }
add(C,"ipv6 unicast-routing",(s)=>{ if(!s.l3) return INV; s.v6routing=true; });
add(C,"no ipv6 unicast-routing",(s)=>{ s.v6routing=false; });
const v6route=(s,p,nh,ifc,ad)=>{ const P=v6pfx(p); if(!P) return "% Invalid IPv6 prefix"; if(nh&&v6parse(nh)===null) return INV; if(nh&&/^fe80/i.test(nh)&&!ifc) return "% Interface has to be specified for a link-local nexthop";
  s.routes6=(s.routes6||[]).filter(r=>!(r.pfx===v6fmt(v6net(P.a,P.len))&&r.len===P.len&&r.nh===(nh?v6fmt(v6parse(nh)):null)&&r.ifc===(ifc||null))); s.routes6.push({pfx:v6fmt(v6net(P.a,P.len)),len:P.len,nh:nh?v6fmt(v6parse(nh)):null,ifc:ifc||null,ad:ad||1}); };
add(C,"ipv6 route <w> <v6>",(s,a)=>v6route(s,a[0],a[1]));
add(C,"ipv6 route <w> <v6> <n>",(s,a)=>v6route(s,a[0],a[1],null,a[2]));
add(C,"ipv6 route <w> <if>",(s,a)=>{ if(!s.ifs[a[1]]) return INV; return v6route(s,a[0],null,a[1]); });
add(C,"ipv6 route <w> <if> <v6>",(s,a)=>{ if(!s.ifs[a[1]]) return INV; return v6route(s,a[0],a[2],a[1]); });
add(C,"no ipv6 route <w> <rest>",(s,a)=>{ const P=v6pfx(a[0]); if(!P) return INV; const net=v6fmt(v6net(P.a,P.len)); s.routes6=(s.routes6||[]).filter(r=>!(r.pfx===net&&r.len===P.len)); });
add("if","ipv6 address <w>",F((i,a,s)=>{ if(i.switchport&&!i.svi) return "% IPv6 addresses may not be configured on L2 links."; const P=v6pfx(a[0]); if(!P) return "% Invalid IPv6 address"; i.v6=(i.v6||[]).filter(x=>!v6same(x.addr,P.addr,P.len)); i.v6.push({addr:P.addr,len:P.len}); i.v6on=true; }));
add("if","ipv6 address <w> eui-64",F((i,a,s)=>{ if(i.switchport&&!i.svi) return INV; const P=v6pfx(a[0]); if(!P||P.len!==64) return "% Invalid IPv6 prefix"; const addr=v6fmt(v6net(P.a,64)|eui64(ifMac(s,i))); i.v6=(i.v6||[]).filter(x=>!v6same(x.addr,addr,64)); i.v6.push({addr,len:64,eui:true}); i.v6on=true; }));
add("if","ipv6 address <v6> link-local",F((i,a)=>{ i.llStatic=v6fmt(v6parse(a[0])); i.v6on=true; }));
add("if","ipv6 enable",F(i=>{ i.v6on=true; }));
add("if","no ipv6 address",F(i=>{ i.v6=[]; i.llStatic=null; }));
add("if","no ipv6 address <w>",F((i,a)=>{ const P=v6pfx(a[0]); if(!P) return INV; i.v6=(i.v6||[]).filter(x=>!v6eq(x.addr,P.addr)); }));
add("if","no ipv6 enable",F(i=>{ i.v6on=false; }));
for(const m of ["user","exec"]){
  add(m,"show ipv6 interface brief",(s)=>{ let o=""; for(const i of Object.values(s.ifs).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}))){ if(i.switchport&&!i.svi) continue; const [st,pr]=ifStatus(s,i); o+=longIf(i.name).padEnd(23)+"["+st.replace("administratively down","administratively down")+"/"+pr+"]\n"+(v6on(i)?v6list(s,i).map(x=>"    "+x.addr).join("\n"):"    unassigned")+"\n"; } return o.trimEnd(); });
  add(m,"show ipv6 route",(s)=>showRoute6(s,null)); add(m,"show ipv6 route static",(s)=>showRoute6(s,"S"));
  add(m,"ping <v6>",(s,a)=>s.net? s.net.ping6Cli(s,v6fmt(v6parse(a[0]))) : "Sending 5, 100-byte ICMP Echos to "+a[0]+", timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)");
  add(m,"ping ipv6 <v6>",(s,a)=>s.net? s.net.ping6Cli(s,v6fmt(v6parse(a[0]))) : "% No route");
  add(m,"show mac address-table",(s)=>s.net? s.net.macTable(s) : "          Mac Address Table\n-------------------------------------------\n\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\nTotal Mac Addresses for this criterion: 0");
  add(m,"show mac address-table dynamic",(s)=>s.net? s.net.macTable(s) : "");
}
add("exec","debug ip ospf adj",(s)=>{ s.dbgOspf=true; return "OSPF adjacency debugging is on"+(s.net? "\n"+s.net.ospfDebug(s) : ""); });
add("exec","undebug all",(s)=>{ s.dbgOspf=false; return "All possible debugging has been turned off"; });
add("exec","no debug all",(s)=>{ s.dbgOspf=false; return "All possible debugging has been turned off"; });
function activeStatics6(s){ return (s.routes6||[]).filter(r=>{ if(r.ifc){ const i=s.ifs[r.ifc]; return i&&ifStatus(s,i)[1]==="up"; } return Object.values(s.ifs).some(i=>ifStatus(s,i)[1]==="up"&&(i.v6||[]).some(x=>v6same(x.addr,r.nh,x.len))); }); }
function showRoute6(s,only){ const L=[]; const up=Object.values(s.ifs).filter(i=>ifStatus(s,i)[1]==="up"&&v6on(i));
  if(!only) for(const i of up) for(const x of i.v6||[]){ L.push("C   "+v6fmt(v6net(v6parse(x.addr),x.len))+"/"+x.len+" [0/0]\n     via "+longIf(i.name)+", directly connected"); L.push("L   "+x.addr+"/128 [0/0]\n     via "+longIf(i.name)+", receive"); }
  if(s.net&&(!only||only==="O")) for(const r of s.net.ospf6Routes(s.devName)) L.push((r.e2?"OE2 ":"O   ")+r.pfx+"/"+r.len+" [110/"+(r.e2?1:r.cost)+"]\n     via "+r.hops[0].nh+", "+longIf(r.hops[0].ifn));
  if(!only||only==="S") for(const r of activeStatics6(s)) L.push("S   "+r.pfx+"/"+r.len+" ["+r.ad+"/0]\n     via "+(r.nh?r.nh+(r.ifc?", "+longIf(r.ifc):""):longIf(r.ifc)+", directly connected"));
  if(!only) L.push("L   FF00::/8 [0/0]\n     via Null0, receive");
  return "IPv6 Routing Table - default - "+L.length+" entries\nCodes: C - Connected, L - Local, S - Static, U - Per-user Static route\n       B - BGP, R - RIP, O - OSPF Intra, OI - OSPF Inter, ND - ND Default\n\n"+L.join("\n"); }

const INV="% Invalid input detected at '^' marker.";
function parseRange(str){
  const out=[];
  for(const part of str.split(",")){
    const m=part.trim().match(/^([a-z-]+)\s*(\d+)\/(\d+)\s*(?:-\s*(?:[a-z-]+\s*\d+\/)?(\d+))?$/i); if(!m) return null;
    const n=normIf(m[1]+m[2]+"/"+m[3]); if(!n) return null; const pre=n.replace(/\d+$/,""); const a=Number(m[3]), b=m[4]?Number(m[4]):a;
    if(b<a) return null; for(let k=a;k<=b;k++) out.push(pre+k);
  }
  return out;
}

// ================= Безпека L2 (port-security, DHCP snooping, DAI), err-disable, STP на порту, DHCPv6 =================
const PS=i=>{ if(!i.ps) i.ps={on:false,max:1,sticky:false,stickyMacs:[],static:[],viol:"shutdown",count:0,lastMac:null,aging:0}; return i.ps; };
const SNP=s=>{ if(!s.snoop) s.snoop={on:false,vlans:[],opt82:true,bind:{}}; return s.snoop; };
const DAIc=s=>{ if(!s.dai) s.dai={vlans:[],validate:"",drops:{}}; return s.dai; };
const ERRc=s=>{ if(!s.errRec) s.errRec={causes:[],interval:300}; return s.errRec; };
const D6=s=>{ if(!s.dhcp6) s.dhcp6={pools:{},bind:{}}; return s.dhcp6; };
const macRe=/^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i;
const ERRCAUSES=["arp-inspection","bpduguard","channel-misconfig","dhcp-rate-limit","link-flap","psecure-violation","security-violation"];
function psReject(i){ if(i.svi||!i.switchport) return INV; if(String(i.mode).startsWith("dynamic")) return "Command rejected: "+longIf(i.name)+" is a dynamic port."; return null; }
// --- port-security ---
add("if","switchport port-security",F(i=>{ const e=psReject(i); if(e) return e; PS(i).on=true; }));
add("if","no switchport port-security",F(i=>{ if(i.ps) i.ps.on=false; delete i._psDeny; }));
add("if","switchport port-security maximum <n>",F((i,a)=>{ const e=psReject(i); if(e) return e; if(a[0]<1||a[0]>8192) return INV; PS(i).max=a[0]; }));
add("if","no switchport port-security maximum",F(i=>{ PS(i).max=1; }));
add("if","switchport port-security mac-address sticky",F(i=>{ const e=psReject(i); if(e) return e; PS(i).sticky=true; }));
add("if","no switchport port-security mac-address sticky",F(i=>{ const p=PS(i); p.sticky=false; p.stickyMacs=[]; }));
add("if","switchport port-security mac-address sticky <w>",F((i,a)=>{ const e=psReject(i); if(e) return e; if(!macRe.test(a[0])) return INV; const p=PS(i), m=a[0].toLowerCase(); if(!p.stickyMacs.includes(m)) p.stickyMacs.push(m); }));
add("if","switchport port-security mac-address <w>",F((i,a)=>{ const e=psReject(i); if(e) return e; if(!macRe.test(a[0])) return INV; const p=PS(i), m=a[0].toLowerCase(); if(!p.static.includes(m)) p.static.push(m); }));
add("if","no switchport port-security mac-address <w>",F((i,a)=>{ const p=PS(i), m=a[0].toLowerCase(); p.static=p.static.filter(x=>x!==m); p.stickyMacs=p.stickyMacs.filter(x=>x!==m); }));
add("if","switchport port-security violation <w>",F((i,a)=>{ const e=psReject(i); if(e) return e; const v=["protect","restrict","shutdown"].find(x=>x.startsWith(a[0].toLowerCase())); if(!v) return INV; PS(i).viol=v; }));
add("if","no switchport port-security violation",F(i=>{ PS(i).viol="shutdown"; }));
add("if","switchport port-security aging time <n>",F((i,a)=>{ PS(i).aging=a[0]; }));
add("if","switchport port-security aging type <w>",F(()=>{}));
// --- STP на порту ---
const stpCost=(i,a)=>{ if(a<1||a>200000000) return INV; i.stpCost=a; };
const stpPrio=(i,a)=>{ if(a%16||a>240) return "% Port Priority in increments of 16 is required\nAllowed values are:\n  0     16    32    48    64    80    96    112\n  128   144   160   176   192   208   224   240"; i.stpPortPrio=a; };
add("if","spanning-tree cost <n>",F((i,a)=>stpCost(i,a[0])));
add("if","spanning-tree vlan <list> cost <n>",F((i,a)=>stpCost(i,a[1])));
add("if","no spanning-tree cost",F(i=>{ i.stpCost=null; }));
add("if","no spanning-tree vlan <list> cost",F(i=>{ i.stpCost=null; }));
add("if","spanning-tree port-priority <n>",F((i,a)=>stpPrio(i,a[0])));
add("if","spanning-tree vlan <list> port-priority <n>",F((i,a)=>stpPrio(i,a[1])));
add("if","no spanning-tree port-priority",F(i=>{ i.stpPortPrio=null; }));
add("if","no spanning-tree vlan <list> port-priority",F(i=>{ i.stpPortPrio=null; }));
// --- DHCP snooping, DAI ---
const swOnly=s=>s.router? INV : null;
add(C,"ip dhcp snooping",s=>swOnly(s)||void(SNP(s).on=true));
add(C,"no ip dhcp snooping",s=>{ SNP(s).on=false; });
add(C,"ip dhcp snooping vlan <list>",(s,a)=>{ if(swOnly(s)) return INV; const l=parseList(a[0]); if(!l) return INV; const p=SNP(s); p.vlans=[...new Set(p.vlans.concat(l))].sort((x,y)=>x-y); });
add(C,"no ip dhcp snooping vlan <list>",(s,a)=>{ const l=parseList(a[0])||[]; const p=SNP(s); p.vlans=p.vlans.filter(v=>!l.includes(v)); });
add(C,"ip dhcp snooping information option",s=>{ SNP(s).opt82=true; });
add(C,"no ip dhcp snooping information option",s=>{ SNP(s).opt82=false; });
add(C,"ip dhcp snooping database <rest>",()=>{});
add("if","ip dhcp snooping trust",F((i,a,s)=>{ if(s.router) return INV; i.dhcpTrust=true; }));
add("if","no ip dhcp snooping trust",F(i=>{ i.dhcpTrust=false; }));
add("if","ip dhcp snooping limit rate <n>",F((i,a,s)=>{ if(s.router||a[0]<1||a[0]>2048) return INV; i.snoopRate=a[0]; }));
add("if","no ip dhcp snooping limit rate",F(i=>{ i.snoopRate=null; }));
add(C,"ip arp inspection vlan <list>",(s,a)=>{ if(swOnly(s)) return INV; const l=parseList(a[0]); if(!l) return INV; const d=DAIc(s); d.vlans=[...new Set(d.vlans.concat(l))].sort((x,y)=>x-y); });
add(C,"no ip arp inspection vlan <list>",(s,a)=>{ const l=parseList(a[0])||[]; const d=DAIc(s); d.vlans=d.vlans.filter(v=>!l.includes(v)); });
add(C,"ip arp inspection validate <rest>",(s,a)=>{ if(swOnly(s)) return INV; const w=a[0].toLowerCase().split(/\s+/); if(!w.every(x=>["src-mac","dst-mac","ip"].includes(x))) return INV; DAIc(s).validate=w.join(" "); });
add(C,"no ip arp inspection validate <rest>",s=>{ DAIc(s).validate=""; });
add("if","ip arp inspection trust",F((i,a,s)=>{ if(s.router) return INV; i.daiTrust=true; }));
add("if","no ip arp inspection trust",F(i=>{ i.daiTrust=false; }));
add("if","ip arp inspection limit rate <n>",F((i,a)=>{ i.daiRate=a[0]; }));
add(C,"ip dhcp relay information trust-all",s=>{ if(!s.l3) return INV; s.relayTrustAll=true; });
add(C,"no ip dhcp relay information trust-all",s=>{ s.relayTrustAll=false; });
add("if","ip dhcp relay information trusted",F((i,a,s)=>{ if(!s.l3) return INV; i.relayTrusted=true; }));
add("if","no ip dhcp relay information trusted",F(i=>{ i.relayTrusted=false; }));
// --- err-disable ---
add(C,"errdisable recovery cause <w>",(s,a)=>{ const w=a[0].toLowerCase(); const c=w==="all"?ERRCAUSES:ERRCAUSES.filter(x=>x===w||x.startsWith(w)); if(c.length!==1&&w!=="all") return INV; const e=ERRc(s); e.causes=[...new Set(e.causes.concat(c))]; });
add(C,"no errdisable recovery cause <w>",(s,a)=>{ const e=ERRc(s); const w=a[0].toLowerCase(); e.causes=w==="all"?[]:e.causes.filter(x=>!x.startsWith(w)); });
add(C,"errdisable recovery interval <n>",(s,a)=>{ if(a[0]<30||a[0]>86400) return INV; ERRc(s).interval=a[0]; });
// --- DHCPv6 ---
add(C,"ipv6 dhcp pool <w>",(s,a,ctx)=>{ if(!s.l3) return INV; const d=D6(s); if(!d.pools[a[0]]) d.pools[a[0]]={name:a[0],prefix:null,dns:[],domain:null}; ctx.mode="dhcp6"; ctx.pool6=a[0]; });
add(C,"no ipv6 dhcp pool <w>",(s,a)=>{ delete D6(s).pools[a[0]]; });
const D6M="dhcp6";
add(D6M,"exit",(s,a,ctx)=>{ctx.mode="config";}); add(D6M,"end",(s,a,ctx)=>{ctx.mode="exec";}); add(D6M,"do <rest>",(s,a,ctx)=>ctx.runIn("exec",a[0]));
add(D6M,"address prefix <w>",(s,a,ctx)=>{ const P=v6pfx(a[0]); if(!P||P.len>64) return "% Invalid prefix"; D6(s).pools[ctx.pool6].prefix={net:v6fmt(v6net(P.a,P.len)),len:P.len}; });
add(D6M,"address prefix <w> lifetime <rest>",(s,a,ctx)=>{ const P=v6pfx(a[0]); if(!P||P.len>64) return "% Invalid prefix"; D6(s).pools[ctx.pool6].prefix={net:v6fmt(v6net(P.a,P.len)),len:P.len}; });
add(D6M,"no address prefix <w>",(s,a,ctx)=>{ D6(s).pools[ctx.pool6].prefix=null; });
add(D6M,"dns-server <v6>",(s,a,ctx)=>{ const p=D6(s).pools[ctx.pool6]; const x=v6fmt(v6parse(a[0])); if(!p.dns.includes(x)) p.dns.push(x); });
add(D6M,"no dns-server <v6>",(s,a,ctx)=>{ const p=D6(s).pools[ctx.pool6]; p.dns=p.dns.filter(x=>!v6eq(x,a[0])); });
add(D6M,"domain-name <w>",(s,a,ctx)=>{ D6(s).pools[ctx.pool6].domain=a[0]; });
add("if","ipv6 nd managed-config-flag",F((i,a,s)=>{ if(!s.l3) return INV; i.ndM=true; }));
add("if","no ipv6 nd managed-config-flag",F(i=>{ i.ndM=false; }));
add("if","ipv6 nd other-config-flag",F((i,a,s)=>{ if(!s.l3) return INV; i.ndO=true; }));
add("if","no ipv6 nd other-config-flag",F(i=>{ i.ndO=false; }));
add("if","ipv6 nd prefix default no-autoconfig",F((i,a,s)=>{ if(!s.l3) return INV; i.ndNoAuto=true; }));
add("if","no ipv6 nd prefix default no-autoconfig",F(i=>{ i.ndNoAuto=false; }));
add("if","no ipv6 nd prefix default",F(i=>{ i.ndNoAuto=false; }));
add("if","ipv6 dhcp server <w>",F((i,a,s)=>{ if(!s.l3) return INV; i.dhcp6=a[0]; }));
add("if","no ipv6 dhcp server",F(i=>{ i.dhcp6=null; }));
add("if","no ipv6 dhcp server <w>",F(i=>{ i.dhcp6=null; }));

// --- show ---
const pad=(x,n)=>String(x).padEnd(n);
function psAllowed(i){ if(i._psAllowed) return i._psAllowed; const p=i.ps||{}; return (p.static||[]).map(mac=>({mac,type:"SecureConfigured"})).concat((p.stickyMacs||[]).map(mac=>({mac,type:"SecureSticky"}))); }
function showPs(s){ let o="Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action\n                (Count)       (Count)          (Count)\n---------------------------------------------------------------------------\n";
  const L=Object.values(s.ifs).filter(i=>i.ps&&i.ps.on); for(const i of L) o+=pad(i.name,13).padStart(13)+String(i.ps.max).padStart(14)+String(psAllowed(i).length).padStart(13)+String(i.ps.count).padStart(19)+"         "+i.ps.viol[0].toUpperCase()+i.ps.viol.slice(1)+"\n";
  const tot=L.reduce((a,i)=>a+psAllowed(i).length,0); return o+"---------------------------------------------------------------------------\nTotal Addresses in System (excluding one mac per port)     : "+Math.max(0,tot-L.length)+"\nMax Addresses limit in System (excluding one mac per port) : 4096"; }
function showPsIf(s,n){ const i=s.ifs[n]; if(!i||i.svi) return INV; const p=i.ps||{on:false,max:1,viol:"shutdown",count:0,stickyMacs:[],static:[],aging:0}; const al=psAllowed(i);
  const st=!p.on?"Secure-down":i.errdis==="psecure-violation"?"Secure-shutdown":(i.shutdown||!i.connected)?"Secure-down":"Secure-up";
  return "Port Security              : "+(p.on?"Enabled":"Disabled")+"\nPort Status                : "+st+"\nViolation Mode             : "+p.viol[0].toUpperCase()+p.viol.slice(1)+"\nAging Time                 : "+(p.aging||0)+" mins\nAging Type                 : Absolute\nSecureStatic Address Aging : Disabled\nMaximum MAC Addresses      : "+p.max+
  "\nTotal MAC Addresses        : "+al.length+"\nConfigured MAC Addresses   : "+(p.static||[]).length+"\nSticky MAC Addresses       : "+(p.stickyMacs||[]).length+"\nLast Source Address:Vlan   : "+(p.lastMac||(al[0]&&al[0].mac)||"0000.0000.0000")+":"+i.accessVlan+"\nSecurity Violation Count   : "+p.count; }
function showPsAddr(s){ let o="               Secure Mac Address Table\n-----------------------------------------------------------------------------\nVlan    Mac Address       Type                          Ports   Remaining Age\n                                                                   (mins)\n----    -----------       ----                          -----   -------------\n"; let n=0;
  for(const i of Object.values(s.ifs)) if(i.ps&&i.ps.on) for(const a of psAllowed(i)){ n++; o+=String(i.accessVlan).padStart(4)+"    "+pad(a.mac,18)+pad(a.type,30)+pad(i.name,8)+"     -\n"; }
  return o+"-----------------------------------------------------------------------------\nTotal Addresses in System (excluding one mac per port)     : 0\nMax Addresses limit in System (excluding one mac per port) : 4096"; }
function showErrIf(s){ let o="Port      Name               Status       Reason               Err-disabled Vlans\n"; for(const i of Object.values(s.ifs).filter(x=>x.errdis)) o+=pad(i.name,10)+pad((i.desc||"").slice(0,18),19)+pad("err-disabled",13)+i.errdis+"\n"; return o; }
function showErrRec(s){ const e=s.errRec||{causes:[],interval:300}; let o="ErrDisable Reason            Timer Status\n-----------------            --------------\n"; for(const c of ERRCAUSES) o+=pad(c,29)+(e.causes.includes(c)?"Enabled":"Disabled")+"\n";
  o+="\nTimer interval: "+e.interval+" seconds\n\nInterfaces that will be enabled at the next timeout:\n"; const L=Object.values(s.ifs).filter(i=>i.errdis&&e.causes.includes(i.errdis)); if(L.length){ o+="\nInterface       Errdisable reason       Time left(sec)\n---------       -----------------       --------------\n"; for(const i of L) o+=pad(i.name,16)+pad(i.errdis,24)+String(e.interval).padStart(10)+"\n"; } return o; }
function showSnoop(s){ const p=s.snoop||{on:false,vlans:[],opt82:true}; const op=p.on?p.vlans.filter(v=>s.vlans[v]):[];
  let o="Switch DHCP snooping is "+(p.on?"enabled":"disabled")+"\nSwitch DHCP gleaning is disabled\nDHCP snooping is configured on following VLANs:\n"+(p.vlans.length?fmtList(p.vlans):"none")+"\nDHCP snooping is operational on following VLANs:\n"+(op.length?fmtList(op):"none")+"\nDHCP snooping is configured on the following L3 Interfaces:\n\nInsertion of option 82 is "+(p.opt82?"enabled":"disabled")+"\n   circuit-id default format: vlan-mod-port\n   remote-id: "+s.mac+" (MAC)\nOption 82 on untrusted port is not allowed\nVerification of hwaddr field is enabled\nVerification of giaddr field is enabled\nDHCP snooping trust/rate is configured on the following Interfaces:\n\nInterface                  Trusted    Allow option    Rate limit (pps)\n-----------------------    -------    ------------    ----------------\n";
  for(const i of Object.values(s.ifs).filter(x=>x.dhcpTrust||x.snoopRate)) o+=pad(longIf(i.name),27)+pad(i.dhcpTrust?"yes":"no",11)+pad(i.dhcpTrust?"yes":"no",16)+(i.snoopRate||"unlimited")+"\n"; return o; }
function showSnoopBind(s){ const b=Object.values((s.snoop||{}).bind||{}); let o="MacAddress          IpAddress        Lease(sec)  Type           VLAN  Interface\n------------------  ---------------  ----------  -------------  ----  --------------------\n";
  for(const x of b) o+=pad(x.mac.replace(/\./g,"").replace(/(..)(?=.)/g,"$1:").toUpperCase(),20)+pad(x.ip,17)+pad("86400",12)+pad("dhcp-snooping",15)+pad(x.vlan,6)+longIf(x.port)+"\n"; return o+"Total number of bindings: "+b.length; }
function showDai(s,only){ const d=s.dai||{vlans:[],validate:"",drops:{}}; const vs=only?[only]:d.vlans; const val=w=>d.validate.includes(w)?"Enabled":"Disabled";
  let o="\nSource Mac Validation      : "+val("src-mac")+"\nDestination Mac Validation : "+val("dst-mac")+"\nIP Address Validation      : "+val("ip")+"\n\n Vlan     Configuration    Operation   ACL Match          Static ACL\n ----     -------------    ---------   ---------          ----------\n";
  for(const v of vs) o+=String(v).padStart(5)+"     "+pad(d.vlans.includes(v)?"Enabled":"Disabled",17)+pad(d.vlans.includes(v)&&s.vlans[v]?"Active":"Inactive",12)+"\n";
  o+="\n Vlan      Forwarded        Dropped     DHCP Drops      ACL Drops\n ----      ---------        -------     ----------      ---------\n"; for(const v of vs) o+=String(v).padStart(5)+String(0).padStart(15)+String(d.drops[v]||0).padStart(15)+String(d.drops[v]||0).padStart(15)+String(0).padStart(15)+"\n"; return o; }
function showDaiIf(s){ let o="\n Interface        Trust State     Rate (pps)    Burst Interval\n ---------------  -----------     ----------    --------------\n"; for(const i of Object.values(s.ifs).filter(x=>isPhys(x.name))) o+=" "+pad(i.name,17)+pad(i.daiTrust?"Trusted":"Untrusted",16)+pad(i.daiTrust?"None":(i.daiRate||15),14)+(i.daiTrust?"N/A":"1")+"\n"; return o; }
function showStpSum(s){ const vs=Object.keys(s.vlans).map(Number).sort((a,b)=>a-b); const roots=s.net? vs.filter(v=>{ const x=(s.net.stp(v)||{})[s.devName]; return x&&x.rootName===s.devName; }) : [];
  return "Switch is in "+s.stpMode+" mode\nRoot bridge for: "+(roots.length?roots.map(v=>"VLAN"+String(v).padStart(4,"0")).join(", "):"none")+"\nExtended system ID                      is enabled\nPortfast Default                        is "+(s.portfastDefault?"enabled":"disabled")+"\nPortFast BPDU Guard Default             is "+(s.bpduguardDefault?"enabled":"disabled")+"\nPortfast BPDU Filter Default            is disabled\nLoopguard Default                       is disabled\nEtherChannel misconfig guard            is enabled\nUplinkFast                              is disabled\nBackboneFast                            is disabled\nConfigured Pathcost method used is short\n\nName                   Blocking Listening Learning Forwarding STP Active\n---------------------- -------- --------- -------- ---------- ----------\n"+
    vs.map(v=>{ const x=s.net?((s.net.stp(v)||{})[s.devName]||{roles:{}}):{roles:{}}; const r=Object.values(x.roles); const b=r.filter(z=>z[1]==="BLK").length, f=r.filter(z=>z[1]==="FWD").length; return pad("VLAN"+String(v).padStart(4,"0"),23)+String(b).padStart(8)+String(0).padStart(10)+String(0).padStart(9)+String(f).padStart(11)+String(b+f).padStart(11); }).join("\n"); }
function ecPeerRows(s,proto){ const L=[]; for(const i of Object.values(s.ifs)) if(i.chGroup&&i._ecPeer&&(proto==="lacp"?["active","passive"]:["desirable","auto"]).includes(i.chMode)) L.push(i); return L; }
function showLacpNb(s){ const L=ecPeerRows(s,"lacp"); if(!L.length) return ""; const g=[...new Set(L.map(i=>i.chGroup))]; let o="Flags:  S - Device is requesting Slow LACPDUs\n        F - Device is requesting Fast LACPDUs\n        A - Device is in Active mode       P - Device is in Passive mode\n";
  for(const n of g){ o+="\nChannel group "+n+" neighbors\n\nPartner's information:\n\n                  LACP port                        Admin  Oper   Port    Port\nPort      Flags   Priority  Dev ID          Age    key    Key    Number  State\n"; for(const i of L.filter(x=>x.chGroup===n)){ const p=i._ecPeer; if(!["active","passive"].includes(p.mode)) continue; o+=pad(i.name,10)+pad("S"+(p.mode==="active"?"A":"P"),8)+pad("32768",10)+pad(p.mac,16)+pad("12s",7)+pad("0x0",7)+pad("0x"+p.group,7)+pad("0x"+(p.port.startsWith("Gi")?24+Number(p.port.split("/")[1]):Number(p.port.split("/")[1])).toString(16),8)+(i._ec==="P"?"0x3D":"0x45")+"\n"; } }
  return o; }
function showPagpNb(s){ const L=ecPeerRows(s,"pagp"); if(!L.length) return ""; const g=[...new Set(L.map(i=>i.chGroup))]; let o="Flags:  S - Device is sending Slow hello.  C - Device is in Consistent state.\n        A - Device is in Auto mode.        P - Device learns on physical port.\n";
  for(const n of g){ o+="\nChannel group "+n+" neighbors\n          Partner              Partner          Partner         Partner Group\nPort      Name                 Device ID        Port       Age  Flags   Cap.\n"; for(const i of L.filter(x=>x.chGroup===n)){ const p=i._ecPeer; if(!["desirable","auto"].includes(p.mode)) continue; o+=pad(i.name,10)+pad(p.dev,21)+pad(p.mac,17)+pad(p.port,11)+pad("9s",5)+pad("S"+(i._ec==="P"?"C":"")+(p.mode==="auto"?"A":""),8)+"1000"+n+"\n"; } }
  return o; }
function showV6If(s,n){ const i=s.ifs[n]; if(!i) return INV; const [st,pr]=ifStatus(s,i); if(!v6on(i)) return longIf(n)+" is "+st+", line protocol is "+pr+"\n  IPv6 is disabled";
  const ll=i.llStatic||v6ll(s,i); const gl=(i.v6||[]); const sn=a=>"FF02::1:FF"+a.split(":").pop().padStart(4,"0").slice(-4).replace(/^(..)(..)$/,"$1:$2");
  return longIf(n)+" is "+st+", line protocol is "+pr+"\n  IPv6 is enabled, link-local address is "+ll+"\n  No Virtual link-local address(es):\n  Global unicast address(es):\n"+gl.map(x=>"    "+x.addr+", subnet is "+v6fmt(v6net(v6parse(x.addr),x.len))+"/"+x.len+(x.eui?" [EUI]":"")).join("\n")+
    "\n  Joined group address(es):\n    FF02::1\n"+(s.v6routing?"    FF02::2\n":"")+[ll].concat(gl.map(x=>x.addr)).map(a=>"    "+sn(a)).join("\n")+"\n  MTU is 1500 bytes\n  ICMP error messages limited to one every 100 milliseconds\n  ICMP redirects are enabled\n  ICMP unreachables are sent\n  ND DAD is enabled, number of DAD attempts: 1\n  ND reachable time is 30000 milliseconds (using 30000)\n"+
    (s.v6routing?"  ND advertised reachable time is 0 (unspecified)\n  ND advertised retransmit interval is 0 (unspecified)\n  ND router advertisements are sent every 200 seconds\n  ND router advertisements live for 1800 seconds\n  ND advertised default router preference is Medium\n"+(i.ndM?"  Hosts use DHCP to obtain routable addresses.\n":"  Hosts use stateless autoconfig for addresses.\n")+(i.ndO&&!i.ndM?"  Hosts use DHCP to obtain other configuration.\n":"")+(i.dhcp6?"  DHCPv6 server: pool "+i.dhcp6+"\n":"") : "  (ipv6 unicast-routing вимкнено — Router Advertisement не надсилаються)\n"); }
function showD6Pool(s){ const d=s.dhcp6||{pools:{},bind:{}}; return Object.values(d.pools).map(p=>{ const used=Object.values(d.bind).filter(b=>b.pool===p.name).length;
  return "DHCPv6 pool: "+p.name+(p.prefix?"\n  Address allocation prefix: "+p.prefix.net+"/"+p.prefix.len+" valid 172800 preferred 86400 ("+used+" in use, 0 conflicts)":"")+p.dns.map(x=>"\n  DNS server: "+x).join("")+(p.domain?"\n  Domain name: "+p.domain:"")+"\n  Active clients: "+used; }).join("\n")||""; }
function showD6Bind(s){ const d=s.dhcp6||{bind:{}}; return Object.values(d.bind).map(b=>"Client: "+b.ll+"\n  DUID: 000300010050"+b.mac.replace(/\./g,"").slice(4)+"\n  Username : unassigned\n  VRF : default\n  IA NA: IA ID 0x000"+b.iaid+"0001, T1 43200, T2 69120\n    Address: "+b.addr+"\n            preferred lifetime 86400, valid lifetime 172800\n            expires at Dec 01 2026 12:00 PM (172800 seconds)").join("\n")||""; }
for(const m of ["user","exec"]){
  add(m,"show port-security",s=>showPs(s)); add(m,"show port-security interface <if>",(s,a)=>showPsIf(s,a[0])); add(m,"show port-security address",s=>showPsAddr(s));
  add(m,"show interfaces status err-disabled",s=>showErrIf(s)); add(m,"show errdisable recovery",s=>showErrRec(s));
  add(m,"show ip dhcp snooping",s=>showSnoop(s)); add(m,"show ip dhcp snooping binding",s=>showSnoopBind(s));
  add(m,"show ip arp inspection",s=>showDai(s)); add(m,"show ip arp inspection vlan <n>",(s,a)=>showDai(s,a[0])); add(m,"show ip arp inspection interfaces",s=>showDaiIf(s));
  add(m,"show spanning-tree summary",s=>showStpSum(s)); add(m,"show lacp neighbor",s=>showLacpNb(s)); add(m,"show pagp neighbor",s=>showPagpNb(s));
  add(m,"show ipv6 interface <if>",(s,a)=>showV6If(s,a[0])); add(m,"show ipv6 dhcp pool",s=>showD6Pool(s)); add(m,"show ipv6 dhcp binding",s=>showD6Bind(s));
  add(m,"show ipv6 dhcp interface",s=>Object.values(s.ifs).filter(i=>i.dhcp6).map(i=>longIf(i.name)+" is in server mode\n  Using pool: "+i.dhcp6+"\n  Preference value: 0\n  Hint from client: ignored\n  Rapid-Commit: disabled").join("\n"));
}
// running-config: рядки для інтерфейсу й глобальні
function secRunIf(s,i){ const L=[]; const p=i.ps;
  if(p&&(p.on||p.sticky||p.static.length||p.max!==1||p.viol!=="shutdown")){ if(p.max!==1) L.push(" switchport port-security maximum "+p.max); if(p.on) L.push(" switchport port-security"); if(p.viol!=="shutdown") L.push(" switchport port-security violation "+p.viol); if(p.aging) L.push(" switchport port-security aging time "+p.aging);
    for(const m of p.static) L.push(" switchport port-security mac-address "+m); if(p.sticky) L.push(" switchport port-security mac-address sticky"); for(const m of p.stickyMacs) L.push(" switchport port-security mac-address sticky "+m); }
  if(i.daiTrust) L.push(" ip arp inspection trust"); if(i.daiRate) L.push(" ip arp inspection limit rate "+i.daiRate);
  if(i.stpPortPrio!=null) L.push(" spanning-tree port-priority "+i.stpPortPrio); if(i.stpCost) L.push(" spanning-tree cost "+i.stpCost);
  if(i.dhcpTrust) L.push(" ip dhcp snooping trust"); if(i.snoopRate) L.push(" ip dhcp snooping limit rate "+i.snoopRate); return L; }
function v6ndRun(i){ const L=[]; if(i.ndM) L.push(" ipv6 nd managed-config-flag"); if(i.ndO) L.push(" ipv6 nd other-config-flag"); if(i.ndNoAuto) L.push(" ipv6 nd prefix default no-autoconfig"); if(i.dhcp6) L.push(" ipv6 dhcp server "+i.dhcp6); if(i.relayTrusted) L.push(" ip dhcp relay information trusted"); return L; }
function secRunGlobal(s){ const L=[]; const p=s.snoop, d=s.dai, e=s.errRec;
  if(e){ for(const c of e.causes) L.push("errdisable recovery cause "+c); if(e.interval!==300) L.push("errdisable recovery interval "+e.interval); }
  if(p){ if(p.vlans.length) L.push("ip dhcp snooping vlan "+fmtList(p.vlans)); if(!p.opt82) L.push("no ip dhcp snooping information option"); if(p.on) L.push("ip dhcp snooping"); }
  if(d){ if(d.vlans.length) L.push("ip arp inspection vlan "+fmtList(d.vlans)); if(d.validate) L.push("ip arp inspection validate "+d.validate); }
  if(s.relayTrustAll) L.push("ip dhcp relay information trust-all");
  for(const x of Object.values((s.dhcp6||{}).pools||{})){ L.push("ipv6 dhcp pool "+x.name); if(x.prefix) L.push(" address prefix "+x.prefix.net+"/"+x.prefix.len); for(const n of x.dns) L.push(" dns-server "+n); if(x.domain) L.push(" domain-name "+x.domain); L.push("!"); }
  return L; }

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

// ---------- QoS (MQC): class-map, policy-map, service-policy; mls qos на комутаторах; DHCP option 43 ----------
const DSCPN={default:0,ef:46,af11:10,af12:12,af13:14,af21:18,af22:20,af23:22,af31:26,af32:28,af33:30,af41:34,af42:36,af43:38,cs0:0,cs1:8,cs2:16,cs3:24,cs4:32,cs5:40,cs6:48,cs7:56};
const dscpOk=w=>{ w=String(w).toLowerCase(); return w in DSCPN||(/^\d+$/.test(w)&&Number(w)<=63); };
const QS=s=>(s.qos=s.qos||{cmaps:{},pmaps:{}});
const newCmap=(s,n,any)=>{ const q=QS(s); if(!q.cmaps[n]) q.cmaps[n]={name:n,any:!!any,match:[],desc:null}; else if(any!=null) q.cmaps[n].any=any; return q.cmaps[n]; };
add(C,"class-map <w>",(s,a,ctx)=>{ if(/^match-(any|all)$/i.test(a[0])) return "% Incomplete command."; newCmap(s,a[0],null); ctx.mode="cmap"; ctx.cmap=a[0]; });
add(C,"class-map match-any <w>",(s,a,ctx)=>{ newCmap(s,a[0],true); ctx.mode="cmap"; ctx.cmap=a[0]; });
add(C,"class-map match-all <w>",(s,a,ctx)=>{ newCmap(s,a[0],false); ctx.mode="cmap"; ctx.cmap=a[0]; });
add(C,"no class-map <w>",(s,a)=>{ const q=QS(s); if(Object.values(q.pmaps).some(p=>p.classes.some(c=>c.name===a[0]))) return "% Class-map "+a[0]+" is being used"; delete q.cmaps[a[0]]; });
const CM="cmap"; add(CM,"exit",(s,a,ctx)=>{ctx.mode="config";}); add(CM,"end",(s,a,ctx)=>{ctx.mode="exec";}); add(CM,"do <rest>",(s,a,ctx)=>ctx.runIn("exec",a[0]));
const cmM=(ctx,s,m)=>{ const c=QS(s).cmaps[ctx.cmap]; if(!c.match.some(x=>x.t===m.t&&x.v===m.v)) c.match.push(m); };
add(CM,"match dscp <rest>",(s,a,ctx)=>{ const v=a[0].trim().toLowerCase().split(/\s+/); if(!v.every(dscpOk)) return INV; cmM(ctx,s,{t:"dscp",v:v.join(" ")}); });
add(CM,"match ip dscp <rest>",(s,a,ctx)=>{ const v=a[0].trim().toLowerCase().split(/\s+/); if(!v.every(dscpOk)) return INV; cmM(ctx,s,{t:"dscp",v:v.join(" ")}); });
add(CM,"match access-group name <w>",(s,a,ctx)=>{ cmM(ctx,s,{t:"acl",v:a[0]}); });
add(CM,"match access-group <n>",(s,a,ctx)=>{ cmM(ctx,s,{t:"acl",v:String(a[0])}); });
add(CM,"match protocol <w>",(s,a,ctx)=>{ cmM(ctx,s,{t:"protocol",v:a[0].toLowerCase()}); });
add(CM,"match cos <rest>",(s,a,ctx)=>{ cmM(ctx,s,{t:"cos",v:a[0].trim()}); });
add(CM,"match any",(s,a,ctx)=>{ cmM(ctx,s,{t:"any",v:""}); });
add(CM,"description <rest>",(s,a,ctx)=>{ QS(s).cmaps[ctx.cmap].desc=a[0]; });
add(CM,"no match <rest>",(s,a,ctx)=>{ const c=QS(s).cmaps[ctx.cmap]; const t=a[0].trim().toLowerCase(); c.match=c.match.filter(m=>!t.endsWith(m.v.toLowerCase())||!t.includes(m.t==="acl"?"access-group":m.t)); });
add(C,"policy-map <w>",(s,a,ctx)=>{ const q=QS(s); if(!q.pmaps[a[0]]) q.pmaps[a[0]]={name:a[0],classes:[]}; ctx.mode="pmap"; ctx.pmap=a[0]; });
add(C,"no policy-map <w>",(s,a)=>{ if(Object.values(s.ifs).some(i=>i.svcOut===a[0]||i.svcIn===a[0])) return "% Policy-map "+a[0]+" is being used"; delete QS(s).pmaps[a[0]]; });
const PM="pmap", PC2="pmapc";
for(const m of [PM,PC2]){ add(m,"end",(s,a,ctx)=>{ctx.mode="exec";}); add(m,"do <rest>",(s,a,ctx)=>ctx.runIn("exec",a[0]));
  add(m,"class <w>",(s,a,ctx)=>{ const q=QS(s); const n=a[0]; if(n!=="class-default"&&!q.cmaps[n]) return "% class-map "+n+" not configured"; const p=q.pmaps[ctx.pmap]; let c=p.classes.find(x=>x.name===n); if(!c){ c={name:n,prio:null,bw:null,set:null,fq:false,police:null}; p.classes.push(c); } ctx.mode=PC2; ctx.pclass=n; });
  add(m,"no class <w>",(s,a,ctx)=>{ const p=QS(s).pmaps[ctx.pmap]; p.classes=p.classes.filter(c=>c.name!==a[0]); ctx.mode=PM; }); }
add(PM,"exit",(s,a,ctx)=>{ctx.mode="config";}); add(PC2,"exit",(s,a,ctx)=>{ctx.mode=PM;});
add(PM,"description <rest>",()=>{});
const pcl=(s,ctx)=>QS(s).pmaps[ctx.pmap].classes.find(c=>c.name===ctx.pclass);
const pcSet=(fn)=>(s,a,ctx)=>{ const c=pcl(s,ctx); return fn(c,a,s,ctx); };
add(PC2,"priority percent <n>",pcSet((c,a)=>{ if(c.name==="class-default") return "% priority is not allowed in class-default"; if(a[0]<1||a[0]>100) return INV; if(c.bw) return "% bandwidth and priority are mutually exclusive in the same class"; c.prio={pct:a[0]}; }));
add(PC2,"priority <n>",pcSet((c,a)=>{ if(c.name==="class-default") return "% priority is not allowed in class-default"; if(c.bw) return "% bandwidth and priority are mutually exclusive in the same class"; c.prio={kbps:a[0]}; }));
add(PC2,"priority level <n>",pcSet((c)=>{ c.prio=c.prio||{kbps:null}; }));
add(PC2,"bandwidth percent <n>",pcSet((c,a)=>{ if(a[0]<1||a[0]>100) return INV; if(c.prio) return "% bandwidth and priority are mutually exclusive in the same class"; c.bw={pct:a[0]}; }));
add(PC2,"bandwidth remaining percent <n>",pcSet((c,a)=>{ if(c.prio) return "% bandwidth and priority are mutually exclusive in the same class"; c.bw={rem:a[0]}; }));
add(PC2,"bandwidth <n>",pcSet((c,a)=>{ if(c.prio) return "% bandwidth and priority are mutually exclusive in the same class"; c.bw={kbps:a[0]}; }));
add(PC2,"set dscp <w>",pcSet((c,a)=>{ if(!dscpOk(a[0])) return INV; c.set=a[0].toLowerCase(); }));
add(PC2,"set ip dscp <w>",pcSet((c,a)=>{ if(!dscpOk(a[0])) return INV; c.set=a[0].toLowerCase(); }));
add(PC2,"fair-queue",pcSet((c)=>{ c.fq=true; }));
add(PC2,"police <n>",pcSet((c,a)=>{ c.police=a[0]; }));
add(PC2,"police cir <n>",pcSet((c,a)=>{ c.police=a[0]; }));
add(PC2,"shape average <n>",pcSet((c,a)=>{ c.shape=a[0]; }));
add(PC2,"random-detect",pcSet((c)=>{ c.wred=true; }));
add(PC2,"random-detect dscp-based",pcSet((c)=>{ c.wred=true; }));
add(PC2,"no priority",pcSet((c)=>{ c.prio=null; })); add(PC2,"no bandwidth",pcSet((c)=>{ c.bw=null; }));
const pmSum=p=>p.classes.reduce((t,c)=>t+((c.prio&&c.prio.pct)||0)+((c.bw&&c.bw.pct)||0),0);
const attachPol=(dir)=>F((i,a,s)=>{ const p=QS(s).pmaps[a[0]]; if(!p) return "policy map "+a[0]+" not configured"; if(dir==="out"&&pmSum(p)>100) return "I/f "+(i.name||"")+" class "+p.classes[p.classes.length-1].name+" requested bandwidth "+pmSum(p)+"%, available only "+(100-(pmSum(p)-((p.classes[p.classes.length-1].bw||{}).pct||0)))+"%\n% Sum of bandwidth percents exceeds 100";
  if(dir==="in"&&p.classes.some(c=>c.prio||c.bw||c.fq)) return "%  CBWFQ : Not supported in input direction"; if(dir==="out") i.svcOut=a[0]; else i.svcIn=a[0]; });
add("if","service-policy output <w>",attachPol("out"));
add("if","service-policy input <w>",attachPol("in"));
add("if","no service-policy output <w>",F((i)=>{ i.svcOut=null; }));
add("if","no service-policy input <w>",F((i)=>{ i.svcIn=null; }));
add(C,"mls qos",(s)=>{ if(s.router) return INV; s.mlsQos=true; });
add(C,"no mls qos",(s)=>{ s.mlsQos=false; });
add("if","mls qos trust cos",F((i,a,s)=>{ if(s.router) return INV; i.qosTrust="cos"; }));
add("if","mls qos trust dscp",F((i,a,s)=>{ if(s.router) return INV; i.qosTrust="dscp"; }));
add("if","mls qos trust device cisco-phone",F((i,a,s)=>{ if(s.router) return INV; i.qosTrustDev="cisco-phone"; }));
add("if","no mls qos trust",F((i)=>{ i.qosTrust=null; }));
add("if","auto qos voip cisco-phone",F((i,a,s)=>{ if(s.router) return INV; s.mlsQos=true; i.qosTrust="cos"; i.qosTrustDev="cisco-phone"; i.autoQos=true; }));
add(DH,"option 43 hex <w>",(s,a,ctx)=>{ const h=a[0].replace(/\./g,"").toLowerCase(); if(!/^[0-9a-f]+$/.test(h)||h.length%2) return INV; s.dhcp.pools[ctx.pool].opt43=h; });
add(DH,"option 43 ip <ip>",(s,a,ctx)=>{ s.dhcp.pools[ctx.pool].opt43ip=a[0]; });
add(DH,"no option 43",(s,a,ctx)=>{ const p=s.dhcp.pools[ctx.pool]; p.opt43=null; p.opt43ip=null; });
function qosRunGlobal(s){ const L=[]; const q=s.qos; if(s.mlsQos) L.push("mls qos"); if(!q) return L;
  for(const c of Object.values(q.cmaps)){ L.push("class-map "+(c.any?"match-any ":"match-all ")+c.name); if(c.desc) L.push(" description "+c.desc); for(const m of c.match) L.push(" match "+(m.t==="acl"?"access-group "+(/^\d+$/.test(m.v)?"":"name ")+m.v:m.t==="dscp"?"dscp "+m.v:m.t==="any"?"any":m.t+" "+m.v)); L.push("!"); }
  for(const p of Object.values(q.pmaps)){ L.push("policy-map "+p.name); for(const c of p.classes){ L.push(" class "+c.name); if(c.prio) L.push(c.prio.pct?"  priority percent "+c.prio.pct:"  priority "+(c.prio.kbps||"")); if(c.bw) L.push(c.bw.pct?"  bandwidth percent "+c.bw.pct:c.bw.rem?"  bandwidth remaining percent "+c.bw.rem:"  bandwidth "+c.bw.kbps); if(c.set) L.push("  set dscp "+c.set); if(c.fq) L.push("  fair-queue"); if(c.police) L.push("  police "+c.police); if(c.shape) L.push("  shape average "+c.shape); if(c.wred) L.push("  random-detect dscp-based"); } L.push("!"); }
  return L; }
function qosRunIf(i){ const L=[]; if(i.autoQos) L.push(" auto qos voip cisco-phone"); if(i.qosTrust) L.push(" mls qos trust "+i.qosTrust); if(i.qosTrustDev) L.push(" mls qos trust device "+i.qosTrustDev); if(i.svcIn) L.push(" service-policy input "+i.svcIn); if(i.svcOut) L.push(" service-policy output "+i.svcOut); return L; }
const cmDesc=c=>c.match.length? c.match.map(m=>"    Match "+(m.t==="acl"?"access-group name "+m.v:m.t==="dscp"?"dscp "+m.v.split(" ").map(x=>x+(DSCPN[x]!=null&&!/^\d+$/.test(x)?" ("+DSCPN[x]+")":"")).join(" "):m.t==="any"?"any":m.t+" "+m.v)).join("\n") : "    Match none";
function showClassMap(s){ const q=QS(s); let o=" Class Map match-any class-default (id 0)\n   Match any\n"; for(const c of Object.values(q.cmaps)) o+="\n Class Map "+(c.any?"match-any":"match-all")+" "+c.name+"\n"+(c.desc?"   Description: "+c.desc+"\n":"")+cmDesc(c).replace(/^ {4}/gm,"   ")+"\n"; return o; }
function pmLines(p,ind){ const I=" ".repeat(ind); return p.classes.map(c=>I+"Class "+c.name+"\n"+(c.prio?I+"  priority "+(c.prio.pct?c.prio.pct+"% (strict priority, LLQ)":(c.prio.kbps||"")+" kbps")+"\n":"")+(c.bw?I+"  bandwidth "+(c.bw.pct?c.bw.pct+"% (CBWFQ)":c.bw.rem?"remaining "+c.bw.rem+"%":c.bw.kbps+" kbps")+"\n":"")+(c.set?I+"  set dscp "+c.set+"\n":"")+(c.fq?I+"  fair-queue\n":"")+(c.police?I+"  police cir "+c.police+" bps\n":"")+(c.shape?I+"  shape average "+c.shape+"\n":"")+(c.wred?I+"  random-detect dscp-based\n":"")).join(""); }
function showPolicyMap(s,name){ const q=QS(s); const ps=Object.values(q.pmaps).filter(p=>!name||p.name===name); if(name&&!ps.length) return "policy-map "+name+" not found"; return ps.map(p=>"  Policy Map "+p.name+"\n"+pmLines(p,4)).join("\n"); }
function showPolicyIf(s,ifn){ const n=normIf(ifn); const i=n&&s.ifs[n]; if(!i) return INV; const out=[]; for(const [dir,pn] of [["input",i.svcIn],["output",i.svcOut]]){ if(!pn) continue; const p=QS(s).pmaps[pn]; if(!p) continue;
    out.push(" "+longIf(n)+"\n\n  Service-policy "+dir+": "+pn+"\n");
    const cls=p.classes.concat(p.classes.some(c=>c.name==="class-default")?[]:[{name:"class-default"}]);
    for(const c of cls){ const cm=c.name==="class-default"?null:QS(s).cmaps[c.name]; out.push("    Class-map: "+c.name+" ("+(cm&&!cm.any?"match-all":"match-any")+")\n      0 packets, 0 bytes\n      5 minute offered rate 0000 bps, drop rate 0000 bps\n"+(cm?cmDesc(cm).replace(/^/gm,"  ")+"\n":"      Match: any\n")+(c.prio?"      Priority: "+(c.prio.pct?c.prio.pct+"% ("+Math.round(c.prio.pct*10000)+" kbps)":(c.prio.kbps||"")+" kbps")+", burst bytes 25000, b/w exceed drops: 0\n":"")+(c.bw?"      Queueing\n      queue limit 64 packets\n      bandwidth "+(c.bw.pct?c.bw.pct+"% ("+c.bw.pct*10000+" kbps)":c.bw.rem?"remaining "+c.bw.rem+"%":c.bw.kbps+" kbps")+"\n":"")+(c.set?"      QoS Set\n        dscp "+c.set+"\n":"")+(c.fq?"      Queueing\n      Flow Based Fair Queueing\n":"")); } }
  return out.length? out.join("\n") : ""; }
for(const m of ["user","exec"]) for(const [p,f] of [
["show class-map",(s)=>showClassMap(s)],["show policy-map",(s)=>showPolicyMap(s)],["show policy-map <w>",(s,a)=>showPolicyMap(s,a[0])],["show policy-map interface <if>",(s,a)=>showPolicyIf(s,a[0])],
 ["show mls qos",(s)=>"QoS is "+(s.mlsQos?"enabled":"disabled")+"\nQoS ip packet dscp rewrite is enabled"],
 ["show mls qos interface <if>",(s,a)=>{ const n=normIf(a[0]); const i=n&&s.ifs[n]; if(!i) return INV; return longIf(n)+"\ntrust state: "+(s.mlsQos&&i.qosTrust?(i.qosTrustDev&&!(i.phoneSeen)?"not trusted":"trust "+i.qosTrust):"not trusted")+"\ntrust mode: "+(i.qosTrust?"trust "+i.qosTrust:"not trusted")+"\ntrust enabled flag: ena\nCOS override: dis\ndefault COS: 0\nDSCP Mutation Map: Default DSCP Mutation Map\nTrust device: "+(i.qosTrustDev||"none")+"\nqos mode: port-based"+(s.mlsQos?"":"\n! Підказка тренажера: глобально QoS вимкнено — без «mls qos» налаштування trust не діють"); }]
]) add(m,p,f);
// ---------- Розбір рядка ----------
function tokenize(line){
  let t=line.trim().split(/\s+/).filter(Boolean);
  // «fa 0/1» → «fa0/1» після interface(s)
  const out=[]; for(let i=0;i<t.length;i++){
    const prev=out.length?out[out.length-1].toLowerCase():"";
    if(/^[a-z-]+$/i.test(t[i]) && t[i+1] && /^\d+(\/\d+)*$/.test(t[i+1]) && ("interfaces".startsWith(prev)&&prev.length>=2) && normIf(t[i]+t[i+1])){ out.push(t[i]+t[i+1]); i++; }
    else out.push(t[i]);
  }
  return out;
}
function valid(ph,tok){
  switch(ph){
    case "<n>": return /^\d+$/.test(tok);
    case "<w>": return true;
    case "<list>": return !!parseList(tok);
    case "<if>": return !!normIf(tok);
    case "<ip>": return ipRe.test(tok);
    case "<v6>": return v6parse(tok)!==null;
    case "<mask>": return ipRe.test(tok);
  } return false;
}
function conv(ph,tok){ if(ph==="<n>") return Number(tok); if(ph==="<if>") return normIf(tok); return tok; }
function matchMode(mode,line){
  const toks=tokenize(line); if(!toks.length) return {empty:true};
  let cands=(G[mode]||[]).map(c=>({c,args:[]}));
  for(let i=0;i<toks.length;i++){
    const tok=toks[i], low=tok.toLowerCase();
    // <rest> забирає решту
    const restC=cands.filter(x=>x.c.p[i]==="<rest>");
    const lits=new Set(cands.map(x=>x.c.p[i]).filter(p=>p && !p.startsWith("<") && p.startsWith(low)));
    let chosen=null;
    if(lits.has(low)) chosen=low; else if(lits.size===1) chosen=[...lits][0];
    const next=[];
    for(const x of cands){
      const p=x.c.p[i]; if(!p) continue;
      if(p==="<rest>"){ next.push({c:x.c,args:x.args.concat([toks.slice(i).join(" ")]),done:true}); continue; }
      if(p.startsWith("<")){ if(valid(p,tok)) next.push({c:x.c,args:x.args.concat([conv(p,tok)])}); }
      else if(chosen && p===chosen) next.push(x);
    }
    if(!next.length){
      if(lits.size>1) return {err:"% Ambiguous command:  \""+line.trim()+"\""};
      return {err:" ".repeat(Math.max(0,line.indexOf(tok)+ (ctxPromptLen||0)))+"^\n"+INV};
    }
    const done=next.filter(x=>x.done); if(done.length && next.every(x=>x.done)) return {hit:done[0]};
    cands=next.filter(x=>!x.done);
    if(lits.size>1 && !chosen && !cands.some(x=>x.c.p[i].startsWith("<"))) return {err:"% Ambiguous command:  \""+line.trim()+"\""};
  }
  // повні збіги
  const full=cands.filter(x=>x.c.p.length===toks.length);
  if(full.length){ // перевага літералам
    full.sort((a,b)=>a.c.p.filter(p=>p.startsWith("<")).length-b.c.p.filter(p=>p.startsWith("<")).length);
    return {hit:full[0]};
  }
  if(cands.length) return {err:"% Incomplete command."};
  return {err:INV};
}
let ctxPromptLen=0;
// Підказка «?»
function help(mode,line){
  const raw=line.replace(/\?$/,""); const toks=tokenize(raw); const partial=!/\s$/.test(raw) && toks.length;
  const fixed=partial?toks.slice(0,-1):toks; const pref=partial?toks[toks.length-1].toLowerCase():"";
  const opts=new Set();
  for(const c of (G[mode]||[])){
    let ok=true; for(let i=0;i<fixed.length;i++){ const p=c.p[i]; if(!p){ok=false;break;} if(p==="<rest>") {ok=false;break;} if(p.startsWith("<")){ if(!valid(p,fixed[i])){ok=false;break;} } else if(!p.startsWith(fixed[i].toLowerCase())){ok=false;break;} }
    if(!ok) continue; const nx=c.p[fixed.length]; if(!nx){ if(!partial) opts.add("<cr>"); continue; }
    if(nx.startsWith("<")){ if(!partial) opts.add({"<n>":"<1-4094>  число","<w>":"WORD","<list>":"WORD  VLAN ID, напр. 10,20,30-35","<if>":"Інтерфейс, напр. fa0/1, gi0/1, vlan 10, po1","<ip>":"A.B.C.D","<mask>":"A.B.C.D  маска","<rest>":"LINE"}[nx]); }
    else if(nx.startsWith(pref)) opts.add(nx);
  }
  return [...opts].sort().join("\n")||INV;
}

// ---------- Show ----------
function vlanPorts(s,v){ return Object.values(s.ifs).filter(i=>isPhys(i.name)&&i.switchport&&!operTrunk(i)&&!i.chGroup&&i.accessVlan===v).map(i=>i.name); }
function wrapPorts(arr){ const lines=[]; for(let i=0;i<arr.length;i+=4) lines.push(arr.slice(i,i+4).join(", ")); return lines; }
function showVlanBrief(s){
  let out="\nVLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n";
  const ids=Object.keys(s.vlans).map(Number).sort((a,b)=>a-b);
  for(const v of ids){ const pl=wrapPorts(vlanPorts(s,v)); out+=String(v).padEnd(5)+s.vlans[v].name.slice(0,32).padEnd(33)+"active    "+(pl[0]||"")+"\n"; for(const l of pl.slice(1)) out+=" ".repeat(48)+l+"\n"; }
  out+="1002 fddi-default                     act/unsup \n1003 token-ring-default               act/unsup \n1004 fddinet-default                  act/unsup \n1005 trnet-default                    act/unsup ";
  return out;
}
function trunks(s){ return Object.values(s.ifs).filter(i=>i.switchport&&operTrunk(i)&&(i.name.startsWith("Po")||!i.chGroup)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})); }
function showTrunk(s){
  const t=trunks(s).filter(i=>!i.shutdown); if(!t.length) return "";
  let o="\nPort        Mode             Encapsulation  Status        Native vlan\n";
  for(const i of t) o+=i.name.padEnd(12)+(i.nonegotiate?"on":"on").padEnd(17)+"802.1q".padEnd(15)+"trunking".padEnd(14)+i.nativeVlan+"\n";
  o+="\nPort        Vlans allowed on trunk\n"; for(const i of t) o+=i.name.padEnd(12)+(i.allowed?fmtList(i.allowed):"1-4094")+"\n";
  o+="\nPort        Vlans allowed and active in management domain\n"; for(const i of t){ const act=(i.allowed||Object.keys(s.vlans).map(Number)).filter(v=>s.vlans[v]); o+=i.name.padEnd(12)+fmtList(act)+"\n"; }
  o+="\nPort        Vlans in spanning tree forwarding state and not pruned\n"; for(const i of t){ const act=(i.allowed||Object.keys(s.vlans).map(Number)).filter(v=>s.vlans[v]); o+=i.name.padEnd(12)+fmtList(act)+"\n"; }
  return o;
}
function showSwitchport(s,n){ const i=s.ifs[n]; if(!i||i.svi) return INV;
  const oper=!i.switchport?"routed":operTrunk(i)?"trunk":"static access";
  return "Name: "+n+"\nSwitchport: "+(i.switchport?"Enabled":"Disabled")+"\nAdministrative Mode: "+({"access":"static access","trunk":"trunk","dynamic auto":"dynamic auto","dynamic desirable":"dynamic desirable"}[i.mode])+
  "\nOperational Mode: "+(i.shutdown?"down":oper)+"\nAdministrative Trunking Encapsulation: dot1q\nNegotiation of Trunking: "+(i.nonegotiate||i.mode==="access"?"Off":"On")+
  "\nAccess Mode VLAN: "+i.accessVlan+" ("+((s.vlans[i.accessVlan]||{}).name||"Inactive")+")\nTrunking Native Mode VLAN: "+i.nativeVlan+" ("+((s.vlans[i.nativeVlan]||{}).name||"Inactive")+")"+
  "\nVoice VLAN: "+(i.voiceVlan?i.voiceVlan+" ("+((s.vlans[i.voiceVlan]||{}).name||"Inactive")+")":"none")+"\nTrunking VLANs Enabled: "+(i.allowed?fmtList(i.allowed):"ALL"); }
function ifStatus(s,i){
  if(i.sub){ const p=s.ifs[i.name.split(".")[0]]; if(i.shutdown) return ["administratively down","down"]; return ifStatus(s,p); }
  if(i.errdis) return ["down","down"];
  if(i.shutdown) return ["administratively down","down"];
  if(i.tunnel) return s.net&&s.net.tunnelUp(s,i)? ["up","up"] : ["up","down"];
  if(i.loop) return ["up","up"];
  if(i.svi){ const v=Number(i.name.slice(4)); const has=s.vlans[v] && Object.values(s.ifs).some(p=>isPhys(p.name)&&!p.shutdown&&p.switchport&&(operTrunk(p)?(!p.allowed||p.allowed.includes(v)):p.accessVlan===v)&&p.connected); return has?["up","up"]:["up","down"]; }
  if(i.name.startsWith("Po")){ const m=Object.values(s.ifs).filter(p=>p.chGroup===Number(i.name.slice(2))&&!p.shutdown); if(m.some(p=>p._ec!==undefined)) return m.some(p=>p._ec==="P")?["up","up"]:["down","down"]; return m.length?["up","up"]:["down","down"]; }
  return i.connected&&!i.peerDown?["up","up"]:["down","down"]; }
function showIpBrief(s){
  let o="Interface              IP-Address      OK? Method Status                Protocol\n";
  const list=Object.values(s.ifs).sort((a,b)=>(a.svi-b.svi)||a.name.localeCompare(b.name,undefined,{numeric:true}));
  for(const i of list){ const [st,pr]=ifStatus(s,i); o+=longIf(i.name).padEnd(23)+(i.ip||"unassigned").padEnd(16)+"YES "+(i.ip?"manual":"unset ").padEnd(7)+st.padEnd(22)+pr+"\n"; }
  return o;
}
function showStatus(s){ let o="Port      Name               Status       Vlan       Duplex  Speed Type\n";
  for(const i of Object.values(s.ifs).filter(x=>isPhys(x.name))){ const st=i.errdis?"err-disabled":i.shutdown?"disabled":i.connected?"connected":"notconnect"; o+=i.name.padEnd(10)+(i.desc||"").slice(0,18).padEnd(19)+st.padEnd(13)+(operTrunk(i)?"trunk":!i.switchport?"routed":String(i.accessVlan)).padEnd(11)+"auto".padEnd(8)+"auto  "+(i.name.startsWith("Gi")?"10/100/1000BaseTX":"10/100BaseTX")+"\n"; } return o; }
function showIface(s,n){ const i=s.ifs[n]; if(!i) return INV; const [st,pr]=ifStatus(s,i); return longIf(n)+" is "+st+", line protocol is "+pr+(i.errdis?" (err-disabled)":i.connected&&!i.shutdown?" (connected)":"")+"\n  Hardware is "+(i.svi?"EtherSVI":n.startsWith("Gi")?"Gigabit Ethernet":"Fast Ethernet")+", address is "+s.mac+"\n"+(i.ip?"  Internet address is "+i.ip+"/"+maskLen(i.mask)+"\n":"")+"  MTU 1500 bytes, BW "+(n.startsWith("Gi")?"1000000":n.startsWith("Po")?String(1000000*Object.values(s.ifs).filter(p=>p.chGroup===Number(n.slice(2))).length):"100000")+" Kbit/sec\n  "+((i._dupBad||(i.duplex==="half"?"half":"full"))==="half"?"Half":"Full")+"-duplex, "+(n.startsWith("Gi")?"1000Mb/s":"100Mb/s")+", media type is 10/100/1000BaseTX\n  5 minute input rate 2000 bits/sec, 3 packets/sec\n     "+(i._dupBad?"1843 input errors, 1211 CRC, 0 frame, 0 overrun, 0 ignored\n     0 output errors, "+(i._dupBad==="half"?"0":"0")+" collisions, 0 interface resets\n     "+(i._dupBad==="half"?"512 late collision":"0 late collision")+", 0 deferred":"0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n     0 output errors, 0 collisions, 0 interface resets\n     0 late collision, 0 deferred"); }
function showEc(s){
  const groups={}; for(const i of Object.values(s.ifs)) if(i.chGroup){ (groups[i.chGroup]=groups[i.chGroup]||[]).push(i); }
  let o="Flags:  D - down        P - bundled in port-channel\n        I - stand-alone s - suspended\n        S - Layer2      R - Layer3\n        U - in use      N - not in use, no aggregation\n\nNumber of channel-groups in use: "+Object.keys(groups).length+"\nNumber of aggregators:           "+Object.keys(groups).length+"\n\nGroup  Port-channel  Protocol    Ports\n------+-------------+-----------+-----------------------------------------------\n";
  for(const [g,m] of Object.entries(groups)){
    const po=s.ifs["Po"+g]; const proto=m[0].chMode==="on"?"-":["active","passive"].includes(m[0].chMode)?"LACP":"PAgP";
    const ref=m[0]; const flag=p=>{ if(p._ec) return p._ec; if(p.shutdown||!p.connected) return "D"; const same=p.mode===ref.mode&&p.accessVlan===ref.accessVlan&&p.nativeVlan===ref.nativeVlan&&JSON.stringify(p.allowed)===JSON.stringify(ref.allowed)&&p.chMode===ref.chMode; return same?"P":"s"; };
    const fl=m.map(flag); const up=fl.includes("P");
    o+=String(g).padEnd(7)+("Po"+g+"("+(po&&!po.switchport?"R":"S")+(up?"U":"D")+")").padEnd(14)+proto.padEnd(12)+m.map((p,k)=>p.name+"("+fl[k]+")").join(" ")+"\n";
  }
  return o;
}
function stpPortCost(d,p){ const i=d.ifs[p]; if(i&&i.stpCost) return i.stpCost; if(p.startsWith("Po")){ const m=Object.values(d.ifs).filter(x=>x.chGroup===Number(p.slice(2))&&(x._ec===undefined?!x.shutdown:x._ec==="P")); const gi=m.length&&m.every(x=>x.name.startsWith("Gi")); return m.length>=2?(gi?3:12):(gi?4:19); } return p.startsWith("Gi")?4:19; }
function stpPortId(d,p){ const i=d.ifs[p]||{}; const num=p.startsWith("Po")?64+Number(p.slice(2)):p.startsWith("Gi")?24+Number(p.split("/")[1]):Number(p.split("/")[1]); return {pr:i.stpPortPrio!=null?i.stpPortPrio:128,num}; }
function stpPorts(s,v){ return Object.values(s.ifs).filter(p=>{ if(p.name.startsWith("Po")) return p.switchport&&ifStatus(s,p)[1]==="up"&&(operTrunk(p)?(!p.allowed||p.allowed.includes(v)):p.accessVlan===v);
  return isPhys(p.name)&&!p.shutdown&&p.connected&&p.switchport&&!(p.chGroup&&p._ec==="P")&&!(p._ec==="s")&&(operTrunk(p)?(!p.allowed||p.allowed.includes(v)):p.accessVlan===v); }).sort((a,b)=>stpPortId(s,a.name).num-stpPortId(s,b.name).num); }
function prioOf(s,v){ return (s.stpPrio[v]!==undefined?s.stpPrio[v]:32768)+v; }
function showStp(s,vl){
  const vs=vl?[vl]:Object.keys(s.vlans).map(Number).sort((a,b)=>a-b); let o="";
  for(const v of vs){ if(!s.vlans[v]){ o+="Spanning tree instance(s) for vlan "+v+" does not exist.\n"; continue; }
    const me=prioOf(s,v);
    if(s.net){ const info=(s.net.stp(v)||{})[s.devName]; if(info){ const iAm=info.rootName===s.devName;
      o+="\nVLAN"+String(v).padStart(4,"0")+"\n  Spanning tree enabled protocol "+(s.stpMode==="rapid-pvst"?"rstp":"ieee")+"\n  Root ID    Priority    "+info.root.p+"\n             Address     "+info.root.mac+"\n"+(iAm?"             This bridge is the root\n":"             Cost        "+info.cost+"\n             Port        "+(info.rootPort?longIf(info.rootPort):"-")+"\n")+"             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n\n  Bridge ID  Priority    "+me+"  (priority "+(me-v)+" sys-id-ext "+v+")\n             Address     "+s.mac+"\n\nInterface           Role Sts Cost      Prio.Nbr Type\n------------------- ---- --- --------- -------- --------------------------------\n";
      for(const i of stpPorts(s,v)){
        const rs=info.roles[i.name]||["Desg","FWD"]; const pid=stpPortId(s,i.name); const bk=rs[1]==="BKN"; o+=i.name.padEnd(20)+rs[0]+" "+(bk?"BKN*":rs[1])+(bk?"":" ")+String(info.costs[i.name]||stpPortCost(s,i.name)).padEnd(10)+(pid.pr+"."+pid.num).padEnd(9)+"P2p"+((i.portfast||(s.portfastDefault&&!operTrunk(i)))?" Edge":"")+(bk?" *ROOT_Inc":"")+"\n"; }
      continue; } }
    const otherRoot=32768+v; const iAmRoot=me<otherRoot;
    o+="\nVLAN"+String(v).padStart(4,"0")+"\n  Spanning tree enabled protocol "+(s.stpMode==="rapid-pvst"?"rstp":s.stpMode==="mst"?"mstp":"ieee")+"\n  Root ID    Priority    "+(iAmRoot?me:otherRoot)+"\n             Address     "+(iAmRoot?s.mac:"0001.4321.aaaa")+"\n"+(iAmRoot?"             This bridge is the root\n":"             Cost        4\n             Port        25 (GigabitEthernet0/1)\n")+"             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n\n  Bridge ID  Priority    "+me+"  (priority "+(me-v)+" sys-id-ext "+v+")\n             Address     "+s.mac+"\n\nInterface           Role Sts Cost      Prio.Nbr Type\n------------------- ---- --- --------- -------- --------------------------------\n";
    for(const i of Object.values(s.ifs).filter(p=>isPhys(p.name)&&!p.shutdown&&p.connected&&p.switchport&&(operTrunk(p)?(!p.allowed||p.allowed.includes(v)):p.accessVlan===v))){
      const role=iAmRoot?"Desg":(i.name==="Gi0/1"?"Root":"Desg"); o+=i.name.padEnd(20)+role+" FWD "+(i.name.startsWith("Gi")?"4":"19").padEnd(10)+"128."+(i.name.startsWith("Gi")?24+Number(i.name.split("/")[1]):Number(i.name.split("/")[1])).toString().padEnd(5)+"P2p"+((i.portfast||(s.portfastDefault&&!operTrunk(i)))?" Edge":"")+"\n"; }
  }
  return o;
}
function showSsh(s){ return s.rsaBits? "SSH Enabled - version "+(s.sshVer===2||(!s.sshVer&&s.rsaBits>=768)?(s.sshVer===2?"2.0":"1.99"):"1.5")+"\nAuthentication timeout: 120 secs; Authentication retries: 3\nMinimum expected Diffie Hellman key size : 1024 bits\nIOS Keys in SECSH format(ssh-rsa, base64 encoded): ...":"SSH Disabled - version 1.99\n%Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2)."; }
function showRoute(s,only){ if(!s.ipRouting) return s.defaultGw? "Default gateway is "+s.defaultGw+"\n\nHost               Gateway           Last Use    Total Uses  Interface\nICMP redirect cache is empty":"Default gateway is not set\n\nHost               Gateway           Last Use    Total Uses  Interface\nICMP redirect cache is empty";
  const conn=Object.values(s.ifs).filter(x=>x.ip&&ifStatus(s,x)[1]==="up").map(i=>n2ipT((ipToN(i.ip)&ipToN(i.mask))>>>0)+"/"+i.mask);
  const sr=activeStatics(s).filter(r=>!conn.includes(r.net+"/"+r.mask)); const orts=(s.net&&s.ospf?s.net.ospfRoutes(s.devName):[]).filter(r=>!conn.includes(r.net+"/"+r.mask)&&!sr.some(x=>x.net===r.net&&x.mask===r.mask&&x.ad<=110));
  const odef=orts.find(r=>r.mask==="0.0.0.0"); const def=sr.find(r=>r.mask==="0.0.0.0");
  let o="Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP\n       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area\n       * - candidate default\n\nGateway of last resort is "+(def?(def.nh||longIf(def.ifc))+" to network 0.0.0.0":odef?odef.hops[0].nh+" to network 0.0.0.0":"not set")+"\n\n";
  if(only==="O"||!only) for(const r of orts) o+=(r.mask==="0.0.0.0"?"O*E2     ":"O        ")+r.net+"/"+maskLen(r.mask)+" ["+(r.mask==="0.0.0.0"?"110/1":"110/"+r.cost)+"] via "+r.hops[0].nh+", 00:05:12, "+longIf(r.hops[0].ifn)+"\n"+r.hops.slice(1).map(h=>" ".repeat(9+(r.net+"/"+maskLen(r.mask)).length+1)+"[110/"+r.cost+"] via "+h.nh+", 00:05:12, "+longIf(h.ifn)+"\n").join("");
  if(only==="O") return o;
  if(only!=="C") for(const r of sr) o+=(r.mask==="0.0.0.0"?"S*       ":"S        ")+r.net+"/"+maskLen(r.mask)+" ["+r.ad+"/0]"+(r.nh?" via "+r.nh:" is directly connected, "+longIf(r.ifc))+"\n";
  if(only==="S") return o;
  for(const i of Object.values(s.ifs).filter(x=>x.ip&&ifStatus(s,x)[1]==="up").sort((a,b)=>ipToN(a.ip)-ipToN(b.ip))){ const m=ipToN(i.mask), net=(ipToN(i.ip)&m)>>>0; const ns=[net>>>24,(net>>>16)&255,(net>>>8)&255,net&255].join("."); o+="C        "+ns+"/"+maskLen(i.mask)+" is directly connected, "+longIf(i.name)+"\nL        "+i.ip+"/32 is directly connected, "+longIf(i.name)+"\n"; }
  return o;
}
function activeStatics(s){ // статичні маршрути, що потрапляють у таблицю
  const conn=Object.values(s.ifs).filter(x=>x.ip&&ifStatus(s,x)[1]==="up");
  const inConn=ip=>conn.some(c=>((ipToN(ip)&ipToN(c.mask))>>>0)===((ipToN(c.ip)&ipToN(c.mask))>>>0));
  const ok=s.routes.filter(r=>r.ifc? (s.ifs[r.ifc]&&ifStatus(s,s.ifs[r.ifc])[1]==="up") : inConn(r.nh));
  // floating: для того ж префікса лишаємо найменшу AD
  const best={}; for(const r of ok){ const k=r.net+"/"+r.mask; if(!best[k]||r.ad<best[k][0].ad) best[k]=[r]; else if(r.ad===best[k][0].ad) best[k].push(r); }
  return Object.values(best).flat();
}
function runIf(s,i){
  const L=[]; L.push("interface "+longIf(i.name)); if(i.desc) L.push(" description "+i.desc);
  if(i.svi||i.loop){ L.push(i.ip?" ip address "+i.ip+" "+i.mask:" no ip address"); L.push(...l3extra(i)); if(i.shutdown) L.push(" shutdown"); return L; }
  if(i.sub){ if(i.encap) L.push(" encapsulation dot1Q "+i.encap+(i.native?" native":"")); L.push(i.ip?" ip address "+i.ip+" "+i.mask:" no ip address"); L.push(...l3extra(i)); if(i.shutdown) L.push(" shutdown"); return L; }
  if(!i.switchport){ if(!s.router) L.push(" no switchport"); L.push(i.ip?" ip address "+i.ip+" "+i.mask:" no ip address"); L.push(...l3extra(i)); }
  else{
    if(i.accessVlan!==1) L.push(" switchport access vlan "+i.accessVlan);
    if(i.nativeVlan!==1) L.push(" switchport trunk native vlan "+i.nativeVlan);
    if(i.allowed) L.push(" switchport trunk allowed vlan "+fmtList(i.allowed));
    if(i.mode!=="dynamic auto") L.push(" switchport mode "+i.mode);
    if(i.nonegotiate) L.push(" switchport nonegotiate");
    if(i.voiceVlan) L.push(" switchport voice vlan "+i.voiceVlan);
    L.push(...secRunIf(s,i)); L.push(...v2RunIf(s,i));
  }
  if(i.chGroup) L.push(" channel-group "+i.chGroup+" mode "+i.chMode);
  if(i.speed!=="auto") L.push(" speed "+i.speed); if(i.duplex!=="auto") L.push(" duplex "+i.duplex);
  if(i.portfast) L.push(" spanning-tree portfast"); if(i.bpduguard) L.push(" spanning-tree bpduguard enable");
  if(i.shutdown&&!i.errdis) L.push(" shutdown"); return L;
}
function showRunIf(s,n){ const i=s.ifs[n]; if(!i) return INV; return "Building configuration...\n\nCurrent configuration : 120 bytes\n!\n"+runIf(s,i).join("\n")+"\nend"; }
function showRun(s){
  const L=["Building configuration...","","Current configuration : 2048 bytes","!","version 15.0","no service pad",(s.servicePwEnc?"":"no ")+"service password-encryption","!","hostname "+s.hostname,"!"];
  if(s.enableSecret) L.push("enable secret 5 $1$mERr$hx5rVt7rPNoS4wqbXKX7m0","!");
  for(const [u,v] of Object.entries(s.users)) L.push("username "+u+(v.priv?" privilege "+v.priv:"")+(v.secret?" secret 5 $1$p1Kd$Vq9rPNoS4wqbXKX7m0":" password 0 ******"));
  if(Object.keys(s.users).length) L.push("!");
  if(s.noDomainLookup) L.push("no ip domain-lookup"); if(s.domain) L.push("ip domain-name "+s.domain); if(s.ipRouting) L.push("ip routing"); if(s.sshVer) L.push("ip ssh version "+s.sshVer);
  for(const [a,b] of s.dhcp.excl) L.push("ip dhcp excluded-address "+a+(b!==a?" "+b:""));
  for(const p of Object.values(s.dhcp.pools)){ L.push("!","ip dhcp pool "+p.name); if(p.net) L.push(" network "+p.net+" "+p.mask); if(p.gw) L.push(" default-router "+p.gw); if(p.opt43) L.push(" option 43 hex "+p.opt43.replace(/(.{4})(?=.)/g,"$1.")); if(p.dns) L.push(" dns-server "+p.dns); if(p.domain) L.push(" domain-name "+p.domain); }
  { const g=secRunGlobal(s).concat(v2RunGlobal(s),qosRunGlobal(s)); if(g.length) L.push("!",...g); }
  if(!s.router) L.push("!","spanning-tree mode "+s.stpMode); else L.push("!"); if(s.portfastDefault) L.push("spanning-tree portfast default"); if(s.bpduguardDefault) L.push("spanning-tree portfast bpduguard default"); L.push("spanning-tree extend system-id");
  for(const [v,p] of Object.entries(s.stpPrio)) L.push("spanning-tree vlan "+v+" priority "+p);
  if(s.lb!=="src-mac") L.push("port-channel load-balance "+s.lb);
  L.push("!");
  const ifs=Object.values(s.ifs).sort((a,b)=>{const o=x=>x.name.startsWith("Po")?0:x.svi?2:1; return o(a)-o(b)||a.name.localeCompare(b.name,undefined,{numeric:true});});
  for(const i of ifs){ L.push(...runIf(s,i),"!"); }
  if(s.ospf){ const o=s.ospf; L.push("router ospf "+o.pid); if(o.rid) L.push(" router-id "+o.rid); if(o.refbw!==100) L.push(" auto-cost reference-bandwidth "+o.refbw);
    if(o.passiveDefault){ L.push(" passive-interface default"); for(const n of o.nonPassive) L.push(" no passive-interface "+longIf(n)); } else for(const n of o.passive) L.push(" passive-interface "+longIf(n));
    for(const n of o.nets) L.push(" network "+n.net+" "+n.wild+" area "+n.area); if(o.defOrig) L.push(" default-information originate"+(o.defAlways?" always":"")); L.push("!"); }
  for(const [n,p] of Object.entries(s.nat.pools)) L.push("ip nat pool "+n+" "+p.start+" "+p.end+" netmask "+p.mask);
  for(const d of s.nat.dyn) L.push("ip nat inside source list "+d.acl+(d.pool?" pool "+d.pool:" interface "+longIf(d.ifc))+(d.overload?" overload":""));
  for(const x of s.nat.statics) L.push("ip nat inside source static "+x.local+" "+x.global);
  { const sv=svcRun(s); if(sv.length) L.push(...sv,"!"); }
  if(s.v6routing) L.push("ipv6 unicast-routing","!"); for(const r of s.routes6||[]) L.push("ipv6 route "+r.pfx+"/"+r.len+(r.ifc?" "+longIf(r.ifc):"")+(r.nh?" "+r.nh:"")+(r.ad>1?" "+r.ad:""));
  if(s.defaultGw) L.push("ip default-gateway "+s.defaultGw,"!");
  for(const r of s.routes) L.push("ip route "+r.net+" "+r.mask+(r.ifc?" "+longIf(r.ifc):"")+(r.nh?" "+r.nh:"")+(r.ad&&r.ad!==1?" "+r.ad:""));
  if(s.routes.length) L.push("!");
  for(const [n,acl] of Object.entries(s.acls)){ if(acl.named){ L.push("ip access-list "+(acl.type==="std"?"standard":"extended")+" "+n); for(const r of acl.rules) L.push(" "+aceText(acl,r,true)); } else for(const r of acl.rules) L.push("access-list "+n+" "+aceText(acl,r,true)); L.push("!"); }
  L.push("line con 0"); if(s.con.password) L.push(" password "+s.con.password); if(s.con.login) L.push(s.con.login==="local"?" login local":" login");
  L.push("line vty 0 15"); if(s.vty.execTimeout) L.push(" exec-timeout "+s.vty.execTimeout.join(" ")); if(s.vty.authList) L.push(" login authentication "+s.vty.authList); if(s.vty.password) L.push(" password "+s.vty.password); if(s.vty.login) L.push(s.vty.login==="local"?" login local":" login"); if(s.vty.acl) L.push(" access-class "+s.vty.acl+" in"); if(s.vty.transport!=="all") L.push(" transport input "+s.vty.transport);
  L.push("!","end"); return L.join("\n");
}

// ---------- Сесія терміналу ----------
function promptOf(ctx,s){ if(ctx.mode==="rtr6") return s.hostname+"(config-rtr)#"; if(ctx.mode==="tacsrv") return s.hostname+"(config-server-tacacs)#"; if(ctx.mode==="radsrv") return s.hostname+"(config-radius-server)#"; if(ctx.mode==="raguard") return s.hostname+"(config-ra-guard)#"; if(ctx.mode==="cmap") return s.hostname+"(config-cmap)#"; if(ctx.mode==="pmap") return s.hostname+"(config-pmap)#"; if(ctx.mode==="pmapc") return s.hostname+"(config-pmap-c)#"; const h=s.hostname; return {user:h+">",exec:h+"#",config:h+"(config)#",if:h+(ctx.ifs&&ctx.ifs.length>1?"(config-if-range)#":"(config-if)#"),vlan:h+"(config-vlan)#",line:h+"(config-line)#",router:h+"(config-router)#",acl:h+(ctx.aclType==="ext"?"(config-ext-nacl)#":"(config-std-nacl)#"),dhcp:h+"(dhcp-config)#",dhcp6:h+"(config-dhcpv6)#"}[ctx.mode]; }
function Session(state){
  const ctx={mode:"user",ifs:null,vlan:null,line:null,history:[],prompt:null};
  ctx.runIn=(mode,line)=>{ const pm=pipeOf(line); if(pm){ const o=ctx.runIn(mode,pm[0]); return /^\s*% /.test(o)||/\^\n%/.test(o)? o : pipeFilter(o,pm[1],pm[2]); } const r=matchMode(mode,line); if(r.err) return r.err; if(r.empty) return ""; const save=ctx.mode; const out=r.hit.c.fn(state,r.hit.args,ctx); ctx.mode=save; return out||""; };
  const api={
    state, ctx,
    prompt(){ return ctx.prompt? ctx.prompt.text : promptOf(ctx,state); },
    exec(line){
      if(ctx.prompt){ const p=ctx.prompt; ctx.prompt=null; return p.fn(line.trim())||""; }
      if(!line.trim()) return "";
      ctx.history.push(line.trim());
      if(/\?\s*$/.test(line)){ return help(ctx.mode,line); }
      { const pm=pipeOf(line); if(pm){ ctx.history.pop(); const o=api.exec(pm[0]); return /^\s*% /.test(o)||/\^\n%/.test(o)? o : pipeFilter(o,pm[1],pm[2]); } }
      ctxPromptLen=promptOf(ctx,state).length;
      let r=matchMode(ctx.mode,line);
      // глобальні команди доступні з підрежимів (як в IOS)
      if(r.err && ["if","vlan","line","router","acl","dhcp","dhcp6","rtr6","tacsrv","radsrv","raguard","cmap","pmap","pmapc"].includes(ctx.mode)){ const r2=matchMode("config",line); if(r2.hit){ if(r2.hit.c.p[0]!=="do") ctx.mode="config"; r=r2; } }
      if(r.err && ctx.mode==="exec" && /^\s*conf/i.test(line)===false){ /* лишаємо помилку */ }
      if(r.empty) return ""; if(r.err) return r.err;
      const out=r.hit.c.fn(state,r.hit.args,ctx);
      return out||"";
    }
  };
  return api;
}
function pipeOf(line){ const m=line.match(/^(.*?\S)\s*\|\s*(include|includ|inclu|incl|inc|in|i|exclude|exclud|exclu|excl|exc|ex|e|begin|begi|beg|be|b|section|sectio|secti|sect|sec|se|s|count|coun|cou|co)\s+(.+)$/i);
  if(!m||!/^\s*(do\s+)?(sh|sho|show|more)\b/i.test(m[1])) return null; return [m[1],m[2].toLowerCase(),m[3].trim()]; }
function pipeFilter(out,op,pat){ let re; try{ re=new RegExp(pat.replace(/^"|"$/g,""),"i"); }catch(e){ re=new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"); }
  const L=String(out).split("\n");
  if(op[0]==="i") return L.filter(l=>re.test(l)).join("\n");
  if(op[0]==="e") return L.filter(l=>!re.test(l)).join("\n");
  if(op[0]==="b"){ const k=L.findIndex(l=>re.test(l)); return k<0?"":L.slice(k).join("\n"); }
  if(op.startsWith("co")) return "Number of lines which match regexp = "+L.filter(l=>re.test(l)).length;
  const R=[]; for(let k=0;k<L.length;k++){ if(/^\S/.test(L[k])&&re.test(L[k])){ R.push(L[k]); while(k+1<L.length&&/^\s/.test(L[k+1])&&L[k+1].trim()){ k++; R.push(L[k]); } } else if(/^\s/.test(L[k])&&re.test(L[k])) R.push(L[k]); }
  return R.join("\n"); }

// ---------- Сценарії ----------
const has=(s,v,name)=>s.vlans[v]&&(!name||s.vlans[v].name.toLowerCase()===name.toLowerCase());
const rng=(pre,a,b)=>Array.from({length:b-a+1},(_,k)=>pre+(a+k));
const same=(arr,want)=>arr&&JSON.stringify(arr.slice().sort((a,b)=>a-b))===JSON.stringify(want);
const SCEN=[
 {id:"lab-vlan",t:"SRWE3",title:"VLAN і access-порти",
  task:["Створіть VLAN 10 з назвою Users і VLAN 20 з назвою Admin.","Fa0/1–Fa0/5 — access-порти у VLAN 10.","Fa0/6–Fa0/10 — access-порти у VLAN 20.","Збережіть конфігурацію."],
  check:s=>[[has(s,10,"Users"),"VLAN 10 «Users» існує"],[has(s,20,"Admin"),"VLAN 20 «Admin» існує"],
    [rng("Fa0/",1,5).every(n=>s.ifs[n].mode==="access"&&s.ifs[n].accessVlan===10),"Fa0/1–5: mode access, VLAN 10"],
    [rng("Fa0/",6,10).every(n=>s.ifs[n].mode==="access"&&s.ifs[n].accessVlan===20),"Fa0/6–10: mode access, VLAN 20"],
    [!!s.saved,"Конфігурацію збережено (copy run start)"]],
  sol:"enable\nconf t\nvlan 10\n name Users\nvlan 20\n name Admin\nexit\ninterface range fa0/1 - 5\n switchport mode access\n switchport access vlan 10\ninterface range fa0/6 - 10\n switchport mode access\n switchport access vlan 20\nend\ncopy run start",
  connected:["Fa0/1","Fa0/6","Gi0/1"]},
 {id:"lab-trunk",t:"SRWE3",title:"Trunk з native VLAN 99",
  vlans:{10:"Users",20:"Admin"},
  task:["Створіть VLAN 99 з назвою Native.","Gi0/1 — trunk (статично) з native VLAN 99.","Дозвольте на trunk-у лише VLAN 10, 20 і 99.","Вимкніть DTP на Gi0/1.","Перевірте командою show interfaces trunk."],
  check:s=>{const g=s.ifs["Gi0/1"]; return [[has(s,99,"Native"),"VLAN 99 «Native» існує"],[g.mode==="trunk","Gi0/1: switchport mode trunk"],[g.nativeVlan===99,"Native VLAN 99"],[same(g.allowed,[10,20,99]),"Allowed VLAN: 10,20,99"],[g.nonegotiate,"DTP вимкнено (switchport nonegotiate)"]];},
  sol:"enable\nconf t\nvlan 99\n name Native\nexit\ninterface gi0/1\n switchport mode trunk\n switchport trunk native vlan 99\n switchport trunk allowed vlan 10,20,99\n switchport nonegotiate\nend\nshow interfaces trunk",
  connected:["Gi0/1"]},
 {id:"lab-voice",t:"SRWE3",title:"Порт для IP-телефону",
  vlans:{20:"Data"},
  task:["Створіть VLAN 150 з назвою Voice.","Fa0/18 — access-порт: дані у VLAN 20, голос у VLAN 150.","Перевірте show interfaces fa0/18 switchport."],
  check:s=>{const i=s.ifs["Fa0/18"]; return [[has(s,150,"Voice"),"VLAN 150 «Voice» існує"],[i.mode==="access","Fa0/18: switchport mode access"],[i.accessVlan===20,"Access VLAN 20"],[i.voiceVlan===150,"Voice VLAN 150"]];},
  sol:"enable\nconf t\nvlan 150\n name Voice\nexit\ninterface fa0/18\n switchport mode access\n switchport access vlan 20\n switchport voice vlan 150\nend",
  connected:["Fa0/18"]},
 {id:"lab-mgmt",t:"SRWE1",title:"SVI для керування",
  vlans:{99:"Management"},
  task:["Задайте hostname S1-MGMT.","SVI VLAN 99: 192.168.99.11/24, увімкнений.","Шлюз за замовчуванням 192.168.99.1.","Fa0/24 — access-порт у VLAN 99 (до нього підключено адмін-ПК).","Перевірте show ip interface brief: Vlan99 має бути up/up."],
  check:s=>{const v=s.ifs["Vlan99"]||{}; return [[s.hostname==="S1-MGMT","hostname S1-MGMT"],[v.ip==="192.168.99.11"&&v.mask==="255.255.255.0","Vlan99: 192.168.99.11 255.255.255.0"],[v.ip&&!v.shutdown,"Vlan99: no shutdown"],[s.defaultGw==="192.168.99.1","ip default-gateway 192.168.99.1"],[s.ifs["Fa0/24"].mode==="access"&&s.ifs["Fa0/24"].accessVlan===99,"Fa0/24: access VLAN 99"]];},
  sol:"enable\nconf t\nhostname S1-MGMT\ninterface vlan 99\n ip address 192.168.99.11 255.255.255.0\n no shutdown\nexit\nip default-gateway 192.168.99.1\ninterface fa0/24\n switchport mode access\n switchport access vlan 99\nend\nshow ip interface brief",
  connected:["Fa0/24"]},
 {id:"lab-ssh",t:"SRWE1",title:"Віддалений доступ лише через SSH v2",
  hostname:"Switch",
  task:["Hostname S1, домен ccna.lab.","Згенеруйте RSA-ключ 1024 біт або більше.","Локальний користувач admin з secret-паролем.","VTY 0–15: лише SSH, автентифікація через локальну базу.","Увімкніть SSH версії 2."],
  check:s=>[[s.hostname==="S1","hostname S1"],[s.domain==="ccna.lab","ip domain-name ccna.lab"],[s.rsaBits>=1024,"RSA-ключ ≥ 1024 біт"],[s.users.admin&&s.users.admin.secret,"username admin secret …"],[s.vty.transport==="ssh","transport input ssh"],[s.vty.login==="local","login local"],[s.sshVer===2,"ip ssh version 2"]],
  sol:"enable\nconf t\nhostname S1\nip domain-name ccna.lab\ncrypto key generate rsa\n1024\nusername admin secret Cisco123\nline vty 0 15\n transport input ssh\n login local\nexit\nip ssh version 2\nend\nshow ip ssh"},
 {id:"lab-ec",t:"SRWE6",title:"LACP EtherChannel trunk",
  vlans:{10:"Users",20:"Admin",99:"Native"},
  task:["Об'єднайте Gi0/1 і Gi0/2 у групу 1 через LACP (S1 ініціює).","Port-channel 1 — trunk, native VLAN 99, дозволені VLAN 10, 20, 99.","Перевірте show etherchannel summary: Po1(SU), порти (P)."],
  check:s=>{const g1=s.ifs["Gi0/1"],g2=s.ifs["Gi0/2"],po=s.ifs["Po1"]||{}; return [[g1.chGroup===1&&g2.chGroup===1,"Gi0/1–2 у channel-group 1"],[g1.chMode==="active"&&g2.chMode==="active","Режим LACP active"],[po.mode==="trunk","Po1: switchport mode trunk"],[po.nativeVlan===99,"Po1: native VLAN 99"],[same(po.allowed,[10,20,99]),"Po1: allowed 10,20,99"],
    [[g1,g2].every(g=>g.mode===po.mode&&g.nativeVlan===po.nativeVlan&&JSON.stringify(g.allowed)===JSON.stringify(po.allowed)),"Налаштування портів-членів збігаються з Po1 (немає suspended)"]];},
  sol:"enable\nconf t\ninterface range gi0/1 - 2\n channel-group 1 mode active\nexit\ninterface port-channel 1\n switchport mode trunk\n switchport trunk native vlan 99\n switchport trunk allowed vlan 10,20,99\nend\nshow etherchannel summary",
  connected:["Gi0/1","Gi0/2"]},
 {id:"lab-edge",t:"SRWE5",title:"PortFast і BPDU Guard на access-портах",
  vlans:{10:"Users"},
  task:["Fa0/1–Fa0/24 — access-порти у VLAN 10.","Увімкніть на них PortFast.","Увімкніть на них BPDU Guard.","Uplink Gi0/1 не чіпайте."],
  check:s=>{const fa=rng("Fa0/",1,24).map(n=>s.ifs[n]); return [[fa.every(i=>i.mode==="access"&&i.accessVlan===10),"Fa0/1–24: access VLAN 10"],[fa.every(i=>i.portfast)||(s.portfastDefault&&fa.every(i=>i.mode==="access")),"PortFast на Fa0/1–24"],[fa.every(i=>i.bpduguard)||(s.bpduguardDefault&&(fa.every(i=>i.portfast)||s.portfastDefault)),"BPDU Guard на Fa0/1–24"],[!s.ifs["Gi0/1"].portfast,"Gi0/1 без PortFast"]];},
  sol:"enable\nconf t\ninterface range fa0/1 - 24\n switchport mode access\n switchport access vlan 10\n spanning-tree portfast\n spanning-tree bpduguard enable\nend",
  connected:["Fa0/1","Fa0/2","Gi0/1"]},
 {id:"lab-root",t:"SRWE5",title:"Root bridge і Rapid PVST+",
  vlans:{10:"Users",20:"Admin"},
  task:["Увімкніть Rapid PVST+.","Зробіть S1 root bridge для VLAN 10 (пріоритет 24576 або нижче).","Зробіть S1 резервним root для VLAN 20 (пріоритет 28672).","Перевірте show spanning-tree vlan 10."],
  check:s=>[[s.stpMode==="rapid-pvst","spanning-tree mode rapid-pvst"],[(s.stpPrio[10]??32768)<=24576,"VLAN 10: пріоритет ≤ 24576"],[s.stpPrio[20]===28672,"VLAN 20: пріоритет 28672 (root secondary)"]],
  sol:"enable\nconf t\nspanning-tree mode rapid-pvst\nspanning-tree vlan 10 root primary\nspanning-tree vlan 20 root secondary\nend\nshow spanning-tree vlan 10",
  connected:["Gi0/1","Fa0/1"]},
 {id:"lab-l3",t:"SRWE4",title:"Маршрутизація між VLAN на L3-комутаторі",
  l3:true, hostname:"DLS1", vlans:{10:"Users",20:"Admin"},
  task:["Увімкніть маршрутизацію IPv4.","SVI VLAN 10: 192.168.10.1/24, SVI VLAN 20: 192.168.20.1/24, обидва увімкнені.","Gi0/1 — routed port 10.0.0.1/30 до маршрутизатора.","Перевірте show ip route: мають бути маршрути C і L."],
  check:s=>{const v10=s.ifs.Vlan10||{},v20=s.ifs.Vlan20||{},g=s.ifs["Gi0/1"]; return [[s.ipRouting,"ip routing"],[v10.ip==="192.168.10.1"&&v10.mask==="255.255.255.0"&&!v10.shutdown,"Vlan10: 192.168.10.1/24, no shutdown"],[v20.ip==="192.168.20.1"&&v20.mask==="255.255.255.0"&&!v20.shutdown,"Vlan20: 192.168.20.1/24, no shutdown"],[!g.switchport,"Gi0/1: no switchport"],[g.ip==="10.0.0.1"&&g.mask==="255.255.255.252","Gi0/1: 10.0.0.1 255.255.255.252"]];},
  sol:"enable\nconf t\nip routing\ninterface vlan 10\n ip address 192.168.10.1 255.255.255.0\n no shutdown\ninterface vlan 20\n ip address 192.168.20.1 255.255.255.0\n no shutdown\ninterface gi0/1\n no switchport\n ip address 10.0.0.1 255.255.255.252\nend\nshow ip route",
  connected:["Fa0/1","Fa0/2","Gi0/1"], setup:s=>{s.ifs["Fa0/1"].mode="access";s.ifs["Fa0/1"].accessVlan=10;s.ifs["Fa0/2"].mode="access";s.ifs["Fa0/2"].accessVlan=20;}},
 {id:"lab-fix",t:"SRWE3",title:"Знайди й виправ: trunk і VLAN",
  vlans:{10:"Users",20:"Admin",99:"Native"},
  task:["Скарга: ПК у VLAN 20 на S1 і S2 не бачать одне одного, у журналі — повідомлення про native VLAN mismatch, а ПК на Fa0/3 (має бути у VLAN 20) взагалі без зв'язку.","На S2 trunk Gi0/1: native VLAN 99, дозволені 10,20,99.","Знайдіть і виправте всі проблеми на S1 за допомогою show-команд."],
  setup:s=>{const g=s.ifs["Gi0/1"]; g.mode="trunk"; g.nativeVlan=1; g.allowed=[10,99]; s.ifs["Fa0/3"].mode="access"; s.ifs["Fa0/3"].accessVlan=1; s.ifs["Fa0/2"].mode="access"; s.ifs["Fa0/2"].accessVlan=20; s.ifs["Fa0/1"].mode="access"; s.ifs["Fa0/1"].accessVlan=10;},
  check:s=>{const g=s.ifs["Gi0/1"]; return [[g.mode==="trunk","Gi0/1 лишається trunk"],[g.nativeVlan===99,"Native VLAN 99 (як на S2)"],[same(g.allowed,[10,20,99])||g.allowed===null,"VLAN 20 дозволено на trunk-у"],[s.ifs["Fa0/3"].mode==="access"&&s.ifs["Fa0/3"].accessVlan===20,"Fa0/3 у VLAN 20"]];},
  sol:"enable\nshow interfaces trunk\nshow vlan brief\nconf t\ninterface gi0/1\n switchport trunk native vlan 99\n switchport trunk allowed vlan add 20\ninterface fa0/3\n switchport access vlan 20\nend",
  connected:["Fa0/1","Fa0/2","Fa0/3","Gi0/1"]}
];
function startScenario(sc){
  const st=newState({hostname:sc.hostname||"S1",l3:sc.l3,vlans:sc.vlans,setup:sc.setup});
  (sc.connected||[]).forEach(n=>{ if(st.ifs[n]) st.ifs[n].connected=true; });
  return Session(st);
}

// =====================================================================
// Мережа з кількох пристроїв: комутатори, маршрутизатори, ПК, лінки.
// =====================================================================
const n2ip=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join(".");
const sameNet=(a,b,mask)=>((ipToN(a)&ipToN(mask))>>>0)===((ipToN(b)&ipToN(mask))>>>0);
function Net(def){
  const N={dev:{}, links:[], logs:[], seenMsgs:new Set()};
  const isHost=d=>d&&(d.type==="pc"||d.type==="server");
  for(const [name,d] of Object.entries(def.devices)){
    if(d.type==="hub") N.dev[name]={name,type:"hub",ifs:{}};
    else if(d.type==="pc"||d.type==="server") N.dev[name]={name,type:d.type,ip:d.ip||null,mask:d.mask||null,gw:d.gw||null,port:"Fa0",dhcp:!!d.dhcp,services:d.services||(d.type==="server"?[80]:[]),ip6:d.ip6||null,slaac:!!d.slaac,dns:d.dns||null,zone:d.zone?JSON.parse(JSON.stringify(d.zone)):null,aaa:d.aaa||null,storm:!!d.storm};
    else { const st=newState({hostname:name,router:d.type==="router",l3:d.l3||d.type==="router",vlans:d.vlans,setup:d.setup}); st.net=N; st.devName=name; st.type=d.type; if(d.mac) st.mac=d.mac; N.dev[name]=st; }
  }
  for(const [a,pa,b,pb] of def.links){ N.links.push({a,pa,b,pb}); for(const [d,p] of [[a,pa],[b,pb]]){ const x=N.dev[d]; if(!isHost(x)&&x.ifs[p]) x.ifs[p].connected=true; } }
  N.peer=(dev,port)=>{ for(const l of N.links){ if(l.a===dev&&l.pa===port) return {dev:l.b,port:l.pb}; if(l.b===dev&&l.pb===port) return {dev:l.a,port:l.pa}; } return null; };
  const isSw=d=>d&&d.type==="switch";
  const eff=(sw,p)=>{ const i=sw.ifs[p]; if(i&&i.chGroup&&sw.ifs["Po"+i.chGroup]) return Object.assign({},sw.ifs["Po"+i.chGroup],{shutdown:i.shutdown||i._ec==="s"||i._ec==="D",connected:i.connected,name:p,_oper:i._oper,errdis:i.errdis}); return i; };
  // кінцеві MAC-адреси «за» портом комутатора (хост, хаб із хостами або інтерфейс сусіда) — для port-security
  const behind=(dn,p)=>{ const out=[], seen=new Set(); const walk=(dev,port)=>{ const pr=N.peer(dev,port); if(!pr) return; const od=N.dev[pr.dev]; if(!od) return;
      if(isHost(od)){ out.push({mac:macOf(pr.dev,"Fa0"),host:pr.dev}); return; }
      if(od.type==="hub"){ if(seen.has(pr.dev)) return; seen.add(pr.dev); for(const l of N.links){ const op=l.a===pr.dev?l.pa:l.b===pr.dev?l.pb:null; if(op&&op!==pr.port) walk(pr.dev,op); } return; }
      const oi=od.ifs[pr.port]; if(oi&&!oi.shutdown) out.push({mac:macOf(pr.dev,pr.port),host:pr.dev}); };
    walk(dn,p); return out.sort((a,b)=>a.host.localeCompare(b.host)); };
  // ---------- DTP: операційний режим портів ----------
  N.recompute=()=>{
    for(const l of N.links){ const A=N.dev[l.a], B=N.dev[l.b]; const ia=A.ifs&&A.ifs[l.pa], ib=B.ifs&&B.ifs[l.pb]; if(ia) ia.peerDown=!!(ib&&ib.shutdown); if(ib) ib.peerDown=!!(ia&&ia.shutdown); }
    for(const d of Object.values(N.dev)) if(!isHost(d)) for(const i of Object.values(d.ifs)) delete i._oper;
    // ---------- EtherChannel: узгодження PAgP / LACP / on і сумісність портів ----------
    const ecMsgs=[];
    const ecCompat=(a,b)=>{ if(!a||!b) return false; if(a==="on"||b==="on") return a==="on"&&b==="on"; const L=["active","passive"], P=["desirable","auto"];
      if(L.includes(a)&&L.includes(b)) return a==="active"||b==="active"; if(P.includes(a)&&P.includes(b)) return a==="desirable"||b==="desirable"; return false; };
    const ecDiff=(i,ref,first)=>{ if(i.mode!==ref.mode) return "trunk mode of the port is different"; if(i.mode!=="trunk"&&i.accessVlan!==ref.accessVlan) return "access vlan is different"; if(i.nativeVlan!==ref.nativeVlan) return "native vlan is different";
      if(JSON.stringify(i.allowed||null)!==JSON.stringify(ref.allowed||null)) return "vlan mask is different"; if(first&&(i.speed||"auto")!==(first.speed||"auto")) return "speed is different"; if(first&&(i.duplex||"auto")!==(first.duplex||"auto")) return "duplex is different"; return null; };
    const ecGroups=[];
    for(const d of Object.values(N.dev)){ if(!isSw(d)) continue; const groups={};
      for(const i of Object.values(d.ifs)){ delete i._ec; delete i._ecPeer; delete i._ecWhy; if(isPhys(i.name)&&i.chGroup) (groups[i.chGroup]=groups[i.chGroup]||[]).push(i); }
      for(const [g,mem] of Object.entries(groups)){ const po=d.ifs["Po"+g]||mem[0]; const first=mem.find(x=>!x.shutdown)||mem[0];
        for(const i of mem){ const pr=N.peer(d.devName,i.name); const od=pr&&N.dev[pr.dev]; const oi=od&&od.ifs?od.ifs[pr.port]:null;
          if(oi&&isSw(od)) i._ecPeer={dev:pr.dev,port:pr.port,mode:oi.chMode,group:oi.chGroup,mac:od.mac};
          if(i.shutdown||!i.connected||!oi||oi.shutdown){ i._ec="D"; continue; }
          const diff=ecDiff(i,po,first===i?null:first); if(diff){ i._ec="s"; i._ecWhy=diff; ecMsgs.push([d.devName,"%EC-5-CANNOT_BUNDLE2: "+i.name+" is not compatible with "+(first===i?"Po"+g:first.name)+" and will be suspended ("+diff+")"]); continue; }
          if(!isSw(od)||!oi.chGroup||!ecCompat(i.chMode,oi.chMode)){ i._ec="I"; i._ecWhy=!isSw(od)?"сусід не комутатор":!oi.chGroup?"на порту сусіда немає channel-group":"несумісні режими "+i.chMode+" ↔ "+oi.chMode;
            if(i.chMode!=="on") ecMsgs.push([d.devName,["active","passive"].includes(i.chMode)?"%EC-5-L3DONTBNDL2: "+i.name+" suspended: LACP currently not enabled on the remote port.":"%EC-5-L3DONTBNDL1: "+i.name+" suspended: PAgP not enabled on the remote port."]); continue; }
          i._ec="P"; }
        const ok=mem.filter(i=>i._ec==="P"); if(ok.length){ const ref=ok[0]._ecPeer; for(const i of ok.slice(1)) if(i._ecPeer.dev!==ref.dev||i._ecPeer.group!==ref.group){ i._ec="s"; i._ecWhy="порт веде до іншого пристрою або каналу"; ecMsgs.push([d.devName,"%EC-5-CANNOT_BUNDLE2: "+i.name+" is not compatible with "+ok[0].name+" and will be suspended (partner is different)"]); } }
        ecGroups.push([d,g,mem]); } }
    for(let pass=0;pass<2;pass++) for(const [d,g,mem] of ecGroups) for(const i of mem){ if(i._ec!=="P") continue; const p=i._ecPeer; const oi=p&&N.dev[p.dev].ifs[p.port]; if(oi&&oi._ec!=="P"){ i._ec="I"; i._ecWhy="порт сусіда не в каналі ("+(oi._ec==="s"?"suspended":"stand-alone")+")"; } }
    for(const [d,g,mem] of ecGroups) if(mem.some(i=>i._ec==="P")) ecMsgs.push([d.devName,"%LINEPROTO-5-UPDOWN: Line protocol on Interface Port-channel"+g+", changed state to up"]);
    for(const l of N.links){
      const A=N.dev[l.a], B=N.dev[l.b]; const ia=A.ifs&&A.ifs[l.pa], ib=B.ifs&&B.ifs[l.pb];
      const oper=(x,y,peerSw)=>{ // x — наш порт, y — порт сусіда (або null)
        if(!x||!x.switchport) return null; if(x.mode==="trunk") return "trunk"; if(x.mode==="access") return "access";
        if(!peerSw||!y||!y.switchport) return "access";
        const ySends=!y.nonegotiate && y.mode!=="access";
        if(x.mode==="dynamic desirable") return (y.mode==="trunk"&&ySends)||y.mode==="dynamic desirable"||y.mode==="dynamic auto"?"trunk":"access";
        if(x.mode==="dynamic auto") return (y.mode==="trunk"&&ySends)||y.mode==="dynamic desirable"?"trunk":"access";
        return "access"; };
      if(ia&&A.type==="switch") ia._oper=oper(eff(A,l.pa),ib&&eff(B,l.pb),isSw(B));
      if(ib&&B.type==="switch") ib._oper=oper(eff(B,l.pb),ia&&eff(A,l.pa),isSw(A));
      if(ia&&A.type==="switch"&&ia.chGroup&&A.ifs["Po"+ia.chGroup]) A.ifs["Po"+ia.chGroup]._oper=ia._oper;
      if(ib&&B.type==="switch"&&ib.chGroup&&B.ifs["Po"+ib.chGroup]) B.ifs["Po"+ib.chGroup]._oper=ib._oper;
    }
    // CDP: невідповідність native VLAN і дуплексу
    const msgs=[]; msgs.push(...ecMsgs);
    // ---------- BPDU Guard і port-security → err-disabled ----------
    const errDis=(d,i,why,lines)=>{ i.errdis=why; i.shutdown=true; for(const t of lines) msgs.push([d.devName,t]); };
    for(const d of Object.values(N.dev)){ if(!isSw(d)) continue;
      for(const i of Object.values(d.ifs)){ if(!isPhys(i.name)) continue; delete i._psDeny; delete i._psAllowed;
        if(i.shutdown||!i.connected) continue; const pr=N.peer(d.devName,i.name); const od=pr&&N.dev[pr.dev];
        const edge=i.portfast||(d.portfastDefault&&!operTrunk(i)); const guard=i.bpduguard||(d.bpduguardDefault&&edge);
        if(guard&&od&&isSw(od)&&od.ifs[pr.port]&&!od.ifs[pr.port].shutdown){ errDis(d,i,"bpduguard",["%SPANTREE-2-BLOCK_BPDUGUARD: Received BPDU on port "+longIf(i.name)+" with BPDU Guard enabled. Disabling port.","%PM-4-ERR_DISABLE: bpduguard error detected on "+i.name+", putting "+i.name+" in err-disable state"]); continue; }
        const ps=i.ps; if(!ps||!ps.on||!i.switchport||operTrunk(i)) continue;
        const seenM=[...ps.static,...ps.stickyMacs]; const al=ps.static.map(mac=>({mac,type:"SecureConfigured"})).concat(ps.stickyMacs.map(mac=>({mac,type:"SecureSticky"}))); const viol=[];
        for(const x of behind(d.devName,i.name)){ if(seenM.includes(x.mac)) continue; if(al.length<ps.max){ al.push({mac:x.mac,type:ps.sticky?"SecureSticky":"SecureDynamic"}); seenM.push(x.mac); if(ps.sticky) ps.stickyMacs.push(x.mac); } else viol.push(x.mac); }
        i._psAllowed=al; if(!viol.length){ ps._vk=null; continue; } ps.lastMac=viol[0];
        const vmsg="%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address "+viol[0]+" on port "+longIf(i.name)+".";
        if(ps.viol==="shutdown"){ ps.count++; errDis(d,i,"psecure-violation",["%PM-4-ERR_DISABLE: psecure-violation error detected on "+i.name+", putting "+i.name+" in err-disable state",vmsg]); continue; }
        i._psDeny=new Set(viol); const k=viol.join(","); if(ps._vk!==k){ ps._vk=k; if(ps.viol==="restrict") ps.count+=viol.length; }
        if(ps.viol==="restrict") msgs.push([d.devName,vmsg]); } }
    // ---------- storm control і broadcast-шторм від хоста (команда stormtest на ПК) ----------
    N._storm=new Set(); N._stormWho={};
    for(const d of Object.values(N.dev)){ if(!isSw(d)) continue; for(const i of Object.values(d.ifs)){ if(!isPhys(i.name)) continue; delete i._stormDrop; if(i.shutdown||!i.connected||operTrunk(i)) continue;
        const st=behind(d.devName,i.name).filter(x=>N.dev[x.host]&&N.dev[x.host].storm); if(!st.length) continue;
        if(i.storm&&i.storm.bcast!=null){ if(i.storm.action==="shutdown"){ errDis(d,i,"storm-control",["%STORM_CONTROL-3-SHUTDOWN: A packet storm was detected on "+i.name+". The interface has been disabled.","%PM-4-ERR_DISABLE: storm-control error detected on "+i.name+", putting "+i.name+" in err-disable state"]); continue; }
          i._stormDrop=true; msgs.push([d.devName,"%STORM_CONTROL-3-FILTERED: A Broadcast storm detected on "+i.name+". A packet filter action has been applied on the interface."]); continue; }
        N._storm.add(i.accessVlan); N._stormWho[i.accessVlan]=st[0].host+" ("+d.devName+" "+i.name+")"; } }
    // ---------- root guard: порт, на який приходить кращий BPDU, блокується (root-inconsistent) ----------
    const rgV=new Set(); for(const d of Object.values(N.dev)) if(isSw(d)) for(const i of Object.values(d.ifs)){ delete i._rootInc; if(i.stpGuard==="root"&&!i.shutdown) Object.keys(d.vlans).forEach(v=>rgV.add(Number(v))); }
    for(const v of rgV){ const info=N.stp(v)||{}; for(const [dn,I] of Object.entries(info)){ if(dn==="_edges") continue; for(const p of I.rootInc||[]){ const i=N.dev[dn].ifs[p]; if(!i) continue; i._rootInc=i._rootInc||new Set(); i._rootInc.add(v);
          msgs.push([dn,"%SPANTREE-2-ROOTGUARD_BLOCK: Root guard blocking port "+longIf(p)+" on VLAN"+String(v).padStart(4,"0")+"."]); } } }
    for(const l of N.links){ const A=N.dev[l.a], B=N.dev[l.b]; if(isHost(A)||isHost(B)) continue; const ia=A.ifs[l.pa], ib=B.ifs[l.pb]; if(!ia||!ib) continue; delete ia._dupBad; delete ib._dupBad;
      const da=ia.duplex||"auto", db=ib.duplex||"auto"; const effA= da==="auto"? (db==="auto"?"full":"half") : da, effB= db==="auto"? (da==="auto"?"full":"half") : db;
      if(effA!==effB&&!ia.shutdown&&!ib.shutdown){ ia._dupBad=effA; ib._dupBad=effB; msgs.push([l.a,"%CDP-4-DUPLEX_MISMATCH: duplex mismatch discovered on "+longIf(l.pa)+" ("+(effA==="full"?"full":"not full")+" duplex), with "+l.b+" "+longIf(l.pb)+" ("+(effB==="full"?"full":"not full")+" duplex)."]); } }
    for(const l of N.links){ const A=N.dev[l.a], B=N.dev[l.b]; if(!isSw(A)||!isSw(B)) continue; const ia=eff(A,l.pa), ib=eff(B,l.pb);
      if(ia&&ib&&!ia.shutdown&&!ib.shutdown&&operTrunk(ia)&&operTrunk(ib)&&ia.nativeVlan!==ib.nativeVlan){
        msgs.push([l.a,"%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on "+longIf(l.pa)+" ("+ia.nativeVlan+"), with "+l.b+" "+longIf(l.pb)+" ("+ib.nativeVlan+")."]);
        msgs.push([l.b,"%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on "+longIf(l.pb)+" ("+ib.nativeVlan+"), with "+l.a+" "+longIf(l.pa)+" ("+ia.nativeVlan+")."]); } }
    const out=[]; for(const m of msgs){ const k=m.join("|"); if(!N.seenMsgs.has(k)){ N.seenMsgs.add(k); out.push(m); } }
    { const t=new Date(); const st=t.toLocaleString("en-US",{month:"short"})+" "+String(t.getDate()).padStart(2," ")+" "+t.toTimeString().slice(0,8)+"."+String(t.getMilliseconds()).padStart(3,"0");
      for(const [dn,txt] of out){ const d=N.dev[dn]; if(d&&!isHost(d)&&d.type!=="hub"){ const lb=d.logBuf||[]; if(lb.length&&lb[lb.length-1].endsWith(": "+txt)) continue; d.logBuf=lb.concat(["*"+st+": "+txt]).slice(-60); } } }
    N.seenMsgs=new Set([...N.seenMsgs].filter(k=>msgs.some(m=>m.join("|")===k)));
    return out;
  };
  // ---------- 2-й рівень: які кінцеві точки досяжні ----------
  const carries=(sw,i,v,raw)=>{ if(!i||i.shutdown||!i.connected||!i.switchport) return null; if(!sw.vlans[v]) return null; if(!raw&&i._rootInc&&i._rootInc.has&&i._rootInc.has(v)) return null;
    if(operTrunk(i)){ const al=!i.allowed||i.allowed.includes(v); return al? {tag: v===i.nativeVlan?null:v} : null; }
    return i.accessVlan===v? {tag:null} : null; };
  // Кадр/ARP від w ({mac, ip}) входить у комутатор sw через port у VLAN v: чи пропустять port-security і DAI?
  function l2deny(sw,port,v,w,opt){ const i=sw.ifs[port]; if(!i) return null;
    if(i._psDeny&&w.mac&&i._psDeny.has(w.mac)){ if(N.counting&&i.ps&&i.ps.viol==="restrict") i.ps.count++; return sw.devName+": port-security на "+longIf(port)+" відкидає кадри від MAC "+w.mac+" (violation "+i.ps.viol+", дозволено максимум "+i.ps.max+": "+psAllowed(i).map(x=>x.mac).join(", ")+")"; }
    if(!opt.noDai&&w.ip&&sw.dai&&sw.dai.vlans.includes(v)&&!i.daiTrust){ const ok=Object.values((sw.snoop||{}).bind||{}).some(b=>b.ip===w.ip&&b.mac===w.mac&&b.vlan===v);
      if(!ok){ if(N.counting) sw.dai.drops[v]=(sw.dai.drops[v]||0)+1; return sw.devName+": DAI (VLAN "+v+") відкинув ARP від "+w.ip+" ("+w.mac+") на недовіреному порту "+longIf(port)+" — у таблиці DHCP snooping немає такої пари IP/MAC"; } }
    return null; }
  function domain(start,opt){ // start: {sw,v} | {dev,port,tag}
    opt=opt||{}; const res=[], seen=new Set(), q=[], hubSeen=new Set();
    const vips=(devName,ifc,path)=>{ if(opt.noVip||!ifc) return; for(const [g,h] of Object.entries(ifc.hsrp||{})) if(h.ip&&hsrpActive(devName,ifc.name,Number(g))) res.push({dev:devName,ip:h.ip,mask:ifc.mask,ifn:ifc.name,kind:"l3",vip:true,mac:(ifc.hsrpV===2?"0000.0c9f.f"+Number(g).toString(16).padStart(3,"0"):"0000.0c07.ac"+Number(g).toString(16).padStart(2,"0")),path});
      for(const [g,v] of Object.entries(ifc.vrrp||{})) if(v.ip&&v.ip!==ifc.ip&&vrrpMaster(devName,ifc.name,Number(g))) res.push({dev:devName,ip:v.ip,mask:ifc.mask,ifn:ifc.name,kind:"l3",vip:true,mac:"0000.5e00.01"+Number(g).toString(16).padStart(2,"0"),path}); };
    const enter=(devName,port,tag,path)=>{
      path=path||[]; const d=N.dev[devName]; if(!d) return;
      if(d.type==="hub"){ const k=devName+"|"+tag; if(hubSeen.has(k)) return; hubSeen.add(k); for(const l of N.links){ const op=l.a===devName?l.pa:l.b===devName?l.pb:null; if(op===null||op===port) continue; const pr=N.peer(devName,op); if(pr) enter(pr.dev,pr.port,tag,path); } return; }
      if(isHost(d)){ if(tag===null&&(d.ip||d.ip6||d.slaac)) res.push({dev:devName,ip:d.ip,mask:d.mask,kind:"pc",path}); return; }
      if(d.type==="router"||(d.ifs[port]&&!d.ifs[port].switchport)){
        const ph=d.ifs[port]; if(!ph||ph.shutdown) return;
        if(tag===null && (ph.ip||v6on(ph))){ res.push({dev:devName,ip:ph.ip,mask:ph.mask,ifn:port,kind:"l3",path}); if(ph.ip) vips(devName,ph,path); }
        if(tag===null && ph.ip && ph.natOut){ const g=new Set(d.nat.statics.map(x=>x.global)); for(const pl of Object.values(d.nat.pools)) for(let n=ipToN(pl.start);n<=ipToN(pl.end)&&n-ipToN(pl.start)<64;n++) g.add(n2ip(n)); for(const ip of g) if(ip!==ph.ip&&sameNet(ip,ph.ip,ph.mask)) res.push({dev:devName,ip,mask:ph.mask,ifn:port,kind:"l3",proxy:true,path}); }
        for(const i of Object.values(d.ifs)) if(i.sub&&i.name.split(".")[0]===port&&!i.shutdown&&(i.ip||v6on(i))&&i.encap&&((tag===null&&i.native)||(tag!==null&&i.encap===tag))){ res.push({dev:devName,ip:i.ip,mask:i.mask,ifn:i.name,kind:"l3",path}); vips(devName,i,path); }
        return; }
      const i=eff(d,port); if(!i||i.shutdown||!i.connected) return;
      let v; if(operTrunk(i)){ v= tag===null? i.nativeVlan : (tag===i.nativeVlan? null : tag); if(v===null) return; if(i.allowed&&!i.allowed.includes(v)) return; }
      else { if(tag!==null) return; v=i.accessVlan; }
      if(!d.vlans[v]) return; q.push([devName,v,path,port,tag]);
    };
    if(start.sw) q.push([start.sw,start.v,[],"Vlan"+start.v,null]); else enter(start.dev,start.port,start.tag,[]);
    while(q.length){ const [dn,v,path,inp,tagIn]=q.shift(); const k=dn+"|"+v; if(seen.has(k)) continue; seen.add(k); const sw=N.dev[dn];
      const svi=sw.ifs["Vlan"+v]; if(svi&&(svi.ip||v6on(svi))&&!svi.shutdown){ const pth=inp==="Vlan"+v?[]:path.concat([{dev:dn,inp,tagIn,v,out:"Vlan"+v}]); res.push({dev:dn,ip:svi.ip,mask:svi.mask,ifn:"Vlan"+v,kind:sw.ipRouting?"l3":"svi",path:pth}); vips(dn,svi,pth); }
      for(const p of Object.keys(sw.ifs)){ if(!isPhys(p)) continue; const ei=eff(sw,p); const c=carries(sw,ei,v); if(!c) continue; const pr=N.peer(dn,p); if(pr) enter(pr.dev,pr.port,c.tag,path.concat([{dev:dn,inp,tagIn,v,out:p,tagOut:c.tag,trunk:operTrunk(ei)}])); } }
    if(!opt.l2check) return res;
    const who=e=>({mac:e.mac||(isHost(N.dev[e.dev])?macOf(e.dev,"Fa0"):macOf(e.dev,e.ifn)),ip:e.ip});
    const blocked=[]; const out=res.filter(e=>{ const w=who(e);
        if(N._storm&&N._storm.size) for(const h of e.path||[]) if(N._storm.has(h.v)){ blocked.push({ip:e.ip,dev:e.dev,why:"VLAN "+h.v+" перевантажена broadcast-штормом від "+N._stormWho[h.v]+": комутатори розсилають шторм на всі порти VLAN, і корисні кадри губляться (на порту джерела немає storm-control)"}); return false; }
        for(const h of e.path||[]){ const sw=N.dev[h.dev]; if(!sw||!isSw(sw)) continue;
        let r=h.out&&isPhys(h.out)? l2deny(sw,h.out,h.v,w,opt) : null; if(!r&&opt.origin&&h.inp&&isPhys(h.inp)) r=l2deny(sw,h.inp,h.v,opt.origin,opt);
        if(r){ blocked.push({ip:e.ip,dev:e.dev,why:r}); return false; } } return true; });
    out.blocked=blocked; return out;
  }
  const fromIface=(d,ifn,opt)=>{ // домен 2-го рівня, у який «дивиться» L3-інтерфейс
    const i=d.ifs[ifn]; if(i.tunnel){ const pe=tunnelPeer(d,i); return pe? [{dev:pe.d.devName,ip:pe.i.ip,mask:pe.i.mask,ifn:pe.i.name,kind:"l3",path:[]}] : []; }
    if(opt&&opt.l2check&&!opt.origin) opt=Object.assign({},opt,{origin:{mac:macOf(d.devName,ifn),ip:i.ip}}); if(i.svi) return domain({sw:d.devName,v:Number(ifn.slice(4))},opt);
    const ph=i.sub? ifn.split(".")[0] : ifn; const pr=N.peer(d.devName,ph); if(!pr) return [];
    const tag= i.sub? (i.native? null : i.encap) : null; return domain({dev:pr.dev,port:pr.port,tag},opt); };
  function hsrpPeers(devName,ifn,g){ const d=N.dev[devName]; const i=d.ifs[ifn]; if(!i||!i.hsrp||!i.hsrp[g]) return []; const vip=i.hsrp[g].ip; const out=[];
    if(ifStatus(d,i)[1]==="up"&&i.ip) out.push({dev:devName,ifn,prio:i.hsrp[g].prio,ip:i.ip});
    if(!out.length) return out;
    for(const e of fromIface(d,ifn,{noVip:true})){ if(e.kind==="pc"||e.dev===devName) continue; const o=N.dev[e.dev]; const j=o.ifs[e.ifn]; if(!j||!j.hsrp||!j.hsrp[g]||j.hsrp[g].ip!==vip||j.ip!==e.ip) continue; if(ifStatus(o,j)[1]!=="up") continue; out.push({dev:e.dev,ifn:e.ifn,prio:j.hsrp[g].prio,ip:j.ip}); }
    return out.sort((a,b)=>b.prio-a.prio||ipToN(b.ip)-ipToN(a.ip)); }
  function vrrpPeers(devName,ifn,g){ const d=N.dev[devName]; const i=d.ifs[ifn]; if(!i||!i.vrrp||!i.vrrp[g]) return []; const v=i.vrrp[g]; if(ifStatus(d,i)[1]!=="up"||!i.ip||!v.ip) return [];
    const pr=(ii,vv)=>ii.ip===vv.ip?255:vv.prio; const out=[{dev:devName,ifn,prio:pr(i,v),ip:i.ip,own:i.ip===v.ip}];
    for(const e of fromIface(d,ifn,{noVip:true})){ if(e.kind==="pc"||e.dev===devName) continue; const o=N.dev[e.dev]; const j=o.ifs[e.ifn]; if(!j||!j.vrrp||!j.vrrp[g]||j.vrrp[g].ip!==v.ip||j.ip!==e.ip||ifStatus(o,j)[1]!=="up") continue; out.push({dev:e.dev,ifn:e.ifn,prio:pr(j,j.vrrp[g]),ip:j.ip,own:j.ip===v.ip}); }
    return out.sort((a,b)=>b.prio-a.prio||ipToN(b.ip)-ipToN(a.ip)); }
  function vrrpMaster(devName,ifn,g){ const p=vrrpPeers(devName,ifn,g); return !!p.length&&p[0].dev===devName; }
  N.vrrpState=(devName,ifn,g)=>{ const v=N.dev[devName].ifs[ifn].vrrp[g]; const p=vrrpPeers(devName,ifn,g); const me=p.find(x=>x.dev===devName); if(!me) return {state:"Init",master:"unknown",prio:v.prio,mprio:0,own:false};
    return {state:p[0].dev===devName?"Master":"Backup",master:p[0].ip,prio:me.prio,mprio:p[0].prio,own:me.own}; };
  function hsrpActive(devName,ifn,g){ const p=hsrpPeers(devName,ifn,g); return !!p.length&&p[0].dev===devName; }
  N.hsrpState=(devName,ifn,g)=>{ const p=hsrpPeers(devName,ifn,g); if(!p.length) return {state:"Init",active:"unknown",standby:"unknown"}; const me=p.findIndex(x=>x.dev===devName);
    return {state:me===0?"Active":me===1?"Standby":"Listen",active:me===0?"local":p[0].ip,standby:me===1?"local":(p[1]?p[1].ip:"unknown")}; };
  const upL3=d=>Object.values(d.ifs).filter(i=>i.ip&&ifStatus(d,i)[1]==="up");
  // ---------- 3-й рівень ----------
  function owns(devName,ip){ const d=N.dev[devName]; if(isHost(d)) return d.ip===ip; return upL3(d).some(i=>i.ip===ip||(i.hsrp&&Object.entries(i.hsrp).some(([g,h])=>h.ip===ip&&hsrpActive(devName,i.name,Number(g))))||(i.vrrp&&Object.entries(i.vrrp).some(([g,v])=>v.ip===ip&&vrrpMaster(devName,i.name,Number(g))))); }
  N.counting=false;
  // ---------- OSPF ----------
  const ospfOn=(d,i)=> d.ospf && i.ip && ifStatus(d,i)[1]==="up" && ospfAreaOf(d,i)!==null;
  N.ospfIssues=[];
  function ospfSegments(){
    const nb={}; const issues=[]; const rids={};
    const rs=Object.values(N.dev).filter(d=>!isHost(d)&&d.ospf);
    for(const d of rs){ const r=effRid(d); (rids[r]=rids[r]||[]).push(d.devName); nb[d.devName]=[]; }
    for(const d of rs){
      for(const i of Object.values(d.ifs)){ if(!ospfOn(d,i)||i.loop) continue; if(ospfPassive(d,i.name)) continue;
        for(const e of fromIface(d,i.name)){ if(e.kind==="pc"||e.dev===d.devName) continue; const o=N.dev[e.dev]; const j=o.ifs[e.ifn]; if(!o.ospf||!j||!ospfOn(o,j)) continue;
          if(j.ip!==e.ip) continue; // проксі-адреси NAT
          const why=[];
          if(ospfPassive(o,j.name)) why.push("на "+e.dev+" інтерфейс "+longIf(j.name)+" пасивний");
          if(!sameNet(i.ip,j.ip,i.mask)||i.mask!==j.mask) why.push("різні підмережі/маски ("+i.ip+"/"+maskLen(i.mask)+" і "+j.ip+"/"+maskLen(j.mask)+")");
          if(ospfAreaOf(d,i)!==ospfAreaOf(o,j)) why.push("різні області (area "+ospfAreaOf(d,i)+" і "+ospfAreaOf(o,j)+")");
          if(i.hello!==j.hello||i.dead!==j.dead) why.push("різні таймери hello/dead ("+i.hello+"/"+i.dead+" і "+j.hello+"/"+j.dead+")");
          if(effRid(d)===effRid(o)) why.push("однаковий Router ID "+effRid(d));
          const hb=aclBlocks(d,i.name,{proto:"ospf",src:j.ip,dst:"224.0.0.5"}); if(hb) why.push("ACL "+i.aclIn+" на "+d.devName+" блокує OSPF hello (неявний deny)");
          if(why.length){ issues.push(d.devName+" ↔ "+e.dev+": "+why.join("; ")); continue; }
          nb[d.devName].push({dev:e.dev,myIf:i.name,ifn:j.name,ip:j.ip,rid:effRid(o),prio:j.ospfPrio,p2p:i.ospfP2p&&j.ospfP2p,cost:ospfCostOf(d,i)});
        } } }
    // DR/BDR для кожного сегмента
    const role={}; // devName|ifn → DR/BDR/DROTHER/P2P
    for(const d of rs) for(const i of Object.values(d.ifs)){ if(!ospfOn(d,i)) continue; const k=d.devName+"|"+i.name; if(i.loop){ role[k]="LOOP"; continue; }
      const mine=nb[d.devName].filter(n=>n.myIf===i.name);
      if(mine.length&&mine.every(n=>n.p2p)){ role[k]="P2P"; continue; }
      const members=[{dev:d.devName,rid:effRid(d),prio:i.ospfPrio}].concat(mine.map(n=>({dev:n.dev,rid:n.rid,prio:n.prio})));
      const elig=members.filter(m=>m.prio>0).sort((a,b)=>b.prio-a.prio||ipToN(b.rid)-ipToN(a.rid));
      const dr=elig[0], bdr=elig[1];
      role[k]= dr&&dr.dev===d.devName? "DR" : bdr&&bdr.dev===d.devName? "BDR" : "DROTHER";
      for(const n of mine){ n.role= dr&&n.dev===dr.dev?"DR": bdr&&n.dev===bdr.dev?"BDR":"DROTHER"; n.full= n.p2p || role[k]!=="DROTHER" || n.role!=="DROTHER"; }
    }
    N.ospfIssues=issues;
    return {nb,role,rs};
  }
  function ospfAll(){
    const {nb,role,rs}=ospfSegments(); const tables={};
    const prefixes=[]; // {dev,net,mask,cost}
    for(const d of rs) for(const i of Object.values(d.ifs)) if(ospfOn(d,i)){ const m=i.loop?"255.255.255.255":i.mask; prefixes.push({dev:d.devName,net:n2ip((ipToN(i.ip)&ipToN(m))>>>0),mask:m,cost:ospfCostOf(d,i)}); }
    for(const src of rs){
      const dist={}, first={}; for(const d of rs){ dist[d.devName]=Infinity; first[d.devName]=[]; } dist[src.devName]=0; const done=new Set();
      while(true){ let u=null; for(const d of rs) if(!done.has(d.devName)&&dist[d.devName]<Infinity&&(u===null||dist[d.devName]<dist[u])) u=d.devName; if(u===null) break; done.add(u);
        for(const n of nb[u]){ const nd=dist[u]+n.cost; const fh= u===src.devName? [{nh:n.ip,ifn:n.myIf}] : first[u];
          if(nd<dist[n.dev]){ dist[n.dev]=nd; first[n.dev]=fh.slice(); } else if(nd===dist[n.dev]){ for(const h of fh) if(!first[n.dev].some(x=>x.nh===h.nh)) first[n.dev].push(h); } } }
      const best={};
      for(const p of prefixes){ if(p.dev===src.devName||dist[p.dev]===Infinity) continue; const c=dist[p.dev]+p.cost; const k=p.net+"/"+p.mask;
        if(!best[k]||c<best[k].cost) best[k]={net:p.net,mask:p.mask,cost:c,hops:first[p.dev].slice()}; else if(c===best[k].cost){ for(const h of first[p.dev]) if(!best[k].hops.some(x=>x.nh===h.nh)) best[k].hops.push(h); } }
      for(const d of rs){ if(d===src||dist[d.devName]===Infinity||!d.ospf.defOrig) continue; const hasDef=d.ospf.defAlways||activeStatics(d).some(r=>r.mask==="0.0.0.0");
        if(hasDef&&!best["0.0.0.0/0.0.0.0"]) best["0.0.0.0/0.0.0.0"]={net:"0.0.0.0",mask:"0.0.0.0",cost:1,e2:true,hops:first[d.devName].slice()}; }
      tables[src.devName]=Object.values(best).filter(r=>r.hops.length).sort((a,b)=>ipToN(a.net)-ipToN(b.net));
    }
    return {nb,role,tables};
  }
  N.ospfRoutes=dn=>{ const d=N.dev[dn]; if(!d.ospf) return []; return ospfAll().tables[dn]||[]; };
  N.ospfNeighbors=dn=>{ const x=ospfSegments(); return x.nb[dn]||[]; };
  N.ospfRole=(dn,ifn)=>ospfSegments().role[dn+"|"+ifn];
  N.ospfSources=s=>[...new Set(N.ospfNeighbors(s.devName).map(n=>n.rid))];
  N.ospfNbrShow=s=>{ const {nb,role}=ospfSegments(); let o="\nNeighbor ID     Pri   State           Dead Time   Address         Interface\n";
    for(const n of nb[s.devName]||[]) o+=n.rid.padEnd(16)+String(n.prio).padStart(3)+"   "+((n.p2p?"FULL/  -":(n.full?"FULL/":"2WAY/")+n.role)).padEnd(16)+"00:00:3"+(n.dev.length%10)+"    "+n.ip.padEnd(16)+longIf(n.myIf)+"\n"; return o; };
  N.ospfIfBrief=s=>{ const {nb,role}=ospfSegments(); let o="Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C\n";
    for(const i of Object.values(s.ifs)){ if(!ospfOn(s,i)) continue; const mine=(nb[s.devName]||[]).filter(n=>n.myIf===i.name);
      o+=i.name.padEnd(13)+String(s.ospf.pid).padEnd(6)+String(ospfAreaOf(s,i)).padEnd(16)+(i.ip+"/"+maskLen(i.mask)).padEnd(19)+String(ospfCostOf(s,i)).padEnd(6)+(role[s.devName+"|"+i.name]||"DOWN").padEnd(6)+mine.filter(n=>n.full).length+"/"+mine.length+"\n"; }
    return o; };
  // ---------- ACL і NAT у тракті пересилання ----------
  const pktStr=p=>(p.proto==="icmp"?(p.reply?"ICMP echo-reply":"ICMP echo"):p.proto.toUpperCase()+(p.dport?" :"+p.dport:""))+" "+p.src+" → "+p.dst;
  function aclBlocks(d,ifn,pkt,dir){ dir=dir||"in"; const i=d.ifs[ifn]; if(!i) return null; const name=dir==="in"?i.aclIn:i.aclOut; if(!name) return null; const acl=d.acls[name]; if(!acl||!acl.rules.some(r=>!r.remark)) return null;
    const r=evalAcl(acl,pkt,N.counting); if(r.permit) return null;
    return d.devName+": ACL "+name+" ("+longIf(ifn)+" "+dir+") відкидає "+pktStr(pkt)+(r.rule?" — рядок «"+aceText(acl,r.rule,true)+"»":" — неявний deny any в кінці ACL"); }
  function natInbound(d,pkt){ // outside → inside: змінюємо адресу призначення
    const st=d.nat.statics.find(x=>x.global===pkt.dst); if(st){ pkt.dst=st.local; d.nat.hits++; return; }
    const t=d.nat.table.find(x=>x.ig===pkt.dst&&x.og===pkt.src&&x.proto===pkt.proto&&(!x.port||x.port===pkt.dport)); if(t){ pkt.dst=t.il; if(t.port) pkt.dport=t.lport; d.nat.hits++; } }
  function natOutbound(d,pkt){ // inside → outside: змінюємо адресу джерела
    const st=d.nat.statics.find(x=>x.local===pkt.src); if(st){ pkt.src=st.global; d.nat.hits++; return null; }
    for(const r of d.nat.dyn){ const acl=d.acls[r.acl]; if(!acl) continue; if(!evalAcl(acl,{src:pkt.src,dst:pkt.dst,proto:pkt.proto,dport:pkt.dport,sport:pkt.sport},false).permit) continue;
      let gip=null;
      if(r.ifc){ const i=d.ifs[r.ifc]; if(!i||!i.ip) return d.devName+": інтерфейс "+longIf(r.ifc)+" для NAT не має IP"; gip=i.ip; }
      else { const p=d.nat.pools[r.pool]; if(!p) return d.devName+": пул NAT "+r.pool+" не існує"; const used=new Set(d.nat.table.filter(t=>t.acl===r.acl&&t.il!==pkt.src&&!r.overload).map(t=>t.ig));
        const mine=d.nat.table.find(t=>t.il===pkt.src&&t.acl===r.acl); if(mine) gip=mine.ig; else for(let n=ipToN(p.start);n<=ipToN(p.end);n++){ const ip=n2ip(n); if(!used.has(ip)){ gip=ip; break; } }
        if(!gip){ d.nat.miss++; return d.devName+": пул NAT "+r.pool+" вичерпано (без overload кожен внутрішній хост займає окрему адресу)"; } }
      const port=r.overload? (d.nat.ports++) : null;
      let t=d.nat.table.find(x=>x.il===pkt.src&&x.og===pkt.dst&&x.proto===pkt.proto&&(!x.port||x.lport===pkt.sport));
      if(!t){ t={proto:pkt.proto,il:pkt.src,ig:gip,og:pkt.dst,port,lport:port?pkt.sport:null,acl:r.acl}; d.nat.table.push(t); if(d.nat.table.length>40) d.nat.table.shift(); }
      pkt.src=t.ig; if(t.port) pkt.sport=t.port; d.nat.hits++; return null; }
    d.nat.miss++; return null; }
  function lookup(d,dstIp){
    const cands=[];
    for(const i of upL3(d)) if(sameNet(i.ip,dstIp,i.mask)) cands.push({len:maskLen(i.mask),ad:0,ifn:i.name,conn:true,code:i.mask==="255.255.255.255"||i.ip===dstIp?"L":"C",pfx:n2ip((ipToN(i.ip)&ipToN(i.mask))>>>0)+"/"+maskLen(i.mask)});
    if(d.ipRouting){ for(const r of activeStatics(d)) if(sameNet(r.net,dstIp,r.mask)||r.mask==="0.0.0.0") cands.push({len:r.mask==="0.0.0.0"?0:maskLen(r.mask),ad:r.ad,nh:r.nh,ifn:r.ifc,code:r.mask==="0.0.0.0"?"S*":"S",pfx:r.net+"/"+maskLen(r.mask)});
      if(d.ospf) for(const r of N.ospfRoutes(d.devName)) if(r.mask==="0.0.0.0"||sameNet(r.net,dstIp,r.mask)) cands.push({len:r.mask==="0.0.0.0"?0:maskLen(r.mask),ad:110,nh:r.hops[0].nh,ifn:r.hops[0].ifn,ospf:true,code:r.mask==="0.0.0.0"?"O*E2":"O",pfx:r.net+"/"+maskLen(r.mask)}); }
    if(!d.ipRouting && d.defaultGw) cands.push({len:0,ad:0,nh:d.defaultGw,code:"gw",pfx:"0.0.0.0/0"});
    cands.sort((a,b)=>b.len-a.len||a.ad-b.ad); return cands[0]||null;
  }
  const T=(c,o)=>{ if(c&&c.tr) c.tr.push(o); };
  const macOf=(dev,ifn)=>{ const d=N.dev[dev]; const key=isHost(d)? dev : dev+"|"+String(ifn||"").split(".")[0]; let h=0x811c9dc5; for(let i=0;i<key.length;i++){ h^=key.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } h^=h>>>13; h=Math.imul(h,0x5bd1e995)>>>0; h^=h>>>15; const x=(h>>>0).toString(16).padStart(8,"0");
    return isHost(d)? "0050.79"+x.slice(0,2)+"."+x.slice(2,6) : "00"+(d.type==="router"?"1a":"19")+"."+x.slice(0,4)+"."+x.slice(4,8); };
  function l2Trace(c,from,fromIf,e,pkt){
    if(!c||!c.tr) return; const srcMac=macOf(from,fromIf), dstMac=e.mac||macOf(e.dev,e.ifn);
    T(c,{dev:from,k:"arp",text:"ARP: «Хто має "+e.ip+"?» (broadcast) → відповідає "+e.dev+(e.ifn?" "+longIf(e.ifn):"")+": "+dstMac+(e.proxy?" (proxy ARP для адреси NAT)":"")+(e.vip?" (віртуальний MAC HSRP — відповідає активний маршрутизатор)":"")});
    const frame=tag=>({dmac:dstMac,smac:srcMac,tag:tag||null,ip:{src:pkt.src,dst:pkt.dst,ttl:pkt.ttl,proto:pkt.proto,sport:pkt.sport,dport:pkt.dport,reply:!!pkt.reply}});
    T(c,{dev:from,k:"l2",frame:frame(null),text:"Кадр Ethernet: src MAC "+srcMac+" → dst MAC "+dstMac+"; усередині IP "+pkt.src+" → "+pkt.dst});
    let prev=from;
    for(const h of e.path||[]){ T(c,{dev:h.dev,k:"sw",link:[prev,h.dev],frame:frame(h.tagOut),text:h.dev+": кадр прийшов на "+h.inp+(h.tagIn?" з тегом 802.1Q "+h.tagIn:" без тегу")+" → VLAN "+h.v+" → за MAC-таблицею "+(String(h.out).startsWith("Vlan")?"до власного SVI "+h.out:"вийшов з "+h.out+(h.tagOut?" з тегом 802.1Q "+h.tagOut:(h.trunk?" без тегу (native VLAN "+h.v+")":" без тегу (access-порт)")))}); prev=h.dev; }
    if(prev!==e.dev) T(c,{dev:e.dev,k:"l2",link:[prev,e.dev],text:"Кадр доставлено на "+e.dev+(e.ifn?" "+longIf(e.ifn):"")});
  }
  function l2To(d,exitIf,target,pkt,c){
    const dom=fromIface(d,exitIf,{l2check:true}); const e=dom.find(x=>x.ip===target&&!(x.dev===d.devName&&x.ifn===exitIf));
    if(!e){ const b=(dom.blocked||[]).find(x=>x.ip===target)||(dom.blocked||[])[0]; T(c,{dev:d.devName,k:"fail",text:"ARP для "+target+" через "+longIf(exitIf)+" без відповіді — "+(b?b.why:"сусід недосяжний на 2-му рівні")}); return {ok:false,why:b?b.why:d.devName+": ARP для "+target+" через "+longIf(exitIf)+" без відповіді (сусід недосяжний на 2-му рівні)",arp:true}; }
    l2Trace(c,d.devName,exitIf,e,pkt);
    const nd=N.dev[e.dev];
    if(isHost(nd)){ if(nd.ip===pkt.dst){ T(c,{dev:e.dev,k:"ok",text:e.dev+" прийняв пакет: IP призначення "+pkt.dst+" — його власна адреса"}); return {ok:true,dev:e.dev,pkt}; } return {ok:false,why:"Пакет для "+pkt.dst+" потрапив на хост "+e.dev+", який не маршрутизує"}; }
    if(e.kind==="svi"&&!nd.ipRouting){ if(owns(e.dev,pkt.dst)){ T(c,{dev:e.dev,k:"ok",text:e.dev+" прийняв пакет на SVI"}); return {ok:true,dev:e.dev,pkt}; } return {ok:false,why:e.dev+" не маршрутизує (немає ip routing)"}; }
    return routerIn(e.dev,e.ifn,pkt,c);
  }
  function routerIn(devName,inIf,pkt,c){
    const d=N.dev[devName];
    if(c.ttl--<=0){ T(c,{dev:devName,k:"fail",text:"TTL вичерпано — пакет ходить по колу (петля маршрутизації)"}); return {ok:false,why:"TTL вичерпано — петля маршрутизації",loop:true}; }
    if(inIf){ T(c,{dev:devName,k:"l3",text:devName+": прийняв пакет на "+longIf(inIf)+", зняв заголовок Ethernet"}); const b=aclBlocks(d,inIf,pkt,"in"); if(b){ T(c,{dev:devName,k:"fail",text:"🛡 "+b}); return {ok:false,why:b,acl:true,at:devName}; } if(d.ifs[inIf].aclIn) T(c,{dev:devName,k:"acl",text:"🛡 ACL "+d.ifs[inIf].aclIn+" (in) дозволяє пакет"}); }
    if(inIf && d.ifs[inIf] && d.ifs[inIf].natOut){ const before=pkt.dst; natInbound(d,pkt); if(before!==pkt.dst) T(c,{dev:devName,k:"nat",text:"🔄 NAT (outside → inside): призначення "+before+" → "+pkt.dst}); }
    if(owns(devName,pkt.dst)){ T(c,{dev:devName,k:"ok",text:devName+": адреса "+pkt.dst+" належить мені — пакет доставлено"}); return {ok:true,dev:devName,pkt}; }
    if(!d.ipRouting) return {ok:false,why:devName+" не маршрутизує (немає ip routing)"};
    const r=lookup(d,pkt.dst); if(!r){ T(c,{dev:devName,k:"fail",text:devName+": у таблиці маршрутизації немає маршруту до "+pkt.dst+" — пакет відкинуто (ICMP unreachable)"}); return {ok:false,why:devName+": немає маршруту до "+pkt.dst+" (перевірте show ip route)",noroute:true,at:devName}; }
    let exitIf=r.ifn, target=pkt.dst;
    if(r.nh){ target=r.nh; if(!exitIf){ const cc=upL3(d).find(i=>sameNet(i.ip,r.nh,i.mask)); if(!cc) return {ok:false,why:devName+": next-hop "+r.nh+" недосяжний"}; exitIf=cc.name; } }
    T(c,{dev:devName,k:"route",text:devName+": найдовший збіг для "+pkt.dst+" — "+r.code+" "+r.pfx+(r.ad?" [AD "+r.ad+"]":"")+(r.nh?" → next-hop "+r.nh:" (мережа підключена напряму)")+" через "+longIf(exitIf)+(inIf?"; TTL зменшено на 1":"")});
    if(inIf && d.ifs[inIf].natIn && d.ifs[exitIf] && d.ifs[exitIf].natOut){ const before=pkt.src; const e=natOutbound(d,pkt); if(e){ T(c,{dev:devName,k:"fail",text:"🔄 "+e}); return {ok:false,why:e}; } T(c,{dev:devName,k:"nat",text:before!==pkt.src?"🔄 NAT (inside → outside): джерело "+before+" → "+pkt.src+(pkt.sport&&pkt.proto!=="icmp"?":"+pkt.sport:""):"🔄 NAT: пакет не підпадає під жодне правило — без трансляції"}); }
    if(inIf){ const b=aclBlocks(d,exitIf,pkt,"out"); if(b){ T(c,{dev:devName,k:"fail",text:"🛡 "+b}); return {ok:false,why:b,acl:true,at:devName}; } if(d.ifs[exitIf]&&d.ifs[exitIf].aclOut) T(c,{dev:devName,k:"acl",text:"🛡 ACL "+d.ifs[exitIf].aclOut+" (out) дозволяє пакет"}); }
    if(inIf){ c.hops.push(d.ifs[inIf].ip||"?"); pkt.ttl=(pkt.ttl||255)-1; }
    return l2To(d,exitIf,target,pkt,c);
  }
  function originate(devName,pkt,c){
    const d=N.dev[devName];
    if(isHost(d)){
      if(!d.ip) return {ok:false,why:devName+": немає IP-адреси"+(d.dhcp?" (виконайте ipconfig /renew)":"")};
      if(pkt.dst===d.ip) return {ok:true,dev:devName,pkt};
      const pr=N.peer(devName,"Fa0"); const dom=pr?domain({dev:pr.dev,port:pr.port,tag:null},{l2check:true,origin:{mac:macOf(devName,"Fa0"),ip:d.ip}}):[];
      let target=pkt.dst; const local=sameNet(d.ip,pkt.dst,d.mask); if(!local){ if(!d.gw) return {ok:false,why:devName+": немає шлюзу за замовчуванням",arp:true}; target=d.gw; }
      T(c,{dev:devName,k:"host",text:devName+": "+(pkt.reply?"відповідь ":"")+pkt.proto.toUpperCase()+(pkt.dport&&pkt.proto!=="icmp"?" :"+pkt.dport:"")+" "+pkt.src+" → "+pkt.dst+". "+(local?"Адресат у моїй мережі ("+d.ip+"/"+maskLen(d.mask)+") — шлю напряму":"Адресат в іншій мережі — шлю на шлюз "+d.gw)});
      const e=dom.find(x=>x.ip===target&&x.dev!==devName);
      if(!e){ const b=(dom.blocked||[]).find(x=>x.ip===target)||((dom.blocked||[]).length&&!dom.length?dom.blocked[0]:null); if(b){ T(c,{dev:devName,k:"fail",text:"🛡 "+b.why}); return {ok:false,arp:true,why:b.why}; }
        T(c,{dev:devName,k:"fail",text:"ARP для "+target+" без відповіді — "+(local?"хост":"шлюз")+" недосяжний на 2-му рівні"}); return {ok:false,arp:true,why: target===pkt.dst? "ARP для "+target+" без відповіді — хост недосяжний на 2-му рівні (VLAN, trunk, access-порти, маска)" : "Шлюз "+target+" недосяжний з "+devName+" (перевірте VLAN, trunk, субінтерфейс/SVI, адресу шлюзу)"}; }
      l2Trace(c,devName,"Fa0",e,pkt);
      const nd=N.dev[e.dev]; if(isHost(nd)){ if(nd.ip===pkt.dst){ T(c,{dev:e.dev,k:"ok",text:e.dev+" прийняв пакет"}); return {ok:true,dev:e.dev,pkt}; } return {ok:false,why:"Шлюз "+target+" — це звичайний хост "+e.dev}; }
      if(e.kind==="svi"&&!nd.ipRouting) return owns(e.dev,pkt.dst)?{ok:true,dev:e.dev,pkt}:{ok:false,why:e.dev+" не маршрутизує (немає ip routing)"};
      return routerIn(e.dev,e.ifn,pkt,c); }
    if(owns(devName,pkt.dst)) return {ok:true,dev:devName,pkt};
    T(c,{dev:devName,k:"host",text:devName+": "+(pkt.reply?"відповідь ":"")+pkt.proto.toUpperCase()+" "+pkt.src+" → "+pkt.dst});
    if(!d.ipRouting){ const svi=upL3(d)[0]; if(!svi) return {ok:false,why:devName+": немає активного SVI з IP"}; let target=pkt.dst; if(!sameNet(svi.ip,pkt.dst,svi.mask)){ if(!d.defaultGw) return {ok:false,why:devName+": немає ip default-gateway"}; target=d.defaultGw; } return l2To(d,svi.name,target,pkt,c); }
    return routerIn(devName,null,pkt,c);
  }
  function srcIpOf(devName,dstIp){ const d=N.dev[devName]; if(isHost(d)) return d.ip;
    const r=lookup(d,dstIp); if(!r) return (upL3(d)[0]||{}).ip||null; let ifn=r.ifn; if(!ifn&&r.nh){ const c=upL3(d).find(i=>sameNet(i.ip,r.nh,i.mask)); ifn=c&&c.name; } return ifn&&d.ifs[ifn]&&d.ifs[ifn].ip? d.ifs[ifn].ip : (upL3(d)[0]||{}).ip; }
  N.flow=(fromDev,dst,proto,dport,srcOv)=>{
    proto=proto||"icmp"; const src=srcOv||srcIpOf(fromDev,dst); const fd=N.dev[fromDev]; const tr=N.counting;
    if(!src) return {ok:false,why:fromDev+": немає IP-адреси"+(fd.dhcp?" (виконайте ipconfig /renew)":""),hops:[]};
    N._sp=((N._sp||0)+1)%1000; const pkt={src,dst,proto,dport:proto==="icmp"?null:dport,sport:proto==="icmp"?N._sp+1:49152+N._sp};
    pkt.ttl=isHost(fd)?128:255; const c={hops:[],ttl:16,tr:tr?[]:null}; const f=originate(fromDev,pkt,c);
    const save=(res,back)=>{ if(tr) N.lastFlow={from:fromDev,dst,proto,dport,ok:res.ok,why:res.why,fwd:c.tr,back:back||[]}; return res; };
    if(!f.ok) return save(Object.assign(f,{hops:c.hops}));
    const td=N.dev[f.dev];
    const listens=(x,pt)=>isHost(x)? (x.services||[]).includes(pt) : pt===22? !!(x.rsaBits&&/ssh|all/.test(x.vty.transport)) : pt===23? (/telnet|all/.test(x.vty.transport)&&!!(x.vty.login||x.vty.password)) : false;
    if(proto!=="icmp"&&!listens(td,dport)){ T(c,{dev:f.dev,k:"fail",text:f.dev+" не слухає порт "+dport+" — відповідає TCP RST (connection refused)"}); return save({ok:false,refused:true,why:f.dev+" не слухає TCP-порт "+dport+" (connection refused)",hops:c.hops}); }
    const rp={src:f.pkt.dst,dst:f.pkt.src,proto,dport:f.pkt.sport,sport:f.pkt.dport,reply:true,ttl:isHost(td)?128:255};
    const c2={hops:[],ttl:16,tr:tr?[]:null}; const b=originate(f.dev,rp,c2);
    if(!b.ok) return save({ok:false,why:"Запит дійшов до "+f.dev+" ("+dst+"), але відповідь не повертається: "+b.why,back:true,hops:c.hops,srcSeen:f.pkt.src},c2.tr);
    if(b.dev!==fromDev) return save({ok:false,why:"Відповідь потрапила на "+b.dev+" замість "+fromDev,back:true,hops:c.hops},c2.tr);
    return save({ok:true,hops:c.hops,dev:f.dev,srcSeen:f.pkt.src},c2.tr);
  };
  // ---------- IPv6: SLAAC, NDP, пересилання ----------
  const hostMac=name=>{ const d=N.dev[name]; return d? macOf(name,"Fa0") : null; };
  function hostV6(h){ if(h.ip6) return h.ip6; if(!h.slaac) return null;
    const pr=N.peer(h.name,"Fa0"); if(!pr) return null;
    for(const e of domain({dev:pr.dev,port:pr.port,tag:null},{l2check:true,noDai:true,origin:{mac:hostMac(h.name)}})){ if(e.kind==="pc") continue; const d=N.dev[e.dev]; const i=d.ifs[e.ifn]; if(!i||!d.v6routing||ifStatus(d,i)[1]!=="up") continue;
      const g=(i.v6||[]).find(x=>x.len===64); if(!g) continue;
      if((e.path||[]).some(h=>{ const sw=N.dev[h.dev]; const pi=sw&&sw.ifs&&sw.ifs[h.out]; return pi&&raRole(sw,pi)==="host"; })) continue; // RA guard відкинув Router Advertisement
      const gw=i.llStatic||v6ll(d,i); const pool=i.dhcp6&&d.dhcp6&&d.dhcp6.pools[i.dhcp6]; const useOther=(i.ndM||i.ndO)&&pool;
      const dns=useOther&&pool.dns.length?pool.dns.slice():null, dom=useOther?pool.domain:null;
      let sl=null; if(!i.ndNoAuto){ const iid=eui64(hostMac(h.name).replace(/^(..)(..)\.(....)\.(....)$/,"$1$2.$3.$4")); sl=v6fmt(v6net(v6parse(g.addr),64)|iid); }
      let st=null; if(i.ndM&&pool&&pool.prefix){ let x=0n; const k=h.name+"|"+pool.name; for(let n=0;n<k.length;n++) x=(x*131n+BigInt(k.charCodeAt(n)))&0xffffffffffffffffn; if(!x) x=1n; if(((x>>24n)&0xffffn)===0xfffen) x^=1n<<24n;
        st=v6fmt(v6net(v6parse(pool.prefix.net),64)|x); D6(d).bind[h.name]={addr:st,ll:v6fmt((0xfe80n<<112n)|eui64(hostMac(h.name))),mac:hostMac(h.name),iaid:(h.name.length%9)+1,pool:pool.name}; }
      const addr=st||sl; if(!addr) continue;
      return {addr,len:64,gw,slaac:!st,dhcp6:!!st,stateless:!st&&!!dns,dns,domain:dom,other:st&&sl?sl:null,router:e.dev}; }
    return null; }
  N.hostV6=name=>hostV6(N.dev[name]); N.hostMac=hostMac; N.hostLL=name=>v6fmt((0xfe80n<<112n)|eui64(hostMac(name)));
  const v6of=e=>{ const d=N.dev[e.dev]; if(isHost(d)){ const h=hostV6(d); return h?[h.addr,v6fmt((0xfe80n<<112n)|eui64(hostMac(e.dev)))]:[]; } const i=d.ifs[e.ifn]; return i&&ifStatus(d,i)[1]==="up"? v6list(d,i).map(x=>x.addr) : []; };
  function owns6(dev,a){ const d=N.dev[dev]; if(isHost(d)){ const h=hostV6(d); return !!h&&v6eq(h.addr,a); } return Object.values(d.ifs).some(i=>ifStatus(d,i)[1]==="up"&&v6list(d,i).some(x=>v6eq(x.addr,a))); }
  function lookup6(d,dst){ const c=[]; for(const i of Object.values(d.ifs)){ if(ifStatus(d,i)[1]!=="up") continue; for(const x of i.v6||[]) if(v6same(x.addr,dst,x.len)) c.push({len:x.len,ad:0,ifn:i.name,code:"C",pfx:v6fmt(v6net(v6parse(x.addr),x.len))+"/"+x.len}); }
    for(const r of activeStatics6(d)) if(v6same(r.pfx,dst,r.len)) c.push({len:r.len,ad:r.ad,nh:r.nh,ifn:r.ifc,code:"S",pfx:r.pfx+"/"+r.len});
    if(d.ospf6) for(const r of N.ospf6Routes(d.devName)) if(v6same(r.pfx,dst,r.len)) c.push({len:r.len,ad:110,nh:r.hops[0].nh,ifn:r.hops[0].ifn,code:r.e2?"OE2":"O",pfx:r.pfx+"/"+r.len});
    c.sort((a,b)=>b.len-a.len||a.ad-b.ad); return c[0]||null; }
  function ndp(c,from,target,e){ T(c,{dev:from,k:"arp",text:"NDP: Neighbor Solicitation «хто має "+target+"?» (multicast FF02::1:FF"+target.split(":").pop().padStart(4,"0").slice(-2)+":…) → Neighbor Advertisement від "+e.dev+(e.ifn?" "+longIf(e.ifn):"")}); }
  function l2To6(d,exitIf,target,pkt,c){ const e=fromIface(d,exitIf,{l2check:true,noDai:true}).find(x=>!(x.dev===d.devName&&x.ifn===exitIf)&&v6of(x).some(a=>v6eq(a,target)));
    if(!e){ T(c,{dev:d.devName,k:"fail",text:"NDP для "+target+" без відповіді"}); return {ok:false,why:d.devName+": NDP для "+target+" через "+longIf(exitIf)+" без відповіді",arp:true}; }
    ndp(c,d.devName,target,e); for(const h of e.path||[]) T(c,{dev:h.dev,k:"sw",text:h.dev+": кадр у VLAN "+h.v+" "+h.inp+" → "+h.out+(h.tagOut?" (тег "+h.tagOut+")":"")});
    const nd=N.dev[e.dev]; if(isHost(nd)) return owns6(e.dev,pkt.dst)? (T(c,{dev:e.dev,k:"ok",text:e.dev+" прийняв IPv6-пакет"}),{ok:true,dev:e.dev,pkt}) : {ok:false,why:"Пакет потрапив на хост "+e.dev};
    return routerIn6(e.dev,e.ifn,pkt,c); }
  function routerIn6(dev,inIf,pkt,c){ const d=N.dev[dev]; if(c.ttl--<=0) return {ok:false,why:"Hop Limit вичерпано — петля маршрутизації"};
    if(owns6(dev,pkt.dst)){ T(c,{dev,k:"ok",text:dev+": адреса "+pkt.dst+" моя — доставлено"}); return {ok:true,dev,pkt}; }
    if(!d.v6routing){ T(c,{dev,k:"fail",text:dev+": ipv6 unicast-routing вимкнено — маршрутизатор не пересилає IPv6"}); return {ok:false,why:dev+": не увімкнено ipv6 unicast-routing",noroute:true}; }
    const r=lookup6(d,pkt.dst); if(!r){ T(c,{dev,k:"fail",text:dev+": немає IPv6-маршруту до "+pkt.dst}); return {ok:false,why:dev+": немає IPv6-маршруту до "+pkt.dst+" (show ipv6 route)",noroute:true}; }
    let exitIf=r.ifn, target=pkt.dst; if(r.nh){ target=r.nh; if(!exitIf){ const i=Object.values(d.ifs).find(i=>ifStatus(d,i)[1]==="up"&&(i.v6||[]).some(x=>v6same(x.addr,r.nh,x.len))); if(!i) return {ok:false,why:dev+": next-hop "+r.nh+" недосяжний"}; exitIf=i.name; } }
    T(c,{dev,k:"route",text:dev+": найдовший збіг для "+pkt.dst+" — "+r.code+" "+r.pfx+(r.nh?" → next-hop "+r.nh:" (підключена мережа)")+" через "+longIf(exitIf)+"; Hop Limit −1"});
    if(inIf) c.hops.push((v6list(d,d.ifs[inIf]).find(x=>!x.ll)||{}).addr||"?");
    return l2To6(d,exitIf,target,pkt,c); }
  function originate6(dev,pkt,c){ const d=N.dev[dev];
    if(isHost(d)){ const h=hostV6(d); if(!h) return {ok:false,why:dev+": немає IPv6-адреси"+(d.slaac?" (SLAAC: на шлюзі немає ipv6 unicast-routing або /64 адреси)":"")}; if(v6eq(h.addr,pkt.dst)) return {ok:true,dev,pkt};
      const onlink=v6same(h.addr,pkt.dst,h.len)||/^fe80/i.test(pkt.dst); const target=onlink?pkt.dst:h.gw; if(!target) return {ok:false,why:dev+": немає IPv6-шлюзу"};
      T(c,{dev,k:"host",text:dev+": IPv6 "+pkt.src+" → "+pkt.dst+". "+(onlink?"Адресат у моїй мережі /"+h.len:"Шлю на шлюз "+target+(h.slaac?" (дізнався з Router Advertisement)":""))});
      const pr=N.peer(dev,"Fa0"); const e=(pr?domain({dev:pr.dev,port:pr.port,tag:null},{l2check:true,noDai:true,origin:{mac:hostMac(dev)}}):[]).find(x=>x.dev!==dev&&v6of(x).some(a=>v6eq(a,target)));
      if(!e) return {ok:false,arp:true,why:"NDP для "+target+" без відповіді"}; ndp(c,dev,target,e);
      const nd=N.dev[e.dev]; if(isHost(nd)) return owns6(e.dev,pkt.dst)?{ok:true,dev:e.dev,pkt}:{ok:false,why:"?"}; return routerIn6(e.dev,e.ifn,pkt,c); }
    return routerIn6(dev,null,pkt,c); }
  function src6(dev,dst){ const d=N.dev[dev]; if(isHost(d)){ const h=hostV6(d); return h&&h.addr; } const r=lookup6(d,dst); let ifn=r&&r.ifn; if(r&&!ifn&&r.nh){ const i=Object.values(d.ifs).find(i=>(i.v6||[]).some(x=>v6same(x.addr,r.nh,x.len))); ifn=i&&i.name; } const i=ifn&&d.ifs[ifn]; const g=i&&(i.v6||[])[0]; return g?g.addr:null; }
  N.flow6=(from,dst)=>{ const tr=N.counting; const src=src6(from,dst); if(!src) return {ok:false,why:from+": немає IPv6-адреси / маршруту",hops:[]};
    const c={hops:[],ttl:16,tr:tr?[]:null}; const pkt={src,dst,proto:"icmpv6",v6:true}; const f=originate6(from,pkt,c);
    const save=(res,back)=>{ if(tr) N.lastFlow={from,dst,proto:"icmp",ok:res.ok,why:res.why,fwd:c.tr,back:back||[]}; return res; };
    if(!f.ok) return save(Object.assign(f,{hops:c.hops}));
    const c2={hops:[],ttl:16,tr:tr?[]:null}; const b=originate6(f.dev,{src:dst,dst:src,proto:"icmpv6",reply:true,v6:true},c2);
    if(!b.ok) return save({ok:false,why:"Запит дійшов до "+f.dev+", але відповідь не повертається: "+b.why,back:true,hops:c.hops},c2.tr);
    return save({ok:b.dev===from,hops:c.hops,dev:f.dev,why:b.dev===from?null:"Відповідь прийшла не туди"},c2.tr); };
  N.ping6Cli=(s,dst)=>{ N.counting=true; const r=N.flow6(s.devName,dst); N.counting=false; return "Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to "+dst+", timeout is 2 seconds:\n"+(r.ok?"!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/1/3 ms":(r.noroute?"UUUUU":".....")+"\nSuccess rate is 0 percent (0/5)\n! "+r.why); };
  // ---------- таблиця MAC, діагностика OSPF ----------
  N.macTable=s=>{ const rows=[]; const seen=new Set();
    for(const v of Object.keys(s.vlans).map(Number)){ for(const e of domain({sw:s.devName,v})){ const first=(e.path||[])[0]; if(!first||first.dev!==s.devName||!first.out||String(first.out).startsWith("Vlan")) continue;
        const mac=e.mac||(isHost(N.dev[e.dev])?macOf(e.dev,"Fa0"):macOf(e.dev,e.ifn)); const k=v+"|"+mac; if(seen.has(k)) continue; seen.add(k); rows.push([v,mac,first.out]); } }
    rows.sort((a,b)=>a[0]-b[0]||a[2].localeCompare(b[2],undefined,{numeric:true})); for(const x of s.macStatic||[]){ const k=x.v+"|"+x.mac; const ix=rows.findIndex(r=>r[0]+"|"+r[1]===k); if(ix>=0) rows.splice(ix,1); rows.unshift([x.v,x.mac,x.port,"STATIC"]); }
    return "          Mac Address Table\n-------------------------------------------\n\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n"+rows.map(r=>String(r[0]).padStart(4)+"    "+r[1].padEnd(18)+(r[3]||"DYNAMIC").padEnd(12)+r[2]).join("\n")+"\nTotal Mac Addresses for this criterion: "+rows.length; };
  N.ospfDebug=s=>{ ospfSegments(); const mine=N.ospfIssues.filter(x=>x.startsWith(s.devName+" ↔ ")); if(!s.ospf) return "OSPF не запущено";
    if(!mine.length) return "*OSPF-ADJ: Сусідства на "+s.devName+" встановлюються без помилок ("+N.ospfNeighbors(s.devName).length+" сусід(ів))";
    return mine.map(x=>{ const [pair,why]=x.split(": "); const nb=pair.split(" ↔ ")[1];
      return why.split("; ").map(w=>/hello|dead/.test(w)?"*OSPF-ADJ: Rcv pkt from "+nb+" : Mismatched hello parameters from neighbor ("+w+")":/області|area/.test(w)?"*OSPF-ADJ: Rcv pkt from "+nb+", area mismatch ("+w+")":/підмереж|mask/.test(w)?"*OSPF-ADJ: Rcv pkt from "+nb+" : Mismatched mask / network ("+w+")":/Router ID/.test(w)?"%OSPF-4-DUP_RTRID_NBR: OSPF detected duplicate router-id ("+w+")":/пасивн/.test(w)?"*OSPF-ADJ: "+w+" — hello не надсилаються":/ACL/.test(w)?"*OSPF-ADJ: Hello від "+nb+" не отримано — "+w:"*OSPF-ADJ: "+w).join("\n"); }).join("\n"); };
  N.ping=(a,b)=>N.flow(a,b,"icmp");
  N.pingCli=(s,dst,o)=>{ o=o||{}; let src=null;
    if(o.src){ const n=normIf(o.src); if(n&&s.ifs[n]){ src=s.ifs[n].ip; if(!src) return "% Invalid source interface - IP not enabled"; } else if(ipRe.test(o.src)){ if(!Object.values(s.ifs).some(i=>i.ip===o.src)) return "% Invalid source address- IP address not on any of our up interfaces"; src=o.src; } else return INV; }
    N.counting=true; const r=N.flow(s.devName,dst,"icmp",null,src); N.counting=false; const n=o.repeat||5, sz=o.size||100;
    const head="Type escape sequence to abort.\nSending "+n+", "+sz+"-byte ICMP Echos to "+dst+", timeout is 2 seconds:\n"+(src?"Packet sent with a source address of "+src+" \n":"");
    const wrap=t=>t.match(/.{1,70}/g).join("\n");
    if(r.ok){ const first=r.hops.length&&!src?".":"!"; const okc=first==="."?n-1:n; return head+wrap(first+"!".repeat(Math.max(0,n-1)))+"\nSuccess rate is "+Math.round(okc/n*100)+" percent ("+okc+"/"+n+"), round-trip min/avg/max = 1/2/4 ms"; }
    return head+wrap((r.noroute||r.acl?"U":".").repeat(n))+"\nSuccess rate is 0 percent (0/"+n+")\n! "+r.why; };
  N.traceCli=(s,dst)=>{ const r=N.ping(s.devName,dst); let o="Type escape sequence to abort.\nTracing the route to "+dst+"\nVRF info: (vrf in name/id, vrf out name/id)\n"; const hops=(r.hops||[]).slice(); if(r.ok) hops.push(dst); hops.forEach((h,k)=>o+="  "+(k+1)+" "+h+" 1 msec 1 msec 1 msec\n"); if(!r.ok) o+="  "+(hops.length+1)+"  *  *  *\n! "+r.why; return o; };
  // ---------- DHCP ----------
  const poolFor=(d,gi)=> d.dhcp? Object.values(d.dhcp.pools).find(p=>p.net&&sameNet(p.net,gi,p.mask)) : null;
  function allocate(d,pool,client){
    for(const [ip,b] of Object.entries(d.dhcp.bind)) if(b.client===client&&b.pool===pool.name) return ip;
    const lo=ipToN(pool.net)+1, hi=((ipToN(pool.net)|~ipToN(pool.mask))>>>0)-1; const own=new Set(Object.values(d.ifs).map(i=>i.ip).filter(Boolean));
    const taken=new Set(Object.values(N.dev).filter(x=>isHost(x)&&x.ip&&x.name!==client).map(x=>x.ip));
    for(let n=lo;n<=hi;n++){ const ip=n2ip(n); if(d.dhcp.excl.some(([a,b])=>n>=ipToN(a)&&n<=ipToN(b))) continue; if(d.dhcp.bind[ip]||own.has(ip)||taken.has(ip)) continue;
      d.dhcp.bind[ip]={client,pool:pool.name,cid:"0100.50"+(79+client.length).toString(16)+"."+(client.charCodeAt(client.length-1)).toString(16).padStart(2,"0")+"11.22"}; return ip; }
    return null; }
  N.dhcp=pcName=>{
    const pc=N.dev[pcName]; const pr=N.peer(pcName,"Fa0"); const pcMac=macOf(pcName,"Fa0"); const dom=pr?domain({dev:pr.dev,port:pr.port,tag:null},{l2check:true,noDai:true,origin:{mac:pcMac}}):[]; let why=(dom.blocked||[]).length&&!dom.length? dom.blocked[0].why : null;
    const snoopBlock=(e,d,ifc)=>{ let o82=null; for(const h of e.path||[]){ const sw=N.dev[h.dev]; const sp=sw&&sw.snoop; if(!sp||!sp.on||!sp.vlans.includes(h.v)) continue;
        if(h.out&&isPhys(h.out)&&!(sw.ifs[h.out]||{}).dhcpTrust) return sw.devName+": DHCP snooping відкинув DHCPOFFER від "+e.dev+" — він прийшов на недовірений порт "+longIf(h.out)+" (VLAN "+h.v+"). Довіреними (ip dhcp snooping trust) мають бути лише порти в бік справжнього DHCP-сервера/relay";
        if(sp.opt82) o82=sw.devName; }
      if(o82&&!ifc.relayTrusted&&!d.relayTrustAll) return e.dev+" відкидає DHCP-запит: комутатор "+o82+" вставив опцію 82, а giaddr = 0.0.0.0 — IOS-сервер/relay вважає такий пакет недовіреним. Рішення: no ip dhcp snooping information option на "+o82+" (або ip dhcp relay information trusted на "+e.dev+" "+longIf(e.ifn)+")";
      return null; };
    for(const e of dom){ if(e.kind==="pc") continue; const d=N.dev[e.dev]; const ifc=d.ifs[e.ifn]; if(!ifc||!ifc.ip||ifc.ip!==e.ip) continue; const gi=ifc.ip; let srv=null;
      const local=poolFor(d,gi); if(local) srv={dev:e.dev,pool:local};
      else if(ifc.helper&&ifc.helper.length){ for(const h of ifc.helper){ const c={hops:[],ttl:16}; const f=originate(e.dev,{src:gi,dst:h,proto:"udp",dport:67,sport:67},c); if(!f.ok){ why="DHCP relay "+e.dev+" → "+h+": "+f.why; continue; }
          const sd=N.dev[f.dev]; const p=poolFor(sd,gi); if(!p){ why="DHCP-сервер "+h+" ("+f.dev+") не має пулу для мережі "+gi+"/"+maskLen(ifc.mask); continue; }
          const b=originate(f.dev,{src:f.pkt.dst,dst:gi,proto:"udp",dport:67,sport:67,reply:true},{hops:[],ttl:16}); if(!b.ok){ why="Відповідь DHCP-сервера не доходить до relay "+gi+": "+b.why; continue; } srv={dev:f.dev,pool:p}; break; } }
      if(srv){ const sb=snoopBlock(e,d,ifc); if(sb){ why=sb; continue; } const ip=allocate(N.dev[srv.dev],srv.pool,pcName); if(ip) for(const h of e.path||[]){ const sw=N.dev[h.dev]; const sp=sw&&sw.snoop; if(sp&&sp.on&&sp.vlans.includes(h.v)&&h.inp&&isPhys(h.inp)) sp.bind[pcMac]={mac:pcMac,ip,vlan:h.v,port:h.inp}; } if(!ip) return {ok:false,why:"Пул "+srv.pool.name+" на "+srv.dev+" вичерпано або всі адреси виключено"}; Object.assign(pc,{ip,mask:srv.pool.mask,gw:srv.pool.gw||null,dns:srv.pool.dns||null,opt43:srv.pool.opt43||null,dhcpSrv:N.dev[srv.dev]===d?gi:(ifc.helper[0])}); return {ok:true}; }
    }
    pc.ip=null; return {ok:false,why:why||"Жоден DHCP-сервер не відповів у цьому сегменті: на шлюзі немає пулу для цієї мережі і не задано ip helper-address"}; };
  N.release=pcName=>{ const pc=N.dev[pcName]; const mac=macOf(pcName,"Fa0"); for(const d of Object.values(N.dev)) if(d.snoop&&d.snoop.bind) delete d.snoop.bind[mac]; for(const d of Object.values(N.dev)) if(!isHost(d)&&d.dhcp) for(const [ip,b] of Object.entries(d.dhcp.bind)) if(b.client===pcName) delete d.dhcp.bind[ip]; pc.ip=null; pc.mask=null; pc.gw=null; };
  N.cdp=(s)=>{ let o="Capability Codes: R - Router, S - Switch, H - Host\n\nDevice ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\n";
    for(const l of N.links){ let me,pm,ot,po; if(l.a===s.devName){me=l.pa;ot=l.b;po=l.pb;} else if(l.b===s.devName){me=l.pb;ot=l.a;po=l.pa;} else continue;
      const od=N.dev[ot]; if(isHost(od)||od.type==="hub"||(s.svc&&s.svc.cdp===false)||s.ifs[me].cdpOff||(od.svc&&od.svc.cdp===false)||(od.ifs[po]&&od.ifs[po].cdpOff)||s.ifs[me].shutdown||(od.ifs[po]&&od.ifs[po].shutdown)) continue;
      o+=ot.padEnd(17)+longIf(me).replace("GigabitEthernet","Gig ").replace("FastEthernet","Fas ").padEnd(18)+"170        "+(od.type==="router"?"R":"S I").padEnd(12)+(od.type==="router"?"ISR4321":"WS-C2960").padEnd(10)+longIf(po).replace("GigabitEthernet","Gig ").replace("FastEthernet","Fas ")+"\n"; }
    return o; };
  // ---------- STP між комутаторами ----------
  N.stp=(v)=>{
    const sws=Object.values(N.dev).filter(d=>d.type==="switch"&&d.vlans[v]); if(!sws.length) return null;
    const bid=d=>({p:(d.stpPrio[v]!==undefined?d.stpPrio[v]:32768)+v,mac:d.mac});
    const cmpB=(a,b)=>a.p-b.p||(a.mac<b.mac?-1:a.mac>b.mac?1:0);
    const lport=(d,p)=>{ const i=d.ifs[p]; return i&&i.chGroup&&i._ec==="P"? "Po"+i.chGroup : p; };
    let edges=[]; const seenE=new Set();
    for(const l of N.links){ const A=N.dev[l.a],B=N.dev[l.b]; if(!isSw(A)||!isSw(B)||!A.vlans[v]||!B.vlans[v]) continue;
      if(!carries(A,eff(A,l.pa),v,true)||!carries(B,eff(B,l.pb),v,true)) continue;
      const pa=lport(A,l.pa), pb=lport(B,l.pb); const k=l.a+"|"+pa+"|"+l.b+"|"+pb; if(seenE.has(k)) continue; seenE.add(k);
      edges.push({a:l.a,pa,b:l.b,pb,ca:stpPortCost(A,pa),cb:stpPortCost(B,pb)}); }
    const compute=edges=>{
    // root обирається окремо в кожному зв'язному сегменті (відрізаний комутатор — сам собі root)
    const comp={}; let nc=0; for(const d of sws){ if(comp[d.devName]!==undefined) continue; const st=[d.devName]; comp[d.devName]=nc;
      while(st.length){ const u=st.pop(); for(const e of edges){ const o=e.a===u?e.b:e.b===u?e.a:null; if(o!==null&&comp[o]===undefined){ comp[o]=nc; st.push(o); } } } nc++; }
    const rootOf={}; for(const d of sws){ const r=rootOf[comp[d.devName]]; if(!r||cmpB(bid(d),bid(r))<0) rootOf[comp[d.devName]]=d; }
    const dist={}; sws.forEach(d=>dist[d.devName]=rootOf[comp[d.devName]]===d?0:Infinity); const done=new Set();
    while(true){ let u=null; for(const d of sws) if(!done.has(d.devName)&&(u===null||dist[d.devName]<dist[u])) u=d.devName; if(u===null||dist[u]===Infinity) break; done.add(u);
      for(const e of edges){ if(e.a===u&&dist[u]+e.cb<dist[e.b]) dist[e.b]=dist[u]+e.cb; if(e.b===u&&dist[u]+e.ca<dist[e.a]) dist[e.a]=dist[u]+e.ca; } }
    const info={}; sws.forEach(d=>{ const r=rootOf[comp[d.devName]]; info[d.devName]={root:bid(r),rootName:r.devName,cost:dist[d.devName],roles:{},rootPort:null,costs:{},cands:[]}; });
    for(const d of sws){ if(rootOf[comp[d.devName]]===d||dist[d.devName]===Infinity) continue;
      const opts=[]; for(const e of edges){ let pm,mc,ot,po; if(e.a===d.devName){pm=e.pa;mc=e.ca;ot=e.b;po=e.pb;} else if(e.b===d.devName){pm=e.pb;mc=e.cb;ot=e.a;po=e.pa;} else continue;
        opts.push({pm,ot,po,c:dist[ot]+mc,nb:bid(N.dev[ot]),npid:stpPortId(N.dev[ot],po),mpid:stpPortId(d,pm)}); }
      opts.sort((x,y)=>x.c-y.c||cmpB(x.nb,y.nb)||x.npid.pr-y.npid.pr||x.npid.num-y.npid.num||x.mpid.pr-y.mpid.pr||x.mpid.num-y.mpid.num);
      info[d.devName].cands=opts.map(o=>({port:o.pm,via:o.ot,viaPort:o.po,cost:o.c,nb:o.nb,npid:o.npid}));
      if(opts[0]&&opts[0].c===dist[d.devName]) info[d.devName].rootPort=opts[0].pm; }
    for(const e of edges){ const A=info[e.a],B=info[e.b]; A.costs[e.pa]=e.ca; B.costs[e.pb]=e.cb;
      const ia=stpPortId(N.dev[e.a],e.pa), ib=stpPortId(N.dev[e.b],e.pb);
      const aDesg= A.cost<B.cost || (A.cost===B.cost && (cmpB(bid(N.dev[e.a]),bid(N.dev[e.b]))<0 || (e.a===e.b&&(ia.pr-ib.pr||ia.num-ib.num)<0)));
      const set=(dn,p,isD)=>{ const I=info[dn]; I.roles[p]= I.rootPort===p? ["Root","FWD"] : isD? ["Desg","FWD"] : ["Altn","BLK"]; };
      set(e.a,e.pa,aDesg); set(e.b,e.pb,!aDesg); }
      return info; };
    let info=compute(edges); const inc=[];
    for(let it=0;it<8;it++){ const bad=[]; for(const e of edges) for(const [dn,p] of [[e.a,e.pa],[e.b,e.pb]]){ const i=N.dev[dn].ifs[p]; const r=info[dn].roles[p]; if(i&&i.stpGuard==="root"&&r&&r[0]!=="Desg") bad.push([e,dn,p]); }
      if(!bad.length) break; for(const [e,dn,p] of bad){ edges=edges.filter(x=>x!==e); inc.push([dn,p,e]); } info=compute(edges); }
    for(const [dn,p,e] of inc){ const I=info[dn]; I.roles[p]=["Desg","BKN"]; I.costs[p]=e.a===dn?e.ca:e.cb; (I.rootInc=I.rootInc||[]).push(p); }
    info._edges=edges; return info; };

  // ---------- OSPFv3 (класичний режим: ipv6 router ospf + ipv6 ospf <pid> area <a> на інтерфейсі) ----------
  const o6rid=d=>d.ospf6? (d.ospf6.rid||autoRid(d)||null) : null;
  N.ospf6Rid=s=>o6rid(s)||"0.0.0.0";
  const o6on=(d,i)=>!!(d.ospf6&&d.v6routing&&i.ospf6&&i.ospf6.pid===d.ospf6.pid&&v6on(i)&&ifStatus(d,i)[1]==="up");
  const o6cost=(d,i)=>i.ospf6Cost||(i.loop?1:Math.max(1,Math.floor((d.ospf6.refbw||100)*1000/ifBw(i))));
  function ospf6Seg(){ const nb={}, issues=[]; const rs=Object.values(N.dev).filter(d=>!isHost(d)&&d.type!=="hub"&&d.ospf6&&d.v6routing&&o6rid(d));
    for(const d of rs) nb[d.devName]=[];
    for(const d of rs) for(const i of Object.values(d.ifs)){ if(!o6on(d,i)||i.loop||d.ospf6.passive.includes(i.name)) continue;
      for(const e of fromIface(d,i.name,{noVip:true})){ if(e.kind==="pc"||e.dev===d.devName) continue; const o=N.dev[e.dev]; const j=o.ifs[e.ifn]; if(!rs.includes(o)||!j||!o6on(o,j)||o.ospf6.passive.includes(j.name)) continue;
        if(nb[d.devName].some(n=>n.dev===e.dev&&n.ifn===j.name)) continue;
        if(i.ospf6.area!==j.ospf6.area){ issues.push(d.devName+" ↔ "+e.dev+": різні області OSPFv3"); continue; } if(o6rid(d)===o6rid(o)){ issues.push(d.devName+" ↔ "+e.dev+": однаковий router-id"); continue; }
        nb[d.devName].push({dev:e.dev,myIf:i.name,ifn:j.name,ll:j.llStatic||v6ll(o,j),rid:o6rid(o),prio:j.ospf6Prio!=null?j.ospf6Prio:1,cost:o6cost(d,i)}); } }
    const role={};
    for(const d of rs) for(const i of Object.values(d.ifs)){ if(!o6on(d,i)) continue; const k=d.devName+"|"+i.name; if(i.loop){ role[k]="LOOP"; continue; } const mine=nb[d.devName].filter(n=>n.myIf===i.name);
      const mem=[{dev:d.devName,rid:o6rid(d),prio:i.ospf6Prio!=null?i.ospf6Prio:1}].concat(mine.map(n=>({dev:n.dev,rid:n.rid,prio:n.prio}))); const el=mem.filter(m=>m.prio>0).sort((a,b)=>b.prio-a.prio||ipToN(b.rid)-ipToN(a.rid)); const dr=el[0], bdr=el[1];
      role[k]=dr&&dr.dev===d.devName?"DR":bdr&&bdr.dev===d.devName?"BDR":"DROTHER";
      for(const n of mine){ n.role=dr&&n.dev===dr.dev?"DR":bdr&&n.dev===bdr.dev?"BDR":"DROTHER"; n.full=role[k]!=="DROTHER"||n.role!=="DROTHER"; } }
    N.ospf6Issues=issues; return {nb,role,rs}; }
  function ospf6Tables(){ const {nb,rs}=ospf6Seg(); const T={}; const pref=[];
    for(const d of rs) for(const i of Object.values(d.ifs)) if(o6on(d,i)) for(const x of i.v6||[]) pref.push({dev:d.devName,pfx:v6fmt(v6net(v6parse(x.addr),x.len)),len:x.len,cost:o6cost(d,i)});
    for(const src of rs){ const dist={}, first={}; for(const d of rs){ dist[d.devName]=Infinity; first[d.devName]=[]; } dist[src.devName]=0; const done=new Set();
      while(true){ let u=null; for(const d of rs) if(!done.has(d.devName)&&dist[d.devName]<Infinity&&(u===null||dist[d.devName]<dist[u])) u=d.devName; if(u===null) break; done.add(u);
        for(const n of nb[u].filter(n=>n.full)){ const nd=dist[u]+n.cost; const fh=u===src.devName?[{nh:n.ll,ifn:n.myIf}]:first[u];
          if(nd<dist[n.dev]){ dist[n.dev]=nd; first[n.dev]=fh.slice(); } else if(nd===dist[n.dev]){ for(const h of fh) if(!first[n.dev].some(x=>x.nh===h.nh)) first[n.dev].push(h); } } }
      const own=new Set(Object.values(src.ifs).filter(i=>ifStatus(src,i)[1]==="up").flatMap(i=>(i.v6||[]).map(x=>v6fmt(v6net(v6parse(x.addr),x.len))+"/"+x.len)));
      const best={}; for(const p of pref){ if(p.dev===src.devName||dist[p.dev]===Infinity) continue; const k=p.pfx+"/"+p.len; if(own.has(k)) continue; const c=dist[p.dev]+p.cost;
        if(!best[k]||c<best[k].cost) best[k]={pfx:p.pfx,len:p.len,cost:c,hops:first[p.dev].slice()}; }
      for(const d of rs){ if(d===src||dist[d.devName]===Infinity||!d.ospf6.defOrig) continue; const has=d.ospf6.defAlways||activeStatics6(d).some(r=>r.len===0); if(has&&!best["::/0"]) best["::/0"]={pfx:"::",len:0,cost:1,e2:true,hops:first[d.devName].slice()}; }
      T[src.devName]=Object.values(best).filter(r=>r.hops.length); }
    return T; }
  N.ospf6Routes=dn=>{ const d=N.dev[dn]; if(!d||!d.ospf6) return []; return ospf6Tables()[dn]||[]; };
  N.ospf6Neighbors=dn=>(ospf6Seg().nb[dn]||[]);
  N.ospf6NbrShow=s=>{ if(!s.ospf6) return ""; const {nb}=ospf6Seg(); if(!o6rid(s)) return "%OSPFv3: router-id не обрано — процес не працює (задайте router-id)";
    let o="\n            OSPFv3 Router with ID ("+o6rid(s)+") (Process ID "+s.ospf6.pid+")\n\nNeighbor ID     Pri   State           Dead Time   Interface ID    Interface\n";
    for(const n of nb[s.devName]||[]) o+=n.rid.padEnd(16)+String(n.prio).padStart(3)+"   "+((n.full?"FULL/":"2WAY/")+n.role).padEnd(16)+"00:00:3"+(n.dev.length%10)+"    "+String(3+Number(n.ifn.split("/")[1]||0)).padEnd(16)+longIf(n.myIf)+"\n"; return o; };
  N.ospf6IfBrief=s=>{ const {nb,role}=ospf6Seg(); let o="Interface    PID   Area            Intf ID    Cost  State Nbrs F/C\n";
    for(const i of Object.values(s.ifs)){ if(!i.ospf6) continue; const on=o6on(s,i)&&!!o6rid(s); const mine=(nb[s.devName]||[]).filter(n=>n.myIf===i.name);
      o+=i.name.padEnd(13)+String(i.ospf6.pid).padEnd(6)+String(i.ospf6.area).padEnd(16)+String(3+Number(i.name.split("/")[1]||0)).padEnd(11)+String(on?o6cost(s,i):"").padEnd(6)+(on?(role[s.devName+"|"+i.name]||"DR"):"DOWN").padEnd(6)+mine.filter(n=>n.full).length+"/"+mine.length+"\n"; } return o; };
  // ---------- GRE-тунелі ----------
  N.tunnelUp=(s,i)=>{ if(!i.tunSrc||!i.tunDst||s._tunEval) return false; const si=s.ifs[i.tunSrc]; if(si&&ifStatus(s,si)[1]!=="up") return false; if(!si&&!ipRe.test(i.tunSrc)) return false;
    s._tunEval=true; try{ return !!lookup(s,i.tunDst); } finally{ s._tunEval=false; } };
  function tunnelPeer(d,i){ if(!N.tunnelUp(d,i)) return null; const srcIp=d.ifs[i.tunSrc]?d.ifs[i.tunSrc].ip:i.tunSrc;
    for(const o of Object.values(N.dev)){ if(isHost(o)||o===d||!o.ifs) continue; for(const j of Object.values(o.ifs)){ if(!j.tunnel||!j.ip||j.shutdown) continue; const js=o.ifs[j.tunSrc]?o.ifs[j.tunSrc].ip:j.tunSrc;
        if(js!==i.tunDst||j.tunDst!==srcIp||!N.tunnelUp(o,j)) continue; if(d._tunFlow) return null; d._tunFlow=true; let ok=false; try{ ok=N.flow(d.devName,i.tunDst,"icmp",null,srcIp).ok; } finally{ d._tunFlow=false; } return ok?{d:o,i:j}:null; } }
    return null; }
  // ---------- AAA: вхід на vty, SCP/SFTP/TFTP ----------
  N.aaaReach=(s,ip,proto,port)=>N.flow(s.devName,ip,proto,port).ok;
  N.login=(dn,user)=>{ const s=N.dev[dn]; const L=s.vty; const loc=()=>!!s.users[user];
    if(!s.aaa||!s.aaa.on){ if(L.login==="local") return loc()?{ok:true,method:"локальна база (login local)"}:{ok:false,why:"користувача "+user+" немає в локальній базі"};
      if(L.login==="line"&&L.password) return {ok:true,method:"пароль лінії vty"}; return {ok:false,why:"на line vty немає login — % Password required, but none set"}; }
    const list=s.aaa.login[L.authList||"default"]; if(!list) return loc()?{ok:true,method:"локальна база (aaa new-model без списку методів → local)"}:{ok:false,why:"aaa new-model без списку методів: діє локальна база, а в ній немає "+user};
    const tried=[];
    for(const m of list){
      if(m==="local") return loc()?{ok:true,method:"локальна база"+(tried.length?" — після помилок: "+tried.join("; "):"")}:{ok:false,why:"локальна база: немає користувача "+user+(tried.length?" (до цього: "+tried.join("; ")+")":"")};
      if(m==="none") return {ok:true,method:"none — вхід без автентифікації (небезпечно!)"};
      if(m==="tacacs+"||m==="radius"){ const srvs=Object.entries(m==="tacacs+"?(s.tacacs||{}):(s.radius||{})).filter(([,x])=>x.ip); if(!srvs.length){ tried.push(m+": сервери не задано"); continue; }
        for(const [n,x] of srvs){ const port=m==="tacacs+"?(x.port||49):(x.auth||1812), proto=m==="tacacs+"?"tcp":"udp"; const sv=Object.values(N.dev).find(h=>isHost(h)&&h.ip===x.ip);
          if(!sv||!sv.aaa||!N.flow(dn,x.ip,proto,port).ok){ tried.push((m==="tacacs+"?"TACACS+ ":"RADIUS ")+n+" ("+x.ip+") не відповідає"); continue; }
          if(sv.aaa.key!==x.key){ tried.push((m==="tacacs+"?"TACACS+ ":"RADIUS ")+n+": ключ не збігається, сервер відкидає запити"); continue; }
          if((sv.aaa.users||[]).includes(user)) return {ok:true,method:(m==="tacacs+"?"TACACS+ ":"RADIUS ")+n+" ("+x.ip+")"+(tried.length?" — після: "+tried.join("; "):"")};
          return {ok:false,why:(m==="tacacs+"?"TACACS+ ":"RADIUS ")+n+" відхилив користувача "+user+". Це остаточна відмова: наступні методи (local) не перевіряються"}; } } }
    return {ok:false,why:"жоден метод не спрацював: "+tried.join("; ")}; };
  N.fileCopy=(s,url,src)=>{ const m=url.match(/^(scp|sftp|tftp|ftp):\/\/(?:([^@/]+)@)?((?:\d{1,3}\.){3}\d{1,3})(\/[^\s]*)?$/i); if(!m) return "%Error parsing filename (Invalid argument)";
    const pr=m[1].toLowerCase(), ip=m[3], file=(m[4]||"/"+s.hostname.toLowerCase()+"-confg").slice(1), port={scp:22,sftp:22,tftp:69,ftp:21}[pr], proto=pr==="tftp"?"udp":"tcp";
    const head="Address or name of remote host ["+ip+"]? \n"+(pr==="tftp"?"":"Destination username ["+(m[2]||"admin")+"]? \n")+"Destination filename ["+file+"]? \n";
    N.counting=true; const r=N.flow(s.devName,ip,proto,port); N.counting=false;
    if(!r.ok) return head+"%Error opening "+url+" ("+(r.refused?"Connection refused — на сервері не слухає "+pr.toUpperCase():"Timed out")+")\n! "+r.why;
    s.lastCopy={url,ok:true,ts:Date.now()};
    return head+(pr==="tftp"?"!!":"Sending file modes: C0644 1834 "+file+"\n!")+"\n1834 bytes copied in 0.412 secs (4451 bytes/sec)"+(pr==="tftp"||pr==="ftp"?"\n! Тренажер: "+pr.toUpperCase()+" передає конфігурацію відкритим текстом. Для v2.0 використовуйте SCP або SFTP.":""); };
  // ---------- DNS ----------
  const dnsN=x=>String(x||"").toLowerCase().replace(/\.$/,"");
  N.dnsQuery=(from,name,type,server)=>{ const fd=N.dev[from]; const sip=server||(fd.dns?String(fd.dns).split(/\s+/)[0]:null); if(!sip) return {ok:false,why:"не задано DNS-сервер (ipconfig /dns <IP> або DNS з DHCP)",server:null};
    const sv=Object.values(N.dev).find(h=>isHost(h)&&h.ip===sip); const r=N.flow(from,sip,"udp",53); if(!r.ok) return {ok:false,timeout:true,why:"DNS-сервер "+sip+" недосяжний: "+r.why,server:sip};
    if(!sv||!sv.zone) return {ok:false,timeout:true,why:"на "+sip+" немає DNS-служби",server:sip};
    const Z=sv.zone; const t=(type||"A").toUpperCase(); const out=[]; let n=dnsN(name);
    if(t==="PTR"){ const p=Z.find(x=>x.t==="PTR"&&x.n===n); return p?{ok:true,server:sip,sname:sv.name.toLowerCase(),answers:[{t:"PTR",n,v:p.v}]}:{ok:false,nx:true,server:sip,sname:sv.name.toLowerCase()}; }
    for(let k=0;k<6;k++){ const cn=Z.find(x=>x.t==="CNAME"&&dnsN(x.n)===n); if(cn&&t!=="CNAME"){ out.push({t:"CNAME",n,v:dnsN(cn.v)}); n=dnsN(cn.v); continue; } break; }
    const hit=Z.filter(x=>x.t===t&&dnsN(x.n)===n); for(const h of hit) out.push({t,n,v:h.v});
    if(!hit.length&&!out.length) return {ok:false,nx:!Z.some(x=>dnsN(x.n)===dnsN(name)),server:sip,sname:sv.name.toLowerCase()};
    return {ok:true,server:sip,sname:sv.name.toLowerCase(),answers:out,final:n,found:hit.length>0}; };
  N.dump=()=>N;
  N.recompute();
  return N;
}
// Додаткові команди ПК/сервера: SSH з логіном, nslookup/dig, ping за іменем, Linux/macOS, stormtest, DNS-зона на сервері.
function pcExtra(pc,N,t,a,c){ const low=t.toLowerCase(); const isIp=x=>ipRe.test(x||"");
  const fmtMacDash=m=>m.replace(/\./g,"").toUpperCase().replace(/(..)(?=.)/g,"$1-"), fmtMacColon=m=>m.replace(/\./g,"").replace(/(..)(?=.)/g,"$1:");
  if(c==="stormtest"){ if(a[1]==="stop"){ pc.storm=false; return "Тренажер: broadcast-шторм від "+pc.name+" зупинено."; } pc.storm=true; return "Тренажер: "+pc.name+" почав генерувати broadcast-шторм (як при петлі або шкідливому ПЗ). Подивіться, що стало з мережею. Зупинити: stormtest stop"; }
  if(c==="ipconfig"&&(a[1]||"").toLowerCase()==="/dns"){ if(!isIp(a[2])) return "Приклад: ipconfig /dns 10.1.1.53"; pc.dns=a[2]; return "DNS-сервер: "+a[2]; }
  if(pc.type==="server"&&c==="dns"){ pc.zone=pc.zone||[]; const sub=(a[1]||"").toLowerCase();
    if(sub==="list"||!sub) return pc.zone.length? "Тип    Ім'я                         Значення\n"+pc.zone.map(z=>z.t.padEnd(7)+z.n.padEnd(29)+z.v).join("\n") : "Зона порожня. Додати: dns add A www.corp.lab 10.1.1.20";
    if(sub==="add"&&a.length>=5){ const ty=a[2].toUpperCase(); if(!["A","AAAA","CNAME","MX","NS","PTR"].includes(ty)) return "Тип: A, AAAA, CNAME, MX, NS, PTR";
      const v=a.slice(4).join(" "); if(ty==="A"&&!isIp(v)) return "Для A потрібна IPv4-адреса"; if(ty==="MX"&&!/^\d+\s+\S+$/.test(v)) return "Для MX: пріоритет і сервер, напр. dns add MX corp.lab 10 mail.corp.lab"; if(ty==="PTR"&&!isIp(a[3])) return "Для PTR ім'я — це IP-адреса: dns add PTR 10.1.1.20 web01.corp.lab";
      pc.zone=pc.zone.filter(z=>!(z.t===ty&&z.n===a[3].toLowerCase()&&(ty==="MX"||ty==="A"?z.v===v:true))); pc.zone.push({t:ty,n:a[3].toLowerCase(),v:ty==="MX"?v:v.toLowerCase()}); return "Додано: "+ty+" "+a[3]+" → "+v; }
    if(sub==="del"&&a.length>=4){ const ty=a[2].toUpperCase(), n=a[3].toLowerCase(); const b=pc.zone.length; pc.zone=pc.zone.filter(z=>!(z.t===ty&&z.n===n)); return b===pc.zone.length?"Запис не знайдено":"Видалено "+ty+" "+n; }
    return "dns list | dns add <тип> <ім'я> <значення> | dns del <тип> <ім'я>"; }
  if(c==="nslookup"){ let ty="A", rest=a.slice(1); if(rest[0]&&/^-(type|q|querytype)=/i.test(rest[0])){ ty=rest[0].split("=")[1].toUpperCase(); rest=rest.slice(1); } const name=rest[0], srv=rest[1];
    if(!name) return "Використання: nslookup [-type=A|AAAA|MX|CNAME|NS] ім'я [сервер] або nslookup <IP>"; if(isIp(name)) ty="PTR";
    N.counting=true; const r=N.dnsQuery(pc.name,name,ty,srv); N.counting=false; if(!r.server) return "*** Default servers are not available\n! "+r.why;
    const head="Server:  "+(r.sname||"UnKnown")+"\nAddress:  "+r.server+"\n\n";
    if(r.timeout) return "DNS request timed out.\n    timeout was 2 seconds.\n"+head.replace(r.sname||"UnKnown","UnKnown")+"*** Request to UnKnown timed-out\n! "+r.why;
    if(!r.ok) return head+"*** "+(r.sname||"UnKnown")+" can't find "+name+": "+(r.nx?"Non-existent domain":"No answer for "+ty);
    if(ty==="PTR") return head+"Name:    "+r.answers[0].v+"\nAddress:  "+name;
    if(ty==="MX") return head+r.answers.filter(x=>x.t==="MX").map(x=>name+"\tMX preference = "+x.v.split(/\s+/)[0]+", mail exchanger = "+x.v.split(/\s+/)[1]).join("\n");
    const fin=r.answers.filter(x=>x.t===ty), al=r.answers.filter(x=>x.t==="CNAME");
    if(!fin.length) return head+(al.length?"Name:    "+r.final+"\nAliases:  "+name+"\n! Тренажер: є CNAME, але для "+r.final+" немає запису "+ty:"*** "+r.sname+" can't find "+name+": No answer");
    return head+"Non-authoritative answer:\nName:    "+r.final+"\n"+(fin.length>1?"Addresses:  ":"Address:  ")+fin.map(x=>x.v).join("\n          ")+(al.length?"\nAliases:  "+name:""); }
  if(c==="dig"){ let rev=false, rest=a.slice(1).filter(x=>!x.startsWith("+")); if(rest[0]==="-x"){ rev=true; rest=rest.slice(1); } let srv=null; rest=rest.filter(x=>{ if(x.startsWith("@")){ srv=x.slice(1); return false; } return true; });
    const name=rest[0]; const ty=rev?"PTR":(rest[1]||"A").toUpperCase(); if(!name) return "Використання: dig ім'я [A|AAAA|MX|CNAME] [@сервер] або dig -x <IP>";
    N.counting=true; const r=N.dnsQuery(pc.name,name,ty,srv); N.counting=false; if(!r.server) return ";; no servers could be reached\n! "+r.why; if(r.timeout) return ";; connection timed out; no servers could be reached\n! "+r.why;
    const q=rev? name.split(".").reverse().join(".")+".in-addr.arpa." : name+".";
    return "; <<>> DiG 9.18 <<>> "+(rev?"-x ":"")+name+(rev?"":" "+ty)+"\n;; ->>HEADER<<- opcode: QUERY, status: "+(r.ok?"NOERROR":r.nx?"NXDOMAIN":"NOERROR")+"\n\n;; QUESTION SECTION:\n;"+q+"\t\tIN\t"+ty+"\n"+(r.ok?"\n;; ANSWER SECTION:\n"+r.answers.map(x=>(x.t==="PTR"?q:x.n+".")+"\t300\tIN\t"+x.t+"\t"+x.v+(/[a-z]$/i.test(x.v)?".":"")).join("\n")+"\n":"")+"\n;; SERVER: "+r.server+"#53("+r.server+") (UDP)"; }
  if(c==="ping"&&a[1]&&!isIp(a[1])&&/[a-z]/i.test(a[1])&&a[1].includes(".")&&v6parse(a[1])===null){ N.counting=true; const r=N.dnsQuery(pc.name,a[1],"A"); N.counting=false;
    if(!r.ok||!r.answers.some(x=>x.t==="A")) return "Ping request could not find host "+a[1]+". Please check the name and try again.\n! "+(r.why||(r.nx?"DNS: немає такого імені":"DNS: немає запису A"));
    const ip=r.answers.find(x=>x.t==="A").v; N.counting=true; const f=N.ping(pc.name,ip); N.counting=false; return "\nPinging "+a[1]+" ["+ip+"] with 32 bytes of data:\n"+(f.ok?Array(4).fill("Reply from "+ip+": bytes=32 time<1ms TTL="+(128-f.hops.length)).join("\n"):"Request timed out.\n! "+f.why); }
  if(c==="ssh"&&(a[1]==="-l"||/@/.test(a[1]||""))){ const user=a[1]==="-l"?a[2]:a[1].split("@")[0], ip=a[1]==="-l"?a[3]:a[1].split("@")[1]; if(!user||!isIp(ip)) return "Використання: ssh -l <користувач> <IP> або ssh користувач@IP";
    N.counting=true; const r=N.flow(pc.name,ip,"tcp",22); N.counting=false; if(!r.ok) return "ssh: connect to host "+ip+" port 22: "+(r.refused?"Connection refused":"Connection timed out")+"\n! "+r.why;
    const dev=Object.values(N.dev).find(d=>!(d.type==="pc"||d.type==="server")&&d.ifs&&Object.values(d.ifs).some(i=>i.ip===ip)); if(!dev) return "Password:\nWelcome, "+user;
    const L=N.login(dev.devName,user); return "Password: ********\n"+(L.ok? (dev.motd?"\n"+dev.motd+"\n\n":"\n")+dev.hostname+">\n(Тренажер: вхід як "+user+" — "+L.method+")" : "% Authentication failed\n\n[Connection to "+ip+" closed by foreign host]\n! "+L.why); }
  if((c==="ip"&&/^(a|addr|address)$/.test(a[1]||""))||c==="ifconfig"){ const h=N.hostV6(pc.name), mac=N.hostMac(pc.name);
    if(c==="ifconfig") return "en0: flags=8863<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> mtu 1500\n\tether "+fmtMacColon(mac)+"\n"+(pc.ip?"\tinet "+pc.ip+" netmask 0x"+ipToN(pc.mask).toString(16).padStart(8,"0")+"\n":"")+(h?"\tinet6 "+h.addr.toLowerCase()+" prefixlen 64\n":"")+"\tinet6 "+N.hostLL(pc.name).toLowerCase()+"%en0 prefixlen 64 scopeid 0x4\n\tstatus: active";
    return "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 state UNKNOWN\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\n    link/ether "+fmtMacColon(mac)+" brd ff:ff:ff:ff:ff:ff\n"+(pc.ip?"    inet "+pc.ip+"/"+maskLen(pc.mask)+" brd "+n2ipT((ipToN(pc.ip)|(~ipToN(pc.mask)>>>0))>>>0)+" scope global "+(pc.dhcp?"dynamic ":"")+"eth0\n":"")+(h?"    inet6 "+h.addr.toLowerCase()+"/64 scope global "+(h.slaac?"dynamic mngtmpaddr":"dynamic")+"\n":"")+"    inet6 "+N.hostLL(pc.name).toLowerCase()+"/64 scope link"; }
  if(c==="ip"&&/^(r|route)$/.test(a[1]||"")){ return (pc.gw?"default via "+pc.gw+" dev eth0 "+(pc.dhcp?"proto dhcp ":"")+"\n":"")+(pc.ip?n2ipT((ipToN(pc.ip)&ipToN(pc.mask))>>>0)+"/"+maskLen(pc.mask)+" dev eth0 proto kernel scope link src "+pc.ip:"(немає IPv4-адреси)"); }
  if(c==="netstat"&&/-r/.test(low)){ return "Routing tables\n\nInternet:\nDestination        Gateway            Flags        Netif\n"+(pc.gw?"default            "+pc.gw.padEnd(19)+"UGScg        en0\n":"")+(pc.ip?(n2ipT((ipToN(pc.ip)&ipToN(pc.mask))>>>0)+"/"+maskLen(pc.mask)).padEnd(19)+"link#4".padEnd(19)+"UCS          en0\n":""); }
  if(c==="route"&&/get default/.test(low)) return pc.gw? "   route to: default\ndestination: default\n       mask: default\n    gateway: "+pc.gw+"\n  interface: en0" : "route: writing to routing socket: not in table";
  if(c==="getmac"||(c==="ipconfig"&&false)) return fmtMacDash(N.hostMac(pc.name));
  return null; }
// Сесія ПК/сервера (командний рядок Windows)
function PCSession(pc,N){
  const fail=(r,ip)=>r.arp&&!r.back? "Reply from "+(pc.ip||"0.0.0.0")+": Destination host unreachable." : (r.noroute||r.acl)&&!r.back? "Reply from "+(pc.gw||pc.ip)+": Destination net unreachable." : "Request timed out.";
  const tcp=(ip,port,okText)=>{ N.counting=true; const r=N.flow(pc.name,ip,"tcp",port); N.counting=false; return r.ok? okText : (r.refused? "Connecting to "+ip+"... Could not open connection to the host, on port "+port+": Connect failed\n! "+r.why : "Connecting to "+ip+"... Could not open connection to the host, on port "+port+": Connect failed (timed out)\n! Підказка тренажера: "+r.why); };
  const HELP="Команди: ip a / ifconfig, ip route / netstat -rn, nslookup [-type=MX] ім'я, dig ім'я, ping ім'я, ssh -l користувач IP, ipconfig /dns IP, stormtest; на сервері: dns list|add|del. Також: ipconfig, ipconfig /all, ipconfig /renew, ipconfig /release, ipconfig /static <IP> <маска> [шлюз], ipconfig /dhcp, ipconfig /static6 <IPv6>/<len> [шлюз], ipconfig /slaac, ping <IP>, tracert <IP>, curl <IP> (HTTP, TCP 80), ssh <IP> (TCP 22), telnet <IP> (TCP 23)";
  return { state:pc, prompt(){ return "C:\\>"; },
    exec(line){ const t=line.trim(); if(!t) return ""; const a=t.split(/\s+/); const c=a[0].toLowerCase(); const arg=(a[1]||"").replace(/^https?:\/\//i,"").replace(/^.*@/,"").replace(/\/.*$/,"");
      { const x=pcExtra(pc,N,t,a,c); if(x!==null) return x; }
      const setStatic=(ip,mask,gw)=>{ if(!ipRe.test(ip)||!ipRe.test(mask)||(gw&&!ipRe.test(gw))) return "Невірні параметри. Приклад: ipconfig /static 192.168.1.10 255.255.255.0 192.168.1.1"; N.release(pc.name); Object.assign(pc,{ip,mask,gw:gw||null,dhcp:false}); return "Ethernet0: статична адреса "+ip+" / "+mask+(gw?", шлюз "+gw:""); };
      if(c==="netsh"&&/set address/i.test(t)){ const m=t.match(/static\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i); if(m) return setStatic(m[1],m[2],m[3]); if(/dhcp/i.test(t)){ pc.dhcp=true; pc.ip=null; return "Ethernet0: DHCP увімкнено (виконайте ipconfig /renew)"; } }
      if(c==="ipconfig"&&(a[1]||"").toLowerCase()==="/static") return setStatic(a[2],a[3],a[4]);
      if(c==="ipconfig"&&(a[1]||"").toLowerCase()==="/static6"){ const P=v6pfx(a[2]||""); if(!P||(a[3]&&v6parse(a[3])===null)) return "Приклад: ipconfig /static6 2001:db8:acad:2::10/64 fe80::1"; pc.ip6={addr:P.addr,len:P.len,gw:a[3]?v6fmt(v6parse(a[3])):null}; pc.slaac=false; return "Ethernet0: IPv6 "+P.addr+"/"+P.len+(a[3]?", шлюз "+pc.ip6.gw:""); }
      if(c==="ipconfig"&&(a[1]||"").toLowerCase()==="/slaac"){ pc.ip6=null; pc.slaac=true; const h=N.hostV6(pc.name); return h? "SLAAC: префікс із Router Advertisement → "+h.addr+"/64, шлюз "+h.gw : "SLAAC увімкнено, але Router Advertisement не отримано (на шлюзі потрібні ipv6 unicast-routing і /64 адреса)"; }
      if(c==="ping"&&v6parse(arg)!==null){ N.counting=true; const r=N.flow6(pc.name,v6fmt(v6parse(arg))); N.counting=false; return "\nPinging "+arg+" with 32 bytes of data:\n"+(r.ok?Array(4).fill("Reply from "+arg+": time<1ms").join("\n")+"\n\nPing statistics for "+arg+":\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)":Array(4).fill(r.arp?"Destination host unreachable.":"Request timed out.").join("\n")+"\n\nPing statistics for "+arg+":\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)\n! Підказка тренажера: "+r.why); }
      if(c==="ipconfig"&&(a[1]||"").toLowerCase()==="/dhcp"){ pc.dhcp=true; pc.ip=null; pc.mask=null; pc.gw=null; return "Ethernet0: DHCP увімкнено. Виконайте ipconfig /renew"; }
      if(c==="ipconfig"){ const f=(a[1]||"").toLowerCase();
        if(f==="/release"){ N.release(pc.name); return "\nEthernet adapter Ethernet0:\n\n   Connection-specific DNS Suffix  . :\n   IPv4 Address. . . . . . . . . . . : —\n   Default Gateway . . . . . . . . . :"; }
        if(f==="/renew"){ const r=N.dhcp(pc.name); if(!r.ok){ return "\nAn error occurred while renewing interface Ethernet0 : unable to contact your DHCP server. Request has timed out.\n! Підказка тренажера: "+r.why; } }
        const all=f==="/all";
        return "\nEthernet adapter Ethernet0:\n\n"+(all?"   Physical Address. . . . . . . . . : "+N.hostMac(pc.name).replace(/\./g,"").toUpperCase().replace(/(..)(?=.)/g,"$1-")+"\n   DHCP Enabled. . . . . . . . . . . : "+(pc.dhcp?"Yes":"No")+"\n":"")+"   IPv4 Address. . . . . . . . . . . : "+(pc.ip||(pc.dhcp?"169.254.18.77 (APIPA — DHCP не відповів)":"—"))+(()=>{ const h=N.hostV6(pc.name); return h? "\n   IPv6 Address. . . . . . . . . . . : "+h.addr+(h.dhcp6?" (DHCPv6, stateful)":h.slaac?" (SLAAC)":"")+(h.other?"\n   IPv6 Address. . . . . . . . . . . : "+h.other+" (SLAAC)":"")+"\n   Link-local IPv6 Address . . . . . : "+N.hostLL(pc.name) : ""; })()+"\n   Subnet Mask . . . . . . . . . . . : "+(pc.mask||(pc.dhcp?"255.255.0.0":"—"))+"\n   Default Gateway . . . . . . . . . : "+(pc.gw||"")+(()=>{ const h=N.hostV6(pc.name); return h&&h.gw? "\n                                       "+h.gw : ""; })()+(all&&pc.dhcpSrv?"\n   DHCP Server . . . . . . . . . . . : "+pc.dhcpSrv:"")+(all&&pc.dns?"\n   DNS Servers . . . . . . . . . . . : "+pc.dns:"")+(all&&pc.opt43?"\n   DHCP Option 43 (vendor) . . . . . : "+pc.opt43.replace(/(..)(?=.)/g,"$1 ").toUpperCase()+(/^f1/.test(pc.opt43)?"  → WLC "+pc.opt43.slice(4).match(/.{8}/g).map(h=>h.match(/../g).map(x=>parseInt(x,16)).join(".")).join(", "):""):"")+(()=>{ const h=all&&N.hostV6(pc.name); return h&&h.dns? "\n   DNS Servers (IPv6). . . . . . . . : "+h.dns.join(", ")+(h.stateless?" (stateless DHCPv6)":" (DHCPv6)")+(h.domain?"\n   Connection-specific DNS Suffix  . : "+h.domain:"") : ""; })()+"\n"; }
      if(c==="ping"&&ipRe.test(arg)){ N.counting=true; const r=N.ping(pc.name,arg); N.counting=false; return "\nPinging "+arg+" with 32 bytes of data:\n"+(r.ok?Array(4).fill("Reply from "+arg+": bytes=32 time<1ms TTL="+(128-r.hops.length)).join("\n")+"\n\nPing statistics for "+arg+":\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)":Array(4).fill(fail(r,arg)).join("\n")+"\n\nPing statistics for "+arg+":\n    Packets: Sent = 4, Received = "+(r.arp||r.noroute||r.acl?4:0)+", Lost = "+(r.arp||r.noroute||r.acl?0:4)+" ("+(r.arp||r.noroute||r.acl?"0":"100")+"% loss)\n! Підказка тренажера: "+r.why); }
      if((c==="tracert"||c==="traceroute")&&ipRe.test(arg)){ const r=N.ping(pc.name,arg); const hops=(r.hops||[]).slice(); if(r.ok) hops.push(arg); return "\nTracing route to "+arg+" over a maximum of 30 hops\n\n"+hops.map((h,k)=>"  "+(k+1)+"    <1 ms    <1 ms    <1 ms  "+h).join("\n")+(r.ok?"\n\nTrace complete.":"\n  "+(hops.length+1)+"     *        *        *     Request timed out.\n! "+r.why); }
      if(c==="curl"&&ipRe.test(arg)){ N.counting=true; const r=N.flow(pc.name,arg,"tcp",80); N.counting=false; return r.ok? "<!DOCTYPE html><html><body><h1>Web server "+r.dev+"</h1><p>Your IP as seen by server: "+r.srcSeen+"</p></body></html>" : r.refused? "curl: (7) Failed to connect to "+arg+" port 80: Connection refused\n! "+r.why : "curl: (28) Failed to connect to "+arg+" port 80 after 21046 ms: Timed out\n! Підказка тренажера: "+r.why; }
      if(c==="ssh"&&ipRe.test(arg)) return tcp(arg,22,"The authenticity of host '"+arg+"' can't be established.\n(Тренажер: TCP 22 відкрито — SSH-з'єднання встановлено.)");
      if(c==="telnet"&&ipRe.test(arg)) return tcp(arg,23,"Trying "+arg+" ... Open\n(Тренажер: TCP 23 відкрито.)");
      if(c==="help"||c==="?") return HELP;
      return "'"+a[0]+"' is not recognized as an internal or external command.\n"+HELP; } };
}
// Мережеві сценарії
const pass=(N,a,b)=>N.ping(a,b).ok;
const M24="255.255.255.0", M30="255.255.255.252";
const IP=(s,n,ip,m)=>{ if(!s.ifs[n]) s.ifs[n]=Object.assign(newIf(n),{switchport:false,loop:/^Lo/.test(n)}); Object.assign(s.ifs[n],{ip,mask:m,shutdown:false}); };
const OSPF=(s,pid,rid,nets,passive)=>{ s.ospf=newOspf(pid); s.ospf.rid=rid; s.ospf.ridActive=rid; s.ospf.nets=nets.map(([n,w,a])=>({net:n,wild:w,area:a})); s.ospf.passive=passive||[]; };
const SUB=(s,p,v,ip,m)=>{ s.ifs[p].shutdown=false; s.ifs[p+"."+v]=Object.assign(newIf(p+"."+v),{switchport:false,sub:true,encap:v,native:false,ip,mask:m,shutdown:false}); };
const ACC=(s,map)=>{ for(const [p,v] of Object.entries(map)){ s.ifs[p].mode="access"; s.ifs[p].accessVlan=v; } };
const EC=(s,g,ports,mode,cfg)=>{ s.ifs["Po"+g]=Object.assign(newIf("Po"+g),cfg||{}); for(const p of ports) Object.assign(s.ifs[p],cfg||{},{chGroup:g,chMode:mode}); };
const POOL=(s,name,net,mask,gw,excl)=>{ s.dhcp.pools[name]={name,net,mask,gw,dns:null,domain:null}; if(excl) s.dhcp.excl.push(excl); };
const V6=(s,n,pfx,ll)=>{ const P=v6pfx(pfx); const i=s.ifs[n]; i.v6=[{addr:P.addr,len:P.len}]; i.llStatic=ll; i.v6on=true; i.shutdown=false; };
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
 // ===================== ENSA / SRWE: OSPF, ACL, NAT, DHCP =====================
 {id:"net-ospf",net:true,t:"ENSA2",title:"OSPFv2: три маршрутизатори в одній області",
  topo:"PC1 — R1 Gi0/0   R1 Gi0/1 ══ R2 Gi0/1   R2 Gi0/2 ══ R3 Gi0/1   R3 Gi0/0 — PC3\n                            R2 Gi0/0 — PC2\nLAN: 192.168.1.0/24, 192.168.2.0/24, 192.168.3.0/24\nТранзит: 10.0.12.0/30 (R1–R2), 10.0.23.0/30 (R2–R3)",
  task:["Адреси вже налаштовано, маршрутизації немає.","На R1, R2, R3 запустіть OSPF process 10, усі мережі — area 0 (точні wildcard-маски).","Router ID: R1 1.1.1.1, R2 2.2.2.2, R3 3.3.3.3.","LAN-інтерфейси Gi0/0 зробіть пасивними (OSPF їх анонсує, але hello туди не шле).","Перевірте: show ip ospf neighbor, show ip route ospf, ping з PC1 на PC3."],
  def:()=>({devices:{
    R1:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.1.1",M24);IP(s,"Gi0/1","10.0.12.1",M30);}},
    R2:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.2.1",M24);IP(s,"Gi0/1","10.0.12.2",M30);IP(s,"Gi0/2","10.0.23.1",M30);}},
    R3:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.3.1",M24);IP(s,"Gi0/1","10.0.23.2",M30);}},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"},PC2:{type:"pc",ip:"192.168.2.10",mask:M24,gw:"192.168.2.1"},PC3:{type:"pc",ip:"192.168.3.10",mask:M24,gw:"192.168.3.1"}},
    links:[["PC1","Fa0","R1","Gi0/0"],["PC2","Fa0","R2","Gi0/0"],["PC3","Fa0","R3","Gi0/0"],["R1","Gi0/1","R2","Gi0/1"],["R2","Gi0/2","R3","Gi0/1"]]}),
  check:N=>{ const R=d=>N.dev[d]; const rid=(d,x)=>R(d).ospf&&effRid(R(d))===x; return [
    [pass(N,"PC1","192.168.3.10"),"PC1 ↔ PC3 через три маршрутизатори"],[pass(N,"PC2","192.168.1.10"),"PC2 ↔ PC1"],
    [N.ospfNeighbors("R2").length===2,"R2 має двох OSPF-сусідів"],
    [rid("R1","1.1.1.1")&&rid("R2","2.2.2.2")&&rid("R3","3.3.3.3"),"Router ID 1.1.1.1 / 2.2.2.2 / 3.3.3.3 діють"],
    [["R1","R2","R3"].every(d=>R(d).ospf&&ospfPassive(R(d),"Gi0/0")),"Gi0/0 пасивний на всіх трьох"],
    [N.ospfRoutes("R1").some(r=>r.net==="192.168.3.0"),"R1 вивчив 192.168.3.0/24 через OSPF"]];},
  sol:"R1:\nenable\nconf t\nrouter ospf 10\n router-id 1.1.1.1\n network 192.168.1.0 0.0.0.255 area 0\n network 10.0.12.0 0.0.0.3 area 0\n passive-interface g0/0\nend\n\nR2:\nenable\nconf t\nrouter ospf 10\n router-id 2.2.2.2\n network 192.168.2.0 0.0.0.255 area 0\n network 10.0.12.0 0.0.0.3 area 0\n network 10.0.23.0 0.0.0.3 area 0\n passive-interface g0/0\nend\n\nR3:\nenable\nconf t\nrouter ospf 10\n router-id 3.3.3.3\n network 192.168.3.0 0.0.0.255 area 0\n network 10.0.23.0 0.0.0.3 area 0\n passive-interface g0/0\nend\n\n(Якщо router-id задано після network — потрібен clear ip ospf process.)"},
 {id:"net-ospf-dr",net:true,t:"ENSA1",title:"OSPF: вибори DR і BDR",
  topo:"R1 Gi0/0 — S1 Fa0/1\nR2 Gi0/0 — S1 Fa0/2      сегмент 192.168.100.0/24 (.1 .2 .3)\nR3 Gi0/0 — S1 Fa0/3\nLo0: R1 10.1.1.1/24, R2 10.2.2.2/24, R3 10.3.3.3/24",
  task:["OSPF уже працює (RID 1.1.1.1, 2.2.2.2, 3.3.3.3). Подивіться show ip ospf neighbor — хто зараз DR і BDR і чому?","Зробіть R1 — DR, R2 — BDR, а R3 ніколи не повинен ставати ні DR, ні BDR.","Змінюйте лише ip ospf priority на Gi0/0.","У справжньому IOS вибори не витісняючі — після зміни пріоритету виконайте clear ip ospf process (тренажер перераховує одразу)."],
  def:()=>({devices:{
    R1:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.100.1",M24);IP(s,"Lo0","10.1.1.1",M24);OSPF(s,1,"1.1.1.1",[["192.168.100.0","0.0.0.255",0],["10.1.1.0","0.0.0.255",0]]);}},
    R2:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.100.2",M24);IP(s,"Lo0","10.2.2.2",M24);OSPF(s,1,"2.2.2.2",[["192.168.100.0","0.0.0.255",0],["10.2.2.0","0.0.0.255",0]]);}},
    R3:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.100.3",M24);IP(s,"Lo0","10.3.3.3",M24);OSPF(s,1,"3.3.3.3",[["192.168.100.0","0.0.0.255",0],["10.3.3.0","0.0.0.255",0]]);}},
    S1:{type:"switch"}},
    links:[["R1","Gi0/0","S1","Fa0/1"],["R2","Gi0/0","S1","Fa0/2"],["R3","Gi0/0","S1","Fa0/3"]]}),
  check:N=>[[N.ospfRole("R1","Gi0/0")==="DR","R1 — DR"],[N.ospfRole("R2","Gi0/0")==="BDR","R2 — BDR"],[N.dev.R3.ifs["Gi0/0"].ospfPrio===0,"R3 має priority 0 (не бере участі у виборах)"],[N.ospfNeighbors("R3").length===2,"R3 і далі має двох сусідів (2WAY/FULL)"],[N.ospfRoutes("R1").some(r=>r.net==="10.3.3.3"&&r.mask==="255.255.255.255"),"R1 бачить Lo0 R3 як 10.3.3.3/32 (loopback анонсується як /32)"]],
  sol:"R1:\nenable\nconf t\ninterface g0/0\n ip ospf priority 255\nend\n\nR2:\nenable\nconf t\ninterface g0/0\n ip ospf priority 100\nend\n\nR3:\nenable\nconf t\ninterface g0/0\n ip ospf priority 0\nend\n\n(На реальному обладнанні: clear ip ospf process на всіх трьох.)"},
 {id:"net-ospf-def",net:true,t:"ENSA2",title:"OSPF: маршрут за замовчуванням до провайдера",
  topo:"PC2 — R2 Gi0/0   R2 Gi0/1 ══ R1 Gi0/1   R1 Gi0/2 ══ ISP Gi0/1   ISP Gi0/0 — WEB\nR1 Gi0/0 — PC1\n10.0.12.0/30 (OSPF) · 203.0.113.0/30 (до ISP) · WEB 198.51.100.10",
  task:["Між R1 і R2 вже працює OSPF. ISP знає маршрут назад до 192.168.0.0/16.","На R1 створіть статичний маршрут за замовчуванням до ISP (next-hop 203.0.113.2).","Розповсюдьте його в OSPF, щоб R2 отримав O*E2 0.0.0.0/0.","Перевірте з PC2: ping 198.51.100.10 і curl 198.51.100.10."],
  def:()=>({devices:{
    R1:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.1.1",M24);IP(s,"Gi0/1","10.0.12.1",M30);IP(s,"Gi0/2","203.0.113.1",M30);OSPF(s,1,"1.1.1.1",[["192.168.1.0","0.0.0.255",0],["10.0.12.0","0.0.0.3",0]],["Gi0/0"]);}},
    R2:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.2.1",M24);IP(s,"Gi0/1","10.0.12.2",M30);OSPF(s,1,"2.2.2.2",[["192.168.2.0","0.0.0.255",0],["10.0.12.0","0.0.0.3",0]],["Gi0/0"]);}},
    ISP:{type:"router",setup:s=>{IP(s,"Gi0/0","198.51.100.1",M24);IP(s,"Gi0/1","203.0.113.2",M30);s.routes.push({net:"192.168.0.0",mask:"255.255.0.0",nh:"203.0.113.1",ifc:null,ad:1},{net:"10.0.0.0",mask:"255.0.0.0",nh:"203.0.113.1",ifc:null,ad:1});}},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"},PC2:{type:"pc",ip:"192.168.2.10",mask:M24,gw:"192.168.2.1"},WEB:{type:"server",ip:"198.51.100.10",mask:M24,gw:"198.51.100.1",services:[80]}},
    links:[["PC1","Fa0","R1","Gi0/0"],["PC2","Fa0","R2","Gi0/0"],["R1","Gi0/1","R2","Gi0/1"],["R1","Gi0/2","ISP","Gi0/1"],["WEB","Fa0","ISP","Gi0/0"]]}),
  check:N=>[[activeStatics(N.dev.R1).some(r=>r.mask==="0.0.0.0"),"На R1 є статичний 0.0.0.0/0"],[N.ospfRoutes("R2").some(r=>r.mask==="0.0.0.0"),"R2 отримав O*E2 0.0.0.0/0"],[pass(N,"PC2","198.51.100.10"),"PC2 пінгує WEB"],[N.flow("PC2","198.51.100.10","tcp",80).ok,"PC2 відкриває сайт на WEB (TCP 80)"]],
  sol:"R1:\nenable\nconf t\nip route 0.0.0.0 0.0.0.0 203.0.113.2\nrouter ospf 1\n default-information originate\nend"},
 {id:"net-acl-std",net:true,t:"ENSA5",title:"Стандартний ACL: закрити доступ до серверної мережі",
  topo:"PC1 192.168.10.10 — R1 Gi0/0\nPC2 192.168.20.10 — R1 Gi0/1\nSRV 192.168.30.10 — R1 Gi0/2",
  task:["Політика: мережа 192.168.10.0/24 не повинна мати жодного доступу до серверної мережі 192.168.30.0/24. Інший трафік дозволено.","Використайте нумерований стандартний ACL 10.","Застосуйте його там, де рекомендує Cisco для стандартних ACL, — так, щоб PC1 і далі бачив PC2.","Перевірте ping з PC1 і PC2, а також show access-lists."],
  def:()=>({devices:{R1:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.10.1",M24);IP(s,"Gi0/1","192.168.20.1",M24);IP(s,"Gi0/2","192.168.30.1",M24);}},
    PC1:{type:"pc",ip:"192.168.10.10",mask:M24,gw:"192.168.10.1"},PC2:{type:"pc",ip:"192.168.20.10",mask:M24,gw:"192.168.20.1"},SRV:{type:"server",ip:"192.168.30.10",mask:M24,gw:"192.168.30.1",services:[80,22]}},
    links:[["PC1","Fa0","R1","Gi0/0"],["PC2","Fa0","R1","Gi0/1"],["SRV","Fa0","R1","Gi0/2"]]}),
  check:N=>{ const a=N.dev.R1.acls["10"]; return [[!pass(N,"PC1","192.168.30.10"),"PC1 не має доступу до SRV"],[pass(N,"PC2","192.168.30.10"),"PC2 має доступ до SRV"],[pass(N,"PC1","192.168.20.10"),"PC1 ↔ PC2 працює (ACL не надто близько до джерела)"],[!!a&&a.type==="std","Використано стандартний ACL 10"],[N.dev.R1.ifs["Gi0/2"].aclOut==="10","ACL 10 застосовано на Gi0/2 out (ближче до призначення)"]]; },
  sol:"R1:\nenable\nconf t\naccess-list 10 remark Block LAN10 to servers\naccess-list 10 deny 192.168.10.0 0.0.0.255\naccess-list 10 permit any\ninterface g0/2\n ip access-group 10 out\nend"},
 {id:"net-acl-ext",net:true,t:"ENSA5",title:"Розширений іменований ACL: лише веб до сервера",
  topo:"PC1 192.168.10.10 — R1 Gi0/0\nPC2 192.168.20.10 — R1 Gi0/1\nSRV 192.168.30.10 — R1 Gi0/2 (HTTP і SSH)",
  task:["Політика для мережі 192.168.10.0/24: до SRV дозволено лише HTTP (TCP 80); будь-який інший трафік до SRV — заборонено; доступ до інших мереж — дозволено.","Мережа 192.168.20.0/24 обмежень не має.","Створіть іменований розширений ACL LAN10-IN і застосуйте його ближче до джерела.","Перевірте з PC1: curl 192.168.30.10, ping 192.168.30.10, ssh 192.168.30.10, ping 192.168.20.10."],
  def:()=>({devices:{R1:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.10.1",M24);IP(s,"Gi0/1","192.168.20.1",M24);IP(s,"Gi0/2","192.168.30.1",M24);}},
    PC1:{type:"pc",ip:"192.168.10.10",mask:M24,gw:"192.168.10.1"},PC2:{type:"pc",ip:"192.168.20.10",mask:M24,gw:"192.168.20.1"},SRV:{type:"server",ip:"192.168.30.10",mask:M24,gw:"192.168.30.1",services:[80,22]}},
    links:[["PC1","Fa0","R1","Gi0/0"],["PC2","Fa0","R1","Gi0/1"],["SRV","Fa0","R1","Gi0/2"]]}),
  check:N=>{ const a=N.dev.R1.acls["LAN10-IN"]; return [[N.flow("PC1","192.168.30.10","tcp",80).ok,"PC1 відкриває сайт на SRV (TCP 80)"],[!pass(N,"PC1","192.168.30.10"),"Ping з PC1 до SRV заблоковано"],[!N.flow("PC1","192.168.30.10","tcp",22).ok,"SSH з PC1 до SRV заблоковано"],[pass(N,"PC1","192.168.20.10"),"PC1 ↔ PC2 працює"],[N.flow("PC2","192.168.30.10","tcp",22).ok,"PC2 має SSH до SRV"],[!!a&&a.type==="ext"&&N.dev.R1.ifs["Gi0/0"].aclIn==="LAN10-IN","LAN10-IN — розширений, на Gi0/0 in"]]; },
  sol:"R1:\nenable\nconf t\nip access-list extended LAN10-IN\n permit tcp 192.168.10.0 0.0.0.255 host 192.168.30.10 eq www\n deny ip 192.168.10.0 0.0.0.255 host 192.168.30.10\n permit ip any any\nexit\ninterface g0/0\n ip access-group LAN10-IN in\nend"},
 {id:"net-nat",net:true,t:"ENSA6",title:"NAT: PAT для LAN і статичний NAT для сервера",
  topo:"PC1 .10, PC2 .11, SRV .20 — S1 — R1 Gi0/0 (192.168.1.1/24)\nR1 Gi0/1 209.165.200.225/29 ══ ISP Gi0/1 209.165.200.226/29\nISP Gi0/0 — WEB 198.51.100.10",
  task:["ISP не знає приватних мереж — без NAT відповіді з Інтернету не повертаються.","На R1: PAT (overload) на адресу Gi0/1 для 192.168.1.0/24 через ACL 1.","Статичний NAT: SRV 192.168.1.20 ↔ 209.165.200.229, щоб сайт SRV був доступний ззовні.","Позначте inside/outside. Перевірте: з PC1 ping 198.51.100.10; з WEB curl 209.165.200.229; show ip nat translations."],
  def:()=>({devices:{S1:{type:"switch"},
    R1:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.1.1",M24);IP(s,"Gi0/1","209.165.200.225","255.255.255.248");s.routes.push({net:"0.0.0.0",mask:"0.0.0.0",nh:"209.165.200.226",ifc:null,ad:1});}},
    ISP:{type:"router",setup:s=>{IP(s,"Gi0/0","198.51.100.1",M24);IP(s,"Gi0/1","209.165.200.226","255.255.255.248");}},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"},PC2:{type:"pc",ip:"192.168.1.11",mask:M24,gw:"192.168.1.1"},SRV:{type:"server",ip:"192.168.1.20",mask:M24,gw:"192.168.1.1",services:[80]},WEB:{type:"server",ip:"198.51.100.10",mask:M24,gw:"198.51.100.1",services:[80]}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["SRV","Fa0","S1","Fa0/3"],["S1","Gi0/1","R1","Gi0/0"],["R1","Gi0/1","ISP","Gi0/1"],["WEB","Fa0","ISP","Gi0/0"]]}),
  check:N=>{ const f=N.flow("PC2","198.51.100.10","tcp",80); return [[pass(N,"PC1","198.51.100.10"),"PC1 пінгує WEB в Інтернеті"],[f.ok&&f.srcSeen==="209.165.200.225","WEB бачить PC2 як 209.165.200.225 (PAT на адресу Gi0/1)"],[N.flow("WEB","209.165.200.229","tcp",80).ok,"Зовнішній WEB відкриває сайт SRV за 209.165.200.229"],[N.dev.R1.nat.dyn.some(d=>d.overload),"Динамічне правило з overload"]]; },
  sol:"R1:\nenable\nconf t\naccess-list 1 permit 192.168.1.0 0.0.0.255\nip nat inside source list 1 interface g0/1 overload\nip nat inside source static 192.168.1.20 209.165.200.229\ninterface g0/0\n ip nat inside\ninterface g0/1\n ip nat outside\nend"},
 {id:"net-dhcp",net:true,t:"SRWE7",title:"DHCPv4: сервер на R1 і relay на R2",
  topo:"PC1, PC2 (DHCP) — S1 — R1 Gi0/0 192.168.10.1/24\nR1 Gi0/1 10.0.0.1/30 ══ R2 Gi0/1 10.0.0.2/30\nR2 Gi0/0 192.168.20.1/24 — PC3 (DHCP)",
  task:["Статичну маршрутизацію між R1 і R2 налаштовано. ПК отримують адреси автоматично, але DHCP-сервера ще немає.","R1 — DHCP-сервер для обох мереж: виключіть .1–.10 у кожній, пули LAN10 і LAN20 зі шлюзом .1 і DNS 8.8.8.8.","На R2 налаштуйте DHCP relay на Gi0/0 (до 10.0.0.1).","На ПК виконайте ipconfig /renew, потім перевірте show ip dhcp binding на R1 і ping PC1 → PC3."],
  def:()=>({devices:{S1:{type:"switch"},
    R1:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.10.1",M24);IP(s,"Gi0/1","10.0.0.1",M30);s.routes.push({net:"192.168.20.0",mask:M24,nh:"10.0.0.2",ifc:null,ad:1});}},
    R2:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.20.1",M24);IP(s,"Gi0/1","10.0.0.2",M30);s.routes.push({net:"192.168.10.0",mask:M24,nh:"10.0.0.1",ifc:null,ad:1});}},
    PC1:{type:"pc",dhcp:true},PC2:{type:"pc",dhcp:true},PC3:{type:"pc",dhcp:true}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["S1","Gi0/1","R1","Gi0/0"],["R1","Gi0/1","R2","Gi0/1"],["PC3","Fa0","R2","Gi0/0"]]}),
  check:N=>{ const ok=(p,net)=>{ const d=N.dev[p]; return !!d.ip&&sameNet(d.ip,net,M24)&&Number(d.ip.split(".")[3])>10&&d.gw===net.replace(/0$/,"1"); }; return [[ok("PC1","192.168.10.0"),"PC1 отримав адресу з LAN10 (після .10) і шлюз .1"],[ok("PC3","192.168.20.0"),"PC3 отримав адресу з LAN20 через relay"],[N.dev.PC1.ip&&N.dev.PC3.ip&&pass(N,"PC1",N.dev.PC3.ip),"PC1 ↔ PC3"],[N.dev.R2.ifs["Gi0/0"].helper.includes("10.0.0.1"),"На R2 Gi0/0 є ip helper-address 10.0.0.1"]]; },
  sol:"R1:\nenable\nconf t\nip dhcp excluded-address 192.168.10.1 192.168.10.10\nip dhcp excluded-address 192.168.20.1 192.168.20.10\nip dhcp pool LAN10\n network 192.168.10.0 255.255.255.0\n default-router 192.168.10.1\n dns-server 8.8.8.8\nip dhcp pool LAN20\n network 192.168.20.0 255.255.255.0\n default-router 192.168.20.1\n dns-server 8.8.8.8\nend\n\nR2:\nenable\nconf t\ninterface g0/0\n ip helper-address 10.0.0.1\nend\n\nPC1:\nipconfig /renew\n\nPC2:\nipconfig /renew\n\nPC3:\nipconfig /renew"}
,
 {id:"net-hsrp",net:true,t:"SRWE9",title:"HSRP: резервний шлюз за замовчуванням",
  topo:"PC1, PC2 — S1 — R1 Gi0/0 192.168.1.2 / R2 Gi0/0 192.168.1.3\nR1 Gi0/1 10.0.1.1/30 ══ R3 Gi0/0   R2 Gi0/1 10.0.2.1/30 ══ R3 Gi0/1\nR3 Gi0/2 — SRV 172.16.0.10",
  task:["ПК вже використовують шлюз 192.168.1.254 — але цієї адреси ще ніхто не має.","Налаштуйте HSRP група 1 з віртуальною IP 192.168.1.254 на R1 і R2 (Gi0/0).","R1 — активний: пріоритет 150 і preempt. R2 — резервний з пріоритетом за замовчуванням.","Перевірте show standby brief, ping з PC1 на 172.16.0.10. Перевірка ще й «вимкне» R1, щоб переконатися, що R2 підхопить шлюз."],
  def:()=>({devices:{S1:{type:"switch"},
    R1:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.1.2",M24);IP(s,"Gi0/1","10.0.1.1",M30);s.routes.push({net:"0.0.0.0",mask:"0.0.0.0",nh:"10.0.1.2",ifc:null,ad:1});}},
    R2:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.1.3",M24);IP(s,"Gi0/1","10.0.2.1",M30);s.routes.push({net:"0.0.0.0",mask:"0.0.0.0",nh:"10.0.2.2",ifc:null,ad:1});}},
    R3:{type:"router",setup:s=>{IP(s,"Gi0/0","10.0.1.2",M30);IP(s,"Gi0/1","10.0.2.2",M30);IP(s,"Gi0/2","172.16.0.1",M24);s.routes.push({net:"192.168.1.0",mask:M24,nh:"10.0.1.1",ifc:null,ad:1},{net:"192.168.1.0",mask:M24,nh:"10.0.2.1",ifc:null,ad:5});}},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.254"},PC2:{type:"pc",ip:"192.168.1.11",mask:M24,gw:"192.168.1.254"},SRV:{type:"server",ip:"172.16.0.10",mask:M24,gw:"172.16.0.1",services:[80]}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["S1","Gi0/1","R1","Gi0/0"],["S1","Gi0/2","R2","Gi0/0"],["R1","Gi0/1","R3","Gi0/0"],["R2","Gi0/1","R3","Gi0/1"],["SRV","Fa0","R3","Gi0/2"]]}),
  check:N=>{ const ok=pass(N,"PC1","172.16.0.10"); const act=N.hsrpState("R1","Gi0/0",1).state==="Active"; const h=(N.dev.R1.ifs["Gi0/0"].hsrp||{})[1]||{};
    const r1=["Gi0/0","Gi0/1"].map(n=>N.dev.R1.ifs[n]); const was=r1.map(i=>i.shutdown); r1.forEach(i=>i.shutdown=true); N.recompute(); const fo=pass(N,"PC1","172.16.0.10")&&N.hsrpState("R2","Gi0/0",1).state==="Active"; r1.forEach((i,k)=>i.shutdown=was[k]); N.recompute();
    return [[ok,"PC1 через віртуальний шлюз 192.168.1.254 бачить SRV"],[act,"R1 — Active для групи 1"],[h.prio===150&&h.preempt,"R1: priority 150 і preempt"],[N.hsrpState("R2","Gi0/0",1).state==="Standby","R2 — Standby"],[fo,"Після «вимкнення» R1 шлюз перейшов на R2 і зв'язок працює"]]; },
  sol:"R1:\nenable\nconf t\ninterface g0/0\n standby 1 ip 192.168.1.254\n standby 1 priority 150\n standby 1 preempt\nend\n\nR2:\nenable\nconf t\ninterface g0/0\n standby 1 ip 192.168.1.254\nend"},
 {id:"net-ospf-cost",net:true,t:"ENSA2",title:"OSPF: керуємо шляхом через cost",
  topo:"PC1 — R1 Gi0/0\nR1 Gi0/1 ══ R2 Gi0/1 · R2 Gi0/2 ══ R4 Gi0/1\nR1 Gi0/2 ══ R3 Gi0/1 · R3 Gi0/2 ══ R4 Gi0/2\nR4 Gi0/0 — PC4\nТранзит: 10.0.12.0/30, 10.0.24.0/30, 10.0.13.0/30, 10.0.34.0/30",
  task:["OSPF уже працює, обидва шляхи R1→R4 рівноцінні (ECMP).","Політика: усі маршрутизатори мають використовувати reference bandwidth 10 Гбіт/с.","Лінк R1–R2 — дорогий резервний канал: трафік R1 → LAN R4 має йти через R3, а R2 використовуватися лише при відмові.","Змінюйте cost лише на R1. Перевірте show ip route ospf на R1 і tracert з PC1 на 192.168.4.10."],
  def:()=>{ const o=(s,rid,nets)=>OSPF(s,1,rid,nets,["Gi0/0"]); return {devices:{
    R1:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.1.1",M24);IP(s,"Gi0/1","10.0.12.1",M30);IP(s,"Gi0/2","10.0.13.1",M30);o(s,"1.1.1.1",[["192.168.1.0","0.0.0.255",0],["10.0.0.0","0.0.255.255",0]]);}},
    R2:{type:"router",setup:s=>{IP(s,"Gi0/1","10.0.12.2",M30);IP(s,"Gi0/2","10.0.24.1",M30);o(s,"2.2.2.2",[["10.0.0.0","0.0.255.255",0]]);}},
    R3:{type:"router",setup:s=>{IP(s,"Gi0/1","10.0.13.2",M30);IP(s,"Gi0/2","10.0.34.1",M30);o(s,"3.3.3.3",[["10.0.0.0","0.0.255.255",0]]);}},
    R4:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.4.1",M24);IP(s,"Gi0/1","10.0.24.2",M30);IP(s,"Gi0/2","10.0.34.2",M30);o(s,"4.4.4.4",[["192.168.4.0","0.0.0.255",0],["10.0.0.0","0.0.255.255",0]]);}},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"},PC4:{type:"pc",ip:"192.168.4.10",mask:M24,gw:"192.168.4.1"}},
    links:[["PC1","Fa0","R1","Gi0/0"],["PC4","Fa0","R4","Gi0/0"],["R1","Gi0/1","R2","Gi0/1"],["R2","Gi0/2","R4","Gi0/1"],["R1","Gi0/2","R3","Gi0/1"],["R3","Gi0/2","R4","Gi0/2"]]}; },
  check:N=>{ const r=N.ospfRoutes("R1").find(x=>x.net==="192.168.4.0"); const t=N.ping("PC1","192.168.4.10");
    const i=N.dev.R1.ifs["Gi0/1"]; const was=i.shutdown; i.shutdown=true; N.recompute(); const backup=pass(N,"PC1","192.168.4.10"); i.shutdown=was; N.recompute();
    const j=N.dev.R1.ifs["Gi0/2"]; const w2=j.shutdown; j.shutdown=true; N.recompute(); const backup2=pass(N,"PC1","192.168.4.10"); j.shutdown=w2; N.recompute();
    return [[["R1","R2","R3","R4"].every(d=>N.dev[d].ospf.refbw===10000),"reference-bandwidth 10000 на всіх чотирьох"],[!!r&&r.hops.length===1&&r.hops[0].nh==="10.0.13.2","R1 → LAN R4 лише через R3 (без ECMP)"],[t.ok&&t.hops.includes("10.0.13.2"),"tracert з PC1 проходить через R3"],[backup2,"При відмові R1–R3 трафік іде через R2"],[["R2","R3","R4"].every(d=>Object.values(N.dev[d].ifs).every(x=>!x.ospfCost)),"Cost змінено лише на R1"]]; },
  sol:"R1:\nenable\nconf t\nrouter ospf 1\n auto-cost reference-bandwidth 10000\ninterface g0/1\n ip ospf cost 100\nend\n\nR2:\nenable\nconf t\nrouter ospf 1\n auto-cost reference-bandwidth 10000\nend\n\nR3:\nenable\nconf t\nrouter ospf 1\n auto-cost reference-bandwidth 10000\nend\n\nR4:\nenable\nconf t\nrouter ospf 1\n auto-cost reference-bandwidth 10000\nend"},
 {id:"net-svc",net:true,t:"ENSA10",title:"Керування мережею: NTP, Syslog, SNMP, CDP/LLDP",
  topo:"PC1 — S1 — R1 Gi0/0 192.168.1.1/24\nR1 Gi0/1 203.0.113.1/30 ══ ISP\nMGMT 192.168.1.50 (NTP, Syslog, SNMP-менеджер) — S1",
  task:["R1: синхронізуйте час із NTP-сервером 192.168.1.50 і додайте мілісекундні мітки часу в лог (service timestamps).","Надсилайте syslog на 192.168.1.50 з рівнями від 0 до 4 (warnings).","SNMP: community MONITOR лише для читання; вкажіть location «Server room».","Безпека: вимкніть CDP на інтерфейсі до ISP (Gi0/1), але увімкніть LLDP глобально.","Перевірте: show ntp associations, show logging, show snmp community."],
  def:()=>({devices:{S1:{type:"switch"},R1:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.1.1",M24);IP(s,"Gi0/1","203.0.113.1",M30);}},ISP:{type:"router",setup:s=>{IP(s,"Gi0/1","203.0.113.2",M30);}},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"},MGMT:{type:"server",ip:"192.168.1.50",mask:M24,gw:"192.168.1.1",services:[123,514,161]}},
    links:[["PC1","Fa0","S1","Fa0/1"],["MGMT","Fa0","S1","Fa0/2"],["S1","Gi0/1","R1","Gi0/0"],["R1","Gi0/1","ISP","Gi0/1"]]}),
  check:N=>{ const v=N.dev.R1.svc||{}; const c=(v.snmp||[]).find(x=>x.name==="MONITOR"); return [[(v.ntp||[]).includes("192.168.1.50")&&v.tsLog,"NTP-сервер 192.168.1.50 і мітки часу в лозі"],[(v.hosts||[]).includes("192.168.1.50")&&v.trap==="warnings","Syslog на 192.168.1.50, logging trap warnings (0–4)"],[!!c&&!c.rw,"SNMP community MONITOR — RO"],[/server room/i.test(v.location||""),"snmp-server location задано"],[N.dev.R1.ifs["Gi0/1"].cdpOff&&v.lldp,"CDP вимкнено на Gi0/1, LLDP увімкнено"],[pass(N,"R1","192.168.1.50"),"R1 бачить сервер керування"]]; },
  sol:"R1:\nenable\nconf t\nntp server 192.168.1.50\nservice timestamps log datetime msec\nlogging host 192.168.1.50\nlogging trap warnings\nsnmp-server community MONITOR RO\nsnmp-server location Server room\nlldp run\ninterface g0/1\n no cdp enable\nend"}
,
 {id:"net-ipv6",net:true,t:"SRWE15",title:"IPv6: адреси, SLAAC і статичні маршрути",
  topo:"PC1 (SLAAC) — R1 Gi0/0 2001:DB8:ACAD:1::1/64\nR1 Gi0/1 2001:DB8:ACAD:12::1/64 ══ R2 Gi0/1 2001:DB8:ACAD:12::2/64\nR2 Gi0/0 2001:DB8:ACAD:2::1/64 — PC2 2001:DB8:ACAD:2::10 (статично, шлюз FE80::2)",
  task:["Увімкніть маршрутизацію IPv6 на R1 і R2 (без неї маршрутизатор не надсилає RA, і SLAAC не працює).","Задайте IPv6-адреси з топології. На R2 Gi0/0 задайте link-local FE80::2 (на неї вказує шлюз PC2).","R1: статичний маршрут до 2001:DB8:ACAD:2::/64 через 2001:DB8:ACAD:12::2. R2: маршрут за замовчуванням ::/0 через 2001:DB8:ACAD:12::1.","PC1: ipconfig /slaac, потім ping 2001:db8:acad:2::10. Перевірте show ipv6 route і show ipv6 interface brief."],
  def:()=>({devices:{R1:{type:"router"},R2:{type:"router"},PC1:{type:"pc",slaac:true},PC2:{type:"pc",ip6:{addr:"2001:DB8:ACAD:2::10",len:64,gw:"FE80::2"}}},
    links:[["PC1","Fa0","R1","Gi0/0"],["R1","Gi0/1","R2","Gi0/1"],["PC2","Fa0","R2","Gi0/0"]]}),
  check:N=>{ const h=N.hostV6("PC1"); return [[N.dev.R1.v6routing&&N.dev.R2.v6routing,"ipv6 unicast-routing на обох"],[!!h&&v6same(h.addr,"2001:db8:acad:1::",64),"PC1 отримав адресу SLAAC з 2001:DB8:ACAD:1::/64"],[(N.dev.R2.ifs["Gi0/0"].llStatic||"")==="FE80::2","На R2 Gi0/0 link-local FE80::2"],[(N.dev.R2.routes6||[]).some(r=>r.len===0),"На R2 маршрут ::/0"],[N.flow6("PC1","2001:DB8:ACAD:2::10").ok,"PC1 ↔ PC2 по IPv6"]]; },
  sol:"R1:\nenable\nconf t\nipv6 unicast-routing\ninterface g0/0\n ipv6 address 2001:db8:acad:1::1/64\n no shutdown\ninterface g0/1\n ipv6 address 2001:db8:acad:12::1/64\n no shutdown\nexit\nipv6 route 2001:db8:acad:2::/64 2001:db8:acad:12::2\nend\n\nR2:\nenable\nconf t\nipv6 unicast-routing\ninterface g0/1\n ipv6 address 2001:db8:acad:12::2/64\n no shutdown\ninterface g0/0\n ipv6 address 2001:db8:acad:2::1/64\n ipv6 address fe80::2 link-local\n no shutdown\nexit\nipv6 route ::/0 2001:db8:acad:12::1\nend\n\nPC1:\nipconfig /slaac"},
 {id:"net-diag",net:true,t:"ENSA12",title:"Діагностика: дуплекс і сусідство OSPF",
  topo:"PC1 — R1 Gi0/0   R1 Gi0/1 ══ S1 Gi0/1   S1 Gi0/2 ══ R2 Gi0/1   R2 Gi0/0 — PC2\nS1: транзитна VLAN 1, 10.0.12.0/24",
  task:["Користувачі скаржаться: між мережами PC1 і PC2 немає зв'язку, а канал R1–S1 «гальмує».","Підказки: show interfaces g0/1 (лічильники помилок, дуплекс), debug ip ospf adj, show ip ospf neighbor, лог CDP.","Виправте всі причини. Не змінюйте адреси."],
  def:()=>({devices:{S1:{type:"switch",setup:s=>{s.ifs["Gi0/1"].duplex="full";}},
    R1:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.1.1",M24);IP(s,"Gi0/1","10.0.12.1",M24);OSPF(s,1,"1.1.1.1",[["192.168.1.0","0.0.0.255",0],["10.0.12.0","0.0.0.255",0]],["Gi0/0"]); s.ifs["Gi0/1"].hello=5; s.ifs["Gi0/1"].dead=20;}},
    R2:{type:"router",setup:s=>{IP(s,"Gi0/0","192.168.2.1",M24);IP(s,"Gi0/1","10.0.12.2",M24);OSPF(s,1,"2.2.2.2",[["192.168.2.0","0.0.0.255",0],["10.0.12.0","0.0.0.255",0]],["Gi0/0"]);}},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"},PC2:{type:"pc",ip:"192.168.2.10",mask:M24,gw:"192.168.2.1"}},
    links:[["PC1","Fa0","R1","Gi0/0"],["R1","Gi0/1","S1","Gi0/1"],["S1","Gi0/2","R2","Gi0/1"],["PC2","Fa0","R2","Gi0/0"]]}),
  check:N=>{ N.recompute(); return [[!N.dev.R1.ifs["Gi0/1"]._dupBad&&!N.dev.S1.ifs["Gi0/1"]._dupBad,"Дуплекс R1 Gi0/1 ↔ S1 Gi0/1 узгоджено"],[N.ospfNeighbors("R1").length===1,"R1 і R2 — OSPF-сусіди"],[pass(N,"PC1","192.168.2.10"),"PC1 ↔ PC2"]]; },
  sol:"S1:\nenable\nconf t\ninterface g0/1\n duplex auto\nend\n\nR1:\nenable\nconf t\ninterface g0/1\n no ip ospf hello-interval\nend\n\n(Альтернатива для дуплексу: вручну full на обох кінцях.)"},
 // ===================== SRWE 5/6/8/11/16: STP, EtherChannel, безпека L2, DHCPv6, діагностика статики =====================
 {id:"net-ec-lacp",net:true,t:"SRWE6",title:"EtherChannel LACP: два лінки як один",
  topo:"PC1 (VLAN10) — S1 Fa0/1        S2 Fa0/1 — PC2 (VLAN10)\nPC3 (VLAN20) — S1 Fa0/2        S2 Fa0/2 — PC4 (VLAN20)\n            S1 Gi0/1 ════ S2 Gi0/1\n            S1 Gi0/2 ════ S2 Gi0/2",
  task:["S1 і S2 з'єднано двома лінками. Подивіться show spanning-tree на S2: один із лінків у стані Altn BLK — STP бачить петлю і використовує лише половину пропускної здатності.",
   "Об'єднайте Gi0/1–2 на обох комутаторах у EtherChannel 1 за LACP: на S1 — mode active, на S2 — mode passive.",
   "Налаштуйте interface port-channel 1 на обох: trunk, native VLAN 99 (створіть VLAN 99), дозволені VLAN 10,20,99. Налаштування Port-channel автоматично переходять на порти-члени.",
   "Перевірте show etherchannel summary (обидва порти з прапорцем P, Po1(SU), протокол LACP), show lacp neighbor і show spanning-tree: тепер у STP один порт Po1 з cost 3 і жодного заблокованого лінку.",
   "PC1 → ping 192.168.10.12, PC3 → ping 192.168.20.14."],
  def:()=>({devices:{S1:{type:"switch",mac:"0019.e811.1a00",vlans:{10:"Users",20:"Admin"},setup:s=>ACC(s,{"Fa0/1":10,"Fa0/2":20})},S2:{type:"switch",mac:"0019.e822.1a00",vlans:{10:"Users",20:"Admin"},setup:s=>ACC(s,{"Fa0/1":10,"Fa0/2":20})},
    PC1:{type:"pc",ip:"192.168.10.11",mask:M24},PC2:{type:"pc",ip:"192.168.10.12",mask:M24},PC3:{type:"pc",ip:"192.168.20.13",mask:M24},PC4:{type:"pc",ip:"192.168.20.14",mask:M24}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC3","Fa0","S1","Fa0/2"],["PC2","Fa0","S2","Fa0/1"],["PC4","Fa0","S2","Fa0/2"],["S1","Gi0/1","S2","Gi0/1"],["S1","Gi0/2","S2","Gi0/2"]]}),
  check:N=>{ N.recompute(); const B=d=>["Gi0/1","Gi0/2"].every(p=>N.dev[d].ifs[p]._ec==="P"); const po=d=>N.dev[d].ifs.Po1; const st=(N.stp(10)||{}).S2;
    return [[B("S1")&&B("S2"),"Gi0/1 і Gi0/2 у каналі (прапорець P) на обох комутаторах"],[N.dev.S1.ifs["Gi0/1"].chMode==="active"&&N.dev.S2.ifs["Gi0/1"].chMode==="passive","LACP: S1 — active, S2 — passive"],
      [!!po("S1")&&!!po("S2")&&operTrunk(po("S1"))&&operTrunk(po("S2"))&&po("S1").nativeVlan===99&&po("S2").nativeVlan===99,"Po1 — trunk з native VLAN 99 з обох боків"],
      [!!st&&!!st.roles.Po1&&!Object.values(st.roles).some(r=>r[1]==="BLK"),"STP бачить один логічний лінк Po1 без блокувань"],
      [pass(N,"PC1","192.168.10.12")&&pass(N,"PC3","192.168.20.14"),"PC1 ↔ PC2 і PC3 ↔ PC4"]]; },
  sol:"S1:\nenable\nconf t\nvlan 99\nexit\ninterface range gi0/1 - 2\n channel-group 1 mode active\nexit\ninterface port-channel 1\n switchport mode trunk\n switchport trunk native vlan 99\n switchport trunk allowed vlan 10,20,99\nend\n\nS2:\nenable\nconf t\nvlan 99\nexit\ninterface range gi0/1 - 2\n channel-group 1 mode passive\nexit\ninterface port-channel 1\n switchport mode trunk\n switchport trunk native vlan 99\n switchport trunk allowed vlan 10,20,99\nend"},
 {id:"net-ec-pagp",net:true,t:"SRWE6",title:"EtherChannel PAgP і статичний (mode on) + STP",
  topo:"             S1 (core)\n  Gi0/1–2 ║║        ║║ Fa0/23–24\n  Gi0/1–2 ║║        ║║ Fa0/23–24\n         S2          S3\nPC1 (VLAN10) — S2 Fa0/1   S3 Fa0/1 — PC2 (VLAN10)",
  task:["S1–S2: EtherChannel 2 за PAgP (S1 — desirable, S2 — auto), Po2 — trunk.","S1–S3: статичний EtherChannel 3 без протоколу (mode on з обох боків), Po3 — trunk. Пам'ятайте: on працює лише в парі з on.",
   "Зробіть S1 root bridge для VLAN 10 (spanning-tree vlan 10 root primary).",
   "Порівняйте: show etherchannel summary (Protocol PAgP і «-»), show pagp neighbor, show spanning-tree vlan 10 на S2 і S3 — cost Po2 = 3 (2×Gigabit), Po3 = 12 (2×FastEthernet).","PC1 → ping 192.168.10.32."],
  def:()=>({devices:{S1:{type:"switch",mac:"0019.e811.1a00",vlans:{10:"Users"}},S2:{type:"switch",mac:"0019.e822.1a00",vlans:{10:"Users"},setup:s=>ACC(s,{"Fa0/1":10})},S3:{type:"switch",mac:"0019.e833.1a00",vlans:{10:"Users"},setup:s=>ACC(s,{"Fa0/1":10})},
    PC1:{type:"pc",ip:"192.168.10.21",mask:M24},PC2:{type:"pc",ip:"192.168.10.32",mask:M24}},
    links:[["S1","Gi0/1","S2","Gi0/1"],["S1","Gi0/2","S2","Gi0/2"],["S1","Fa0/23","S3","Fa0/23"],["S1","Fa0/24","S3","Fa0/24"],["PC1","Fa0","S2","Fa0/1"],["PC2","Fa0","S3","Fa0/1"]]}),
  check:N=>{ N.recompute(); const inEc=(d,ps)=>ps.every(p=>N.dev[d].ifs[p]._ec==="P"); const m=(d,p)=>N.dev[d].ifs[p].chMode; const st=N.stp(10)||{};
    return [[inEc("S1",["Gi0/1","Gi0/2"])&&inEc("S2",["Gi0/1","Gi0/2"]),"S1–S2: обидва лінки в каналі"],[["desirable","auto"].includes(m("S1","Gi0/1"))&&["desirable","auto"].includes(m("S2","Gi0/1")),"S1–S2: протокол PAgP"],
      [inEc("S1",["Fa0/23","Fa0/24"])&&inEc("S3",["Fa0/23","Fa0/24"])&&m("S1","Fa0/23")==="on"&&m("S3","Fa0/23")==="on","S1–S3: статичний канал (on ↔ on)"],
      [!!st.S1&&st.S1.rootName==="S1","S1 — root bridge для VLAN 10"],[!!st.S3&&/^Po/.test(st.S3.rootPort||"")&&st.S3.costs[st.S3.rootPort]===12,"На S3 root port — port-channel з cost 12"],[pass(N,"PC1","192.168.10.32"),"PC1 ↔ PC2"]]; },
  sol:"S1:\nenable\nconf t\ninterface range gi0/1 - 2\n channel-group 2 mode desirable\nexit\ninterface port-channel 2\n switchport mode trunk\nexit\ninterface range fa0/23 - 24\n channel-group 3 mode on\nexit\ninterface port-channel 3\n switchport mode trunk\nexit\nspanning-tree vlan 10 root primary\nend\n\nS2:\nenable\nconf t\ninterface range gi0/1 - 2\n channel-group 2 mode auto\nexit\ninterface port-channel 2\n switchport mode trunk\nend\n\nS3:\nenable\nconf t\ninterface range fa0/23 - 24\n channel-group 3 mode on\nexit\ninterface port-channel 3\n switchport mode trunk\nend"},
 {id:"net-ec-fix",net:true,t:"SRWE6",title:"Знайди й виправ: EtherChannel не збирається",
  topo:"PC1 (VLAN10) — S1 Fa0/1        S2 Fa0/1 — PC2 (VLAN10)\nPC3 (VLAN20) — S1 Fa0/2        S2 Fa0/2 — PC4 (VLAN20)\n            S1 Gi0/1 ════ S2 Gi0/1   (Po1)\n            S1 Gi0/2 ════ S2 Gi0/2   (Po1)",
  task:["Колега налаштував між S1 і S2 канал Po1 на двох лінках, але show etherchannel summary показує, що канал не працює.","Знайдіть дві причини: show etherchannel summary (прапорці I і s), show lacp neighbor, show running-config interface gi0/2 на обох, повідомлення %EC у консолі.",
   "Виправте так, щоб обидва лінки були в каналі за LACP, а PC1 ↔ PC2 і PC3 ↔ PC4 пінгувалися. Не змінюйте номер каналу."],
  def:()=>({devices:{S1:{type:"switch",mac:"0019.e811.1a00",vlans:{10:"Users",20:"Admin"},setup:s=>{ ACC(s,{"Fa0/1":10,"Fa0/2":20}); EC(s,1,["Gi0/1","Gi0/2"],"passive",{mode:"trunk"}); s.ifs["Gi0/2"].allowed=[10]; }},
    S2:{type:"switch",mac:"0019.e822.1a00",vlans:{10:"Users",20:"Admin"},setup:s=>{ ACC(s,{"Fa0/1":10,"Fa0/2":20}); EC(s,1,["Gi0/1","Gi0/2"],"passive",{mode:"trunk"}); }},
    PC1:{type:"pc",ip:"192.168.10.11",mask:M24},PC2:{type:"pc",ip:"192.168.10.12",mask:M24},PC3:{type:"pc",ip:"192.168.20.13",mask:M24},PC4:{type:"pc",ip:"192.168.20.14",mask:M24}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC3","Fa0","S1","Fa0/2"],["PC2","Fa0","S2","Fa0/1"],["PC4","Fa0","S2","Fa0/2"],["S1","Gi0/1","S2","Gi0/1"],["S1","Gi0/2","S2","Gi0/2"]]}),
  check:N=>{ N.recompute(); const B=d=>["Gi0/1","Gi0/2"].every(p=>N.dev[d].ifs[p]._ec==="P"&&N.dev[d].ifs[p].chGroup===1); const lacp=d=>["active","passive"].includes(N.dev[d].ifs["Gi0/1"].chMode);
    return [[B("S1")&&B("S2"),"Обидва лінки в Po1 (P) на S1 і S2"],[lacp("S1")&&lacp("S2"),"Канал — LACP (active/passive)"],[pass(N,"PC1","192.168.10.12")&&pass(N,"PC3","192.168.20.14"),"PC1 ↔ PC2 і PC3 ↔ PC4"]]; },
  sol:"S1:\nenable\nconf t\ninterface range gi0/1 - 2\n channel-group 1 mode active\nexit\ninterface gi0/2\n switchport trunk allowed vlan all\nend\n\n(Причини: обидва боки passive — LACP-переговори ніхто не починає; на S1 Gi0/2 інший список дозволених VLAN — порт suspended.)"},
 {id:"net-stp-cost",net:true,t:"SRWE5",title:"STP: root bridge, cost і роль портів",
  topo:"       S1 ═════ S2\n  Gi0/2 ║  Gi0/1  ║ Fa0/1\n  Gi0/1 ║         ║ Fa0/1\n       S3 ───── S4\n         Fa0/1  Fa0/2\nPC2 — S1 Fa0/10          S4 Fa0/10 — PC1",
  task:["Чотири комутатори з'єднано кільцем, усе за замовчуванням. show spanning-tree: root зараз S4 — у нього найменший MAC. Це поганий вибір: S4 — комутатор доступу.",
   "Зробіть S1 root primary, а S2 — root secondary для VLAN 1.","На S4 є два рівноцінні шляхи до root (через S2 і через S3, обидва cost 4 + 19 = 23). STP обрав Fa0/1 (через S2), бо в S2 менший Bridge ID.",
   "Зробіть root port на S4 портом Fa0/2 (через S3): збільште spanning-tree cost на Fa0/1 S4 (наприклад, до 30). Перевірте: Fa0/2 — Root FWD, Fa0/1 — Altn BLK.","Поясніть собі, чому Altn став саме Fa0/1 на S4, а не порт на S2. PC1 → ping 192.168.1.20."],
  def:()=>({devices:{S1:{type:"switch",mac:"0019.e811.1a00"},S2:{type:"switch",mac:"0019.e822.1a00"},S3:{type:"switch",mac:"0019.e833.1a00"},S4:{type:"switch",mac:"0019.e800.1a00"},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24},PC2:{type:"pc",ip:"192.168.1.20",mask:M24}},
    links:[["S1","Gi0/1","S2","Gi0/1"],["S1","Gi0/2","S3","Gi0/1"],["S2","Fa0/1","S4","Fa0/1"],["S3","Fa0/1","S4","Fa0/2"],["PC1","Fa0","S4","Fa0/10"],["PC2","Fa0","S1","Fa0/10"]]}),
  check:N=>{ const i=N.stp(1)||{}; const pr=d=>N.dev[d].stpPrio[1]!==undefined?N.dev[d].stpPrio[1]:32768; const r4=(i.S4||{roles:{}}).roles;
    return [[!!i.S1&&i.S1.rootName==="S1","S1 — root bridge"],[pr("S2")<pr("S3")&&pr("S2")<pr("S4")&&pr("S2")>pr("S1"),"S2 — резервний root"],[!!i.S4&&i.S4.rootPort==="Fa0/2","На S4 root port — Fa0/2 (через S3)"],[!!r4["Fa0/1"]&&r4["Fa0/1"][0]==="Altn","На S4 Fa0/1 — Altn BLK"],[pass(N,"PC1","192.168.1.20"),"PC1 ↔ PC2"]]; },
  sol:"S1:\nenable\nconf t\nspanning-tree vlan 1 root primary\nend\n\nS2:\nenable\nconf t\nspanning-tree vlan 1 root secondary\nend\n\nS4:\nenable\nconf t\ninterface fa0/1\n spanning-tree cost 30\nend\n\n(Сегмент S2–S4: у S2 шлях до root коштує 4, у S4 — 23, тож designated-порт на S2, а Fa0/1 на S4 стає Alternate.)"},
 {id:"net-stp-guard",net:true,t:"SRWE5",title:"PortFast і BPDU Guard: чужий комутатор на access-порту",
  topo:"PC1 (VLAN10) — S1 Fa0/1\nPC2 (VLAN10) — S1 Fa0/2\nSX (чужий) — S1 Fa0/5\nS1 Gi0/1 ════ S2 Gi0/1 (trunk)\nS2 Fa0/1 — PC3 (VLAN10)",
  task:["Хтось під'єднав до розетки Fa0/5 власний комутатор SX з пріоритетом STP 0. show spanning-tree vlan 10 на S1: root bridge тепер SX — чужий пристрій керує топологією.",
   "На S1 увімкніть PortFast і BPDU Guard на access-портах Fa0/1, Fa0/2 і Fa0/5 (або глобально: spanning-tree portfast default і spanning-tree portfast bpduguard default).",
   "Fa0/5 має одразу перейти в err-disabled (show interfaces status err-disabled). Trunk Gi0/1 не чіпайте — там BPDU легітимні.",
   "Налаштуйте автоматичне відновлення: errdisable recovery cause bpduguard і errdisable recovery interval 300. Перевірте show errdisable recovery.","Перевірте, що root для VLAN 10 знову свій комутатор, і PC1 → ping 192.168.10.13."],
  def:()=>({devices:{S1:{type:"switch",mac:"0019.e811.1a00",vlans:{10:"Users"},setup:s=>{ ACC(s,{"Fa0/1":10,"Fa0/2":10,"Fa0/5":10}); s.ifs["Gi0/1"].mode="trunk"; }},
    S2:{type:"switch",mac:"0019.e822.1a00",vlans:{10:"Users"},setup:s=>{ ACC(s,{"Fa0/1":10}); s.ifs["Gi0/1"].mode="trunk"; }},
    SX:{type:"switch",mac:"0019.e8ff.1a00",vlans:{10:"Users"},setup:s=>{ ACC(s,{"Gi0/1":10}); s.stpPrio={1:0,10:0}; }},
    PC1:{type:"pc",ip:"192.168.10.11",mask:M24},PC2:{type:"pc",ip:"192.168.10.12",mask:M24},PC3:{type:"pc",ip:"192.168.10.13",mask:M24}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["SX","Gi0/1","S1","Fa0/5"],["S1","Gi0/1","S2","Gi0/1"],["PC3","Fa0","S2","Fa0/1"]]}),
  check:N=>{ N.recompute(); const s=N.dev.S1; const edge=p=>s.ifs[p].portfast||(s.portfastDefault&&!operTrunk(s.ifs[p])); const guard=p=>edge(p)&&(s.ifs[p].bpduguard||s.bpduguardDefault); const st=(N.stp(10)||{}).S1;
    return [[edge("Fa0/1")&&edge("Fa0/2"),"PortFast на Fa0/1 і Fa0/2"],[guard("Fa0/1")&&guard("Fa0/2"),"BPDU Guard на портах до ПК"],[s.ifs["Fa0/5"].errdis==="bpduguard","Fa0/5 (чужий комутатор) — err-disabled через BPDU Guard"],
      [!s.ifs["Gi0/1"].errdis&&operTrunk(s.ifs["Gi0/1"]),"Trunk Gi0/1 працює"],[!!s.errRec&&s.errRec.causes.includes("bpduguard"),"errdisable recovery cause bpduguard"],[!!st&&st.rootName!=="SX","Root для VLAN 10 — не SX"],[pass(N,"PC1","192.168.10.13"),"PC1 ↔ PC3"]]; },
  sol:"S1:\nenable\nconf t\ninterface range fa0/1 - 2\n spanning-tree portfast\n spanning-tree bpduguard enable\nexit\ninterface fa0/5\n spanning-tree portfast\n spanning-tree bpduguard enable\nexit\nerrdisable recovery cause bpduguard\nerrdisable recovery interval 300\nend"},
 {id:"net-psec",net:true,t:"SRWE11",title:"Port security: sticky, maximum, violation і BlackHole VLAN",
  topo:"PC1 — S1 Fa0/1        S1 Gi0/1 — R1 Gi0/0 (192.168.10.1)\nPC2 — S1 Fa0/2\nHUB1 — S1 Fa0/3: Laptop, Rogue (переговорна)\nУсі ПК у VLAN 10, мережа 192.168.10.0/24",
  task:["Fa0/1 і Fa0/2 (робочі місця): port-security, maximum 1, mac-address sticky, violation shutdown.",
   "Fa0/3 (хаб у переговорній): port-security, maximum 1, sticky, violation restrict. Дозволеним має стати лише Laptop (він увімкнувся першим), Rogue — заблокований, але порт лишається up.",
   "Порада: спершу задайте maximum і violation, а вже потім вмикайте switchport port-security — інакше порт може піти в err-disabled ще до налаштування (тоді: shutdown / no shutdown).",
   "Невикористані порти Fa0/4–24 і Gi0/2: перенесіть у VLAN 999 BlackHole (access) і вимкніть.",
   "Перевірте: show port-security, show port-security interface fa0/3 (Security Violation Count > 0), show port-security address. Laptop → ping 192.168.10.1 працює, Rogue — ні."],
  def:()=>({devices:{S1:{type:"switch",vlans:{10:"Users"},setup:s=>ACC(s,{"Fa0/1":10,"Fa0/2":10,"Fa0/3":10,"Gi0/1":10})},HUB1:{type:"hub"},R1:{type:"router",setup:s=>IP(s,"Gi0/0","192.168.10.1",M24)},
    PC1:{type:"pc",ip:"192.168.10.11",mask:M24,gw:"192.168.10.1"},PC2:{type:"pc",ip:"192.168.10.12",mask:M24,gw:"192.168.10.1"},Laptop:{type:"pc",ip:"192.168.10.21",mask:M24,gw:"192.168.10.1"},Rogue:{type:"pc",ip:"192.168.10.66",mask:M24,gw:"192.168.10.1"}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["HUB1","P1","S1","Fa0/3"],["Laptop","Fa0","HUB1","P2"],["Rogue","Fa0","HUB1","P3"],["S1","Gi0/1","R1","Gi0/0"]]}),
  check:N=>{ N.recompute(); const s=N.dev.S1; const ps=p=>s.ifs[p].ps||{}; const desk=p=>ps(p).on&&ps(p).max===1&&ps(p).sticky&&ps(p).viol==="shutdown";
    const unused=rng("Fa0/",4,24).concat(["Gi0/2"]).every(p=>s.ifs[p].shutdown&&s.ifs[p].accessVlan===999&&s.ifs[p].mode==="access");
    return [[desk("Fa0/1")&&desk("Fa0/2"),"Fa0/1–2: port-security, max 1, sticky, violation shutdown"],[ps("Fa0/3").on&&ps("Fa0/3").max===1&&ps("Fa0/3").viol==="restrict"&&!s.ifs["Fa0/3"].errdis,"Fa0/3: violation restrict, порт не в err-disabled"],
      [(ps("Fa0/3").count||0)>0,"Порушення на Fa0/3 зафіксовано (лічильник > 0)"],[pass(N,"PC1","192.168.10.1")&&pass(N,"PC2","192.168.10.1")&&pass(N,"Laptop","192.168.10.1"),"PC1, PC2 і Laptop пінгують шлюз"],
      [!pass(N,"Rogue","192.168.10.1"),"Rogue заблоковано port-security"],[!!s.vlans[999]&&unused,"Fa0/4–24 і Gi0/2 — у VLAN 999 і вимкнені"]]; },
  sol:"S1:\nenable\nconf t\ninterface range fa0/1 - 2\n switchport port-security maximum 1\n switchport port-security violation shutdown\n switchport port-security mac-address sticky\n switchport port-security\nexit\ninterface fa0/3\n switchport port-security maximum 1\n switchport port-security violation restrict\n switchport port-security mac-address sticky\n switchport port-security\nexit\nvlan 999\n name BlackHole\nexit\ninterface range fa0/4 - 24, gi0/2\n switchport mode access\n switchport access vlan 999\n shutdown\nend"},
 {id:"net-snoop",net:true,t:"SRWE11",title:"DHCP snooping і DAI проти rogue DHCP і ARP-спуфінгу",
  topo:"PC1 (DHCP) — S1 Fa0/1          S1 Gi0/1 — R1 Gi0/0 192.168.10.1 (DHCP-сервер)\nPC2 (DHCP) — S1 Fa0/2          R1 Gi0/1 — Server 10.0.0.10\nAttacker (статика .66) — S1 Fa0/3\nRogue (чужий DHCP) — S1 Fa0/10\nУсе в VLAN 10",
  task:["PC1: ipconfig /renew. Адреса з 10.66.66.0/24 — її видав чужий DHCP-сервер Rogue на Fa0/10. PC1 → ping 10.0.0.10 не працює.",
   "На S1 увімкніть DHCP snooping для VLAN 10 і зробіть довіреним лише порт до R1 (Gi0/1). R1 — IOS-сервер без relay, тому вимкніть вставку опції 82: no ip dhcp snooping information option. На access-портах Fa0/1–3 обмежте DHCP до 10 pps.",
   "PC1 і PC2: ipconfig /renew — тепер адреси з 192.168.10.0/24. Перевірте show ip dhcp snooping і show ip dhcp snooping binding.",
   "Увімкніть DAI для VLAN 10 і зробіть Gi0/1 довіреним для ARP. Attacker зі статичною адресою більше не зможе пінгувати шлюз: його пари IP/MAC немає в binding-таблиці (show ip arp inspection).","Перевірте: PC1 → ping 10.0.0.10."],
  def:()=>({devices:{S1:{type:"switch",vlans:{10:"Users"},setup:s=>ACC(s,{"Fa0/1":10,"Fa0/2":10,"Fa0/3":10,"Fa0/10":10,"Gi0/1":10})},
    R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.10.1",M24); IP(s,"Gi0/1","10.0.0.1",M24); POOL(s,"LAN","192.168.10.0",M24,"192.168.10.1",["192.168.10.1","192.168.10.10"]); }},
    Rogue:{type:"router",setup:s=>{ IP(s,"Gi0/0","10.66.66.1",M24); POOL(s,"EVIL","10.66.66.0",M24,"10.66.66.1"); }},
    PC1:{type:"pc",dhcp:true},PC2:{type:"pc",dhcp:true},Attacker:{type:"pc",ip:"192.168.10.66",mask:M24,gw:"192.168.10.1"},Server:{type:"server",ip:"10.0.0.10",mask:M24,gw:"10.0.0.1"}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["Attacker","Fa0","S1","Fa0/3"],["Rogue","Gi0/0","S1","Fa0/10"],["S1","Gi0/1","R1","Gi0/0"],["R1","Gi0/1","Server","Fa0"]]}),
  check:N=>{ const s=N.dev.S1; const sp=s.snoop||{vlans:[],bind:{}}; const lan=p=>/^192\.168\.10\./.test(N.dev[p].ip||"");
    return [[!!sp.on&&sp.vlans.includes(10),"DHCP snooping увімкнено для VLAN 10"],[!!s.ifs["Gi0/1"].dhcpTrust&&!s.ifs["Fa0/10"].dhcpTrust,"Довірений лише Gi0/1 (до R1)"],[lan("PC1")&&lan("PC2"),"PC1 і PC2 отримали адреси від R1 (192.168.10.0/24)"],
      [Object.keys(sp.bind||{}).length>=2,"У binding-таблиці є записи PC1 і PC2"],[pass(N,"PC1","10.0.0.10"),"PC1 → Server 10.0.0.10"],[!!s.dai&&s.dai.vlans.includes(10)&&!!s.ifs["Gi0/1"].daiTrust,"DAI для VLAN 10, Gi0/1 — trusted"],[!pass(N,"Attacker","192.168.10.1"),"Attacker зі статичною адресою заблоковано DAI"]]; },
  sol:"S1:\nenable\nconf t\nip dhcp snooping\nip dhcp snooping vlan 10\nno ip dhcp snooping information option\ninterface gi0/1\n ip dhcp snooping trust\nexit\ninterface range fa0/1 - 3\n ip dhcp snooping limit rate 10\nexit\nip arp inspection vlan 10\ninterface gi0/1\n ip arp inspection trust\nend\n\nPC1:\nipconfig /renew\n\nPC2:\nipconfig /renew"},
 {id:"net-dhcpv6",net:true,t:"SRWE8",title:"SLAAC, stateless і stateful DHCPv6",
  topo:"PC1 — R1 Gi0/0 2001:DB8:ACAD:1::1/64   (лише SLAAC)\nPC2 — R1 Gi0/1 2001:DB8:ACAD:2::1/64   (SLAAC + stateless DHCPv6)\nPC3 — R1 Gi0/2 2001:DB8:ACAD:3::1/64   (stateful DHCPv6)\nУсі ПК в режимі автоналаштування IPv6",
  task:["Адреси IPv6 і link-local FE80::1 на інтерфейсах R1 уже є. Увімкніть ipv6 unicast-routing — без нього R1 не надсилає Router Advertisement.",
   "Gi0/0 — лише SLAAC: нічого не змінюйте. PC1 сформує адресу з префікса RA і EUI-64.",
   "Gi0/1 — stateless DHCPv6: пул STATELESS з dns-server 2001:db8:acad:1::254 і domain-name ccna.lab; на Gi0/1: ipv6 nd other-config-flag (O=1) і ipv6 dhcp server STATELESS.",
   "Gi0/2 — stateful DHCPv6: пул STATEFUL з address prefix 2001:db8:acad:3::/64 і тим самим DNS; на Gi0/2: ipv6 nd managed-config-flag (M=1), ipv6 nd prefix default no-autoconfig (A=0 — без SLAAC) і ipv6 dhcp server STATEFUL.",
   "На кожному ПК: ipconfig /all. Порівняйте адреси й DNS; на R1: show ipv6 interface g0/1, show ipv6 dhcp pool, show ipv6 dhcp binding. PC1 → ping адреси PC3."],
  def:()=>({devices:{R1:{type:"router",setup:s=>{ V6(s,"Gi0/0","2001:db8:acad:1::1/64","FE80::1"); V6(s,"Gi0/1","2001:db8:acad:2::1/64","FE80::1"); V6(s,"Gi0/2","2001:db8:acad:3::1/64","FE80::1"); }},
    PC1:{type:"pc",slaac:true},PC2:{type:"pc",slaac:true},PC3:{type:"pc",slaac:true}},
    links:[["PC1","Fa0","R1","Gi0/0"],["PC2","Fa0","R1","Gi0/1"],["PC3","Fa0","R1","Gi0/2"]]}),
  check:N=>{ const h1=N.hostV6("PC1"), h2=N.hostV6("PC2"), h3=N.hostV6("PC3"); const dns=h=>!!h&&!!h.dns&&h.dns.some(x=>v6eq(x,"2001:db8:acad:1::254"));
    return [[!!N.dev.R1.v6routing,"ipv6 unicast-routing на R1"],[!!h1&&h1.slaac&&v6same(h1.addr,"2001:db8:acad:1::",64)&&!h1.dns,"PC1: лише SLAAC (без DNS від DHCPv6)"],
      [!!h2&&h2.slaac&&v6same(h2.addr,"2001:db8:acad:2::",64)&&dns(h2),"PC2: адреса SLAAC + DNS від stateless DHCPv6"],
      [!!h3&&h3.dhcp6&&v6same(h3.addr,"2001:db8:acad:3::",64)&&!h3.other&&dns(h3),"PC3: адреса від stateful DHCPv6 (без SLAAC) + DNS"],[!!h3&&N.flow6("PC1",h3.addr).ok,"PC1 ↔ PC3 по IPv6"]]; },
  sol:"R1:\nenable\nconf t\nipv6 unicast-routing\nipv6 dhcp pool STATELESS\n dns-server 2001:db8:acad:1::254\n domain-name ccna.lab\nexit\nipv6 dhcp pool STATEFUL\n address prefix 2001:db8:acad:3::/64\n dns-server 2001:db8:acad:1::254\n domain-name ccna.lab\nexit\ninterface g0/1\n ipv6 nd other-config-flag\n ipv6 dhcp server STATELESS\ninterface g0/2\n ipv6 nd managed-config-flag\n ipv6 nd prefix default no-autoconfig\n ipv6 dhcp server STATEFUL\nend\n\nPC1:\nipconfig /all\n\nPC3:\nipconfig /all"},
 {id:"net-static-diag",net:true,t:"SRWE16",title:"Діагностика статичних маршрутів і плаваючий маршрут",
  topo:"PC1 — R1 Gi0/0 192.168.1.1          R2 Gi0/0 192.168.2.1 — PC2\nR1 Gi0/1 10.0.12.1/30 ═══ R2 Gi0/1 10.0.12.2/30   (основний канал)\nR1 Gi0/2 10.0.13.1/30 ─ R3 ─ 10.0.23.1/30 R2 Gi0/2 10.0.23.2/30   (резерв)",
  task:["PC1 не пінгує PC2. Знайдіть причини: show ip route, show ip route static, ping next-hop із R1, tracert з PC1. На R3 маршрути вже налаштовані.",
   "Виправте основний маршрут R1 → 192.168.2.0/24 (next-hop — R2 по основному каналу) і додайте зворотний маршрут на R2 до 192.168.1.0/24.",
   "Додайте плаваючі статичні маршрути через R3 з AD 5 на R1 і R2. Вони не з'являться в таблиці, поки працює основний канал.",
   "Перевірка: shutdown на R1 Gi0/1 → PC1 → ping 192.168.2.10 має працювати через R3 (show ip route: S [5/0]). Потім no shutdown."],
  def:()=>({devices:{R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.1.1",M24); IP(s,"Gi0/1","10.0.12.1",M30); IP(s,"Gi0/2","10.0.13.1",M30); addRoute(s,"192.168.2.0",M24,"10.0.12.6",null,1); }},
    R2:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.2.1",M24); IP(s,"Gi0/1","10.0.12.2",M30); IP(s,"Gi0/2","10.0.23.2",M30); }},
    R3:{type:"router",setup:s=>{ IP(s,"Gi0/1","10.0.13.2",M30); IP(s,"Gi0/2","10.0.23.1",M30); addRoute(s,"192.168.1.0",M24,"10.0.13.1",null,1); addRoute(s,"192.168.2.0",M24,"10.0.23.2",null,1); }},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"},PC2:{type:"pc",ip:"192.168.2.10",mask:M24,gw:"192.168.2.1"}},
    links:[["PC1","Fa0","R1","Gi0/0"],["R1","Gi0/1","R2","Gi0/1"],["R1","Gi0/2","R3","Gi0/1"],["R3","Gi0/2","R2","Gi0/2"],["PC2","Fa0","R2","Gi0/0"]]}),
  check:N=>{ const R1=N.dev.R1, R2=N.dev.R2; const has=(d,net,nh,fl)=>d.routes.some(r=>r.net===net&&r.nh===nh&&(fl?r.ad>1:(r.ad||1)===1));
    const backup=()=>{ const i=R1.ifs["Gi0/1"]; const was=i.shutdown; i.shutdown=true; N.recompute(); const ok=pass(N,"PC1","192.168.2.10"); i.shutdown=was; N.recompute(); return ok; };
    return [[pass(N,"PC1","192.168.2.10"),"PC1 ↔ PC2"],[activeStatics(R1).some(r=>r.net==="192.168.2.0"&&r.nh==="10.0.12.2"),"R1: основний маршрут через 10.0.12.2 у таблиці"],[has(R2,"192.168.1.0","10.0.12.1"),"R2: зворотний маршрут через 10.0.12.1"],
      [has(R1,"192.168.2.0","10.0.13.2",true)&&has(R2,"192.168.1.0","10.0.23.1",true),"Плаваючі маршрути через R3 (AD > 1) на R1 і R2"],[backup(),"Без основного каналу зв'язок іде через R3"]]; },
  sol:"R1:\nenable\nconf t\nno ip route 192.168.2.0 255.255.255.0 10.0.12.6\nip route 192.168.2.0 255.255.255.0 10.0.12.2\nip route 192.168.2.0 255.255.255.0 10.0.13.2 5\nend\n\nR2:\nenable\nconf t\nip route 192.168.1.0 255.255.255.0 10.0.12.1\nip route 192.168.1.0 255.255.255.0 10.0.23.1 5\nend"},
 // ===================== CCNA v2.0: root guard, storm control, RA guard, VRRP, OSPFv3, AAA, DNS =====================
 {id:"net-rootguard",net:true,t:"SRWE5",title:"Root guard: захист розташування root bridge",
  topo:"              S1 (distribution, root)\n      Gi0/1 ║              ║ Gi0/2\n      Gi0/1 ║              ║ Gi0/1\n           S2              S3 — Fa0/5 — SX (чужий, пріоритет 0)\nPC1 — S2 Fa0/1   Server — S1 Fa0/10   PC3 — S3 Fa0/1",
  task:["S1 — root для VLAN 10. Хтось під'єднав до S3 Fa0/5 комутатор SX з пріоритетом 0: show spanning-tree vlan 10 на S1 — root тепер SX, а трафік до сервера йде через чужий пристрій.",
   "На S1 увімкніть root guard на designated-портах до комутаторів доступу (Gi0/1 і Gi0/2): spanning-tree guard root.",
   "Подивіться show spanning-tree vlan 10 на S1: Gi0/2 — «Desg BKN* … *ROOT_Inc», S1 знову root, PC1 бачить сервер. Root guard ізолював сегмент, звідки прийшов кращий BPDU.",
   "Тепер приберіть першопричину: на S3 Fa0/5 увімкніть PortFast і BPDU guard. Порт піде в err-disabled, кращі BPDU зникнуть, і Gi0/2 на S1 відновиться сам. PC3 → ping 192.168.10.100."],
  def:()=>({devices:{S1:{type:"switch",mac:"0019.e811.1a00",vlans:{10:"Users"},setup:s=>{ ACC(s,{"Fa0/10":10}); s.ifs["Gi0/1"].mode="trunk"; s.ifs["Gi0/2"].mode="trunk"; s.stpPrio={10:24576}; }},
    S2:{type:"switch",mac:"0019.e822.1a00",vlans:{10:"Users"},setup:s=>{ ACC(s,{"Fa0/1":10}); s.ifs["Gi0/1"].mode="trunk"; }},
    S3:{type:"switch",mac:"0019.e833.1a00",vlans:{10:"Users"},setup:s=>{ ACC(s,{"Fa0/1":10,"Fa0/5":10}); s.ifs["Gi0/1"].mode="trunk"; }},
    SX:{type:"switch",mac:"0019.e8ff.1a00",vlans:{10:"Users"},setup:s=>{ ACC(s,{"Gi0/1":10}); s.stpPrio={1:0,10:0}; }},
    PC1:{type:"pc",ip:"192.168.10.11",mask:M24},PC3:{type:"pc",ip:"192.168.10.13",mask:M24},Server:{type:"server",ip:"192.168.10.100",mask:M24}},
    links:[["S1","Gi0/1","S2","Gi0/1"],["S1","Gi0/2","S3","Gi0/1"],["SX","Gi0/1","S3","Fa0/5"],["PC1","Fa0","S2","Fa0/1"],["PC3","Fa0","S3","Fa0/1"],["Server","Fa0","S1","Fa0/10"]]}),
  check:N=>{ N.recompute(); const s1=N.dev.S1, s3=N.dev.S3; const st=N.stp(10)||{};
    return [[s1.ifs["Gi0/1"].stpGuard==="root"&&s1.ifs["Gi0/2"].stpGuard==="root","Root guard на S1 Gi0/1 і Gi0/2"],[!!st.S1&&st.S1.rootName==="S1"&&!!st.S2&&st.S2.rootName==="S1","S1 — root для S1 і S2"],
      [s3.ifs["Fa0/5"].errdis==="bpduguard","S3 Fa0/5 (чужий комутатор) — err-disabled через BPDU guard"],[!!st.S1&&st.S1.roles["Gi0/2"]&&st.S1.roles["Gi0/2"][1]==="FWD","Gi0/2 на S1 відновився після прибирання джерела"],[pass(N,"PC1","192.168.10.100")&&pass(N,"PC3","192.168.10.100"),"PC1 і PC3 бачать сервер"]]; },
  sol:"S1:\nenable\nconf t\ninterface range gi0/1 - 2\n spanning-tree guard root\nend\n\nS3:\nenable\nconf t\ninterface fa0/5\n spanning-tree portfast\n spanning-tree bpduguard enable\nend"},
 {id:"net-storm",net:true,t:"SRWE11",title:"Storm control: broadcast-шторм від зараженого ПК",
  topo:"PC1 — S1 Fa0/1        S1 Gi0/1 — R1 Gi0/0 (192.168.10.1)\nPC2 — S1 Fa0/2\nInfected — S1 Fa0/3 (генерує broadcast-шторм)\nУсі ПК у VLAN 10",
  task:["ПК Infected генерує broadcast-шторм. PC1 → ping 192.168.10.1: VLAN 10 «лежить» — комутатор розсилає шторм на всі порти.",
   "На access-портах Fa0/1–3 увімкніть storm-control broadcast level 20 (поріг — 20% смуги) і storm-control action trap (повідомлення в лог).",
   "Перевірте show storm-control: Fa0/3 у стані Blocking — надлишок відкидається, решта VLAN працює. PC1 і PC2 знову пінгують шлюз.",
   "Додатково на Fa0/3 задайте storm-control action shutdown: порт піде в err-disabled (show interfaces status err-disabled). Подивіться show logging.","На Infected: stormtest stop і shutdown/no shutdown на Fa0/3 — порт відновиться."],
  def:()=>({devices:{S1:{type:"switch",vlans:{10:"Users"},setup:s=>ACC(s,{"Fa0/1":10,"Fa0/2":10,"Fa0/3":10,"Gi0/1":10})},R1:{type:"router",setup:s=>IP(s,"Gi0/0","192.168.10.1",M24)},
    PC1:{type:"pc",ip:"192.168.10.11",mask:M24,gw:"192.168.10.1"},PC2:{type:"pc",ip:"192.168.10.12",mask:M24,gw:"192.168.10.1"},Infected:{type:"pc",ip:"192.168.10.66",mask:M24,gw:"192.168.10.1",storm:true}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["Infected","Fa0","S1","Fa0/3"],["S1","Gi0/1","R1","Gi0/0"]]}),
  check:N=>{ N.recompute(); const s=N.dev.S1; const sc=p=>s.ifs[p].storm&&s.ifs[p].storm.bcast!=null&&s.ifs[p].storm.bcast<=20;
    return [[sc("Fa0/1")&&sc("Fa0/2")&&sc("Fa0/3"),"storm-control broadcast ≤ 20% на Fa0/1–3"],[!!(s.ifs["Fa0/3"].storm||{}).trap,"storm-control action trap"],[!!s.ifs["Fa0/3"]._stormDrop||s.ifs["Fa0/3"].errdis==="storm-control","Шторм із Fa0/3 відфільтровано або порт вимкнено"],[pass(N,"PC1","192.168.10.1")&&pass(N,"PC2","192.168.10.1"),"PC1 і PC2 пінгують шлюз"]]; },
  sol:"S1:\nenable\nconf t\ninterface range fa0/1 - 3\n storm-control broadcast level 20\n storm-control action trap\nend"},
 {id:"net-raguard",net:true,t:"SRWE11",title:"IPv6 RA guard: фальшивий маршрутизатор у мережі",
  topo:"PC1 (SLAAC) — S1 Fa0/1       S1 Gi0/1 — R1 Gi0/0 2001:DB8:ACAD:1::1/64 (справжній шлюз)\nPC2 (SLAAC) — S1 Fa0/2\nRogue — S1 Fa0/5 (розсилає RA з префіксом 2001:DB8:BAD::/64)",
  task:["PC1: ipconfig /all — IPv6-адреса з 2001:DB8:BAD::/64, шлюз — Rogue. Чужий пристрій розсилає Router Advertisement і став шлюзом для IPv6.",
   "На S1 створіть політику: ipv6 nd raguard policy HOSTS, device-role host. Прив'яжіть її до всіх access-портів Fa0/1–24: ipv6 nd raguard attach-policy HOSTS.",
   "Uplink Gi0/1 до R1 лишіть без політики host (або створіть політику ROUTER з device-role router).","PC1 і PC2: ipconfig /slaac, ipconfig /all — тепер префікс 2001:DB8:ACAD:1::/64. PC1 → ping 2001:db8:acad:1::1."],
  def:()=>({devices:{S1:{type:"switch",setup:s=>{}},R1:{type:"router",setup:s=>{ s.v6routing=true; V6(s,"Gi0/0","2001:db8:acad:1::1/64","FE80::1"); }},Rogue:{type:"router",setup:s=>{ s.v6routing=true; V6(s,"Gi0/0","2001:db8:bad::1/64","FE80::BAD"); }},
    PC1:{type:"pc",slaac:true},PC2:{type:"pc",slaac:true}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["Rogue","Gi0/0","S1","Fa0/5"],["S1","Gi0/1","R1","Gi0/0"]]}),
  check:N=>{ const s=N.dev.S1; const pol=Object.entries(s.raPol||{}).find(([,p])=>p.role==="host"); const h1=N.hostV6("PC1"), h2=N.hostV6("PC2");
    return [[!!pol,"Політика RA guard з device-role host"],[!!pol&&["Fa0/1","Fa0/2","Fa0/5"].every(p=>s.ifs[p].raGuard===pol[0]),"Політику прив'язано до access-портів (включно з Fa0/5)"],[raRole(s,s.ifs["Gi0/1"])!=="host","Uplink до R1 не заблоковано"],
      [!!h1&&v6same(h1.addr,"2001:db8:acad:1::",64)&&!!h2&&v6same(h2.addr,"2001:db8:acad:1::",64),"PC1 і PC2 отримали префікс справжнього R1"],[N.flow6("PC1","2001:DB8:ACAD:1::1").ok,"PC1 → R1 по IPv6"]]; },
  sol:"S1:\nenable\nconf t\nipv6 nd raguard policy HOSTS\n device-role host\nexit\ninterface range fa0/1 - 24\n ipv6 nd raguard attach-policy HOSTS\nend"},
 {id:"net-vrrp",net:true,t:"SRWE9",title:"VRRP: резервний шлюз за відкритим стандартом",
  topo:"PC1, PC2 — S1 — R1 Gi0/0 192.168.10.2 / R2 Gi0/0 192.168.10.3   (віртуальний шлюз 192.168.10.1)\nR1 Gi0/1 10.0.13.1/30 — R3 Gi0/1;  R2 Gi0/1 10.0.23.2/30 — R3 Gi0/2;  R3 Lo0 8.8.8.8 (Інтернет)\nOSPF між R1, R2, R3 уже налаштовано",
  task:["У ПК шлюз 192.168.10.1, але такої адреси ще ніхто не має: PC1 → ping 8.8.8.8 не працює.",
   "На R1 і R2 налаштуйте VRRP групу 10 з віртуальною адресою 192.168.10.1 на Gi0/0. R1 має бути master: vrrp 10 priority 110.",
   "Перевірте show vrrp brief на обох: R1 — Master, R2 — Backup. Зверніть увагу: preempt у VRRP увімкнено за замовчуванням (у HSRP — ні).",
   "Перевірка відмовостійкості: shutdown на R1 Gi0/0 → R2 стає Master, PC1 → ping 8.8.8.8 працює. Потім no shutdown — R1 повертає роль."],
  def:()=>({devices:{S1:{type:"switch"},
    R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.10.2",M24); IP(s,"Gi0/1","10.0.13.1",M30); OSPF(s,1,"1.1.1.1",[["192.168.10.0","0.0.0.255",0],["10.0.13.0","0.0.0.3",0]],["Gi0/0"]); }},
    R2:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.10.3",M24); IP(s,"Gi0/1","10.0.23.2",M30); OSPF(s,1,"2.2.2.2",[["192.168.10.0","0.0.0.255",0],["10.0.23.0","0.0.0.3",0]],["Gi0/0"]); }},
    R3:{type:"router",setup:s=>{ IP(s,"Gi0/1","10.0.13.2",M30); IP(s,"Gi0/2","10.0.23.1",M30); IP(s,"Lo0","8.8.8.8","255.255.255.255"); OSPF(s,1,"3.3.3.3",[["10.0.13.0","0.0.0.3",0],["10.0.23.0","0.0.0.3",0],["8.8.8.8","0.0.0.0",0]]); }},
    PC1:{type:"pc",ip:"192.168.10.11",mask:M24,gw:"192.168.10.1"},PC2:{type:"pc",ip:"192.168.10.12",mask:M24,gw:"192.168.10.1"}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["R1","Gi0/0","S1","Gi0/1"],["R2","Gi0/0","S1","Gi0/2"],["R1","Gi0/1","R3","Gi0/1"],["R2","Gi0/1","R3","Gi0/2"]]}),
  check:N=>{ const v=d=>((N.dev[d].ifs["Gi0/0"].vrrp||{})[10]||{}); const st=d=>N.vrrpState(d,"Gi0/0",10).state;
    const fo=()=>{ const i=N.dev.R1.ifs["Gi0/0"]; const was=i.shutdown; i.shutdown=true; N.recompute(); const ok=pass(N,"PC1","8.8.8.8")&&st("R2")==="Master"; i.shutdown=was; N.recompute(); return ok; };
    return [[v("R1").ip==="192.168.10.1"&&v("R2").ip==="192.168.10.1","VRRP 10 з адресою 192.168.10.1 на R1 і R2"],[!!v("R1").ip&&st("R1")==="Master"&&st("R2")==="Backup","R1 — Master, R2 — Backup"],[pass(N,"PC1","8.8.8.8"),"PC1 → 8.8.8.8 через віртуальний шлюз"],[!!v("R1").ip&&fo(),"Після відмови R1 шлюзом стає R2"]]; },
  sol:"R1:\nenable\nconf t\ninterface g0/0\n vrrp 10 ip 192.168.10.1\n vrrp 10 priority 110\nend\n\nR2:\nenable\nconf t\ninterface g0/0\n vrrp 10 ip 192.168.10.1\nend"},
 {id:"net-ospfv3",net:true,t:"ENSA2",title:"OSPFv3 для IPv6 поруч з OSPFv2",
  topo:"PC1 — R1 Gi0/0 (2001:DB8:ACAD:1::1)    R1 Gi0/1 ═ R2 Gi0/1    R2 Gi0/2 ═ R3 Gi0/1    R3 Gi0/0 (2001:DB8:ACAD:3::1) — PC3\nЛінки: 2001:DB8:ACAD:12::/64 і :23::/64. IPv4 і OSPFv2 уже працюють",
  task:["IPv4 між PC1 і PC3 уже працює через OSPFv2, а IPv6 — ні. IPv6-адреси на інтерфейсах уже є.",
   "На всіх маршрутизаторах: ipv6 unicast-routing; ipv6 router ospf 1 з явним router-id (1.1.1.1, 2.2.2.2, 3.3.3.3).",
   "Увімкніть OSPFv3 на всіх інтерфейсах з IPv6: ipv6 ospf 1 area 0 (команди network в OSPFv3 немає). LAN-інтерфейси R1 Gi0/0 і R3 Gi0/0 зробіть пасивними.",
   "Перевірте show ipv6 ospf neighbor (на R2 — два сусіди FULL), show ipv6 route ospf (наступний хоп — link-local FE80::…). PC1 → ping 2001:db8:acad:3::10."],
  def:()=>({devices:{
    R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.1.1",M24); IP(s,"Gi0/1","10.0.12.1",M30); OSPF(s,1,"1.1.1.1",[["192.168.1.0","0.0.0.255",0],["10.0.12.0","0.0.0.3",0]],["Gi0/0"]); V6(s,"Gi0/0","2001:db8:acad:1::1/64","FE80::1"); V6(s,"Gi0/1","2001:db8:acad:12::1/64","FE80::1"); }},
    R2:{type:"router",setup:s=>{ IP(s,"Gi0/1","10.0.12.2",M30); IP(s,"Gi0/2","10.0.23.2",M30); OSPF(s,1,"2.2.2.2",[["10.0.12.0","0.0.0.3",0],["10.0.23.0","0.0.0.3",0]]); V6(s,"Gi0/1","2001:db8:acad:12::2/64","FE80::2"); V6(s,"Gi0/2","2001:db8:acad:23::2/64","FE80::2"); }},
    R3:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.3.1",M24); IP(s,"Gi0/1","10.0.23.3",M30); OSPF(s,1,"3.3.3.3",[["192.168.3.0","0.0.0.255",0],["10.0.23.0","0.0.0.3",0]],["Gi0/0"]); V6(s,"Gi0/0","2001:db8:acad:3::1/64","FE80::3"); V6(s,"Gi0/1","2001:db8:acad:23::3/64","FE80::3"); }},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1",ip6:{addr:"2001:DB8:ACAD:1::10",len:64,gw:"FE80::1"}},PC3:{type:"pc",ip:"192.168.3.10",mask:M24,gw:"192.168.3.1",ip6:{addr:"2001:DB8:ACAD:3::10",len:64,gw:"FE80::3"}}},
    links:[["PC1","Fa0","R1","Gi0/0"],["R1","Gi0/1","R2","Gi0/1"],["R2","Gi0/2","R3","Gi0/1"],["PC3","Fa0","R3","Gi0/0"]]}),
  check:N=>{ const r=d=>N.dev[d].ospf6; return [[["R1","R2","R3"].every(d=>N.dev[d].v6routing),"ipv6 unicast-routing на всіх"],[["R1","R2","R3"].every(d=>r(d)&&r(d).rid),"ipv6 router ospf з явним router-id"],
      [N.ospf6Neighbors("R2").filter(n=>n.full).length===2,"R2 має двох сусідів OSPFv3 у стані FULL"],[!!r("R1")&&r("R1").passive.includes("Gi0/0")&&!!r("R3")&&r("R3").passive.includes("Gi0/0"),"LAN-інтерфейси пасивні"],
      [N.ospf6Routes("R1").some(x=>v6same(x.pfx,"2001:db8:acad:3::",64)),"R1 вивчив 2001:DB8:ACAD:3::/64 через OSPFv3"],[N.flow6("PC1","2001:DB8:ACAD:3::10").ok,"PC1 ↔ PC3 по IPv6"],[pass(N,"PC1","192.168.3.10"),"IPv4 (OSPFv2) і далі працює"]]; },
  sol:"R1:\nenable\nconf t\nipv6 unicast-routing\nipv6 router ospf 1\n router-id 1.1.1.1\n passive-interface g0/0\nexit\ninterface g0/0\n ipv6 ospf 1 area 0\ninterface g0/1\n ipv6 ospf 1 area 0\nend\n\nR2:\nenable\nconf t\nipv6 unicast-routing\nipv6 router ospf 1\n router-id 2.2.2.2\nexit\ninterface g0/1\n ipv6 ospf 1 area 0\ninterface g0/2\n ipv6 ospf 1 area 0\nend\n\nR3:\nenable\nconf t\nipv6 unicast-routing\nipv6 router ospf 1\n router-id 3.3.3.3\n passive-interface g0/0\nexit\ninterface g0/0\n ipv6 ospf 1 area 0\ninterface g0/1\n ipv6 ospf 1 area 0\nend"},
 {id:"net-aaa",net:true,t:"SRWE10",title:"AAA: вхід через TACACS+ з резервом на локальну базу, бекап через SCP",
  topo:"Admin PC 192.168.1.10 — R1 Gi0/0 192.168.1.1\nR1 Gi0/1 10.1.1.1/24 — S1 — ISE (TACACS+) 10.1.1.5, Backup (SCP) 10.1.1.10",
  task:["SSH на R1 уже налаштовано з локальною базою (користувач admin). З Admin PC: ssh -l admin 192.168.1.1 — працює, а мережевий інженер netops (є лише на ISE) не може увійти.",
   "Увімкніть AAA: aaa new-model; tacacs server ISE1 з address ipv4 10.1.1.5 і key K3y!; aaa authentication login default group tacacs+ local; на line vty — login authentication default.",
   "З Admin PC: ssh -l netops 192.168.1.1 — вхід через TACACS+. Перевірте show tacacs (Status: ALIVE).",
   "Перевірка резерву: shutdown на R1 Gi0/1 — тепер netops не входить (сервер недоступний), а admin входить через local. Потім no shutdown.",
   "Збережіть конфігурацію на сервер Backup по SCP: copy running-config scp://admin@10.1.1.10/r1.cfg (TFTP не шифрує)."],
  def:()=>({devices:{S1:{type:"switch"},
    R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.1.1",M24); IP(s,"Gi0/1","10.1.1.1",M24); s.domain="ccna.lab"; s.rsaBits=2048; s.sshVer=2; s.users.admin={secret:true,priv:15}; s.vty.transport="ssh"; s.vty.login="local"; }},
    Admin:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"},ISE:{type:"server",ip:"10.1.1.5",mask:M24,gw:"10.1.1.1",services:[49],aaa:{key:"K3y!",users:["netops"]}},Backup:{type:"server",ip:"10.1.1.10",mask:M24,gw:"10.1.1.1",services:[22,69]}},
    links:[["Admin","Fa0","R1","Gi0/0"],["R1","Gi0/1","S1","Gi0/1"],["ISE","Fa0","S1","Fa0/5"],["Backup","Fa0","S1","Fa0/10"]]}),
  check:N=>{ const r=N.dev.R1; const a=r.aaa||{}; const t=Object.values(r.tacacs||{})[0]||{}; const lg=u=>N.login("R1",u).ok;
    const fb=()=>{ const i=r.ifs["Gi0/1"]; const was=i.shutdown; i.shutdown=true; N.recompute(); const ok=lg("admin")&&!lg("netops"); i.shutdown=was; N.recompute(); return ok; };
    return [[!!a.on,"aaa new-model"],[t.ip==="10.1.1.5"&&t.key==="K3y!","TACACS+-сервер 10.1.1.5 з правильним ключем"],[JSON.stringify((a.login||{}).default||[])===JSON.stringify(["tacacs+","local"]),"aaa authentication login default group tacacs+ local"],
      [lg("netops")&&/TACACS/.test(N.login("R1","netops").method||""),"netops входить через TACACS+"],[!!a.on&&fb(),"Без сервера admin входить через local, netops — ні"],[!!r.lastCopy&&/^(scp|sftp):/i.test(r.lastCopy.url)&&r.lastCopy.ok,"Конфігурацію скопійовано по SCP/SFTP"]]; },
  sol:"R1:\nenable\nconf t\naaa new-model\ntacacs server ISE1\n address ipv4 10.1.1.5\n key K3y!\nexit\naaa authentication login default group tacacs+ local\nline vty 0 15\n login authentication default\nend\ncopy running-config scp://admin@10.1.1.10/r1.cfg"},
 {id:"net-dns",net:true,t:"ITN15",title:"DNS: діагностика й виправлення записів",
  topo:"PC1 (DNS 10.1.1.53) — R1 Gi0/0 192.168.1.1     R1 Gi0/1 10.1.1.1 — S1 — DNS1 10.1.1.53, Web01 10.1.1.20, Mail 10.1.1.25\nЗона corp.lab на DNS1",
  task:["Скарги: www.corp.lab не відкривається, пошта на corp.lab не доходить, а журнали сервера показують IP замість імені Web01.",
   "Діагностуйте з PC1: nslookup www.corp.lab, nslookup -type=mx corp.lab, nslookup 10.1.1.20. Що саме відповідає сервер?",
   "Виправте зону на DNS1 (вкладка DNS1): dns list, далі dns add … — www має бути псевдонімом web01.corp.lab, поштовий сервер — mail.corp.lab з пріоритетом 10, для 10.1.1.20 потрібен зворотний запис.",
   "Перевірка: PC1 → ping www.corp.lab, nslookup з усіма трьома запитами без помилок."],
  def:()=>({devices:{S1:{type:"switch"},R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.1.1",M24); IP(s,"Gi0/1","10.1.1.1",M24); }},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1",dns:"10.1.1.53"},
    DNS1:{type:"server",ip:"10.1.1.53",mask:M24,gw:"10.1.1.1",services:[53],zone:[{t:"A",n:"web01.corp.lab",v:"10.1.1.20"},{t:"A",n:"mail.corp.lab",v:"10.1.1.25"},{t:"A",n:"dns1.corp.lab",v:"10.1.1.53"},{t:"NS",n:"corp.lab",v:"dns1.corp.lab"}]},
    Web01:{type:"server",ip:"10.1.1.20",mask:M24,gw:"10.1.1.1",services:[80]},Mail:{type:"server",ip:"10.1.1.25",mask:M24,gw:"10.1.1.1",services:[25]}},
    links:[["PC1","Fa0","R1","Gi0/0"],["R1","Gi0/1","S1","Gi0/1"],["DNS1","Fa0","S1","Fa0/1"],["Web01","Fa0","S1","Fa0/2"],["Mail","Fa0","S1","Fa0/3"]]}),
  check:N=>{ const q=(n,t)=>N.dnsQuery("PC1",n,t); const www=q("www.corp.lab","A"), mx=q("corp.lab","MX"), ptr=q("10.1.1.20","PTR");
    return [[www.ok&&www.answers.some(x=>x.t==="CNAME"&&x.v==="web01.corp.lab")&&www.answers.some(x=>x.t==="A"&&x.v==="10.1.1.20"),"www.corp.lab — CNAME на web01.corp.lab → 10.1.1.20"],[mx.ok&&mx.answers.some(x=>x.t==="MX"&&/mail\.corp\.lab$/.test(x.v)),"MX для corp.lab → mail.corp.lab"],
      [ptr.ok&&/web01\.corp\.lab/.test(ptr.answers[0].v),"PTR: 10.1.1.20 → web01.corp.lab"],[pass(N,"PC1","10.1.1.20"),"PC1 бачить Web01"]]; },
  sol:"DNS1:\ndns add CNAME www.corp.lab web01.corp.lab\ndns add MX corp.lab 10 mail.corp.lab\ndns add PTR 10.1.1.20 web01.corp.lab"},
 // ===================== Модулі без практики: SRWE2, SRWE10, SRWE14, ENSA3, ENSA4, ENSA8 =====================
 {id:"net-mac",net:true,t:"SRWE2",title:"MAC-таблиця: навчання, старіння, статичні записи",
  topo:"PC1 — S1 Fa0/1    PC2 — S1 Fa0/2    Server — S1 Fa0/24",
  task:["PC1 → ping 192.168.1.100, потім на S1: show mac address-table. Комутатор вивчив MAC за адресою джерела кадрів (DYNAMIC).",
   "Задайте час старіння динамічних записів 600 с: mac address-table aging-time 600 (за замовчуванням 300).",
   "Сервер не повинен «переїжджати»: додайте статичний запис для його MAC у VLAN 1 на Fa0/24 (MAC дізнайтеся з show mac address-table або ipconfig /all на Server).",
   "Перевірте show mac address-table static і show mac address-table aging-time. clear mac address-table dynamic очищає лише динамічні записи."],
  def:()=>({devices:{S1:{type:"switch"},PC1:{type:"pc",ip:"192.168.1.11",mask:M24},PC2:{type:"pc",ip:"192.168.1.12",mask:M24},Server:{type:"server",ip:"192.168.1.100",mask:M24}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S1","Fa0/2"],["Server","Fa0","S1","Fa0/24"]]}),
  check:N=>{ const s=N.dev.S1, m=N.hostMac("Server"); return [[s.macAging===600,"aging-time 600"],[(s.macStatic||[]).some(x=>x.mac===m&&x.v===1&&x.port==="Fa0/24"),"Статичний запис для MAC сервера на Fa0/24"],[pass(N,"PC1","192.168.1.100"),"PC1 ↔ Server"]]; },
  sol:"S1:\nenable\nconf t\nmac address-table aging-time 600\nmac address-table static {{MAC:Server}} vlan 1 interface fa0/24\nend"},
 {id:"net-vlanhop",net:true,t:"SRWE10",title:"Захист від VLAN hopping і невикористані порти",
  topo:"PC1 (VLAN10) — S1 Fa0/1        S2 Fa0/1 — PC2 (VLAN10)\n             S1 Gi0/1 ═══ S2 Gi0/1 (trunk через DTP, native VLAN 1)",
  task:["Зараз trunk між S1 і S2 піднімається через DTP (dynamic desirable), native VLAN — 1, а access-порти в режимі dynamic auto: зловмисник може «домовитися» про trunk або використати подвійне тегування.",
   "На обох комутаторах: Gi0/1 — switchport mode trunk, switchport nonegotiate, native VLAN 999 (створіть VLAN 999 BlackHole і не використовуйте її для хостів), дозволені лише VLAN 10.",
   "Порти до ПК (Fa0/1) — switchport mode access (DTP вимикається).","Усі інші порти Fa0/2–24 і Gi0/2 на обох — shutdown. PC1 → ping 192.168.10.12."],
  def:()=>({devices:{S1:{type:"switch",vlans:{10:"Users"},setup:s=>{ s.ifs["Fa0/1"].accessVlan=10; s.ifs["Gi0/1"].mode="dynamic desirable"; }},S2:{type:"switch",vlans:{10:"Users"},setup:s=>{ s.ifs["Fa0/1"].accessVlan=10; }},
    PC1:{type:"pc",ip:"192.168.10.11",mask:M24},PC2:{type:"pc",ip:"192.168.10.12",mask:M24}},
    links:[["PC1","Fa0","S1","Fa0/1"],["PC2","Fa0","S2","Fa0/1"],["S1","Gi0/1","S2","Gi0/1"]]}),
  check:N=>{ const ok=d=>{ const s=N.dev[d], t=s.ifs["Gi0/1"]; return t.mode==="trunk"&&t.nonegotiate&&t.nativeVlan===999&&JSON.stringify(t.allowed)==="[10]"&&s.ifs["Fa0/1"].mode==="access"&&rng("Fa0/",2,24).concat(["Gi0/2"]).every(p=>s.ifs[p].shutdown); };
    return [[ok("S1"),"S1: статичний trunk без DTP, native 999, лише VLAN 10; access-порт; невикористані вимкнено"],[ok("S2"),"S2: те саме"],[pass(N,"PC1","192.168.10.12"),"PC1 ↔ PC2"]]; },
  sol:"S1:\nenable\nconf t\nvlan 999\n name BlackHole\nexit\ninterface gi0/1\n switchport mode trunk\n switchport nonegotiate\n switchport trunk native vlan 999\n switchport trunk allowed vlan 10\ninterface fa0/1\n switchport mode access\ninterface range fa0/2 - 24, gi0/2\n shutdown\nend\n\nS2:\nenable\nconf t\nvlan 999\n name BlackHole\nexit\ninterface gi0/1\n switchport mode trunk\n switchport nonegotiate\n switchport trunk native vlan 999\n switchport trunk allowed vlan 10\ninterface fa0/1\n switchport mode access\ninterface range fa0/2 - 24, gi0/2\n shutdown\nend"},
 {id:"net-lpm",net:true,t:"SRWE14",title:"Таблиця маршрутизації: найдовший збіг і маршрут до хоста",
  topo:"PC1 — R1 Gi0/0 192.168.1.1\nR1 Gi0/1 10.0.12.1/30 — R2 (10.0.12.2) ─┐\nR1 Gi0/2 10.0.13.1/30 — R3 (10.0.13.2) ─┴─ S1 — 10.10.0.0/16: App 10.10.5.5, Files 10.10.6.6\nR3 — це фільтр безпеки",
  task:["Зараз у R1 немає маршрутів до 10.10.0.0/16. Додайте мережевий маршрут 10.10.0.0/16 через R2 (10.0.12.2).",
   "Вимога безпеки: трафік лише до App (10.10.5.5) має йти через R3. Додайте маршрут до хоста 10.10.5.5/32 через 10.0.13.2 — він довший за /16, тож виграє (longest prefix match).",
   "Додайте маршрут за замовчуванням 0.0.0.0/0 через R2. Подивіться show ip route: S* — gateway of last resort.",
   "Перевірка: tracert 10.10.5.5 з PC1 проходить через 10.0.13.2, а tracert 10.10.6.6 — через 10.0.12.2."],
  def:()=>({devices:{S1:{type:"switch"},
    R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.1.1",M24); IP(s,"Gi0/1","10.0.12.1",M30); IP(s,"Gi0/2","10.0.13.1",M30); }},
    R2:{type:"router",setup:s=>{ IP(s,"Gi0/1","10.0.12.2",M30); IP(s,"Gi0/0","10.10.0.2","255.255.0.0"); addRoute(s,"192.168.1.0",M24,"10.0.12.1",null,1); }},
    R3:{type:"router",setup:s=>{ IP(s,"Gi0/1","10.0.13.2",M30); IP(s,"Gi0/0","10.10.0.3","255.255.0.0"); addRoute(s,"192.168.1.0",M24,"10.0.13.1",null,1); }},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"},App:{type:"server",ip:"10.10.5.5",mask:"255.255.0.0",gw:"10.10.0.3"},Files:{type:"server",ip:"10.10.6.6",mask:"255.255.0.0",gw:"10.10.0.2"}},
    links:[["PC1","Fa0","R1","Gi0/0"],["R1","Gi0/1","R2","Gi0/1"],["R1","Gi0/2","R3","Gi0/1"],["R2","Gi0/0","S1","Gi0/1"],["R3","Gi0/0","S1","Gi0/2"],["App","Fa0","S1","Fa0/1"],["Files","Fa0","S1","Fa0/2"]]}),
  check:N=>{ const r=N.dev.R1.routes; const via=(dst,hop)=>{ const x=N.ping("PC1",dst); return x.ok&&(x.hops||[]).includes(hop); };
    return [[r.some(x=>x.net==="10.10.0.0"&&x.mask==="255.255.0.0"&&x.nh==="10.0.12.2"),"Маршрут 10.10.0.0/16 через R2"],[r.some(x=>x.net==="10.10.5.5"&&x.mask==="255.255.255.255"&&x.nh==="10.0.13.2"),"Маршрут до хоста 10.10.5.5/32 через R3"],
      [r.some(x=>x.mask==="0.0.0.0"&&x.nh==="10.0.12.2"),"Маршрут за замовчуванням через R2"],[via("10.10.5.5","10.0.13.2"),"PC1 → App іде через R3"],[via("10.10.6.6","10.0.12.2"),"PC1 → Files іде через R2"]]; },
  sol:"R1:\nenable\nconf t\nip route 10.10.0.0 255.255.0.0 10.0.12.2\nip route 10.10.5.5 255.255.255.255 10.0.13.2\nip route 0.0.0.0 0.0.0.0 10.0.12.2\nend"},
 {id:"net-acl-policy",net:true,t:"ENSA4",title:"ACL: від політики безпеки до правил і wildcard",
  topo:"LAN 192.168.10.0/24 — R1 Gi0/0       R1 Gi0/1 — Srv 10.1.1.10 (SSH, HTTP)\nAdmin 192.168.10.40, User 192.168.10.100     R1 Gi0/2 — Internet 203.0.113.10",
  task:["Політика: SSH (TCP 22) до Srv дозволено лише адмінам — адреси 192.168.10.32–47; веб (TCP 80) до Srv — усім; будь-який інший трафік до Srv заборонено; решта (наприклад, в Інтернет) — дозволено.",
   "Порахуйте wildcard для діапазону .32–.47 (16 адрес → блок /28 → 0.0.0.15).",
   "Створіть розширений іменований ACL SRV-POLICY і застосуйте його якомога ближче до джерела: R1 Gi0/0 in.",
   "Перевірка: Admin → ssh 10.1.1.10 працює, User → ssh — ні; User → curl 10.1.1.10 працює; User → ping 10.1.1.10 — ні; User → ping 203.0.113.10 — так. Подивіться лічильники в show access-lists."],
  def:()=>({devices:{S1:{type:"switch"},R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.10.1",M24); IP(s,"Gi0/1","10.1.1.1",M24); IP(s,"Gi0/2","203.0.113.1",M24); }},
    Admin:{type:"pc",ip:"192.168.10.40",mask:M24,gw:"192.168.10.1"},User:{type:"pc",ip:"192.168.10.100",mask:M24,gw:"192.168.10.1"},Srv:{type:"server",ip:"10.1.1.10",mask:M24,gw:"10.1.1.1",services:[22,80]},Internet:{type:"server",ip:"203.0.113.10",mask:M24,gw:"203.0.113.1",services:[80]}},
    links:[["Admin","Fa0","S1","Fa0/1"],["User","Fa0","S1","Fa0/2"],["S1","Gi0/1","R1","Gi0/0"],["Srv","Fa0","R1","Gi0/1"],["Internet","Fa0","R1","Gi0/2"]]}),
  check:N=>{ const f=(a,b,p,pt)=>N.flow(a,b,p,pt).ok; const i=N.dev.R1.ifs["Gi0/0"];
    return [[!!i.aclIn,"ACL застосовано на R1 Gi0/0 in"],[f("Admin","10.1.1.10","tcp",22),"Admin → SSH до Srv"],[!f("User","10.1.1.10","tcp",22),"User → SSH заблоковано"],[f("User","10.1.1.10","tcp",80),"User → HTTP до Srv"],[!f("User","10.1.1.10","icmp"),"User → інший трафік до Srv заблоковано"],[f("User","203.0.113.10","icmp"),"User → Інтернет працює"]]; },
  sol:"R1:\nenable\nconf t\nip access-list extended SRV-POLICY\n permit tcp 192.168.10.32 0.0.0.15 host 10.1.1.10 eq 22\n permit tcp any host 10.1.1.10 eq 80\n deny ip any host 10.1.1.10\n permit ip any any\nexit\ninterface g0/0\n ip access-group SRV-POLICY in\nend"},
 {id:"net-harden",net:true,t:"ENSA3",title:"Hardening маршрутизатора: паролі, SSH, обмеження входу",
  topo:"Admin PC 192.168.1.10 — R1 Gi0/0 192.168.1.1",
  task:["R1 щойно з коробки: Telnet, паролі відкритим текстом, HTTP-сервер. Захистіть його.",
   "enable secret, service password-encryption, security passwords min-length 10; локальний користувач admin з secret і privilege 15.",
   "SSH: ip domain-name ccna.lab, crypto key generate rsa modulus 2048, ip ssh version 2; на line vty 0 15: transport input ssh, login local, exec-timeout 5 0.",
   "Захист від підбору: login block-for 120 attempts 3 within 60. Вимкніть веб-сервер: no ip http server. Додайте banner motd з попередженням.","Перевірка: з Admin PC — ssh -l admin 192.168.1.1 працює, telnet 192.168.1.1 — ні."],
  def:()=>({devices:{R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.1.1",M24); s.vty.password="cisco"; s.vty.login="line"; }},Admin:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"}},links:[["Admin","Fa0","R1","Gi0/0"]]}),
  check:N=>{ const r=N.dev.R1; return [[!!r.enableSecret&&r.servicePwEnc&&(r.pwMin||0)>=10,"enable secret, шифрування паролів, мінімум 10 символів"],[!!r.users.admin&&r.users.admin.secret,"Користувач admin із secret"],
      [r.sshVer===2&&r.rsaBits>=2048&&r.vty.transport==="ssh"&&r.vty.login==="local","SSH v2 з ключем 2048, на vty лише SSH і login local"],[!!r.vty.execTimeout&&r.vty.execTimeout[0]>0&&r.vty.execTimeout[0]<=10,"exec-timeout на vty"],[!!r.loginBlock&&!!r.httpOff&&!!r.motd,"login block-for, no ip http server, banner motd"],
      [N.flow("Admin","192.168.1.1","tcp",22).ok&&N.login("R1","admin").ok,"Admin входить по SSH"],[!N.flow("Admin","192.168.1.1","tcp",23).ok,"Telnet закрито"]]; },
  sol:"R1:\nenable\nconf t\nenable secret Cl@ss2026!\nservice password-encryption\nsecurity passwords min-length 10\nusername admin privilege 15 secret Adm1nPa55!\nip domain-name ccna.lab\ncrypto key generate rsa modulus 2048\nip ssh version 2\nline vty 0 15\n transport input ssh\n login local\n exec-timeout 5 0\nexit\nlogin block-for 120 attempts 3 within 60\nno ip http server\nbanner motd #Authorized access only#\nend"},
 {id:"net-gre",net:true,t:"ENSA8",title:"GRE-тунель між філіями через провайдера",
  topo:"PC1 192.168.1.10 — R1 Gi0/0      R1 Gi0/1 198.51.100.1 — ISP — 203.0.113.1 R2 Gi0/1      R2 Gi0/0 — PC2 192.168.2.10\nISP не знає приватних мереж філій",
  task:["Філії бачать ISP (маршрути за замовчуванням уже є), але PC1 → 192.168.2.10 не працює: провайдер не маршрутизує приватні адреси.",
   "Створіть interface tunnel 0 на R1 і R2: ip address 10.255.0.1/30 і 10.255.0.2/30, tunnel source g0/1, tunnel destination — публічна адреса протилежного маршрутизатора.",
   "Додайте статичні маршрути до LAN іншої філії через адресу тунелю (на R1 — через 10.255.0.2, на R2 — через 10.255.0.1).",
   "Перевірка: show interfaces tunnel 0 (up/up), PC1 → ping 192.168.2.10, tracert показує 10.255.0.2. Пам'ятайте: GRE не шифрує — для захисту потрібен IPsec (GRE over IPsec)."],
  def:()=>({devices:{
    R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.1.1",M24); IP(s,"Gi0/1","198.51.100.1",M30); addRoute(s,"0.0.0.0","0.0.0.0","198.51.100.2",null,1); }},
    ISP:{type:"router",setup:s=>{ IP(s,"Gi0/1","198.51.100.2",M30); IP(s,"Gi0/2","203.0.113.2",M30); }},
    R2:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.2.1",M24); IP(s,"Gi0/1","203.0.113.1",M30); addRoute(s,"0.0.0.0","0.0.0.0","203.0.113.2",null,1); }},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"},PC2:{type:"pc",ip:"192.168.2.10",mask:M24,gw:"192.168.2.1"}},
    links:[["PC1","Fa0","R1","Gi0/0"],["R1","Gi0/1","ISP","Gi0/1"],["ISP","Gi0/2","R2","Gi0/1"],["PC2","Fa0","R2","Gi0/0"]]}),
  check:N=>{ const t=d=>N.dev[d].ifs.Tu0; const up=d=>!!t(d)&&ifStatus(N.dev[d],t(d))[1]==="up"; const x=N.ping("PC1","192.168.2.10");
    return [[!!t("R1")&&!!t("R2")&&t("R1").tunDst==="203.0.113.1"&&t("R2").tunDst==="198.51.100.1","Тунелі з правильними адресами призначення"],[up("R1")&&up("R2"),"Tunnel0 up/up на обох"],[x.ok,"PC1 ↔ PC2 через тунель"],[x.ok&&(x.hops||[]).includes("10.255.0.2"),"Трафік іде через тунель (хоп 10.255.0.2)"]]; },
  sol:"R1:\nenable\nconf t\ninterface tunnel 0\n ip address 10.255.0.1 255.255.255.252\n tunnel source g0/1\n tunnel destination 203.0.113.1\nexit\nip route 192.168.2.0 255.255.255.0 10.255.0.2\nend\n\nR2:\nenable\nconf t\ninterface tunnel 0\n ip address 10.255.0.2 255.255.255.252\n tunnel source g0/1\n tunnel destination 198.51.100.1\nexit\nip route 192.168.1.0 255.255.255.0 10.255.0.1\nend"},
 // ===================== WLAN, WAN, QoS, дизайн, віртуалізація =====================
 {id:"net-capwap",net:true,t:"SRWE12",title:"Lightweight AP: пошук WLC через DHCP option 43",
  topo:"R1 Gi0/0 10.10.10.1/24 — S1 Gi0/1\nS1 Fa0/5 — AP1 (lightweight, DHCP)      S1 Fa0/10 — WLC 10.10.10.5 (CAPWAP UDP 5246/5247)",
  task:["AP1 — легка точка доступу: вона не працює сама, а шукає контролер WLC і будує до нього CAPWAP-тунель. Зараз AP1 не отримує навіть IP-адресу: на мережі немає DHCP-сервера.",
   "На R1 створіть пул AP-MGMT: мережа 10.10.10.0/24, шлюз 10.10.10.1; виключіть 10.10.10.1–10.10.10.10.",
   "Додайте адресу WLC в опції 43 (формат TLV Cisco: тип F1, довжина = 4 × кількість WLC, далі IP у hex): 10.10.10.5 → 0A0A0A05, тобто option 43 hex f104.0a0a.0a05.",
   "AP1: ipconfig /renew, ipconfig /all. Перевірте, що AP1 досягає WLC по UDP 5246 (CAPWAP control): N.B. CAPWAP data — UDP 5247."],
  def:()=>({devices:{S1:{type:"switch"},R1:{type:"router",setup:s=>IP(s,"Gi0/0","10.10.10.1",M24)},
    AP1:{type:"pc",dhcp:true},WLC:{type:"server",ip:"10.10.10.5",mask:M24,gw:"10.10.10.1",services:[5246,5247,443]}},
    links:[["R1","Gi0/0","S1","Gi0/1"],["AP1","Fa0","S1","Fa0/5"],["WLC","Fa0","S1","Fa0/10"]]}),
  check:N=>{ const p=Object.values(N.dev.R1.dhcp.pools).find(x=>x.net==="10.10.10.0"); const ap=N.dev.AP1;
    return [[!!p&&p.gw==="10.10.10.1","Пул DHCP для 10.10.10.0/24 зі шлюзом 10.10.10.1"],[N.dev.R1.dhcp.excl.some(e=>e[0]==="10.10.10.1"),"Виключено 10.10.10.1–10.10.10.10"],[!!p&&p.opt43==="f1040a0a0a05","Option 43 = f104.0a0a.0a05 (WLC 10.10.10.5)"],
      [!!ap.ip&&sameNet(ap.ip,"10.10.10.0",M24)&&ap.opt43==="f1040a0a0a05","AP1 отримав адресу й опцію 43"],[!!ap.ip&&N.flow("AP1","10.10.10.5","udp",5246).ok,"AP1 досягає WLC по CAPWAP (UDP 5246)"]]; },
  sol:"R1:\nenable\nconf t\nip dhcp excluded-address 10.10.10.1 10.10.10.10\nip dhcp pool AP-MGMT\n network 10.10.10.0 255.255.255.0\n default-router 10.10.10.1\n option 43 hex f104.0a0a.0a05\nend\n\nAP1:\nipconfig /renew"},
 {id:"net-flex",net:true,t:"SRWE13",title:"FlexConnect AP: trunk до точки доступу й локальна комутація SSID",
  topo:"R1 Gi0/0 (.10 10.10.10.1, .20 192.168.20.1, .30 192.168.30.1) — S1 Gi0/1 (trunk)\nS1 Fa0/5 — AP1 Gi0/1 (FlexConnect; моделюється комутатором)\nAP1 Fa0/1 — Laptop (SSID CORP → VLAN 20)    AP1 Fa0/2 — Guest (SSID GUEST → VLAN 30)",
  task:["AP1 перевели з режиму local у FlexConnect: тепер трафік SSID комутується локально, а не тунелюється на WLC. SSID CORP прив'язано до VLAN 20, GUEST — до VLAN 30, керування AP — у VLAN 10 (native).",
   "S1 Fa0/5 досі налаштовано як access-порт для local-режиму (VLAN 10), тож клієнти Wi-Fi не працюють: Laptop → ping 192.168.20.1.",
   "Перетворіть S1 Fa0/5 на trunk: native VLAN 10 (без тегу — як очікує AP), дозволені лише VLAN 10, 20, 30.",
   "Перевірка: Laptop → ping 192.168.20.1, Guest → ping 192.168.30.1, show interfaces trunk на S1 — без native VLAN mismatch."],
  def:()=>({devices:{S1:{type:"switch",vlans:{10:"AP-MGMT",20:"CORP",30:"GUEST"},setup:s=>{ s.ifs["Fa0/5"].accessVlan=10; s.ifs["Fa0/5"].mode="access"; s.ifs["Gi0/1"].mode="trunk"; }},
    AP1:{type:"switch",vlans:{10:"AP-MGMT",20:"CORP",30:"GUEST"},setup:s=>{ s.hostname="AP1"; Object.assign(s.ifs["Gi0/1"],{mode:"trunk",nativeVlan:10,allowed:[10,20,30]}); ACC(s,{"Fa0/1":20,"Fa0/2":30}); }},
    R1:{type:"router",setup:s=>{ SUB(s,"Gi0/0",10,"10.10.10.1",M24); SUB(s,"Gi0/0",20,"192.168.20.1",M24); SUB(s,"Gi0/0",30,"192.168.30.1",M24); }},
    Laptop:{type:"pc",ip:"192.168.20.50",mask:M24,gw:"192.168.20.1"},Guest:{type:"pc",ip:"192.168.30.50",mask:M24,gw:"192.168.30.1"}},
    links:[["R1","Gi0/0","S1","Gi0/1"],["S1","Fa0/5","AP1","Gi0/1"],["Laptop","Fa0","AP1","Fa0/1"],["Guest","Fa0","AP1","Fa0/2"]]}),
  check:N=>{ const i=N.dev.S1.ifs["Fa0/5"]; return [[i.mode==="trunk","S1 Fa0/5 — trunk"],[i.nativeVlan===10,"Native VLAN 10 (збігається з AP)"],[JSON.stringify(i.allowed)==="[10,20,30]","Дозволено лише VLAN 10, 20, 30"],
      [pass(N,"Laptop","192.168.20.1"),"Клієнт SSID CORP досягає шлюзу VLAN 20"],[pass(N,"Guest","192.168.30.1"),"Клієнт SSID GUEST досягає шлюзу VLAN 30"]]; },
  sol:"S1:\nenable\nconf t\ninterface fa0/5\n switchport mode trunk\n switchport trunk native vlan 10\n switchport trunk allowed vlan 10,20,30\nend"},
 {id:"net-wan-backup",net:true,t:"ENSA7",title:"Dual-homed WAN: основний канал і резервний через floating static",
  topo:"PC1 — R1 Gi0/0 192.168.1.1\nR1 Gi0/1 198.51.100.2/30 — ISP1 (оптика) — INET (Lo0 8.8.8.8)\nR1 Gi0/2 203.0.113.2/30 — ISP2 (LTE, Lo0 203.0.113.129 — сайт ISP2)",
  task:["Офіс під'єднано до двох провайдерів (dual-homed): ISP1 — основний оптичний канал, ISP2 — резервний LTE. Зараз у R1 немає маршруту за замовчуванням.",
   "Додайте основний маршрут за замовчуванням через ISP1 (198.51.100.1) з AD 1.",
   "Додайте резервний (floating static) через ISP2 (203.0.113.1) з AD 10: він не з'явиться в таблиці, доки працює основний.",
   "Перевірка: show ip route — S* через 198.51.100.1; PC1 → ping 8.8.8.8. Потім shutdown на R1 Gi0/1: тепер S* через 203.0.113.1, PC1 → ping 203.0.113.129. Поверніть no shutdown.",
   "Зверніть увагу: floating static спрацьовує лише при падінні інтерфейсу. Якщо збій далі в мережі провайдера, потрібне IP SLA з track."],
  def:()=>({devices:{
    R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.1.1",M24); IP(s,"Gi0/1","198.51.100.2",M30); IP(s,"Gi0/2","203.0.113.2",M30); }},
    ISP1:{type:"router",setup:s=>{ IP(s,"Gi0/1","198.51.100.1",M30); IP(s,"Gi0/2","10.1.1.1",M30); addRoute(s,"192.168.1.0",M24,"198.51.100.2",null,1); addRoute(s,"0.0.0.0","0.0.0.0","10.1.1.2",null,1); }},
    INET:{type:"router",setup:s=>{ IP(s,"Gi0/1","10.1.1.2",M30); IP(s,"Lo0","8.8.8.8","255.255.255.255"); addRoute(s,"192.168.1.0",M24,"10.1.1.1",null,1); }},
    ISP2:{type:"router",setup:s=>{ IP(s,"Gi0/1","203.0.113.1",M30); IP(s,"Lo0","203.0.113.129","255.255.255.255"); addRoute(s,"192.168.1.0",M24,"203.0.113.2",null,1); }},
    PC1:{type:"pc",ip:"192.168.1.10",mask:M24,gw:"192.168.1.1"}},
    links:[["PC1","Fa0","R1","Gi0/0"],["R1","Gi0/1","ISP1","Gi0/1"],["ISP1","Gi0/2","INET","Gi0/1"],["R1","Gi0/2","ISP2","Gi0/1"]]}),
  check:N=>{ const r=N.dev.R1.routes; const d1=r.find(x=>x.mask==="0.0.0.0"&&x.nh==="198.51.100.1"), d2=r.find(x=>x.mask==="0.0.0.0"&&x.nh==="203.0.113.1");
    const fo=()=>{ const i=N.dev.R1.ifs["Gi0/1"]; const was=i.shutdown; i.shutdown=true; N.recompute(); const ok=pass(N,"PC1","203.0.113.129"); i.shutdown=was; N.recompute(); return ok; };
    return [[!!d1&&(d1.ad||1)===1,"Основний маршрут за замовчуванням через ISP1 (AD 1)"],[!!d2&&(d2.ad||1)>1,"Floating static через ISP2 з AD більшим за 1"],[pass(N,"PC1","8.8.8.8"),"PC1 → 8.8.8.8 через основний канал"],[!!d2&&fo(),"Після падіння Gi0/1 трафік іде через ISP2"]]; },
  sol:"R1:\nenable\nconf t\nip route 0.0.0.0 0.0.0.0 198.51.100.1\nip route 0.0.0.0 0.0.0.0 203.0.113.1 10\nend"},
 {id:"net-qos",net:true,t:"ENSA9",title:"QoS: класифікація, LLQ для голосу, довіра до IP-телефону",
  topo:"Phone+PC — S1 Fa0/5 (data VLAN 10, voice VLAN 150)    S1 Gi0/1 — R1 Gi0/0\nR1 Gi0/1 (WAN, 10 Мбіт/с) — ISP — Server 203.0.113.10",
  task:["На WAN-каналі R1 голос «рветься» під час великих завантажень. Колега почав налаштовувати QoS: show running-config | section policy-map — політика WAN-QOS є, але IOS відмовляється її застосувати. Чому?",
   "Виправте WAN-QOS: клас VOICE (DSCP EF) — priority percent 20 (LLQ), клас VIDEO (DSCP AF41) — bandwidth percent 30 (CBWFQ), class-default — fair-queue. Сума гарантій має бути ≤ 100%.",
   "Застосуйте політику на вихід WAN-інтерфейсу: service-policy output WAN-QOS на R1 Gi0/1. Перевірте show policy-map interface g0/1.",
   "На S1: увімкніть QoS глобально (mls qos); на Fa0/5 — voice VLAN 150 і довіра до міток телефону лише якщо це справді Cisco IP Phone: mls qos trust cos + mls qos trust device cisco-phone.","PC1 → ping 203.0.113.10."],
  def:()=>({devices:{S1:{type:"switch",vlans:{10:"DATA"},setup:s=>ACC(s,{"Fa0/5":10,"Gi0/1":10})},
    R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","192.168.10.1",M24); IP(s,"Gi0/1","198.51.100.2",M30); addRoute(s,"0.0.0.0","0.0.0.0","198.51.100.1",null,1);
      s.qos={cmaps:{VOICE:{name:"VOICE",any:false,match:[{t:"dscp",v:"ef"}],desc:null},VIDEO:{name:"VIDEO",any:false,match:[{t:"dscp",v:"af41"}],desc:null}},
        pmaps:{"WAN-QOS":{name:"WAN-QOS",classes:[{name:"VOICE",prio:{pct:60},bw:null,set:null,fq:false,police:null},{name:"VIDEO",prio:null,bw:{pct:50},set:null,fq:false,police:null}]}}}; }},
    ISP:{type:"router",setup:s=>{ IP(s,"Gi0/1","198.51.100.1",M30); IP(s,"Gi0/0","203.0.113.1",M24); addRoute(s,"192.168.10.0",M24,"198.51.100.2",null,1); }},
    PC1:{type:"pc",ip:"192.168.10.11",mask:M24,gw:"192.168.10.1"},Server:{type:"server",ip:"203.0.113.10",mask:M24,gw:"203.0.113.1"}},
    links:[["PC1","Fa0","S1","Fa0/5"],["S1","Gi0/1","R1","Gi0/0"],["R1","Gi0/1","ISP","Gi0/1"],["Server","Fa0","ISP","Gi0/0"]]}),
  check:N=>{ const q=N.dev.R1.qos||{cmaps:{},pmaps:{}}; const p=q.pmaps["WAN-QOS"]; const c=n=>p&&p.classes.find(x=>x.name===n); const s1=N.dev.S1, f=s1.ifs["Fa0/5"];
    const mt=(n,v)=>{ const m=q.cmaps[n]; return !!m&&m.match.some(x=>x.t==="dscp"&&x.v.split(" ").includes(v)); };
    return [[mt("VOICE","ef")&&mt("VIDEO","af41"),"Класи VOICE (EF) і VIDEO (AF41)"],[!!c("VOICE")&&!!c("VOICE").prio&&c("VOICE").prio.pct===20,"VOICE — priority percent 20 (LLQ)"],[!!c("VIDEO")&&!!c("VIDEO").bw&&c("VIDEO").bw.pct===30,"VIDEO — bandwidth percent 30"],
      [!!c("class-default")&&c("class-default").fq,"class-default — fair-queue"],[N.dev.R1.ifs["Gi0/1"].svcOut==="WAN-QOS","service-policy output WAN-QOS на R1 Gi0/1"],
      [!!s1.mlsQos&&f.voiceVlan===150&&f.qosTrust==="cos"&&f.qosTrustDev==="cisco-phone","S1: mls qos, voice VLAN 150, trust cos лише для cisco-phone"],[pass(N,"PC1","203.0.113.10"),"PC1 → сервер"]]; },
  sol:"R1:\nenable\nconf t\npolicy-map WAN-QOS\n class VOICE\n  no priority\n  priority percent 20\n class VIDEO\n  no bandwidth\n  bandwidth percent 30\n class class-default\n  fair-queue\nexit\nexit\ninterface g0/1\n service-policy output WAN-QOS\nend\n\nS1:\nenable\nconf t\nmls qos\ninterface fa0/5\n switchport voice vlan 150\n mls qos trust cos\n mls qos trust device cisco-phone\nend"},
 {id:"net-collapsed",net:true,t:"ENSA11",title:"Дворівнева мережа (collapsed core): L3-комутатор, EtherChannel-аплінки",
  topo:"PC10 (VLAN10) — AS1 Fa0/1    AS1 Gi0/1-2 ═══ DS1 Fa0/1-2 (Po1)\nPC20 (VLAN20) — AS2 Fa0/1    AS2 Gi0/1-2 ═══ DS1 Fa0/3-4 (Po2)\nDS1 Gi0/1 10.0.0.2/30 (routed) — R1 Gi0/0 10.0.0.1 — Інтернет (Lo0 8.8.8.8)",
  task:["Мала мережа будується за дворівневою моделлю: доступ (AS1, AS2) і об'єднане ядро/розподіл (DS1, багаторівневий комутатор). Комутатори доступу вже налаштовано: аплінки зібрано в LACP EtherChannel (active, trunk).",
   "На DS1 зберіть Po1 (Fa0/1–2 до AS1) і Po2 (Fa0/3–4 до AS2): LACP, trunk. Подвійні аплінки дають і резерв, і смугу — без блокування STP.",
   "Маршрутизація між VLAN на DS1: ip routing, SVI Vlan10 192.168.10.1/24 і Vlan20 192.168.20.1/24.",
   "Аплінк до краю мережі — маршрутизований порт: на Gi0/1 no switchport, ip address 10.0.0.2/30; маршрут за замовчуванням через 10.0.0.1.",
   "Перевірка: show etherchannel summary (SU, порти P), PC10 → ping 192.168.20.10 і 8.8.8.8."],
  def:()=>({devices:{
    DS1:{type:"switch",l3:true,vlans:{10:"USERS",20:"STAFF"}},
    AS1:{type:"switch",vlans:{10:"USERS",20:"STAFF"},setup:s=>{ ACC(s,{"Fa0/1":10}); EC(s,1,["Gi0/1","Gi0/2"],"active",{mode:"trunk"}); }},
    AS2:{type:"switch",vlans:{10:"USERS",20:"STAFF"},setup:s=>{ ACC(s,{"Fa0/1":20}); EC(s,1,["Gi0/1","Gi0/2"],"active",{mode:"trunk"}); }},
    R1:{type:"router",setup:s=>{ IP(s,"Gi0/0","10.0.0.1",M30); IP(s,"Lo0","8.8.8.8","255.255.255.255"); addRoute(s,"192.168.10.0",M24,"10.0.0.2",null,1); addRoute(s,"192.168.20.0",M24,"10.0.0.2",null,1); }},
    PC10:{type:"pc",ip:"192.168.10.10",mask:M24,gw:"192.168.10.1"},PC20:{type:"pc",ip:"192.168.20.10",mask:M24,gw:"192.168.20.1"}},
    links:[["PC10","Fa0","AS1","Fa0/1"],["PC20","Fa0","AS2","Fa0/1"],["AS1","Gi0/1","DS1","Fa0/1"],["AS1","Gi0/2","DS1","Fa0/2"],["AS2","Gi0/1","DS1","Fa0/3"],["AS2","Gi0/2","DS1","Fa0/4"],["DS1","Gi0/1","R1","Gi0/0"]]}),
  check:N=>{ N.recompute(); const d=N.dev.DS1; const B=(ps)=>ps.every(p=>d.ifs[p]._ec==="P");
    return [[B(["Fa0/1","Fa0/2"])&&B(["Fa0/3","Fa0/4"]),"Po1 і Po2 на DS1 зібрано (LACP)"],[d.ipRouting&&!!d.ifs.Vlan10&&d.ifs.Vlan10.ip==="192.168.10.1"&&!!d.ifs.Vlan20&&d.ifs.Vlan20.ip==="192.168.20.1","ip routing і SVI для VLAN 10/20"],
      [d.ifs["Gi0/1"].switchport===false&&d.ifs["Gi0/1"].ip==="10.0.0.2","Gi0/1 — маршрутизований порт 10.0.0.2/30"],[d.routes.some(r=>r.mask==="0.0.0.0"&&r.nh==="10.0.0.1"),"Маршрут за замовчуванням через R1"],
      [pass(N,"PC10","192.168.20.10"),"PC10 ↔ PC20 через DS1"],[pass(N,"PC10","8.8.8.8"),"PC10 → Інтернет"]]; },
  sol:"DS1:\nenable\nconf t\ninterface range fa0/1 - 2\n switchport mode trunk\n channel-group 1 mode active\ninterface range fa0/3 - 4\n switchport mode trunk\n channel-group 2 mode active\nexit\nip routing\ninterface vlan 10\n ip address 192.168.10.1 255.255.255.0\n no shutdown\ninterface vlan 20\n ip address 192.168.20.1 255.255.255.0\n no shutdown\ninterface gi0/1\n no switchport\n ip address 10.0.0.2 255.255.255.252\n no shutdown\nexit\nip route 0.0.0.0 0.0.0.0 10.0.0.1\nend"},
 {id:"net-virt",net:true,t:"ENSA13",title:"Віртуалізація: гіпервізор з VM у різних VLAN (тегування VST)",
  topo:"R1 Gi0/0 (.10 192.168.10.1, .20 192.168.20.1, .30 192.168.30.1) — S1 Gi0/1 (trunk)\nS1 Fa0/10 — ESXi vmnic0 (vSwitch0, моделюється комутатором): VM-Web (VLAN 10), VM-DB (VLAN 20)\nPC1 (VLAN 30) — S1 Fa0/1",
  task:["На сервері ESXi працюють дві віртуальні машини. vSwitch0 гіпервізора тегує трафік груп портів (VST — Virtual Switch Tagging): VM-Web — VLAN 10, VM-DB — VLAN 20, аплінк vmnic0 — 802.1Q trunk.",
   "Фізичний порт S1 Fa0/10 до сервера досі access у VLAN 1, тож VM недоступні: PC1 → ping 192.168.10.10.",
   "Створіть на S1 VLAN 10 (WEB) і 20 (DB). Налаштуйте Fa0/10 як trunk з дозволеними лише VLAN 10 і 20 (принцип мінімальних привілеїв).",
   "Перевірка: PC1 → ping 192.168.10.10 і curl 192.168.10.10; PC1 → ping 192.168.20.20."],
  def:()=>({devices:{S1:{type:"switch",vlans:{30:"USERS"},setup:s=>{ ACC(s,{"Fa0/1":30}); s.ifs["Gi0/1"].mode="trunk"; }},
    ESXi:{type:"switch",vlans:{10:"WEB",20:"DB"},setup:s=>{ s.hostname="ESXi"; Object.assign(s.ifs["Gi0/1"],{mode:"trunk",allowed:[10,20]}); ACC(s,{"Fa0/1":10,"Fa0/2":20}); }},
    R1:{type:"router",setup:s=>{ SUB(s,"Gi0/0",10,"192.168.10.1",M24); SUB(s,"Gi0/0",20,"192.168.20.1",M24); SUB(s,"Gi0/0",30,"192.168.30.1",M24); }},
    "VM-Web":{type:"server",ip:"192.168.10.10",mask:M24,gw:"192.168.10.1",services:[80,443]},"VM-DB":{type:"server",ip:"192.168.20.20",mask:M24,gw:"192.168.20.1",services:[3306]},
    PC1:{type:"pc",ip:"192.168.30.11",mask:M24,gw:"192.168.30.1"}},
    links:[["R1","Gi0/0","S1","Gi0/1"],["S1","Fa0/10","ESXi","Gi0/1"],["VM-Web","Fa0","ESXi","Fa0/1"],["VM-DB","Fa0","ESXi","Fa0/2"],["PC1","Fa0","S1","Fa0/1"]]}),
  check:N=>{ const s=N.dev.S1, i=s.ifs["Fa0/10"]; return [[!!s.vlans[10]&&!!s.vlans[20],"VLAN 10 і 20 створено на S1"],[i.mode==="trunk"&&JSON.stringify(i.allowed)==="[10,20]","Fa0/10 — trunk лише з VLAN 10, 20"],
      [pass(N,"PC1","192.168.10.10")&&N.flow("PC1","192.168.10.10","tcp",80).ok,"PC1 → VM-Web (ping і HTTP)"],[pass(N,"PC1","192.168.20.20"),"PC1 → VM-DB"]]; },
  sol:"S1:\nenable\nconf t\nvlan 10\n name WEB\nvlan 20\n name DB\nexit\ninterface fa0/10\n switchport mode trunk\n switchport trunk allowed vlan 10,20\nend"},
];
function startNet(sc){ const N=Net(sc.def()); const ses={}; for(const [k,d] of Object.entries(N.dev)) if(d.type!=="hub") ses[k]= (d.type==="pc"||d.type==="server")? PCSession(d,N) : Session(d); return {N,ses}; }

// ---------- Розв'язання сценарію і режим «Troubleshooting» ----------
function solveNet(sc){ const {N,ses}=startNet(sc); let cur=null;
  for(const raw of sc.sol.split("\n")){ const line=raw.trim().replace(/\{\{MAC:(\w+)\}\}/g,(_,x)=>N.hostMac(x)); if(!line||line.startsWith("(")) continue; const m=line.match(/^([\w-]+):$/); if(m&&ses[m[1]]){ cur=m[1]; continue; } if(!cur) continue;
    const r=ses[cur].exec(line); if(/Reset ALL/.test(ses[cur].prompt())) ses[cur].exec("yes"); N.recompute(); }
  return N; }
const pick=a=>a[Math.floor(Math.random()*a.length)];
function faultsFor(N){
  const F=[]; const isH=d=>d.type==="pc"||d.type==="server"||d.type==="hub";
  const devs=Object.values(N.dev).filter(d=>!isH(d));
  for(const l of N.links) for(const [dn,pn,on] of [[l.a,l.pa,l.b],[l.b,l.pb,l.a]]){ const d=N.dev[dn]; if(isH(d)) continue; const i=d.ifs[pn]; if(!i||i.shutdown) continue;
    F.push({d:dn+": інтерфейс "+longIf(pn)+" (до "+on+") адміністративно вимкнено — потрібен no shutdown",f:()=>{ i.shutdown=true; }});
    if(d.type==="switch"&&i.switchport&&!operTrunk(i)&&isH(N.dev[on])){ const others=Object.keys(d.vlans).map(Number).filter(v=>v!==i.accessVlan&&v<1002); const nv=others.length?pick(others):99;
      F.push({d:dn+": порт "+longIf(pn)+" (до "+on+") переведено у VLAN "+nv+" замість VLAN "+i.accessVlan,f:()=>{ i.accessVlan=nv; if(!d.vlans[nv]) d.vlans[nv]={name:"VLAN"+String(nv).padStart(4,"0")}; }}); }
    if(d.type==="switch"&&i.switchport&&operTrunk(i)){
      const used=[...new Set(Object.values(d.ifs).filter(p=>p.switchport&&!operTrunk(p)&&p.connected).map(p=>p.accessVlan))].filter(v=>v!==1&&(!i.allowed||i.allowed.includes(v)));
      if(used.length){ const v=pick(used); F.push({d:dn+": з trunk "+longIf(pn)+" прибрано VLAN "+v+" (switchport trunk allowed vlan)",f:()=>{ const base=i.allowed||Array.from({length:4094},(_,k)=>k+1); i.allowed=base.filter(x=>x!==v); }}); }
      if(N.dev[on].type==="switch") F.push({d:dn+": на "+longIf(pn)+" змінено native VLAN на "+(i.nativeVlan===1?77:1)+" — невідповідність з "+on,f:()=>{ i.nativeVlan=i.nativeVlan===1?77:1; if(!d.vlans[i.nativeVlan]) d.vlans[i.nativeVlan]={name:"VLAN0077"}; }});
      F.push({d:dn+": порт "+longIf(pn)+" переведено в switchport mode access — trunk зник",f:()=>{ i.mode="access"; }}); }
  }
  for(const d of devs){ const dn=d.devName;
    for(const i of Object.values(d.ifs)){
      if(i.sub&&i.encap) F.push({d:dn+": на "+longIf(i.name)+" encapsulation dot1Q "+(i.encap+1)+" замість "+i.encap,f:()=>{ i.encap=i.encap+1; }});
      if(i.ip&&!i.loop&&!i.svi&&ifStatus(d,i)[1]==="up"){ const o=i.ip.split(".").map(Number); const ni=o.slice(0,3).concat([o[3]===254?253:o[3]+3]).join("."); F.push({d:dn+": на "+longIf(i.name)+" змінено IP-адресу з "+i.ip+" на "+ni,f:()=>{ i.ip=ni; }}); }
      if(i.aclIn||i.aclOut) F.push({d:dn+": ACL на "+longIf(i.name)+" застосовано в протилежному напрямку ("+(i.aclIn?"in → out":"out → in")+")",f:()=>{ const a=i.aclIn, b=i.aclOut; i.aclIn=b; i.aclOut=a; }});
      if(i.natIn||i.natOut) F.push({d:dn+": на "+longIf(i.name)+" прибрано ip nat "+(i.natIn?"inside":"outside"),f:()=>{ i.natIn=false; i.natOut=false; }});
      for(const [g,h] of Object.entries(i.hsrp||{})) if(h.ip){ F.push({d:dn+": на "+longIf(i.name)+" віртуальну IP HSRP групи "+g+" змінено з "+h.ip,f:()=>{ const o=h.ip.split(".").map(Number); h.ip=o.slice(0,3).concat([o[3]===254?253:254]).join("."); }}); }
      if(i.ospfCost) F.push({d:dn+": прибрано ip ospf cost "+i.ospfCost+" з "+longIf(i.name),f:()=>{ i.ospfCost=null; }});
      if(i.helper&&i.helper.length) F.push({d:dn+": з "+longIf(i.name)+" прибрано ip helper-address "+i.helper[0],f:()=>{ i.helper=[]; }});
    }
    for(const r of d.routes) F.push({d:dn+": статичний маршрут "+r.net+"/"+maskLen(r.mask)+" має хибний next-hop",f:()=>{ if(r.nh){ const o=r.nh.split(".").map(Number); r.nh=o.slice(0,3).concat([o[3]===1?2:1]).join("."); } else d.routes=d.routes.filter(x=>x!==r); }});
    for(const r of d.routes) F.push({d:dn+": видалено статичний маршрут "+r.net+"/"+maskLen(r.mask),f:()=>{ d.routes=d.routes.filter(x=>x!==r); }});
    if(d.ospf){ for(const n of d.ospf.nets){ F.push({d:dn+": network "+n.net+" "+n.wild+" перенесено в area 1 (невідповідність областей)",f:()=>{ n.area=1; }}); F.push({d:dn+": видалено network "+n.net+" "+n.wild+" area "+n.area,f:()=>{ d.ospf.nets=d.ospf.nets.filter(x=>x!==n); }}); }
      for(const nb of N.ospfNeighbors(dn)){ const i=d.ifs[nb.myIf]; F.push({d:dn+": інтерфейс "+longIf(nb.myIf)+" зроблено passive-interface — сусідство з "+nb.dev+" зникло",f:()=>{ if(!d.ospf.passive.includes(nb.myIf)) d.ospf.passive.push(nb.myIf); }});
        F.push({d:dn+": на "+longIf(nb.myIf)+" ip ospf hello-interval 5 (у сусіда 10)",f:()=>{ i.hello=5; i.dead=20; }}); }
      if(d.ospf.defOrig) F.push({d:dn+": прибрано default-information originate",f:()=>{ d.ospf.defOrig=false; }}); }
    for(const [n,acl] of Object.entries(d.acls)){ const pr=acl.rules.filter(r=>!r.remark&&r.act==="permit"); if(pr.length){ const r=pr[pr.length-1]; F.push({d:dn+": з ACL "+n+" видалено рядок «"+aceText(acl,r,true)+"» — спрацьовує неявний deny",f:()=>{ acl.rules=acl.rules.filter(x=>x!==r); }}); } }
    for(const x of d.nat.statics) F.push({d:dn+": статичний NAT "+x.local+" тепер вказує на хибну глобальну адресу",f:()=>{ const o=x.global.split(".").map(Number); x.global=o.slice(0,3).concat([o[3]+1]).join("."); }});
    for(const r of d.nat.dyn) F.push({d:dn+": у правилі NAT для list "+r.acl+" прибрано overload / змінено ACL",f:()=>{ r.acl=r.acl+"9"; }});
    for(const p of Object.values(d.dhcp.pools)) if(p.gw) F.push({d:dn+": у пулі DHCP "+p.name+" хибний default-router",f:()=>{ const o=p.gw.split(".").map(Number); p.gw=o.slice(0,3).concat([254]).join("."); }});
    if(d.type==="switch") for(const v of Object.keys(d.vlans).map(Number).filter(v=>v>1&&v<1002&&Object.values(d.ifs).some(p=>p.accessVlan===v&&p.connected))) F.push({d:dn+": видалено VLAN "+v+" (порти в ній неактивні)",f:()=>{ delete d.vlans[v]; }});
    if(d.type==="switch"&&Object.keys(d.stpPrio).length) F.push({d:dn+": пріоритет STP повернуто до 32768",f:()=>{ d.stpPrio={}; }});
    if(d.type==="switch"){ const seenG=new Set();
      for(const i of Object.values(d.ifs)){
        if(i.chGroup&&i._ec==="P"&&!seenG.has(i.chGroup)){ seenG.add(i.chGroup); const g=i.chGroup; const mem=Object.values(d.ifs).filter(x=>x.chGroup===g); const nm={active:"desirable",passive:"auto",desirable:"active",auto:"passive",on:"active"}[i.chMode];
          F.push({d:dn+": у channel-group "+g+" режим "+i.chMode+" замінено на "+nm+" — протокол не збігається з сусідом",f:()=>{ mem.forEach(x=>x.chMode=nm); }});
          if(mem.length>1) F.push({d:dn+": на "+longIf(mem[1].name)+" (член Po"+g+") змінено список дозволених VLAN — порт suspended",f:()=>{ mem[1].allowed=[1]; }}); }
        if(i.ps&&i.ps.on&&i.connected){ F.push({d:dn+": на "+longIf(i.name)+" port-security дозволяє лише чужий статичний MAC 0000.dead.beef — порт у err-disabled",f:()=>{ i.ps.static=["0000.dead.beef"]; i.ps.stickyMacs=[]; i.ps.sticky=false; i.ps.max=1; i.ps.viol="shutdown"; }}); }
        if(i.dhcpTrust) F.push({d:dn+": з "+longIf(i.name)+" прибрано ip dhcp snooping trust — DHCPOFFER від сервера відкидаються",f:()=>{ i.dhcpTrust=false; }});
        if(i.daiTrust) F.push({d:dn+": з "+longIf(i.name)+" прибрано ip arp inspection trust — ARP від шлюзу відкидаються",f:()=>{ i.daiTrust=false; }});
        if(i.stpCost) F.push({d:dn+": прибрано spanning-tree cost "+i.stpCost+" з "+longIf(i.name),f:()=>{ i.stpCost=null; }});
        if(isPhys(i.name)&&i.connected&&!i.shutdown&&operTrunk(i)){ const pr=N.peer(dn,i.name); if(pr&&N.dev[pr.dev].type==="switch") F.push({d:dn+": на trunk "+longIf(i.name)+" (до "+pr.dev+") увімкнено spanning-tree bpduguard — порт пішов у err-disabled",f:()=>{ i.bpduguard=true; }}); }
      }
      if(d.snoop&&d.snoop.on&&d.snoop.opt82===false) F.push({d:dn+": повернуто ip dhcp snooping information option — DHCP-сервер відкидає запити з опцією 82",f:()=>{ d.snoop.opt82=true; }});
    }
  }
  return F;
}
function troubleshoot(sc,n){
  n=n||1; const fx=faultsFor(solveNet(sc)); const cat=d=>{ if(/вимкнено/.test(d)) return "shut"; if(/IP-адресу/.test(d)) return "ip"; return d.replace(/^[^:]+: /,"").replace(/[\d.\/]+/g,"").split(/\s+/).slice(0,3).join(" "); };
  const groups={}; fx.forEach((f,k)=>{ (groups[cat(f.d)]=groups[cat(f.d)]||[]).push(k); }); const gl=Object.values(groups).map(g=>g.sort(()=>Math.random()-0.5)).sort(()=>Math.random()-0.5);
  const order=[]; for(let r=0;order.length<fx.length;r++) for(const g of gl) if(g[r]!==undefined) order.push(g[r]);
  for(let t=0;t<Math.min(order.length,40);t++){
    const N=solveNet(sc); if(!sc.check(N).every(x=>x[0])) return null;
    const F=faultsFor(N); const picks=[]; const idx=order.slice(t,t+n).map(k=>Math.min(k,F.length-1)); for(const k of idx){ if(F[k]&&!picks.includes(F[k])) picks.push(F[k]); }
    if(!picks.length) continue; for(const p of picks) p.f(); N.recompute();
    for(const d of Object.values(N.dev)) if(d.type==="pc"&&d.dhcp){ N.release(d.name); N.dhcp(d.name); }
    if(sc.check(N).every(x=>x[0])) continue;
    const ses={}; for(const [k,d] of Object.entries(N.dev)) if(d.type!=="hub") ses[k]= (d.type==="pc"||d.type==="server")? PCSession(d,N) : Session(d);
    return {N,ses,faults:picks.map(p=>p.d)};
  }
  return null; }


// ---------- Схема мережі для показу та пісочниці ----------
function figOf(N,hl,hlLink){
  hl=hl||[]; const names=Object.keys(N.dev); if(!names.length) return null; const isH=d=>d.type==="pc"||d.type==="server";
  const adj={}; names.forEach(n=>adj[n]=[]); for(const l of N.links){ adj[l.a].push(l.b); adj[l.b].push(l.a); }
  const infra=names.filter(n=>!isH(N.dev[n])); const root=(infra.length?infra:names).slice().sort((a,b)=>adj[b].length-adj[a].length)[0];
  const layer={}; const order=[root]; layer[root]=0; for(let i=0;i<order.length;i++){ for(const m of adj[order[i]]) if(layer[m]===undefined){ layer[m]=layer[order[i]]+1; order.push(m); } }
  let extra=Math.max(0,...Object.values(layer))+1; for(const n of names) if(layer[n]===undefined) layer[n]=extra;
  // корінь у центрі: розкладаємо шари вліво/вправо почергово від кореня
  const side={}; side[root]=0; const firstKids=adj[root].slice(); firstKids.forEach((k,i)=>side[k]=i%2?-1:1); for(const n of order) if(side[n]===undefined){ const p=adj[n].find(m=>layer[m]===layer[n]-1); side[n]=p!==undefined&&side[p]!==undefined&&side[p]!==0?side[p]:1; }
  for(const n of names) if(side[n]===undefined) side[n]=1;
  const col={}; for(const n of names) col[n]=side[n]*layer[n]; const cols=[...new Set(Object.values(col))].sort((a,b)=>a-b);
  const byCol={}; for(const n of order.concat(names.filter(n=>!order.includes(n)))) (byCol[col[n]]=byCol[col[n]]||[]).includes(n)||(byCol[col[n]]=byCol[col[n]]||[]).push(n);
  const maxRows=Math.max(...Object.values(byCol).map(a=>a.length)); const h=Math.max(30,maxRows*17);
  const nodes=[]; cols.forEach((c,ci)=>{ const list=byCol[c]; list.forEach((n,ri)=>{ const d=N.dev[n]; nodes.push({id:n,t:d.type==="router"?"r":d.type==="switch"?"sw":d.type==="server"?"srv":d.type==="hub"?"hub":"pc",x:cols.length===1?50:4+ci*(92/(cols.length-1)),y:list.length===1?h/2-6:2+ri*((h-14)/(list.length-1)),sub:isH(d)?(d.ip||(d.dhcp?"DHCP":"")):(d.ipRouting&&d.type==="switch"?"L3":""),hl:hl.includes(n)}); }); });
  const pairN={}, pairK={}; const pk=l=>[l.a,l.b].sort().join("|"); for(const l of N.links) pairN[pk(l)]=(pairN[pk(l)]||0)+1;
  const links=N.links.map(l=>{ const on=hlLink&&((hlLink[0]===l.a&&hlLink[1]===l.b)||(hlLink[0]===l.b&&hlLink[1]===l.a)); const k=pk(l); const idx=pairK[k]=(pairK[k]===undefined?0:pairK[k]+1);
    const ia=(N.dev[l.a].ifs||{})[l.pa], ib=(N.dev[l.b].ifs||{})[l.pb]; const ec=ia&&ib&&ia._ec==="P"&&ib._ec==="P"; const blk=(ia&&(ia.errdis||ia._ec==="s"))||(ib&&(ib.errdis||ib._ec==="s"));
    return {a:l.a,b:l.b,la:isH(N.dev[l.a])||N.dev[l.a].type==="hub"?"":l.pa,lb:isH(N.dev[l.b])||N.dev[l.b].type==="hub"?"":l.pb,c:on?"--warn":blk?"--bad":ec?"--accent":null,w:on?5:ec?3:2,dash:!!blk,li:idx,off:(idx-(pairN[k]-1)/2)*11,m:ec&&idx===0?"Po"+ia.chGroup:undefined,mdy:pairN[k]>1?-((pairN[k]-1)*4.5+6):12}; });
  return {h,nodes,links};
}
const dumpState=st=>JSON.parse(JSON.stringify(st,(k,v)=>(k==="net"||k==="_oper")?undefined:v));
function netFromSaved(sb){ const devices={};
  for(const [n,d] of Object.entries(sb.devs||{})){ if(d.type==="pc"||d.type==="server") devices[n]={type:d.type,ip:d.ip,mask:d.mask,gw:d.gw,dhcp:d.dhcp,services:d.services,ip6:d.ip6,slaac:d.slaac};
    else devices[n]={type:d.type==="l3"?"switch":d.type,l3:d.type==="l3",setup:d.state?(s=>{ Object.assign(s,JSON.parse(JSON.stringify(d.state))); for(const i of Object.values(s.ifs)) i.connected=false; }):null}; }
  const N=Net({devices,links:(sb.links||[]).filter(l=>devices[l[0]]&&devices[l[2]])});
  for(const [n,d] of Object.entries(sb.devs||{})) if(d.type==="l3"&&N.dev[n]) N.dev[n].type="switch";
  return N; }
function saveNet(N,types){ const devs={}; for(const [n,d] of Object.entries(N.dev)){ if(d.type==="pc"||d.type==="server") devs[n]={type:d.type,ip:d.ip,mask:d.mask,gw:d.gw,dhcp:!!d.dhcp,services:d.services,ip6:d.ip6||null,slaac:!!d.slaac}; else devs[n]={type:(types&&types[n])||d.type,state:dumpState(d)}; }
  return {devs,links:N.links.map(l=>[l.a,l.pa,l.b,l.pb])}; }
function sessionsFor(N){ const ses={}; for(const [k,d] of Object.entries(N.dev)) if(d.type!=="hub") ses[k]=(d.type==="pc"||d.type==="server")? PCSession(d,N) : Session(d); return ses; }
function freePorts(N,dev){ const d=N.dev[dev]; if(!d) return []; const used=new Set(N.links.filter(l=>l.a===dev||l.b===dev).map(l=>l.a===dev?l.pa:l.pb));
  if(d.type==="pc"||d.type==="server") return used.has("Fa0")?[]:["Fa0"]; return Object.keys(d.ifs).filter(p=>isPhys(p)&&!used.has(p)); }

window.CLI={figOf,netFromSaved,saveNet,sessionsFor,freePorts,Net,SCEN,NETSCEN,startNet,solveNet,troubleshoot,startScenario,Session,newState,normIf,parseList};
})();
