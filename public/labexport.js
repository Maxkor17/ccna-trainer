// Експорт лаби для справжнього IOS: zip із топологією containerlab (Cisco IOL), початковими конфігами,
// мапою інтерфейсів і рішенням. Ті самі конфіги підходять для GNS3/EVE-NG/CML (див. README у архіві).
(function(){
// ---------- мінімальний ZIP (метод store, без стиснення) ----------
const CRC=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0; } return t; })();
const crc32=b=>{ let c=0xFFFFFFFF; for(let i=0;i<b.length;i++) c=CRC[(c^b[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
function zip(files){ const enc=new TextEncoder(); const parts=[], central=[]; let off=0;
  const u16=v=>[v&255,(v>>>8)&255], u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
  for(const [name,text] of files){ const nb=enc.encode(name), data=enc.encode(text), c=crc32(data);
    const loc=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(c),...u32(data.length),...u32(data.length),...u16(nb.length),...u16(0)]);
    parts.push(loc,nb,data);
    central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(c),...u32(data.length),...u32(data.length),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nb);
    off+=loc.length+nb.length+data.length; }
  const cs=central.reduce((a,x)=>a+x.length,0);
  const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cs),...u32(off),...u16(0)]);
  return new Blob([...parts,...central,end],{type:"application/zip"}); }
// ---------- мапа інтерфейсів: порти симулятора → Ethernet0/1… в IOL (Ethernet0/0 — керування) ----------
const IOL=k=>"Ethernet"+Math.floor(k/4)+"/"+(k%4);
function portMap(N){ const M={}; for(const n of Object.keys(N.dev)) M[n]={};
  const next={}; const take=n=>{ next[n]=next[n]||1; return IOL(next[n]++); };
  for(const l of N.links){ for(const [d,p] of [[l.a,l.pa],[l.b,l.pb]]){ const t=N.dev[d].type; if(t==="pc"||t==="server"){ M[d][p]="eth"+((Object.keys(M[d]).length)+1); } else if(!M[d][p]) M[d][p]=take(d); } }
  return M; }
const IFRE=/\b((?:gigabitethernet|fastethernet|gig|gi|g|fa|f|port-channel|po|ethernet|eth|e)\s?\d+\/\d+(?:\.\d+)?)\b/gi;
function mapIf(tok,map){ const n=CLI.normIf(tok.replace(/\s+/g,"")); if(!n) return null; const [base,sub]=n.split("."); const m=map[base]; return m? m+(sub?"."+sub:"") : null; }
function rewriteConfig(text,map){ const out=[]; let skip=false;
  for(const line of text.split("\n")){
    if(/^interface /.test(line)){ const name=line.slice(10).trim(); if(/^(Vlan|Loopback|Tunnel|Port-channel)/i.test(name)){ skip=false; out.push(line); continue; }
      const m=mapIf(name,map); if(!m){ skip=true; continue; } skip=false; out.push("interface "+m); continue; }
    if(skip){ if(/^ /.test(line)) continue; skip=false; }
    let miss=false; const nl=line.replace(IFRE,t=>{ const x=mapIf(t,map); if(!x&&/^(g|f)/i.test(t)) miss=true; return x||t; }); out.push(miss? "! "+line.trim()+"  (порту немає в топології IOL)" : nl); }
  return out.join("\n"); }
function rewriteCmd(line,map,isL2){ const t=line.trim();
  const r=t.match(/^interface\s+range\s+(.+)$/i);
  if(r){ const items=[]; for(const part of r[1].split(",")){ const m=part.trim().match(/^([a-z-]+)\s*(\d+)\/(\d+)(?:\s*-\s*(\d+))?$/i); if(!m) continue; for(let k=Number(m[3]);k<=Number(m[4]||m[3]);k++){ const x=mapIf(m[1]+m[2]+"/"+k,map); if(x) items.push(x); } }
    return items.length? ["interface range "+items.join(" , ")] : ["! "+t+"  (цих портів немає в топології IOL — пропущено)"]; }
  const i=t.match(/^interface\s+(.+)$/i); if(i&&!/^(vlan|lo|loopback|tu|tunnel|po|port-channel)/i.test(i[1].trim())){ const x=mapIf(i[1],map); return x? ["interface "+x] : ["! "+t+"  (порту немає в топології IOL)"]; }
  let miss=false; const out=[line.replace(IFRE,tok=>{ const x=mapIf(tok,map); if(!x&&/^(g|f)/i.test(tok)) miss=true; return x||tok; })]; if(miss) return ["! "+t+"  (порту немає в топології IOL)"];
  if(isL2&&/^\s*switchport mode trunk/i.test(t)) out.unshift(line.replace(/switchport mode trunk.*/i,"switchport trunk encapsulation dot1q"));
  return out; }
