// Мінісимулятор Cisco IOS (Catalyst 2960 / L3-комутатор) для навчальних сценаріїв.
// Файл зібрано з src/cli/*.js скриптом scripts/build-cli.mjs — редагуйте фрагменти, а не public/cli.js.
(function(){
"use strict";
const IFTYPES=[["fastethernet","Fa","FastEthernet"],["gigabitethernet","Gi","GigabitEthernet"],["port-channel","Po","Port-channel"],["vlan","Vlan","Vlan"],["loopback","Lo","Loopback"],["tunnel","Tu","Tunnel"]];
function normIf(s){
  const m=String(s).trim().match(/^([a-z-]+)\s*(\d+(?:\/\d+)*(?:\.\d+)?)$/i); if(!m) return null;
  const t=m[1].toLowerCase(); const hit=IFTYPES.filter(([full])=>full.startsWith(t));
  if(hit.length!==1) return null; return hit[0][1]+m[2];
}
function longIf(n){ const t=IFTYPES.find(x=>n.startsWith(x[1])); return t? t[2]+n.slice(t[1].length): n; }
function parseList(s){ // "10,20,30-32" → [10,20,30,31,32]
  if(!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(s)) return null; const out=[];
  for(const part of s.split(",")){ const [a,b]=part.split("-").map(Number); if(b!==undefined){ if(b<a||b-a>4094) return null; for(let i=a;i<=b;i++) out.push(i);} else out.push(a); }
  if(out.some(v=>v<1||v>4094)) return null; return [...new Set(out)].sort((x,y)=>x-y);
}
function fmtList(arr){ if(!arr.length) return "none"; const a=arr.slice().sort((x,y)=>x-y); const out=[]; let s=a[0],p=a[0];
  for(let i=1;i<=a.length;i++){ if(a[i]===p+1){p=a[i];continue;} out.push(s===p?String(s):(p===s+1?s+","+p:s+"-"+p)); s=p=a[i]; } return out.join(","); }
const ipRe=/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const ipToN=s=>s.split(".").reduce((a,o)=>(a*256)+Number(o),0);
const maskOk=s=>{ if(!ipRe.test(s)) return false; const n=ipToN(s); const inv=(~n)>>>0; return ((inv+1)&inv)===0 && n!==0; };
const maskLen=s=>{let n=ipToN(s),c=0;while(n){c+=n&1;n=Math.floor(n/2);}return c;};

function newIf(name){ return {name,shutdown:false,mode:"dynamic auto",accessVlan:1,voiceVlan:null,nativeVlan:1,allowed:null,nonegotiate:false,portfast:false,bpduguard:false,chGroup:null,chMode:null,switchport:true,ip:null,mask:null,desc:null,speed:"auto",duplex:"auto",ospfCost:null,ospfPrio:1,hello:10,dead:40,deadSet:false,ospfArea:null,ospfPid:null,ospfP2p:false,aclIn:null,aclOut:null,natIn:false,natOut:false,helper:[],bw:null,loop:false}; }
function newState(opt){
  opt=opt||{};
  const s={hostname:opt.hostname||"S1",l3:!!opt.l3||!!opt.router,router:!!opt.router,routes:[],vlans:opt.router?{}:{1:{name:"default"}},ifs:{},ipRouting:!!opt.router,defaultGw:null,domain:null,rsaBits:0,users:{},
    enableSecret:null,servicePwEnc:false,noDomainLookup:false,sshVer:null,vty:{transport:"all",login:null,password:null},con:{login:null,password:null},
    stpMode:"pvst",stpPrio:{},portfastDefault:false,bpduguardDefault:false,lb:"src-mac",mac:"0019.e8"+String(Math.floor(Math.random()*90)+10)+".1a00",saved:false,ospf:null,acls:{},nat:{statics:[],pools:{},dyn:[],table:[],hits:0,miss:0,ports:1024},dhcp:{pools:{},excl:[],bind:{}}};
  if(opt.router){ for(let i=0;i<=2;i++) s.ifs["Gi0/"+i]=Object.assign(newIf("Gi0/"+i),{switchport:false,shutdown:true}); }
  else{
  for(let i=1;i<=24;i++) s.ifs["Fa0/"+i]=newIf("Fa0/"+i);
  for(let i=1;i<=2;i++) s.ifs["Gi0/"+i]=newIf("Gi0/"+i);
  s.ifs["Vlan1"]=Object.assign(newIf("Vlan1"),{svi:true,shutdown:true});
  }
  if(opt.vlans) for(const [id,name] of Object.entries(opt.vlans)) s.vlans[id]={name};
  if(opt.setup) opt.setup(s);
  return s;
}
const isPhys=n=>/^(Fa|Gi)/.test(n);
function ensureIf(s,n){ if(s.ifs[n]) return s.ifs[n];
  if(n.startsWith("Po")){ s.ifs[n]=newIf(n); return s.ifs[n]; }
  if(s.l3 && /^Lo\d+$/.test(n)){ s.ifs[n]=Object.assign(newIf(n),{switchport:false,loop:true}); return s.ifs[n]; }
  if(s.router && /^Gi0\/\d+\.\d+$/.test(n) && s.ifs[n.split(".")[0]]){ s.ifs[n]=Object.assign(newIf(n),{switchport:false,sub:true,encap:null,native:false}); return s.ifs[n]; }
  if(s.l3 && /^Tu\d+$/.test(n)){ s.ifs[n]=Object.assign(newIf(n),{switchport:false,tunnel:true,shutdown:false}); return s.ifs[n]; }
  if(s.router) return null;
  if(n.startsWith("Vlan")){ const id=Number(n.slice(4)); if(!(id>=1&&id<=4094)) return null; s.ifs[n]=Object.assign(newIf(n),{svi:true}); return s.ifs[n]; }
  return null; }
function operTrunk(i){ if(!i.switchport) return false; if(i._oper) return i._oper==="trunk"; return i.mode==="trunk"; }
function allowedOf(i){ return i.allowed? i.allowed : null; } // null = all

