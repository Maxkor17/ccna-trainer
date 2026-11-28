"use strict";
// Obsidian-імпорт, резервні копії, аналітика, плутанина, мотивація. Файли app-*.js — звичайні скрипти зі спільною глобальною областю; порядок підключення див. index.html.
// ---- Імпорт карток з Obsidian (.md) ----
const KW=[[/vlan|trunk|dtp|802\.1q/i,"SRWE3"],[/inter-?vlan|router-on-a-stick|roas|svi/i,"SRWE4"],[/\bstp\b|spanning|rstp|bpdu|portfast/i,"SRWE5"],[/etherchannel|lacp|pagp/i,"SRWE6"],[/dhcpv6|slaac/i,"SRWE8"],[/dhcp/i,"SRWE7"],[/hsrp|vrrp|glbp|fhrp/i,"SRWE9"],[/port.?security|snooping|\bdai\b/i,"SRWE11"],[/wlan|wi-?fi|802\.11|capwap|wlc/i,"SRWE12"],[/static rout|статичн/i,"SRWE15"],[/ospf/i,"ENSA2"],[/\bacl|access-list|wildcard/i,"ENSA5"],[/\bnat\b|\bpat\b/i,"ENSA6"],[/vpn|ipsec|gre/i,"ENSA8"],[/qos|dscp/i,"ENSA9"],[/snmp|syslog|ntp|cdp|lldp/i,"ENSA10"],[/rest|json|yaml|ansible|sdn/i,"ENSA14"],[/ipv6/i,"ITN12"],[/subnet|підмереж|vlsm|ipv4/i,"ITN11"],[/tcp|udp|порт/i,"ITN14"],[/osi|tcp\/ip|інкапсул/i,"ITN3"],[/ethernet|mac/i,"ITN7"],[/arp/i,"ITN9"]];
function guessTopic(name,text,def){ const m=(name||"").match(/\b(ITN|SRWE|ENSA)\s*[-_ ]?\s*(\d{1,2})\b/i); if(m&&TMAP[m[1].toUpperCase()+Number(m[2])]) return m[1].toUpperCase()+Number(m[2]);
  for(const [re,t] of KW) if(re.test(name)) return t; for(const [re,t] of KW) if(re.test(text)) return t; return def; }
function hashStr(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return h.toString(36); }
function parseMd(name,txt,def){
  const out=[]; txt=txt.replace(/\r/g,"").replace(/^---\n[\s\S]*?\n---\n/,""); const lines=txt.split("\n"); const clean=x=>x.replace(/<!--SR:.*?-->/g,"").replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g,"$2").trim();
  const push=(q,a)=>{ q=clean(q); a=clean(a); if(q.length<3||!a) return; out.push({id:"ob-"+hashStr(name+"|"+q),type:"flash",t:guessTopic(name,q+" "+a,def),q,ans:a,src:"n",file:name,ts:Date.now()}); };
  for(let i=0;i<lines.length;i++){ const l=lines[i];
    let m=l.match(/^(?:[-*]\s*)?(.+?)\s*:::\s*(.+)$/); if(m){ push(m[1],m[2]); continue; }
    m=l.match(/^(?:[-*]\s*)?(.+?)\s*::\s*(.+)$/); if(m&&!/^https?$/i.test(m[1])){ push(m[1],m[2]); continue; }
    m=l.match(/^(?:\*\*)?(?:Q|П|Питання)\s*[:.]\s*(?:\*\*)?\s*(.+)$/i); if(m&&lines[i+1]!==undefined){ const n=lines[i+1].match(/^(?:\*\*)?(?:A|В|Відповідь)\s*[:.]\s*(?:\*\*)?\s*(.+)$/i); if(n){ push(m[1],n[1]); i++; continue; } }
    if(/^\?{1,2}\s*$/.test(l)){ let a=i-1, qs=[]; while(a>=0&&lines[a].trim()&&!/^#/.test(lines[a])){ qs.unshift(lines[a]); a--; } let b=i+1, as=[]; while(b<lines.length&&lines[b].trim()&&!/^\?{1,2}\s*$/.test(lines[b])&&!/^#/.test(lines[b])){ as.push(lines[b]); b++; } if(qs.length&&as.length) push(qs.join("\n"),as.join("\n")); i=b-1; }
  }
  return out; }
async function importMd(files){
  const def=($("#obdef")||{}).value||"SRWE1"; let n=0, upd=0, scanned=0;
  for(const f of files){ if(!/\.md$/i.test(f.name)) continue; scanned++; const txt=await f.text(); const path=f.webkitRelativePath||f.name;
    for(const q of parseMd(path,txt,def)){ const ex=customQs.find(x=>x.id===q.id); if(ex){ if(ex.ans!==q.ans){ Object.assign(ex,{ans:q.ans,ts:Date.now()}); upd++; if(store.mode==="db") queueWrite(()=>store.db.doc("custom/"+ex.id).set(ex)); } continue; }
      customQs.push(q); n++; if(store.mode==="db") queueWrite(()=>store.db.doc("custom/"+q.id).set(q)); } }
  lsSet(LS.custom,customQs); rebuildQB(); opts.obLast=Date.now(); lsSet(LS.opts,opts);
  const m=$("#obmsg"); if(m) m.textContent="Файлів: "+scanned+", нових карток: "+n+", оновлено: "+upd; setTimeout(()=>{ if(view==="custom") render(); },1500); }
// ---- Імпорт з GitHub-репозиторію vault (синхронізація Obsidian Git) ----
const GH_SHA="ccna.obgh.sha", GH_TOK="ccna.ghtoken";
async function ghJson(url,tok){ const r=await fetch(url,{headers:Object.assign({Accept:"application/vnd.github+json"},tok?{Authorization:"Bearer "+tok}:{})});
  if(r.status===404) throw new Error(tok?"репозиторій або гілку не знайдено (перевірте назву і права токена)":"репозиторій не знайдено або він приватний — додайте токен з правом Contents: read");
  if(r.status===401) throw new Error("токен недійсний"); if(r.status===403) throw new Error("ліміт GitHub API вичерпано — спробуйте пізніше або додайте токен"); if(!r.ok) throw new Error("GitHub відповів "+r.status); return r.json(); }
async function importGithub(){
  const m=$("#obmsg"); const say=t=>{ if(m) m.textContent=t; };
  const repo=(($("#ghrepo")||{}).value||"").trim().replace(/^https?:\/\/github\.com\//,"").replace(/\.git$/,"").replace(/\/$/,""); const pre=(($("#ghpath")||{}).value||"").trim().replace(/^\/|\/$/g,""); let br=(($("#ghbranch")||{}).value||"").trim();
  const tokIn=(($("#ghtok")||{}).value||"").trim(); if(tokIn&&tokIn!=="••••") { try{ localStorage.setItem(GH_TOK,tokIn); }catch(e){} } const tok=(()=>{ try{ return localStorage.getItem(GH_TOK)||""; }catch(e){ return ""; } })();
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo)){ say("Вкажіть репозиторій у форматі власник/назва"); return; }
  opts.obRepo=repo; opts.obPath=pre; opts.obBranch=br; lsSet(LS.opts,opts);
  try{ say("Читаю репозиторій…"); if(!br) br=(await ghJson("https://api.github.com/repos/"+repo,tok)).default_branch;
    const tree=await ghJson("https://api.github.com/repos/"+repo+"/git/trees/"+encodeURIComponent(br)+"?recursive=1",tok);
    const md=(tree.tree||[]).filter(x=>x.type==="blob"&&/\.md$/i.test(x.path)&&(!pre||x.path===pre||x.path.startsWith(pre+"/"))&&!/(^|\/)\.(obsidian|trash)\//.test(x.path));
    if(!md.length){ say("У "+repo+(pre?"/"+pre:"")+" не знайдено .md-файлів"); return; }
    const old=lsGet(GH_SHA,{}); const key=repo+"@"+br+":"; const todo=md.filter(x=>old[key+x.path]!==x.sha).slice(0,500);
    if(!todo.length){ say("Без змін: усі "+md.length+" нотаток уже імпортовано"); return; }
    const files=[]; let done=0;
    const one=async x=>{ const url=tok? "https://api.github.com/repos/"+repo+"/contents/"+x.path.split("/").map(encodeURIComponent).join("/")+"?ref="+encodeURIComponent(br) : "https://raw.githubusercontent.com/"+repo+"/"+encodeURIComponent(br)+"/"+x.path.split("/").map(encodeURIComponent).join("/");
      const r=await fetch(url,{headers:tok?{Accept:"application/vnd.github.raw",Authorization:"Bearer "+tok}:{}}); if(!r.ok) throw new Error(x.path+": "+r.status); const txt=await r.text();
      files.push({name:x.path.split("/").pop(),webkitRelativePath:x.path,text:async()=>txt}); done++; if(done%10===0) say("Завантажено "+done+"/"+todo.length+"…"); };
    for(let i=0;i<todo.length;i+=6) await Promise.all(todo.slice(i,i+6).map(one));
    await importMd(files); for(const x of todo) old[key+x.path]=x.sha; lsSet(GH_SHA,old);
    say(($("#obmsg")||{}).textContent+" · з GitHub: "+todo.length+" змінених файлів із "+md.length); }
  catch(e){ say("Помилка імпорту з GitHub: "+e.message); } }
ACTS.ghimport=()=>importGithub();
// ---- Запис у vault: слабкі місця, картки з помилок і тижневий огляд — комітом у GitHub-репозиторій ----
function errCardsMd(){ const L=["---","tags: [ccna, flashcards]","updated: "+dkey(),"---","# CCNA — картки з моїх помилок","","> Згенеровано тренажером. Формат плагіна Spaced Repetition: питання::відповідь.","","#flashcards/ccna",""];
  const clean=t=>String(t).replace(/::/g,":").replace(/\s*\n\s*/g," ").trim();
  const rows=Object.entries(prog).filter(([id,r])=>r.w>0&&QMAP[id]).sort((a,b)=>(b[1].w-b[1].c*0.3)-(a[1].w-a[1].c*0.3)).slice(0,80);
  for(const [id,r] of rows){ const q=QMAP[id]; L.push(clean(q.q)+"::"+clean(ansText(q))+" ("+tlabel(q.t)+", помилок: "+r.w+")"); }
  for(const q of (typeof ccAll==="function"?ccAll():[])){ const r=prog[q.id]; if(r&&r.w>0) L.push(clean(q.q.replace(/^🃏 /,""))+"::"+clean(q.ans[0])); }
  return L.join("\n")+"\n"; }
const b64u=t=>{ const b=new TextEncoder().encode(t); let s=""; for(let i=0;i<b.length;i+=0x8000) s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000)); return btoa(s); };
const unb64u=s=>{ const bin=atob(String(s).replace(/\n/g,"")); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return new TextDecoder().decode(u); };
async function ghPut(repo,br,path,text,tok){ const url="https://api.github.com/repos/"+repo+"/contents/"+path.split("/").map(encodeURIComponent).join("/");
  const H={Accept:"application/vnd.github+json",Authorization:"Bearer "+tok}; let sha=null;
  const g=await fetch(url+"?ref="+encodeURIComponent(br),{headers:H}); if(g.status===200){ const j=await g.json(); sha=j.sha; try{ if(unb64u(j.content).replace(/^updated: .*$/m,"")===text.replace(/^updated: .*$/m,"")) return "same"; }catch(e){} } else if(g.status===401) throw new Error("токен недійсний");
  const r=await fetch(url,{method:"PUT",headers:Object.assign({"Content-Type":"application/json"},H),body:JSON.stringify({message:"CCNA тренажер: "+path.split("/").pop()+" ("+dkey()+")",content:b64u(text),branch:br,sha:sha||undefined})});
  if(r.status===403||r.status===404) throw new Error("немає права запису: потрібен токен з Contents: Read and write для "+repo); if(!r.ok) throw new Error("GitHub відповів "+r.status+" для "+path); return sha?"updated":"created"; }
