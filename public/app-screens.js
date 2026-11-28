"use strict";
// Екрани: головна, модуль, симуляція CCNA, план, прогноз, налаштування, мої питання. Файли app-*.js — звичайні скрипти зі спільною глобальною областю; порядок підключення див. index.html.
// ================= Рендеринг: екрани =================
function render(){
  const app=$("#app");
  if(VIEWS[view]){ app.innerHTML=VIEWS[view].html(); if(VIEWS[view].after) VIEWS[view].after(); return; }
  ({home:()=>app.innerHTML=renderHome(), quiz:()=>app.innerHTML=renderQuiz(), result:()=>app.innerHTML=renderResult(), stats:()=>{app.innerHTML=renderStats(); bindChart();},
    backup:()=>app.innerHTML=renderBackup(), search:()=>app.innerHTML=renderSearch(), labs:()=>app.innerHTML=renderLabs(), lab:()=>{app.innerHTML=renderLab(); bindLab();}, custom:()=>app.innerHTML=renderCustom(), settings:()=>app.innerHTML=renderSettings(), cheat:()=>app.innerHTML=renderCheat(), wlc:()=>app.innerHTML=WLC.render(window._wlc), confuse:()=>app.innerHTML=renderConfuse(), progress:()=>app.innerHTML=renderProgress(), speed:()=>{ app.innerHTML=renderSpeed(); const i=$("#spin"); if(i){ i.focus(); i.addEventListener("keydown",e=>{ if(e.key==="Enter"&&i.value.trim()){ e.preventDefault(); speedCheck(i.value); } }); clearInterval(window._spT); window._spT=setInterval(()=>{ const t=$("#sptime"); if(!t||!SP||SP.end){ clearInterval(window._spT); return; } t.textContent="⏱ "+Math.round((Date.now()-SP.start)/1000)+" с"; },1000); } }, glossary:()=>app.innerHTML=renderGlossary(), api:()=>app.innerHTML=renderApi(), summary:()=>{} }[view]||(()=>{}))();
  if(view==="quiz"){ const ci=$("#cmdin"); if(ci) ci.focus(); }
}
function streakInfo(){
  const today=dkey(); const x=daily[today]||{}; let streak=0; const d=new Date();
  if(!dayDone(x)) d.setDate(d.getDate()-1);
  for(;;){ if(dayDone(daily[dkey(d)])){streak++; d.setDate(d.getDate()-1);} else break; }
  return {today:x.n||0, min:dayMin(x), done:dayDone(x), streak};
}
function renderHome(){
  const rq=reviewQueue().length, selQ=qsFor(sel).length, gk=genKeysFor(sel);
  const si=streakInfo(); const pct=Math.min(100,Math.round(si.today/opts.goal*100));
  const seg=(key,vals,lab)=>vals.map(v=>`<button class="seg ${opts[key]===v?"on":""}" data-act="opt" data-k="${key}" data-v="${v}">${lab(v)}</button>`).join("");
  const grp=g=>{ const ts=TOPICS.filter(t=>t.g===g); const allOn=ts.every(t=>sel.has(t.id));
    return `<div class="grp"><h3>${g}</h3><button class="linkbtn" data-act="grp" data-g="${g}">${allOn?"Зняти всі":"Обрати всі"}</button></div>`+
    ts.map(t=>{const st=topicStats(t.id);const p=st.acc==null?0:Math.round(st.acc*100);
      return `<label class="topic"><input type="checkbox" data-act="topic" data-t="${t.id}" ${sel.has(t.id)?"checked":""}>
      <span class="name"><b>${t.n}.</b>${esc(t.name)}${st.gen?" 🎲":""}<br><span class="small muted">${st.seen}/${st.n} пройдено${st.acc!=null?" · точність "+p+"%":""}</span></span>
      <span class="bar"><i style="width:${st.n?Math.round(st.mast/st.n*100):0}%"></i></span></label>`;}).join(""); };
  const labsDone=ALLSCEN().filter(s=>labs[s.id]&&labs[s.id].ok).length;
  const T={
   today:()=>`${dayCard()}
  <div class="card">
    <div class="row"><h2 class="grow" style="margin:0">Денна норма${si.done?" ✅":""}</h2><span class="small">${si.streak?`🔥 ${si.streak} ${si.streak===1?"день":si.streak<5?"дні":"днів"} поспіль`:"Серія ще не почалась"}</span></div>
    <div class="bar wide"><i style="width:${pct}%"></i></div>
    <div class="row"><span class="small muted grow">Відповіді: <b>${si.today}</b> / ${opts.goal}${si.today>=opts.goal?" ✅":""}</span>${seg("goal",[10,20,30,50],v=>v)}</div>
    <div class="bar wide"><i style="width:${Math.min(100,Math.round(si.min/opts.tgoal*100))}%"></i></div>
    <div class="row"><span class="small muted grow">Час: <b>${fmtMin(si.min)}</b> / ${fmtMin(opts.tgoal)}${si.min>=opts.tgoal?" ✅":""}</span>${seg("tgoal",[30,60,90,120],v=>v>=60?v/60+" год":v+" хв")}</div>
    <p class="small muted" style="margin:4px 0 8px">День іде в серію, якщо виконано будь-яку з норм. Час у тренажері рахується сам (поки вкладка активна); Packet Tracer, NetAcad, конспекти — запишіть кнопкою нижче.</p>
    ${logForm()}
  </div>
  ${checkinCard()}
  ${weekCard()}${pomoCard()}
  <div class="card"><h2>Повтор помилок <span class="muted">(${rq})</span></h2>
    <p class="small muted" style="margin:0 0 8px">Питання з помилками повертаються через 1, 3, 7, 16 і 35 днів.</p>
    <button class="primary" data-act="review" ${rq?"":"disabled"}>${rq?"Повторити":"Немає питань на сьогодні"}</button></div>
  ${fwCard()}
  ${(()=>{ const pi=planInfo(); return `<div class="card"><h2>🗓 План до екзамену</h2>${pi?`<p style="margin:0 0 6px">${pi.days>0?`До екзамену <b>${pi.days}</b> дн. (${esc(new Date(opts.examDate).toLocaleDateString("uk-UA"))})`:pi.days===0?"Екзамен сьогодні — успіху!":"Дата екзамену минула"} · готовність <b>${Math.round(pi.avg*100)}%</b></p>
    <p class="small muted" style="margin:0 0 6px">Нових питань лишилося: ${pi.unseen}, до повторення сьогодні: ${pi.due}. Щоб устигнути, робіть ≈ <b>${pi.perDay}</b> питань на день${pi.days>3?" (останні 3 дні — лише повторення й симуляції)":""}.</p>
    ${pi.weak.length?`<p class="small" style="margin:0 0 8px">Найслабші теми: ${pi.weak.map(w=>`${tlabel(w.id)} ${esc(TMAP[w.id].name)} — ${Math.round(w.p*100)}%`).join("; ")}</p>`:""}
    <div class="row"><button class="primary" data-act="plan">Почати план на сьогодні</button><button data-act="final">${pi.days>=0&&pi.days<=14?"🏁 Фінішний тиждень":"✅ Чек-лист готовності"}</button><input type="date" id="examdate" value="${esc(opts.examDate)}" style="width:auto"></div>`
    :`<p class="small muted" style="margin:0 0 8px">Вкажіть дату екзамену — тренажер щодня складатиме набір із повторень і найслабших тем і покаже, чи встигаєте.</p><input type="date" id="examdate" style="width:auto">`}</div>`; })()}
`,
   prac:()=>`<div class="card"><h2>🔧 SRWE руками</h2><p class="small muted" style="margin:0 0 8px">Короткі вправи на 2–5 хвилин, зручні з телефона: щоразу нові дані.</p><div class="tools"><button data-act="showread">📟 Читання виводів show</button><button data-act="bugs">🐞 Знайди помилку в конфігурації</button><button data-act="cbuild">🧩 Збери команду з плиток</button><button data-act="stpviz">🌳 STP: передбач зміну</button><button data-act="eclab">🔗 EtherChannel: режими</button><button data-act="runbook">🩺 Діагностика покроково</button></div>
    <div class="row" style="margin-top:8px"><button class="seg ${opts.blind?"on":""}" data-act="blindtoggle">🙈 Перша спроба без варіантів</button></div></div>
  ${(()=>{ const all=ccAll(), due=ccDue(); return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🃏 Картки команд</h2><span class="small muted">${all.length} карток · на сьогодні ${due.length}</span></div><p class="small muted" style="margin:6px 0 8px">Команди, які ви успішно вводили в лабах, повертаються як «введіть команду, щоб…» з інтервальним повторенням. CLI запам'ятовується руками.</p><button class="primary" data-act="ccrun" ${due.length?"":"disabled"}>${due.length?"Повторити "+Math.min(20,due.length):all.length?"Усе повторено на сьогодні":"Пройдіть лабу — картки з'являться"}</button></div>`; })()}
  <div class="card"><h2>🎧 Аудіорежим</h2><p class="small muted" style="margin:0 0 8px">Тренажер читає питання й варіанти вголос, ви відповідаєте великими кнопками, потім чуєте правильну відповідь і пояснення. Для дороги й прогулянок: 20 питань із повторень і вибраних тем.</p><button class="primary" data-act="audstart">▶ Слухати</button></div>
  <div class="card"><h2>🎤 Технічна співбесіда</h2><p class="small muted" style="margin:0 0 8px">${INTERVIEW.Q.length} відкритих питань (мережі, Linux, Windows/AD, DevOps, безпека, поведінкові) і ${INTERVIEW.SC.length} співбесіди-ситуації. Відповідайте вголос чи текстом, звіряйтеся з ключовими пунктами й еталоном. ${ivDue().length?"На повторення: "+ivDue().length:""}</p><button class="primary" data-act="interview">▶ Почати</button></div>
