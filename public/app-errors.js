// Моніторинг помилок JavaScript у продакшені: window.onerror і unhandledrejection.
// Завжди пише в localStorage (останні 30, з лічильником повторів); якщо є вхід у Firebase —
// ще й у users/{uid}/errors (не більше 10 за сеанс, кожна унікальна помилка — раз на добу).
// Перегляд — у розділі «🛠 На виправлення». Підключається першим скриптом, щоб ловити й ранні помилки.
(function(){
const KEY="ccna.errors", MAXL=30, MAXSEND=10; let sent=0;
const ver=(document.querySelector('meta[name="build"]')||{}).content||"";
const load=()=>{ try{ return JSON.parse(localStorage.getItem(KEY)||"[]"); }catch(e){ return []; } };
const save=L=>{ try{ localStorage.setItem(KEY,JSON.stringify(L.slice(0,MAXL))); }catch(e){} };
const noise=m=>/ResizeObserver loop|Script error\.?$|^Load failed$|NetworkError when attempting|Failed to fetch|The operation was aborted|AbortError|QuotaExceeded|chrome-extension:|moz-extension:/i.test(m);
const curView=()=>{ try{ return typeof view!=="undefined"? String(view) : ""; }catch(e){ return ""; } };
function capture(o){
  const msg=String(o.message||"Unknown error").slice(0,300); if(noise(msg)||noise(o.src||"")) return null;
  if(o.src&&/^https?:\/\//.test(o.src)&&o.src.indexOf(location.origin)!==0) return null;
  const src=String(o.src||"").replace(location.origin,"").slice(0,120); const key=msg+"|"+src+"|"+(o.line||0);
  const L=load(); const now=Date.now(); let e=L.find(x=>x.key===key);
  if(e){ e.n=(e.n||1)+1; e.ts=now; e.view=curView(); e.stack=e.stack||o.stack; L.splice(L.indexOf(e),1); L.unshift(e); }
  else { e={key,msg,src,line:o.line||0,col:o.col||0,stack:String(o.stack||"").split("\n").slice(0,6).join("\n").slice(0,800),view:curView(),ua:navigator.userAgent.slice(0,140),ver,first:now,ts:now,n:1,kind:o.kind||"error",up:0}; L.unshift(e); }
  save(L); flush(); return e; }
function flush(){ let st; try{ st=typeof store!=="undefined"?store:null; }catch(e){ st=null; } if(!st||st.mode!=="db"||!st.db) return;
  const L=load(); const day=864e5; let ch=false;
  for(const e of L){ if(sent>=MAXSEND) break; if(e.up&&Date.now()-e.up<day) continue;
    sent++; e.up=Date.now(); ch=true; const doc={msg:e.msg,src:e.src,line:e.line,col:e.col,stack:e.stack,view:e.view,ua:e.ua,ver:e.ver,n:e.n,ts:e.ts,first:e.first,kind:e.kind};
    try{ st.db.collection("errors").add(doc).catch(()=>{}); }catch(x){} }
  if(ch) save(L); }
window.addEventListener("error",ev=>{ if(ev&&ev.target&&ev.target!==window&&ev.target.tagName) return; capture({message:ev.message||(ev.error&&ev.error.message),src:ev.filename,line:ev.lineno,col:ev.colno,stack:ev.error&&ev.error.stack}); });
window.addEventListener("unhandledrejection",ev=>{ const r=ev.reason; capture({message:"Unhandled promise: "+(r&&r.message||String(r)),stack:r&&r.stack,kind:"promise"}); });
setInterval(flush,30000);
async function remote(){ let st; try{ st=store; }catch(e){ return null; } if(!st||st.mode!=="db"||!st.db) return null;
  const q=await st.db.collection("errors").orderBy("ts","desc").limit(30).get(); return q.docs.map(d=>Object.assign({id:d.id},d.data())); }
function md(list){ const L=["# CCNA тренажер — помилки JavaScript","","Згенеровано "+new Date().toLocaleString("uk-UA"),""];
  for(const e of list) L.push("## "+e.msg,"","- Де: `"+(e.src||"?")+":"+e.line+":"+e.col+"`, екран: "+(e.view||"—")+", повторів: "+(e.n||1),"- Коли: "+new Date(e.ts).toLocaleString("uk-UA")+(e.ver?", збірка "+e.ver:""),"- Браузер: "+(e.ua||"—"),"",e.stack?"```\n"+e.stack+"\n```\n":"");
  return L.join("\n"); }
window.ERRMON={capture,flush,list:load,clear:()=>save([]),remote,md};
})();