async function pushVault(silent){ const m=$("#obmsg"); const say=t=>{ if(m) m.textContent=t; };
  const tok=(()=>{ try{ return localStorage.getItem(GH_TOK)||""; }catch(e){ return ""; } })(); const repo=opts.obRepo; if(!tok||!repo){ if(!silent) say("Спершу вкажіть репозиторій і токен з правом запису (розділ «Імпорт з GitHub»)"); return; }
  const dir=(opts.obWriteDir||"CCNA/Тренажер").replace(/^\/|\/$/g,""); const wk=typeof reviewWeek==="function"?reviewWeek():null;
  try{ if(!silent) say("Записую у vault…"); let br=opts.obBranch; if(!br) br=(await ghJson("https://api.github.com/repos/"+repo,tok)).default_branch;
    const files=[[dir+"/Слабкі місця.md",obsidianMd()],[dir+"/Картки з помилок.md",errCardsMd()]]; if(wk) files.push([dir+"/Тиждень "+wk+".md",weekMd(wk)]);
    const res=[]; for(const [p,t] of files) res.push(await ghPut(repo,br,p,t,tok));
    opts.obPushed=Date.now(); lsSet(LS.opts,opts); const ch=res.filter(x=>x!=="same").length; if(!silent) say(ch?"Записано у "+repo+"/"+dir+": змінених файлів "+ch+" з "+res.length:"У vault усе актуально — змін немає"); }
  catch(e){ if(!silent) say("Помилка запису у vault: "+e.message); } }
