// ================= IPv6 =================
const V6MAX=(1n<<128n)-1n;
function v6parse(s){ s=String(s||"").toLowerCase(); if(!/^[0-9a-f:]+$/.test(s)||s.indexOf(":")<0||(s.match(/::/g)||[]).length>1) return null;
  const dbl=s.includes("::"); const [h,t]=dbl?s.split("::"):[s,""]; const hp=h?h.split(":"):[], tp=t?t.split(":"):[];
  let parts; if(dbl){ const fill=8-hp.length-tp.length; if(fill<1) return null; parts=hp.concat(Array(fill).fill("0"),tp); } else parts=hp;
  if(parts.length!==8||parts.some(p=>!/^[0-9a-f]{1,4}$/.test(p))) return null; return parts.reduce((a,p)=>(a<<16n)|BigInt(parseInt(p,16)),0n); }
function v6fmt(n){ const g=[]; for(let i=7;i>=0;i--) g.push(Number((n>>BigInt(i*16))&0xffffn).toString(16).toUpperCase());
  let bs=-1,bl=0; for(let i=0;i<8;){ if(g[i]==="0"){ let j=i; while(j<8&&g[j]==="0") j++; if(j-i>bl&&j-i>=2){ bs=i; bl=j-i; } i=j; } else i++; }
  if(bs<0) return g.join(":"); return g.slice(0,bs).join(":")+"::"+g.slice(bs+bl).join(":"); }
const v6mask=len=>len===0?0n:(V6MAX ^ ((1n<<BigInt(128-len))-1n));
const v6net=(a,len)=>a & v6mask(len);
const v6same=(a,b,len)=>{ const x=v6parse(a), y=v6parse(b); return x!==null&&y!==null&&v6net(x,len)===v6net(y,len); };
const v6eq=(a,b)=>{ const x=v6parse(a), y=v6parse(b); return x!==null&&x===y; };
function v6pfx(t){ const m=String(t).match(/^([0-9a-fA-F:]+)\/(\d{1,3})$/); if(!m) return null; const a=v6parse(m[1]); const len=Number(m[2]); if(a===null||len>128) return null; return {a,len,addr:v6fmt(a)}; }
function hmac(key){ let h=5381; for(let i=0;i<key.length;i++) h=((h<<5)+h+key.charCodeAt(i))>>>0; const x=h.toString(16).padStart(8,"0"); return "00"+x.slice(0,2)+"."+x.slice(2,6)+"."+x.slice(6,8)+"0"+(key.length%10); }
function eui64(mac){ const h=mac.replace(/\./g,""); const b=[]; for(let i=0;i<12;i+=2) b.push(parseInt(h.slice(i,i+2),16)); b[0]^=0x02; const by=b.slice(0,3).concat([0xff,0xfe],b.slice(3)); return by.reduce((a,x)=>(a<<8n)|BigInt(x),0n); }
const ifMac=(s,i)=>hmac((s.mac||"")+"|"+i.name.split(".")[0]);
const v6ll=(s,i)=>v6fmt((0xfe80n<<112n)|eui64(ifMac(s,i)));
const v6on=i=>!!(i.v6on||(i.v6&&i.v6.length));
function v6list(s,i){ if(!i||!v6on(i)) return []; return [{addr:i.llStatic||v6ll(s,i),len:64,ll:true}].concat(i.v6||[]); }
add(C,"ipv6 unicast-routing",(s)=>{ if(!s.l3) return INV; s.v6routing=true; });
add(C,"no ipv6 unicast-routing",(s)=>{ s.v6routing=false; });
const v6route=(s,p,nh,ifc,ad)=>{ const P=v6pfx(p); if(!P) return "% Invalid IPv6 prefix"; if(nh&&v6parse(nh)===null) return INV; if(nh&&/^fe80/i.test(nh)&&!ifc) return "% Interface has to be specified for a link-local nexthop";
  s.routes6=(s.routes6||[]).filter(r=>!(r.pfx===v6fmt(v6net(P.a,P.len))&&r.len===P.len&&r.nh===(nh?v6fmt(v6parse(nh)):null)&&r.ifc===(ifc||null))); s.routes6.push({pfx:v6fmt(v6net(P.a,P.len)),len:P.len,nh:nh?v6fmt(v6parse(nh)):null,ifc:ifc||null,ad:ad||1}); };
