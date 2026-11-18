// Емулятор Linux-терміналу для треку «Linux і DevOps»: файлова система, права, мережа, systemd, git.
(function(){
const ipRe=/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const ip2n=s=>s.split(".").reduce((a,o)=>a*256+Number(o),0)>>>0;
const inNet=(ip,net,len)=>{ const m=len===0?0:(0xFFFFFFFF<<(32-len))>>>0; return ((ip2n(ip)&m)>>>0)===((ip2n(net)&m)>>>0); };
function newState(){
  const f=(content,mode,owner)=>({t:"f",c:content,mode:mode||"644",owner:owner||"root"}); const d=(mode,owner)=>({t:"d",mode:mode||"755",owner:owner||"root"});
  return {cwd:"/home/maksym",user:"maksym",host:"srv01",hist:[],
    fs:{"/":d(),"/etc":d(),"/etc/hosts":f("127.0.0.1 localhost\n192.168.1.10 srv01\n192.168.1.20 db01\n"),"/etc/resolv.conf":f("nameserver 127.0.0.53\n"),"/etc/nginx":d(),"/etc/nginx/nginx.conf":f("events {}\nhttp {\n  server {\n    listen 8080;\n    root /var/www/html;\n  }\n}\n"),
      "/var":d(),"/var/log":d(),"/var/log/syslog":f("Nov 18 09:12:01 srv01 systemd[1]: Started Daily apt download activities.\nNov 18 09:14:22 srv01 sshd[1182]: Failed password for invalid user admin from 203.0.113.50 port 51234 ssh2\nNov 18 09:14:25 srv01 sshd[1182]: Failed password for invalid user admin from 203.0.113.50 port 51240 ssh2\nNov 18 09:20:03 srv01 kernel: [ 812.334] eth0: link up, 1000 Mbps, full duplex\nNov 18 09:31:40 srv01 sshd[1290]: Accepted publickey for maksym from 192.168.1.50 port 50022 ssh2\nNov 18 09:45:10 srv01 sshd[1311]: Failed password for root from 198.51.100.7 port 40112 ssh2\n","640"),
      "/var/www":d(),"/var/www/html":d(),"/var/www/html/index.html":f("<h1>srv01 works</h1>\n"),"/home":d(),"/home/maksym":d("755","maksym"),"/home/maksym/notes.txt":f("vlan 10 users\nvlan 20 voice\nvlan 99 mgmt\n","644","maksym"),"/opt":d(),"/tmp":d("777")},
    net:{ifs:{lo:{ip:"127.0.0.1",len:8,up:true},eth0:{ip:"192.168.1.10",len:24,up:true,mac:"52:54:00:3a:1c:7e"}},routes:[{net:"0.0.0.0",len:0,via:"192.168.1.1",dev:"eth0"}]},
    svc:{nginx:{active:false,enabled:false,port:8080},ssh:{active:true,enabled:true,port:22},cron:{active:true,enabled:true}},
    git:null, ans:{} }; }
function norm(st,p){ if(!p) return st.cwd; if(p==="~"||p.startsWith("~/")) p="/home/maksym"+p.slice(1); if(!p.startsWith("/")) p=st.cwd.replace(/\/$/,"")+"/"+p;
  const out=[]; for(const s of p.split("/")){ if(!s||s===".") continue; if(s==="..") out.pop(); else out.push(s); } return "/"+out.join("/"); }
const parent=p=>p.replace(/\/[^/]+$/,"")||"/";
const kids=(st,dir)=>Object.keys(st.fs).filter(k=>k!==dir&&parent(k)===dir).map(k=>k.slice(k.lastIndexOf("/")+1)).sort();
const canWrite=(st,p,sudo)=>{ if(sudo) return true; const t=st.fs[p]||st.fs[parent(p)]; if(!t) return false; return t.owner===st.user || t.mode==="777" || p.startsWith("/home/maksym") || p.startsWith("/tmp"); };
const modeStr=n=>n.split("").map(x=>{ const v=Number(x); return (v&4?"r":"-")+(v&2?"w":"-")+(v&1?"x":"-"); }).join("");
function chmodApply(cur,spec){ if(/^[0-7]{3,4}$/.test(spec)) return spec.slice(-3); const m=spec.match(/^([ugoa]*)([+-=])([rwx]+)$/); if(!m) return null;
  const who=m[1]||"a"; const bits=(m[3].includes("r")?4:0)|(m[3].includes("w")?2:0)|(m[3].includes("x")?1:0); const d=cur.split("").map(Number);
  [..."ugo"].forEach((w,i)=>{ if(who.includes(w)||who.includes("a")){ if(m[2]==="+") d[i]|=bits; else if(m[2]==="-") d[i]&=~bits; else d[i]=bits; } }); return d.join(""); }
function reach(st,dst){ if(dst==="127.0.0.1"||dst==="localhost") return {ok:true,dev:"lo"}; const r=st.net.routes.filter(r=>inNet(dst,r.net,r.len)).sort((a,b)=>b.len-a.len)[0];
  for(const [n,i] of Object.entries(st.net.ifs)) if(i.up&&n!=="lo"&&inNet(dst,i.ip,i.len)) return {ok:true,dev:n,direct:true};
  if(!r) return {ok:false,why:"connect: Network is unreachable"}; if(r.via==="192.168.1.1"||r.via==="192.168.1.254") return {ok:true,dev:r.dev,via:r.via}; return {ok:false,why:"Destination Host Unreachable (шлюз "+r.via+" не відповідає)"}; }
function run1(st,line,stdin){
  let toks=line.match(/"[^"]*"|'[^']*'|\S+/g)||[]; toks=toks.map(t=>t.replace(/^["']|["']$/g,"")); let sudo=false; if(toks[0]==="sudo"){ sudo=true; toks.shift(); }
  const [cmd,...a]=toks; const out=[]; const err=m=>({out:m,err:true});
  switch(cmd){
    case undefined: return {out:""};
    case "pwd": return {out:st.cwd};
    case "whoami": return {out:sudo?"root":st.user};
    case "hostname": return {out:st.host};
    case "clear": return {out:"",clear:true};
    case "history": return {out:st.hist.map((h,i)=>String(i+1).padStart(5)+"  "+h).join("\n")};
    case "help": return {out:"Доступно: pwd, cd, ls [-l], cat, echo (> >>), mkdir [-p], touch, rm [-r], cp, mv, chmod, chown, grep [-i] [-c], head/tail [-n N], wc -l, ip a, ip route [add|del], ping, ss -tulpn, systemctl status|start|stop|restart|enable|disable, curl, git init|status|add|commit -m|log|branch|checkout -b, sudo, history. Конвеєр: команда | grep … | wc -l"};
    case "cd": { const p=norm(st,a[0]||"~"); if(!st.fs[p]) return err("bash: cd: "+a[0]+": No such file or directory"); if(st.fs[p].t!=="d") return err("bash: cd: "+a[0]+": Not a directory"); st.cwd=p; return {out:""}; }
    case "ls": { const long=a.includes("-l")||a.includes("-la")||a.includes("-al"); const all=a.some(x=>/^-\w*a/.test(x)); const p=norm(st,a.find(x=>!x.startsWith("-"))); const n=st.fs[p]; if(!n) return err("ls: cannot access '"+(a.find(x=>!x.startsWith("-"))||p)+"': No such file or directory");
      const list=n.t==="d"? kids(st,p).filter(k=>all||!k.startsWith(".")) : [p.split("/").pop()];
      if(!long) return {out:list.join("  ")}; return {out:(n.t==="d"?"total "+list.length*4+"\n":"")+list.map(k=>{ const q=n.t==="d"?(p==="/"?"":p)+"/"+k:p; const x=st.fs[q]; return (x.t==="d"?"d":"-")+modeStr(x.mode)+" 1 "+x.owner.padEnd(7)+" "+x.owner.padEnd(7)+" "+String(x.t==="d"?4096:(x.c||"").length).padStart(5)+" Nov 18 10:00 "+k; }).join("\n")}; }
    case "cat": { if(!a.length&&stdin!=null) return {out:stdin}; const res=[]; for(const x of a){ const p=norm(st,x); const n=st.fs[p]; if(!n) return err("cat: "+x+": No such file or directory"); if(n.t==="d") return err("cat: "+x+": Is a directory"); if(n.mode[2]<"4"&&!sudo&&n.owner!==st.user) return err("cat: "+x+": Permission denied"); res.push(n.c.replace(/\n$/,"")); } return {out:res.join("\n")}; }
    case "echo": return {out:a.join(" ")};
    case "mkdir": { const pp=a.includes("-p"); for(const x of a.filter(x=>x!=="-p")){ const p=norm(st,x); if(st.fs[p]){ if(!pp) return err("mkdir: cannot create directory '"+x+"': File exists"); continue; }
        if(!st.fs[parent(p)]&&!pp) return err("mkdir: cannot create directory '"+x+"': No such file or directory"); if(!canWrite(st,parent(p),sudo)&&!(pp&&sudo)) return err("mkdir: cannot create directory '"+x+"': Permission denied");
        const parts=p.split("/").filter(Boolean); let cur=""; for(const s of parts){ cur+="/"+s; if(!st.fs[cur]) st.fs[cur]={t:"d",mode:"755",owner:sudo?"root":st.user}; } } return {out:""}; }
    case "touch": { for(const x of a){ const p=norm(st,x); if(!st.fs[parent(p)]) return err("touch: cannot touch '"+x+"': No such file or directory"); if(!st.fs[p]){ if(!canWrite(st,parent(p),sudo)) return err("touch: cannot touch '"+x+"': Permission denied"); st.fs[p]={t:"f",c:"",mode:"644",owner:sudo?"root":st.user}; } } return {out:""}; }
    case "rm": { const r=a.some(x=>/^-\w*r/.test(x)); for(const x of a.filter(x=>!x.startsWith("-"))){ const p=norm(st,x); const n=st.fs[p]; if(!n) return err("rm: cannot remove '"+x+"': No such file or directory"); if(n.t==="d"&&!r) return err("rm: cannot remove '"+x+"': Is a directory"); if(!canWrite(st,p,sudo)) return err("rm: cannot remove '"+x+"': Permission denied"); for(const k of Object.keys(st.fs)) if(k===p||k.startsWith(p+"/")) delete st.fs[k]; } return {out:""}; }
    case "cp": case "mv": { const [s1,d1]=a.filter(x=>!x.startsWith("-")); const ps=norm(st,s1); let pd=norm(st,d1); if(!st.fs[ps]) return err(cmd+": cannot stat '"+s1+"': No such file or directory"); if(st.fs[pd]&&st.fs[pd].t==="d") pd=(pd==="/"?"":pd)+"/"+ps.split("/").pop(); if(!canWrite(st,pd,sudo)) return err(cmd+": cannot create '"+d1+"': Permission denied");
      st.fs[pd]=Object.assign({},st.fs[ps],{owner:sudo?st.fs[ps].owner:st.user}); if(cmd==="mv") delete st.fs[ps]; return {out:""}; }
    case "chmod": { const [m,...fs]=a.filter(x=>x!=="-R"); for(const x of fs){ const p=norm(st,x); const n=st.fs[p]; if(!n) return err("chmod: cannot access '"+x+"': No such file or directory"); if(!sudo&&n.owner!==st.user) return err("chmod: changing permissions of '"+x+"': Operation not permitted"); const nm=chmodApply(n.mode,m); if(!nm) return err("chmod: invalid mode: '"+m+"'"); n.mode=nm; } return {out:""}; }
    case "chown": { if(!sudo) return err("chown: changing ownership: Operation not permitted (потрібен sudo)"); const [o,...fs]=a.filter(x=>x!=="-R"); for(const x of fs){ const n=st.fs[norm(st,x)]; if(!n) return err("chown: cannot access '"+x+"': No such file or directory"); n.owner=o.split(":")[0]; } return {out:""}; }
    case "grep": { const flags=a.filter(x=>x.startsWith("-")).join(""); const rest=a.filter(x=>!x.startsWith("-")); const pat=rest[0]; if(!pat) return err("Usage: grep [OPTION]... PATTERNS [FILE]...");
      let text=stdin; if(rest[1]){ const r=run1(st,(sudo?"sudo ":"")+"cat "+rest[1]); if(r.err) return {out:r.out.replace("cat","grep"),err:true}; text=r.out; } if(text==null) return {out:""};
      const re=new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\\\.\\\*/g,".*"),flags.includes("i")?"i":""); const lines=text.split("\n").filter(l=>flags.includes("v")?!re.test(l):re.test(l)); return {out:flags.includes("c")?String(lines.length):lines.join("\n")}; }
    case "head": case "tail": { let n=10; const i=a.indexOf("-n"); if(i>=0){ n=Number(a[i+1]); a.splice(i,2); } else if(a[0]&&/^-\d+$/.test(a[0])) n=Number(a.shift().slice(1)); let text=stdin; if(a[0]){ const r=run1(st,(sudo?"sudo ":"")+"cat "+a[0]); if(r.err) return r; text=r.out; } const L=(text||"").split("\n"); return {out:(cmd==="head"?L.slice(0,n):L.slice(-n)).join("\n")}; }
    case "wc": { let text=stdin; const f=a.find(x=>!x.startsWith("-")); if(f){ const r=run1(st,"cat "+f); if(r.err) return r; text=r.out; } const L=text?text.split("\n").length:0; return {out:String(L)+(f?" "+f:"")}; }
    case "ip": { const sub=(a[0]||"").toLowerCase();
      if(sub==="a"||sub.startsWith("addr")) return {out:Object.entries(st.net.ifs).map(([n,i],k)=>(k+1)+": "+n+": <"+(n==="lo"?"LOOPBACK":"BROADCAST,MULTICAST")+",UP,LOWER_UP> mtu "+(n==="lo"?65536:1500)+"\n    link/"+(n==="lo"?"loopback 00:00:00:00:00:00":"ether "+i.mac)+"\n    inet "+i.ip+"/"+i.len+" scope "+(n==="lo"?"host":"global")+" "+n).join("\n")};
      if(sub==="r"||sub.startsWith("ro")){ const op=a[1];
        if(!op||op==="show") return {out:st.net.routes.map(r=>(r.len===0?"default":r.net+"/"+r.len)+" via "+r.via+" dev "+r.dev).concat(Object.entries(st.net.ifs).filter(([n])=>n!=="lo").map(([n,i])=>{ const m=(0xFFFFFFFF<<(32-i.len))>>>0; const net=[(ip2n(i.ip)&m)>>>24,((ip2n(i.ip)&m)>>>16)&255,((ip2n(i.ip)&m)>>>8)&255,(ip2n(i.ip)&m)&255].join("."); return net+"/"+i.len+" dev "+n+" proto kernel scope link src "+i.ip; })).join("\n")};
        if(op==="add"||op==="del"){ if(!sudo) return err("RTNETLINK answers: Operation not permitted"); const m=(a[2]||"").match(/^(default|(\d+\.\d+\.\d+\.\d+)\/(\d+))$/); const vi=a.indexOf("via"); if(!m||vi<0||!ipRe.test(a[vi+1]||"")) return err("Error: приклад — sudo ip route add 10.20.0.0/16 via 192.168.1.254");
          const r={net:m[1]==="default"?"0.0.0.0":m[2],len:m[1]==="default"?0:Number(m[3]),via:a[vi+1],dev:"eth0"};
          if(op==="add"){ if(!inNet(r.via,"192.168.1.0",24)) return err("Error: Nexthop has invalid gateway."); if(st.net.routes.some(x=>x.net===r.net&&x.len===r.len)) return err("RTNETLINK answers: File exists"); st.net.routes.push(r); } else st.net.routes=st.net.routes.filter(x=>!(x.net===r.net&&x.len===r.len)); return {out:""}; } }
      return err("Usage: ip a | ip route [add|del] …"); }
    case "ping": { const c=a.indexOf("-c"); const n=c>=0?Number(a[c+1]):4; const h=a.filter((x,i)=>!x.startsWith("-")&&i!==c+1).pop(); let ip=h; if(!ipRe.test(h||"")){ const m=(st.fs["/etc/hosts"].c.split("\n").find(l=>l.split(/\s+/).slice(1).includes(h))||"").split(/\s+/)[0]; if(!m) return err("ping: "+h+": Temporary failure in name resolution"); ip=m; }
      const r=reach(st,ip); if(!r.ok) return err("PING "+h+" ("+ip+") 56(84) bytes of data.\nFrom 192.168.1.10 icmp_seq=1 "+r.why); return {out:"PING "+h+" ("+ip+") 56(84) bytes of data.\n"+Array.from({length:Math.min(n,4)},(_,i)=>"64 bytes from "+ip+": icmp_seq="+(i+1)+" ttl=63 time=0."+(4+i)+" ms").join("\n")+"\n\n--- "+h+" ping statistics ---\n"+n+" packets transmitted, "+n+" received, 0% packet loss"}; }
    case "ss": case "netstat": { const L=["Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process"]; for(const [n,s] of Object.entries(st.svc)) if(s.active&&s.port) L.push("tcp   LISTEN 0      511          0.0.0.0:"+String(s.port).padEnd(5)+"       0.0.0.0:*     users:((\""+(n==="ssh"?"sshd":n)+"\",pid="+(1000+s.port%997)+",fd=6))"); return {out:L.join("\n")}; }
    case "systemctl": { const [op,name0]=a; const name=(name0||"").replace(/\.service$/,""); const s=st.svc[name]; if(!op) return err("systemctl: потрібна дія"); if(!s) return err("Failed to "+op+" "+name0+".service: Unit "+name0+".service not found.");
      if(op==="status") return {out:"● "+name+".service - "+name+"\n     Loaded: loaded (/lib/systemd/system/"+name+".service; "+(s.enabled?"enabled":"disabled")+"; vendor preset: enabled)\n     Active: "+(s.active?"active (running) since Wed 2026-11-18 10:02:11 EET":"inactive (dead)")};
      if(!sudo) return err("Failed to "+op+" "+name+".service: Interactive authentication required. (спробуйте sudo)");
      if(op==="start"){ s.active=true; return {out:""}; } if(op==="stop"){ s.active=false; return {out:""}; } if(op==="restart"||op==="reload"){ s.active=true; return {out:""}; }
      if(op==="enable"){ s.enabled=true; return {out:"Created symlink /etc/systemd/system/multi-user.target.wants/"+name+".service → /lib/systemd/system/"+name+".service."}; } if(op==="disable"){ s.enabled=false; return {out:"Removed /etc/systemd/system/multi-user.target.wants/"+name+".service."}; }
      return err("Unknown command verb "+op+"."); }
    case "curl": { const u=(a.find(x=>!x.startsWith("-"))||""); const m=u.match(/^(?:https?:\/\/)?([^/:]+)(?::(\d+))?/); if(!m) return err("curl: no URL specified!"); const host=m[1], port=Number(m[2]||80);
      if(host!=="localhost"&&host!=="127.0.0.1"&&host!=="192.168.1.10") return err("curl: (6) Could not resolve host: "+host); const s=Object.values(st.svc).find(x=>x.active&&x.port===port); if(!s) return err("curl: (7) Failed to connect to "+host+" port "+port+": Connection refused");
      if(s===st.svc.nginx){ st.ans.curl=true; return {out:st.fs["/var/www/html/index.html"].c.trim()}; } return err("curl: (1) Received HTTP/0.9 when not allowed"); }
    case "git": return gitCmd(st,a);
    case "nano": case "vim": case "vi": return err(cmd+": у тренажері редактора немає — використайте echo \"текст\" > файл або >>");
    default: return err(cmd+": command not found");
  }
}
function gitCmd(st,a){ const err=m=>({out:m,err:true}); const [op,...r]=a; const g=st.git;
  if(op==="init"){ st.git={dir:st.cwd,staged:[],commits:[],branch:"main",branches:{main:0},cfg:{}}; st.fs[st.cwd+"/.git"]={t:"d",mode:"755",owner:st.user}; return {out:"Initialized empty Git repository in "+st.cwd+"/.git/"}; }
  if(op==="config"){ if(r.length>=2){ (st.gitcfg=st.gitcfg||{})[r[r.length-2]]=r[r.length-1]; return {out:""}; } return err("usage: git config --global user.name \"Name\""); }
  if(!g||!st.cwd.startsWith(g.dir)) return err("fatal: not a git repository (or any of the parent directories): .git");
  const files=Object.keys(st.fs).filter(k=>k.startsWith(g.dir+"/")&&!k.includes("/.git")&&st.fs[k].t==="f").map(k=>k.slice(g.dir.length+1));
  const committed=g.commits.length? g.commits[g.commits.length-1].files : {};
  const changed=files.filter(f=>committed[f]!==st.fs[g.dir+"/"+f].c);
  if(op==="status") return {out:"On branch "+g.branch+"\n"+(g.staged.length?"Changes to be committed:\n"+g.staged.map(f=>"\tnew file:   "+f).join("\n")+"\n":"")+(changed.filter(f=>!g.staged.includes(f)).length?"Untracked/modified files:\n"+changed.filter(f=>!g.staged.includes(f)).map(f=>"\t"+f).join("\n"):(g.staged.length?"":"nothing to commit, working tree clean"))};
  if(op==="add"){ const add=r[0]==="."||r[0]==="-A"? changed : r.filter(f=>files.includes(f)); if(!add.length&&r[0]!=="."&&r[0]!=="-A") return err("fatal: pathspec '"+r[0]+"' did not match any files"); for(const f of add) if(!g.staged.includes(f)) g.staged.push(f); return {out:""}; }
  if(op==="commit"){ const mi=r.indexOf("-m"); if(mi<0||!r[mi+1]) return err("Aborting commit due to empty commit message. Використайте git commit -m \"повідомлення\""); if(!g.staged.length) return err("nothing added to commit (use \"git add\")");
    const files2=Object.assign({},committed); for(const f of g.staged) files2[f]=st.fs[g.dir+"/"+f].c; const id=Math.random().toString(16).slice(2,9); g.commits.push({id,msg:r[mi+1],files:files2,branch:g.branch}); g.branches[g.branch]=g.commits.length; const n=g.staged.length; g.staged=[]; return {out:"["+g.branch+(g.commits.length===1?" (root-commit)":"")+" "+id+"] "+r[mi+1]+"\n "+n+" file(s) changed"}; }
  if(op==="log") return {out:g.commits.slice().reverse().map(c=>(r.includes("--oneline")?c.id+" "+c.msg:"commit "+c.id+"\nAuthor: "+((st.gitcfg||{})["user.name"]||"maksym")+"\n\n    "+c.msg)).join("\n")||"fatal: your current branch '"+g.branch+"' does not have any commits yet"};
  if(op==="branch"){ if(!r.length) return {out:Object.keys(g.branches).map(b=>(b===g.branch?"* ":"  ")+b).join("\n")}; g.branches[r[0]]=g.commits.length; return {out:""}; }
  if(op==="checkout"||op==="switch"){ const nb=r[0]==="-b"||r[0]==="-c"; const b=nb?r[1]:r[0]; if(nb){ if(g.branches[b]!=null) return err("fatal: a branch named '"+b+"' already exists"); g.branches[b]=g.commits.length; } else if(g.branches[b]==null) return err("error: pathspec '"+b+"' did not match any file(s) known to git"); g.branch=b; return {out:"Switched to "+(nb?"a new ":"")+"branch '"+b+"'"}; }
  return err("git: '"+op+"' is not a git command in this trainer"); }
