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
    try{ msgs.push(...N.debugMsgs()); }catch(e){}
    const out=[]; for(const m of msgs){ const k=m.join("|"); if(!N.seenMsgs.has(k)){ N.seenMsgs.add(k); out.push(m); } }
    if(N._dq&&N._dq.length) out.push(...N._dq.splice(0));
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
  N.lookup=(dn,ip)=>lookup(N.dev[dn],ip);
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
  // ---------- debug: зміни стану OSPF-сусідств і STP між перерахунками ----------
  N._dbgPrev={};
  N.debugMsgs=()=>{ const M=[];
    for(const d of Object.values(N.dev)){ if(isHost(d)||d.type==="hub") continue; const dn=d.devName;
      if(d.dbgOspf&&d.ospf){ const P=N._dbgPrev[dn+"|ospf"]||{}; const cur={};
        for(const n of N.ospfNeighbors(dn)){ const me=N.ospfRole(dn,n.myIf), he=N.ospfRole(n.dev,n.ifn); const st=(me==="DROTHER"&&he==="DROTHER")?"2WAY":"FULL"; cur[n.rid+"|"+n.myIf]=st;
          if(P[n.rid+"|"+n.myIf]!==st){ const I="*OSPF-ADJ "+n.myIf+": "; M.push([dn,I+"2 Way Communication to "+n.rid+", state 2WAY"]);
            if(st==="FULL") M.push([dn,I+"Nbr "+n.rid+": Prepare dbase exchange"],[dn,I+"Send DBD to "+n.rid+" seq 0x"+(0x1000+n.rid.split(".").reduce((a,x)=>a+Number(x),0)).toString(16)+" opt 0x52 flag 0x7 len 32"],[dn,I+"Rcv DBD from "+n.rid+" seq 0x"+(0x2000+n.rid.split(".").reduce((a,x)=>a+Number(x),0)).toString(16)+" opt 0x52 flag 0x2 len 152 mtu 1500 state EXCHANGE"],[dn,I+"Exchange Done with "+n.rid],[dn,I+"Synchronized with "+n.rid+", state FULL"]);
            else M.push([dn,I+"Nbr "+n.rid+" is DROTHER and so am I: staying in 2WAY (no full adjacency between DROTHERs)"]); } }
        for(const k of Object.keys(P)) if(!cur[k]){ const [rid,ifn]=k.split("|"); M.push([dn,"*OSPF-ADJ "+ifn+": Neighbor "+rid+" is dead, state DOWN"],[dn,"%OSPF-5-ADJCHG: Process "+d.ospf.pid+", Nbr "+rid+" on "+longIf(ifn)+" from FULL to DOWN, Neighbor Down: Dead timer expired"]); }
        N._dbgPrev[dn+"|ospf"]=cur;
        for(const l of N.ospfDebug(d).split("\n")) if(/Mismatch|mismatch|DUP_RTRID|passive|ACL|MTU|authentication/i.test(l)) M.push([dn,l]); }
      else delete N._dbgPrev[dn+"|ospf"];
      if(d.dbgStp&&d.type==="switch"){ const P=N._dbgPrev[dn+"|stp"]||{}; const cur={};
        for(const v of Object.keys(d.vlans).map(Number)){ const st=(N.stp(v)||{})[dn]; if(!st) continue; const V="VLAN"+String(v).padStart(4,"0");
          cur[v+"|root"]=st.rootName; if(P[v+"|root"]!==undefined&&P[v+"|root"]!==st.rootName) M.push([dn,"STP: "+V+" new root is "+(st.root&&st.root.p)+", "+(st.root&&st.root.mac)+(st.rootPort?" on port "+st.rootPort:" (this bridge)")+", cost "+st.cost]);
          for(const [p,r] of Object.entries(st.roles||{})){ const k=v+"|"+p; const val=r[0]+"/"+r[1]; cur[k]=val; const was=P[k];
            if(was!==undefined&&was!==val){ const [wr]=was.split("/"); if(wr!==r[0]) M.push([dn,"STP: "+V+" "+p+" role "+wr+" -> "+r[0]]); M.push([dn,"STP: "+V+" "+p+" -> "+({FWD:"forwarding",BLK:"blocking",LRN:"learning",LIS:"listening",BKN:"broken (inconsistent)"}[r[1]]||r[1])]); }
            else if(was===undefined&&P[v+"|root"]!==undefined) M.push([dn,"STP: "+V+" "+p+" -> "+({FWD:"listening → learning → forwarding",BLK:"blocking"}[r[1]]||r[1])]); } }
        N._dbgPrev[dn+"|stp"]=cur; }
      else delete N._dbgPrev[dn+"|stp"]; }
    return M; };
  N.dbgDhcp=(srvDev,lines)=>{ const d=N.dev[srvDev]; if(!d||!d.dbgDhcp) return; N._dq=N._dq||[]; for(const l of lines) N._dq.push([srvDev,l]); };
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
    const infra=new Set(Object.values(N.dev).filter(x=>!isHost(x)&&x!==d).flatMap(x=>Object.values(x.ifs||{}).flatMap(i=>[i.ip].concat(Object.values(i.hsrp||{}).map(h=>h.ip),Object.values(i.vrrp||{}).map(h=>h.ip)))).filter(Boolean));
    for(let n=lo;n<=hi;n++){ const ip=n2ip(n); if(d.dhcp.excl.some(([a,b])=>n>=ipToN(a)&&n<=ipToN(b))) continue; if(d.dhcp.bind[ip]||own.has(ip)||taken.has(ip)) continue;
      if(infra.has(ip)){ d.dhcp.conflicts=d.dhcp.conflicts||{}; if(!d.dhcp.conflicts[ip]){ d.dhcp.conflicts[ip]=Date.now(); N._dq=N._dq||[]; N._dq.push([d.devName,"%DHCPD-4-PING_CONFLICT: DHCP address conflict:  server pinged "+ip+"."]); } continue; }
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
          const sd=N.dev[f.dev]; const p=poolFor(sd,gi); if(!p){ N.dbgDhcp(f.dev,["DHCPD: DHCPDISCOVER received from client through relay "+gi+".","DHCPD: there is no pool for "+gi+"."]); why="DHCP-сервер "+h+" ("+f.dev+") не має пулу для мережі "+gi+"/"+maskLen(ifc.mask); continue; }
          const b=originate(f.dev,{src:f.pkt.dst,dst:gi,proto:"udp",dport:67,sport:67,reply:true},{hops:[],ttl:16}); if(!b.ok){ why="Відповідь DHCP-сервера не доходить до relay "+gi+": "+b.why; continue; } srv={dev:f.dev,pool:p}; break; } }
      if(srv){ const sb=snoopBlock(e,d,ifc); if(sb){ why=sb; continue; } const ip=allocate(N.dev[srv.dev],srv.pool,pcName); if(ip) for(const h of e.path||[]){ const sw=N.dev[h.dev]; const sp=sw&&sw.snoop; if(sp&&sp.on&&sp.vlans.includes(h.v)&&h.inp&&isPhys(h.inp)) sp.bind[pcMac]={mac:pcMac,ip,vlan:h.v,port:h.inp}; } if(!ip) return {ok:false,why:"Пул "+srv.pool.name+" на "+srv.dev+" вичерпано або всі адреси виключено"}; { const cid=("01"+pcMac.replace(/\./g,"")).match(/.{1,4}/g).join("."); const via=N.dev[srv.dev]===d?" on interface "+longIf(e.ifn):" through relay "+gi; N.dbgDhcp(srv.dev,["DHCPD: DHCPDISCOVER received from client "+cid+via+".","DHCPD: Allocate an address without class information ("+ip+")","DHCPD: Sending DHCPOFFER to client "+cid+" ("+ip+").","DHCPD: DHCPREQUEST received from client "+cid+".","DHCPD: Sending DHCPACK to client "+cid+" ("+ip+")."]); }
      Object.assign(pc,{ip,mask:srv.pool.mask,gw:srv.pool.gw||null,dns:srv.pool.dns||null,opt43:srv.pool.opt43||null,dhcpSrv:N.dev[srv.dev]===d?gi:(ifc.helper[0])}); return {ok:true}; }
    }
    pc.ip=null; return {ok:false,why:why||"Жоден DHCP-сервер не відповів у цьому сегменті: на шлюзі немає пулу для цієї мережі і не задано ip helper-address"}; };
  N.release=pcName=>{ const pc=N.dev[pcName]; const mac=macOf(pcName,"Fa0"); for(const d of Object.values(N.dev)) if(d.snoop&&d.snoop.bind) delete d.snoop.bind[mac]; for(const d of Object.values(N.dev)) if(!isHost(d)&&d.dhcp) for(const [ip,b] of Object.entries(d.dhcp.bind)) if(b.client===pcName) delete d.dhcp.bind[ip]; pc.ip=null; pc.mask=null; pc.gw=null; };
  N.cdpNbrs=(dn)=>{ const s=N.dev[dn]; const R=[]; if(!s||isHost(s)) return R;
    for(const l of N.links){ let me,ot,po; if(l.a===dn){me=l.pa;ot=l.b;po=l.pb;} else if(l.b===dn){me=l.pb;ot=l.a;po=l.pa;} else continue;
      const od=N.dev[ot]; if(isHost(od)||od.type==="hub"||(s.svc&&s.svc.cdp===false)||s.ifs[me].cdpOff||(od.svc&&od.svc.cdp===false)||(od.ifs[po]&&od.ifs[po].cdpOff)||s.ifs[me].shutdown||(od.ifs[po]&&od.ifs[po].shutdown)) continue;
      R.push({dev:ot,me,po,type:od.type,l3:!!od.l3}); } return R; };
  N.mgmtIp=(dn)=>{ const d=N.dev[dn]; if(!d) return null; const ifs=Object.values(d.ifs).filter(i=>i.ip&&!i.shutdown); const v=ifs.find(i=>i.svi)||ifs.find(i=>i.loop)||ifs[0]; return v?v.ip:null; };
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