add(C,"ipv6 route <w> <v6>",(s,a)=>v6route(s,a[0],a[1]));
add(C,"ipv6 route <w> <v6> <n>",(s,a)=>v6route(s,a[0],a[1],null,a[2]));
add(C,"ipv6 route <w> <if>",(s,a)=>{ if(!s.ifs[a[1]]) return INV; return v6route(s,a[0],null,a[1]); });
add(C,"ipv6 route <w> <if> <v6>",(s,a)=>{ if(!s.ifs[a[1]]) return INV; return v6route(s,a[0],a[2],a[1]); });
add(C,"no ipv6 route <w> <rest>",(s,a)=>{ const P=v6pfx(a[0]); if(!P) return INV; const net=v6fmt(v6net(P.a,P.len)); s.routes6=(s.routes6||[]).filter(r=>!(r.pfx===net&&r.len===P.len)); });
add("if","ipv6 address <w>",F((i,a,s)=>{ if(i.switchport&&!i.svi) return "% IPv6 addresses may not be configured on L2 links."; const P=v6pfx(a[0]); if(!P) return "% Invalid IPv6 address"; i.v6=(i.v6||[]).filter(x=>!v6same(x.addr,P.addr,P.len)); i.v6.push({addr:P.addr,len:P.len}); i.v6on=true; }));
add("if","ipv6 address <w> eui-64",F((i,a,s)=>{ if(i.switchport&&!i.svi) return INV; const P=v6pfx(a[0]); if(!P||P.len!==64) return "% Invalid IPv6 prefix"; const addr=v6fmt(v6net(P.a,64)|eui64(ifMac(s,i))); i.v6=(i.v6||[]).filter(x=>!v6same(x.addr,addr,64)); i.v6.push({addr,len:64,eui:true}); i.v6on=true; }));
add("if","ipv6 address <v6> link-local",F((i,a)=>{ i.llStatic=v6fmt(v6parse(a[0])); i.v6on=true; }));
add("if","ipv6 enable",F(i=>{ i.v6on=true; }));
add("if","no ipv6 address",F(i=>{ i.v6=[]; i.llStatic=null; }));
add("if","no ipv6 address <w>",F((i,a)=>{ const P=v6pfx(a[0]); if(!P) return INV; i.v6=(i.v6||[]).filter(x=>!v6eq(x.addr,P.addr)); }));
add("if","no ipv6 enable",F(i=>{ i.v6on=false; }));
for(const m of ["user","exec"]){
  add(m,"show ipv6 interface brief",(s)=>{ let o=""; for(const i of Object.values(s.ifs).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}))){ if(i.switchport&&!i.svi) continue; const [st,pr]=ifStatus(s,i); o+=longIf(i.name).padEnd(23)+"["+st.replace("administratively down","administratively down")+"/"+pr+"]\n"+(v6on(i)?v6list(s,i).map(x=>"    "+x.addr).join("\n"):"    unassigned")+"\n"; } return o.trimEnd(); });
  add(m,"show ipv6 route",(s)=>showRoute6(s,null)); add(m,"show ipv6 route static",(s)=>showRoute6(s,"S"));
  add(m,"ping <v6>",(s,a)=>s.net? s.net.ping6Cli(s,v6fmt(v6parse(a[0]))) : "Sending 5, 100-byte ICMP Echos to "+a[0]+", timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)");
  add(m,"ping ipv6 <v6>",(s,a)=>s.net? s.net.ping6Cli(s,v6fmt(v6parse(a[0]))) : "% No route");
  add(m,"show mac address-table",(s)=>s.net? s.net.macTable(s) : "          Mac Address Table\n-------------------------------------------\n\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\nTotal Mac Addresses for this criterion: 0");
  add(m,"show mac address-table dynamic",(s)=>s.net? s.net.macTable(s) : "");
}
add("exec","debug ip ospf adj",(s)=>{ s.dbgOspf=true; return "OSPF adjacency debugging is on"+(s.net? "\n"+s.net.ospfDebug(s) : ""); });
add("exec","undebug all",(s)=>{ s.dbgOspf=false; return "All possible debugging has been turned off"; });
add("exec","no debug all",(s)=>{ s.dbgOspf=false; return "All possible debugging has been turned off"; });
function activeStatics6(s){ return (s.routes6||[]).filter(r=>{ if(r.ifc){ const i=s.ifs[r.ifc]; return i&&ifStatus(s,i)[1]==="up"; } return Object.values(s.ifs).some(i=>ifStatus(s,i)[1]==="up"&&(i.v6||[]).some(x=>v6same(x.addr,r.nh,x.len))); }); }
function showRoute6(s,only){ const L=[]; const up=Object.values(s.ifs).filter(i=>ifStatus(s,i)[1]==="up"&&v6on(i));
  if(!only) for(const i of up) for(const x of i.v6||[]){ L.push("C   "+v6fmt(v6net(v6parse(x.addr),x.len))+"/"+x.len+" [0/0]\n     via "+longIf(i.name)+", directly connected"); L.push("L   "+x.addr+"/128 [0/0]\n     via "+longIf(i.name)+", receive"); }
  if(s.net&&(!only||only==="O")) for(const r of s.net.ospf6Routes(s.devName)) L.push((r.e2?"OE2 ":"O   ")+r.pfx+"/"+r.len+" [110/"+(r.e2?1:r.cost)+"]\n     via "+r.hops[0].nh+", "+longIf(r.hops[0].ifn));
  if(!only||only==="S") for(const r of activeStatics6(s)) L.push("S   "+r.pfx+"/"+r.len+" ["+r.ad+"/0]\n     via "+(r.nh?r.nh+(r.ifc?", "+longIf(r.ifc):""):longIf(r.ifc)+", directly connected"));
  if(!only) L.push("L   FF00::/8 [0/0]\n     via Null0, receive");
  return "IPv6 Routing Table - default - "+L.length+" entries\nCodes: C - Connected, L - Local, S - Static, U - Per-user Static route\n       B - BGP, R - RIP, O - OSPF Intra, OI - OSPF Inter, ND - ND Default\n\n"+L.join("\n"); }

const INV="% Invalid input detected at '^' marker.";
function parseRange(str){
  const out=[];
  for(const part of str.split(",")){
    const m=part.trim().match(/^([a-z-]+)\s*(\d+)\/(\d+)\s*(?:-\s*(?:[a-z-]+\s*\d+\/)?(\d+))?$/i); if(!m) return null;
    const n=normIf(m[1]+m[2]+"/"+m[3]); if(!n) return null; const pre=n.replace(/\d+$/,""); const a=Number(m[3]), b=m[4]?Number(m[4]):a;
    if(b<a) return null; for(let k=a;k<=b;k++) out.push(pre+k);
  }
  return out;
}

