// ---------- QoS (MQC): class-map, policy-map, service-policy; mls qos на комутаторах; DHCP option 43 ----------
const DSCPN={default:0,ef:46,af11:10,af12:12,af13:14,af21:18,af22:20,af23:22,af31:26,af32:28,af33:30,af41:34,af42:36,af43:38,cs0:0,cs1:8,cs2:16,cs3:24,cs4:32,cs5:40,cs6:48,cs7:56};
const dscpOk=w=>{ w=String(w).toLowerCase(); return w in DSCPN||(/^\d+$/.test(w)&&Number(w)<=63); };
const QS=s=>(s.qos=s.qos||{cmaps:{},pmaps:{}});
const newCmap=(s,n,any)=>{ const q=QS(s); if(!q.cmaps[n]) q.cmaps[n]={name:n,any:!!any,match:[],desc:null}; else if(any!=null) q.cmaps[n].any=any; return q.cmaps[n]; };
add(C,"class-map <w>",(s,a,ctx)=>{ if(/^match-(any|all)$/i.test(a[0])) return "% Incomplete command."; newCmap(s,a[0],null); ctx.mode="cmap"; ctx.cmap=a[0]; });
add(C,"class-map match-any <w>",(s,a,ctx)=>{ newCmap(s,a[0],true); ctx.mode="cmap"; ctx.cmap=a[0]; });
add(C,"class-map match-all <w>",(s,a,ctx)=>{ newCmap(s,a[0],false); ctx.mode="cmap"; ctx.cmap=a[0]; });
add(C,"no class-map <w>",(s,a)=>{ const q=QS(s); if(Object.values(q.pmaps).some(p=>p.classes.some(c=>c.name===a[0]))) return "% Class-map "+a[0]+" is being used"; delete q.cmaps[a[0]]; });
const CM="cmap"; add(CM,"exit",(s,a,ctx)=>{ctx.mode="config";}); add(CM,"end",(s,a,ctx)=>{ctx.mode="exec";}); add(CM,"do <rest>",(s,a,ctx)=>ctx.runIn("exec",a[0]));
const cmM=(ctx,s,m)=>{ const c=QS(s).cmaps[ctx.cmap]; if(!c.match.some(x=>x.t===m.t&&x.v===m.v)) c.match.push(m); };
add(CM,"match dscp <rest>",(s,a,ctx)=>{ const v=a[0].trim().toLowerCase().split(/\s+/); if(!v.every(dscpOk)) return INV; cmM(ctx,s,{t:"dscp",v:v.join(" ")}); });
add(CM,"match ip dscp <rest>",(s,a,ctx)=>{ const v=a[0].trim().toLowerCase().split(/\s+/); if(!v.every(dscpOk)) return INV; cmM(ctx,s,{t:"dscp",v:v.join(" ")}); });
add(CM,"match access-group name <w>",(s,a,ctx)=>{ cmM(ctx,s,{t:"acl",v:a[0]}); });
add(CM,"match access-group <n>",(s,a,ctx)=>{ cmM(ctx,s,{t:"acl",v:String(a[0])}); });
add(CM,"match protocol <w>",(s,a,ctx)=>{ cmM(ctx,s,{t:"protocol",v:a[0].toLowerCase()}); });
add(CM,"match cos <rest>",(s,a,ctx)=>{ cmM(ctx,s,{t:"cos",v:a[0].trim()}); });
add(CM,"match any",(s,a,ctx)=>{ cmM(ctx,s,{t:"any",v:""}); });
add(CM,"description <rest>",(s,a,ctx)=>{ QS(s).cmaps[ctx.cmap].desc=a[0]; });
add(CM,"no match <rest>",(s,a,ctx)=>{ const c=QS(s).cmaps[ctx.cmap]; const t=a[0].trim().toLowerCase(); c.match=c.match.filter(m=>!t.endsWith(m.v.toLowerCase())||!t.includes(m.t==="acl"?"access-group":m.t)); });
add(C,"policy-map <w>",(s,a,ctx)=>{ const q=QS(s); if(!q.pmaps[a[0]]) q.pmaps[a[0]]={name:a[0],classes:[]}; ctx.mode="pmap"; ctx.pmap=a[0]; });
add(C,"no policy-map <w>",(s,a)=>{ if(Object.values(s.ifs).some(i=>i.svcOut===a[0]||i.svcIn===a[0])) return "% Policy-map "+a[0]+" is being used"; delete QS(s).pmaps[a[0]]; });
const PM="pmap", PC2="pmapc";
for(const m of [PM,PC2]){ add(m,"end",(s,a,ctx)=>{ctx.mode="exec";}); add(m,"do <rest>",(s,a,ctx)=>ctx.runIn("exec",a[0]));
  add(m,"class <w>",(s,a,ctx)=>{ const q=QS(s); const n=a[0]; if(n!=="class-default"&&!q.cmaps[n]) return "% class-map "+n+" not configured"; const p=q.pmaps[ctx.pmap]; let c=p.classes.find(x=>x.name===n); if(!c){ c={name:n,prio:null,bw:null,set:null,fq:false,police:null}; p.classes.push(c); } ctx.mode=PC2; ctx.pclass=n; });
  add(m,"no class <w>",(s,a,ctx)=>{ const p=QS(s).pmaps[ctx.pmap]; p.classes=p.classes.filter(c=>c.name!==a[0]); ctx.mode=PM; }); }
