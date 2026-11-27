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

window.CLI={discoverTruth,discoverParse,figOf,netFromSaved,saveNet,sessionsFor,freePorts,Net,SCEN,NETSCEN,startNet,solveNet,troubleshoot,startScenario,Session,newState,normIf,parseList};
})();
