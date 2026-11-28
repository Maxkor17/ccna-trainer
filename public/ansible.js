// Лаба автоматизації ENSA14: Ansible-плейбуки на пристроях симулятора.
// Підтримує підмножину YAML, модулі cisco.ios.ios_command / ios_config, debug, змінні, loop і register.
(function(){
// ---------- Підмножина YAML ----------
function yamlScalar(v){ v=v.trim(); if(v==="") return null;
  if(/^".*"$/.test(v)||/^'.*'$/.test(v)) return v.slice(1,-1);
  if(/^\[.*\]$/.test(v)){ const body=v.slice(1,-1).trim(); return body? splitTop(body).map(yamlScalar) : []; }
  if(/^\{.*\}$/.test(v)){ const o={}; const body=v.slice(1,-1).trim(); if(body) for(const kv of splitTop(body)){ const i=kv.indexOf(":"); if(i<0) throw new Error("очікувалося «ключ: значення» у "+v); o[kv.slice(0,i).trim()]=yamlScalar(kv.slice(i+1)); } return o; }
  if(/^(true|yes)$/i.test(v)) return true; if(/^(false|no)$/i.test(v)) return false;
  if(/^-?\d+$/.test(v)) return Number(v); return v; }
function splitTop(s){ const out=[]; let d=0, q=null, cur=""; for(const c of s){ if(q){ cur+=c; if(c===q) q=null; continue; } if(c==='"'||c==="'"){ q=c; cur+=c; continue; } if(c==="["||c==="{") d++; if(c==="]"||c==="}") d--; if(c===","&&d===0){ out.push(cur.trim()); cur=""; continue; } cur+=c; } if(cur.trim()) out.push(cur.trim()); return out; }
function stripComment(t){ let q=null; for(let i=0;i<t.length;i++){ const c=t[i]; if(q){ if(c===q) q=null; continue; } if(c==='"'||c==="'") q=c; else if(c==="#"&&(i===0||/\s/.test(t[i-1]))) return t.slice(0,i); } return t; }
function parseYaml(src){
  const L=[]; src.split("\n").forEach((raw,n)=>{ if(/\t/.test(raw.match(/^\s*/)[0])) throw new Error("рядок "+(n+1)+": YAML не допускає табуляцію у відступах — лише пробіли"); const t=stripComment(raw).replace(/\s+$/,""); if(!t.trim()||t.trim()==="---") return; L.push({ind:t.match(/^ */)[0].length,text:t.trim(),n:n+1}); });
  let i=0;
  const keyRe=/^([^\s:"'][^:]*?|"[^"]*"|'[^']*'):(\s+(.*))?$/;
  function block(ind){ return L[i].text==="-"||L[i].text.startsWith("- ")? list(ind) : map(ind); }
  function list(ind){ const out=[]; while(i<L.length&&L[i].ind===ind&&(L[i].text==="-"||L[i].text.startsWith("- "))){ const rest=L[i].text.slice(1).trim();
      if(!rest){ i++; out.push(i<L.length&&L[i].ind>ind? block(L[i].ind) : null); }
      else if(keyRe.test(rest)&&!/^["'\[{]/.test(rest)){ L[i]={ind:ind+2,text:rest,n:L[i].n}; out.push(map(ind+2)); }
      else { out.push(yamlScalar(rest)); i++; } }
    if(i<L.length&&L[i].ind>ind) throw new Error("рядок "+L[i].n+": неочікуваний відступ"); return out; }
  function map(ind){ const o={}; while(i<L.length&&L[i].ind===ind&&!(L[i].text==="-"||L[i].text.startsWith("- "))){ const ln=L[i]; const m=ln.text.match(keyRe); if(!m) throw new Error("рядок "+ln.n+": очікувалося «ключ: значення», а є «"+ln.text+"»");
      const k=m[1].replace(/^["']|["']$/g,""); i++;
      if(m[3]!==undefined&&m[3]!==""){ if(m[3]==="|"||m[3]===">"){ const parts=[]; while(i<L.length&&L[i].ind>ind){ parts.push(L[i].text); i++; } o[k]=parts.join(m[3]==="|"?"\n":" "); } else o[k]=yamlScalar(m[3]); }
      else if(i<L.length&&L[i].ind>ind) o[k]=block(L[i].ind);
      else if(i<L.length&&L[i].ind===ind&&(L[i].text==="-"||L[i].text.startsWith("- "))) o[k]=list(ind);
      else o[k]=null; }
    if(i<L.length&&L[i].ind>ind) throw new Error("рядок "+L[i].n+": неочікуваний відступ (перевірте вирівнювання)"); return o; }
  if(!L.length) return null; const v=block(L[0].ind); if(i<L.length) throw new Error("рядок "+L[i].n+": неправильний відступ — елемент не належить жодному блоку"); return v; }

// ---------- Мережа лаби ----------
const INVENTORY="[routers]\nR1 ansible_host=10.0.0.1\n\n[switches]\nS1 ansible_host=10.0.0.11\nS2 ansible_host=10.0.0.12\n\n[all:vars]\nansible_connection=ansible.netcommon.network_cli\nansible_network_os=cisco.ios.ios\nansible_user=admin";
const GROUPS={routers:["R1"],switches:["S1","S2"]}; GROUPS.all=GROUPS.routers.concat(GROUPS.switches);
function newLab(){ const sc={def:()=>({devices:{R1:{type:"router"},S1:{type:"switch"},S2:{type:"switch"}},links:[["R1","Gi0/0","S1","Gi0/1"],["S1","Gi0/2","S2","Gi0/1"]]})};
  const {N,ses}=CLI.startNet(sc);
  const pre={R1:["interface g0/0","ip address 10.0.0.1 255.255.255.0","no shutdown"],S1:["interface vlan 1","ip address 10.0.0.11 255.255.255.0","no shutdown"],S2:["interface vlan 1","ip address 10.0.0.12 255.255.255.0","no shutdown"]};
  for(const [d,cmds] of Object.entries(pre)){ const s=ses[d]; s.exec("enable"); s.exec("conf t"); for(const c of cmds) s.exec(c); s.exec("end"); }
  N.recompute(); return {N,ses,runs:[],done:{}}; }

// ---------- Шаблони і змінні ----------
function getPath(ctx,p){ let v=ctx; for(const k of p.split(".")){ if(v==null) return undefined; v=v[k]; } return v; }
function tpl(v,ctx){ if(typeof v==="string"){ const whole=v.match(/^\{\{\s*([\w.]+)\s*\}\}$/); if(whole){ const r=getPath(ctx,whole[1]); if(r===undefined) throw new Error("змінна «"+whole[1]+"» не визначена"); return r; }
    return v.replace(/\{\{\s*([\w.]+)\s*\}\}/g,(_,p)=>{ const r=getPath(ctx,p); if(r===undefined) throw new Error("змінна «"+p+"» не визначена"); return typeof r==="object"?JSON.stringify(r):String(r); }); }
  if(Array.isArray(v)) return v.map(x=>tpl(x,ctx)); if(v&&typeof v==="object"){ const o={}; for(const [k,x] of Object.entries(v)) o[k]=tpl(x,ctx); return o; } return v; }
const snap=d=>JSON.stringify(d,(k,v)=>k==="net"||k==="logBuf"||k==="lastCopy"||k==="saved"||k.startsWith("_")?undefined:(v instanceof Set?[...v]:v));
const MODS={"cisco.ios.ios_command":"cmd","ios_command":"cmd","cisco.ios.ios_config":"cfg","ios_config":"cfg","debug":"dbg","ansible.builtin.debug":"dbg",
  "cisco.ios.ios_vlans":"vlans","ios_vlans":"vlans","cisco.ios.ios_interfaces":"ifs","ios_interfaces":"ifs","cisco.ios.ios_l2_interfaces":"l2","ios_l2_interfaces":"l2"};
// Resource-модулі описують бажаний стан (config + state), а модуль сам перетворює його на команди: [[parents],[lines]]
function resGroups(kind,a){ const cfg=a&&a.config; const state=(a&&a.state)||"merged";
  if(!["merged","deleted"].includes(state)) throw new Error("state: "+state+" — у лабі підтримуються merged і deleted");
  if(!Array.isArray(cfg)||!cfg.length) throw new Error("missing required arguments: config (список об'єктів)");
  if(kind==="vlans") return cfg.map(v=>{ if(v.vlan_id==null) throw new Error("ios_vlans: у кожному елементі потрібен vlan_id"); return state==="deleted"?[[],["no vlan "+v.vlan_id]]:[["vlan "+v.vlan_id],v.name?["name "+v.name]:[]]; });
  return cfg.map(c=>{ if(!c.name) throw new Error("ios_"+(kind==="ifs"?"interfaces":"l2_interfaces")+": у кожному елементі потрібен name"); const P=["interface "+c.name], L=[];
    if(kind==="ifs"){ if(state==="deleted") return [P,["no description"]]; if(c.description!=null) L.push("description "+c.description); if(c.enabled===false) L.push("shutdown"); if(c.enabled===true) L.push("no shutdown"); return [P,L]; }
    if(state==="deleted") return [P,["no switchport mode","no switchport access vlan","no switchport trunk native vlan"]];
    if(c.mode) L.push("switchport mode "+c.mode); if(c.access&&c.access.vlan!=null) L.push("switchport access vlan "+c.access.vlan);
    if(c.trunk){ if(c.trunk.native_vlan!=null) L.push("switchport trunk native vlan "+c.trunk.native_vlan); if(c.trunk.allowed_vlans!=null) L.push("switchport trunk allowed vlan "+[].concat(c.trunk.allowed_vlans).join(",")); }
    return [P,L]; }); }
// --diff: які рядки running-config з'явилися (+) або зникли (-), з контекстом секції
function cfgDiff(a,b){ const sec=t=>{ const m=new Map(); let cur=""; for(const l of t.split("\n")){ if(!l.trim()||l.trim()==="!"||/^Building|^Current configuration/.test(l)) continue; if(/^\S/.test(l)){ cur=l.trim(); if(!m.has(cur)) m.set(cur,new Set()); } else if(cur) m.get(cur).add(l.trim()); } return m; };
  const A=sec(a), B=sec(b), out=[];
  for(const [h,ls] of B){ if(!A.has(h)){ out.push("+ "+h); for(const l of ls) out.push("+   "+l); continue; } const add=[...ls].filter(l=>!A.get(h).has(l)), del=[...A.get(h)].filter(l=>!ls.has(l)); if(add.length||del.length){ out.push("  "+h); for(const l of del) out.push("-   "+l); for(const l of add) out.push("+   "+l); } }
  for(const [h,ls] of A) if(!B.has(h)){ out.push("- "+h); for(const l of ls) out.push("-   "+l); }
  return out; }
// VLAN зберігаються у vlan.dat, а не в running-config — тому diff для них будуємо окремо
function vlanDiff(a,b){ const out=[]; for(const [id,v] of Object.entries(b)){ if(!a[id]){ out.push("+ vlan "+id); if(v.name) out.push("+   name "+v.name); } else if((a[id].name||"")!==(v.name||"")){ out.push("  vlan "+id); out.push("-   name "+(a[id].name||"")); out.push("+   name "+(v.name||"")); } }
  for(const id of Object.keys(a)) if(!b[id]) out.push("- vlan "+id+(a[id].name?" ("+a[id].name+")":"")); return out; }
function shadow(lab){ const N=CLI.netFromSaved(CLI.saveNet(lab.N)); N.recompute(); return {N,ses:CLI.sessionsFor(N),runs:[],done:{}}; }

function run(lab0,src,opt){ opt=opt||{}; const lab=opt.check?shadow(lab0):lab0;
  const out=[]; const st={}; const usage={cmd:0,cfg:0,dbg:0,vlans:0,ifs:0,l2:0,loop:0,reg:0,dbgReg:0,save:0,cfgHosts:new Set(),hosts:new Set()}; let changedTot=0, okTot=0, failed=0;
  const stars=s=>s+" "+"*".repeat(Math.max(3,60-s.length));
  let book; try{ book=parseYaml(src); }catch(e){ return {text:"ERROR! We were unable to read either as JSON nor YAML:\n  "+e.message,ok:false,error:true}; }
  if(!Array.isArray(book)) return {text:"ERROR! A playbook must be a list of plays (кожна п'єса починається з «- name: …» або «- hosts: …»)",ok:false,error:true};
  for(const play of book){
    if(!play||typeof play!=="object"||!play.hosts) return {text:out.concat(["ERROR! the field 'hosts' is required but was not set"]).join("\n"),ok:false,error:true};
    const pat=String(play.hosts); const hosts=[]; for(const p of pat.split(/[,:]/).map(x=>x.trim()).filter(Boolean)){ const g=GROUPS[p]||(lab.N.dev[p]&&GROUPS.all.includes(p)?[p]:null); if(g) g.forEach(h=>{ if(!hosts.includes(h)) hosts.push(h); }); }
    out.push(""); out.push(stars("PLAY ["+(play.name||pat)+"]"));
    if(!hosts.length){ out.push("skipping: no hosts matched"); continue; }
    if(play.gather_facts!==false&&play.gather_facts!=="no") out.push("","[WARNING]: gather_facts для мережевих пристроїв зайвий — додайте gather_facts: false");
    const pvars=play.vars||{}; const reg={}; hosts.forEach(h=>{ reg[h]={}; st[h]=st[h]||{ok:0,changed:0,failed:0,skipped:0,unreachable:0}; usage.hosts.add(h); });
    const live=new Set(hosts);
    for(const task of play.tasks||[]){
      const key=Object.keys(task).find(k=>MODS[k]); out.push(""); out.push(stars("TASK ["+(task.name||key||"?")+"]"));
      if(!key){ out.push("ERROR! невідомий модуль у задачі: "+Object.keys(task).filter(k=>!["name","register","loop","when"].includes(k)).join(", ")+" (доступні: cisco.ios.ios_command, ios_config, ios_vlans, ios_interfaces, ios_l2_interfaces, debug)"); return {text:out.join("\n"),ok:false,error:true}; }
      const kind=MODS[key]; usage[kind]++; if(task.loop) usage.loop++; if(task.register) usage.reg++;
      for(const h of hosts){ if(!live.has(h)) continue; const d=lab.N.dev[h], ses=lab.ses[h];
        const base=Object.assign({inventory_hostname:h,ansible_host:{R1:"10.0.0.1",S1:"10.0.0.11",S2:"10.0.0.12"}[h]},pvars,reg[h]);
        let items=[undefined]; if(task.loop!=null){ try{ items=tpl(task.loop,base); }catch(e){ out.push(`fatal: [${h}]: FAILED! => {"msg": "${e.message}"}`); st[h].failed++; failed++; live.delete(h); continue; } if(!Array.isArray(items)){ out.push(`fatal: [${h}]: FAILED! => {"msg": "loop очікує список"}`); st[h].failed++; failed++; live.delete(h); continue; } }
        let anyCh=false, fail=null; const results=[]; const lines=[];
        for(const item of items){ const ctx=item===undefined?base:Object.assign({},base,{item}); let args; try{ args=tpl(task[key]||{},ctx); }catch(e){ fail=e.message; break; }
          const it=item===undefined?"":` => (item=${typeof item==="object"?JSON.stringify(item):item})`;
          if(kind==="dbg"){ if(args&&args.var){ const v=getPath(ctx,args.var); if(args.var.split(".")[0] in reg[h]) usage.dbgReg++; lines.push(`ok: [${h}]${it} => {\n    "${args.var}": ${JSON.stringify(v===undefined?"VARIABLE IS NOT DEFINED!":v,null,4).replace(/\n/g,"\n    ")}\n}`); }
            else lines.push(`ok: [${h}]${it} => {\n    "msg": ${JSON.stringify(args&&args.msg!=null?args.msg:"Hello world!")}\n}`); continue; }
          ses.exec("end"); ses.exec("enable");
          if(kind==="cmd"){ const cmds=args&&args.commands; if(!cmds){ fail="missing required arguments: commands"; break; } const stdout=[];
            for(const c of [].concat(cmds)){ const cs=String(c); if(/^\s*(conf|configure)\b/i.test(cs)){ fail="ios_command не виконує конфігураційні команди — використайте ios_config"; break; } const r=ses.exec(cs); if(/% Invalid|% Incomplete|% Ambiguous/.test(r)){ fail="command "+cs+": "+r.trim().split("\n")[0]; break; } stdout.push(r.replace(/^\n+/,"")); }
            if(fail) break; results.push({stdout,stdout_lines:stdout.map(x=>x.split("\n")),changed:false}); lines.push(`ok: [${h}]${it}`); continue; }
          // ios_config і resource-модулі
          let groups, L0=[], parents=[];
          if(kind==="cfg"){ L0=args&&args.lines!=null?[].concat(args.lines).flatMap(x=>String(x).split("\n")).map(x=>x.trim()).filter(Boolean):[]; parents=args&&args.parents!=null?[].concat(args.parents).map(String):[];
            if(!L0.length&&!(args&&args.save_when)){ fail="ios_config: потрібен параметр lines"; break; } groups=[[parents,L0]]; }
          else { try{ groups=resGroups(kind,args); }catch(e){ fail=e.message; break; } L0=groups.flatMap(g=>g[1]); }
          const before=snap(d); const rb=opt.diff?ses.exec("show running-config"):""; const vb=JSON.parse(JSON.stringify(d.vlans||{})); let err=null;
          for(const [P,Ls] of groups){ ses.exec("conf t"); for(const c of P.concat(Ls)){ const r=ses.exec(c); if(/^%\s/m.test(r)){ err=c+": "+r.split("\n").find(x=>/^%\s/.test(x)).trim(); break; } } ses.exec("end"); if(err) break; }
          lab.N.recompute(); if(err){ fail=err; break; }
          let ch=snap(d)!==before; const sw=args&&args.save_when;
          if(sw==="always"||(sw==="modified"&&(ch||snap(d.saved||{})!==snap(Object.assign({},d,{saved:false}))))){ const pre=snap(d.saved||{}); ses.exec("write memory"); if(snap(d.saved||{})!==pre) ch=true; usage.save++; }
          if(L0.length) usage.cfgHosts.add(h);
          const dfl=ch&&opt.diff?vlanDiff(vb,d.vlans||{}).concat(cfgDiff(rb,ses.exec("show running-config"))).map(x=>"    "+x):[];
          if(ch) anyCh=true; results.push({changed:ch,commands:ch?groups.flatMap(g=>g[0].concat(g[1])):[]}); lines.push(`${ch?"changed":"ok"}: [${h}]${it}`,...dfl); }
        if(fail){ out.push(...lines); out.push(`fatal: [${h}]: FAILED! => {"changed": false, "msg": ${JSON.stringify(fail)}}`); st[h].failed++; failed++; live.delete(h); continue; }
        out.push(...lines);
        if(task.register){ reg[h][task.register]= items.length>1||task.loop!=null? {changed:anyCh,results} : Object.assign({},results[0]||{changed:false}); }
        if(kind!=="dbg"&&anyCh){ st[h].changed++; changedTot++; } st[h].ok++; okTot++; }
    }
  }
  out.push(""); out.push(stars("PLAY RECAP"));
  for(const [h,s] of Object.entries(st)) out.push(`${h.padEnd(26)}: ok=${s.ok}    changed=${s.changed}    unreachable=${s.unreachable}    failed=${s.failed}    skipped=${s.skipped}    rescued=0    ignored=0`);
  if(opt.check) out.push("","[check mode] Пристрої не змінено: показано, що змінилося б (changed) — так перевіряють плейбук перед продакшеном.");
  const res={text:out.join("\n").replace(/^\n/,""),ok:failed===0,changed:changedTot,okTot,failed,usage,check:!!opt.check};
  lab0.runs.push({check:!!opt.check,diff:!!opt.diff,res:usage.vlans+usage.ifs+usage.l2,ok:res.ok,changed:changedTot,okTot,cfg:usage.cfg+usage.vlans+usage.ifs+usage.l2,cfgHosts:[...usage.cfgHosts],usage:{loop:usage.loop,reg:usage.reg,dbgReg:usage.dbgReg,cmd:usage.cmd,save:usage.save,vlans:usage.vlans,ifs:usage.ifs,l2:usage.l2},hosts:[...usage.hosts]});
  return res; }

const VL=(N,d,v,n)=>!!N.dev[d].vlans&&!!N.dev[d].vlans[v]&&String(N.dev[d].vlans[v].name||"").toUpperCase()===n;
const TASKS=[
 {id:"cmd",t:"Перший плейбук: на групі routers виконайте show ip interface brief модулем cisco.ios.ios_command (gather_facts: false).",ok:L=>L.runs.some(r=>r.ok&&r.usage.cmd>0&&r.hosts.includes("R1"))},
 {id:"vlans",t:"На групі switches створіть VLAN 30 GUEST і VLAN 40 VOICE одним завданням ios_config: список VLAN — у vars, перебір — через loop (parents: \"vlan {{ item.id }}\", lines: \"name {{ item.name }}\").",ok:L=>["S1","S2"].every(d=>VL(L.N,d,30,"GUEST")&&VL(L.N,d,40,"VOICE"))&&L.runs.some(r=>r.ok&&r.usage.loop>0)},
 {id:"idem",t:"Ідемпотентність: запустіть той самий плейбук ще раз — у PLAY RECAP має бути changed=0 (Ansible не змінює те, що вже налаштовано).",ok:L=>{ const R=L.runs.filter(r=>!r.check); const i=R.findIndex(r=>r.ok&&r.changed>0&&r.cfg>0); return i>=0&&R.slice(i+1).some(r=>r.ok&&r.cfg>0&&r.changed===0); }},
 {id:"ntp",t:"На всіх пристроях (hosts: all) налаштуйте ntp server 10.1.1.123 і збережіть конфігурацію лише за наявності змін: save_when: modified.",ok:L=>GROUPS.all.every(d=>((L.N.dev[d].svc||{}).ntp||[]).includes("10.1.1.123")&&L.N.dev[d].saved&&(((L.N.dev[d].saved.svc||{}).ntp)||[]).includes("10.1.1.123"))},
 {id:"res",t:"Resource-модулі: модулем cisco.ios.ios_vlans (state: merged) створіть на switches VLAN 50 MGMT і VLAN 60 CAMERAS, а потім тим самим модулем зі state: deleted видаліть VLAN 60. Ви описуєте бажаний стан — команди модуль генерує сам.",ok:L=>["S1","S2"].every(d=>VL(L.N,d,50,"MGMT")&&!(L.N.dev[d].vlans||{})[60])&&L.runs.some(r=>r.ok&&!r.check&&r.usage.vlans>0)},
 {id:"l2",t:"Модулем cisco.ios.ios_interfaces задайте на switches опис (description) аплінку GigabitEthernet0/1, а модулем ios_l2_interfaces зробіть цей порт trunk з native VLAN 99.",ok:L=>["S1","S2"].every(d=>{ const i=L.N.dev[d].ifs["Gi0/1"]; return !!i.desc&&i.mode==="trunk"&&i.nativeVlan===99; })&&L.runs.some(r=>r.ok&&!r.check&&r.usage.ifs>0)&&L.runs.some(r=>r.ok&&!r.check&&r.usage.l2>0)},
 {id:"check",t:"Перед зміною запустіть плейбук із --check --diff: Ansible покаже, що змінилося б (рядки + / −), але пристрої не зміняться. Потім запустіть без --check.",ok:L=>{ const i=L.runs.findIndex(r=>r.check&&r.diff&&r.ok&&r.changed>0); return i>=0&&L.runs.slice(i+1).some(r=>!r.check&&r.ok&&r.changed>0); }},
 {id:"reg",t:"Збережіть вивід show vlan brief з комутаторів у змінну (register: vlans_out) і покажіть його модулем debug (var: vlans_out.stdout_lines).",ok:L=>L.runs.some(r=>r.ok&&r.usage.reg>0&&r.usage.dbgReg>0)}];

const SAMPLE=`---
- name: Перевірка маршрутизаторів
  hosts: routers
  gather_facts: false
  tasks:
    - name: Інтерфейси
      cisco.ios.ios_command:
        commands:
          - show ip interface brief
`;
window.ANSIBLE={parseYaml,newLab,run,TASKS,INVENTORY,SAMPLE,GROUPS,cfgDiff,resGroups};
})();
