"use strict";
// Події, запуск, гарячі клавіші. Файли app-*.js — звичайні скрипти зі спільною глобальною областю; порядок підключення див. index.html.
// ================= Події =================
document.addEventListener("click", async ev=>{
  if(ev.target.closest("#home-link")){ if(view==="quiz"&&S&&S.mode==="exam") return; view="home"; S=null; render(); return; }
  const el=ev.target.closest("[data-act]"); if(!el) return; const act=el.dataset.act;
  if(ACTS[act]){ await ACTS[act](el,ev); return; }
  if(act==="topic"||act==="notesonly"||act==="match") return;
  if(act==="grp"){ const ts=TOPICS.filter(t=>t.g===el.dataset.g); const allOn=ts.every(t=>sel.has(t.id)); ts.forEach(t=>allOn?sel.delete(t.id):sel.add(t.id)); lsSet(LS.sel,[...sel]); render(); return; }
  if(act==="download"){ saveDownload("ccna-progress-"+dkey()+".json",exportJSON(),"application/json"); return; }
  if(act==="snapdl"){ const x=(window._snaps||[])[+el.dataset.i]; if(x) saveDownload("ccna-backup-"+new Date(x.ts).toISOString().slice(0,10)+".json",x.json,"application/json"); return; }
  if(act==="snaprestore"){ const x=(window._snaps||[])[+el.dataset.i]; if(!x) return; $("#imp").value=x.json; await backupAct("import",el); $("#snapmsg").textContent="Відновлено з копії від "+new Date(x.ts).toLocaleDateString("uk-UA"); return; }
  if(act==="snapnow"){ const snaps=lsGet(LS.snaps,[]); snaps.unshift({ts:Date.now(),n:Object.keys(prog).length,json:exportJSON()}); lsSet(LS.snaps,snaps.slice(0,4));
    if(store.mode==="db"){ try{ const meta=store.db.doc("backups/meta"); const m=await meta.get(); const md=m.exists?(m.data()||{}):{}; const slot=((md.slot||0)+1)%SNAP_KEEP; await store.db.doc("backups/s"+slot).set({ts:Date.now(),n:Object.keys(prog).length,json:exportJSON()}); await meta.set({last:Date.now(),slot}); remoteSnaps=await loadRemoteSnaps(); }catch(e){} }
    render(); return; }
  if(act==="pushon"){ const m=$("#pushmsg"); m.textContent="Підключення…"; try{ await pushEnable(); render(); }catch(e){ m.textContent="⚠ "+(e.message||e); } return; }
  if(act==="pushoff"){ await pushDisable(); render(); return; }
  if(act==="ics"){ const t=($("#remtime")||{}).value||"19:00"; opts.remind=t; lsSet(LS.opts,opts); saveDownload("ccna-reminder.ics",makeICS(t),"text/calendar"); return; }
  if(act==="authgoogle"){ doAuth("google"); return; }
  if(act==="authlogin"){ doAuth("login"); return; }
  if(act==="authsignup"){ doAuth("signup"); return; }
  if(act==="logout"){ if(store.F) store.F.authM.signOut(store.F.auth); view="home"; render(); return; }
  if(act==="src"){ opts.src=el.dataset.v; lsSet(LS.opts,opts); render(); return; }
  if(act==="opt"){ opts[el.dataset.k]=Number(el.dataset.v); lsSet(LS.opts,opts); if(/goal/.test(el.dataset.k)) pushSync(); render(); return; }
  if(journalAct(act,el)) return;
  if(act==="train"){ startSession("train", pickTraining(sel, opts.train)); return; }
  if(act==="review"){ startSession("review", shuffle(reviewQueue())); return; }
  if(act==="obtrain"){ startSession("train", shuffle(customQs.filter(q=>q.type==="flash")).slice(0,opts.train), "Картки з нотаток"); return; }
  if(act==="install"){ if(installEvt){ installEvt.prompt(); installEvt.userChoice.finally(()=>{ installEvt=null; render(); }); } return; }
  if(act==="installhide"){ opts.installHide=true; lsSet(LS.opts,opts); render(); return; }
  if(act==="ccna"){ const n=Number(el.dataset.n)||120; const en=el.dataset.en==="1"; const prev=opts.lang; if(en&&prev!=="en"){ opts.lang="en"; rebuildQB(); }
    startSession("exam", pickCcna(n,en), (n>=100?"CCNA 200-301 ":"CCNA (коротка) ")+bpVer()+(en?" · English":"")); S.ccna=true; S.bp=bpVer(); if(en){ S.en=true; S.enPrev=prev; } render(); return; }
  if(act==="plan"){ startPlan(); return; }
  if(act==="exam"){ const gk=genKeysFor(sel); const n=opts.exam; const ng=gk.length?Math.round(n*0.15):0; const list=shuffle(qsFor(sel).filter(q=>qtype(q)!=="flash")).slice(0,n-ng); for(let i=0;i<ng;i++){const g=GEN.make(gk[i%gk.length]); if(g) list.push(g);} startSession("exam", shuffle(list)); return; }
  if(act==="gen"){ const list=[]; for(let i=0;i<10;i++){ const g=GEN.make(el.dataset.k); if(g) list.push(g);} startSession("gen", list); return; }
  if(act==="cheat"){ const tid=($("#modsel")||{}).value||opts.modTopic; opts.modTopic=tid; lsSet(LS.opts,opts); view="cheat"; render(); scrollTop(); return; }
  if(act==="module2"){ startSession("module", pickModule(opts.modTopic), "Тест модуля "+tlabel(opts.modTopic)); return; }
  if(act==="module"){ const tid=($("#modsel")||{}).value||opts.modTopic; opts.modTopic=tid; lsSet(LS.opts,opts); startSession("module", pickModule(tid), "Тест модуля "+tlabel(tid)); return; }
  if(act==="setopt"){ const k=el.dataset.k; let v=el.dataset.v; if(v==="true"||v==="false") v=(v==="true"); else if(/^\d+$/.test(v)) v=Number(v); opts[k]=v; lsSet(LS.opts,opts); if(k==="goal"||k==="tgoal") pushSync(); if(k==="lang") rebuildQB(); applyLook(); render(); return; }
  if(act==="cadd"){ customDraft=null; customEdit=null; render(); return; }
  if(act==="csave"){ saveCustom(); return; }
  if(act==="cedit"){ customEdit=el.dataset.id; render(); scrollTop(); return; }
  if(act==="cdel"){ if(el.dataset.confirm!=="1"){ el.dataset.confirm="1"; el.textContent="Точно видалити?"; return; } deleteCustom(el.dataset.id); return; }
  if(act==="caddopt"){ const f=readCustomForm(); f.o.push(["",""]); customDraft=f; render(); return; }
  if(act==="ctrain"){ const list=shuffle(customQs.filter(q=>TMAP[q.t])); startSession("train", list.slice(0,20), "Мої питання"); return; }
  if(["stats","backup","search","labs","custom","settings"].includes(act)){ view=act; render(); scrollTop(); if(act==="search"){const si=$("#searchin"); si&&si.focus();} if(act==="backup"&&store.mode==="db"&&remoteSnaps===null){ remoteSnaps=[]; loadRemoteSnaps().then(r=>{ remoteSnaps=r; if(view==="backup") render(); }); } return; }
  if(act==="lab"){ openLab(el.dataset.id); return; }
  if(act==="labcheck"){ checkLab(); return; }
  if(act==="labdev"){ const t=$("#dmap"); if(t) LAB.mapText=t.value; LAB.cur=el.dataset.d; render(); return; }
  if(act==="walk"){ if(!LAB.N.lastFlow) return; LAB.walk={i:0,play:true}; render(); walkStop(); LAB.walk.play=true; walkTimer=setInterval(()=>{ if(!LAB||!LAB.walk){walkStop();return;} const n=walkSteps().length; if(LAB.walk.i>=n-1){ walkStop(); walkUpd(); return; } LAB.walk.i++; walkUpd(); },1300); walkUpd(); return; }
  if(act==="walkclose"){ walkStop(); LAB.walk=null; render(); return; }
  if(act==="walkplay"){ if(LAB.walk.play){ walkStop(); walkUpd(); return; } if(LAB.walk.i>=walkSteps().length-1) LAB.walk.i=0; LAB.walk.play=true; walkTimer=setInterval(()=>{ if(!LAB||!LAB.walk){walkStop();return;} if(LAB.walk.i>=walkSteps().length-1){ walkStop(); walkUpd(); return; } LAB.walk.i++; walkUpd(); },1300); walkUpd(); return; }
  if(act==="walkgo"){ walkStop(); const n=walkSteps().length; const d=el.dataset.d; LAB.walk.i= d==="first"?0 : d==="at"? Number(el.dataset.k) : Math.max(0,Math.min(n-1,LAB.walk.i+Number(d))); if(walkSteps()[LAB.walk.i].sep) LAB.walk.i=Math.min(n-1,LAB.walk.i+1); walkUpd(); return; }
  if(act==="sandbox"){ openSandbox(); return; }
  if(act==="confuse"){ view="confuse"; render(); scrollTop(); return; }
  if(act==="pairopen"){ const k=Number(el.dataset.k); window._pairOpen=window._pairOpen===k?null:k; render(); return; }
  if(act==="pairtrain"){ const st=pairStats().sort((a,b)=>(b.s?b.rate:-1)-(a.s?a.rate:-1)); const x=st[Number(el.dataset.k)]; startSession("train", shuffle(x.qs.filter(q=>qtype(q)!=="flash")).slice(0,10), x.P.a+" ↔ "+x.P.b); return; }
  if(act==="progress"){ view="progress"; render(); scrollTop(); return; }
  if(act==="obsexport"){ exportObsidian(); return; }
  if(act==="speed"){ speedStart(el.dataset.k); return; }
  if(act==="speedmenu"){ SP=null; view="speed"; render(); scrollTop(); return; }
  if(act==="speedquit"){ SP=null; render(); return; }
  if(act==="glossary"){ view="glossary"; render(); scrollTop(); return; }
  if(act==="enquiz"){ startSession("train", shuffle(QB.filter(q=>q.src==="en")).slice(0,opts.train), "English practice"); return; }
  if(act==="wlclab"){ if(!window._wlc) window._wlc=lsGet("ccna.wlc.v1",null)||WLC.newState(); view="wlc"; render(); scrollTop(); return; }
  if(act==="wlc"){ const op=el.dataset.op; if(op==="reset"){ window._wlc=WLC.newState(); } else WLC.handle(window._wlc,op,el,$); lsSet("ccna.wlc.v1",window._wlc); const d=WLC.done(window._wlc); const n=Object.values(d).filter(Boolean).length; const prev=labs.wlc||{}; if(n!==prev.n){ const rec={ok:n===WLC.TASKS.length||!!prev.ok,n,ts:Date.now()}; if(n===WLC.TASKS.length&&!prev.ok) rec.done=Date.now(); labs.wlc=rec; patch({labs:{wlc:rec}}); } ev.preventDefault(); render(); return; }
  if(act==="api"){ view="api"; render(); scrollTop(); return; }
  if(act==="apisend"){ apiSync(); APIL.res=APILAB.handle(APIL.st,APIL.req); apiDone(); render(); return; }
  if(act==="apitok"){ apiSync(); APIL.req.headers=APIL.req.headers.split("\n").filter(l=>!/^x-auth-token/i.test(l.trim())&&!/^authorization/i.test(l.trim())).concat(["X-Auth-Token: "+APIL.st.token]).join("\n"); render(); return; }
  if(act==="apireset"){ APIL=null; render(); return; }
  if(act==="apians"){ apiSync(); APIL.ans=$("#apians").value.trim(); if(APIL.ans===APILAB.TASKS.find(t=>t.id==="answer").ans) APIL.st.done.answer=true; else alert("Ні. Знайдіть пристрій із reachabilityStatus = Unreachable у відповіді GET /network-device."); apiDone(); render(); return; }
  if(act==="sbadd"){ const t=el.dataset.t; const pre={switch:"S",l3:"MLS",router:"R",pc:"PC",server:"SRV"}[t]; let k=1; while(LAB.N.dev[pre+k]) k++; sbMutate(d=>{ d.devs[pre+k]= t==="pc"||t==="server"? {type:t,services:t==="server"?[80,22,23]:[]} : {type:t}; }); return; }
  if(act==="sblink"){ const a=$("#sbA").value,b=$("#sbB").value,pa=$("#sbPA").value,pb=$("#sbPB").value; if(!pa||!pb||a===b){ alert("Оберіть два різні пристрої з вільними портами"); return; } sbMutate(d=>d.links.push([a,pa,b,pb])); return; }
  if(act==="sbunlink"){ const k=Number(el.dataset.k); sbMutate(d=>d.links.splice(k,1)); return; }
  if(act==="sbdel"){ const n=el.dataset.n; sbMutate(d=>{ delete d.devs[n]; d.links=d.links.filter(l=>l[0]!==n&&l[2]!==n); }); return; }
  if(act==="sbshare"){ const d=CLI.saveNet(LAB.N,LAB.types); packSb(d).then(async code=>{ const url=location.origin+location.pathname+"#sb="+code; try{ if(navigator.share) await navigator.share({title:"Топологія CCNA",url}); else { await navigator.clipboard.writeText(url); alert("Посилання скопійовано ("+url.length+" символів)"); } }catch(e){ prompt("Скопіюйте посилання:",url); } }); return; }
  if(act==="sbexport"){ saveDownload("ccna-topology-"+dkey()+".json",JSON.stringify(CLI.saveNet(LAB.N,LAB.types),null,1),"application/json"); return; }
  if(act==="sbreset"){ if(!confirm("Видалити всі пристрої з пісочниці?")) return; LAB.outs={}; sbMutate(d=>{ d.devs={}; d.links=[]; }); return; }
  if(act==="tsstart"){ startTs(Number(el.dataset.n)||1,el.dataset.tk==="1"); return; }
  if(act==="tsgive"){ LAB.showSol=!LAB.showSol; render(); return; }
  if(act==="labsol"){ const t=$("#dmap"); if(t) LAB.mapText=t.value; LAB.showSol=!LAB.showSol; render(); return; }
  if(act==="labreset"){ openLab(LAB.sc.id); return; }
  if(act==="home"||act==="quit"){ examLangRestore(); view="home"; S=null; render(); scrollTop(); return; }
  if(act==="flag"){ const id=el.dataset.id; const f=flags[id]&&flags[id].on&&flags[id].kind!=="err"; const rec=f?{on:false,ts:Date.now()}:{on:true,ts:Date.now(),snip:el.dataset.snip,note:""}; flags[id]=rec; patch({flags:{[id]:rec}}); rerenderInPlace(); return; }
  if(act==="flagnote"){ const id=el.dataset.id; const inp=el.parentElement.querySelector("input"); const rec=Object.assign({},flags[id],{note:inp.value.slice(0,500),ts:Date.now()}); flags[id]=rec; patch({flags:{[id]:rec}}); el.textContent="Збережено"; return; }
  if(act==="unflag"){ const id=el.dataset.id; const rec={on:false,ts:Date.now()}; flags[id]=rec; patch({flags:{[id]:rec}}); render(); return; }
  if(!S) { if(act==="copy"||act==="import"||act==="reset") return backupAct(act,el); return; }
  const k=S.i, q=S.items[k];
  if(act==="flashshow"){ S.reveal=S.i; render(); return; }
  if(act==="flash"){ S.ans[S.i]=el.dataset.v; doCheck(); return; }
  if(act==="pick"){ if(S.mode!=="exam"&&S.checked[k]) return; const i=Number(el.dataset.i); let ch=(S.ans[k]||[]).slice();
    if(q.a.length>1){ ch=ch.includes(i)?ch.filter(x=>x!==i):ch.concat(i); if(ch.length>q.a.length) ch.shift(); } else ch=[i];
    S.ans[k]=ch; S.confirmEnd=false; render(); return; }
  if(act==="ord"){ const i=Number(el.dataset.i); S.ans[k]=(S.ans[k]||[]).concat(i); S.confirmEnd=false; render(); return; }
  if(act==="unord"){ const i=Number(el.dataset.i); S.ans[k]=(S.ans[k]||[]).filter(x=>x!==i); render(); return; }
  if(act==="check"){ doCheck(); return; }
  if(act==="end2"){ finishExam(); return; }
  if(act==="simdev"){ const st=simState(S.i); st.cur=el.dataset.d; render(); return; }
  if(act==="simdone"){ const st=simState(S.i); const res= st.N? st.sc.check(st.N) : st.sc.check(st.ses[st.cur].state); const ok=res.every(x=>x[0]); S.ans[S.i]={done:true,ok,res}; if(st.sc&&st.sc.id&&!String(st.sc.id).startsWith("ts-")&&S.mode!=="exam") labRecord(st.sc.id,ok); if(S.mode!=="exam"){ doCheck(); } else render(); return; }
  if(act==="next"){ if(S.mode!=="exam" && S.i>=S.items.length-1){ showSummary(); return; } S.i=Math.min(S.i+1,S.items.length-1); S.confirmEnd=false; render(); scrollTop(); return; }
  if(act==="prev"){ S.i=Math.max(0,S.i-1); S.confirmEnd=false; render(); scrollTop(); return; }
  if(act==="jump"){ S.i=Number(el.dataset.k); S.confirmEnd=false; render(); return; }
  if(act==="end"){ if(!S.confirmEnd){S.confirmEnd=true; render(); return;} finishExam(); return; }
  if(act==="copy"||act==="import"||act==="reset") return backupAct(act,el);
});
function rerenderInPlace(){ const y=window.scrollY; render(); try{window.scrollTo(0,y);}catch(e){} if(view==="stats") bindChart(); }
function doCheck(){ const k=S.i, q=S.items[k]; if(qtype(q)==="cmd"){ const ci=$("#cmdin"); if(ci) S.ans[k]=ci.value; } if(!hasAnswer(q,S.ans[k])) return; S.checked[k]=true; const ok=isCorrect(q,S.ans[k]); record(recId(q),ok); beep(ok); render(); }
let audioCtx=null;
function beep(ok){ if(!opts.sound) return; try{ audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.frequency.value=ok?880:220; o.type=ok?"sine":"triangle"; g.gain.setValueAtTime(0.08,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+(ok?0.18:0.3)); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+(ok?0.2:0.32)); }catch(e){} }
function applyLook(){ const r=document.documentElement; if(opts.theme==="auto") delete r.dataset.theme; else r.dataset.theme=opts.theme; r.style.setProperty("--fs",(opts.fs||16)+"px"); }
document.addEventListener("change", ev=>{
  const t=ev.target;
  if(t.dataset && t.dataset.act==="notesonly"){ opts.notesOnly=t.checked; lsSet(LS.opts,opts); render(); return; }
  if(t.dataset && t.dataset.act==="topic"){ t.checked?sel.add(t.dataset.t):sel.delete(t.dataset.t); lsSet(LS.sel,[...sel]); render(); return; }
  if(t.id==="sbimport"&&t.files&&t.files[0]){ t.files[0].text().then(x=>{ let d; try{ d=JSON.parse(x); }catch(e){} if(!sbValid(d)){ alert("Це не файл топології"); return; } if(!confirm("Замінити поточну пісочницю імпортованою топологією?")) return; LAB.outs={}; sbMutate(z=>{ z.devs=d.devs; z.links=d.links; }); }); return; }
  if((t.id==="obdir"||t.id==="obfiles")&&t.files&&t.files.length){ importMd([...t.files]); return; }
  if((t.id==="sbA"||t.id==="sbB")&&LAB){ LAB[t.id]=t.value; render(); return; }
  if(t.id==="remtime"){ opts.remind=t.value; lsSet(LS.opts,opts); pushSync(); return; }
  if(t.id==="examdate"){ opts.examDate=t.value; lsSet(LS.opts,opts); render(); return; }
  if(t.id==="cheatsel"){ opts.modTopic=t.value; lsSet(LS.opts,opts); render(); return; }
  if(t.dataset && t.dataset.act==="match" && S){ const k=S.i; const a=(S.ans[k]||[]).slice(); a[Number(t.dataset.i)]=t.value; S.ans[k]=a; S.confirmEnd=false; const y=window.scrollY; render(); try{window.scrollTo(0,y);}catch(e){} return; }
  if(t.id==="impfile" && t.files && t.files[0]){ const r=new FileReader(); r.onload=()=>{$("#imp").value=String(r.result);}; r.readAsText(t.files[0]); }
});
document.addEventListener("input", ev=>{
  const t=ev.target;
  if(t.classList&&t.classList.contains("fillin") && S){ const a=(S.ans[S.i]||[]).slice(); a[Number(t.dataset.i)]=t.value; S.ans[S.i]=a; const b=$("#checkbtn"); if(b) b.disabled=!hasAnswer(S.items[S.i],a); const dots=document.querySelectorAll(".dots span"); if(dots[S.i]) dots[S.i].classList.toggle("done",hasAnswer(S.items[S.i],a)); }
  if(t.id==="cmdin" && S){ S.ans[S.i]=t.value; const b=$("#checkbtn"); if(b) b.disabled=!t.value.trim(); const dots=document.querySelectorAll(".dots span"); if(dots[S.i]) dots[S.i].classList.toggle("done",!!t.value.trim()); }
  if(t.id==="jnote"||t.id==="jplan"){ window._jd=window._jd||{}; window._jd[t.id.slice(1)]=t.value; return; }
  if(t.id==="glq"){ window._glq=t.value; const pos=t.selectionStart; render(); const g=$("#glq"); if(g){ g.focus(); g.setSelectionRange(pos,pos); } return; }
  if(t.id==="searchin"){ searchQ=t.value; const pos=t.selectionStart; render(); const si=$("#searchin"); si.focus(); try{si.setSelectionRange(pos,pos);}catch(e){} }
});
document.addEventListener("keydown", ev=>{ if(ev.target.id==="cmdin" && ev.key==="Enter" && S){ ev.preventDefault(); if(S.mode==="exam"){ S.ans[S.i]=ev.target.value; if(S.i<S.items.length-1){S.i++; render();} } else if(!S.checked[S.i]) doCheck(); else { if(S.i>=S.items.length-1) showSummary(); else {S.i++; render();} } } });
function showSummary(){
  let ok=0,n=0; S.items.forEach((q,k)=>{ if(S.checked[k]){ n++; if(isCorrect(q,S.ans[k])) ok++; } });
  $("#app").innerHTML=`<div class="card"><h2>Сесію завершено</h2><p class="big">${ok}/${n}</p><p class="muted">Питання з помилками з'являться в «Повторі помилок».</p></div>
    <div class="card"><h2>Розбір</h2>${S.items.map((q,k)=>S.checked[k]?reviewItem(q,S.ans[k]):"").join("")}</div><button class="primary" data-act="home">На головну</button>`;
  view="summary"; scrollTop();
}
async function backupAct(act,el){
  if(act==="copy"){ const t=$("#exp"); try{ await navigator.clipboard.writeText(t.value); $("#copymsg").textContent="Скопійовано"; }catch(e){ t.focus(); t.select(); $("#copymsg").textContent="Виділено — скопіюйте вручну"; } return; }
  if(act==="import"){ const msg=$("#impmsg"); try{ const d=JSON.parse($("#imp").value); if(!d||typeof d.progress!=="object") throw new Error("Немає поля progress");
      prog=mergeByTs(prog,d.progress,"l"); daily=mergeDaily(daily,d.daily||{}); flags=mergeByTs(flags,d.flags||{},"ts"); labs=mergeByTs(labs,d.labs||{},"ts"); saveAll();
      if(Array.isArray(d.custom)){ for(const q of d.custom){ if(q&&q.id&&q.t&&Array.isArray(q.o)&&!customQs.some(x=>x.id===q.id)){ customQs.push(q); if(store.mode==="db") queueWrite(()=>store.db.doc("custom/"+q.id).set(q)); } } lsSet(LS.custom,customQs); rebuildQB(); }
      if(Array.isArray(d.exams)){ const have=new Set(exams.map(e=>e.ts)); for(const e of d.exams){ if(e&&e.ts&&!have.has(e.ts)){ exams.push(e); if(store.mode==="db") queueWrite(()=>store.db.collection("exams").add(e)); } } exams.sort((a,b)=>b.ts-a.ts); lsSet(LS.exams,exams); }
      msg.textContent="Імпортовано: "+Object.keys(d.progress).length+" записів"; }catch(e){ msg.textContent="Помилка: "+e.message; } return; }
  if(act==="reset"){ if(el.dataset.confirm!=="1"){ el.dataset.confirm="1"; el.textContent="Точно скинути? Натисніть ще раз"; el.classList.add("primary"); return; } prog={}; saveAll(); el.textContent="Скинуто"; el.disabled=true; }
}