<div class="card"><h2>Тест модуля</h2>
    <p class="small muted" style="margin:0 0 8px">20 питань по одному модулю: спершу 🎓 NetAcad і слабкі місця, потім нові та розрахунки.</p>
    <select class="full" id="modsel">${COURSES.map(([g])=>`<optgroup label="${g}">${TOPICS.filter(t=>t.g===g).map(t=>`<option value="${t.id}" ${opts.modTopic===t.id?"selected":""}>${g} ${t.n}. ${esc(t.name)} (${QB.filter(q=>q.t===t.id).length})</option>`).join("")}</optgroup>`).join("")}</select>
    <div class="row" style="margin-top:8px"><button data-act="cheat">📄 Шпаргалка</button><span class="grow"></span><button class="primary" data-act="module">Почати тест модуля</button></div></div>
  <div class="card"><h2>Тренування</h2>
    <p class="small muted" style="margin:0 0 8px">Розбір одразу. Спершу питання з помилками й нові${gk.length?", плюс розрахунки з генератора":""}. Складність адаптивна: у темах, де точність понад 85%, першими йдуть симлети, порядок кроків і питання з кількома відповідями.</p>
    <div class="row">${seg("train",[10,20,0],v=>v?v:"Усі")}<span class="grow"></span><button class="primary" data-act="train" ${selQ?"":"disabled"}>Почати</button></div></div>
  <div class="card"><h2>Розрахунки 🎲</h2>
    <p class="small muted" style="margin:0 0 8px">Щоразу нові числа — відповіді не завчиш.</p>
    <div class="chips">${Object.entries(GEN.list).map(([k,g])=>`<button class="seg" data-act="gen" data-k="${k}">${esc(g.name)}</button>`).join("")}</div></div>
  <div class="card"><div class="row"><h2 class="grow" style="margin:0">CLI-лаби</h2><span class="small muted">виконано ${labsDone}/${ALLSCEN().length}</span></div>
    <p class="small muted" style="margin:6px 0 8px">Налаштовуйте пристрої командами IOS: від одного комутатора до мережі з маршрутизатором і ПК (ping, tracert).</p>
    <button class="primary" data-act="labs">Відкрити лаби</button></div>
  <div class="card"><h2>🎯 Симуляція CCNA 200-301 <span class="small muted">${esc(bpVer())}</span></h2>
    <p class="small muted" style="margin:0 0 8px">Як справжній іспит: питання з усіх курсів за вагами доменів Cisco ${esc(bpVer())} (${SIM_DOMAINS[bpVer()].map(([n,w])=>n[0].toLowerCase()+n.slice(1)+" "+Math.round(w*100)+"%").join(", ")}), без повернення назад, бал за шкалою 300–1000 (прохідний ≈ 825).</p>
    <div class="row"><button class="primary" data-act="ccna" data-n="120">Повна: 120 питань / 120 хв</button><button data-act="ccna" data-n="40">Коротка: 40 / 40 хв</button></div>
    <div class="row" style="margin-top:6px"><button data-act="ccna" data-n="120" data-en="1">🇬🇧 Повна англійською</button><button data-act="ccna" data-n="40" data-en="1">🇬🇧 Коротка англійською</button></div>
    <div class="row" style="margin-top:6px"><button class="linkbtn" data-act="bpdiff">🔄 Що змінюється у v2.0 і симуляції обох версій</button></div>
    <p class="small muted" style="margin:6px 0 0">Справжній іспит — лише англійською. В англійському режимі питання й варіанти англійські, а в результатах видно час на кожне питання.</p></div>
  <div class="card"><h2>Екзамен</h2>
    <p class="small muted" style="margin:0 0 8px">Без підказок, 1 хв на питання, розбір наприкінці.</p>
    <div class="row">${seg("exam",[20,40,60],v=>v)}<span class="grow"></span><button class="primary" data-act="exam" ${selQ?"":"disabled"}>Почати</button></div></div>
  <div class="card"><div class="row"><h2 class="grow" style="margin:0">Теми</h2><span class="small muted">питань: ${selQ}</span></div>
    <div class="row" style="margin:8px 0 4px"><span class="small muted">Джерело:</span>${[["all","Усі"],["n","📒 Нотатки"],["na","🎓 NetAcad"],["my","✍ Мої"],["en","🇬🇧 English"]].map(([v,l])=>`<button class="seg ${opts.src===v?"on":""}" data-act="src" data-v="${v}">${l}${v!=="all"?" ("+QB.filter(q=>q.src===v).length+")":""}</button>`).join("")}</div>
    ${grp("ITN")}${grp("SRWE")}${grp("ENSA")}
    <p class="small muted" style="margin:10px 0 0">Смужка — частка засвоєних питань (3+ правильні поспіль). 🎲 — є генератор.</p></div>
