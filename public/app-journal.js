"use strict";
// Облік часу, журнал навчання, чек-ін дня. Файли app-*.js — звичайні скрипти зі спільною глобальною областю; порядок підключення див. index.html.
// ---- Облік часу, журнал навчання, чек-ін дня ----
const KINDS={pt:["🖥","Packet Tracer"],na:["🎓","NetAcad"],ob:["📒","Конспект в Obsidian"],vid:["🎬","Відео / курс"],lab:["🔌","Залізо / домашня лаба"],ex:["📝","Пробний тест"],oth:["📖","Інше"]};
function dayMin(x){ x=x||{}; return (x.m||0)+(x.log||[]).reduce((a,e)=>a+(e&&e.min||0),0); }
function dayDone(x){ x=x||{}; return (x.n||0)>=opts.goal || dayMin(x)>=opts.tgoal; }
function dayActive(x){ x=x||{}; return (x.n||0)>0 || dayMin(x)>0; }
function fmtMin(m){ m=Math.round(m||0); if(m<60) return m+" хв"; const h=Math.floor(m/60), r=m%60; return h+" год"+(r?" "+r+" хв":""); }
function dayKeyOff(off){ const d=new Date(); d.setDate(d.getDate()-off); return dkey(d); }
function fmtDay(k){ const [y,m,d]=k.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString("uk-UA",{weekday:"short",day:"2-digit",month:"2-digit"}); }
function setDay(dk,fields){ daily[dk]=Object.assign({n:0,c:0},daily[dk],fields); patch({daily:{[dk]:fields}}); }
// Автоматичний таймер: +1 хв за кожну хвилину, коли вкладка видима й була активність за останні 2 хв.
let lastAct=Date.now(), minPending=0;
["pointerdown","keydown","wheel","touchstart","scroll"].forEach(t=>addEventListener(t,()=>{ lastAct=Date.now(); },{passive:true,capture:true}));
function flushMinutes(){ if(!minPending) return; minPending=0; const dk=dkey(); const m=(daily[dk]||{}).m||0; if(m) patch({daily:{[dk]:{m}}}); }
setInterval(()=>{ if(document.visibilityState!=="visible"||Date.now()-lastAct>120000) return;
  const dk=dkey(); daily[dk]=Object.assign({n:0,c:0},daily[dk]); daily[dk].m=(daily[dk].m||0)+1; minPending++; lsSet(LS.daily,daily);
  if(minPending>=5) flushMinutes(); },60000);
addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden") flushMinutes(); });
addEventListener("pagehide",flushMinutes);
function logForm(){ const f=window._logOpen; if(!f) return `<button data-act="logopen">⏱ Записати навчання поза тренажером</button>`;
  return `<div style="border-top:1px solid var(--line);padding-top:8px">
    <div class="row"><select id="lkind" style="width:auto">${Object.entries(KINDS).map(([k,[i,n]])=>`<option value="${k}" ${f.k===k?"selected":""}>${i} ${n}</option>`).join("")}</select>
      <select id="lday" style="width:auto"><option value="0">сьогодні</option><option value="1" ${f.day==="1"?"selected":""}>учора</option></select></div>
    <div class="row" style="margin-top:6px">${[15,30,45,60,90,120].map(v=>`<button class="seg ${f.min===v?"on":""}" data-act="logmin" data-v="${v}">${v>=60?v/60+" год":v+" хв"}</button>`).join("")}<input type="number" id="lmin" min="1" max="600" placeholder="хв" value="${f.min||""}" style="width:80px"></div>
    <input type="text" id="lnote" maxlength="200" placeholder="Що саме (необов'язково): напр. лаба 6.4.2 EtherChannel" value="${esc(f.note||"")}" style="margin-top:6px">
    <div class="row" style="margin-top:6px"><span class="small grow" id="logmsg" style="color:var(--bad)"></span><button class="ghost" data-act="logcancel">Скасувати</button><button class="primary" data-act="logadd">Додати</button></div></div>`; }
function logDraft(){ const f=window._logOpen||{}; const g=id=>($(id)||{}).value; if($("#lkind")){ f.k=g("#lkind"); f.day=g("#lday"); f.note=g("#lnote"); const m=Number(g("#lmin")); if(m) f.min=m; } window._logOpen=f; return f; }
function checkinCard(){ const dk=dkey(), x=daily[dk]||{}, y=daily[dayKeyOff(1)]||{}; const jd=window._jd||{};
  const note=jd.note!==undefined?jd.note:(x.note||""), plan=jd.plan!==undefined?jd.plan:(x.plan||"");
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">📝 Чек-ін дня</h2>${x.jts?`<span class="small muted">збережено о ${new Date(x.jts).toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"})}</span>`:""}</div>
    ${y.plan?`<p class="small" style="margin:8px 0;padding:8px 10px;background:var(--accent-soft);border-radius:8px"><b>План на сьогодні (з учора):</b><br>${esc(y.plan).replace(/\n/g,"<br>")}</p>`:""}
    <label class="small muted" for="jnote">Що вивчив сьогодні: теми, лаби, що зрозумів, що досі незрозуміло</label>
    <textarea id="jnote" class="jt" maxlength="2000">${esc(note)}</textarea>
    <label class="small muted" for="jplan">План на завтра: конкретно — модуль, лаба, скільки питань</label>
    <textarea id="jplan" class="jt" maxlength="1000">${esc(plan)}</textarea>
    <div class="row" style="margin-top:6px"><span class="small muted grow">${journalStreak()>=2?"🗓 Чек-інів поспіль: "+journalStreak():"Записуйте щодня — завтра побачите свій план тут."}</span><button class="primary" data-act="jsave">Зберегти</button></div></div>`; }
