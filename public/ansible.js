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
const MODS={"cisco.ios.ios_command":"cmd","ios_command":"cmd","cisco.ios.ios_config":"cfg","ios_config":"cfg","debug":"dbg","ansible.builtin.debug":"dbg"};

function run(lab,src){
  const out=[]; const st={}; const usage={cmd:0,cfg:0,dbg:0,loop:0,reg:0,dbgReg:0,save:0,cfgHosts:new Set(),hosts:new Set()}; let changedTot=0, okTot=0, failed=0;
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
      if(!key){ out.push("ERROR! невідомий модуль у задачі: "+Object.keys(task).filter(k=>!["name","register","loop","when"].includes(k)).join(", ")+" (доступні: cisco.ios.ios_command, cisco.ios.ios_config, debug)"); return {text:out.join("\n"),ok:false,error:true}; }
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
          // ios_config
          const L0=args&&args.lines!=null?[].concat(args.lines).flatMap(x=>String(x).split("\n")).map(x=>x.trim()).filter(Boolean):[]; const parents=args&&args.parents!=null?[].concat(args.parents).map(String):[];
          if(!L0.length&&!(args&&args.save_when)){ fail="ios_config: потрібен параметр lines"; break; }
          const before=snap(d); ses.exec("conf t"); let err=null;
          for(const c of parents.concat(L0)){ const r=ses.exec(c); if(/^%\s/m.test(r)){ err=c+": "+r.split("\n").find(x=>/^%\s/.test(x)).trim(); break; } }
          ses.exec("end"); lab.N.recompute(); if(err){ fail=err; break; }
          let ch=snap(d)!==before; const sw=args&&args.save_when;
          if(sw==="always"||(sw==="modified"&&(ch||snap(d.saved||{})!==snap(Object.assign({},d,{saved:false}))))){ const pre=snap(d.saved||{}); ses.exec("write memory"); if(snap(d.saved||{})!==pre) ch=true; usage.save++; }
          if(L0.length) usage.cfgHosts.add(h);
          if(ch) anyCh=true; results.push({changed:ch,commands:ch?parents.concat(L0):[]}); lines.push(`${ch?"changed":"ok"}: [${h}]${it}`); }
        if(fail){ out.push(...lines); out.push(`fatal: [${h}]: FAILED! => {"changed": false, "msg": ${JSON.stringify(fail)}}`); st[h].failed++; failed++; live.delete(h); continue; }
        out.push(...lines);
        if(task.register){ reg[h][task.register]= items.length>1||task.loop!=null? {changed:anyCh,results} : Object.assign({},results[0]||{changed:false}); }
        if(kind!=="dbg"&&anyCh){ st[h].changed++; changedTot++; } st[h].ok++; okTot++; }
    }
  }
  out.push(""); out.push(stars("PLAY RECAP"));
  for(const [h,s] of Object.entries(st)) out.push(`${h.padEnd(26)}: ok=${s.ok}    changed=${s.changed}    unreachable=${s.unreachable}    failed=${s.failed}    skipped=${s.skipped}    rescued=0    ignored=0`);
  const res={text:out.join("\n").replace(/^\n/,""),ok:failed===0,changed:changedTot,okTot,failed,usage};
  lab.runs.push({ok:res.ok,changed:changedTot,okTot,cfg:usage.cfg,cfgHosts:[...usage.cfgHosts],usage:{loop:usage.loop,reg:usage.reg,dbgReg:usage.dbgReg,cmd:usage.cmd,save:usage.save},hosts:[...usage.hosts]});
  return res; }

const VL=(N,d,v,n)=>!!N.dev[d].vlans&&!!N.dev[d].vlans[v]&&String(N.dev[d].vlans[v].name||"").toUpperCase()===n;
const TASKS=[
 {id:"cmd",t:"Перший плейбук: на групі routers виконайте show ip interface brief модулем cisco.ios.ios_command (gather_facts: false).",ok:L=>L.runs.some(r=>r.ok&&r.usage.cmd>0&&r.hosts.includes("R1"))},
 {id:"vlans",t:"На групі switches створіть VLAN 30 GUEST і VLAN 40 VOICE одним завданням ios_config: список VLAN — у vars, перебір — через loop (parents: \"vlan {{ item.id }}\", lines: \"name {{ item.name }}\").",ok:L=>["S1","S2"].every(d=>VL(L.N,d,30,"GUEST")&&VL(L.N,d,40,"VOICE"))&&L.runs.some(r=>r.ok&&r.usage.loop>0)},
 {id:"idem",t:"Ідемпотентність: запустіть той самий плейбук ще раз — у PLAY RECAP має бути changed=0 (Ansible не змінює те, що вже налаштовано).",ok:L=>{ const i=L.runs.findIndex(r=>r.ok&&r.changed>0&&r.cfg>0); return i>=0&&L.runs.slice(i+1).some(r=>r.ok&&r.cfg>0&&r.changed===0); }},
 {id:"ntp",t:"На всіх пристроях (hosts: all) налаштуйте ntp server 10.1.1.123 і збережіть конфігурацію лише за наявності змін: save_when: modified.",ok:L=>GROUPS.all.every(d=>((L.N.dev[d].svc||{}).ntp||[]).includes("10.1.1.123")&&L.N.dev[d].saved&&(((L.N.dev[d].saved.svc||{}).ntp)||[]).includes("10.1.1.123"))},
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
window.ANSIBLE={parseYaml,newLab,run,TASKS,INVENTORY,SAMPLE,GROUPS};
})();