`,
   prog:()=>`${readinessCard()}
  ${milesCard()}
  ${Object.keys(prog).length>=20?forecastCard(true):""}
  <div class="row"><button class="ghost grow" data-act="stats">📊 Статистика</button><button class="ghost grow" data-act="progress">📅 Активність і досягнення</button><button class="ghost grow" data-act="issues">🛠 На виправлення</button></div>`,
   tools:()=>`<div class="card"><h2>Інструменти</h2><div class="tools"><button data-act="speedmenu">⚡ Швидкісні тренування</button><button data-act="confuse">🧠 Що я плутаю</button><button data-act="glossary">🇬🇧 Терміни EN</button><button data-act="progress">🏆 Активність і досягнення</button><button data-act="stpviz">🌳 STP покроково</button><button data-act="eclab">🔗 EtherChannel: режими</button><button data-act="modtrack">📚 Трекер модулів NetAcad</button><button data-act="ptguide">🧭 Packet Tracer: супровід</button><button data-act="confcheck">🔍 Аналізатор конфігурацій</button><button data-act="confgen">🛠 Генератор конфігурацій</button><button data-act="ref">📘 Довідник SRWE</button><button data-act="runbook">🩺 Діагностика покроково</button><button data-act="traps">🪤 Пастки й час</button><button data-act="bpview">🗺 Карта покриття CCNA</button><button data-act="weekview">🗓 Тижневий огляд</button><button data-act="msview">🎯 Віхи</button><button data-act="issues">🛠 На виправлення${(()=>{ const n=issuesList().length; return n?" ("+n+")":""; })()}</button><button data-act="obsexport">📒 Експорт в Obsidian</button><button data-act="labs">🌐 Лаби й пісочниця</button></div></div>
  ${installCard()}
  <div class="row">
    <button class="ghost grow" data-act="stats">📊 Статистика</button><button class="ghost grow" data-act="search">🔎 Пошук</button><button class="ghost grow" data-act="custom">✍ Мої питання</button>
  </div>
  <div class="row" style="margin-top:8px">
    <button class="ghost grow" data-act="settings">⚙ Налаштування</button><button class="ghost grow" data-act="backup">💾 Копія</button>
  </div>
  ${store.mode==="local"?`<div class="note">Хмарне сховище недоступне: прогрес зберігається лише в цьому браузері. Зробіть резервну копію.</div>`:""}`};
  const tab=T[opts.homeTab]?opts.homeTab:(opts.homeTab==="all"?"all":"today");
  const TB=[["today","☀ Сьогодні"],["prac","🧪 Практика"],["prog","📈 Прогрес"],["tools","🧰 Інструменти"],["all","☰ Усе"]];
  return `${authCard()}
  <div class="hometabs" role="tablist">${TB.map(([k,l])=>`<button class="seg ${tab===k?"on":""}" role="tab" aria-selected="${tab===k}" data-act="hometab" data-v="${k}">${l}</button>`).join("")}</div>
  ${tab==="all"?T.today()+T.prac()+T.prog()+T.tools():T[tab]()}`;
}
// ================= Тест модуля =================
function cheatHTML(tid){ const c=(window.CHEATS||{})[tid]; if(!c) return `<p class="small muted">Для цієї теми шпаргалки ще немає.</p>`;
  return (c.t?`<div style="overflow-x:auto"><table class="cheat"><tr>${c.t[0].map(h=>`<th>${esc(h)}</th>`).join("")}</tr>${c.t.slice(1).map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</table></div>`:"")+
    (c.p?`<ul class="cheatl">${c.p.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:"")+(c.c?`<pre>${esc(c.c)}</pre>`:""); }
