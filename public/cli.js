// Мінісимулятор Cisco IOS (Catalyst 2960 / L3-комутатор) для навчальних сценаріїв.
(function(){
"use strict";
const IFTYPES=[["fastethernet","Fa","FastEthernet"],["gigabitethernet","Gi","GigabitEthernet"],["port-channel","Po","Port-channel"],["vlan","Vlan","Vlan"]];
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

function newIf(name){ return {name,shutdown:false,mode:"dynamic auto",accessVlan:1,voiceVlan:null,nativeVlan:1,allowed:null,nonegotiate:false,portfast:false,bpduguard:false,chGroup:null,chMode:null,switchport:true,ip:null,mask:null,desc:null,speed:"auto",duplex:"auto"}; }
function newState(opt){
  opt=opt||{};
  const s={hostname:opt.hostname||"S1",l3:!!opt.l3||!!opt.router,router:!!opt.router,routes:[],vlans:opt.router?{}:{1:{name:"default"}},ifs:{},ipRouting:!!opt.router,defaultGw:null,domain:null,rsaBits:0,users:{},
    enableSecret:null,servicePwEnc:false,noDomainLookup:false,sshVer:null,vty:{transport:"all",login:null,password:null},con:{login:null,password:null},
    stpMode:"pvst",stpPrio:{},portfastDefault:false,bpduguardDefault:false,lb:"src-mac",mac:"0019.e8"+String(Math.floor(Math.random()*90)+10)+".1a00",saved:false};
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
  const sr=activeStatics(s); const def=sr.find(r=>r.mask==="0.0.0.0");
  let o="Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP\n       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area\n       * - candidate default\n\nGateway of last resort is "+(def?(def.nh||longIf(def.ifc))+" to network 0.0.0.0":"not set")+"\n\n";
  for(const r of sr) o+=(r.mask==="0.0.0.0"?"S*       ":"S        ")+r.net+"/"+maskLen(r.mask)+" ["+r.ad+"/0]"+(r.nh?" via "+r.nh:" is directly connected, "+longIf(r.ifc))+"\n";
  if(only==="S") return o;
  for(const i of Object.values(s.ifs).filter(x=>x.ip&&ifStatus(s,x)[1]==="up")){ const m=ipToN(i.mask), net=(ipToN(i.ip)&m)>>>0; const ns=[net>>>24,(net>>>16)&255,(net>>>8)&255,net&255].join("."); o+="C        "+ns+"/"+maskLen(i.mask)+" is directly connected, "+longIf(i.name)+"\nL        "+i.ip+"/32 is directly connected, "+longIf(i.name)+"\n"; }
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
  if(i.svi){ L.push(i.ip?" ip address "+i.ip+" "+i.mask:" no ip address"); if(i.shutdown) L.push(" shutdown"); return L; }
  if(i.sub){ if(i.encap) L.push(" encapsulation dot1Q "+i.encap+(i.native?" native":"")); L.push(i.ip?" ip address "+i.ip+" "+i.mask:" no ip address"); if(i.shutdown) L.push(" shutdown"); return L; }
  if(!i.switchport){ if(!s.router) L.push(" no switchport"); L.push(i.ip?" ip address "+i.ip+" "+i.mask:" no ip address"); }
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
  L.push("!","spanning-tree mode "+s.stpMode); if(s.portfastDefault) L.push("spanning-tree portfast default"); if(s.bpduguardDefault) L.push("spanning-tree portfast bpduguard default"); L.push("spanning-tree extend system-id");
  for(const [v,p] of Object.entries(s.stpPrio)) L.push("spanning-tree vlan "+v+" priority "+p);
  if(s.lb!=="src-mac") L.push("port-channel load-balance "+s.lb);
  L.push("!");
  const ifs=Object.values(s.ifs).sort((a,b)=>{const o=x=>x.name.startsWith("Po")?0:x.svi?2:1; return o(a)-o(b)||a.name.localeCompare(b.name,undefined,{numeric:true});});
  for(const i of ifs){ L.push(...runIf(s,i),"!"); }
  if(s.defaultGw) L.push("ip default-gateway "+s.defaultGw,"!");
  for(const r of s.routes) L.push("ip route "+r.net+" "+r.mask+(r.ifc?" "+longIf(r.ifc):"")+(r.nh?" "+r.nh:"")+(r.ad&&r.ad!==1?" "+r.ad:""));
  if(s.routes.length) L.push("!");
  L.push("line con 0"); if(s.con.password) L.push(" password "+s.con.password); if(s.con.login) L.push(s.con.login==="local"?" login local":" login");
  L.push("line vty 0 15"); if(s.vty.password) L.push(" password "+s.vty.password); if(s.vty.login) L.push(s.vty.login==="local"?" login local":" login"); if(s.vty.transport!=="all") L.push(" transport input "+s.vty.transport);
  L.push("!","end"); return L.join("\n");
}

// ---------- Сесія терміналу ----------
function promptOf(ctx,s){ const h=s.hostname; return {user:h+">",exec:h+"#",config:h+"(config)#",if:h+(ctx.ifs&&ctx.ifs.length>1?"(config-if-range)#":"(config-if)#"),vlan:h+"(config-vlan)#",line:h+"(config-line)#"}[ctx.mode]; }
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
      if(r.err && ["if","vlan","line"].includes(ctx.mode)){ const r2=matchMode("config",line); if(r2.hit){ ctx.mode="config"; r=r2; } }
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
  for(const [name,d] of Object.entries(def.devices)){
    if(d.type==="pc") N.dev[name]={name,type:"pc",ip:d.ip||null,mask:d.mask||null,gw:d.gw||null,port:"Fa0"};
    else { const st=newState({hostname:name,router:d.type==="router",l3:d.l3,vlans:d.vlans,setup:d.setup}); st.net=N; st.devName=name; st.type=d.type; if(d.mac) st.mac=d.mac; N.dev[name]=st; }
  }
  for(const [a,pa,b,pb] of def.links){ N.links.push({a,pa,b,pb}); for(const [d,p] of [[a,pa],[b,pb]]){ const x=N.dev[d]; if(x.type!=="pc"&&x.ifs[p]) x.ifs[p].connected=true; } }
  N.peer=(dev,port)=>{ for(const l of N.links){ if(l.a===dev&&l.pa===port) return {dev:l.b,port:l.pb}; if(l.b===dev&&l.pb===port) return {dev:l.a,port:l.pa}; } return null; };
  const isSw=d=>d&&d.type==="switch";
  const eff=(sw,p)=>{ const i=sw.ifs[p]; if(i&&i.chGroup&&sw.ifs["Po"+i.chGroup]) return Object.assign({},sw.ifs["Po"+i.chGroup],{shutdown:i.shutdown,connected:i.connected,name:p,_oper:i._oper}); return i; };
  // ---------- DTP: операційний режим портів ----------
  N.recompute=()=>{
    for(const d of Object.values(N.dev)) if(d.type!=="pc") for(const i of Object.values(d.ifs)) delete i._oper;
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
      if(d.type==="pc"){ if(tag===null) res.push({dev:devName,ip:d.ip,mask:d.mask,kind:"pc"}); return; }
      if(d.type==="router"||(d.ifs[port]&&!d.ifs[port].switchport)){
        const ph=d.ifs[port]; if(!ph||ph.shutdown) return;
        if(tag===null && ph.ip) res.push({dev:devName,ip:ph.ip,mask:ph.mask,ifn:port,kind:"l3"});
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
  function owns(devName,ip){ const d=N.dev[devName]; if(d.type==="pc") return d.ip===ip; return upL3(d).some(i=>i.ip===ip); }
  function hostSend(pc,dstIp,hops,ttl){
    if(!pc.ip) return {ok:false,why:pc.name+": не налаштовано IP-адресу"};
    const dom=domain({dev:N.peer(pc.name,"Fa0")?N.peer(pc.name,"Fa0").dev:null, port:N.peer(pc.name,"Fa0")?N.peer(pc.name,"Fa0").port:null, tag:null});
    if(sameNet(pc.ip,dstIp,pc.mask)){ const e=dom.find(x=>x.ip===dstIp); return e? {ok:true,dev:e.dev,hops} : {ok:false,why:"ARP для "+dstIp+" без відповіді — хост недосяжний на 2-му рівні (VLAN, trunk, access-порти)"}; }
    if(!pc.gw) return {ok:false,why:pc.name+": немає шлюзу за замовчуванням"};
    const g=dom.find(x=>x.ip===pc.gw); if(!g) return {ok:false,why:"Шлюз "+pc.gw+" недосяжний з "+pc.name+" (перевірте VLAN, trunk, субінтерфейс/SVI)"};
    hops.push(pc.gw); return l3Forward(g.dev,dstIp,hops,ttl);
  }
  function lookup(d,dstIp){
    const cands=[];
    for(const i of upL3(d)) if(sameNet(i.ip,dstIp,i.mask)) cands.push({len:maskLen(i.mask),ad:0,ifn:i.name,conn:true});
    if(d.ipRouting) for(const r of activeStatics(d)) if(sameNet(r.net,dstIp,r.mask)||r.mask==="0.0.0.0") cands.push({len:r.mask==="0.0.0.0"?0:maskLen(r.mask),ad:r.ad,nh:r.nh,ifn:r.ifc});
    if(!d.ipRouting && d.defaultGw) cands.push({len:0,ad:0,nh:d.defaultGw});
    cands.sort((a,b)=>b.len-a.len||a.ad-b.ad); return cands[0]||null;
  }
  function l3Forward(devName,dstIp,hops,ttl){
    if(ttl<=0) return {ok:false,why:"TTL вичерпано — петля маршрутизації",loop:true,hops};
    const d=N.dev[devName]; if(d.type==="pc") return d.ip===dstIp? {ok:true,dev:devName,hops} : {ok:false,why:"Пакет потрапив на хост "+devName};
    if(owns(devName,dstIp)) return {ok:true,dev:devName,hops};
    if(!d.ipRouting && !d.router) { // L2-комутатор із SVI — приймає лише для себе
      return {ok:false,why:devName+" не маршрутизує (немає ip routing)"}; }
    const r=lookup(d,dstIp); if(!r) return {ok:false,why:devName+": немає маршруту до "+dstIp,hops};
    let exitIf=r.ifn, target=dstIp;
    if(r.nh){ target=r.nh; if(!exitIf){ const c=upL3(d).find(i=>sameNet(i.ip,r.nh,i.mask)); if(!c) return {ok:false,why:devName+": next-hop "+r.nh+" недосяжний"}; exitIf=c.name; } }
    const dom=fromIface(d,exitIf); const e=dom.find(x=>x.ip===target);
    if(!e) return {ok:false,why:devName+": ARP для "+target+" через "+longIf(exitIf)+" без відповіді"};
    if(!r.nh) return {ok:true,dev:e.dev,hops};
    hops.push(r.nh); return l3Forward(e.dev,dstIp,hops,ttl-1);
  }
  function srcIpOf(devName,dstIp){ const d=N.dev[devName]; if(d.type==="pc") return d.ip;
    const r=lookup(d,dstIp); if(!r) return null; let ifn=r.ifn; if(!ifn&&r.nh){ const c=upL3(d).find(i=>sameNet(i.ip,r.nh,i.mask)); ifn=c&&c.name; } return ifn&&d.ifs[ifn]? d.ifs[ifn].ip : (upL3(d)[0]||{}).ip; }
  function send(devName,dstIp){ const d=N.dev[devName]; const hops=[]; if(d.type==="pc") return hostSend(d,dstIp,hops,16);
    if(owns(devName,dstIp)) return {ok:true,dev:devName,hops};
    if(!d.ipRouting&&!d.router){ // комутатор 2-го рівня з SVI
      const svi=upL3(d)[0]; if(!svi) return {ok:false,why:devName+": немає активного SVI з IP"};
      const dom=fromIface(d,svi.name); if(sameNet(svi.ip,dstIp,svi.mask)){ const e=dom.find(x=>x.ip===dstIp); return e?{ok:true,dev:e.dev,hops}:{ok:false,why:"ARP без відповіді"}; }
      if(!d.defaultGw) return {ok:false,why:devName+": немає ip default-gateway"}; const g=dom.find(x=>x.ip===d.defaultGw); if(!g) return {ok:false,why:"Шлюз недосяжний"}; hops.push(d.defaultGw); return l3Forward(g.dev,dstIp,hops,16); }
    return l3Forward(devName,dstIp,hops,16); }
  N.ping=(fromDev,dstIp)=>{
    const src=srcIpOf(fromDev,dstIp); const f=send(fromDev,dstIp);
    if(!f.ok) return {ok:false,why:f.why,hops:f.hops||[]};
    if(!src) return {ok:false,why:"Немає адреси джерела"};
    const b=send(f.dev,src); if(!b.ok) return {ok:false,why:"Запит дійшов до "+dstIp+", але відповідь не повертається: "+b.why,back:true,hops:f.hops};
    return {ok:true,hops:f.hops,dev:f.dev}; };
  N.pingCli=(s,dst)=>{ const r=N.ping(s.devName,dst); return "Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to "+dst+", timeout is 2 seconds:\n"+(r.ok?(r.hops.length?".!!!!":"!!!!!")+"\nSuccess rate is "+(r.hops.length?"80 percent (4/5)":"100 percent (5/5)")+", round-trip min/avg/max = 1/2/4 ms":(r.why&&/немає маршруту/.test(r.why)?"UUUUU":".....")+"\nSuccess rate is 0 percent (0/5)\n! "+r.why); };
  N.traceCli=(s,dst)=>{ const r=N.ping(s.devName,dst); let o="Type escape sequence to abort.\nTracing the route to "+dst+"\n\n"; const hops=(r.hops||[]).slice(); if(r.ok) hops.push(dst); hops.forEach((h,k)=>o+="  "+(k+1)+" "+h+" 1 msec 1 msec 1 msec\n"); if(!r.ok) o+="  "+(hops.length+1)+"  *  *  *\n! "+r.why; return o; };
  N.cdp=(s)=>{ let o="Capability Codes: R - Router, S - Switch, H - Host\n\nDevice ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\n";
    for(const l of N.links){ let me,pm,ot,po; if(l.a===s.devName){me=l.pa;ot=l.b;po=l.pb;} else if(l.b===s.devName){me=l.pb;ot=l.a;po=l.pa;} else continue;
      const od=N.dev[ot]; if(od.type==="pc"||s.ifs[me].shutdown||(od.ifs[po]&&od.ifs[po].shutdown)) continue;
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
// Сесія ПК (командний рядок Windows)
function PCSession(pc,N){
  return { state:pc, prompt(){ return "C:\\>"; },
    exec(line){ const t=line.trim(); if(!t) return ""; const a=t.split(/\s+/); const c=a[0].toLowerCase();
      if(c==="ipconfig") return "\nEthernet adapter Ethernet0:\n\n   IPv4 Address. . . . . . . . . . . : "+(pc.ip||"—")+"\n   Subnet Mask . . . . . . . . . . . : "+(pc.mask||"—")+"\n   Default Gateway . . . . . . . . . : "+(pc.gw||"")+"\n";
      if(c==="ping"&&a[1]&&ipRe.test(a[1])){ const r=N.ping(pc.name,a[1]); return "\nPinging "+a[1]+" with 32 bytes of data:\n"+(r.ok?Array(4).fill("Reply from "+a[1]+": bytes=32 time<1ms TTL="+(128-r.hops.length)).join("\n")+"\n\nPing statistics for "+a[1]+":\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)":Array(4).fill(/недосяжний|ARP/.test(r.why||"")&&!r.back?"Reply from "+(pc.ip||"0.0.0.0")+": Destination host unreachable.":"Request timed out.").join("\n")+"\n\nPing statistics for "+a[1]+":\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)\n! Підказка тренажера: "+r.why); }
      if((c==="tracert"||c==="traceroute")&&a[1]&&ipRe.test(a[1])){ const r=N.ping(pc.name,a[1]); const hops=(r.hops||[]).slice(); if(r.ok) hops.push(a[1]); return "\nTracing route to "+a[1]+" over a maximum of 30 hops\n\n"+hops.map((h,k)=>"  "+(k+1)+"    <1 ms    <1 ms    <1 ms  "+h).join("\n")+(r.ok?"\n\nTrace complete.":"\n  "+(hops.length+1)+"     *        *        *     Request timed out.\n! "+r.why); }
      if(c==="help"||c==="?") return "Команди: ipconfig, ping <IP>, tracert <IP>";
      return "'"+a[0]+"' is not recognized as an internal or external command.\nДоступно: ipconfig, ping <IP>, tracert <IP>"; } };
}
// Мережеві сценарії
const pass=(N,a,b)=>N.ping(a,b).ok;
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
  sol:"S2:\nenable\nconf t\nspanning-tree vlan 1 root primary\nend\n\nS3:\nenable\nconf t\nspanning-tree vlan 1 root secondary\nend\n\nshow spanning-tree"}
];
function startNet(sc){ const N=Net(sc.def()); const ses={}; for(const [k,d] of Object.entries(N.dev)) ses[k]= d.type==="pc"? PCSession(d,N) : Session(d); return {N,ses}; }

window.CLI={SCEN,NETSCEN,startNet,startScenario,Session,newState,normIf,parseList};
})();