add(PM,"exit",(s,a,ctx)=>{ctx.mode="config";}); add(PC2,"exit",(s,a,ctx)=>{ctx.mode=PM;});
add(PM,"description <rest>",()=>{});
const pcl=(s,ctx)=>QS(s).pmaps[ctx.pmap].classes.find(c=>c.name===ctx.pclass);
const pcSet=(fn)=>(s,a,ctx)=>{ const c=pcl(s,ctx); return fn(c,a,s,ctx); };
add(PC2,"priority percent <n>",pcSet((c,a)=>{ if(c.name==="class-default") return "% priority is not allowed in class-default"; if(a[0]<1||a[0]>100) return INV; if(c.bw) return "% bandwidth and priority are mutually exclusive in the same class"; c.prio={pct:a[0]}; }));
add(PC2,"priority <n>",pcSet((c,a)=>{ if(c.name==="class-default") return "% priority is not allowed in class-default"; if(c.bw) return "% bandwidth and priority are mutually exclusive in the same class"; c.prio={kbps:a[0]}; }));
add(PC2,"priority level <n>",pcSet((c)=>{ c.prio=c.prio||{kbps:null}; }));
add(PC2,"bandwidth percent <n>",pcSet((c,a)=>{ if(a[0]<1||a[0]>100) return INV; if(c.prio) return "% bandwidth and priority are mutually exclusive in the same class"; c.bw={pct:a[0]}; }));
add(PC2,"bandwidth remaining percent <n>",pcSet((c,a)=>{ if(c.prio) return "% bandwidth and priority are mutually exclusive in the same class"; c.bw={rem:a[0]}; }));
add(PC2,"bandwidth <n>",pcSet((c,a)=>{ if(c.prio) return "% bandwidth and priority are mutually exclusive in the same class"; c.bw={kbps:a[0]}; }));
add(PC2,"set dscp <w>",pcSet((c,a)=>{ if(!dscpOk(a[0])) return INV; c.set=a[0].toLowerCase(); }));
add(PC2,"set ip dscp <w>",pcSet((c,a)=>{ if(!dscpOk(a[0])) return INV; c.set=a[0].toLowerCase(); }));
add(PC2,"fair-queue",pcSet((c)=>{ c.fq=true; }));
add(PC2,"police <n>",pcSet((c,a)=>{ c.police=a[0]; }));
add(PC2,"police cir <n>",pcSet((c,a)=>{ c.police=a[0]; }));
add(PC2,"shape average <n>",pcSet((c,a)=>{ c.shape=a[0]; }));
add(PC2,"random-detect",pcSet((c)=>{ c.wred=true; }));
add(PC2,"random-detect dscp-based",pcSet((c)=>{ c.wred=true; }));
add(PC2,"no priority",pcSet((c)=>{ c.prio=null; })); add(PC2,"no bandwidth",pcSet((c)=>{ c.bw=null; }));
const pmSum=p=>p.classes.reduce((t,c)=>t+((c.prio&&c.prio.pct)||0)+((c.bw&&c.bw.pct)||0),0);
const attachPol=(dir)=>F((i,a,s)=>{ const p=QS(s).pmaps[a[0]]; if(!p) return "policy map "+a[0]+" not configured"; if(dir==="out"&&pmSum(p)>100) return "I/f "+(i.name||"")+" class "+p.classes[p.classes.length-1].name+" requested bandwidth "+pmSum(p)+"%, available only "+(100-(pmSum(p)-((p.classes[p.classes.length-1].bw||{}).pct||0)))+"%\n% Sum of bandwidth percents exceeds 100";
  if(dir==="in"&&p.classes.some(c=>c.prio||c.bw||c.fq)) return "%  CBWFQ : Not supported in input direction"; if(dir==="out") i.svcOut=a[0]; else i.svcIn=a[0]; });