function renderCheat(){ const tid=opts.modTopic||"SRWE1";
  return `<div class="card"><h2>📄 Шпаргалка</h2><select class="full" id="cheatsel">${COURSES.map(([g])=>`<optgroup label="${g}">${TOPICS.filter(t=>t.g===g).map(t=>`<option value="${t.id}" ${tid===t.id?"selected":""}>${g} ${t.n}. ${esc(t.name)}</option>`).join("")}</optgroup>`).join("")}</select></div>
  <div class="card"><h2>${tlabel(tid)} · ${esc(TMAP[tid].name)}</h2>${cheatHTML(tid)}</div>
  <div class="row"><button class="primary grow" data-act="module2">Пройти тест модуля</button><button class="grow" data-act="home">На головну</button></div>`; }
// ---- Симуляція CCNA 200-301 ----
const DOMAINS=[["Основи мереж",0.20,["ITN1","ITN3","ITN4","ITN5","ITN6","ITN7","ITN8","ITN9","ITN11","ITN12","ITN13","ITN14","SRWE2","ENSA7","ENSA11","ENSA12"]],
 ["Доступ до мережі",0.20,["ITN2","ITN10","SRWE1","SRWE3","SRWE5","SRWE6","SRWE12","SRWE13"]],
 ["IP-зв'язність",0.25,["SRWE4","SRWE9","SRWE14","SRWE15","SRWE16","ENSA1","ENSA2"]],
 ["IP-сервіси",0.10,["ITN15","SRWE7","SRWE8","ENSA6","ENSA9","ENSA10"]],
 ["Основи безпеки",0.15,["ITN16","ITN17","SRWE10","SRWE11","ENSA3","ENSA4","ENSA5","ENSA8"]],
 ["Автоматизація",0.10,["ENSA13","ENSA14"]]];
