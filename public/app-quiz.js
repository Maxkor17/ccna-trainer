"use strict";
// Навчання (FSRS), сесії, рендеринг питань. Файли app-*.js — звичайні скрипти зі спільною глобальною областю; порядок підключення див. index.html.
// ================= Навчання =================
// ---- FSRS-4.5: планування повторень (як у сучасному Anki) ----
const FW=[0.4872,1.4003,3.7145,13.8206,5.1618,1.2298,0.8975,0.031,1.6474,0.1367,1.0461,2.1072,0.0793,0.3246,1.587,0.2272,2.8755], F_DECAY=-0.5, F_FACTOR=19/81, F_RET=0.9;
const fClampD=d=>Math.min(10,Math.max(1,d)); const fD0=g=>fClampD(FW[4]-(g-3)*FW[5]);
const fR=(t,S)=>Math.pow(1+F_FACTOR*t/S,F_DECAY); const fInterval=S=>Math.max(1,Math.round(S/F_FACTOR*(Math.pow(F_RET,1/F_DECAY)-1)));
function fsrsNext(r,ok,now){ const g=ok?3:1; let f=r.fs;
  if(!f){ if(r.s>0&&r.l){ f={S:Math.max(0.5,[0.5,1,3,7,16,35][Math.min(5,r.b||0)]),D:5}; } else { return {S:FW[g-1],D:fD0(g)}; } }
  const t=Math.max(0,(now-(r.l||now))/DAY); const R=fR(t,f.S); let D=fClampD(FW[7]*fD0(3)+(1-FW[7])*(f.D-FW[6]*(g-3))); let S;
  if(ok) S=f.S*(Math.exp(FW[8])*(11-f.D)*Math.pow(f.S,-FW[9])*(Math.exp(FW[10]*(1-R))-1)+1);
  else S=Math.min(f.S,FW[11]*Math.pow(f.D,-FW[12])*(Math.pow(f.S+1,FW[13])-1)*Math.exp(FW[14]*(1-R)));
  return {S:Math.max(0.1,Math.round(S*100)/100),D:Math.round(D*100)/100}; }