add("if","service-policy output <w>",attachPol("out"));
add("if","service-policy input <w>",attachPol("in"));
add("if","no service-policy output <w>",F((i)=>{ i.svcOut=null; }));
add("if","no service-policy input <w>",F((i)=>{ i.svcIn=null; }));
add(C,"mls qos",(s)=>{ if(s.router) return INV; s.mlsQos=true; });
add(C,"no mls qos",(s)=>{ s.mlsQos=false; });
add("if","mls qos trust cos",F((i,a,s)=>{ if(s.router) return INV; i.qosTrust="cos"; }));
add("if","mls qos trust dscp",F((i,a,s)=>{ if(s.router) return INV; i.qosTrust="dscp"; }));
add("if","mls qos trust device cisco-phone",F((i,a,s)=>{ if(s.router) return INV; i.qosTrustDev="cisco-phone"; }));
add("if","no mls qos trust",F((i)=>{ i.qosTrust=null; }));
add("if","auto qos voip cisco-phone",F((i,a,s)=>{ if(s.router) return INV; s.mlsQos=true; i.qosTrust="cos"; i.qosTrustDev="cisco-phone"; i.autoQos=true; }));
add(DH,"option 43 hex <w>",(s,a,ctx)=>{ const h=a[0].replace(/\./g,"").toLowerCase(); if(!/^[0-9a-f]+$/.test(h)||h.length%2) return INV; s.dhcp.pools[ctx.pool].opt43=h; });
add(DH,"option 43 ip <ip>",(s,a,ctx)=>{ s.dhcp.pools[ctx.pool].opt43ip=a[0]; });
add(DH,"no option 43",(s,a,ctx)=>{ const p=s.dhcp.pools[ctx.pool]; p.opt43=null; p.opt43ip=null; });
function qosRunGlobal(s){ const L=[]; const q=s.qos; if(s.mlsQos) L.push("mls qos"); if(!q) return L;
  for(const c of Object.values(q.cmaps)){ L.push("class-map "+(c.any?"match-any ":"match-all ")+c.name); if(c.desc) L.push(" description "+c.desc); for(const m of c.match) L.push(" match "+(m.t==="acl"?"access-group "+(/^\d+$/.test(m.v)?"":"name ")+m.v:m.t==="dscp"?"dscp "+m.v:m.t==="any"?"any":m.t+" "+m.v)); L.push("!"); }
  for(const p of Object.values(q.pmaps)){ L.push("policy-map "+p.name); for(const c of p.classes){ L.push(" class "+c.name); if(c.prio) L.push(c.prio.pct?"  priority percent "+c.prio.pct:"  priority "+(c.prio.kbps||"")); if(c.bw) L.push(c.bw.pct?"  bandwidth percent "+c.bw.pct:c.bw.rem?"  bandwidth remaining percent "+c.bw.rem:"  bandwidth "+c.bw.kbps); if(c.set) L.push("  set dscp "+c.set); if(c.fq) L.push("  fair-queue"); if(c.police) L.push("  police "+c.police); if(c.shape) L.push("  shape average "+c.shape); if(c.wred) L.push("  random-detect dscp-based"); } L.push("!"); }
  return L; }
