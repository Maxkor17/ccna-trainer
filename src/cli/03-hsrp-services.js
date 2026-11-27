// ================= HSRP і мережеві сервіси =================
const hsrpG=(i,g)=>{ i.hsrp=i.hsrp||{}; if(!i.hsrp[g]) i.hsrp[g]={ip:null,prio:100,preempt:false}; return i.hsrp[g]; };
add("if","standby <n> ip <ip>",F((i,a)=>{ if(i.switchport&&!i.svi) return INV; if(a[0]>4095) return INV; hsrpG(i,a[0]).ip=a[1]; }));
add("if","standby <n> priority <n>",F((i,a)=>{ if(a[1]>255) return INV; hsrpG(i,a[0]).prio=a[1]; }));
add("if","standby <n> preempt",F((i,a)=>{ hsrpG(i,a[0]).preempt=true; }));
add("if","no standby <n> preempt",F((i,a)=>{ hsrpG(i,a[0]).preempt=false; }));
add("if","no standby <n>",F((i,a)=>{ if(i.hsrp) delete i.hsrp[a[0]]; }));
add("if","standby version <n>",F((i,a)=>{ if(a[0]!==1&&a[0]!==2) return INV; i.hsrpV=a[0]; }));
for(const m of ["user","exec"]){
  add(m,"show standby brief",(s)=>{ let o="                     P indicates configured to preempt.\n                     |\nInterface   Grp  Pri P State   Active          Standby         Virtual IP\n";
    for(const i of Object.values(s.ifs)) for(const [g,h] of Object.entries(i.hsrp||{})){ const st=s.net? s.net.hsrpState(s.devName,i.name,Number(g)) : {state:"Init",active:"unknown",standby:"unknown"};
      o+=i.name.padEnd(12)+g.padEnd(5)+String(h.prio).padEnd(4)+(h.preempt?"P ":"  ")+st.state.padEnd(8)+st.active.padEnd(16)+st.standby.padEnd(16)+(h.ip||"unknown")+"\n"; } return o.trimEnd(); });
  add(m,"show standby",(s)=>{ let o=""; for(const i of Object.values(s.ifs)) for(const [g,h] of Object.entries(i.hsrp||{})){ const st=s.net? s.net.hsrpState(s.devName,i.name,Number(g)) : {state:"Init",active:"unknown",standby:"unknown"};
      o+=longIf(i.name)+" - Group "+g+(i.hsrpV===2?" (version 2)":"")+"\n  State is "+st.state+"\n  Virtual IP address is "+(h.ip||"unknown")+"\n  Active virtual MAC address is "+(i.hsrpV===2?"0000.0c9f.f"+Number(g).toString(16).padStart(3,"0"):"0000.0c07.ac"+Number(g).toString(16).padStart(2,"0"))+"\n  Hello time 3 sec, hold time 10 sec\n  Preemption "+(h.preempt?"enabled":"disabled")+"\n  Active router is "+st.active+"\n  Standby router is "+st.standby+"\n  Priority "+h.prio+" (default 100)\n"; } return o.trimEnd(); });
  add(m,"show ntp associations",(s)=>{ const v=s.svc&&s.svc.ntp||[]; if(!v.length) return "%NTP is not enabled."; return "  address         ref clock       st   when   poll reach  delay  offset   disp\n"+v.map(x=>"*~"+x.padEnd(15)+"127.127.1.1      3     12     64   377  1.204  -0.315   0.937").join("\n")+"\n * sys.peer, # selected, + candidate, - outlyer, x falseticker, ~ configured"; });
  add(m,"show ntp status",(s)=>{ const v=s.svc&&s.svc.ntp||[]; return v.length?"Clock is synchronized, stratum 4, reference is "+v[0]:"Clock is unsynchronized, stratum 16, no reference clock"; });
  add(m,"show snmp community",(s)=>((s.svc&&s.svc.snmp)||[]).map(c=>"Community name: "+c.name+"\nCommunity Index: "+c.name+"\nstorage-type: nonvolatile        active access-list: "+(c.acl||"")+"\n"+(c.rw?"read-write":"read-only")).join("\n\n"));
  add(m,"show lldp neighbors",(s)=>s.svc&&s.svc.lldp? (s.net? s.net.cdp(s).replace("Capability Codes: R - Router, S - Switch, H - Host","Capability codes:\n    (R) Router, (B) Bridge, (T) Telephone"):"") : "% LLDP is not enabled");
  add(m,"show clock",(s)=>"*"+new Date().toTimeString().slice(0,8)+".123 UTC "+new Date().toDateString());
}
const SV=s=>{ s.svc=s.svc||{ntp:[],hosts:[],trap:null,snmp:[],lldp:false,cdp:true,tsLog:false,buffered:null,location:null,contact:null}; return s.svc; };
add(C,"ntp server <ip>",(s,a)=>{ const v=SV(s); if(!v.ntp.includes(a[0])) v.ntp.push(a[0]); });
add(C,"no ntp server <ip>",(s,a)=>{ const v=SV(s); v.ntp=v.ntp.filter(x=>x!==a[0]); });
add(C,"logging host <ip>",(s,a)=>{ const v=SV(s); if(!v.hosts.includes(a[0])) v.hosts.push(a[0]); });
add(C,"logging <ip>",(s,a)=>{ const v=SV(s); if(!v.hosts.includes(a[0])) v.hosts.push(a[0]); });
add(C,"no logging host <ip>",(s,a)=>{ const v=SV(s); v.hosts=v.hosts.filter(x=>x!==a[0]); });
const LVL=["emergencies","alerts","critical","errors","warnings","notifications","informational","debugging"];
add(C,"logging trap <w>",(s,a)=>{ const w=a[0].toLowerCase(); const l=/^\d$/.test(w)?LVL[Number(w)]:LVL.find(x=>x.startsWith(w)); if(!l) return INV; SV(s).trap=l; });
add(C,"logging buffered <n>",(s,a)=>{ SV(s).buffered=a[0]; });
add(C,"service timestamps log datetime msec",(s)=>{ SV(s).tsLog=true; });
add(C,"service timestamps log datetime",(s)=>{ SV(s).tsLog=true; });
add(C,"snmp-server community <w> <w>",(s,a)=>{ const t=a[1].toLowerCase(); if(!["ro","rw"].includes(t)) return INV; const v=SV(s); v.snmp=v.snmp.filter(x=>x.name!==a[0]); v.snmp.push({name:a[0],rw:t==="rw"}); });
add(C,"snmp-server community <w> <w> <w>",(s,a)=>{ const t=a[1].toLowerCase(); if(!["ro","rw"].includes(t)) return INV; const v=SV(s); v.snmp=v.snmp.filter(x=>x.name!==a[0]); v.snmp.push({name:a[0],rw:t==="rw",acl:a[2]}); });
add(C,"no snmp-server community <w>",(s,a)=>{ const v=SV(s); v.snmp=v.snmp.filter(x=>x.name!==a[0]); });
add(C,"snmp-server location <rest>",(s,a)=>{ SV(s).location=a[0]; });
add(C,"snmp-server contact <rest>",(s,a)=>{ SV(s).contact=a[0]; });
add(C,"lldp run",(s)=>{ SV(s).lldp=true; });
add(C,"no lldp run",(s)=>{ SV(s).lldp=false; });
add(C,"cdp run",(s)=>{ SV(s).cdp=true; });
add(C,"no cdp run",(s)=>{ SV(s).cdp=false; });
add("if","no cdp enable",F(i=>{ i.cdpOff=true; }));
add("if","cdp enable",F(i=>{ i.cdpOff=false; }));
function svcRun(s){ const v=s.svc; if(!v) return []; const L=[];
  if(v.tsLog) L.push("service timestamps log datetime msec"); if(v.buffered) L.push("logging buffered "+v.buffered); if(v.trap) L.push("logging trap "+v.trap); for(const h of v.hosts) L.push("logging host "+h);
  for(const c of v.snmp) L.push("snmp-server community "+c.name+" "+(c.rw?"RW":"RO")+(c.acl?" "+c.acl:"")); if(v.location) L.push("snmp-server location "+v.location); if(v.contact) L.push("snmp-server contact "+v.contact);
  if(!v.cdp) L.push("no cdp run"); if(v.lldp) L.push("lldp run"); for(const n of v.ntp) L.push("ntp server "+n); return L; }