function journalStreak(){ let n=0; const d=new Date(); if(!(daily[dkey(d)]||{}).jts) d.setDate(d.getDate()-1); while((daily[dkey(d)]||{}).jts){ n++; d.setDate(d.getDate()-1); } return n; }
function journalAct(act,el){
  if(act==="logopen"){ window._logOpen={k:"pt",day:"0"}; render(); return true; }
  if(act==="logcancel"){ window._logOpen=null; render(); return true; }
  if(act==="logmin"){ const f=logDraft(); f.min=Number(el.dataset.v); render(); return true; }
  if(act==="logadd"){ const f=logDraft(); const min=Math.round(Number(f.min)); if(!(min>=1&&min<=600)){ const m=$("#logmsg"); if(m) m.textContent="Вкажіть 1–600 хв"; return true; }
    const dk=dayKeyOff(Number(f.day)||0); const log=((daily[dk]||{}).log||[]).concat([{ts:Date.now(),min,k:f.k||"oth",note:(f.note||"").trim().slice(0,200)}]);
    setDay(dk,{log}); window._logOpen=null; render(); return true; }
  if(act==="logdel"){ const dk=el.dataset.d, ts=Number(el.dataset.ts); if(el.dataset.confirm!=="1"){ el.dataset.confirm="1"; el.textContent="Видалити?"; return true; }
    setDay(dk,{log:((daily[dk]||{}).log||[]).filter(e=>e.ts!==ts)}); render(); return true; }
  if(act==="jsave"){ const note=(($("#jnote")||{}).value||"").trim(), plan=(($("#jplan")||{}).value||"").trim(); if(!note&&!plan) return true;
    setDay(dkey(),{note,plan,jts:Date.now()}); window._jd=null; render(); return true; }
  if(act==="jlog"){ window._jlogAll=!window._jlogAll; render(); return true; }
  return false; }
function journalCard(){ const days=[]; for(let i=0;i<(window._jlogAll?60:14);i++){ const k=dayKeyOff(i), x=daily[k]; if(x&&(dayActive(x)||x.note||x.plan)) days.push([k,x]); }
  let tot=0; const byK={}; for(const x of Object.values(daily)){ tot+=dayMin(x); } for(let i=0;i<30;i++){ const x=daily[dayKeyOff(i)]||{}; if(x.m) byK.app=(byK.app||0)+x.m; for(const e of x.log||[]) byK[e.k]=(byK[e.k]||0)+(e.min||0); }
  const kn=k=>k==="app"?"🧩 Тренажер":(KINDS[k]?KINDS[k].join(" "):k); const m30=Object.values(byK).reduce((a,b)=>a+b,0);
  return `<div class="card"><h2>⏱ Час навчання</h2><p style="margin:0 0 6px">Усього: <b>${fmtMin(tot)}</b> · за 30 днів: <b>${fmtMin(m30)}</b></p>
    ${m30?`<table>${Object.entries(byK).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${kn(k)}</td><td class="num">${fmtMin(v)}</td><td style="width:40%"><div class="bar" style="width:100%"><i style="width:${Math.round(v/m30*100)}%"></i></div></td></tr>`).join("")}</table>`:`<p class="small muted" style="margin:0">Ще немає записів.</p>`}</div>
  <div class="card"><h2>📒 Журнал навчання</h2>${days.length?days.map(([k,x])=>`<div style="border-top:1px solid var(--line);padding:8px 0">
    <div class="row"><b class="grow">${fmtDay(k)}</b><span class="small muted">${x.n?x.n+" відп. · ":""}${fmtMin(dayMin(x))}${dayDone(x)?" ✅":""}</span></div>
    ${x.m?`<div class="small muted">🧩 Тренажер — ${fmtMin(x.m)}</div>`:""}
    ${(x.log||[]).map(e=>`<div class="row small"><span class="grow">${KINDS[e.k]?KINDS[e.k][0]+" "+KINDS[e.k][1]:"📖"} — ${fmtMin(e.min)}${e.note?" · "+esc(e.note):""}</span><button class="mini ghost" data-act="logdel" data-d="${k}" data-ts="${e.ts}">✕</button></div>`).join("")}
    ${x.note?`<div class="small" style="margin-top:4px"><b>Вивчив:</b> ${esc(x.note).replace(/\n/g,"<br>")}</div>`:""}${x.plan?`<div class="small muted"><b>План:</b> ${esc(x.plan).replace(/\n/g,"<br>")}</div>`:""}</div>`).join("")
    :`<p class="small muted" style="margin:0">Тут з'являться дні з навчанням, записи часу та чек-іни.</p>`}
    <button class="ghost" data-act="jlog" style="margin-top:6px">${window._jlogAll?"Лише 14 днів":"Показати 60 днів"}</button></div>`; }
function journalAchievements(){ let tot=0, checkins=0, bigDays=0; for(const x of Object.values(daily)){ const m=dayMin(x); tot+=m; if(x.jts) checkins++; if(m>=180) bigDays++; }
  const js=journalStreak(); return [["⏱","10 годин","10 год навчання загалом",tot>=600],["⌛","50 годин","50 год навчання",tot>=3000],["🏔","100 годин","100 год навчання",tot>=6000],
   ["🗒","Рефлексія","Чек-ін 7 днів поспіль",js>=7],["📓","Щоденник","30 чек-інів",checkins>=30],["🚀","Глибоке занурення","3+ години за день",bigDays>=1]]; }