const domainOf=(t,ver)=>{ const D=(typeof SIM_DOMAINS!=="undefined"&&SIM_DOMAINS[ver||"v1.1"])||DOMAINS; const d=D.find(x=>x[2].includes(t)); return d?d[0]:"Інше"; };
function pickCcna(n,en){
  const out=[]; const used=new Set(); const trOk=q=>!en||q.src==="en"||!!(window.QB_TR&&window.QB_TR[q.id]);
  for(const [name,w,ts] of (SIM_DOMAINS[bpVer()]||DOMAINS)){ const want=Math.round(n*w); const set=new Set(ts);
    const gk=en?[]:GEN.forTopics(set); const ng=gk.length?Math.round(want*0.15):0;
    const qs=shuffle(QB.filter(q=>set.has(q.t)&&!used.has(q.id)&&qtype(q)!=="flash"&&trOk(q))).slice(0,want-ng); qs.forEach(q=>used.add(q.id)); out.push(...qs);
    for(let i=0;i<ng;i++){ const g=GEN.make(gk[i%gk.length]); if(g) out.push(g); } }
  const sims=en?[]:shuffle(SIM_POOL).slice(0,n>=100?3:1).map(simQ).filter(Boolean);
  return shuffle(out).slice(0,n-sims.length).concat(sims);
}
// ---- План до дати екзамену ----
function planInfo(){
  if(!opts.examDate) return null; const days=Math.ceil((new Date(opts.examDate+"T09:00:00")-Date.now())/864e5);
  const all=TOPICS.filter(t=>t.g!=="LNX").map(t=>Object.assign({id:t.id},topicReady(t.id)||{p:0,n:0,seen:0})).filter(x=>x.n);
  const avg=all.reduce((a,x)=>a+x.p*x.n,0)/Math.max(1,all.reduce((a,x)=>a+x.n,0));
  const unseen=all.reduce((a,x)=>a+(x.n-x.seen),0); const due=Object.values(prog).filter(r=>r.d&&r.d<=Date.now()).length;
  const perDay=days>0? Math.ceil(unseen/Math.max(1,days-3))+Math.min(due,40) : due;
  const weak=all.filter(x=>x.seen>0||x.p<0.5).sort((a,b)=>a.p-b.p).slice(0,3);
  return {days,avg,unseen,due,perDay,weak};
}
function startPlan(){ const pi=planInfo(); if(!pi) return; const set=new Set(pi.weak.map(w=>w.id)); for(const [id,r] of Object.entries(prog)) if(r.d&&r.d<=Date.now()&&QMAP[id]) set.add(QMAP[id].t);
  startSession("train", pickTraining(set, Math.max(opts.goal, Math.min(60,pi.perDay))), "План на сьогодні"); }
