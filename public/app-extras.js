"use strict";
// Експорт в Obsidian, швидкісні тренування, REST API, шлях пакета, пісочниця. Файли app-*.js — звичайні скрипти зі спільною глобальною областю; порядок підключення див. index.html.
// ---- Експорт в Obsidian ----
function ansText(q){ const t=qtype(q); if(t==="simlet") return q.parts.map((p,i)=>(i+1)+") "+p.a.map(j=>p.o[j][0]).join(", ")).join("; "); if(t==="mc") return q.a.map(i=>q.o[i][0]).join("; "); if(t==="cmd") return q.ans[0]; if(t==="order") return q.items.join(" → "); if(t==="match") return q.pairs.map(p=>p[0]+" — "+p[1]).join("; "); if(t==="fill") return fillBlanks(q).map(b=>b[0]).join(", "); if(t==="flash") return q.ans; return ""; }
function obsidianMd(){ const today=dkey(); const L=[]; L.push("---","tags: [ccna, ccna-trainer]","updated: "+today,"---","# CCNA — слабкі місця (з тренажера)","","> Згенеровано "+new Date().toLocaleString("uk-UA")+" у [CCNA тренажері]("+location.origin+location.pathname+").","");
  L.push("## Готовність по темах","","| Тема | Готовність | Пройдено |","|---|---|---|"); for(const t of TOPICS){ const r=topicReady(t.id); if(r&&r.seen) L.push("| [["+tlabel(t.id)+" "+t.name+"]] | "+Math.round(r.p*100)+"% | "+r.seen+"/"+r.n+" |"); }
  const ps=pairStats().filter(x=>x.s&&x.rate>0.15).sort((a,b)=>b.rate-a.rate); if(ps.length){ L.push("","## Що я плутаю",""); for(const x of ps){ L.push("### "+x.P.a+" ↔ "+x.P.b+" ("+Math.round(x.rate*100)+"% помилок)","","| | "+x.P.a+" | "+x.P.b+" |","|---|---|---|"); for(const r of x.P.rows) L.push("| "+r.join(" | ")+" |"); L.push(""); } }
  const wrong=Object.entries(prog).filter(([id,r])=>QMAP[id]&&r.w>0&&(r.k===0||r.w/r.s>=0.34)).map(([id,r])=>[QMAP[id],r]).sort((a,b)=>a[0].t.localeCompare(b[0].t,undefined,{numeric:true}));
  if(wrong.length){ L.push("## Питання з помилками ("+wrong.length+")",""); let cur=""; for(const [q,r] of wrong){ if(q.t!==cur){ cur=q.t; L.push("### "+tlabel(q.t)+" · "+TMAP[q.t].name,""); }
    L.push("- **"+q.q.replace(/\n/g," ")+"**"+(q.c?"\n  ```\n  "+q.c.replace(/\n/g,"\n  ")+"\n  ```":""),"  - ✅ "+ansText(q).replace(/\n/g," "),(q.e?"  - 💡 "+q.e:"")+"","  - помилок: "+r.w+" з "+r.s+" · #ccna/"+q.t.toLowerCase()); } }
  const my=myList(); if(my.length){ L.push("## Мої пояснення ("+my.length+")",""); for(const {f,q} of my){ L.push("- **"+((q?q.q:f.snip)||"").replace(/\n/g," ")+"**"+(q?" · #ccna/"+q.t.toLowerCase():"")); if(q) L.push("  - ✅ "+ansText(q).replace(/\n/g," ")); L.push("  - ✍ "+f.mine.replace(/\n/g,"\n    ")); } }
  return L.filter(x=>x!=="").join("\n").replace(/\n(#{2,3} )/g,"\n\n$1")+"\n"; }
async function exportObsidian(){ const md=obsidianMd(); const name="CCNA тренажер — слабкі місця.md";
  if(window.showDirectoryPicker){ try{ const dir=await window.showDirectoryPicker({mode:"readwrite",id:"ccna-vault"}); const fh=await dir.getFileHandle(name,{create:true}); const w=await fh.createWritable(); await w.write(md); await w.close(); alert("Записано у vault: "+name); return; }catch(e){ if(e&&e.name==="AbortError") return; } }
  saveDownload(name,md,"text/markdown"); }
// ---- Швидкісні тренування ----
let SP=null;
const ip2nI=x=>x.split(".").reduce((a,o)=>a*256+Number(o),0)>>>0, n2ipI=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join(".");
function subnetItem(){ const r=(a,b)=>a+Math.floor(Math.random()*(b-a+1)); const p=r(18,30); const ip=[pick([10,172,192]),r(0,255),r(0,255),r(1,254)]; if(ip[0]===192) ip[1]=168; if(ip[0]===172) ip[1]=r(16,31);
  const n=ip2nI(ip.join(".")); const m=p===0?0:(0xFFFFFFFF<<(32-p))>>>0; const net=(n&m)>>>0, bc=(net|(~m>>>0))>>>0; const a=ip.join(".")+"/"+p;
  const k=pick(["net","bc","first","last","hosts","mask","wild","prefix"]);
  return {net:["Адреса мережі для "+a,n2ipI(net)],bc:["Широкомовна адреса для "+a,n2ipI(bc)],first:["Перша адреса хоста в мережі "+a,n2ipI(net+1)],last:["Остання адреса хоста в мережі "+a,n2ipI(bc-1)],hosts:["Скільки адрес хостів у /"+p+"?",String(Math.pow(2,32-p)-2)],mask:["Маска для /"+p,n2ipI(m)],wild:["Wildcard-маска для /"+p,n2ipI(~m>>>0)],prefix:["Префікс для маски "+n2ipI(m),"/"+p]}[k].concat([null]); }
const pick=a=>a[Math.floor(Math.random()*a.length)];
function speedStart(kind){ let items;
  if(kind==="subnet") items=Array.from({length:10},()=>{ const [q,a]=subnetItem(); return {q,ans:[a,a.replace(/^\//,"")]}; });
  else items=shuffle(QB.filter(q=>qtype(q)==="cmd"&&langOk(q))).slice(0,10).map(q=>({q:q.q,ans:q.ans,id:q.id,c:q.c}));
  SP={kind,items,i:0,start:Date.now(),res:[],last:null}; view="speed"; render(); }
function speedCheck(v){ const it=SP.items[SP.i]; const ok= SP.kind==="subnet"? it.ans.includes(v.trim()) : it.ans.some(c=>cmdMatch(v,c)); SP.res.push({ok,v,t:Date.now()}); if(it.id) record(it.id,ok); if(opts.sound) beep(ok);
  SP.last={ok,ans:it.ans[0],v}; SP.i++; if(SP.i>=SP.items.length){ SP.end=Date.now(); const sec=Math.round((SP.end-SP.start)/1000), okN=SP.res.filter(r=>r.ok).length; const key="speed-"+SP.kind; const prev=labs[key]||{runs:[]};
    const rec={ts:Date.now(),runs:(prev.runs||[]).concat([{ts:Date.now(),sec,ok:okN,n:SP.items.length}]).slice(-50)}; labs[key]=rec; patch({labs:{[key]:rec}}); } render(); }
function sparkSVG(runs){ if(runs.length<2) return ""; const W=320,H=90, mx=Math.max(...runs.map(r=>r.sec)), mn=Math.min(...runs.map(r=>r.sec)); const X=i=>10+i*(W-20)/(runs.length-1), Y=v=>10+(H-30)*(mx===mn?0.5:(v-mn)/(mx-mn));
  const pts=runs.map((r,i)=>X(i)+","+Y(r.sec)).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/>${runs.map((r,i)=>`<circle cx="${X(i)}" cy="${Y(r.sec)}" r="3.5" fill="var(${r.ok===r.n?"--ok":"--warn"})"><title>${r.sec} с, ${r.ok}/${r.n}</title></circle>`).join("")}<text x="10" y="${H-4}" font-size="10" fill="var(--muted)">час сесії (с), нижче — краще; зелені — без помилок</text></svg>`; }
function renderSpeed(){
  const hist=k=>(labs["speed-"+k]||{}).runs||[]; const best=k=>{ const r=hist(k).filter(x=>x.ok===x.n); return r.length?Math.min(...r.map(x=>x.sec)):null; };
  if(!SP||SP.end){ const done=SP&&SP.end? `<div class="card"><h2>${SP.res.filter(r=>r.ok).length}/${SP.items.length} за ${Math.round((SP.end-SP.start)/1000)} с</h2>${best(SP.kind)===Math.round((SP.end-SP.start)/1000)&&SP.res.every(r=>r.ok)?"<p>🏆 Новий особистий рекорд!</p>":""}<ul class="checklist">${SP.items.map((it,k)=>`<li>${SP.res[k].ok?"✅":"❌"} ${esc(it.q)}${SP.res[k].ok?"":` — <b>${esc(it.ans[0])}</b> <span class="small muted">(ви: ${esc(SP.res[k].v||"—")})</span>`}</li>`).join("")}</ul></div>`:"";
    return done+`<div class="card"><h2>⚡ Швидкісні тренування</h2><p class="small muted" style="margin:0 0 8px">10 завдань на час. Пишіть відповідь і тисніть Enter — на іспиті ці речі мають іти на автоматі.</p>
      <div class="kv"><span><b>🧮 Субнетинг</b><br><span class="small muted">мережа, broadcast, хости, маски, wildcard · рекорд: ${best("subnet")!=null?best("subnet")+" с":"—"}</span></span><button class="primary" data-act="speed" data-k="subnet">Старт</button></div>${sparkSVG(hist("subnet").slice(-20))}
      <div class="kv"><span><b>⌨ Команди IOS</b><br><span class="small muted">задача → команда, скорочення приймаються · рекорд: ${best("cmd")!=null?best("cmd")+" с":"—"}</span></span><button class="primary" data-act="speed" data-k="cmd">Старт</button></div>${sparkSVG(hist("cmd").slice(-20))}</div>
      <button class="ghost" data-act="home">На головну</button>`; }
  const it=SP.items[SP.i]; const el=Math.round((Date.now()-SP.start)/1000);
  return `<div class="card"><div class="row"><span class="grow small muted">${SP.kind==="subnet"?"🧮 Субнетинг":"⌨ Команди"} · ${SP.i+1}/${SP.items.length}</span><b id="sptime">⏱ ${el} с</b></div>
    <div class="qtext" style="margin-top:8px">${esc(it.q)}</div>${it.c?`<pre>${esc(it.c)}</pre>`:""}
    <input id="spin" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="${SP.kind==="subnet"?"наприклад 192.168.1.64":"команда IOS"}">
    ${SP.last?`<p class="small" style="margin:8px 0 0">${SP.last.ok?"✅ Правильно":"❌ Було: <b>"+esc(SP.last.ans)+"</b>"}</p>`:""}</div>
  <button class="ghost" data-act="speedquit">Перервати</button>`; }
// ---- Лаба автоматизації (REST API) ----
let API=null;
function renderApi(){ if(!API) API={st:APILAB.newState(),req:{method:"POST",url:APILAB.BASE+"/dna/system/api/v1/auth/token",headers:"Authorization: Basic \nContent-Type: application/json",body:""},res:null,ans:""};
  const A=API, done=A.st.done, n=APILAB.TASKS.filter(t=>done[t.id]).length;
  const r=A.res; const col=r? (r.code<300?"--ok":r.code<500?"--bad":"--warn") : "--muted";
  return `<div class="card"><h2>🤖 Автоматизація: REST API контролера</h2><p class="small muted" style="margin:0 0 6px">Навчальний контролер на кшталт Cisco Catalyst Center. Виконуйте завдання HTTP-запитами: метод, URL, заголовки, тіло JSON. Виконано ${n}/${APILAB.TASKS.length}.</p>
    <ol class="checklist" style="padding-left:20px">${APILAB.TASKS.map(t=>`<li>${done[t.id]?"✅":"⬜"} ${esc(t.t)}${t.h&&!done[t.id]?`<div class="small muted">${esc(t.h)}</div>`:""}</li>`).join("")}</ol></div>
  <div class="card"><h2>Запит</h2>
    <div class="row"><select id="apim" style="width:auto">${["GET","POST","PUT","PATCH","DELETE"].map(m=>`<option ${A.req.method===m?"selected":""}>${m}</option>`).join("")}</select><input id="apiu" value="${esc(A.req.url)}" autocomplete="off" autocapitalize="off" spellcheck="false" class="grow"></div>
    <label class="small muted">Заголовки (по одному в рядку)</label><textarea id="apih" rows="3" spellcheck="false" autocapitalize="off">${esc(A.req.headers)}</textarea>
    <label class="small muted">Тіло (JSON)</label><textarea id="apib" rows="3" spellcheck="false" autocapitalize="off">${esc(A.req.body)}</textarea>
    <div class="row" style="margin-top:6px"><button class="primary" data-act="apisend">Надіслати</button>${A.st.token?`<button data-act="apitok">+ X-Auth-Token</button>`:""}<button data-act="apireset" class="ghost">Почати заново</button></div></div>
  ${r?`<div class="card"><h2>Відповідь <span style="color:var(${col})">${r.code} ${esc(r.status||"")}</span></h2><pre>${esc(r.body===null?"(порожнє тіло)":JSON.stringify(r.body,null,2))}</pre><p class="small muted" style="margin:0">${r.code===201?"201 — ресурс створено.":r.code===204?"204 — успішно, тіла немає (типово для DELETE).":r.code===401?"401 — немає або недійсна автентифікація.":r.code===404?"404 — неправильний шлях або ресурс не існує.":r.code===405?"405 — метод не підтримується для цього ресурсу.":r.code===409?"409 — конфлікт: ресурс уже існує.":r.code===415?"415 — сервер не розуміє формат тіла (потрібен Content-Type).":r.code===400?"400 — помилка в запиті (JSON або поля).":""}</p></div>`:""}
  <div class="card"><h2>Відповідь на завдання 4</h2><div class="row"><input id="apians" value="${esc(A.ans)}" placeholder="версія ПЗ" class="grow"><button data-act="apians">Перевірити</button></div></div>
  <button class="ghost" data-act="labs">← До списку лаб</button>`; }
function apiSync(){ API.req={method:$("#apim").value,url:$("#apiu").value,headers:$("#apih").value,body:$("#apib").value}; }
function apiDone(){ const n=APILAB.TASKS.filter(t=>API.st.done[t.id]).length; const prev=labs["api"]||{}; const rec={ok:n===APILAB.TASKS.length||!!prev.ok,tries:(prev.tries||0)+1,ts:Date.now(),n:Math.max(n,prev.n||0)}; labs["api"]=rec; patch({labs:{api:rec}}); }
// ---- Анімований шлях пакета ----
let walkTimer=null;
function walkSteps(){ const f=LAB.N.lastFlow; return f.fwd.concat(f.back&&f.back.length?[{sep:true,text:"↩ Відповідь"}].concat(f.back):[]); }
function renderWalk(){ const f=LAB.N.lastFlow; if(!f) return ""; const st=walkSteps(); const i=Math.min(LAB.walk.i,st.length-1); const cur=st[i]||{};
  const ICON={host:"💻",arp:"❓",l2:"🔗",sw:"🔁",l3:"🔀",route:"🧭",acl:"🛡",nat:"🔄",ok:"✅",fail:"❌"};
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🔍 ${esc(f.from)} → ${esc(f.dst)} ${f.proto==="icmp"?"(ping)":"(TCP "+f.dport+")"}</h2><button class="mini ghost" data-act="walkclose">✕</button></div>
    ${topoSVG(CLI.figOf(LAB.N,cur.dev?[cur.dev]:[],cur.link))}
    <div class="note" style="min-height:3.2em"><b>Крок ${i+1}/${st.length}.</b> ${ICON[cur.k]||""} ${esc(cur.text||"")}</div>
    ${cur.frame?frameHTML(cur.frame):""}
    <div class="row" style="margin:8px 0"><button data-act="walkgo" data-d="first">⏮</button><button data-act="walkgo" data-d="-1">◀</button><button class="primary" data-act="walkplay">${LAB.walk.play?"⏸ Пауза":"▶ Відтворити"}</button><button data-act="walkgo" data-d="1">▶</button></div>
    <ol class="walklist">${st.map((x,k)=>x.sep?`<li class="sep">${esc(x.text)}</li>`:`<li class="${k===i?"cur":""} ${x.k==="fail"?"bad":""}" data-act="walkgo" data-d="at" data-k="${k}">${ICON[x.k]||""} ${esc(x.text)}</li>`).join("")}</ol>
    <p class="small ${f.ok?"":"bad"}" style="margin:6px 0 0">${f.ok?"✅ Обмін успішний":"❌ "+esc(f.why||"")}</p></div>`; }
function frameHTML(f){ const ip=f.ip, PR={icmp:1,tcp:6,udp:17}; const L=[];
  L.push(["Ethernet II","Dst: "+f.dmac+", Src: "+f.smac]); if(f.tag) L.push(["802.1Q Virtual LAN","PRI: 0, VID: "+f.tag+" (TPID 0x8100)"]);
  L.push(["Type","IPv4 (0x0800)"]); L.push(["Internet Protocol Version 4","Src: "+ip.src+", Dst: "+ip.dst]); L.push(["  Time to Live",String(ip.ttl||"—")]); L.push(["  Protocol",(ip.proto||"").toUpperCase()+" ("+(PR[ip.proto]||"?")+")"]);
  if(ip.proto==="icmp") L.push(["Internet Control Message Protocol","Type: "+(ip.reply?"0 (Echo reply)":"8 (Echo request)")]);
  else L.push([ip.proto==="tcp"?"Transmission Control Protocol":"User Datagram Protocol","Src Port: "+ip.sport+", Dst Port: "+ip.dport+(ip.proto==="tcp"?(ip.reply?", Flags: [ACK]":", Flags: [SYN]"):"")]);
  return `<details class="frame" open><summary>📦 Кадр (як у Wireshark)</summary>${L.map(([k,v])=>`<div><b>${esc(k)}</b>: ${esc(v)}</div>`).join("")}${f.tag?`<div class="small muted">Тег 802.1Q додається лише на trunk-лінку; на access-порті кадр іде без тегу.</div>`:""}</details>`; }
function walkUpd(){ const w=$("#walk"); if(w) w.innerHTML=renderWalk(); const c=document.querySelector(".walklist .cur"); if(c&&c.scrollIntoView) c.scrollIntoView({block:"nearest"}); }
function walkStop(){ if(walkTimer){ clearInterval(walkTimer); walkTimer=null; } if(LAB&&LAB.walk) LAB.walk.play=false; }
// ---- Пісочниця ----
function sbLoad(){ return lsGet(LS.sandbox,null)||{devs:{},links:[]}; }
function sbSave(){ if(!LAB||!LAB.sc.sb) return; const d=CLI.saveNet(LAB.N,LAB.types); d.ts=Date.now(); lsSet(LS.sandbox,d); if(store.mode==="db") queueWrite(()=>store.db.doc("sandbox/main").set({json:JSON.stringify(d),ts:Date.now()})); }
function openSandbox(data){
  data=data||sbLoad(); const N=CLI.netFromSaved(data); const ses=CLI.sessionsFor(N); const types={}; for(const [n,d] of Object.entries(data.devs||{})) types[n]=d.type;
  const outs={}; for(const d of Object.keys(ses)) outs[d]=(LAB&&LAB.sc.sb&&LAB.outs[d])||(/^(pc|server)$/.test(N.dev[d].type)?"Microsoft Windows\n\n":"\nPress RETURN to get started!\n\n");
  const cur=LAB&&LAB.sc.sb&&ses[LAB.cur]?LAB.cur:Object.keys(ses)[0];
  LAB={sc:{id:"sandbox",title:"🧪 Пісочниця",net:true,sb:true,task:["Додавайте пристрої й з'єднуйте порти, далі налаштовуйте їх командами IOS. Усе зберігається автоматично й синхронізується між пристроями.","ПК: ipconfig /static <IP> <маска> <шлюз> або ipconfig /dhcp + ipconfig /renew; ping, tracert, curl, ssh. Після ping натисніть «🔍 Шлях пакета»."]},N,ses,outs,cur,types,hist:(LAB&&LAB.hist)||[],hi:0,res:"",showSol:false};
  view="lab"; render(); }
async function packSb(obj){ const txt=JSON.stringify(obj); if(window.CompressionStream){ const cs=new Blob([txt]).stream().pipeThrough(new CompressionStream("deflate-raw")); const buf=new Uint8Array(await new Response(cs).arrayBuffer()); let b=""; for(const x of buf) b+=String.fromCharCode(x); return "z"+btoa(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); } return "j"+btoa(unescape(encodeURIComponent(txt))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
async function unpackSb(str){ const kind=str[0]; let b=str.slice(1).replace(/-/g,"+").replace(/_/g,"/"); while(b.length%4) b+="="; const bin=atob(b);
  if(kind==="z"){ const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); const ds=new Blob([u]).stream().pipeThrough(new DecompressionStream("deflate-raw")); return JSON.parse(await new Response(ds).text()); }
  return JSON.parse(decodeURIComponent(escape(bin))); }
function sbValid(d){ if(!(d&&typeof d==="object"&&d.devs&&typeof d.devs==="object"&&Array.isArray(d.links))) return false; const nm=/^[A-Za-z][\w-]{0,19}$/, pt=/^[A-Za-z][\w\/.]{0,19}$/;
  for(const [n,v] of Object.entries(d.devs)){ if(!nm.test(n)||!v||!["switch","l3","router","pc","server"].includes(v.type)) return false; for(const k of ["ip","mask","gw"]) if(v[k]!=null&&!/^\d{1,3}(\.\d{1,3}){3}$/.test(v[k])) return false; if(v.state&&v.state.hostname&&!nm.test(v.state.hostname)) v.state.hostname=n; }
  return d.links.every(l=>Array.isArray(l)&&l.length===4&&d.devs[l[0]]&&d.devs[l[2]]&&pt.test(l[1])&&pt.test(l[3])); }
async function sbOpenShared(){ const m=location.hash.match(/^#sb=(.+)$/); if(!m) return; try{ const d=await unpackSb(m[1]); history.replaceState(null,"",location.pathname); if(!sbValid(d)) throw new Error("bad");
  if(!confirm("Відкрити спільну топологію ("+Object.keys(d.devs).length+" пристроїв)? Ваша поточна пісочниця буде замінена.")) return; d.ts=Date.now(); lsSet(LS.sandbox,d); if(store.mode==="db") queueWrite(()=>store.db.doc("sandbox/main").set({json:JSON.stringify(d),ts:d.ts})); openSandbox(d); }catch(e){ alert("Не вдалося відкрити посилання на топологію"); } }
function sbMutate(fn){ const d=CLI.saveNet(LAB.N,LAB.types); fn(d); d.ts=Date.now(); lsSet(LS.sandbox,d); if(store.mode==="db") queueWrite(()=>store.db.doc("sandbox/main").set({json:JSON.stringify(d),ts:Date.now()})); openSandbox(d); }
function sandboxEditor(){ const N=LAB.N; const names=Object.keys(N.dev);
  const opt=(arr,sel)=>arr.map(x=>`<option ${x===sel?"selected":""}>${esc(x)}</option>`).join("");
  const a=LAB.sbA||names[0], b=LAB.sbB||names[1];
  return `<div class="card"><h2>Пристрої та з'єднання</h2>
    <div class="row" style="flex-wrap:wrap;gap:6px"><button class="mini" data-act="sbadd" data-t="switch">+ 🔁 Комутатор</button><button class="mini" data-act="sbadd" data-t="l3">+ 🔁 L3-комутатор</button><button class="mini" data-act="sbadd" data-t="router">+ 🔀 Маршрутизатор</button><button class="mini" data-act="sbadd" data-t="pc">+ 💻 ПК</button><button class="mini" data-act="sbadd" data-t="server">+ 🗄 Сервер</button></div>
    ${names.length>=2?`<div class="sbl"><select id="sbA">${opt(names,a)}</select><select id="sbPA">${opt(CLI.freePorts(N,a))}</select><span>⟷</span><select id="sbB">${opt(names,b)}</select><select id="sbPB">${opt(CLI.freePorts(N,b))}</select><button class="primary mini" data-act="sblink">З'єднати</button></div>`:`<p class="small muted">Додайте щонайменше два пристрої.</p>`}
    ${N.links.length?`<details><summary class="small">З'єднання (${N.links.length})</summary>${N.links.map((l,k)=>`<div class="kv small"><span>${esc(l.a)} ${esc(l.pa)} ⟷ ${esc(l.b)} ${esc(l.pb)}</span><button class="mini ghost" data-act="sbunlink" data-k="${k}">✕</button></div>`).join("")}</details>`:""}
    <div class="row" style="margin-top:8px;flex-wrap:wrap;gap:6px"><button class="mini" data-act="sbshare">📤 Посилання</button><button class="mini" data-act="sbexport">⬇ JSON</button><label class="btnlike mini" style="padding:5px 10px">⬆ Імпорт JSON<input type="file" id="sbimport" accept=".json,application/json" hidden></label></div>
    ${names.length?`<details><summary class="small">Видалити пристрій</summary>${names.map(n=>`<div class="kv small"><span>${esc(n)}</span><button class="mini ghost" data-act="sbdel" data-n="${esc(n)}">✕</button></div>`).join("")}</details>`:""}</div>`; }
function openLab(id){
  const sc=ALLSCEN().find(s=>s.id===id); if(!sc) return;
  if(sc.net){ const {N,ses}=CLI.startNet(sc); const outs={}; for(const d of Object.keys(ses)) outs[d]= /^(pc|server)$/.test(N.dev[d].type)? "Microsoft Windows\n\n" : "\nPress RETURN to get started!\n\n";
    LAB={sc,N,ses,outs,cur:Object.keys(ses).find(d=>/^(pc|server)$/.test(N.dev[d].type))||Object.keys(ses)[0],hist:[],hi:0,res:"",showSol:false}; }
  else if(sc.bash) LAB={sc,N:null,ses:{[sc.hostname]:BASH.start(sc)},outs:{[sc.hostname]:"Ubuntu 24.04 LTS (тренажер). Введіть help для списку команд.\n\n"},cur:sc.hostname,hist:[],hi:0,res:"",showSol:false};
  else LAB={sc,N:null,ses:{[sc.hostname||"S1"]:CLI.startScenario(sc)},outs:{[sc.hostname||"S1"]:"\nPress RETURN to get started!\n\n"},cur:sc.hostname||"S1",hist:[],hi:0,res:"",showSol:false};
  view="lab"; render(); scrollTop();
}
const TK_WHO=["Олена, бухгалтерія","Ігор, відділ продажів","Марта, HR","Сервіс-деск (моніторинг)","Андрій, склад","Черговий NOC"];
function tkScore(tk,cmds,checks,gave){ const min=(Date.now()-tk.t0)/60000; if(gave) return 0;
  return Math.max(10,Math.round(100-Math.max(0,min-5)*3-Math.max(0,cmds-20)*0.7-Math.max(0,checks-1)*5)); }
// ---- Інтервальне повторення лаб: 7 → 21 → 60 днів після успішного виконання ----
const LAB_INT=[7,21,60];
function labDue(id,now){ const r=labs[id]; if(!r||!r.ok||String(id).startsWith("ts-")) return false; const last=r.last||r.done||r.ts||0; return (now||Date.now())-last>=LAB_INT[Math.min(r.reps||0,LAB_INT.length-1)]*864e5; }
function labNext(id,prev,ok){ const now=Date.now(); const rec=Object.assign({},prev,{ok:ok||!!prev.ok, tries:(prev.tries||0)+1, ts:now}); if(ok&&!prev.ok){ rec.done=now; rec.last=now; rec.reps=0; }
  else if(ok&&prev.ok){ if(labDue(id,now)) rec.reps=(prev.reps||0)+1; rec.last=now; } return rec; }
function labsDue(){ return ALLSCEN().filter(s=>!s.bash&&!s.sb&&TMAP[s.t]&&TMAP[s.t].g!=="LNX"&&labDue(s.id)).sort((a,b)=>(labs[a.id].last||labs[a.id].done||0)-(labs[b.id].last||labs[b.id].done||0)); }
function labRecord(id,ok){ const prev=labs[id]||{tries:0}; const rec=labNext(id,prev,ok); labs[id]=rec; patch({labs:{[id]:rec}}); }
function startTs(n,ticket){
  const pool=(CLI.NETSCEN||[]); let t=null, base=null;
  for(let k=0;k<10&&!t;k++){ base=pool[Math.floor(Math.random()*pool.length)]; t=CLI.troubleshoot(base,n); }
  if(!t){ alert("Не вдалося згенерувати поломку, спробуйте ще раз"); return; }
  if(ticket){ const fail=base.check(t.N).filter(x=>!x[0]).map(x=>x[1]); const id=1000+Math.floor(Math.random()*9000); const who=TK_WHO[Math.floor(Math.random()*TK_WHO.length)]; const pr=fail.length>2?"P1 — критичний":fail.length>1?"P2 — високий":"P3 — середній";
    const sc=Object.assign({},base,{id:"ts-"+base.id,title:"🎫 Тікет #"+id+": "+base.title,task:["Від: "+who+" · Пріоритет: "+pr,"Скарга: «Після вчорашніх робіт у мережі перестало працювати:»"].concat(fail.map(x=>"• "+x)).concat(["Усе інше, що працювало, має працювати і далі. Час іде від відкриття тікета; на оцінку впливають час, кількість команд і невдалі перевірки.","Почніть з відтворення проблеми (ping/tracert з ПК), потім звужуйте: фізичний рівень → L2 → L3 → політики."])});
    const outs={}; for(const d of Object.keys(t.ses)) outs[d]= /^(pc|server)$/.test(t.N.dev[d].type)? "Microsoft Windows\n\n" : "\nPress RETURN to get started!\n\n";
    LAB={sc,N:t.N,ses:t.ses,outs,cur:Object.keys(t.ses).find(d=>/^(pc|server)$/.test(t.N.dev[d].type))||Object.keys(t.ses)[0],hist:[],hi:0,res:"",showSol:false,ts:{n,faults:t.faults,tk:{id,t0:Date.now(),checks:0}}};
    view="lab"; render(); scrollTop(); return; }
  const sc=Object.assign({},base,{id:"ts-"+base.id,title:"🛠 Знайди поломку: "+base.title,task:["Ця мережа була повністю налаштована й працювала. Потім щось зламали ("+(n>1?"кілька змін":"одна зміна")+").","Вимоги, які мають знову виконуватися:"].concat(base.check(CLI.solveNet(base)).map(x=>"• "+x[1])).concat(["Діагностуйте: ping/tracert з ПК, show ip interface brief, show run, show vlan brief, show interfaces trunk, show ip route, show ip ospf neighbor, show access-lists…"])});
  const outs={}; for(const d of Object.keys(t.ses)) outs[d]= /^(pc|server)$/.test(t.N.dev[d].type)? "Microsoft Windows\n\n" : "\nPress RETURN to get started!\n\n";
  LAB={sc,N:t.N,ses:t.ses,outs,cur:Object.keys(t.ses).find(d=>/^(pc|server)$/.test(t.N.dev[d].type))||Object.keys(t.ses)[0],hist:[],hi:0,res:"",showSol:false,ts:{n,faults:t.faults}};
  view="lab"; render(); scrollTop();
}
function checkLab(){
  const r= LAB.sc.net? LAB.sc.check(LAB.N) : LAB.sc.check(LAB.ses[LAB.cur].state); const ok=r.every(x=>x[0]);
  LAB.res=`<div class="card"><h2>${ok?"✅ Усе виконано!":"Ще не все"}</h2><ul class="checklist">${r.map(([v,t])=>`<li>${v?"✅":"❌"} ${esc(t)}</li>`).join("")}</ul></div>`;
  const prev=labs[LAB.sc.id]||{tries:0}; const rec=labNext(LAB.sc.id,prev,ok);
  if(LAB.ts){ rec.solved=(prev.solved||0)+(ok&&!LAB.ts.done&&!LAB.showSol?1:0);
    const tk=LAB.ts.tk; if(tk&&!LAB.ts.done){ tk.checks++; if(ok){ const sc=tkScore(tk,LAB.hist.length,tk.checks,LAB.showSol); tk.score=sc; tk.min=Math.round((Date.now()-tk.t0)/6000)/10; const p=prev.tk||{n:0,best:0,sum:0}; rec.tk={n:p.n+1,best:Math.max(p.best||0,sc),sum:(p.sum||0)+sc,last:sc}; } }
    else if(prev.tk) rec.tk=prev.tk;
    if(ok) LAB.ts.done=true; }
  const tk=LAB.ts&&LAB.ts.tk; if(tk&&ok&&tk.score!=null) LAB.res=`<div class="card"><h2>🎫 Тікет #${tk.id} закрито</h2><div class="kv"><span>Оцінка</span><b>${tk.score}/100</b></div><div class="kv"><span>Час</span><span>${tk.min} хв</span></div><div class="kv"><span>Команд</span><span>${LAB.hist.length}</span></div><div class="kv"><span>Перевірок</span><span>${tk.checks}</span></div><p class="small muted" style="margin:6px 0 0">Що було зламано: ${LAB.ts.faults.map(esc).join("; ")}</p></div>`+LAB.res;
  labs[LAB.sc.id]=rec; patch({labs:{[LAB.sc.id]:rec}}); $("#labres").innerHTML=LAB.res;
}

// ---------- Лаба Ansible (ENSA14) ----------
let ANS=null;
function ansInit(){ if(!ANS) ANS={lab:ANSIBLE.newLab(),src:lsGet("ccna.ansible.src",ANSIBLE.SAMPLE),out:"",dev:"S1"}; return ANS; }
function ansProgress(){ const A=ansInit(); const done=ANSIBLE.TASKS.filter(t=>t.ok(A.lab)).map(t=>t.id); const prev=labs.ansible||{};
  const all=[...new Set((prev.ids||[]).concat(done))]; const rec={ok:all.length===ANSIBLE.TASKS.length||!!prev.ok,n:all.length,ids:all,tries:(prev.tries||0)+1,ts:Date.now()}; if(rec.ok&&!prev.ok) rec.done=Date.now();
  labs.ansible=rec; patch({labs:{ansible:rec}}); }
VIEWS.ansible={ html:()=>{ const A=ansInit(); const ids=new Set((labs.ansible||{}).ids||[]);
  return `<div class="card"><h2>🤖 Ansible: плейбуки для Cisco IOS</h2><p class="small muted" style="margin:0 0 8px">Ansible — агентless: керуючий вузол підключається до пристроїв по SSH (network_cli) і виконує завдання з YAML-плейбука. Тут плейбук виконується на маршрутизаторі R1 і комутаторах S1, S2 симулятора. Модулі: <code>cisco.ios.ios_command</code> (show-команди), <code>cisco.ios.ios_config</code> (<code>lines</code>, <code>parents</code>, <code>save_when</code>), <code>debug</code>; є <code>vars</code>, <code>loop</code>, <code>register</code> і <code>{{ змінні }}</code>.</p>
   <ul class="checklist">${ANSIBLE.TASKS.map(t=>`<li>${t.ok(A.lab)||ids.has(t.id)?"✅":"⬜"} ${esc(t.t)}</li>`).join("")}</ul>
   <details><summary class="small muted">Інвентар (inventory.ini)</summary><pre>${esc(ANSIBLE.INVENTORY)}</pre></details></div>
  <div class="card"><h2>site.yml</h2><textarea id="ansrc" rows="18" spellcheck="false" style="width:100%;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;white-space:pre">${esc(A.src)}</textarea>
   <div class="row" style="margin-top:8px"><button class="primary" data-act="ansrun">▶ ansible-playbook -i inventory.ini site.yml</button><button data-act="anssample">Приклад</button><button data-act="ansreset">Скинути мережу</button></div>
   <p class="small muted" style="margin:6px 0 0">Відступи — лише пробіли (2 на рівень). Списки — через «- », словники — «ключ: значення».</p></div>
  ${A.out?`<div class="term" id="ansout" style="max-height:none">${esc(A.out)}</div>`:""}
  <div class="card"><h2>Стан пристроїв</h2><div class="chips">${ANSIBLE.GROUPS.all.map(d=>`<button class="seg ${A.dev===d?"on":""}" data-act="ansdev" data-d="${d}">${d}</button>`).join("")}</div><pre style="max-height:260px;overflow:auto">${esc(ansShowRun(A))}</pre></div>
  <button class="ghost" data-act="labs">← До списку лаб</button>`; } };
function ansShowRun(A){ const s=A.lab.ses[A.dev]; s.exec("end"); s.exec("enable"); return s.exec("show running-config"); }
const ansSync=()=>{ const t=$("#ansrc"); if(t&&ANS){ ANS.src=t.value; lsSet("ccna.ansible.src",ANS.src); } };
ACTS.ansible=()=>{ view="ansible"; render(); scrollTop(); };
ACTS.ansrun=()=>{ ansSync(); const r=ANSIBLE.run(ANS.lab,ANS.src); ANS.out="$ ansible-playbook -i inventory.ini site.yml\n\n"+r.text; ansProgress(); render(); const o=$("#ansout"); if(o) o.scrollIntoView({block:"start"}); };
ACTS.anssample=()=>{ if(!confirm("Замінити плейбук прикладом?")) return; ANS.src=ANSIBLE.SAMPLE; lsSet("ccna.ansible.src",ANS.src); render(); };
ACTS.ansreset=()=>{ ansSync(); ANS.lab=ANSIBLE.newLab(); ANS.out=""; render(); };
ACTS.ansdev=el=>{ ansSync(); ANS.dev=el.dataset.d; render(); };
