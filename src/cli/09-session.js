// ---------- Сесія терміналу ----------
function promptOf(ctx,s){ if(ctx.mode==="rtr6") return s.hostname+"(config-rtr)#"; if(ctx.mode==="tacsrv") return s.hostname+"(config-server-tacacs)#"; if(ctx.mode==="radsrv") return s.hostname+"(config-radius-server)#"; if(ctx.mode==="raguard") return s.hostname+"(config-ra-guard)#"; if(ctx.mode==="cmap") return s.hostname+"(config-cmap)#"; if(ctx.mode==="pmap") return s.hostname+"(config-pmap)#"; if(ctx.mode==="pmapc") return s.hostname+"(config-pmap-c)#"; const h=s.hostname; return {user:h+">",exec:h+"#",config:h+"(config)#",if:h+(ctx.ifs&&ctx.ifs.length>1?"(config-if-range)#":"(config-if)#"),vlan:h+"(config-vlan)#",line:h+"(config-line)#",router:h+"(config-router)#",acl:h+(ctx.aclType==="ext"?"(config-ext-nacl)#":"(config-std-nacl)#"),dhcp:h+"(dhcp-config)#",dhcp6:h+"(config-dhcpv6)#"}[ctx.mode]; }
function Session(state){
  const ctx={mode:"user",ifs:null,vlan:null,line:null,history:[],prompt:null};
  ctx.runIn=(mode,line)=>{ const pm=pipeOf(line); if(pm){ const o=ctx.runIn(mode,pm[0]); return /^\s*% /.test(o)||/\^\n%/.test(o)? o : pipeFilter(o,pm[1],pm[2]); } const r=matchMode(mode,line); if(r.err) return r.err; if(r.empty) return ""; const save=ctx.mode; const out=r.hit.c.fn(state,r.hit.args,ctx); ctx.mode=save; return out||""; };
  const api={
    state, ctx,
    prompt(){ return ctx.prompt? ctx.prompt.text : promptOf(ctx,state); },
    exec(line){
      if(ctx.prompt){ const p=ctx.prompt; ctx.prompt=null; return p.fn(line.trim())||""; }
      if(!line.trim()) return "";
      ctx.history.push(line.trim());
      if(/\?\s*$/.test(line)){ return help(ctx.mode,line); }
      { const pm=pipeOf(line); if(pm){ ctx.history.pop(); const o=api.exec(pm[0]); return /^\s*% /.test(o)||/\^\n%/.test(o)? o : pipeFilter(o,pm[1],pm[2]); } }
      ctxPromptLen=promptOf(ctx,state).length;
      let r=matchMode(ctx.mode,line);
      // глобальні команди доступні з підрежимів (як в IOS)
      if(r.err && ["if","vlan","line","router","acl","dhcp","dhcp6","rtr6","tacsrv","radsrv","raguard","cmap","pmap","pmapc"].includes(ctx.mode)){ const r2=matchMode("config",line); if(r2.hit){ if(r2.hit.c.p[0]!=="do") ctx.mode="config"; r=r2; } }
      if(r.err && ctx.mode==="exec" && /^\s*conf/i.test(line)===false){ /* лишаємо помилку */ }
      if(r.empty) return ""; if(r.err) return r.err;
      const out=r.hit.c.fn(state,r.hit.args,ctx);
      return out||"";
    }
  };
  return api;
}
function pipeOf(line){ const m=line.match(/^(.*?\S)\s*\|\s*(include|includ|inclu|incl|inc|in|i|exclude|exclud|exclu|excl|exc|ex|e|begin|begi|beg|be|b|section|sectio|secti|sect|sec|se|s|count|coun|cou|co)\s+(.+)$/i);
  if(!m||!/^\s*(do\s+)?(sh|sho|show|more)\b/i.test(m[1])) return null; return [m[1],m[2].toLowerCase(),m[3].trim()]; }
function pipeFilter(out,op,pat){ let re; try{ re=new RegExp(pat.replace(/^"|"$/g,""),"i"); }catch(e){ re=new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"); }
  const L=String(out).split("\n");
  if(op[0]==="i") return L.filter(l=>re.test(l)).join("\n");
  if(op[0]==="e") return L.filter(l=>!re.test(l)).join("\n");
  if(op[0]==="b"){ const k=L.findIndex(l=>re.test(l)); return k<0?"":L.slice(k).join("\n"); }
  if(op.startsWith("co")) return "Number of lines which match regexp = "+L.filter(l=>re.test(l)).length;
  const R=[]; for(let k=0;k<L.length;k++){ if(/^\S/.test(L[k])&&re.test(L[k])){ R.push(L[k]); while(k+1<L.length&&/^\s/.test(L[k+1])&&L[k+1].trim()){ k++; R.push(L[k]); } } else if(/^\s/.test(L[k])&&re.test(L[k])) R.push(L[k]); }
  return R.join("\n"); }