ACTS.ghpush=()=>{ const t=$("#ghtok"); const v=t&&t.value.trim(); if(v&&v!=="••••"){ try{ localStorage.setItem(GH_TOK,v); }catch(e){} } const r=$("#ghrepo"); if(r&&r.value.trim()){ opts.obRepo=r.value.trim(); } const d=$("#ghwdir"); if(d) opts.obWriteDir=d.value.trim()||"CCNA/Тренажер"; lsSet(LS.opts,opts); pushVault(false); };
ACTS.ghauto=el=>{ opts.obAutoPush=!opts.obAutoPush; lsSet(LS.opts,opts); render(); };
setTimeout(()=>{ try{ if(opts.obAutoPush&&opts.obRepo&&localStorage.getItem(GH_TOK)&&Date.now()-(opts.obPushed||0)>20*3600e3) pushVault(true); }catch(e){} },15000);
ACTS.ghforget=()=>{ try{ localStorage.removeItem(GH_TOK); localStorage.removeItem(GH_SHA); }catch(e){} render(); };
function renderObsidian(){ const fl=customQs.filter(q=>q.type==="flash").length;
  return `<div class="card"><h2>📒 Картки з Obsidian</h2><p class="small muted" style="margin:0 0 8px">Оберіть папку CCNA з вашого vault (або окремі .md). Тренажер знайде картки у форматах <code>питання::відповідь</code>, <code>питання:::відповідь</code>, багаторядкові з рядком <code>?</code> між питанням і відповіддю, а також пари <code>Q:</code>/<code>A:</code>. Тему визначає за назвою файлу (наприклад «SRWE 3 VLAN.md») або ключовими словами. Повторний імпорт додає нові й оновлює змінені картки — прогрес не втрачається.</p>
    <label class="small muted">Тема, якщо не вдалося визначити</label><select class="full" id="obdef">${TOPICS.map(t=>`<option value="${t.id}" ${opts.modTopic===t.id?"selected":""}>${tlabel(t.id)} ${esc(t.name)}</option>`).join("")}</select>
    <div class="row" style="margin-top:8px"><label class="btnlike primary">📁 Обрати папку<input type="file" id="obdir" webkitdirectory directory multiple hidden></label><label class="btnlike">📄 Обрати файли<input type="file" id="obfiles" accept=".md,text/markdown" multiple hidden></label></div>
    <details style="margin-top:10px" ${opts.obRepo?"open":""}><summary class="small"><b>🐙 Імпорт з GitHub</b> — якщо vault синхронізується плагіном Obsidian Git</summary>
     <div style="margin-top:6px"><label class="small muted">Репозиторій</label><input type="text" id="ghrepo" value="${esc(opts.obRepo||"Maxkor17/Maxkor17-Obsidian-Vault")}" placeholder="власник/назва">
     <div class="row"><div class="grow"><label class="small muted">Папка (необов'язково)</label><input type="text" id="ghpath" value="${esc(opts.obPath||"")}" placeholder="напр. CCNA"></div><div class="grow"><label class="small muted">Гілка</label><input type="text" id="ghbranch" value="${esc(opts.obBranch||"")}" placeholder="за замовчуванням"></div></div>
     <label class="small muted">Токен для приватного репозиторію (fine-grained, лише Contents: read)</label><input type="password" id="ghtok" autocomplete="off" value="${(()=>{ try{ return localStorage.getItem(GH_TOK)?"••••":""; }catch(e){ return ""; } })()}" placeholder="github_pat_… (зберігається лише на цьому пристрої)">
     <div class="row" style="margin-top:8px"><button class="primary" data-act="ghimport">⬇ Імпортувати з GitHub</button><button class="ghost" data-act="ghforget">Забути токен і кеш</button></div>
     <p class="small muted" style="margin:6px 0 0">Повторний імпорт завантажує лише змінені файли. Токен не синхронізується в хмару тренажера.</p>
     <h3 style="margin:12px 0 4px">⬆ Запис у vault</h3><p class="small muted" style="margin:0 0 6px">Тренажер комітить у репозиторій три нотатки: «Слабкі місця», «Картки з помилок» (формат питання::відповідь для плагіна Spaced Repetition) і огляд тижня. Потрібен токен з правом Contents: Read and write. Obsidian Git підтягне їх у vault.</p>
     <label class="small muted">Папка у vault</label><input type="text" id="ghwdir" value="${esc(opts.obWriteDir||"CCNA/Тренажер")}">
     <div class="row" style="margin-top:8px"><button data-act="ghpush">⬆ Записати у vault</button><label class="small"><input type="checkbox" data-act="ghauto" ${opts.obAutoPush?"checked":""}> автоматично раз на день</label></div>${opts.obPushed?`<p class="small muted" style="margin:4px 0 0">Останній запис: ${new Date(opts.obPushed).toLocaleString("uk-UA")}</p>`:""}</div></details>
    <p class="small muted" id="obmsg" style="margin:8px 0 0">Карток з нотаток: ${fl}${opts.obLast?" · останній імпорт "+new Date(opts.obLast).toLocaleString("uk-UA"):""}</p>${fl?`<button class="mini" data-act="obtrain" style="margin-top:6px">Тренувати картки</button>`:""}</div>`; }