customQs=lsGet(LS.custom,[]); rebuildQB(); applyLook();
render();
initStore(); setTimeout(sbOpenShared,400); addEventListener("hashchange",sbOpenShared); setTimeout(()=>{ if(store.mode!=="db") autoBackup(); },8000);
if("serviceWorker" in navigator && location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
addEventListener("online",setStatus); addEventListener("offline",setStatus);
var installEvt=null; addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); installEvt=e; if(view==="home") render(); });
addEventListener("appinstalled",()=>{ installEvt=null; opts.installed=true; lsSet(LS.opts,opts); if(view==="home") render(); });
function standalone(){ return matchMedia("(display-mode: standalone)").matches||navigator.standalone===true; }
function installCard(){ if(standalone()||opts.installHide) return "";
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(!installEvt&&!ios) return "";
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">📲 Встановити на пристрій</h2><button class="mini ghost" data-act="installhide">✕</button></div><p class="small muted" style="margin:6px 0 8px">Тренажер відкриватиметься як застосунок з іконкою, працюватиме без інтернету (питання, лаби, генератори), а прогрес синхронізується, коли зв'язок повернеться.</p>${installEvt?`<button class="primary" data-act="install">Встановити</button>`:`<p class="small" style="margin:0">iPhone/iPad: у Safari натисніть «Поділитися» → «На початковий екран».</p>`}</div>`; }
document.addEventListener("keydown",e=>{ const t=e.target; if(!t||t.id!=="simin"||e.key!=="Enter"||!S) return; e.preventDefault(); const st=simState(S.i); const ses=st.ses[st.cur]; const pr=ses.prompt(); const out=ses.exec(t.value);
  st.outs[st.cur]+=pr+t.value+"\n"+(out?out+"\n":""); if(st.N){ for(const [d,m] of st.N.recompute()) st.outs[d]+=m+"\n"; } t.value=""; const term=$("#simterm"); term.textContent=st.outs[st.cur]; term.scrollTop=term.scrollHeight; $("#simprompt").textContent=ses.prompt(); });
// ---- Гарячі клавіші (комп'ютер) ----
document.addEventListener("keydown",e=>{
  if(e.ctrlKey||e.metaKey||e.altKey) return; const tg=e.target; if(tg&&(tg.tagName==="INPUT"||tg.tagName==="TEXTAREA"||tg.tagName==="SELECT")) return;
  if(view!=="quiz"||!S) { if(e.key==="?"){ alert("Гарячі клавіші під час тесту:\n1–9 — обрати варіант\nEnter — перевірити / далі\nF — позначити як сумнівне\nN або → — наступне (в екзамені)\nP або ← — попереднє (в екзамені)\nПробіл — показати відповідь картки"); } return; }
  const k=e.key;
  if(/^[1-9]$/.test(k)){ const opts=[...document.querySelectorAll('[data-act="pick"]')]; const el=opts[Number(k)-1]; if(el){ el.click(); e.preventDefault(); } return; }
  if(k==="Enter"){ const cb=$("#checkbtn"); if(cb&&!cb.disabled){ cb.click(); e.preventDefault(); return; } const nx=document.querySelector('[data-act="next"]'); if(nx){ nx.click(); e.preventDefault(); } return; }
  if(k==="f"||k==="F"||k==="а"||k==="А"){ const fl=document.querySelector('[data-act="flag"]'); if(fl){ fl.click(); e.preventDefault(); } return; }
  if(k==="ArrowRight"||k==="n"||k==="N"){ const nx=document.querySelector('[data-act="next"]'); if(nx){ nx.click(); e.preventDefault(); } return; }
  if(k==="ArrowLeft"||k==="p"||k==="P"){ const pv=document.querySelector('[data-act="prev"]:not([disabled])'); if(pv){ pv.click(); e.preventDefault(); } return; }
  if(k===" "){ const fs=document.querySelector('[data-act="flashshow"]'); if(fs){ fs.click(); e.preventDefault(); } }
});
