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