function pickModule(tid){
  const now=Date.now(); const qs=QB.filter(q=>q.t===tid);
  const na=shuffle(qs.filter(q=>q.src==="na"));
  const weak=shuffle(qs.filter(q=>q.src!=="na"&&prog[q.id]&&prog[q.id].k===0));
  const fresh=shuffle(qs.filter(q=>q.src!=="na"&&!prog[q.id]));
  const rest=shuffle(qs.filter(q=>q.src!=="na"&&prog[q.id]&&prog[q.id].k!==0)).sort((a,b)=>(prog[a.id].b||0)-(prog[b.id].b||0));
  const gk=Object.entries(GEN.list).filter(([k,g])=>g.t===tid).map(([k])=>k);
  const ng=gk.length?Math.min(4,Math.max(2,20-qs.length)):0;
  let list=[...na,...weak,...fresh,...rest].slice(0,20-ng);
  for(let i=0;i<ng;i++){ const g=GEN.make(gk[i%gk.length]); if(g) list.push(g); }
  const lab=shuffle(ALLSCEN().filter(x=>x.t===tid&&!x.discover)).map(x=>simQ(x.id)).filter(Boolean)[0];
  list=shuffle(list); if(lab){ list=list.slice(0,19); list.push(lab); }
  return list;
}

