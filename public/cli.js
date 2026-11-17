// Мінісимулятор Cisco IOS (Catalyst 2960 / L3-комутатор) для навчальних сценаріїв.
(function(){
"use strict";
const IFTYPES=[["fastethernet","Fa","FastEthernet"],["gigabitethernet","Gi","GigabitEthernet"],["port-channel","Po","Port-channel"],["vlan","Vlan","Vlan"],["loopback","Lo","Loopback"]];
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
add("exec","copy running-config startup-config",(s)=>{s.saved=JSON.parse(JSON.stringify(Object.assign({},s,{saved:false}))); return "Destination filename [startup-config]? \nBuilding configuration...\n[OK]";});
add("exec","write memory",(s)=>{s.saved=JSON.parse(JSON.stringify(Object.assign({},s,{saved:false}))); return "Building configuration...\n[OK]";});
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
add("line","exec-timeout <n> <n>",()=>{});
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
add("if","shutdown",F(i=>{i.shutdown=true;}));
add("if","no shutdown",F(i=>{i.shutdown=false;}));
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
  if(i.natIn) L.push(" ip nat inside"); if(i.natOut) L.push(" ip nat outside"); if(i.ospfPid) L.push(" ip ospf "+i.ospfPid+" area "+i.ospfArea); if(i.ospfCost) L.push(" ip ospf cost "+i.ospfCost); if(i.ospfPrio!==1) L.push(" ip ospf priority "+i.ospfPrio);
  if(i.hello!==10) L.push(" ip ospf hello-interval "+i.hello); if(i.deadSet) L.push(" ip ospf dead-interval "+i.dead); if(i.ospfP2p) L.push(" ip ospf network point-to-point"); if(i.bw) L.push(" bandwidth "+i.bw); return L; }

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
  if(i.shutdown) return ["administratively down","down"];
  if(i.loop) return ["up","up"];
  if(i.svi){ const v=Number(i.name.slice(4)); const has=s.vlans[v] && Object.values(s.ifs).some(p=>isPhys(p.name)&&!p.shutdown&&p.switchport&&(operTrunk(p)?(!p.allowed||p.allowed.includes(v)):p.accessVlan===v)&&p.connected); return has?["up","up"]:["up","down"]; }
  if(i.name.startsWith("Po")){ const m=Object.values(s.ifs).filter(p=>p.chGroup===Number(i.name.slice(2))&&!p.shutdown); return m.length?["up","up"]:["down","down"]; }
  return i.connected?["up","up"]:["down","down"]; }
function showIpBrief(s){
  let o="Interface              IP-Address      OK? Method Status                Protocol\n";
  const list=Object.values(s.ifs).sort((a,b)=>(a.svi-b.svi)||a.name.localeCompare(b.name,undefined,{numeric:true}));
  for(const i of list){ const [st,pr]=ifStatus(s,i); o+=longIf(i.name).padEnd(23)+(i.ip||"unassigned").padEnd(16)+"YES "+(i.ip?"manual":"unset ").padEnd(7)+st.padEnd(22)+pr+"\n"; }
  return o;
}
function showStatus(s){ let o="Port      Name               Status       Vlan       Duplex  Speed Type\n";
  for(const i of Object.values(s.ifs).filter(x=>isPhys(x.name))){ const st=i.shutdown?"disabled":i.connected?"connected":"notconnect"; o+=i.name.padEnd(10)+(i.desc||"").slice(0,18).padEnd(19)+st.padEnd(13)+(operTrunk(i)?"trunk":!i.switchport?"routed":String(i.accessVlan)).padEnd(11)+"auto".padEnd(8)+"auto  "+(i.name.startsWith("Gi")?"10/100/1000BaseTX":"10/100BaseTX")+"\n"; } return o; }