function renderCustom(){
  const editing=customEdit? customQs.find(x=>x.id===customEdit) : customDraft;
  const list=customQs.filter(q=>q.type!=="flash").sort((a,b)=>b.ts-a.ts);
  return renderObsidian()+customForm(editing)+`<div class="card"><div class="row"><h2 class="grow" style="margin:0">Мої питання <span class="muted">(${list.length})</span></h2>${list.length?`<button class="mini primary" data-act="ctrain">Тренувати</button>`:""}</div>
    ${list.length?list.map(q=>`<div class="kv"><span class="small"><span class="muted">${tlabel(q.t)}${q.src==="na"?" · 🎓":""}</span><br>${esc(q.q)}</span><span class="row" style="flex-wrap:nowrap"><button class="mini" data-act="cedit" data-id="${esc(q.id)}">✎</button><button class="mini" data-act="cdel" data-id="${esc(q.id)}">🗑</button></span></div>`).join(""):`<p class="small muted" style="margin:6px 0 0">Тут з'являться питання, які ви додасте, — наприклад, зі скриншотів тестів NetAcad. Вони синхронізуються між пристроями і потрапляють у тренування, екзамени та тести модулів.</p>`}</div>
  <button class="primary" data-act="home">На головну</button>`;
}

function renderResult(){
  const e=S.result;
  const rows=Object.entries(e.per).sort((a,b)=>TOPICS.findIndex(t=>t.id===a[0])-TOPICS.findIndex(t=>t.id===b[0]))
    .map(([t,[c,n]])=>`<tr><td>${tlabel(t)} · ${esc(TMAP[t].name)}</td><td class="num">${c}/${n}</td><td class="num">${Math.round(c/n*100)}%</td></tr>`).join("");
  let ccna=""; if(e.ccna){ const sc=Math.round(300+700*e.correct/e.n); const dom={}; for(const [t,[c,n]] of Object.entries(e.per)){ const d=domainOf(t,e.bp); dom[d]=dom[d]||[0,0]; dom[d][0]+=c; dom[d][1]+=n; }
    ccna=`<p class="big" style="color:var(${sc>=825?"--ok":sc>=750?"--warn":"--bad"})">${sc} / 1000</p><p style="margin:0 0 8px"><b>${sc>=825?"✅ Прохідний рівень (≈ 825)":"❌ Нижче прохідного рівня (≈ 825)"}</b></p>
      <table><tr><th>Домен</th><th class="num">Вірно</th><th class="num">%</th></tr>${DOMAINS.map(([d,w])=>dom[d]?`<tr><td>${esc(d)} <span class="small muted">(${Math.round(w*100)}%)</span></td><td class="num">${dom[d][0]}/${dom[d][1]}</td><td class="num">${Math.round(dom[d][0]/dom[d][1]*100)}%</td></tr>`:"").join("")}</table>
      <p class="small muted">Справжня шкала Cisco не публікується; тут бал = 300 + 700 × частка правильних.</p>`; }
  return `<div class="card"><h2>Результат ${e.ccna?"симуляції CCNA":"екзамену"}</h2>${ccna}
    <p class="${e.ccna?"":"big"}" style="color:var(${e.pct>=80?"--ok":e.pct>=70?"--warn":"--bad"})">${e.pct}%</p>
    <p class="muted" style="margin:0">${e.correct} з ${e.n} · час ${Math.floor(e.dur/60)} хв ${e.dur%60} с</p>
    <table style="margin-top:10px"><tr><th>Тема</th><th class="num">Вірно</th><th class="num">%</th></tr>${rows}</table></div>
  ${timeCard(e)}
  <div class="card"><h2>Розбір</h2>${S.items.map((q,k)=>reviewItem(q,S.ans[k]===undefined?(qtype(q)==="cmd"?"":[]):S.ans[k])).join("")}</div>
  <button class="primary" data-act="home">На головну</button>`;
}
function timeCard(e){ if(!e.tq||!e.tq.length) return ""; const T=e.tq, n=T.length, sum=T.reduce((a,b)=>a+b,0); if(!sum) return "";
  const avg=Math.round(sum/n), med=T.slice().sort((a,b)=>a-b)[Math.floor(n/2)], slow=T.filter(x=>x>120).length; const fmt=s=>s>=60?Math.floor(s/60)+" хв "+(s%60)+" с":s+" с";
  const okT=T.filter((_,k)=>e.tok&&e.tok[k]), badT=T.filter((_,k)=>e.tok&&!e.tok[k]); const av=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0;
  const top=T.map((s,k)=>[s,k]).sort((a,b)=>b[0]-a[0]).slice(0,5);
  return `<div class="card"><h2>⏱ Час на питання${e.en?" · English":""}</h2>
    <div class="kv"><span>Середній</span><b>${fmt(avg)}</b></div><div class="kv"><span>Медіана</span><span>${fmt(med)}</span></div>
    <div class="kv"><span>Правильні / помилкові</span><span>${fmt(av(okT))} / ${fmt(av(badT))}</span></div><div class="kv"><span>Довше 2 хв</span><span>${slow}</span></div>
    <p class="small muted" style="margin:6px 0">Орієнтир для CCNA: ~120 хв на 100–120 завдань, тобто ≈ 1 хв на питання з запасом на симуляції. ${avg>75?"Ви витрачаєте більше — тренуйте швидкість на коротких сесіях.":"Темп у нормі."}${e.en&&avg>75?" Частина часу йде на читання англійською: корисні 🇬🇧 сесії й англійські терміни в налаштуваннях.":""}</p>
    <table><tr><th>Найдовші</th><th>Тема</th><th class="num">Час</th><th class="num"></th></tr>${top.map(([s,k])=>`<tr><td>№${k+1}</td><td>${e.tt&&TMAP[e.tt[k]]?tlabel(e.tt[k]):"—"}</td><td class="num">${fmt(s)}</td><td class="num">${e.tok[k]?"✅":"❌"}</td></tr>`).join("")}</table></div>`; }
function weakConcepts(){
  const m={};
  for(const [id,r] of Object.entries(prog)){ const t=topicOfId(id); if(!t) continue; const c=conceptOf(id); const key=t+"|"+c;
    const x=m[key]=m[key]||{t,c,ok:0,bad:0,qs:0}; x.ok+=r.c; x.bad+=r.w; x.qs++; }
  return Object.values(m).filter(x=>x.bad>0).sort((a,b)=>(b.bad-b.ok*0.5)-(a.bad-a.ok*0.5)||b.bad-a.bad);
}
function chartSVG(){
  const days=[]; const d=new Date(); d.setDate(d.getDate()-13);
  for(let i=0;i<14;i++){ const k=dkey(d); const v=daily[k]||{n:0,c:0}; days.push({k,lab:String(d.getDate()).padStart(2,"0")+"."+String(d.getMonth()+1).padStart(2,"0"),n:v.n||0,c:v.c||0}); d.setDate(d.getDate()+1); }
  const W=360,H=190,pl=28,pr=6,pt=14,pb=24; const max=Math.max(opts.goal,...days.map(x=>x.n)); const step=max<=20?5:max<=60?10:max<=150?25:50; const top=Math.ceil(max/step)*step;
  const iw=(W-pl-pr)/days.length, bw=Math.max(6,iw-4); const y=v=>pt+(H-pt-pb)*(1-v/top);
  let g=""; for(let v=0;v<=top;v+=step){ g+=`<line class="gl" x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`; }
  const gy=y(opts.goal); g+=`<line x1="${pl}" x2="${W-pr}" y1="${gy}" y2="${gy}" stroke="var(--muted)" stroke-dasharray="4 4" stroke-width="1"/><text x="${W-pr}" y="${gy-4}" text-anchor="end">норма ${opts.goal}</text>`;
  days.forEach((x,i)=>{ const cx=pl+i*iw+(iw-bw)/2; const h=(H-pt-pb)*(x.n/top);
    if(x.n){ const r=Math.min(4,h/2); const yy=y(x.n), yb=y(0); g+=`<path class="b" data-tip="${x.lab}: ${x.n} відповідей, точність ${Math.round(x.c/x.n*100)}%" d="M${cx},${yb} V${yy+r} Q${cx},${yy} ${cx+r},${yy} H${cx+bw-r} Q${cx+bw},${yy} ${cx+bw},${yy+r} V${yb} Z"/>`; }
    g+=`<rect x="${pl+i*iw}" y="${pt}" width="${iw}" height="${H-pt-pb}" fill="transparent" data-tip="${x.lab}: ${x.n} відповідей${x.n?", точність "+Math.round(x.c/x.n*100)+"%":""}"/>`;
    if(i%3===1||days.length<=7) g+=`<text x="${pl+i*iw+iw/2}" y="${H-8}" text-anchor="middle">${x.lab}</text>`; });
  const tot=days.reduce((s,x)=>s+x.n,0), totc=days.reduce((s,x)=>s+x.c,0);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Кількість відповідей за останні 14 днів">${g}</svg>
  <p class="small muted" style="margin:6px 0 0">За 14 днів: ${tot} відповідей${tot?", точність "+Math.round(totc/tot*100)+"%":""}.</p>
  <details><summary class="small">Таблиця</summary><table>${days.filter(x=>x.n).map(x=>`<tr><td>${x.lab}</td><td class="num">${x.n}</td><td class="num">${Math.round(x.c/x.n*100)}%</td></tr>`).join("")||"<tr><td class='muted'>Немає даних</td></tr>"}</table></details>`;
}
function bindChart(){ const tip=$("#tip"); document.querySelectorAll(".chart [data-tip]").forEach(el=>{ el.addEventListener("mousemove",e=>{tip.style.display="block";tip.textContent=el.dataset.tip;tip.style.left=(e.clientX+12)+"px";tip.style.top=(e.clientY-30)+"px";}); el.addEventListener("mouseleave",()=>tip.style.display="none"); el.addEventListener("click",e=>{tip.style.display="block";tip.textContent=el.dataset.tip;tip.style.left=Math.min(e.clientX,window.innerWidth-200)+"px";tip.style.top=(e.clientY-36)+"px";setTimeout(()=>tip.style.display="none",1800);}); }); }
function renderStats(){
  let c=0,w=0,seen=0; for(const [id,r] of Object.entries(prog)){ c+=r.c; w+=r.w; if(QMAP[id]) seen++; }
  const wc=weakConcepts().slice(0,12);
  const rows=TOPICS.map(t=>{const st=topicStats(t.id);return `<tr><td>${t.g} ${t.n} · ${esc(t.name)}</td><td class="num">${st.seen}/${st.n}</td><td class="num">${st.acc==null?"—":Math.round(st.acc*100)+"%"}</td></tr>`;}).join("");
  const weakQ=Object.entries(prog).filter(([id,r])=>QMAP[id]&&r.w>0).sort((a,b)=>(b[1].w-b[1].c)-(a[1].w-a[1].c)||b[1].w-a[1].w).slice(0,10);
  const fl=Object.entries(flags).filter(([id,f])=>f.on);
  const ex=exams.slice(0,15).map(e=>`<tr><td>${fmtDate(e.ts)}</td><td class="num">${e.correct}/${e.n}</td><td class="num">${e.pct}%</td></tr>`).join("");
  return `<div class="card"><h2>Загалом</h2>
    <p style="margin:0">Пройдено питань банку: <b>${seen}</b> з ${QB.length} · відповідей: ${c+w} · точність: <b>${(c+w)?Math.round(c/(c+w)*100)+"%":"—"}</b> · лаби: ${ALLSCEN().filter(s=>labs[s.id]&&labs[s.id].ok).length}/${ALLSCEN().length}</p></div>
  <div class="card"><h2>Прогрес по днях</h2>${chartSVG()}</div>
  <div class="card"><h2>Прогноз готовності</h2>${readinessSection()}</div>
  <div class="card"><h2>Що плутає найбільше</h2>
    ${wc.length?wc.map(x=>`<div class="kv"><span>${esc(x.c)} <span class="small muted">· ${tlabel(x.t)}</span></span><span class="small"><b style="color:var(--bad)">${x.bad} ${x.bad===1?"помилка":x.bad<5?"помилки":"помилок"}</b> · точність ${Math.round(x.ok/(x.ok+x.bad)*100)}%</span></div>`).join(""):`<p class="small muted" style="margin:0">Поки помилок немає.</p>`}
    <p class="small muted" style="margin:8px 0 0">Порада: експортуйте JSON (💾 Копія) і попросіть Claude чи іншого AI-асистента розібрати слабкі місця.</p></div>
  ${whyCard()}
  <div class="card"><h2>По темах</h2><table><tr><th>Тема</th><th class="num">Пройд.</th><th class="num">Точн.</th></tr>${rows}</table></div>
  <div class="card"><h2>Найважчі питання</h2>${weakQ.length?weakQ.map(([id,r])=>`<div class="small muted" style="margin-top:6px">✅${r.c} ❌${r.w}</div>`+reviewItem(QMAP[id],undefined)).join(""):`<p class="muted small" style="margin:0">Поки що немає.</p>`}</div>
  <div class="card"><h2>⚑ Сумнівні питання <span class="muted">(${fl.length})</span></h2>
    ${fl.length?fl.map(([id,f])=>`<div class="kv"><span class="small">${esc(QMAP[id]?QMAP[id].q:(f.snip||id))}${f.note?`<br><span class="muted">Примітка: ${esc(f.note)}</span>`:""}</span><button class="mini" data-act="unflag" data-id="${esc(id)}">Зняти</button></div>`).join(""):`<p class="small muted" style="margin:0">Немає. Позначайте питання, у правильності яких сумніваєтеся, щоб потім перевірити й виправити.</p>`}</div>
  <div class="card"><h2>Екзамени</h2>${ex?`<table><tr><th>Дата</th><th class="num">Вірно</th><th class="num">%</th></tr>${ex}</table>`:`<p class="muted small" style="margin:0">Ще не було.</p>`}</div>
  <button class="primary" data-act="home">На головну</button>`;
}
function renderSearch(){
  const qv=searchQ.trim().toLowerCase(); let res=[];
  if(qv.length>=2) res=QB.filter(q=>textOf(q).toLowerCase().includes(qv)||(q.e||"").toLowerCase().includes(qv)||(q.o||[]).some(o=>o[1].toLowerCase().includes(qv)));
  return `<div class="card"><h2>Пошук по банку питань</h2>
    <input type="search" id="searchin" placeholder="наприклад: native, LACP, 0x2142" value="${esc(searchQ)}" autocomplete="off">
    <p class="small muted" style="margin:6px 0 0">${qv.length<2?"Введіть щонайменше 2 символи. Шукає в питаннях, варіантах і поясненнях.":"Знайдено: "+res.length+(res.length>60?" (показано 60)":"")}</p></div>
  ${res.length?`<div class="card">${res.slice(0,60).map(q=>reviewItem(q,undefined)).join("")}</div>`:""}
  <button class="primary" data-act="home">На головну</button>`;
}
function makeICS(t){
  const [h,m]=t.split(":"); const d=new Date(); const p=x=>String(x).padStart(2,"0");
  const ds=d.getFullYear()+p(d.getMonth()+1)+p(d.getDate()); const stamp=new Date().toISOString().replace(/[-:]/g,"").slice(0,15)+"Z";
  const url=location.origin+location.pathname;
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CCNA trainer//UK","CALSCALE:GREGORIAN","BEGIN:VEVENT","UID:ccna-daily-"+Date.now()+"@ccna-trainer","DTSTAMP:"+stamp,
    "DTSTART:"+ds+"T"+p(h)+p(m)+"00","DURATION:PT20M","RRULE:FREQ=DAILY","SUMMARY:📚 CCNA тренажер — денна норма","DESCRIPTION:Повтори питання за інтервалами і пройди лабу: "+url,"URL:"+url,
    "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:Час для CCNA","TRIGGER:PT0M","END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");
}
// ---- Автоматичні щотижневі резервні копії ----
const WEEK=7*864e5, SNAP_KEEP=8;
function saveDownload(name,text,type){ const b=new Blob([text],{type}); const u=URL.createObjectURL(b); const l=document.createElement("a"); l.href=u; l.download=name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(()=>URL.revokeObjectURL(u),2000); }
let remoteSnaps=null;
async function autoBackup(){
  try{
    if(!Object.keys(prog).length) return;
    const snaps=lsGet(LS.snaps,[]);
    if(!snaps.length || Date.now()-snaps[0].ts>=WEEK){ snaps.unshift({ts:Date.now(),n:Object.keys(prog).length,json:exportJSON()}); lsSet(LS.snaps,snaps.slice(0,4)); }
    if(store.mode==="db"&&store.db){
      const meta=store.db.doc("backups/meta"); const m=await meta.get(); const md=m.exists?(m.data()||{}):{};
      if(!md.last || Date.now()-md.last>=WEEK){ const slot=((md.slot||0)+1)%SNAP_KEEP;
        await store.db.doc("backups/s"+slot).set({ts:Date.now(),n:Object.keys(prog).length,json:exportJSON()});
        await meta.set({last:Date.now(),slot}); remoteSnaps=null; }
    }
  }catch(e){ console.warn("backup",e); }
}
async function loadRemoteSnaps(){
  if(store.mode!=="db"||!store.db) return [];
  const out=[]; for(let i=0;i<SNAP_KEEP;i++){ try{ const d=await store.db.doc("backups/s"+i).get(); if(d.exists){ const x=d.data(); if(x&&x.json) out.push(Object.assign({where:"☁ хмара"},x)); } }catch(e){} }
  return out.sort((a,b)=>b.ts-a.ts);
}
function snapList(){
  const loc=lsGet(LS.snaps,[]).map(x=>Object.assign({where:"📱 пристрій"},x));
  const all=(remoteSnaps||[]).concat(loc).sort((a,b)=>b.ts-a.ts); window._snaps=all; return all;
}
function exportJSON(){ return JSON.stringify({app:"ccna-trainer",v:3,exported:new Date().toISOString(),progress:prog,daily,flags,labs,exams,custom:customQs}); }
function renderBackup(){
  const acc = store.user? `<div class="card"><h2>Акаунт</h2><p class="small" style="margin:0 0 8px">Ви увійшли як <b>${esc(store.user.email||store.user.uid)}</b>. Прогрес синхронізується через Firebase.</p><button data-act="logout">Вийти</button></div>` : "";
  return acc+`<div class="card"><h2>Експорт</h2><p class="small muted" style="margin:0 0 8px">Скопіюйте текст і збережіть як файл (наприклад, ccna-progress.json).</p>
    <textarea id="exp" readonly>${esc(exportJSON())}</textarea><div class="row" style="margin-top:8px"><button class="primary" data-act="download">Завантажити файл</button><button data-act="copy">Копіювати</button><span id="copymsg" class="small muted"></span></div></div>
  <div class="card"><h2>Імпорт</h2><p class="small muted" style="margin:0 0 8px">Файл або вставлений JSON. Дані об'єднуються — лишається новіший запис.</p>
    <input type="file" id="impfile" accept=".json,application/json,text/plain"><textarea id="imp" placeholder='{"app":"ccna-trainer",...}' style="margin-top:8px"></textarea>
    <div class="row" style="margin-top:8px"><button class="primary" data-act="import">Імпортувати</button><span id="impmsg" class="small muted"></span></div></div>
  <div class="card"><h2>Автоматичні копії</h2><p class="small muted" style="margin:0 0 8px">Раз на тиждень тренажер сам зберігає знімок прогресу: останні ${SNAP_KEEP} — у вашому акаунті Firebase, останні 4 — на цьому пристрої. Відновлення об'єднує дані, тож нічого не затирає.</p>
    <div id="snaps">${snapList().map((x,i)=>`<div class="kv"><span>${new Date(x.ts).toLocaleDateString("uk-UA")} · ${x.n} записів <span class="small muted">${x.where}</span></span><span class="row"><button class="mini" data-act="snapdl" data-i="${i}">⬇</button><button class="mini" data-act="snaprestore" data-i="${i}">Відновити</button></span></div>`).join("")||`<p class="small muted">Ще немає копій — перша з'явиться автоматично.</p>`}</div>
    <div class="row" style="margin-top:8px"><button data-act="snapnow">Зробити копію зараз</button><span id="snapmsg" class="small muted"></span></div></div>
  <div class="card"><h2>Скидання</h2><p class="small muted" style="margin:0 0 8px">Видаляє прогрес по питаннях (денна статистика, лаби та історія екзаменів лишаються).</p><button data-act="reset">Скинути прогрес</button></div>
  <button class="primary" data-act="home">На головну</button>`;
}
const ALLSCEN=()=>CLI.SCEN.concat(CLI.NETSCEN||[],(window.BASH&&BASH.SCEN)||[]);
function renderLabs(){
  const card=sc=>{const st=labs[sc.id]; return `<div class="card"><div class="row"><div class="grow"><b>${sc.net?"🌐 ":""}${esc(sc.title)}</b><br><span class="small muted">${tlabel(sc.t)} · ${esc(TMAP[sc.t].name)}</span></div><span class="small">${st&&st.ok?(labDue(sc.id)?"🔁 час повторити":"✅ виконано"+(st.reps?" · повторів "+st.reps:"")):st?"⏳ спроб: "+(st.tries||0):""}</span><button class="primary mini" data-act="lab" data-id="${sc.id}">Відкрити</button></div></div>`;};
  return `<div class="card"><h2>CLI-лаби</h2><p class="small muted" style="margin:0">Симулятор Cisco IOS: працюють скорочення (<code>sh int tr</code>), підказка <code>?</code>, <code>do show …</code>, стрілки ↑↓ для історії. У 🌐-лабах кілька пристроїв: перемикайтеся між ними вкладками, а з ПК перевіряйте <code>ping</code> і <code>tracert</code>.</p></div>
  <div class="card"><h2>🛠 Troubleshooting</h2><p class="small muted" style="margin:0 0 8px">Тренажер бере випадкову правильно налаштовану мережу і непомітно ламає її: вимкнений порт, не та VLAN, native mismatch, хибний next-hop, пасивний інтерфейс OSPF, ACL не в тому напрямку, зламаний NAT або DHCP relay… Знайдіть і виправте. Щоразу — нова поломка.</p>
    <div class="row"><button class="primary" data-act="tsstart" data-n="1">Одна поломка</button><button data-act="tsstart" data-n="2">Дві поломки</button><button data-act="tsstart" data-n="1" data-tk="1">🎫 Тікет від користувача</button><span class="small muted">Розв'язано: ${Object.keys(labs).filter(k=>k.startsWith("ts-")&&labs[k].ok).reduce((a,k)=>a+(labs[k].solved||1),0)}${(()=>{ const t=Object.values(labs).filter(x=>x&&x.tk); const n=t.reduce((a,x)=>a+x.tk.n,0); return n?` · тікетів: ${n}, середня оцінка ${Math.round(t.reduce((a,x)=>a+x.tk.sum,0)/n)}, найкраща ${Math.max(...t.map(x=>x.tk.best))}`:""; })()}</span></div>
    <p class="small muted" style="margin:8px 0 0">Тікет — як на реальній роботі: ви бачите лише скаргу користувача, а не список вимог. Оцінка залежить від часу, кількості команд і невдалих перевірок.</p></div>
  <div class="card"><h2>📶 Бездротовий контролер (GUI)</h2><p class="small muted" style="margin:0 0 8px">Інтерфейс у стилі Cisco WLC: динамічний інтерфейс, RADIUS, WLAN із WPA2-PSK і WPA2-Enterprise. ${labs.wlc&&labs.wlc.ok?"✅ виконано":labs.wlc?"⏳ "+(labs.wlc.n||0)+"/5":""}</p><button class="primary" data-act="wlclab">Відкрити</button></div>
  <div class="card"><h2>🐍 Python для мереж</h2><p class="small muted" style="margin:0 0 8px">Справжній Python у браузері: Netmiko, NAPALM, RESTCONF (requests) і NETCONF (ncclient) на пристроях симулятора. Гайд для Cisco DevNet Sandbox. ${labs.pylab&&labs.pylab.ok?"✅ виконано":labs.pylab?"⏳ "+(labs.pylab.n||0)+"/"+PYLAB.TASKS.length:""}</p><button class="primary" data-act="pylab">Відкрити</button></div>
  <div class="card"><h2>🤖 Автоматизація: Ansible</h2><p class="small muted" style="margin:0 0 8px">YAML-плейбуки з модулями ios_command і ios_config на пристроях симулятора: змінні, loop, register, ідемпотентність, save_when. ${labs.ansible&&labs.ansible.ok?"✅ виконано":labs.ansible?"⏳ "+(labs.ansible.n||0)+"/"+ANSIBLE.TASKS.length:""}</p><button class="primary" data-act="ansible">Відкрити</button></div>
  <div class="card"><h2>🤖 Автоматизація: REST API</h2><p class="small muted" style="margin:0 0 8px">Токен, GET/POST/PUT/DELETE, заголовки, JSON і коди відповідей — на навчальному контролері. ${labs.api&&labs.api.ok?"✅ виконано":labs.api?"⏳ "+(labs.api.n||0)+"/7":""}</p><button class="primary" data-act="api">Відкрити</button></div>
  <div class="card"><h2>🧪 Пісочниця</h2><p class="small muted" style="margin:0 0 8px">Будуйте власну мережу без завдання: комутатори, L3-комутатори, маршрутизатори, ПК, сервери. Конфігурація зберігається й синхронізується.</p><button class="primary" data-act="sandbox">Відкрити пісочницю</button></div>
  ${(CLI.NETSCEN||[]).some(s=>/^ITN/.test(s.t))?`<h3>🌐 ITN: прикладний рівень і діагностика</h3>${CLI.NETSCEN.filter(s=>/^ITN/.test(s.t)).map(card).join("")}`:""}
  <h3>🌐 SRWE: кілька пристроїв</h3>${(CLI.NETSCEN||[]).filter(s=>/^SRWE/.test(s.t)).map(card).join("")}
  <h3>🌐 ENSA: OSPF, ACL, NAT, WAN, QoS, дизайн</h3>${(CLI.NETSCEN||[]).filter(s=>/^ENSA/.test(s.t)).map(card).join("")}
  <h3>Один комутатор</h3>${CLI.SCEN.map(card).join("")}
  <h3>🐧 Після CCNA: Linux, DevOps і безпека</h3>${((window.BASH&&BASH.SCEN)||[]).map(card).join("")}${(CLI.NETSCEN||[]).filter(s=>/^LNX/.test(s.t)).map(card).join("")}
  <button class="primary" data-act="home">На головну</button>`;
}
function renderLab(){
  const sc=LAB.sc;
  const ico=d=>{ const t=LAB.N&&LAB.N.dev[d]&&LAB.N.dev[d].type; return t==="pc"?"💻":t==="server"?"🗄":t==="router"?"🔀":"🔁"; };
  const tabs= sc.net? `<div class="chips" style="margin-top:8px">${Object.keys(LAB.ses).filter(d=>!sc.discover||LAB.known.has(d)).map(d=>`<button class="seg ${LAB.cur===d?"on":""}" data-act="labdev" data-d="${d}">${ico(d)} ${d}</button>`).join("")}</div>` : "";
  const fig=LAB.N&&!LAB.walk&&!sc.discover? CLI.figOf(LAB.N,[LAB.cur]) : null;
  return `<div class="card"><h2>${sc.net?"🌐 ":""}${esc(sc.title)}</h2>${fig?topoSVG(fig):""}${sc.topo&&!sc.sb?`<details><summary class="small muted">Текстова схема</summary><pre>${esc(sc.topo)}</pre></details>`:""}<ol class="small" style="margin:0;padding-left:20px">${sc.task.map(t=>`<li>${esc(t)}</li>`).join("")}</ol></div>
  ${sc.sb?sandboxEditor():""}${sc.discover?discoverCard():""}
  <div id="walk">${LAB.walk?renderWalk():""}</div>
  ${tabs}
  ${LAB.ses[LAB.cur]?`<div class="term" id="term">${esc(LAB.outs[LAB.cur]||"")}</div>
  <div class="termin"><span id="tprompt">${esc(LAB.ses[LAB.cur].prompt())}</span><input id="tin" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" aria-label="Команда"></div>`:`<p class="small muted">Додайте пристрій, щоб відкрити його консоль.</p>`}
  <div class="row" style="margin-top:8px">${LAB.N?`<button data-act="walk" id="walkbtn" ${LAB.N.lastFlow?"":"disabled"}>🔍 Шлях пакета</button>`:""}${LAB.N&&!LAB.ts?`<button data-act="labexport" title="Топологія containerlab, конфіги й рішення для справжнього IOS">📦 На справжній IOS</button>`:""}${sc.sb?`<button data-act="sbreset">Очистити пісочницю</button>`:`<button class="primary" data-act="labcheck">Перевірити</button>`}${sc.sb?"":LAB.ts?`<button data-act="tsgive">${LAB.showSol?"Сховати поломки":"Здатися — показати поломки"}</button><button data-act="tsstart" data-n="${LAB.ts.n}" data-tk="${LAB.ts.tk?1:0}">${LAB.ts.tk?"Новий тікет":"Нова поломка"}</button>${LAB.ts.tk&&!LAB.ts.done?`<span class="small muted" id="tktimer">⏱ 0:00 · команд: ${LAB.hist.length}</span>`:""}`:`<button data-act="labsol">${LAB.showSol?"Сховати рішення":"Показати рішення"}</button><button data-act="labreset">Скинути</button>`}</div>
  <div id="labres">${LAB.res||""}</div>
  ${LAB.showSol&&!LAB.ts&&!sc.discover?`<div class="card"><h2>Рішення</h2><pre>${esc(sc.sol)}</pre></div>`:""}
  ${LAB.showSol&&LAB.ts?`<div class="card"><h2>Що було зламано</h2><ul class="checklist">${LAB.ts.faults.map(f=>`<li>🔧 ${esc(f)}</li>`).join("")}</ul><p class="small muted">Перевірте, як ці поломки виглядали в show-командах, і виправте їх.</p></div>`:""}
  <button class="ghost" data-act="labs">← До списку лаб</button>`;
}
function bindLab(){
  clearInterval(window._tkT); if(LAB.ts&&LAB.ts.tk&&!LAB.ts.done){ const upd=()=>{ const el=$("#tktimer"); if(!el||!LAB.ts||!LAB.ts.tk||LAB.ts.done){ clearInterval(window._tkT); return; } const s=Math.floor((Date.now()-LAB.ts.tk.t0)/1000); el.textContent=`⏱ ${Math.floor(s/60)}:${String(s%60).padStart(2,"0")} · команд: ${LAB.hist.length}`; }; upd(); window._tkT=setInterval(upd,1000); }
  const tin=$("#tin"), term=$("#term"); if(!tin) return; term.scrollTop=term.scrollHeight; tin.focus();
  tin.addEventListener("keydown",e=>{
    if(e.key==="Enter"){ const line=tin.value; const ses=LAB.ses[LAB.cur]; const pr=ses.prompt(); const mode0=ses.ctx&&ses.ctx.mode; const out=ses.exec(line); ccCapture(mode0,line,out);
      let hint=""; if(/Invalid|Incomplete/.test(out) && /^\s*(sh|show|ping)\b/i.test(line) && /\(config/.test(pr)) hint="(Підказка: у режимі конфігурації використовуйте do "+line.trim()+")";
      LAB.outs[LAB.cur]+=pr+line+"\n"+(out?out+"\n":"")+hint+(hint?"\n":"");
      if(LAB.N){ for(const [d,m] of LAB.N.recompute()) LAB.outs[d]+=m+"\n"; }
      if(discoverLearn(line)){ const t=$("#dmap"); if(t) LAB.mapText=t.value; LAB.hist.push(line); LAB.hi=LAB.hist.length; render(); return; }
      LAB.hist.push(line); LAB.hi=LAB.hist.length; tin.value="";
      if(LAB.sc.sb) sbSave(); const wb=$("#walkbtn"); if(wb&&LAB.N&&LAB.N.lastFlow) wb.disabled=false;
      term.textContent=LAB.outs[LAB.cur]; term.scrollTop=term.scrollHeight; $("#tprompt").textContent=LAB.ses[LAB.cur].prompt(); e.preventDefault(); }
    else if(e.key==="ArrowUp"){ if(LAB.hi>0){LAB.hi--; tin.value=LAB.hist[LAB.hi]||"";} e.preventDefault(); }
    else if(e.key==="ArrowDown"){ if(LAB.hi<LAB.hist.length){LAB.hi++; tin.value=LAB.hist[LAB.hi]||"";} e.preventDefault(); }
  });
  term.addEventListener("click",()=>tin.focus());
}
// ---- Аналіз плутанини ----
function pairStats(){ return (window.PAIRS||[]).map(P=>{ const qs=QB.filter(q=>P.re.test(textOf(q))); let s=0,w=0; for(const q of qs){ const r=prog[q.id]; if(r){ s+=r.s; w+=r.w; } } return {P,qs,s,w,rate:s?w/s:0}; }); }
function renderConfuse(){ const st=pairStats().sort((a,b)=>(b.s?b.rate:-1)-(a.s?a.rate:-1)); const open=window._pairOpen;
  return `<div class="card"><h2>🧠 Що я плутаю</h2><p class="small muted" style="margin:0">Пари понять, які найчастіше плутають на CCNA. Відсоток — частка ваших помилок у питаннях про цю пару. Відкрийте пару, щоб побачити порівняння і пройти міні-сесію.</p></div>
  ${st.map((x,k)=>`<div class="card"><div class="row" data-act="pairopen" data-k="${k}" style="cursor:pointer"><b class="grow">${esc(x.P.a)} ↔ ${esc(x.P.b)}</b><span class="small" style="color:var(${!x.s?"--muted":x.rate>0.3?"--bad":x.rate>0.15?"--warn":"--ok"})">${x.s?Math.round(x.rate*100)+"% помилок":"ще не траплялось"}</span></div>
    ${open===k?`<table class="cheat"><tr><th></th><th>${esc(x.P.a)}</th><th>${esc(x.P.b)}</th></tr>${x.P.rows.map(r=>`<tr><td class="small"><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</table>${x.qs.length?`<button class="primary mini" data-act="pairtrain" data-k="${k}">Міні-сесія (${Math.min(10,x.qs.length)} питань)</button>`:""}`:""}</div>`).join("")}
  <button class="ghost" data-act="home">На головну</button>`; }
window._pairSorted=null;
// ---- Мотивація: календар, досягнення, тижневий звіт ----
function heatmapSVG(){ const weeks=16, cell=14, gap=3; const end=new Date(); const start=new Date(end); start.setDate(end.getDate()-(weeks*7-1)-((end.getDay()+6)%7)+((end.getDay()+6)%7));
  start.setDate(end.getDate()-(weeks*7-1)); const off=(start.getDay()+6)%7; start.setDate(start.getDate()-off);
  let g=""; const d=new Date(start); let col=0;
  while(d<=end){ const row=(d.getDay()+6)%7; const x=daily[dkey(d)]||{}; const n=x.n||0, mn=dayMin(x); const lv=Math.max(n===0?0:n<10?1:n<20?2:n<40?3:4, mn===0?0:mn<20?1:mn<45?2:mn<90?3:4);
    g+=`<rect x="${20+col*(cell+gap)}" y="${row*(cell+gap)}" width="${cell}" height="${cell}" rx="2" fill="${lv?"var(--accent)":"var(--line)"}" opacity="${[1,.3,.5,.75,1][lv]}"><title>${d.toLocaleDateString("uk-UA")}: ${n} відп.${mn?", "+fmtMin(mn):""}</title></rect>`;
    if(row===6) col++; d.setDate(d.getDate()+1); }
  return `<svg viewBox="0 0 ${22+(col+1)*(cell+gap)} ${7*(cell+gap)+14}" style="width:100%;height:auto">${["Пн","","Ср","","Пт","",""].map((t,i)=>`<text x="0" y="${i*(cell+gap)+9}" font-size="8" fill="var(--muted)">${t}</text>`).join("")}${g}<text x="20" y="${7*(cell+gap)+11}" font-size="9" fill="var(--muted)">останні 16 тижнів · темніше — більше питань і часу</text></svg>`; }
function achievements(){ const tot=Object.values(prog).reduce((a,r)=>a+r.s,0); const si=streakInfo(); let best=0,cur=0; const d=new Date(); d.setDate(d.getDate()-400); for(let i=0;i<=400;i++){ if(dayActive(daily[dkey(d)])){cur++;best=Math.max(best,cur);}else cur=0; d.setDate(d.getDate()+1); }
  const L=k=>labs[k]&&labs[k].ok; const net=(CLI.NETSCEN||[]); const ts=Object.keys(labs).filter(k=>k.startsWith("ts-")).reduce((a,k)=>a+(labs[k].solved||0),0);
  const sp=k=>((labs["speed-"+k]||{}).runs||[]); const ex=exams; const sb=Object.keys((lsGet(LS.sandbox,{devs:{}}).devs)||{}).length;
  return [["🌱","Перший крок","10 відповідей",tot>=10],["📚","Сотня","100 відповідей",tot>=100],["🏋","Півтисячі","500 відповідей",tot>=500],["🧠","Тисячник","1000 відповідей",tot>=1000],
   ["🔥","Три дні поспіль","3 дні навчання без перерви",best>=3],["🔥","Тиждень","7 днів поспіль",best>=7],["☄","Місяць дисципліни","30 днів поспіль",best>=30],["🎯","Норма","Денна норма виконана",si.done],
   ["🔧","Перша лаба","Будь-яка CLI-лаба виконана",Object.keys(labs).some(k=>!k.startsWith("speed")&&labs[k].ok)],["🌐","SRWE-мережі","Усі 🌐 лаби SRWE",net.filter(x=>/^SRWE/.test(x.t)).every(x=>L(x.id))],["🛰","ENSA-мережі","Усі 🌐 лаби ENSA",net.filter(x=>/^ENSA/.test(x.t)).every(x=>L(x.id))],
   ["🛠","Ремонтник","5 поломок виправлено",ts>=5],["🚑","Мережевий лікар","20 поломок виправлено",ts>=20],["🤖","Автоматизатор","REST API лаба",L("api")],["🧪","Архітектор","Пісочниця з 5+ пристроїв",sb>=5],
   ["🧮","Субнет-ніндзя","10/10 субнетингу менш ніж за 120 с",sp("subnet").some(r=>r.ok===r.n&&r.sec<120)],["⌨","Швидкі пальці","10/10 команд менш ніж за 90 с",sp("cmd").some(r=>r.ok===r.n&&r.sec<90)],
   ["📝","Екзаменований","Екзамен ≥ 90%",ex.some(e=>e.pct>=90)],["🏅","Готовий до CCNA","Симуляція CCNA ≥ 825",ex.some(e=>e.ccna&&300+700*e.correct/e.n>=825)],["📒","Конспект у справі","20+ карток з Obsidian",customQs.filter(q=>q.type==="flash").length>=20],["🇬🇧","English ready","20 англійських питань правильно",QB.filter(q=>q.src==="en"&&prog[q.id]&&prog[q.id].c>0).length>=20],
   ...journalAchievements()]; }
function weekReport(){ const sum=(from,to)=>{ let n=0,c=0,m=0; const d=new Date(); d.setDate(d.getDate()-from); for(let i=from;i<to;i++){ const x=daily[dkey(d)]||{}; n+=x.n||0; c+=x.c||0; m+=dayMin(x); d.setDate(d.getDate()-1); } return {n,c,m}; };
  const a=sum(0,7), b=sum(7,14); const wk=Date.now()-7*864e5; const lb=Object.entries(labs).filter(([k,v])=>v.done&&v.done>wk).length; const ex=exams.filter(e=>e.ts>wk);
  return {a,b,lb,ex}; }
function renderProgress(){ const A=achievements(); const got=A.filter(x=>x[3]).length; const w=weekReport(); const si=streakInfo(); const acc=x=>x.n?Math.round(x.c/x.n*100)+"%":"—";
  return `<div class="card"><h2>📈 Активність</h2>${heatmapSVG()}<p class="small" style="margin:6px 0 0">Серія днів із виконаною нормою: <b>${si.streak}</b></p></div>
  ${journalCard()}
  <div class="card"><h2>🗒 Тижневий звіт</h2><table><tr><th></th><th class="num">Цей тиждень</th><th class="num">Минулий</th></tr><tr><td>Відповідей</td><td class="num">${w.a.n}</td><td class="num">${w.b.n}</td></tr><tr><td>Точність</td><td class="num">${acc(w.a)}</td><td class="num">${acc(w.b)}</td></tr><tr><td>Час навчання</td><td class="num">${fmtMin(w.a.m)}</td><td class="num">${fmtMin(w.b.m)}</td></tr></table>
    <p class="small" style="margin:6px 0 0">${w.a.n>w.b.n?"📈 Більше, ніж минулого тижня — так тримати.":w.a.n<w.b.n?"📉 Менше, ніж минулого тижня — спробуйте план на сьогодні.":"Стабільно."} Лаб завершено: ${w.lb}. Екзаменів: ${w.ex.length}${w.ex.length?" (найкращий "+Math.max(...w.ex.map(e=>e.pct))+"%)":""}.</p></div>
  <div class="card"><h2>🏆 Досягнення ${got}/${A.length}</h2><div class="ach">${A.map(([i,t,d,ok])=>`<div class="${ok?"on":""}"><span>${i}</span><b>${esc(t)}</b><small>${esc(d)}</small></div>`).join("")}</div></div>
  <button class="ghost" data-act="home">На головну</button>`; }