function pcCmd(c){ return c.replace(/^ipconfig \/renew$/i,"udhcpc -i eth1 -q").replace(/^ipconfig \/release$/i,"ip addr flush dev eth1").replace(/^ipconfig( \/all)?$/i,"ip addr show eth1; ip route").replace(/^tracert /i,"traceroute ").replace(/^ping (\S+)$/i,"ping -c 4 $1"); }
function build(sc,N0){ const N=N0||CLI.startNet(sc).N; const map=portMap(N); const id=sc.id; const files=[]; const nodes=[], links=[];
  const pcs=Object.keys(N.dev).filter(d=>/^(pc|server)$/.test(N.dev[d].type));
  for(const [d,dev] of Object.entries(N.dev)){ if(dev.type==="hub") continue;
    if(dev.type==="pc"||dev.type==="server"){ const ex=[]; if(dev.ip){ ex.push("ip addr add "+dev.ip+"/"+(dev.mask?dev.mask.split(".").reduce((a,o)=>a+((Number(o)>>>0).toString(2).match(/1/g)||[]).length,0):24)+" dev eth1"); if(dev.gw) ex.push("ip route replace default via "+dev.gw); } else if(dev.dhcp) ex.push("udhcpc -i eth1 -q");
      nodes.push("    "+d+":\n      kind: linux\n      image: ghcr.io/hellt/network-multitool\n"+(ex.length?"      exec:\n"+ex.map(x=>"        - "+x).join("\n")+"\n":"")); continue; }
    const l2=dev.type==="switch"; const s=CLI.Session(dev); s.exec("end"); s.exec("enable"); let run=s.exec("show running-config");
    run=run.replace(/^Building configuration\.\.\.\s*\n+Current configuration : \d+ bytes\n/,"").replace(/\nend\s*$/,"\n").replace(/^version .*\n/m,"");
    if(l2){ const vl=Object.entries(dev.vlans||{}).filter(([v])=>Number(v)>1&&(Number(v)<1002||Number(v)>1005)).map(([v,x])=>"vlan "+v+((x&&x.name)?"\n name "+x.name:"")); if(vl.length) run=vl.join("\n")+"\n!\n"+run; }
    files.push(["configs/"+d+".cfg.partial","! Початкова конфігурація "+d+" з лаби «"+sc.title+"»\n! Порти перейменовано за мапою з README.md\n"+rewriteConfig(run,map[d]).replace(/(\n!)+(?=\n)/g,"\n!").replace(/interface (Ethernet\d+\/\d+)\n(?=(interface|!))/g,(m,x)=>"interface "+x+"\n no shutdown\n")+(l2?"":"")+"\nend\n"]);
    nodes.push("    "+d+":\n      kind: cisco_iol\n      image: vrnetlab/cisco_iol:"+(l2?"L2-17.12.01\n      type: L2":"17.12.01")+"\n      startup-config: configs/"+d+".cfg.partial\n"); }
  for(const l of N.links){ const ea=map[l.a][l.pa], eb=map[l.b][l.pb]; if(ea&&eb) links.push('    - endpoints: ["'+l.a+':'+ea+'", "'+l.b+':'+eb+'"]'); }
  files.unshift(["topology.clab.yml","# containerlab: sudo containerlab deploy -t topology.clab.yml\n# Образи Cisco IOL збирають з vrnetlab (власний файл образу потрібен); вузли ПК — network-multitool.\nname: ccna-"+id+"\ntopology:\n  nodes:\n"+nodes.join("")+"  links:\n"+links.join("\n")+"\n"]);
  // рішення з перейменованими портами
  const sol=[]; let cur=null;
  for(const raw of String(sc.sol||"").split("\n")){ const m=raw.trim().match(/^([\w-]+):$/); if(m&&N.dev[m[1]]){ cur=m[1]; sol.push("","### "+cur,""); continue; } if(!cur){ if(raw.trim()) sol.push(raw); continue; }
    const dev=N.dev[cur]; if(/^(pc|server)$/.test(dev.type)) sol.push(pcCmd(raw.trim())); else sol.push(...rewriteCmd(raw,map[cur],dev.type==="switch")); }
  files.push(["solution.md","# Рішення: "+sc.title+"\n\nПорти вже перейменовано під Cisco IOL. Для комутаторів IOL-L2 перед `switchport mode trunk` додано `switchport trunk encapsulation dot1q`.\n\n```\n"+sol.join("\n").trim()+"\n```\n"]);
  const rows=[]; for(const [d,m] of Object.entries(map)) for(const [p,e] of Object.entries(m)) rows.push("| "+d+" | "+p+" | "+e+" |");
  files.unshift(["README.md","# "+sc.title+"\n\nЕкспорт із CCNA тренажера для практики на справжньому IOS.\n\n## Завдання\n\n"+sc.task.map((t,i)=>(i+1)+". "+t).join("\n")+"\n\n## Схема (як у тренажері)\n\n```\n"+(sc.topo||"")+"\n```\n\n## Мапа інтерфейсів\n\nУ Cisco IOL порти називаються EthernetX/Y; Ethernet0/0 зайнятий під керування containerlab. ПК — Linux-контейнери, їхній порт — eth1.\n\n| Пристрій | Порт у тренажері | Порт у лабі |\n|---|---|---|\n"+rows.join("\n")+"\n\n## Запуск у containerlab\n\n1. Зберіть образи Cisco IOL і IOL-L2 через vrnetlab (потрібні власні файли образів, наприклад із підписки CML).\n2. `sudo containerlab deploy -t topology.clab.yml`\n3. Підключення: `ssh admin@clab-ccna-"+id+"-R1` (пароль admin) або `docker exec -it clab-ccna-"+id+"-PC1 sh`.\n4. Конфігурації в `configs/*.cfg.partial` додаються до стандартної конфігурації вузла під час першого запуску.\n\n## GNS3, EVE-NG, CML\n\nЗберіть ту саму схему вручну за таблицею портів і вставте вміст `configs/<пристрій>.cfg.partial` у консоль кожного пристрою (`configure terminal`).\n\n## Відмінності від тренажера\n\n- IOL-L2 потребує `switchport trunk encapsulation dot1q` перед `switchport mode trunk`.\n- Частина рядків конфігурації (стандартні значення) може відрізнятися за версією IOS; IOS просто проігнорує зайве.\n- Рішення — у `solution.md`; спробуйте спершу без нього.\n"]);
  return {files,zip:zip(files),name:"ccna-"+id+".zip"}; }
window.LABEXPORT={build,zip,crc32,portMap,rewriteConfig,rewriteCmd};
})();
