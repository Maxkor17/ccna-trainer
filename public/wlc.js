// Лаба: вебінтерфейс бездротового контролера (у стилі Cisco WLC / AireOS GUI).
(function(){
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ipRe=/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
function newState(){ return {tab:"WLANS",page:"list",sel:null,msg:"",
  ifaces:[{name:"management",vlan:0,ip:"10.0.0.10",mask:"255.255.255.0",gw:"10.0.0.1",dhcp:"10.0.0.1"},{name:"virtual",vlan:0,ip:"192.0.2.1",mask:"",gw:"",dhcp:""}],
  radius:[], wlans:[{id:1,profile:"STAFF-OLD",ssid:"Staff",enabled:true,iface:"management",l2:"None",cipher:"",akm:"",psk:"",aaa:""}]}; }
const TASKS=[
 ["iface","CONTROLLER → Interfaces → New: динамічний інтерфейс guest, VLAN 30, IP 192.168.30.2/24, шлюз 192.168.30.1, Primary DHCP 192.168.30.1."],
 ["radius","SECURITY → AAA → RADIUS → Authentication → New: сервер 10.0.0.50, порт 1812, shared secret, статус Enabled."],
 ["guest","WLANs → New: ID 2, профіль GUEST, SSID Guest-WiFi, інтерфейс guest, WPA2 + AES, Auth Key Mgmt PSK (пароль ≥ 8 символів), статус Enabled."],
 ["corp","WLANs → New: ID 3, профіль CORP, SSID Corp, інтерфейс management, WPA2 + AES, 802.1X через RADIUS 10.0.0.50, статус Enabled."],
 ["open","WLAN 1 (Staff) працює без шифрування (Security: None). Вимкніть її."]];
function done(st){ const g=st.wlans.find(w=>w.id===2), c=st.wlans.find(w=>w.id===3), w1=st.wlans.find(w=>w.id===1), i=st.ifaces.find(x=>x.name==="guest"), r=st.radius.find(x=>x.ip==="10.0.0.50");
  return {iface:!!i&&i.vlan===30&&i.ip==="192.168.30.2"&&i.mask==="255.255.255.0"&&i.gw==="192.168.30.1"&&i.dhcp==="192.168.30.1",
    radius:!!r&&r.port===1812&&!!r.secret&&r.enabled,
    guest:!!g&&g.profile==="GUEST"&&g.ssid==="Guest-WiFi"&&g.iface==="guest"&&g.l2==="WPA2"&&g.cipher==="AES"&&g.akm==="PSK"&&g.psk.length>=8&&g.enabled,
    corp:!!c&&c.profile==="CORP"&&c.ssid==="Corp"&&c.iface==="management"&&c.l2==="WPA2"&&c.cipher==="AES"&&c.akm==="802.1X"&&c.aaa==="10.0.0.50"&&c.enabled,
    open:!w1||!w1.enabled}; }
const sel=(id,opts,v)=>`<select id="${id}">${opts.map(o=>{ const [val,l]=Array.isArray(o)?o:[o,o]; return `<option value="${esc(val)}" ${String(v)===String(val)?"selected":""}>${esc(l)}</option>`; }).join("")}</select>`;
const inp=(id,v,ph,type)=>`<input id="${id}" value="${esc(v||"")}" placeholder="${esc(ph||"")}" ${type?`type="${type}"`:""} autocomplete="off" autocapitalize="off" spellcheck="false">`;
const row=(l,c)=>`<tr><td class="wl">${esc(l)}</td><td>${c}</td></tr>`;
function render(st){
  const d=done(st); const nd=Object.values(d).filter(Boolean).length;
  const tabs=["MONITOR","WLANS","CONTROLLER","SECURITY"].map(t=>`<button class="wtab ${st.tab===t?"on":""}" data-act="wlc" data-op="tab" data-v="${t}">${t==="WLANS"?"WLANs":t}</button>`).join("");
  let body="";
  if(st.tab==="MONITOR") body=`<h3>Summary</h3><table class="wt">${row("Controller","WLC-3504 · AireOS 8.10")}${row("Access Points","4 joined")}${row("Clients",String(17))}${row("WLANs",st.wlans.map(w=>w.id+" "+w.ssid+(w.enabled?"":" (disabled)")).join(", "))}</table>`;
  if(st.tab==="WLANS"){
    if(st.page==="list") body=`<div class="row"><h3 class="grow">WLANs</h3><button class="mini" data-act="wlc" data-op="newwlan">Create New → Go</button></div><table class="wt"><tr><th>ID</th><th>Profile</th><th>SSID</th><th>Status</th><th>Security</th><th></th></tr>${st.wlans.sort((a,b)=>a.id-b.id).map(w=>`<tr><td>${w.id}</td><td><a href="#" data-act="wlc" data-op="editwlan" data-v="${w.id}">${esc(w.profile)}</a></td><td>${esc(w.ssid)}</td><td>${w.enabled?"Enabled":"Disabled"}</td><td>${w.l2==="None"?"<b style='color:var(--bad)'>None</b>":esc(w.l2+" ["+w.akm+"]")}</td><td><button class="mini ghost" data-act="wlc" data-op="delwlan" data-v="${w.id}">Remove</button></td></tr>`).join("")}</table>`;
    else { const w=st.sel||{}; const nw=st.page==="new";
      body=`<h3>WLANs › ${nw?"New":"Edit '"+esc(w.profile)+"'"}</h3><table class="wt">${row("WLAN ID",nw?sel("w_id",[2,3,4,5,6,7,8],w.id||2):String(w.id))}${row("Profile Name",inp("w_prof",w.profile))}${row("SSID",inp("w_ssid",w.ssid))}${row("Status",`<label><input type="checkbox" id="w_en" ${w.enabled?"checked":""}> Enabled</label>`)}
        ${row("Interface",sel("w_if",st.ifaces.filter(i=>i.name!=="virtual").map(i=>i.name),w.iface||"management"))}</table>
        <h3>Security › Layer 2</h3><table class="wt">${row("Layer 2 Security",sel("w_l2",["None","WPA2","WPA3"],w.l2||"None"))}${row("Encryption",sel("w_ci",[["","—"],"AES","TKIP"],w.cipher||""))}${row("Auth Key Mgmt",sel("w_akm",[["","—"],"PSK","802.1X","SAE"],w.akm||""))}${row("PSK Format: ASCII",inp("w_psk",w.psk,"ключ ≥ 8 символів","password"))}</table>
        <h3>Security › AAA Servers</h3><table class="wt">${row("Authentication Server 1",sel("w_aaa",[["","None"]].concat(st.radius.map(r=>[r.ip,"IP:"+r.ip+", Port:"+r.port])),w.aaa||""))}</table>
        <div class="row"><button class="primary" data-act="wlc" data-op="savewlan">Apply</button><button data-act="wlc" data-op="list">&lt; Back</button></div>`; } }
  if(st.tab==="CONTROLLER"){
    if(st.page!=="newif") body=`<div class="row"><h3 class="grow">Interfaces</h3><button class="mini" data-act="wlc" data-op="newif">New...</button></div><table class="wt"><tr><th>Interface Name</th><th>VLAN</th><th>IP Address</th><th>Type</th></tr>${st.ifaces.map(i=>`<tr><td>${esc(i.name)}</td><td>${i.vlan||"untagged"}</td><td>${esc(i.ip)}</td><td>${["management","virtual"].includes(i.name)?"Static":"Dynamic"}</td></tr>`).join("")}</table>`;
    else body=`<h3>Interfaces › New</h3><table class="wt">${row("Interface Name",inp("i_name","","guest"))}${row("VLAN Id",inp("i_vlan","","30"))}${row("IP Address",inp("i_ip"))}${row("Netmask",inp("i_mask"))}${row("Gateway",inp("i_gw"))}${row("Primary DHCP Server",inp("i_dhcp"))}</table><div class="row"><button class="primary" data-act="wlc" data-op="saveif">Apply</button><button data-act="wlc" data-op="list">&lt; Back</button></div>`; }
  if(st.tab==="SECURITY"){
    if(st.page!=="newrad") body=`<div class="row"><h3 class="grow">RADIUS Authentication Servers</h3><button class="mini" data-act="wlc" data-op="newrad">New...</button></div><table class="wt"><tr><th>Server</th><th>Address</th><th>Port</th><th>Admin Status</th></tr>${st.radius.map((r,k)=>`<tr><td>${k+1}</td><td>${esc(r.ip)}</td><td>${r.port}</td><td>${r.enabled?"Enabled":"Disabled"}</td></tr>`).join("")||`<tr><td colspan="4" class="small muted">немає серверів</td></tr>`}</table>`;
    else body=`<h3>RADIUS Authentication Servers › New</h3><table class="wt">${row("Server IP Address",inp("r_ip"))}${row("Shared Secret",inp("r_sec","","","password"))}${row("Port Number",inp("r_port","1812"))}${row("Server Status",sel("r_en",["Enabled","Disabled"],"Enabled"))}</table><div class="row"><button class="primary" data-act="wlc" data-op="saverad">Apply</button><button data-act="wlc" data-op="list">&lt; Back</button></div>`; }
  return `<div class="card"><h2>📶 Бездротовий контролер (GUI)</h2><p class="small muted" style="margin:0 0 6px">На CCNA налаштування WLAN перевіряють через вебінтерфейс контролера. Виконано ${nd}/${TASKS.length}.</p><ol class="checklist" style="padding-left:20px">${TASKS.map(([k,t])=>`<li>${d[k]?"✅":"⬜"} ${esc(t)}</li>`).join("")}</ol></div>
  <div class="wlc"><div class="wbar"><b>WLC · навчальний</b><span class="grow"></span>${tabs}</div><div class="wbody">${st.msg?`<div class="wmsg">${esc(st.msg)}</div>`:""}${body}</div></div>
  <div class="row" style="margin-top:8px"><button class="ghost" data-act="wlc" data-op="reset">Почати заново</button><button class="ghost" data-act="labs">← До списку лаб</button></div>`;
}
function handle(st,op,el,$){ st.msg="";
  const v=id=>{ const e=$("#"+id); return e? (e.type==="checkbox"?e.checked:e.value.trim()) : ""; };
  if(op==="tab"){ st.tab=el.dataset.v; st.page="list"; return; }
  if(op==="list"){ st.page="list"; return; }
  if(op==="newwlan"){ st.page="new"; st.sel={id:2,enabled:false,l2:"WPA2",cipher:"AES",akm:"PSK",psk:"",aaa:"",iface:"management"}; return; }
  if(op==="editwlan"){ st.page="edit"; st.sel=Object.assign({},st.wlans.find(w=>w.id===Number(el.dataset.v))); return; }
  if(op==="delwlan"){ st.wlans=st.wlans.filter(w=>w.id!==Number(el.dataset.v)); return; }
  if(op==="savewlan"){ const w={id:st.page==="new"?Number(v("w_id")):st.sel.id,profile:v("w_prof"),ssid:v("w_ssid"),enabled:v("w_en"),iface:v("w_if"),l2:v("w_l2"),cipher:v("w_ci"),akm:v("w_akm"),psk:v("w_psk"),aaa:v("w_aaa")};
    if(!w.profile||!w.ssid){ st.msg="Profile Name і SSID обов'язкові"; st.sel=w; return; }
    if(st.page==="new"&&st.wlans.some(x=>x.id===w.id)){ st.msg="WLAN ID "+w.id+" уже використовується"; st.sel=w; return; }
    if(w.l2!=="None"&&!w.cipher){ st.msg="Оберіть шифрування (AES) для "+w.l2; st.sel=w; return; }
    if(w.l2==="None"){ w.cipher=""; w.akm=""; }
    if(w.akm==="PSK"&&w.psk.length<8){ st.msg="PSK має містити щонайменше 8 символів"; st.sel=w; return; }
    if(w.akm==="802.1X"&&!w.aaa){ st.msg="Для 802.1X потрібен RADIUS-сервер (SECURITY → AAA → RADIUS)"; st.sel=w; return; }
    if(w.l2==="WPA2"&&w.akm==="SAE"){ st.msg="SAE використовується з WPA3"; st.sel=w; return; }
    st.wlans=st.wlans.filter(x=>x.id!==w.id).concat([w]); st.page="list"; st.msg="Зміни застосовано (Apply)"; return; }
  if(op==="newif"){ st.page="newif"; return; }
  if(op==="saveif"){ const i={name:v("i_name"),vlan:Number(v("i_vlan")),ip:v("i_ip"),mask:v("i_mask"),gw:v("i_gw"),dhcp:v("i_dhcp")};
    if(!/^[\w-]{1,30}$/.test(i.name)){ st.msg="Некоректне ім'я інтерфейсу"; return; } if(!(i.vlan>=1&&i.vlan<=4094)){ st.msg="VLAN Id: 1–4094"; return; }
    if(![i.ip,i.mask,i.gw].every(x=>ipRe.test(x))||(i.dhcp&&!ipRe.test(i.dhcp))){ st.msg="Перевірте IP-адресу, маску, шлюз і DHCP"; return; }
    st.ifaces=st.ifaces.filter(x=>x.name!==i.name).concat([i]); st.page="list"; st.msg="Інтерфейс створено"; return; }
  if(op==="newrad"){ st.page="newrad"; return; }
  if(op==="saverad"){ const r={ip:v("r_ip"),secret:v("r_sec"),port:Number(v("r_port")),enabled:v("r_en")==="Enabled"}; if(!ipRe.test(r.ip)||!r.secret||!r.port){ st.msg="Потрібні IP, shared secret і порт"; return; }
    st.radius=st.radius.filter(x=>x.ip!==r.ip).concat([r]); st.page="list"; st.msg="RADIUS-сервер додано"; return; }
}
window.WLC={newState,render,handle,done,TASKS};
})();
