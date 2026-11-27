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