function exec(st,line){
  st.hist.push(line); let red=null; const m=line.match(/^(.*?)\s*(>>|>)\s*(\S+)\s*$/); if(m&&!/^\s*(grep|ip)\b.*['"]/.test(line)){ red={op:m[2],file:m[3]}; line=m[1]; }
  const parts=line.split("|").map(x=>x.trim()); let stdin=null, res={out:""};
  for(const p of parts){ res=run1(st,p,stdin); if(res.err) break; stdin=res.out; }
  if(red&&!res.err){ const sudo=/^\s*sudo\b/.test(line); const p=norm(st,red.file); if(!st.fs[parent(p)]) return "bash: "+red.file+": No such file or directory"; if(!canWrite(st,p,false)&&!(st.fs[p]&&st.fs[p].owner===st.user)) return "bash: "+red.file+": Permission denied"+(sudo?"\n(sudo не діє на перенаправлення > — використайте: echo \"…\" | sudo tee -a "+red.file+")":"");
    const cur=st.fs[p]&&st.fs[p].t==="f"? st.fs[p].c : ""; st.fs[p]={t:"f",c:(red.op===">>"?cur:"")+res.out+"\n",mode:st.fs[p]?st.fs[p].mode:"644",owner:st.fs[p]?st.fs[p].owner:st.user}; return ""; }
  return res.out; }
// tee для запису з sudo
const _run1=run1;
function Session(st){ return {state:st,prompt(){ return st.user+"@"+st.host+":"+(st.cwd.startsWith("/home/maksym")?"~"+st.cwd.slice(12):st.cwd)+"$ "; },
  exec(line){ const t=line.trim(); if(!t) return ""; const tee=t.match(/^(.*)\|\s*(sudo\s+)?tee\s+(-a\s+)?(\S+)$/); if(tee){ const r=exec(st,tee[1]); const p=norm(st,tee[4]); if(!tee[2]&&!canWrite(st,p,false)) return "tee: "+tee[4]+": Permission denied"; const cur=st.fs[p]&&st.fs[p].t==="f"?st.fs[p].c:""; st.fs[p]={t:"f",c:(tee[3]?cur:"")+r+"\n",mode:st.fs[p]?st.fs[p].mode:"644",owner:st.fs[p]?st.fs[p].owner:"root"}; return r; } return exec(st,t); } }; }
const SCEN=[
 {id:"lnx-fs",bash:true,t:"LNX1",title:"Linux: файли, каталоги і права",hostname:"srv01",
  task:["Створіть каталог /opt/backup (знадобиться sudo) і зробіть власником користувача maksym.","Створіть скрипт /opt/backup/run.sh з рядком: tar czf /tmp/etc.tgz /etc","Дайте права 750 (власник — читання, запис, виконання; група — читання і виконання; інші — нічого).","Порахуйте, скільки невдалих спроб входу SSH у /var/log/syslog (grep … | wc -l або grep -c), і впишіть число командою: echo N > ~/failed.txt"],
  check:st=>{ const d=st.fs["/opt/backup"], f=st.fs["/opt/backup/run.sh"], a=st.fs["/home/maksym/failed.txt"]; return [[!!d&&d.t==="d","Каталог /opt/backup існує"],[!!d&&d.owner==="maksym","Власник /opt/backup — maksym"],[!!f&&/tar czf \/tmp\/etc\.tgz \/etc/.test(f.c),"run.sh містить команду tar"],[!!f&&f.mode==="750","Права run.sh — 750 (rwxr-x---)"],[!!a&&a.c.trim()==="3","У ~/failed.txt правильне число (3)"]]; },
  sol:"sudo mkdir -p /opt/backup\nsudo chown maksym /opt/backup\necho \"tar czf /tmp/etc.tgz /etc\" > /opt/backup/run.sh\nchmod 750 /opt/backup/run.sh\nsudo grep -c \"Failed password\" /var/log/syslog\necho 3 > ~/failed.txt"},
 {id:"lnx-svc",bash:true,t:"LNX2",title:"Linux: сервіс nginx і порти",hostname:"srv01",
  task:["Користувачі кажуть, що вебсервер не відповідає. Перевірте systemctl status nginx.","Запустіть nginx і зробіть так, щоб він стартував після перезавантаження.","З'ясуйте, на якому порту він слухає (ss -tulpn або cat /etc/nginx/nginx.conf), і відкрийте сторінку через curl.","Запишіть номер порту командою echo N > ~/port.txt"],
  check:st=>[[st.svc.nginx.active,"nginx запущено (active)"],[st.svc.nginx.enabled,"nginx увімкнено в автозапуск (enabled)"],[!!st.ans.curl,"Сторінку відкрито через curl"],[!!st.fs["/home/maksym/port.txt"]&&st.fs["/home/maksym/port.txt"].c.trim()==="8080","У ~/port.txt — 8080"]],
  sol:"systemctl status nginx\nsudo systemctl start nginx\nsudo systemctl enable nginx\nss -tulpn\ncurl http://localhost:8080\necho 8080 > ~/port.txt"},
 {id:"lnx-net",bash:true,t:"LNX3",title:"Linux: мережа і маршрути",hostname:"srv01",
  task:["Подивіться адресу й маршрути: ip a, ip route.","Мережа лабораторії 10.20.0.0/16 доступна лише через маршрутизатор 192.168.1.254. Додайте маршрут.","Додайте в /etc/hosts запис «10.20.0.15 lab-sw1» (запис у /etc потребує прав — використайте tee -a з sudo).","Перевірте ping lab-sw1."],
  check:st=>[[st.net.routes.some(r=>r.net==="10.20.0.0"&&r.len===16&&r.via==="192.168.1.254"),"Маршрут 10.20.0.0/16 via 192.168.1.254"],[/^10\.20\.0\.15\s+lab-sw1/m.test(st.fs["/etc/hosts"].c),"Запис lab-sw1 у /etc/hosts"],[st.net.routes.some(r=>r.len===0),"Маршрут за замовчуванням не видалено"]],
  sol:"ip a\nip route\nsudo ip route add 10.20.0.0/16 via 192.168.1.254\necho \"10.20.0.15 lab-sw1\" | sudo tee -a /etc/hosts\nping -c 2 lab-sw1"},
 {id:"lnx-git",bash:true,t:"LNX5",title:"Git: репозиторій для конфігурацій",hostname:"srv01",
  task:["Створіть каталог ~/netcfg і ініціалізуйте в ньому git-репозиторій.","Створіть файл s1.cfg з рядком «hostname S1», додайте його і зробіть коміт із повідомленням «S1 baseline».","Створіть гілку feature/vlan30 і перейдіть на неї."],
  check:st=>{ const g=st.git; return [[!!g&&g.dir==="/home/maksym/netcfg","Репозиторій у ~/netcfg"],[!!g&&g.commits.some(c=>c.msg==="S1 baseline"&&/hostname S1/.test(c.files["s1.cfg"]||"")),"Коміт «S1 baseline» з s1.cfg"],[!!g&&g.branch==="feature/vlan30","Поточна гілка — feature/vlan30"]]; },
  sol:"mkdir ~/netcfg\ncd ~/netcfg\ngit init\necho \"hostname S1\" > s1.cfg\ngit add s1.cfg\ngit commit -m \"S1 baseline\"\ngit checkout -b feature/vlan30"}];
function start(sc){ return Session(newState()); }
window.BASH={SCEN,start,Session,newState};
})();
