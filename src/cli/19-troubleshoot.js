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


