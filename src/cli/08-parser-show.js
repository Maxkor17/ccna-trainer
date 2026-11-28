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
  for(const i of list){ const [st,pr]=ifStatus(s,i); o+=longIf(i.name).padEnd(23)+(i.ip||"unassigned").padEnd(16)+"YES "+(i.ipDhcp?"DHCP":i.ip?"manual":"unset ").padEnd(7)+st.padEnd(22)+pr+"\n"; }
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
  if(i.svi||i.loop){ L.push(i.ipDhcp?" ip address dhcp":i.ip?" ip address "+i.ip+" "+i.mask:" no ip address"); L.push(...l3extra(i)); if(i.shutdown) L.push(" shutdown"); return L; }
  if(i.sub){ if(i.encap) L.push(" encapsulation dot1Q "+i.encap+(i.native?" native":"")); L.push(i.ipDhcp?" ip address dhcp":i.ip?" ip address "+i.ip+" "+i.mask:" no ip address"); L.push(...l3extra(i)); if(i.shutdown) L.push(" shutdown"); return L; }
  if(!i.switchport){ if(!s.router) L.push(" no switchport"); L.push(i.ipDhcp?" ip address dhcp":i.ip?" ip address "+i.ip+" "+i.mask:" no ip address"); L.push(...l3extra(i)); }
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
  { const g=secRunGlobal(s).concat(v2RunGlobal(s),qosRunGlobal(s),cisRunGlobal(s)); if(g.length) L.push("!",...g); }
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
  for(const r of s.routes.filter(r=>!r.dhcp)) L.push("ip route "+r.net+" "+r.mask+(r.ifc?" "+longIf(r.ifc):"")+(r.nh?" "+r.nh:"")+(r.ad&&r.ad!==1?" "+r.ad:""));
  if(s.routes.some(r=>!r.dhcp)) L.push("!");
  for(const [n,acl] of Object.entries(s.acls)){ if(acl.named){ L.push("ip access-list "+(acl.type==="std"?"standard":"extended")+" "+n); for(const r of acl.rules) L.push(" "+aceText(acl,r,true)); } else for(const r of acl.rules) L.push("access-list "+n+" "+aceText(acl,r,true)); L.push("!"); }
  L.push("line con 0"); if(s.con.password) L.push(" password "+s.con.password); if(s.con.login) L.push(s.con.login==="local"?" login local":" login");
  L.push("line vty 0 15"); if(s.vty.execTimeout) L.push(" exec-timeout "+s.vty.execTimeout.join(" ")); if(s.vty.authList) L.push(" login authentication "+s.vty.authList); if(s.vty.password) L.push(" password "+s.vty.password); if(s.vty.login) L.push(s.vty.login==="local"?" login local":" login"); if(s.vty.acl) L.push(" access-class "+s.vty.acl+" in"); if(s.vty.transport!=="all") L.push(" transport input "+s.vty.transport);
  L.push("!","end"); return L.join("\n");
}