// ================= Прогноз готовності =================
// Оцінка ймовірності правильної відповіді: точність питання × «пам'ять» (згасає з часом, повільніше для засвоєних).
function pKnow(id){
  const r=prog[id]; if(!r) return 0.25;
  const acc=(r.c+1)/(r.c+r.w+2);
  const ret= r.fs? fR((Date.now()-(r.l||0))/DAY,r.fs.S) : Math.exp(-(Date.now()-(r.l||0))/(DAY*(1+[1,2,5,12,25,50][Math.min(5,r.b||0)])));
  return 0.25+0.75*acc*(r.k?Math.max(ret,0.35):ret*0.6);
}
function topicReady(tid){
  const ids=QB.filter(q=>q.t===tid).map(q=>q.id).concat(Object.keys(GEN.topicOf).filter(g=>GEN.topicOf[g]===tid));
  if(!ids.length) return null;
  const seen=ids.filter(i=>prog[i]).length;
  return {p:ids.reduce((s,i)=>s+pKnow(i),0)/ids.length, n:ids.length, seen};
}
function courseReady(g){
  const ts=TOPICS.filter(t=>t.g===g).map(t=>Object.assign({t},topicReady(t.id)||{p:0,n:0,seen:0}));
  const n=ts.reduce((s,x)=>s+x.n,0); return {p:n?ts.reduce((s,x)=>s+x.p*x.n,0)/n:0, seen:ts.reduce((s,x)=>s+x.seen,0), n, topics:ts};
}
function readinessCard(){
  const cs=COURSES.map(([g])=>[g,courseReady(g)]);
  if(!cs.some(([g,c])=>c.seen)) return "";
  const weak=TOPICS.map(t=>({t,r:topicReady(t.id)})).filter(x=>x.r&&x.r.seen>=3).sort((a,b)=>a.r.p-b.r.p).slice(0,3);
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">Готовність</h2><button class="linkbtn" data-act="stats">детальніше</button></div>
    <div class="course" style="margin-top:8px">${cs.map(([g,c])=>`<div><span class="small muted">${g}</span><b>${Math.round(c.p*100)}%</b><span class="small muted">${c.seen}/${c.n}</span></div>`).join("")}</div>
    ${weak.length?`<p class="small muted" style="margin:8px 0 0">Найслабше: ${weak.map(x=>tlabel(x.t.id)+" "+esc(x.t.name)+" ("+Math.round(x.r.p*100)+"%)").join(", ")}</p>`:""}</div>`;
}
function readinessSection(){
  return COURSES.map(([g,name])=>{ const c=courseReady(g);
    return `<h3>${g} — ${Math.round(c.p*100)}%</h3>`+c.topics.map(x=>`<div class="kv"><span>${x.t.n}. ${esc(x.t.name)} <span class="small muted">${x.seen}/${x.n}</span></span><span style="display:flex;align-items:center;gap:8px"><span class="bar"><i style="width:${Math.round(x.p*100)}%;background:var(${x.p>=0.75?"--ok":x.p>=0.5?"--warn":"--bad"})"></i></span><b class="small">${Math.round(x.p*100)}%</b></span></div>`).join(""); }).join("")+
  `<p class="small muted" style="margin:8px 0 0">Оцінка ймовірності правильної відповіді: враховує точність, давність повторення та вгадування (25%) для непройдених питань.</p>`;
}

// ================= Налаштування =================
function renderSettings(){
  const seg=(k,vals)=>vals.map(([v,l])=>`<button class="seg ${opts[k]===v?"on":""}" data-act="setopt" data-k="${k}" data-v="${v}">${l}</button>`).join("");
  return `<div class="card"><h2>Вигляд</h2>
    <div class="kv"><span>Тема</span><span class="row">${seg("theme",[["auto","Авто"],["light","Світла"],["dark","Темна"]])}</span></div>
    <div class="kv"><span>Розмір шрифту</span><span class="row">${seg("fs",[[14,"A−"],[16,"A"],[18,"A+"],[20,"A++"]])}</span></div></div>
  <div class="card"><h2>Навчання</h2>
    <div class="kv"><span>Перемішувати варіанти відповідей</span><span class="row">${seg("shuffle",[[true,"Так"],[false,"Ні"]])}</span></div>
    <div class="kv"><span>Звук правильної/неправильної відповіді</span><span class="row">${seg("sound",[[true,"Увімк."],[false,"Вимк."]])}</span></div>
    <div class="kv"><span>Мова питань</span><span class="row">${seg("lang",[["uk","Українська"],["mix","Змішано"],["en","English"]])}</span></div>
    <p class="small muted" style="margin:6px 0">English — увесь банк CCNA перекладено англійською (як на справжньому іспиті); під кожним питанням можна розгорнути український оригінал. Змішано — оригінали плюс окремі англомовні питання.</p>
    <div class="kv"><span>Підказувати англійські терміни в питаннях</span><span class="row">${seg("enTerms",[[true,"Так"],[false,"Ні"]])}</span></div>
    <p class="small muted" style="margin:6px 0">Інтервали повторення рахує алгоритм FSRS (як у сучасному Anki): він оцінює стабільність пам'яті для кожного питання і повертає його, коли ймовірність пригадати падає до 90%. На комп'ютері: 1–9 — варіант, Enter — перевірити/далі, F — сумнівне, ? — довідка.</p>
    <div class="kv"><span>Денна норма</span><span class="row">${seg("goal",[[10,"10"],[20,"20"],[30,"30"],[50,"50"]])}</span></div>
    <div class="kv"><span>Норма часу</span><span class="row">${seg("tgoal",[[30,"30 хв"],[60,"1 год"],[90,"1.5 год"],[120,"2 год"]])}</span></div></div>
  <div class="card"><h2>🔔 Push-сповіщення</h2><p class="small muted" style="margin:0 0 8px">Щодня у вибраний нижче час сервер перевіряє вашу денну норму і, якщо її ще не виконано, надсилає сповіщення: скільки лишилося і що серія днів під загрозою. Працює навіть із закритим тренажером. На iPhone — лише якщо тренажер встановлено на початковий екран.</p>
    ${opts.pushId?`<div class="row"><span class="grow">✅ Увімкнено на цьому пристрої</span><button data-act="pushoff">Вимкнути</button></div>`:`<button class="primary" data-act="pushon">Увімкнути push</button>`}<p class="small muted" id="pushmsg" style="margin:6px 0 0"></p></div>
  <div class="card"><h2>Нагадування</h2><p class="small muted" style="margin:0 0 8px">Щоденне нагадування з'явиться у вашому календарі (Google, Apple, Outlook) і спрацює навіть із закритим тренажером. Відкрийте завантажений файл .ics на телефоні — календар запропонує додати подію.</p>
    <div class="row"><label class="small">Час</label><input type="time" id="remtime" value="${esc(opts.remind||"19:00")}" style="width:auto"><button class="primary" data-act="ics">📅 Додати в календар</button></div>
    <p class="small muted" style="margin:8px 0 0">${(()=>{const d=daily[dkey()]; const n=d?d.n||0:0; return n>=opts.goal?"✅ Сьогоднішню норму виконано.":"Сьогодні: "+n+"/"+opts.goal+" — до норми ще "+(opts.goal-n)+".";})()}</p></div>
  <button class="primary" data-act="home">На головну</button>`;
}

// ================= Мої питання =================
let customDraft=null, customEdit=null;
function customForm(q){
  q=q||{t:opts.modTopic||"SRWE1",q:"",c:"",o:[["",""],["",""],["",""],["",""]],a:[],src:"my",n:""};
  return `<div class="card"><h2>${customEdit?"Редагувати питання":"Нове питання"}</h2>
    <label class="small muted">Тема</label><select class="full" id="cf_t">${COURSES.map(([g])=>`<optgroup label="${g}">${TOPICS.filter(t=>t.g===g).map(t=>`<option value="${t.id}" ${q.t===t.id?"selected":""}>${g} ${t.n}. ${esc(t.name)}</option>`).join("")}</optgroup>`).join("")}</select>
    <label class="small muted">Джерело</label><select class="full" id="cf_src"><option value="my" ${q.src!=="na"?"selected":""}>✍ Моє</option><option value="na" ${q.src==="na"?"selected":""}>🎓 NetAcad</option></select>
    <label class="small muted">Питання</label><textarea id="cf_q" style="min-height:70px;font:inherit">${esc(q.q)}</textarea>
    <label class="small muted">Вивід/конфіг (необов'язково)</label><textarea id="cf_c" style="min-height:60px">${esc(q.c||"")}</textarea>
    <div class="small muted" style="margin-top:6px">Варіанти: позначте правильні (можна кілька) і за бажанням додайте пояснення.</div>
    ${q.o.map((o,i)=>`<div class="mrow"><label class="row"><input type="checkbox" class="cf_ok" ${q.a.includes(i)?"checked":""} style="width:20px;height:20px"> <span class="small">Правильний</span></label><input type="text" class="cf_o" placeholder="Варіант ${letters[i]}" value="${esc(o[0])}"><input type="text" class="cf_e" placeholder="Пояснення (необов'язково)" value="${esc(o[1])}"></div>`).join("")}
    ${q.o.length<6?`<button class="mini" data-act="caddopt">+ Варіант</button>`:""}
    <label class="small muted">Примітка / загальне пояснення</label><input type="text" id="cf_n" value="${esc(q.n||"")}">
    <div class="row" style="margin-top:10px"><button class="primary" data-act="csave">Зберегти</button>${customEdit?`<button data-act="cadd">Скасувати</button>`:""}<span id="cmsg" class="small muted"></span></div></div>`;
}
function readCustomForm(){
  const o=[...document.querySelectorAll(".cf_o")].map((el,i)=>[el.value.trim(),(document.querySelectorAll(".cf_e")[i]||{}).value||""]);
  const a=[...document.querySelectorAll(".cf_ok")].map((el,i)=>el.checked?i:-1).filter(i=>i>=0);
  return {t:$("#cf_t").value, src:$("#cf_src").value, q:$("#cf_q").value.trim(), c:$("#cf_c").value.replace(/\s+$/,""), o, a, n:$("#cf_n").value.trim()};
}
function saveCustom(){
  const f=readCustomForm(); const msg=$("#cmsg");
  const keep=f.o.map((x,i)=>({x,i})).filter(z=>z.x[0]);
  if(!f.q){ msg.textContent="Введіть текст питання."; return; }
  if(keep.length<2){ msg.textContent="Потрібно щонайменше 2 варіанти."; return; }
  const a=keep.map((z,j)=>f.a.includes(z.i)?j:-1).filter(j=>j>=0);
  if(!a.length){ msg.textContent="Позначте правильний варіант."; return; }
  const o=keep.map(z=>[z.x[0], z.x[1].trim()||(f.a.includes(z.i)?"Правильно.":"Неправильно.")]);
  const id=customEdit||("c-"+Date.now().toString(36)+Math.random().toString(36).slice(2,5));
  let q=f.q; if(a.length>1 && !/Оберіть/i.test(q)) q+=" (Оберіть "+a.length+".)";
  const rec={id,t:f.t,src:f.src,q,o,a,ts:Date.now(),custom:true}; if(f.c) rec.c=f.c; if(f.n) rec.n=f.n;
  customQs=customQs.filter(x=>x.id!==id).concat([rec]); lsSet(LS.custom,customQs); rebuildQB();
  if(store.mode==="db") queueWrite(()=>store.db.doc("custom/"+id).set(rec));
  customEdit=null; customDraft=null; render(); const m=$("#cmsg"); if(m) m.textContent="Збережено ✓";
}
function deleteCustom(id){
  customQs=customQs.filter(x=>x.id!==id); lsSet(LS.custom,customQs); rebuildQB();
  if(store.mode==="db") queueWrite(()=>store.db.doc("custom/"+id).delete());
  if(customEdit===id) customEdit=null; render();
}
ACTS.hometab = el => { opts.homeTab = el.dataset.v; lsSet(LS.opts, opts); render(); scrollTop(); };