function record(id, ok){
  const now=Date.now();
  const r = prog[id] ? Object.assign({},prog[id]) : {s:0,c:0,w:0,b:0,d:0,l:0,k:0};
  r.fs=fsrsNext(r,ok,now); r.s++; r.l=now;
  if(ok){ r.c++; r.b=Math.min(r.b+1,5); r.d=now+fInterval(r.fs.S)*DAY; r.k=1; } else { r.w++; r.b=0; r.d=now+10*60000; r.k=0; }
  prog[id]=r;
  const dk=dkey(); const dd=Object.assign({n:0,c:0},daily[dk]); dd.n++; if(ok) dd.c++; daily[dk]=dd;
  patch({q:{[id]:r}, daily:{[dk]:dd}});
}
function langOk(q){ if(opts.src==="en") return true; if(opts.lang==="en") return true; if(opts.lang==="uk") return q.src!=="en"; return true; }
function qsFor(topics){ const base=QB.filter(q=>topics.has(q.t) && (opts.src==="all" || q.src===opts.src)); const l=base.filter(langOk); return l.length? l : base; }
let GLRE=null;
function annotate(html){ const G=window.GLOSSARY||[]; if(!GLRE) GLRE=G.slice().sort((a,b)=>b[0].length-a[0].length).map(([ua,en])=>[new RegExp("(^|[^\\p{L}])("+ua.split(" ").map(w=>w.length>4? w.slice(0,Math.max(4,w.length-2)).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\p{L}*" : w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("\\s+")+")","iu"),en]);
  let n=0; for(const [re,en] of GLRE){ if(n>=3) break; if(re.test(html)){ html=html.replace(re,(m,p,w)=>p+w+' <span class="en">('+esc(en)+')</span>'); n++; } } return html; }
function renderGlossary(){ const qv=(window._glq||"").toLowerCase(); const G=(window.GLOSSARY||[]).filter(g=>!qv||g[0].includes(qv)||g[1].toLowerCase().includes(qv));
  return `<div class="card"><h2>🇬🇧 Словник термінів UA ↔ EN</h2><p class="small muted" style="margin:0 0 8px">Іспит CCNA складають англійською. ${(window.GLOSSARY||[]).length} термінів у формулюваннях Cisco.</p><input type="search" id="glq" placeholder="пошук: шлюз, trunk, area…" value="${esc(window._glq||"")}" autocomplete="off">
    <div class="row" style="margin-top:8px"><button class="primary" data-act="gen" data-k="g-term">Тренувати терміни</button><button data-act="enquiz">Питання англійською (${QB.filter(q=>q.src==="en").length})</button></div></div>
  <div class="card"><table class="cheat"><tr><th>Українською</th><th>English</th><th>Тема</th></tr>${G.map(g=>`<tr><td>${esc(g[0])}</td><td><b>${esc(g[1])}</b></td><td class="small">${tlabel(g[2])}</td></tr>`).join("")}</table></div>
  <button class="primary" data-act="home">На головну</button>`; }
function genKeysFor(topics){ return opts.src!=="all"? [] : GEN.forTopics(topics); }
function reviewQueue(){
  const now=Date.now(); const out=[];
  for(const [id,r] of Object.entries(prog)){ if(!(r.w>0 && r.b<5 && r.d<=now)) continue;
    if(QMAP[id]) out.push(QMAP[id]); else if(TID2GEN[id]||GEN.list[id]){ const g=GEN.make(TID2GEN[id]||id); if(g) out.push(g); } }
  return out;
}
function topicStats(tid){
  const qs=QB.filter(q=>q.t===tid); let c=0,w=0,seen=0,mast=0;
  for(const q of qs){const r=prog[q.id]; if(r){seen++;c+=r.c;w+=r.w; if(r.b>=3) mast++;}}
  for(const [g,t] of Object.entries(GEN.topicOf)) if(t===tid && prog[g]){ c+=prog[g].c; w+=prog[g].w; }
  return {n:qs.length, seen, acc:(c+w)? c/(c+w): null, mast, gen:Object.values(GEN.topicOf).includes(tid)};
}
// Адаптивна складність: теми з точністю > 85% (≥ 10 відповідей) отримують спершу складніші формати,
// слабкі (< 60%) — спершу прості питання з однією відповіддю.
function qHard(q){ const t=qtype(q); return t==="simlet"?3:(t==="cmd"||t==="fill")?2.5:(t==="order"||t==="match"||t==="cat")?2:(Array.isArray(q.a)&&q.a.length>1)?1.5:q.fig?1:t==="flash"?-1:0; }
function topicLevel(tid){ const st=topicStats(tid); const ans=Object.entries(prog).filter(([id])=>topicOfId(id)===tid).reduce((a,[,r])=>a+(r.c||0)+(r.w||0),0);
  if(st.acc==null||ans<10) return 0; return st.acc>0.85?1:st.acc<0.6?-1:0; }
function pickTraining(topics, n){
  const now=Date.now(); const b=[[],[],[],[]]; const lv={}; for(const t of topics) lv[t]=topicLevel(t);
  for(const q of qsFor(topics)){ const r=prog[q.id];
    if(!r) b[1].push(q); else if(r.k===0 && r.d<=now) b[0].push(q); else if(r.d<=now) b[2].push(q); else b[3].push(q); }
  const adapt=arr=>arr.map((q,i)=>[q,i]).sort((x,y)=>{ const lx=lv[x[0].t]||0, ly=lv[y[0].t]||0; const hx=lx*qHard(x[0]), hy=ly*qHard(y[0]); return hy-hx||x[1]-y[1]; }).map(x=>x[0]);
  let all=[].concat(...b.map(x=>adapt(shuffle(x))));
  const gk=genKeysFor(topics);
  const want = n>0? n : all.length;
  const ng = gk.length? Math.max(1, Math.round(want*0.2)) : 0;
  all = all.slice(0, want-ng);
  for(let i=0;i<ng;i++){ const g=GEN.make(gk[i%gk.length]); if(g) all.splice(Math.floor(Math.random()*(all.length+1)),0,g); }
  return all;
}
const correctSet=q=>new Set(q.a);
function isCorrect(q, ans){
  const t=qtype(q);
  if(t==="mc"){ const ch=ans||[]; const cs=correctSet(q); return ch.length===cs.size && ch.every(i=>cs.has(i)); }
  if(t==="order") return Array.isArray(ans) && ans.length===q.items.length && ans.every((v,i)=>v===i);
  if(t==="match") return Array.isArray(ans) && q.pairs.every((p,i)=>ans[i]===p[1]);
  if(t==="cat") return Array.isArray(ans) && q.items.every((x,i)=>ans[i]===x[1]);
  if(t==="cmd") return typeof ans==="string" && q.ans.some(c=>cmdMatch(ans,c));
  if(t==="sim") return !!(ans&&ans.ok);
  if(t==="simlet") return Array.isArray(ans) && q.parts.every((p,i)=>{ const c=ans[i]||[]; return c.length===p.a.length && c.every(x=>p.a.includes(x)); });
  if(t==="flash") return ans==="yes";
  if(t==="fill"){ const bl=fillBlanks(q); return Array.isArray(ans) && bl.every((alts,i)=>typeof ans[i]==="string"&&alts.some(c=>fillEq(ans[i],c))); }
  return false;
}
function fillBlanks(q){ return [...q.cfg.matchAll(/\[\[(.+?)\]\]/g)].map(m=>m[1].split("|")); }
function fillEq(u,c){ u=(u||"").trim(); if(!u) return false; if(/^[\d.\/]+$/.test(c)) return u===c; return u.toLowerCase()===c.toLowerCase() || cmdMatch(u,c); }
function hasAnswer(q,ans){ const t=qtype(q); if(t==="cat") return Array.isArray(ans)&&q.items.every((_,i)=>ans[i]!=null); if(t==="sim") return !!(ans&&ans.done); if(t==="simlet") return Array.isArray(ans)&&q.parts.every((p,i)=>(ans[i]||[]).length===p.a.length); if(t==="flash") return ans==="yes"||ans==="no"; if(t==="fill") return Array.isArray(ans)&&fillBlanks(q).every((_,i)=>ans[i]&&ans[i].trim()); if(t==="cmd") return !!(ans&&ans.trim()); if(t==="match") return Array.isArray(ans)&&ans.filter(Boolean).length===q.pairs.length; if(t==="order") return Array.isArray(ans)&&ans.length===q.items.length; return Array.isArray(ans)&&ans.length===q.a.length; }
function cmdMatch(input, canon){
  const norm=s=>s.trim().toLowerCase().replace(/\s*,\s*/g,",").replace(/\s+-\s+/g," - ");
  let u=norm(input).split(/\s+/), c=norm(canon).split(/\s+/);
  const join=arr=>{ const o=[]; for(let i=0;i<arr.length;i++){ if(/^[a-z-]+$/.test(arr[i]) && arr[i+1] && /^\d+(\/\d+)*$/.test(arr[i+1]) && CLI.normIf(arr[i]+arr[i+1]) && o.length && "interfaces".startsWith(o[o.length-1])){ o.push(arr[i]+arr[i+1]); i++; } else o.push(arr[i]); } return o; };
  u=join(u); c=join(c);
  if(u.length!==c.length) return false;
  return c.every((ct,i)=>{ const ut=u[i];
    if(/\d/.test(ct)){ const a=CLI.normIf(ut), b=CLI.normIf(ct); if(a&&b) return a===b; return ut===ct; }
    return ut===ct || (ut.length>=2 && ct.startsWith(ut)); });
}

// ================= Сесії =================
function startSession(mode, list, title){
  if(!list.length) return;
  S={mode, title, items:list, i:0, ans:{}, checked:{}, order:{}, start:Date.now(), deadline: mode==="exam"? Date.now()+list.length*60*1000 : null, confirmEnd:false};
  list.forEach((q,k)=>{ const t=qtype(q);
    if(t==="mc") S.order[k]=opts.shuffle? shuffle(q.o.map((_,i)=>i)) : q.o.map((_,i)=>i);
    if(t==="simlet") S.order[k]=q.parts.map(p=>opts.shuffle? shuffle(p.o.map((_,i)=>i)) : p.o.map((_,i)=>i));
    if(t==="order"){ let o=shuffle(q.items.map((_,i)=>i)); if(o.every((v,i)=>v===i)) o.reverse(); S.order[k]=o; }
    if(t==="match") S.order[k]=q.choices? q.choices.slice() : shuffle([...new Set(q.pairs.map(p=>p[1]))]);
    if(t==="cat") S.order[k]=shuffle(q.items.map((_,i)=>i));
  });
  view="quiz"; render(); scrollTop(); if(mode==="exam") tick();
}
function tick(){ if(!S||S.mode!=="exam"||view!=="quiz") return; const left=S.deadline-Date.now(); const el=$("#timer"); if(el) el.textContent=fmtLeft(left); if(left<=0){finishExam();return;} setTimeout(tick,1000); }
function fmtLeft(ms){ms=Math.max(0,ms);const m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000);return m+":"+String(s).padStart(2,"0");}
function scrollTop(){try{window.scrollTo(0,0);}catch(e){}}
function examLangRestore(){ if(S&&S.en&&S.enPrev!=null){ const p=S.enPrev; S.enPrev=null; if(opts.lang!==p){ opts.lang=p; rebuildQB(); } } }
function qtMark(){ if(!S||S.mode!=="exam") return; const now=Date.now(); S.tq=S.tq||{}; if(S.tk!=null) S.tq[S.tk]=(S.tq[S.tk]||0)+(now-S.tt); S.tk=S.i; S.tt=now; }
function finishExam(){
  if(!S) return; qtMark(); const per={}; let ok=0;
  S.items.forEach((q,k)=>{ const a=S.ans[k]; const good=isCorrect(q,a); if(good) ok++; per[q.t]=per[q.t]||[0,0]; per[q.t][1]++; if(good) per[q.t][0]++; if(hasAnswer(q,a)) record(recId(q),good); });
  const e={ts:Date.now(), n:S.items.length, correct:ok, pct:Math.round(ok/S.items.length*100), dur:Math.round((Date.now()-S.start)/1000), per, ccna:!!S.ccna, bp:S.bp||null,
    en:!!S.en, tq:S.items.map((_,k)=>Math.round(((S.tq||{})[k]||0)/1000)), tok:S.items.map((q,k)=>isCorrect(q,S.ans[k])?1:0), tt:S.items.map(q=>q.t),
    ids:S.items.map(q=>q.gen?null:q.id), ans:Object.fromEntries(Object.entries(S.ans).filter(([k])=>!S.items[k].gen).map(([k,v])=>[S.items[k].id,v]))};
  saveExam(e); S.result=e; examLangRestore(); view="result"; render(); scrollTop();
}

// ================= Рендеринг: питання =================
const letters="ABCDEFGH";
function flagBtn(q){ const id=recId(q); const fl=flags[id]; const f=!!(fl&&fl.on&&fl.kind!=="err"), er=!!(fl&&fl.on&&fl.kind==="err");
  return `<div class="row" style="gap:6px;flex-wrap:wrap"><button class="flagbtn ${f?"on":""}" data-act="flag" data-id="${esc(id)}" data-snip="${esc(q.q.slice(0,140))}">${f?"⚑ Позначено як сумнівне":"⚐ Позначити як сумнівне"}</button><button class="flagbtn ${er?"on":""}" data-act="flagerr" data-id="${esc(id)}" data-snip="${esc(q.q.slice(0,140))}">${er?"⚠ Позначено: помилка в питанні":"⚠ Помилка в питанні"}</button></div>`+
  ((f||er)?`<div class="row"><input type="text" id="flagnote" placeholder="${er?"Що саме неправильно? Яка правильна відповідь і чому?":"Що не так? (необов'язково)"}" value="${esc(fl.note||"")}"><button class="mini" data-act="flagnote" data-id="${esc(id)}">Зберегти</button></div>`:""); }
// Схема топології: nodes [{id,t:"r"|"sw"|"pc"|"srv"|"cloud",x,y,l}], links [{a,b,la,lb,m,dash}] у координатах 0..100 × 0..60
function topoSVG(f){
  const W=400,H=Math.round(240*(f.h||60)/60), X=x=>20+x*3.6, Y=y=>18+y*3.4;
  const N={}; for(const n of f.nodes) N[n.id]=n;
  let g="";
  for(const l of f.links){ const a=N[l.a], b=N[l.b]; let x1=X(a.x),y1=Y(a.y),x2=X(b.x),y2=Y(b.y);
    if(l.off){ const dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy)||1, ox=-dy/len*l.off, oy=dx/len*l.off; x1+=ox; x2+=ox; y1+=oy; y2+=oy; }
    g+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(${l.c||"--muted"})" stroke-width="${l.w||2}" ${l.dash?'stroke-dasharray="5 4"':""}/>`;
    const lab=(t,fx,fy)=>t?`<text x="${fx}" y="${fy}" font-size="10" text-anchor="middle" fill="var(--text)" paint-order="stroke" stroke="var(--card)" stroke-width="3">${esc(t)}</text>`:"";
    const fr=0.24+(l.li||0)*0.14; g+=lab(l.la,x1+(x2-x1)*fr,y1+(y2-y1)*fr-4)+lab(l.lb,x2+(x1-x2)*fr,y2+(y1-y2)*fr-4)+lab(l.m,(x1+x2)/2,(y1+y2)/2+(l.mdy||12));
  }
  for(const n of f.nodes){ const x=X(n.x), y=Y(n.y); let ic=n.hl?`<circle cx="${x}" cy="${y}" r="25" fill="var(--warn)" opacity=".28"><animate attributeName="r" values="21;27;21" dur="1.2s" repeatCount="indefinite"/></circle>`:"";
    if(n.t==="r") ic+=`<circle cx="${x}" cy="${y}" r="15" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2"/><path d="M${x-8} ${y}h16M${x} ${y-8}v16" stroke="var(--accent)" stroke-width="2"/>`;
    else if(n.t==="sw") ic+=`<rect x="${x-18}" y="${y-11}" width="36" height="22" rx="4" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2"/><path d="M${x-10} ${y-3}h20M${x-10} ${y+4}h20" stroke="var(--accent)" stroke-width="1.6"/>`;
    else if(n.t==="srv") ic+=`<rect x="${x-10}" y="${y-14}" width="20" height="28" rx="3" fill="var(--code)" stroke="var(--muted)" stroke-width="2"/><path d="M${x-6} ${y-6}h12M${x-6} ${y}h12" stroke="var(--muted)" stroke-width="1.5"/>`;
    else if(n.t==="hub") ic+=`<rect x="${x-14}" y="${y-8}" width="28" height="16" rx="3" fill="var(--code)" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 2"/><text x="${x}" y="${y+4}" font-size="8" text-anchor="middle" fill="var(--muted)">HUB</text>`;
    else if(n.t==="cloud") ic+=`<ellipse cx="${x}" cy="${y}" rx="24" ry="13" fill="var(--code)" stroke="var(--muted)" stroke-width="2"/>`;
    else ic+=`<rect x="${x-13}" y="${y-10}" width="26" height="17" rx="2" fill="var(--code)" stroke="var(--muted)" stroke-width="2"/><path d="M${x-6} ${y+11}h12" stroke="var(--muted)" stroke-width="2"/>`;
    g+=ic+`<text x="${x}" y="${y+(n.t==="srv"?27:25)}" font-size="11" font-weight="600" text-anchor="middle" fill="var(--text)">${esc(n.l||n.id)}</text>`+(n.sub?`<text x="${x}" y="${y+38}" font-size="9.5" text-anchor="middle" fill="var(--muted)">${esc(n.sub)}</text>`:"");
  }
  return `<div class="topo"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Схема топології">${g}</svg></div>`;
}
// ---- Практичні CLI-завдання всередині тестів (як на справжньому CCNA) ----
const SIM_POOL=["lab-vlan","lab-trunk","lab-ssh","lab-ec","lab-root","net-roas","net-static","net-acl-std","net-ospf","net-nat","net-dhcp","net-hsrp","net-ipv6"];
function simQ(id){ const sc=ALLSCEN().find(x=>x.id===id); return sc? {id:"sim-"+id,type:"sim",t:sc.t,q:"🖥 Практичне завдання: "+sc.title,sc:id,gen:true} : null; }
function simState(k){ S.sim=S.sim||{}; if(S.sim[k]) return S.sim[k]; const sc=ALLSCEN().find(x=>x.id===S.items[k].sc);
  if(sc.net){ const {N,ses}=CLI.startNet(sc); const outs={}; for(const d of Object.keys(ses)) outs[d]=""; S.sim[k]={sc,N,ses,outs,cur:Object.keys(ses).find(d=>/^(router|switch)$/.test(N.dev[d].type))||Object.keys(ses)[0]}; }
  else { const nm=sc.hostname||"S1"; S.sim[k]={sc,N:null,ses:{[nm]:CLI.startScenario(sc)},outs:{[nm]:""},cur:nm}; }
  return S.sim[k]; }
function simBody(q,k,ans,checked,interactive){
  const sc=ALLSCEN().find(x=>x.id===q.sc); if(!sc) return "";
  let h=`<ol class="small" style="padding-left:20px;margin:4px 0 8px">${sc.task.map(t=>`<li>${esc(t)}</li>`).join("")}</ol>`;
  if(!checked&&interactive&&!(ans&&ans.done)){ const st=simState(k); const fig=st.N?CLI.figOf(st.N,[st.cur]):null;
    h+=(fig?topoSVG(fig):"")+(Object.keys(st.ses).length>1?`<div class="chips">${Object.keys(st.ses).map(d=>`<button class="seg ${st.cur===d?"on":""}" data-act="simdev" data-d="${d}">${d}</button>`).join("")}</div>`:"")+
      `<div class="term" id="simterm" style="height:200px">${esc(st.outs[st.cur]||"")}</div><div class="termin"><span id="simprompt">${esc(st.ses[st.cur].prompt())}</span><input id="simin" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send"></div>
      <div class="row" style="margin-top:8px"><button class="primary" data-act="simdone">Завершити завдання</button><span class="small muted">Оцінюється результат конфігурації, а не окремі команди.</span></div>`; }
  else if(ans&&ans.res) h+=`<ul class="checklist">${ans.res.map(([v,t])=>`<li>${v?"✅":"❌"} ${esc(t)}</li>`).join("")}</ul>${checked||!interactive?`<details><summary class="small">Еталонне рішення</summary><pre>${esc(sc.sol)}</pre></details>`:""}`;
  else if(ans&&ans.done) h+=`<p class="small muted">Завдання завершено — результат буде після екзамену.</p>`;
  return h; }
function renderBody(q, k, ans, checked, interactive){
  if(qtype(q)==="sim") return simBody(q,k,ans,checked,interactive);
  const t=qtype(q); let h="";
  if(t==="simlet"){ const A=ans||[];
    h+=`<div class="simx">${q.ex.map(([title,out],i)=>`<details ${i<2?"open":""}><summary class="small"><b>${esc(title)}</b></summary><pre>${esc(out)}</pre></details>`).join("")}</div>`;
    h+=q.parts.map((p,pi)=>{ const ch=A[pi]||[]; const cs=new Set(p.a);
      const ord=(S&&S.order[k]&&S.order[k][pi])||p.o.map((_,i)=>i);
      return `<div class="simq"><div style="margin:12px 0 6px"><b>${pi+1}.</b> ${esc(p.q)}${p.a.length>1?` <span class="small muted">(оберіть ${p.a.length})</span>`:""}</div>`+ord.map((oi,pos)=>{ const [text,ex]=p.o[oi]; let cls="opt"; const sel=ch.includes(oi);
        if(checked){ cls+=" locked"; if(cs.has(oi)) cls+=sel?" ok":" miss"; else if(sel) cls+=" bad"; } else if(sel) cls+=" sel"; const tag=interactive&&!checked?"button":"div";
        return `<${tag} class="${cls}" ${tag==="button"?`data-act="spick" data-p="${pi}" data-i="${oi}"`:""}><span class="mk">${letters[pos]}.</span>${esc(text)}${checked?`<span class="ex">${cs.has(oi)?"✅ ":"❌ "}${esc(ex)}</span>`:""}</${tag}>`; }).join("")+`</div>`; }).join("");
  }
  if(t==="mc"){
    const order=S&&S.order[k]? S.order[k] : q.o.map((_,i)=>i); const chosen=ans||[]; const cs=correctSet(q);
    if(q.a.length>1) h+=`<div class="small muted">Оберіть ${q.a.length}.</div>`;
    h+=order.map((oi,pos)=>{ const [text,ex]=q.o[oi]; let cls="opt"; const isSel=chosen.includes(oi);
      if(checked){ cls+=" locked"; if(cs.has(oi)) cls+=isSel?" ok":" miss"; else if(isSel) cls+=" bad"; } else if(isSel) cls+=" sel";
      const tag=interactive&&!checked?"button":"div";
      return `<${tag} class="${cls}" ${tag==="button"?`data-act="pick" data-i="${oi}"`:""}><span class="mk">${letters[pos]}.</span>${esc(text)}${checked?`<span class="ex">${cs.has(oi)?"✅ ":"❌ "}${esc(ex)}</span>`:""}</${tag}>`; }).join("");
  }
  if(t==="order"){
    const seq=ans||[]; const avail=(S&&S.order[k]||q.items.map((_,i)=>i)).filter(i=>!seq.includes(i));
    if(!checked){
      h+=`<div class="small muted">Торкайтеся елементів у правильному порядку. Торкніться елемента у списку, щоб прибрати його.</div>`;
      h+=`<div class="seq">${seq.map((i,p)=>`<button class="tok" data-act="unord" data-i="${i}"><span class="n">${p+1}.</span>${esc(q.items[i])}</button>`).join("")||`<span class="small muted" style="padding:6px">Ваша послідовність…</span>`}</div>`;
      h+=`<div class="chips">${avail.map(i=>`<button class="tok" data-act="ord" data-i="${i}">${esc(q.items[i])}</button>`).join("")}</div>`;
    } else {
      h+=`<div class="small muted">Ваша послідовність:</div><div class="seq">${seq.map((i,p)=>`<div class="tok" style="border-color:var(${i===p?"--ok":"--bad"})"><span class="n">${p+1}.</span>${i===p?"✅":"❌"} ${esc(q.items[i])}</div>`).join("")||`<span class="small muted">Без відповіді</span>`}</div>`;
      h+=`<div class="small muted">Правильний порядок:</div><div class="seq">${q.items.map((x,p)=>`<div class="tok"><span class="n">${p+1}.</span>${esc(x)}</div>`).join("")}</div>`;
    }
  }
  if(t==="cat"){ const a=ans||[]; const ord=(S&&S.order[k])||q.items.map((_,i)=>i); const sel=S&&S.catSel;
    if(!checked&&interactive){ const pool=ord.filter(i=>a[i]==null);
      h+=`<div class="small muted">Перетягніть кожен елемент у категорію (або торкніться елемента, потім категорії).</div><div class="chips catpool" data-catdrop="-1">${pool.map(i=>`<button class="tok ${sel===i?"on":""}" draggable="true" data-act="catpick" data-i="${i}">${esc(q.items[i][0])}</button>`).join("")||`<span class="small muted">Усі елементи розкладено ✔</span>`}</div>
        <div class="catgrid">${q.cats.map((c,ci)=>`<div class="catbox ${sel!=null?"ready":""}" data-act="catdrop" data-c="${ci}" data-catdrop="${ci}"><div class="cath">${esc(c)}</div>${ord.filter(i=>a[i]===ci).map(i=>`<button class="tok" draggable="true" data-act="catback" data-i="${i}" title="Повернути">${esc(q.items[i][0])} ✕</button>`).join("")}</div>`).join("")}</div>`; }
    else h+=`<div class="catgrid">${q.cats.map((c,ci)=>`<div class="catbox"><div class="cath">${esc(c)}</div>${ord.filter(i=>a[i]===ci).map(i=>{ const ok=q.items[i][1]===ci; return `<div class="tok" style="border-color:var(${ok?"--ok":"--bad"})">${ok?"✅":"❌"} ${esc(q.items[i][0])}${ok?"":`<span class="small" style="color:var(--ok)"> → ${esc(q.cats[q.items[i][1]])}</span>`}</div>`; }).join("")}</div>`).join("")}</div>${ord.some(i=>a[i]==null)?`<div class="small muted">Не розкладено: ${ord.filter(i=>a[i]==null).map(i=>esc(q.items[i][0])+" → "+esc(q.cats[q.items[i][1]])).join("; ")}</div>`:""}`; }
  if(t==="match"){
    const rights=(S&&S.order[k])||q.choices||[...new Set(q.pairs.map(p=>p[1]))]; const a=ans||[];
    h+=q.pairs.map((p,i)=>{ const v=a[i]||"";
      if(!checked) return `<div class="mrow"><div class="l">${esc(p[0])}</div><select data-act="match" data-i="${i}"><option value="">— оберіть —</option>${rights.map(r=>`<option ${r===v?"selected":""}>${esc(r)}</option>`).join("")}</select></div>`;
      const ok=v===p[1]; return `<div class="mrow"><div class="l">${esc(p[0])}</div><div>${ok?"✅":"❌"} ${esc(v||"—")}${ok?"":`<br><span class="small" style="color:var(--ok)">Правильно: ${esc(p[1])}</span>`}</div></div>`; }).join("");
  }
  if(t==="cmd"){
    if(!checked && interactive) h+=`<input type="text" class="cmdin" id="cmdin" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="наприклад: sh int tr" value="${esc(ans||"")}"><div class="small muted" style="margin-top:4px">Скорочення приймаються, як в IOS.</div>`;
    else { const ok=isCorrect(q,ans); h+=`<pre>${esc(ans||"(без відповіді)")}</pre><div>${ok?"✅":"❌"} Еталон: <code>${esc(q.ans[0])}</code>${q.ans.length>1?` <span class="small muted">(або ${q.ans.slice(1).map(esc).join(", ")})</span>`:""}</div>`; }
  }
  if(t==="flash"){
    if(!checked&&interactive){ h+= S&&S.reveal===k? `<div class="note" style="white-space:pre-wrap">${esc(q.ans)}</div><div class="small muted">Чесно оцініть себе:</div><div class="row"><button class="primary grow" data-act="flash" data-v="yes">✅ Знав</button><button class="grow" data-act="flash" data-v="no">❌ Не знав</button></div>` : `<button class="primary" data-act="flashshow">Показати відповідь</button>`; }
    else h+=`<div class="note" style="white-space:pre-wrap">${esc(q.ans)}</div>${q.file?`<div class="small muted">📒 ${esc(q.file)}</div>`:""}`; }
  if(t==="fill"){ const bl=fillBlanks(q); const a=ans||[]; let i=-1;
    const parts=esc(q.cfg).replace(/\[\[(.+?)\]\]/g,()=>{ i++; const v=a[i]||""; const w=Math.max(6,Math.max(...bl[i].map(x=>x.length))+1);
      if(!checked&&interactive) return `<input class="fillin" data-i="${i}" value="${esc(v)}" style="width:${w}ch" autocomplete="off" autocapitalize="off" spellcheck="false">`;
      const ok=bl[i].some(c=>fillEq(v,c)); return `<span style="border-bottom:2px solid var(${ok?"--ok":"--bad"})">${ok?"":"<s>"+esc(v||"___")+"</s> "}${esc(ok?v:bl[i][0])}</span>`; });
    h+=`<pre class="fill">${parts}</pre>`; if(!checked&&interactive) h+=`<div class="small muted">Впишіть пропущені слова. Скорочення команд IOS приймаються.</div>`; }
  if(checked && q.e) h+=`<div class="small" style="margin-top:8px">💡 ${esc(q.e)}</div>`;
  if(checked && q.n) h+=`<div class="note">${esc(q.n)}</div>`;
  return h;
}
function renderQuiz(){ qtMark();
  const k=S.i, q=S.items[k], ans=S.ans[k];
  const checked = S.mode!=="exam" && S.checked[k];
  const modeName=S.title||{train:"Тренування",review:"Повтор помилок",exam:"Екзамен",gen:"Розрахунки",module:"Тест модуля"}[S.mode];
  const badge=(q.src==="my"?` <span class="chip" style="font-size:11px;padding:1px 7px">✍ моє</span>`:"")+(q.src==="na"?` <span class="chip" style="font-size:11px;padding:1px 7px">🎓 NetAcad</span>`:"")+(q.src==="n"?` <span class="chip" style="font-size:11px;padding:1px 7px">📒 з нотаток</span>`:"")+(q.gen?` <span class="chip" style="font-size:11px;padding:1px 7px">🎲 генератор</span>`:"")+(TYPE_NAME[qtype(q)]?` <span class="chip" style="font-size:11px;padding:1px 7px">${TYPE_NAME[qtype(q)]}</span>`:"");
  let verdict=""; if(checked){ const ok=isCorrect(q,ans); verdict=`<div class="verdict ${ok?"ok":"bad"}">${ok?"Правильно!":"Неправильно"}</div>`+(!ok&&prog[recId(q)]?whyChips(q,k):"")+mineBox(q); }
  let nav="";
  if(S.mode==="exam"){
    const done=S.items.filter((qq,i)=>hasAnswer(qq,S.ans[i])).length;
    nav= S.ccna? `<div class="navbar">${S.i<S.items.length-1?`<button class="primary" data-act="next">Далі → (повернутися не можна)</button>`:`<button class="primary" data-act="end2">Завершити іспит</button>`}</div><div class="small muted">Відповіді: ${done}/${S.items.length}. Як на справжньому CCNA, до попередніх питань повернутися не можна.</div>`
      : `<div class="navbar"><button data-act="prev" ${S.i?"":"disabled"}>← Назад</button>${S.i<S.items.length-1?`<button class="primary" data-act="next">Далі →</button>`:""}</div>
      <div class="navbar"><button class="${S.confirmEnd?"primary":""}" data-act="end">${S.confirmEnd?`Точно завершити? Відповіді: ${done}/${S.items.length}`:"Завершити екзамен"}</button></div>
      <div class="dots">${S.items.map((qq,i)=>`<span class="${hasAnswer(qq,S.ans[i])?"done":""} ${i===S.i?"cur":""}" data-act="jump" data-k="${i}">${i+1}</span>`).join("")}</div>`;
  } else {
    nav = checked ? `<div class="navbar"><button class="primary" data-act="next">${S.i<S.items.length-1?"Далі →":"Завершити"}</button></div>${flagBtn(q)}`
      : `<div class="navbar"><button class="primary" data-act="check" ${hasAnswer(q,ans)?"":"disabled"} id="checkbtn">Перевірити</button></div>`;
  }
  return `<div class="card">
    <div class="qmeta"><span>${modeName} · ${S.i+1}/${S.items.length}</span>${S.mode==="exam"?`<span>⏱ <span id="timer">${fmtLeft(S.deadline-Date.now())}</span></span>`:`<span>${tlabel(q.t)}</span>`}</div>
    <div class="progress"><i style="width:${Math.round(S.i/S.items.length*100)}%"></i></div>
    <div class="small muted">${S.mode==="exam"?tlabel(q.t)+" · ":""}${esc(TMAP[q.t].name)}${badge}</div>
    <div class="qtext">${opts.enTerms&&q.src!=="en"&&!q._tr?annotate(esc(q.q)):esc(q.q)}</div>${q._uk?`<details class="small muted"><summary>Українською</summary>${esc(q._uk)}</details>`:(window.QB_TR&&window.QB_TR[q.id]?`<details class="small muted"><summary>In English</summary>${esc(window.QB_TR[q.id].q)}</details>`:"")}${q.fig?topoSVG(q.fig):""}${q.c?`<pre>${esc(q.c)}</pre>`:""}
    ${renderBody(q,k,ans,checked,true)}${verdict}${nav}
  </div>
  <button class="ghost" data-act="quit">✕ Вийти${S.mode==="exam"?" (екзамен не зарахується)":""}</button>`;
}
function reviewItem(q, ans, open){
  const ok=isCorrect(q,ans);
  const saveS=S; S=null; const body=renderBody(q,0,ans||(qtype(q)==="mc"?[]:qtype(q)==="cmd"?"":[]),true,false); S=saveS;
  return `<details ${open?"open":""}><summary>${ans===undefined?"":ok?"✅ ":"❌ "}<span class="small muted">${tlabel(q.t)}</span> ${esc(q.q)}</summary>${q.fig?topoSVG(q.fig):""}${q.c?`<pre>${esc(q.c)}</pre>`:""}${body}${flagBtn(q)}</details>`;
}
// Вибір варіанта в частині симлета
ACTS.spick = el => { const k=S.i; if(S.mode!=="exam"&&S.checked[k]) return; const q=S.items[k]; const pi=Number(el.dataset.p), i=Number(el.dataset.i);
  const A=Array.from({length:q.parts.length},(_,j)=>((S.ans[k]||[])[j]||[]).slice()); let ch=A[pi]; const need=q.parts[pi].a.length;
  if(need>1){ ch=ch.includes(i)?ch.filter(x=>x!==i):ch.concat(i); if(ch.length>need) ch.shift(); } else ch=[i]; A[pi]=ch; S.ans[k]=A; S.confirmEnd=false; render(); };
// ---- Перетягування в категорії (тип cat): тап або drag-and-drop ----
const catSet=(i,c)=>{ const k=S.i; const q=S.items[k]; if(S.mode!=="exam"&&S.checked[k]) return; const a=(S.ans[k]||Array(q.items.length).fill(null)).slice(); while(a.length<q.items.length) a.push(null); a[i]=c; S.ans[k]=a; S.catSel=null; S.confirmEnd=false; render(); };
ACTS.catpick=el=>{ const i=Number(el.dataset.i); S.catSel=S.catSel===i?null:i; render(); };
ACTS.catdrop=(el,ev)=>{ if(ev&&ev.target&&ev.target.closest("[data-act='catback']")) return; if(S.catSel==null) return; catSet(S.catSel,Number(el.dataset.c)); };
ACTS.catback=el=>{ const box=el.closest("[data-catdrop]"); if(S.catSel!=null&&box) return catSet(S.catSel,Number(box.dataset.catdrop)); catSet(Number(el.dataset.i),null); };
document.addEventListener("dragstart",ev=>{ const t=ev.target.closest&&ev.target.closest("[data-act='catpick'],[data-act='catback']"); if(t&&ev.dataTransfer){ ev.dataTransfer.setData("text/plain",t.dataset.i); ev.dataTransfer.effectAllowed="move"; } });
document.addEventListener("dragover",ev=>{ if(ev.target.closest&&ev.target.closest("[data-catdrop]")) ev.preventDefault(); });
document.addEventListener("drop",ev=>{ const box=ev.target.closest&&ev.target.closest("[data-catdrop]"); if(!box||!S) return; ev.preventDefault(); const i=Number(ev.dataTransfer.getData("text/plain")); if(isNaN(i)) return; const c=Number(box.dataset.catdrop); catSet(i,c<0?null:c); });
