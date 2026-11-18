// Лаба автоматизації: імітація REST API контролера (у стилі Cisco Catalyst Center / DNA Center).
(function(){
const BASE="https://controller.lab";
const USER="devnet", PASS="Cisco123!";
function newState(){ return {token:null, issued:0, vlans:{1:{name:"default"},10:{name:"USERS"},99:{name:"OLD-MGMT"}},
  devices:[
    {id:"a1f3-01",hostname:"CORE-R1",managementIpAddress:"10.10.0.1",platformId:"ISR4331",softwareVersion:"17.9.4a",role:"BORDER ROUTER",reachabilityStatus:"Reachable",family:"Routers"},
    {id:"a1f3-02",hostname:"DIST-SW1",managementIpAddress:"10.10.0.11",platformId:"C9300-48P",softwareVersion:"17.6.5",role:"DISTRIBUTION",reachabilityStatus:"Reachable",family:"Switches and Hubs"},
    {id:"a1f3-03",hostname:"ACC-SW1",managementIpAddress:"10.10.0.21",platformId:"C9200L-24P",softwareVersion:"17.6.5",role:"ACCESS",reachabilityStatus:"Reachable",family:"Switches and Hubs"},
    {id:"a1f3-04",hostname:"ACC-SW2",managementIpAddress:"10.10.0.22",platformId:"C9200L-24P",softwareVersion:"17.3.1",role:"ACCESS",reachabilityStatus:"Unreachable",family:"Switches and Hubs"}],
  log:[], done:{}}; }
const TASKS=[
 {id:"auth",t:"Отримайте токен: POST /dna/system/api/v1/auth/token з Basic-автентифікацією (логін devnet, пароль Cisco123!). У заголовку: Authorization: Basic <base64(логін:пароль)>.",h:"Підказка: btoa(\"devnet:Cisco123!\") = "+(typeof btoa!=="undefined"?btoa(USER+":"+PASS):"ZGV2bmV0OkNpc2NvMTIzIQ==")},
 {id:"list",t:"Отримайте список пристроїв: GET /dna/intent/api/v1/network-device із заголовком X-Auth-Token: <токен>."},
 {id:"filter",t:"Знайдіть лише комутатори доступу через параметр запиту: …/network-device?role=ACCESS."},
 {id:"answer",t:"Яка версія ПЗ на пристрої, що недоступний (Unreachable)? Впишіть у поле «Відповідь».",ans:"17.3.1"},
 {id:"create",t:"Створіть VLAN 30 з назвою GUEST: POST /dna/intent/api/v1/vlan, Content-Type: application/json, тіло {\"vlanId\": 30, \"name\": \"GUEST\"}."},
 {id:"update",t:"Перейменуйте VLAN 30 на VISITORS: PUT /dna/intent/api/v1/vlan/30 з тілом {\"name\": \"VISITORS\"}."},
 {id:"delete",t:"Видаліть застарілу VLAN 99: DELETE /dna/intent/api/v1/vlan/99."}];
function resp(code,body,extra){ return Object.assign({code,status:{200:"OK",201:"Created",204:"No Content",400:"Bad Request",401:"Unauthorized",403:"Forbidden",404:"Not Found",405:"Method Not Allowed",409:"Conflict",415:"Unsupported Media Type"}[code],body:body===undefined?null:body},extra||{}); }
function handle(st,req){
  const method=(req.method||"GET").toUpperCase(); let url=(req.url||"").trim(); if(url.startsWith(BASE)) url=url.slice(BASE.length); if(!url.startsWith("/")) url="/"+url;
  const [path,qs]=url.split("?"); const q={}; (qs||"").split("&").filter(Boolean).forEach(kv=>{ const [k,v]=kv.split("="); q[decodeURIComponent(k)]=decodeURIComponent(v||""); });
  const H={}; (req.headers||"").split("\n").map(l=>l.trim()).filter(Boolean).forEach(l=>{ const i=l.indexOf(":"); if(i>0) H[l.slice(0,i).trim().toLowerCase()]=l.slice(i+1).trim(); });
  let body=null; if(req.body&&req.body.trim()){ if(!/application\/json/i.test(H["content-type"]||"")) return resp(415,{error:"Content-Type має бути application/json"}); try{ body=JSON.parse(req.body); }catch(e){ return resp(400,{error:"Невалідний JSON: "+e.message}); } }
  const authed=()=> st.token && H["x-auth-token"]===st.token;
  st.log.push({method,url,ts:Date.now()});
  if(path==="/dna/system/api/v1/auth/token"){
    if(method!=="POST") return resp(405,{error:"Для отримання токена використовуйте POST"});
    const a=H["authorization"]||""; const m=a.match(/^Basic\s+(.+)$/i); let ok=false; if(m){ try{ ok=atob(m[1])===USER+":"+PASS; }catch(e){} }
    if(!ok) return resp(401,{error:"Невірні облікові дані або відсутній заголовок Authorization: Basic …"});
    st.token="eyJhbGciOiJSUzI1NiJ9."+Math.random().toString(36).slice(2,14)+"."+Date.now().toString(36); st.done.auth=true; return resp(200,{Token:st.token});
  }
  if(!path.startsWith("/dna/intent/api/v1/")) return resp(404,{error:"Ресурс не знайдено: "+path});
  if(!H["x-auth-token"]) return resp(401,{error:"Відсутній заголовок X-Auth-Token"});
  if(!authed()) return resp(401,{error:"Токен недійсний — отримайте новий"});
  const r=path.slice("/dna/intent/api/v1/".length);
  if(r==="network-device"){ if(method!=="GET") return resp(405,{error:"Дозволено лише GET"});
    let list=st.devices.slice(); for(const [k,v] of Object.entries(q)){ list=list.filter(d=>d[k]!==undefined&&String(d[k]).toLowerCase()===v.toLowerCase()); }
    if(!Object.keys(q).length) st.done.list=true; if(q.role&&q.role.toUpperCase()==="ACCESS") st.done.filter=true;
    return resp(200,{response:list,version:"1.0"}); }
  let m=r.match(/^network-device\/([\w-]+)$/); if(m){ const d=st.devices.find(x=>x.id===m[1]); return d? resp(200,{response:d}) : resp(404,{error:"Пристрій "+m[1]+" не знайдено"}); }
  if(r==="vlan"){
    if(method==="GET") return resp(200,{response:Object.entries(st.vlans).map(([id,v])=>({vlanId:Number(id),name:v.name}))});
    if(method==="POST"){ if(!body) return resp(400,{error:"Потрібне тіло JSON"}); const id=Number(body.vlanId); if(!Number.isInteger(id)||id<1||id>4094) return resp(400,{error:"vlanId має бути цілим числом 1–4094"}); if(typeof body.name!=="string"||!body.name) return resp(400,{error:"Поле name обов'язкове (рядок)"});
      if(st.vlans[id]) return resp(409,{error:"VLAN "+id+" уже існує — для зміни використовуйте PUT"}); st.vlans[id]={name:body.name}; if(id===30&&body.name==="GUEST") st.done.create=true; return resp(201,{response:{vlanId:id,name:body.name},message:"Created"}); }
    return resp(405,{error:"Для колекції дозволено GET і POST"}); }
  m=r.match(/^vlan\/(\d+)$/); if(m){ const id=Number(m[1]); if(!st.vlans[id]) return resp(404,{error:"VLAN "+id+" не існує"});
    if(method==="GET") return resp(200,{response:{vlanId:id,name:st.vlans[id].name}});
    if(method==="PUT"||method==="PATCH"){ if(!body||typeof body.name!=="string") return resp(400,{error:"Очікується {\"name\": \"…\"}"}); st.vlans[id].name=body.name; if(id===30&&body.name==="VISITORS") st.done.update=true; return resp(200,{response:{vlanId:id,name:body.name}}); }
    if(method==="DELETE"){ if(id===1) return resp(403,{error:"VLAN 1 не можна видалити"}); delete st.vlans[id]; if(id===99) st.done.delete=true; return resp(204); }
    return resp(405,{error:"Метод "+method+" не підтримується"}); }
  return resp(404,{error:"Ресурс не знайдено: "+path});
}
window.APILAB={BASE,TASKS,newState,handle};
})();