function qosRunIf(i){ const L=[]; if(i.autoQos) L.push(" auto qos voip cisco-phone"); if(i.qosTrust) L.push(" mls qos trust "+i.qosTrust); if(i.qosTrustDev) L.push(" mls qos trust device "+i.qosTrustDev); if(i.svcIn) L.push(" service-policy input "+i.svcIn); if(i.svcOut) L.push(" service-policy output "+i.svcOut); return L; }
const cmDesc=c=>c.match.length? c.match.map(m=>"    Match "+(m.t==="acl"?"access-group name "+m.v:m.t==="dscp"?"dscp "+m.v.split(" ").map(x=>x+(DSCPN[x]!=null&&!/^\d+$/.test(x)?" ("+DSCPN[x]+")":"")).join(" "):m.t==="any"?"any":m.t+" "+m.v)).join("\n") : "    Match none";
function showClassMap(s){ const q=QS(s); let o=" Class Map match-any class-default (id 0)\n   Match any\n"; for(const c of Object.values(q.cmaps)) o+="\n Class Map "+(c.any?"match-any":"match-all")+" "+c.name+"\n"+(c.desc?"   Description: "+c.desc+"\n":"")+cmDesc(c).replace(/^ {4}/gm,"   ")+"\n"; return o; }
function pmLines(p,ind){ const I=" ".repeat(ind); return p.classes.map(c=>I+"Class "+c.name+"\n"+(c.prio?I+"  priority "+(c.prio.pct?c.prio.pct+"% (strict priority, LLQ)":(c.prio.kbps||"")+" kbps")+"\n":"")+(c.bw?I+"  bandwidth "+(c.bw.pct?c.bw.pct+"% (CBWFQ)":c.bw.rem?"remaining "+c.bw.rem+"%":c.bw.kbps+" kbps")+"\n":"")+(c.set?I+"  set dscp "+c.set+"\n":"")+(c.fq?I+"  fair-queue\n":"")+(c.police?I+"  police cir "+c.police+" bps\n":"")+(c.shape?I+"  shape average "+c.shape+"\n":"")+(c.wred?I+"  random-detect dscp-based\n":"")).join(""); }
function showPolicyMap(s,name){ const q=QS(s); const ps=Object.values(q.pmaps).filter(p=>!name||p.name===name); if(name&&!ps.length) return "policy-map "+name+" not found"; return ps.map(p=>"  Policy Map "+p.name+"\n"+pmLines(p,4)).join("\n"); }
function showPolicyIf(s,ifn){ const n=normIf(ifn); const i=n&&s.ifs[n]; if(!i) return INV; const out=[]; for(const [dir,pn] of [["input",i.svcIn],["output",i.svcOut]]){ if(!pn) continue; const p=QS(s).pmaps[pn]; if(!p) continue;
    out.push(" "+longIf(n)+"\n\n  Service-policy "+dir+": "+pn+"\n");
    const cls=p.classes.concat(p.classes.some(c=>c.name==="class-default")?[]:[{name:"class-default"}]);
    for(const c of cls){ const cm=c.name==="class-default"?null:QS(s).cmaps[c.name]; out.push("    Class-map: "+c.name+" ("+(cm&&!cm.any?"match-all":"match-any")+")\n      0 packets, 0 bytes\n      5 minute offered rate 0000 bps, drop rate 0000 bps\n"+(cm?cmDesc(cm).replace(/^/gm,"  ")+"\n":"      Match: any\n")+(c.prio?"      Priority: "+(c.prio.pct?c.prio.pct+"% ("+Math.round(c.prio.pct*10000)+" kbps)":(c.prio.kbps||"")+" kbps")+", burst bytes 25000, b/w exceed drops: 0\n":"")+(c.bw?"      Queueing\n      queue limit 64 packets\n      bandwidth "+(c.bw.pct?c.bw.pct+"% ("+c.bw.pct*10000+" kbps)":c.bw.rem?"remaining "+c.bw.rem+"%":c.bw.kbps+" kbps")+"\n":"")+(c.set?"      QoS Set\n        dscp "+c.set+"\n":"")+(c.fq?"      Queueing\n      Flow Based Fair Queueing\n":"")); } }
  return out.length? out.join("\n") : ""; }