function showIface(s,n){ const i=s.ifs[n]; if(!i) return INV; const [st,pr]=ifStatus(s,i); return longIf(n)+" is "+st+", line protocol is "+pr+(i.connected&&!i.shutdown?" (connected)":"")+"\n  Hardware is "+(i.svi?"EtherSVI":"Fast Ethernet")+", address is "+s.mac+"\n"+(i.ip?"  Internet address is "+i.ip+"/"+maskLen(i.mask)+"\n":"")+"  MTU 1500 bytes, BW "+(n.startsWith("Gi")?"1000000":n.startsWith("Po")?String(1000000*Object.values(s.ifs).filter(p=>p.chGroup===Number(n.slice(2))).length):"100000")+" Kbit/sec\n  ..."; }
function showEc(s){
  const groups={}; for(const i of Object.values(s.ifs)) if(i.chGroup){ (groups[i.chGroup]=groups[i.chGroup]||[]).push(i); }
  let o="Flags:  D - down        P - bundled in port-channel\n        I - stand-alone s - suspended\n        S - Layer2      R - Layer3\n        U - in use      N - not in use, no aggregation\n\nNumber of channel-groups in use: "+Object.keys(groups).length+"\nNumber of aggregators:           "+Object.keys(groups).length+"\n\nGroup  Port-channel  Protocol    Ports\n------+-------------+-----------+-----------------------------------------------\n";
  for(const [g,m] of Object.entries(groups)){
    const po=s.ifs["Po"+g]; const proto=m[0].chMode==="on"?"-":["active","passive"].includes(m[0].chMode)?"LACP":"PAgP";
    const ref=m[0]; const flag=p=>{ if(p.shutdown||!p.connected) return "D"; const same=p.mode===ref.mode&&p.accessVlan===ref.accessVlan&&p.nativeVlan===ref.nativeVlan&&JSON.stringify(p.allowed)===JSON.stringify(ref.allowed)&&p.chMode===ref.chMode; return same?"P":"s"; };
    const fl=m.map(flag); const up=fl.includes("P");
    o+=String(g).padEnd(7)+("Po"+g+"("+(po&&!po.switchport?"R":"S")+(up?"U":"D")+")").padEnd(14)+proto.padEnd(12)+m.map((p,k)=>p.name+"("+fl[k]+")").join(" ")+"\n";
  }
  return o;
}
function prioOf(s,v){ return (s.stpPrio[v]!==undefined?s.stpPrio[v]:32768)+v; }
function showStp(s,vl){
  const vs=vl?[vl]:Object.keys(s.vlans).map(Number).sort((a,b)=>a-b); let o="";
  for(const v of vs){ if(!s.vlans[v]){ o+="Spanning tree instance(s) for vlan "+v+" does not exist.\n"; continue; }
    const me=prioOf(s,v);
    if(s.net){ const info=(s.net.stp(v)||{})[s.devName]; if(info){ const iAm=info.rootName===s.devName;
      o+="\nVLAN"+String(v).padStart(4,"0")+"\n  Spanning tree enabled protocol "+(s.stpMode==="rapid-pvst"?"rstp":"ieee")+"\n  Root ID    Priority    "+info.root.p+"\n             Address     "+info.root.mac+"\n"+(iAm?"             This bridge is the root\n":"             Cost        "+info.cost+"\n             Port        "+(info.rootPort?longIf(info.rootPort):"-")+"\n")+"             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n\n  Bridge ID  Priority    "+me+"  (priority "+(me-v)+" sys-id-ext "+v+")\n             Address     "+s.mac+"\n\nInterface           Role Sts Cost      Prio.Nbr Type\n------------------- ---- --- --------- -------- --------------------------------\n";
      for(const i of Object.values(s.ifs).filter(p=>isPhys(p.name)&&!p.shutdown&&p.connected&&p.switchport&&(operTrunk(p)?(!p.allowed||p.allowed.includes(v)):p.accessVlan===v))){
        const rs=info.roles[i.name]||["Desg","FWD"]; o+=i.name.padEnd(20)+rs[0]+" "+rs[1]+" "+(i.name.startsWith("Gi")?"4":"19").padEnd(10)+"128."+(i.name.startsWith("Gi")?24+Number(i.name.split("/")[1]):Number(i.name.split("/")[1])).toString().padEnd(5)+"P2p"+((i.portfast||(s.portfastDefault&&!operTrunk(i)))?" Edge":"")+"\n"; }
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
  }
  if(i.chGroup) L.push(" channel-group "+i.chGroup+" mode "+i.chMode);
  if(i.speed!=="auto") L.push(" speed "+i.speed); if(i.duplex!=="auto") L.push(" duplex "+i.duplex);
  if(i.portfast) L.push(" spanning-tree portfast"); if(i.bpduguard) L.push(" spanning-tree bpduguard enable");
  if(i.shutdown) L.push(" shutdown"); return L;
}
function showRunIf(s,n){ const i=s.ifs[n]; if(!i) return INV; return "Building configuration...\n\nCurrent configuration : 120 bytes\n!\n"+runIf(s,i).join("\n")+"\nend"; }
function showRun(s){
  const L=["Building configuration...","","Current configuration : 2048 bytes","!","version 15.0","no service pad",(s.servicePwEnc?"":"no ")+"service password-encryption","!","hostname "+s.hostname,"!"];
  if(s.enableSecret) L.push("enable secret 5 $1$mERr$hx5rVt7rPNoS4wqbXKX7m0","!");
  for(const [u,v] of Object.entries(s.users)) L.push("username "+u+(v.priv?" privilege "+v.priv:"")+(v.secret?" secret 5 $1$p1Kd$Vq9rPNoS4wqbXKX7m0":" password 0 ******"));
  if(Object.keys(s.users).length) L.push("!");
  if(s.noDomainLookup) L.push("no ip domain-lookup"); if(s.domain) L.push("ip domain-name "+s.domain); if(s.ipRouting) L.push("ip routing"); if(s.sshVer) L.push("ip ssh version "+s.sshVer);
  for(const [a,b] of s.dhcp.excl) L.push("ip dhcp excluded-address "+a+(b!==a?" "+b:""));
  for(const p of Object.values(s.dhcp.pools)){ L.push("!","ip dhcp pool "+p.name); if(p.net) L.push(" network "+p.net+" "+p.mask); if(p.gw) L.push(" default-router "+p.gw); if(p.dns) L.push(" dns-server "+p.dns); if(p.domain) L.push(" domain-name "+p.domain); }
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
  if(s.defaultGw) L.push("ip default-gateway "+s.defaultGw,"!");
  for(const r of s.routes) L.push("ip route "+r.net+" "+r.mask+(r.ifc?" "+longIf(r.ifc):"")+(r.nh?" "+r.nh:"")+(r.ad&&r.ad!==1?" "+r.ad:""));
  if(s.routes.length) L.push("!");
  for(const [n,acl] of Object.entries(s.acls)){ if(acl.named){ L.push("ip access-list "+(acl.type==="std"?"standard":"extended")+" "+n); for(const r of acl.rules) L.push(" "+aceText(acl,r,true)); } else for(const r of acl.rules) L.push("access-list "+n+" "+aceText(acl,r,true)); L.push("!"); }
  L.push("line con 0"); if(s.con.password) L.push(" password "+s.con.password); if(s.con.login) L.push(s.con.login==="local"?" login local":" login");
  L.push("line vty 0 15"); if(s.vty.password) L.push(" password "+s.vty.password); if(s.vty.login) L.push(s.vty.login==="local"?" login local":" login"); if(s.vty.acl) L.push(" access-class "+s.vty.acl+" in"); if(s.vty.transport!=="all") L.push(" transport input "+s.vty.transport);
  L.push("!","end"); return L.join("\n");
}

// ---------- Сесія терміналу ----------
function promptOf(ctx,s){ const h=s.hostname; return {user:h+">",exec:h+"#",config:h+"(config)#",if:h+(ctx.ifs&&ctx.ifs.length>1?"(config-if-range)#":"(config-if)#"),vlan:h+"(config-vlan)#",line:h+"(config-line)#",router:h+"(config-router)#",acl:h+(ctx.aclType==="ext"?"(config-ext-nacl)#":"(config-std-nacl)#"),dhcp:h+"(dhcp-config)#"}[ctx.mode]; }
function Session(state){
  const ctx={mode:"user",ifs:null,vlan:null,line:null,history:[],prompt:null};
  ctx.runIn=(mode,line)=>{ const r=matchMode(mode,line); if(r.err) return r.err; if(r.empty) return ""; const save=ctx.mode; const out=r.hit.c.fn(state,r.hit.args,ctx); ctx.mode=save; return out||""; };
  return {
    state, ctx,
    prompt(){ return ctx.prompt? ctx.prompt.text : promptOf(ctx,state); },
    exec(line){
      if(ctx.prompt){ const p=ctx.prompt; ctx.prompt=null; return p.fn(line.trim())||""; }
      if(!line.trim()) return "";
      ctx.history.push(line.trim());
      if(/\?\s*$/.test(line)){ return help(ctx.mode,line); }
      ctxPromptLen=promptOf(ctx,state).length;
      let r=matchMode(ctx.mode,line);
      // глобальні команди доступні з підрежимів (як в IOS)
      if(r.err && ["if","vlan","line","router","acl","dhcp"].includes(ctx.mode)){ const r2=matchMode("config",line); if(r2.hit){ if(r2.hit.c.p[0]!=="do") ctx.mode="config"; r=r2; } }
      if(r.err && ctx.mode==="exec" && /^\s*conf/i.test(line)===false){ /* лишаємо помилку */ }
      if(r.empty) return ""; if(r.err) return r.err;
      const out=r.hit.c.fn(state,r.hit.args,ctx);
      return out||"";
    }
  };
}

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
    if(d.type==="pc"||d.type==="server") N.dev[name]={name,type:d.type,ip:d.ip||null,mask:d.mask||null,gw:d.gw||null,port:"Fa0",dhcp:!!d.dhcp,services:d.services||(d.type==="server"?[80]:[])};
    else { const st=newState({hostname:name,router:d.type==="router",l3:d.l3||d.type==="router",vlans:d.vlans,setup:d.setup}); st.net=N; st.devName=name; st.type=d.type; if(d.mac) st.mac=d.mac; N.dev[name]=st; }
  }
  for(const [a,pa,b,pb] of def.links){ N.links.push({a,pa,b,pb}); for(const [d,p] of [[a,pa],[b,pb]]){ const x=N.dev[d]; if(!isHost(x)&&x.ifs[p]) x.ifs[p].connected=true; } }
  N.peer=(dev,port)=>{ for(const l of N.links){ if(l.a===dev&&l.pa===port) return {dev:l.b,port:l.pb}; if(l.b===dev&&l.pb===port) return {dev:l.a,port:l.pa}; } return null; };
  const isSw=d=>d&&d.type==="switch";
  const eff=(sw,p)=>{ const i=sw.ifs[p]; if(i&&i.chGroup&&sw.ifs["Po"+i.chGroup]) return Object.assign({},sw.ifs["Po"+i.chGroup],{shutdown:i.shutdown,connected:i.connected,name:p,_oper:i._oper}); return i; };
  // ---------- DTP: операційний режим портів ----------
  N.recompute=()=>{
    for(const d of Object.values(N.dev)) if(!isHost(d)) for(const i of Object.values(d.ifs)) delete i._oper;
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
    // CDP: невідповідність native VLAN
    const msgs=[];
    for(const l of N.links){ const A=N.dev[l.a], B=N.dev[l.b]; if(!isSw(A)||!isSw(B)) continue; const ia=eff(A,l.pa), ib=eff(B,l.pb);
      if(ia&&ib&&!ia.shutdown&&!ib.shutdown&&operTrunk(ia)&&operTrunk(ib)&&ia.nativeVlan!==ib.nativeVlan){
        msgs.push([l.a,"%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on "+longIf(l.pa)+" ("+ia.nativeVlan+"), with "+l.b+" "+longIf(l.pb)+" ("+ib.nativeVlan+")."]);
        msgs.push([l.b,"%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on "+longIf(l.pb)+" ("+ib.nativeVlan+"), with "+l.a+" "+longIf(l.pa)+" ("+ia.nativeVlan+")."]); } }
    const out=[]; for(const m of msgs){ const k=m.join("|"); if(!N.seenMsgs.has(k)){ N.seenMsgs.add(k); out.push(m); } }
    N.seenMsgs=new Set([...N.seenMsgs].filter(k=>msgs.some(m=>m.join("|")===k)));
    return out;
  };
  // ---------- 2-й рівень: які кінцеві точки досяжні ----------
  const carries=(sw,i,v)=>{ if(!i||i.shutdown||!i.connected||!i.switchport) return null; if(!sw.vlans[v]) return null;
    if(operTrunk(i)){ const al=!i.allowed||i.allowed.includes(v); return al? {tag: v===i.nativeVlan?null:v} : null; }
    return i.accessVlan===v? {tag:null} : null; };
  function domain(start){ // start: {sw,v} | {dev,port,tag}
    const res=[], seen=new Set(), q=[];
    const enter=(devName,port,tag)=>{
      const d=N.dev[devName]; if(!d) return;
      if(isHost(d)){ if(tag===null&&d.ip) res.push({dev:devName,ip:d.ip,mask:d.mask,kind:"pc"}); return; }
      if(d.type==="router"||(d.ifs[port]&&!d.ifs[port].switchport)){
        const ph=d.ifs[port]; if(!ph||ph.shutdown) return;
        if(tag===null && ph.ip) res.push({dev:devName,ip:ph.ip,mask:ph.mask,ifn:port,kind:"l3"});
        if(tag===null && ph.ip && ph.natOut){ const g=new Set(d.nat.statics.map(x=>x.global)); for(const pl of Object.values(d.nat.pools)) for(let n=ipToN(pl.start);n<=ipToN(pl.end)&&n-ipToN(pl.start)<64;n++) g.add(n2ip(n)); for(const ip of g) if(ip!==ph.ip&&sameNet(ip,ph.ip,ph.mask)) res.push({dev:devName,ip,mask:ph.mask,ifn:port,kind:"l3",proxy:true}); }
        for(const i of Object.values(d.ifs)) if(i.sub&&i.name.split(".")[0]===port&&!i.shutdown&&i.ip&&i.encap&&((tag===null&&i.native)||(tag!==null&&i.encap===tag))) res.push({dev:devName,ip:i.ip,mask:i.mask,ifn:i.name,kind:"l3"});
        return; }
      const i=eff(d,port); if(!i||i.shutdown||!i.connected) return;
      let v; if(operTrunk(i)){ v= tag===null? i.nativeVlan : (tag===i.nativeVlan? null : tag); if(v===null) return; if(i.allowed&&!i.allowed.includes(v)) return; }
      else { if(tag!==null) return; v=i.accessVlan; }
      if(!d.vlans[v]) return; q.push([devName,v]);
    };
    if(start.sw) q.push([start.sw,start.v]); else enter(start.dev,start.port,start.tag);
    while(q.length){ const [dn,v]=q.shift(); const k=dn+"|"+v; if(seen.has(k)) continue; seen.add(k); const sw=N.dev[dn];
      const svi=sw.ifs["Vlan"+v]; if(svi&&svi.ip&&!svi.shutdown) res.push({dev:dn,ip:svi.ip,mask:svi.mask,ifn:"Vlan"+v,kind:sw.ipRouting?"l3":"svi"});
      for(const p of Object.keys(sw.ifs)){ if(!isPhys(p)) continue; const c=carries(sw,eff(sw,p),v); if(!c) continue; const pr=N.peer(dn,p); if(pr) enter(pr.dev,pr.port,c.tag); } }
    return res;
  }
  const fromIface=(d,ifn)=>{ // домен 2-го рівня, у який «дивиться» L3-інтерфейс
    const i=d.ifs[ifn]; if(i.svi) return domain({sw:d.devName,v:Number(ifn.slice(4))});
    const ph=i.sub? ifn.split(".")[0] : ifn; const pr=N.peer(d.devName,ph); if(!pr) return [];
    const tag= i.sub? (i.native? null : i.encap) : null; return domain({dev:pr.dev,port:pr.port,tag}); };
  const upL3=d=>Object.values(d.ifs).filter(i=>i.ip&&ifStatus(d,i)[1]==="up");
  // ---------- 3-й рівень ----------
  function owns(devName,ip){ const d=N.dev[devName]; if(isHost(d)) return d.ip===ip; return upL3(d).some(i=>i.ip===ip); }
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
    for(const i of upL3(d)) if(sameNet(i.ip,dstIp,i.mask)) cands.push({len:maskLen(i.mask),ad:0,ifn:i.name,conn:true});
    if(d.ipRouting){ for(const r of activeStatics(d)) if(sameNet(r.net,dstIp,r.mask)||r.mask==="0.0.0.0") cands.push({len:r.mask==="0.0.0.0"?0:maskLen(r.mask),ad:r.ad,nh:r.nh,ifn:r.ifc});
      if(d.ospf) for(const r of N.ospfRoutes(d.devName)) if(r.mask==="0.0.0.0"||sameNet(r.net,dstIp,r.mask)) cands.push({len:r.mask==="0.0.0.0"?0:maskLen(r.mask),ad:110,nh:r.hops[0].nh,ifn:r.hops[0].ifn,ospf:true}); }
    if(!d.ipRouting && d.defaultGw) cands.push({len:0,ad:0,nh:d.defaultGw});
    cands.sort((a,b)=>b.len-a.len||a.ad-b.ad); return cands[0]||null;
  }
  function l2To(d,exitIf,target,pkt,c){
    const dom=fromIface(d,exitIf); const e=dom.find(x=>x.ip===target&&!(x.dev===d.devName&&x.ifn===exitIf));
    if(!e) return {ok:false,why:d.devName+": ARP для "+target+" через "+longIf(exitIf)+" без відповіді (сусід недосяжний на 2-му рівні)",arp:true};
    const nd=N.dev[e.dev];
    if(isHost(nd)) return nd.ip===pkt.dst? {ok:true,dev:e.dev,pkt} : {ok:false,why:"Пакет для "+pkt.dst+" потрапив на хост "+e.dev+", який не маршрутизує"};
    if(e.kind==="svi"&&!nd.ipRouting) return owns(e.dev,pkt.dst)? {ok:true,dev:e.dev,pkt} : {ok:false,why:e.dev+" не маршрутизує (немає ip routing)"};
    return routerIn(e.dev,e.ifn,pkt,c);
  }
  function routerIn(devName,inIf,pkt,c){
    const d=N.dev[devName];
    if(c.ttl--<=0) return {ok:false,why:"TTL вичерпано — петля маршрутизації",loop:true};
    if(inIf){ const b=aclBlocks(d,inIf,pkt,"in"); if(b) return {ok:false,why:b,acl:true,at:devName}; }
    if(inIf && d.ifs[inIf] && d.ifs[inIf].natOut) natInbound(d,pkt);
    if(owns(devName,pkt.dst)) return {ok:true,dev:devName,pkt};
    if(!d.ipRouting) return {ok:false,why:devName+" не маршрутизує (немає ip routing)"};
    const r=lookup(d,pkt.dst); if(!r) return {ok:false,why:devName+": немає маршруту до "+pkt.dst+" (перевірте show ip route)",noroute:true,at:devName};
    let exitIf=r.ifn, target=pkt.dst;
    if(r.nh){ target=r.nh; if(!exitIf){ const cc=upL3(d).find(i=>sameNet(i.ip,r.nh,i.mask)); if(!cc) return {ok:false,why:devName+": next-hop "+r.nh+" недосяжний"}; exitIf=cc.name; } }
    if(inIf && d.ifs[inIf].natIn && d.ifs[exitIf] && d.ifs[exitIf].natOut){ const e=natOutbound(d,pkt); if(e) return {ok:false,why:e}; }
    if(inIf){ const b=aclBlocks(d,exitIf,pkt,"out"); if(b) return {ok:false,why:b,acl:true,at:devName}; }
    if(inIf) c.hops.push(d.ifs[inIf].ip||"?");
    return l2To(d,exitIf,target,pkt,c);
  }
  function originate(devName,pkt,c){
    const d=N.dev[devName];
    if(isHost(d)){
      if(!d.ip) return {ok:false,why:devName+": немає IP-адреси"+(d.dhcp?" (виконайте ipconfig /renew)":"")};
      if(pkt.dst===d.ip) return {ok:true,dev:devName,pkt};
      const pr=N.peer(devName,"Fa0"); const dom=pr?domain({dev:pr.dev,port:pr.port,tag:null}):[];
      let target=pkt.dst; if(!sameNet(d.ip,pkt.dst,d.mask)){ if(!d.gw) return {ok:false,why:devName+": немає шлюзу за замовчуванням",arp:true}; target=d.gw; }
      const e=dom.find(x=>x.ip===target&&x.dev!==devName);
      if(!e) return {ok:false,arp:true,why: target===pkt.dst? "ARP для "+target+" без відповіді — хост недосяжний на 2-му рівні (VLAN, trunk, access-порти, маска)" : "Шлюз "+target+" недосяжний з "+devName+" (перевірте VLAN, trunk, субінтерфейс/SVI, адресу шлюзу)"};
      const nd=N.dev[e.dev]; if(isHost(nd)) return nd.ip===pkt.dst?{ok:true,dev:e.dev,pkt}:{ok:false,why:"Шлюз "+target+" — це звичайний хост "+e.dev};
      if(e.kind==="svi"&&!nd.ipRouting) return owns(e.dev,pkt.dst)?{ok:true,dev:e.dev,pkt}:{ok:false,why:e.dev+" не маршрутизує (немає ip routing)"};
      return routerIn(e.dev,e.ifn,pkt,c); }
    if(owns(devName,pkt.dst)) return {ok:true,dev:devName,pkt};
    if(!d.ipRouting){ const svi=upL3(d)[0]; if(!svi) return {ok:false,why:devName+": немає активного SVI з IP"}; let target=pkt.dst; if(!sameNet(svi.ip,pkt.dst,svi.mask)){ if(!d.defaultGw) return {ok:false,why:devName+": немає ip default-gateway"}; target=d.defaultGw; } return l2To(d,svi.name,target,pkt,c); }
    return routerIn(devName,null,pkt,c);
  }
  function srcIpOf(devName,dstIp){ const d=N.dev[devName]; if(isHost(d)) return d.ip;
    const r=lookup(d,dstIp); if(!r) return (upL3(d)[0]||{}).ip||null; let ifn=r.ifn; if(!ifn&&r.nh){ const c=upL3(d).find(i=>sameNet(i.ip,r.nh,i.mask)); ifn=c&&c.name; } return ifn&&d.ifs[ifn]&&d.ifs[ifn].ip? d.ifs[ifn].ip : (upL3(d)[0]||{}).ip; }
  N.flow=(fromDev,dst,proto,dport)=>{
    proto=proto||"icmp"; const src=srcIpOf(fromDev,dst); const fd=N.dev[fromDev];
    if(!src) return {ok:false,why:fromDev+": немає IP-адреси"+(fd.dhcp?" (виконайте ipconfig /renew)":""),hops:[]};
    N._sp=((N._sp||0)+1)%1000; const pkt={src,dst,proto,dport:proto==="icmp"?null:dport,sport:proto==="icmp"?N._sp+1:49152+N._sp};
    const c={hops:[],ttl:16}; const f=originate(fromDev,pkt,c);
    if(!f.ok) return Object.assign(f,{hops:c.hops});
    const td=N.dev[f.dev];
    if(proto!=="icmp"&&!(isHost(td)&&(td.services||[]).includes(dport))) return {ok:false,refused:true,why:f.dev+" не слухає TCP-порт "+dport+" (connection refused)",hops:c.hops};
    const rp={src:f.pkt.dst,dst:f.pkt.src,proto,dport:f.pkt.sport,sport:f.pkt.dport,reply:true};
    const c2={hops:[],ttl:16}; const b=originate(f.dev,rp,c2);
    if(!b.ok) return {ok:false,why:"Запит дійшов до "+f.dev+" ("+dst+"), але відповідь не повертається: "+b.why,back:true,hops:c.hops,srcSeen:f.pkt.src};
    if(b.dev!==fromDev) return {ok:false,why:"Відповідь потрапила на "+b.dev+" замість "+fromDev,back:true,hops:c.hops};
    return {ok:true,hops:c.hops,dev:f.dev,srcSeen:f.pkt.src};
  };
  N.ping=(a,b)=>N.flow(a,b,"icmp");
  N.pingCli=(s,dst)=>{ N.counting=true; const r=N.ping(s.devName,dst); N.counting=false; return "Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to "+dst+", timeout is 2 seconds:\n"+(r.ok?(r.hops.length?".!!!!":"!!!!!")+"\nSuccess rate is "+(r.hops.length?"80 percent (4/5)":"100 percent (5/5)")+", round-trip min/avg/max = 1/2/4 ms":(r.noroute||r.acl?"UUUUU":".....")+"\nSuccess rate is 0 percent (0/5)\n! "+r.why); };
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
    const pc=N.dev[pcName]; const pr=N.peer(pcName,"Fa0"); const dom=pr?domain({dev:pr.dev,port:pr.port,tag:null}):[]; let why=null;
    for(const e of dom){ if(e.kind==="pc") continue; const d=N.dev[e.dev]; const ifc=d.ifs[e.ifn]; if(!ifc||!ifc.ip||ifc.ip!==e.ip) continue; const gi=ifc.ip; let srv=null;
      const local=poolFor(d,gi); if(local) srv={dev:e.dev,pool:local};
      else if(ifc.helper&&ifc.helper.length){ for(const h of ifc.helper){ const c={hops:[],ttl:16}; const f=originate(e.dev,{src:gi,dst:h,proto:"udp",dport:67,sport:67},c); if(!f.ok){ why="DHCP relay "+e.dev+" → "+h+": "+f.why; continue; }
          const sd=N.dev[f.dev]; const p=poolFor(sd,gi); if(!p){ why="DHCP-сервер "+h+" ("+f.dev+") не має пулу для мережі "+gi+"/"+maskLen(ifc.mask); continue; }
          const b=originate(f.dev,{src:f.pkt.dst,dst:gi,proto:"udp",dport:67,sport:67,reply:true},{hops:[],ttl:16}); if(!b.ok){ why="Відповідь DHCP-сервера не доходить до relay "+gi+": "+b.why; continue; } srv={dev:f.dev,pool:p}; break; } }
      if(srv){ const ip=allocate(N.dev[srv.dev],srv.pool,pcName); if(!ip) return {ok:false,why:"Пул "+srv.pool.name+" на "+srv.dev+" вичерпано або всі адреси виключено"}; Object.assign(pc,{ip,mask:srv.pool.mask,gw:srv.pool.gw||null,dns:srv.pool.dns||null,dhcpSrv:N.dev[srv.dev]===d?gi:(ifc.helper[0])}); return {ok:true}; }
    }
    pc.ip=null; return {ok:false,why:why||"Жоден DHCP-сервер не відповів у цьому сегменті: на шлюзі немає пулу для цієї мережі і не задано ip helper-address"}; };
  N.release=pcName=>{ const pc=N.dev[pcName]; for(const d of Object.values(N.dev)) if(!isHost(d)&&d.dhcp) for(const [ip,b] of Object.entries(d.dhcp.bind)) if(b.client===pcName) delete d.dhcp.bind[ip]; pc.ip=null; pc.mask=null; pc.gw=null; };
  N.cdp=(s)=>{ let o="Capability Codes: R - Router, S - Switch, H - Host\n\nDevice ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\n";
    for(const l of N.links){ let me,pm,ot,po; if(l.a===s.devName){me=l.pa;ot=l.b;po=l.pb;} else if(l.b===s.devName){me=l.pb;ot=l.a;po=l.pa;} else continue;
      const od=N.dev[ot]; if(isHost(od)||s.ifs[me].shutdown||(od.ifs[po]&&od.ifs[po].shutdown)) continue;
      o+=ot.padEnd(17)+longIf(me).replace("GigabitEthernet","Gig ").replace("FastEthernet","Fas ").padEnd(18)+"170        "+(od.type==="router"?"R":"S I").padEnd(12)+(od.type==="router"?"ISR4321":"WS-C2960").padEnd(10)+longIf(po).replace("GigabitEthernet","Gig ").replace("FastEthernet","Fas ")+"\n"; }
    return o; };
  // ---------- STP між комутаторами ----------
  N.stp=(v)=>{
    const sws=Object.values(N.dev).filter(d=>d.type==="switch"&&d.vlans[v]); if(!sws.length) return null;
    const bid=d=>({p:(d.stpPrio[v]!==undefined?d.stpPrio[v]:32768)+v,mac:d.mac});
    const cmpB=(a,b)=>a.p-b.p||(a.mac<b.mac?-1:a.mac>b.mac?1:0);
    const root=sws.slice().sort((a,b)=>cmpB(bid(a),bid(b)))[0];
    const edges=[]; for(const l of N.links){ const A=N.dev[l.a],B=N.dev[l.b]; if(!isSw(A)||!isSw(B)||!A.vlans[v]||!B.vlans[v]) continue;
      if(!carries(A,eff(A,l.pa),v)||!carries(B,eff(B,l.pb),v)) continue; const cost=l.pa.startsWith("Gi")?4:19; edges.push({a:l.a,pa:l.pa,b:l.b,pb:l.pb,cost}); }
    const dist={}; sws.forEach(d=>dist[d.devName]=Infinity); dist[root.devName]=0; const done=new Set();
    while(true){ let u=null; for(const d of sws) if(!done.has(d.devName)&&(u===null||dist[d.devName]<dist[u])) u=d.devName; if(u===null||dist[u]===Infinity) break; done.add(u);
      for(const e of edges){ if(e.a===u&&dist[u]+e.cost<dist[e.b]) dist[e.b]=dist[u]+e.cost; if(e.b===u&&dist[u]+e.cost<dist[e.a]) dist[e.a]=dist[u]+e.cost; } }
    const info={}; sws.forEach(d=>info[d.devName]={root:bid(root),rootName:root.devName,cost:dist[d.devName],roles:{},rootPort:null});
    for(const d of sws){ if(d===root||dist[d.devName]===Infinity) continue;
      const opts=[]; for(const e of edges){ let me,pm,ot,po; if(e.a===d.devName){pm=e.pa;ot=e.b;po=e.pb;} else if(e.b===d.devName){pm=e.pb;ot=e.a;po=e.pa;} else continue;
        opts.push({pm,ot,po,c:dist[ot]+e.cost,nb:bid(N.dev[ot])}); }
      opts.sort((x,y)=>x.c-y.c||cmpB(x.nb,y.nb)||x.po.localeCompare(y.po,undefined,{numeric:true})); if(opts[0]&&opts[0].c===dist[d.devName]) info[d.devName].rootPort=opts[0].pm; }
    for(const e of edges){ const A=info[e.a],B=info[e.b];
      const aDesg= A.cost<B.cost || (A.cost===B.cost && cmpB(bid(N.dev[e.a]),bid(N.dev[e.b]))<0);
      const set=(dn,p,isD)=>{ const I=info[dn]; I.roles[p]= I.rootPort===p? ["Root","FWD"] : isD? ["Desg","FWD"] : ["Altn","BLK"]; };
      set(e.a,e.pa,aDesg); set(e.b,e.pb,!aDesg); }
    return info; };
  N.dump=()=>N;
  N.recompute();
  return N;
}
// Сесія ПК/сервера (командний рядок Windows)
function PCSession(pc,N){
  const fail=(r,ip)=>r.arp&&!r.back? "Reply from "+(pc.ip||"0.0.0.0")+": Destination host unreachable." : (r.noroute||r.acl)&&!r.back? "Reply from "+(pc.gw||pc.ip)+": Destination net unreachable." : "Request timed out.";
  const tcp=(ip,port,okText)=>{ N.counting=true; const r=N.flow(pc.name,ip,"tcp",port); N.counting=false; return r.ok? okText : (r.refused? "Connecting to "+ip+"... Could not open connection to the host, on port "+port+": Connect failed\n! "+r.why : "Connecting to "+ip+"... Could not open connection to the host, on port "+port+": Connect failed (timed out)\n! Підказка тренажера: "+r.why); };
  const HELP="Команди: ipconfig, ipconfig /all, ipconfig /renew, ipconfig /release, ping <IP>, tracert <IP>, curl <IP> (HTTP, TCP 80), ssh <IP> (TCP 22), telnet <IP> (TCP 23)";
  return { state:pc, prompt(){ return "C:\\>"; },
    exec(line){ const t=line.trim(); if(!t) return ""; const a=t.split(/\s+/); const c=a[0].toLowerCase(); const arg=(a[1]||"").replace(/^https?:\/\//i,"").replace(/^.*@/,"").replace(/\/.*$/,"");
      if(c==="ipconfig"){ const f=(a[1]||"").toLowerCase();
        if(f==="/release"){ N.release(pc.name); return "\nEthernet adapter Ethernet0:\n\n   Connection-specific DNS Suffix  . :\n   IPv4 Address. . . . . . . . . . . : —\n   Default Gateway . . . . . . . . . :"; }
        if(f==="/renew"){ const r=N.dhcp(pc.name); if(!r.ok){ return "\nAn error occurred while renewing interface Ethernet0 : unable to contact your DHCP server. Request has timed out.\n! Підказка тренажера: "+r.why; } }
        const all=f==="/all";
        return "\nEthernet adapter Ethernet0:\n\n"+(all?"   Physical Address. . . . . . . . . : 00-50-79-66-68-"+String(10+pc.name.length).padStart(2,"0")+"\n   DHCP Enabled. . . . . . . . . . . : "+(pc.dhcp?"Yes":"No")+"\n":"")+"   IPv4 Address. . . . . . . . . . . : "+(pc.ip||(pc.dhcp?"169.254.18.77 (APIPA — DHCP не відповів)":"—"))+"\n   Subnet Mask . . . . . . . . . . . : "+(pc.mask||(pc.dhcp?"255.255.0.0":"—"))+"\n   Default Gateway . . . . . . . . . : "+(pc.gw||"")+(all&&pc.dhcpSrv?"\n   DHCP Server . . . . . . . . . . . : "+pc.dhcpSrv:"")+(all&&pc.dns?"\n   DNS Servers . . . . . . . . . . . : "+pc.dns:"")+"\n"; }
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

];
function startNet(sc){ const N=Net(sc.def()); const ses={}; for(const [k,d] of Object.entries(N.dev)) ses[k]= (d.type==="pc"||d.type==="server")? PCSession(d,N) : Session(d); return {N,ses}; }

// ---------- Розв'язання сценарію і режим «Troubleshooting» ----------
function solveNet(sc){ const {N,ses}=startNet(sc); let cur=null;
  for(const raw of sc.sol.split("\n")){ const line=raw.trim(); if(!line||line.startsWith("(")) continue; const m=line.match(/^([\w-]+):$/); if(m&&ses[m[1]]){ cur=m[1]; continue; } if(!cur) continue;
    const r=ses[cur].exec(line); if(/Reset ALL/.test(ses[cur].prompt())) ses[cur].exec("yes"); N.recompute(); }
  return N; }
const pick=a=>a[Math.floor(Math.random()*a.length)];
function faultsFor(N){
  const F=[]; const isH=d=>d.type==="pc"||d.type==="server";
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
    const ses={}; for(const [k,d] of Object.entries(N.dev)) ses[k]= (d.type==="pc"||d.type==="server")? PCSession(d,N) : Session(d);
    return {N,ses,faults:picks.map(p=>p.d)};
  }
  return null; }

window.CLI={SCEN,NETSCEN,startNet,solveNet,troubleshoot,startScenario,Session,newState,normIf,parseList};
})();