for(const m of ["user","exec"]) for(const [p,f] of [
["show class-map",(s)=>showClassMap(s)],["show policy-map",(s)=>showPolicyMap(s)],["show policy-map <w>",(s,a)=>showPolicyMap(s,a[0])],["show policy-map interface <if>",(s,a)=>showPolicyIf(s,a[0])],
 ["show mls qos",(s)=>"QoS is "+(s.mlsQos?"enabled":"disabled")+"\nQoS ip packet dscp rewrite is enabled"],
 ["show mls qos interface <if>",(s,a)=>{ const n=normIf(a[0]); const i=n&&s.ifs[n]; if(!i) return INV; return longIf(n)+"\ntrust state: "+(s.mlsQos&&i.qosTrust?(i.qosTrustDev&&!(i.phoneSeen)?"not trusted":"trust "+i.qosTrust):"not trusted")+"\ntrust mode: "+(i.qosTrust?"trust "+i.qosTrust:"not trusted")+"\ntrust enabled flag: ena\nCOS override: dis\ndefault COS: 0\nDSCP Mutation Map: Default DSCP Mutation Map\nTrust device: "+(i.qosTrustDev||"none")+"\nqos mode: port-based"+(s.mlsQos?"":"\n! Підказка тренажера: глобально QoS вимкнено — без «mls qos» налаштування trust не діють"); }]
]) add(m,p,f);
function showRouteIp(s,ip){ if(!s.net||!s.ipRouting) return "% Network not in table"; const r=s.net.lookup(s.devName,ip); if(!r||r.len===0) return "% Network not in table"+(r&&r.len===0?"\n! Підказка тренажера: точного маршруту немає — пакет піде маршрутом за замовчуванням через "+(r.nh||longIf(r.ifn||"")):"");
  const src=r.ospf?{k:"ospf "+(s.ospf?s.ospf.pid:1),ad:110,m:(s.net.ospfRoutes(s.devName).find(x=>x.net+"/"+maskLen(x.mask)===r.pfx)||{}).cost||0}:r.conn?{k:"connected",ad:0,m:0}:{k:"static",ad:r.ad,m:0};
  return "Routing entry for "+r.pfx+"\n  Known via \""+src.k+"\", distance "+src.ad+", metric "+src.m+(r.conn?" (connected, via interface)":"")+"\n  Routing Descriptor Blocks:\n  * "+(r.conn?"directly connected, via "+longIf(r.ifn):r.nh+(r.ifn?", via "+longIf(r.ifn):""))+"\n      Route metric is "+src.m+", traffic share count is 1"; }
for(const m of ["user","exec"]) add(m,"show ip route <ip>",(s,a)=>showRouteIp(s,a[0]));
// ---------- Харденінг за CIS: source-route, proxy-arp, redirects/unreachables, keepalives, bootp, ssh timers ----------
const CIS=s=>(s.cis=s.cis||{});
add(C,"no ip source-route",s=>{ CIS(s).noSrcRoute=true; }); add(C,"ip source-route",s=>{ CIS(s).noSrcRoute=false; });
add(C,"service tcp-keepalives-in",s=>{ CIS(s).keepIn=true; }); add(C,"no service tcp-keepalives-in",s=>{ CIS(s).keepIn=false; });
add(C,"service tcp-keepalives-out",s=>{ CIS(s).keepOut=true; }); add(C,"no service tcp-keepalives-out",s=>{ CIS(s).keepOut=false; });
add(C,"no ip bootp server",s=>{ CIS(s).noBootp=true; }); add(C,"ip bootp server",s=>{ CIS(s).noBootp=false; });
add(C,"no service pad",()=>{}); add(C,"no ip finger",()=>{}); add(C,"no service dhcp",s=>{ CIS(s).noDhcpSvc=true; }); add(C,"service dhcp",s=>{ CIS(s).noDhcpSvc=false; });
add(C,"ip ssh time-out <n>",(s,a)=>{ if(a[0]<1||a[0]>120) return INV; CIS(s).sshTimeout=a[0]; });
add(C,"ip ssh authentication-retries <n>",(s,a)=>{ if(a[0]<0||a[0]>5) return INV; CIS(s).sshRetries=a[0]; });
add("if","no ip proxy-arp",F(i=>{ i.noProxyArp=true; })); add("if","ip proxy-arp",F(i=>{ i.noProxyArp=false; }));
add("if","no ip redirects",F(i=>{ i.noRedirects=true; })); add("if","ip redirects",F(i=>{ i.noRedirects=false; }));
add("if","no ip unreachables",F(i=>{ i.noUnreach=true; })); add("if","ip unreachables",F(i=>{ i.noUnreach=false; }));
function cisRunGlobal(s){ const c=s.cis||{}; const L=[]; if(c.noSrcRoute) L.push("no ip source-route"); if(c.keepIn) L.push("service tcp-keepalives-in"); if(c.keepOut) L.push("service tcp-keepalives-out"); if(c.noBootp) L.push("no ip bootp server"); if(c.noDhcpSvc) L.push("no service dhcp"); if(c.sshTimeout) L.push("ip ssh time-out "+c.sshTimeout); if(c.sshRetries!=null) L.push("ip ssh authentication-retries "+c.sshRetries); return L; }
function cisRunIf(i){ const L=[]; if(i.noRedirects) L.push(" no ip redirects"); if(i.noUnreach) L.push(" no ip unreachables"); if(i.noProxyArp) L.push(" no ip proxy-arp"); return L; }
