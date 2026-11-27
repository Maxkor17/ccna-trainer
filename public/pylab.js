// Лаба «Python для мереж»: справжній Python (Pyodide у браузері) з бібліотеками-імітаціями netmiko, napalm,
// requests (RESTCONF) і ncclient (NETCONF), які працюють із пристроями симулятора замість SSH/HTTPS.
(function(){
const VER="314.0.8", CDN="https://cdn.jsdelivr.net/npm/pyodide@"+VER+"/";
const HOSTS={"10.0.0.1":"R1","10.0.0.11":"S1","10.0.0.12":"S2"}; const USER="admin", PASS="Cisco123!";
let pyP=null;
async function getPy(onMsg){ if(!pyP){ pyP=(async()=>{ onMsg&&onMsg("Завантажую Python (Pyodide, ≈ 10 МБ; лише перший раз)…"); const m=await import(window.PYODIDE_URL||(CDN+"pyodide.mjs")); return m.loadPyodide({indexURL:window.PYODIDE_INDEX||CDN}); })(); pyP.catch(()=>{ pyP=null; }); } return pyP; }
// ---------- міст до симулятора ----------
function bridge(L){ const st=L.track;
  const dev=d=>{ if(!L.N.dev[d]) throw new Error("no device "+d); return L.N.dev[d]; };
  const run=(d,cmds)=>{ const s=L.ses[d]; s.exec("end"); s.exec("enable"); return cmds.map(c=>s.exec(c)); };
  const ifbrief=d=>{ const o=run(d,["show ip interface brief"])[0]; return o.split("\n").slice(1).filter(l=>l.trim()).map(l=>{ const p=l.trim().split(/\s+/); return {interface:p[0],ip_address:p[1],status:p.slice(4,p.length-1).join(" "),proto:p[p.length-1]}; }); };
  const vlanbrief=d=>{ const o=run(d,["show vlan brief"])[0]; const R=[]; for(const l of o.split("\n").slice(2)){ const m=l.match(/^(\d+)\s+(\S+)\s+(\S+)\s*(.*)$/); if(m) R.push({vlan_id:m[1],vlan_name:m[2],status:m[3],interfaces:m[4]?m[4].split(/,\s*/).filter(Boolean):[]}); else if(R.length&&l.trim()) R[R.length-1].interfaces.push(...l.trim().split(/,\s*/).filter(Boolean)); } return R; };
  return {
    connect:(host,user,pw)=>{ const d=HOSTS[host]; if(!d) return "timeout"; if(user!==USER||pw!==PASS){ st.authFail++; return "auth"; } st.connects.add(d); return d; },
    cmd:(d,c)=>{ st.cmds++; return run(d,[c])[0]; },
    textfsm:(d,c)=>{ st.textfsm++; if(/^sh(o(w)?)? ip int(erface)? br(ief)?$/i.test(c.trim())) return JSON.stringify(ifbrief(d)); if(/^sh(o(w)?)? vlan br(ief)?$/i.test(c.trim())) return JSON.stringify(vlanbrief(d)); return ""; },
    cfg:(d,lines)=>{ const L2=JSON.parse(lines); const s=L.ses[d]; s.exec("end"); s.exec("enable"); const out=[s.state.hostname+"#configure terminal","Enter configuration commands, one per line.  End with CNTL/Z."]; let err=""; s.exec("conf t");
      for(const c of L2){ const pr=s.prompt(); const r=s.exec(c); out.push(pr+c+(r?"\n"+r:"")); if(/^%\s|Invalid input/m.test(r)&&!err) err=c+": "+r.split("\n").find(x=>/%/.test(x)); } s.exec("end"); out.push(s.state.hostname+"#end"); L.N.recompute(); st.cfg++; return JSON.stringify({out:out.join("\n"),err}); },
    save:d=>{ run(d,["write memory"]); return "[OK]"; },
    prompt:d=>dev(d).hostname+"#",
    facts:d=>{ const x=dev(d); return JSON.stringify({hostname:x.hostname,fqdn:x.hostname+(x.domain?"."+x.domain:""),vendor:"Cisco",model:x.type==="router"?"ISR4321":"WS-C2960-24TT-L",os_version:x.type==="router"?"16.9.4":"15.0(2)SE11",serial_number:"FTX"+(d.charCodeAt(0)*977+d.length*31),uptime:86400,interface_list:Object.keys(x.ifs).filter(i=>!/^Vlan/.test(i)||x.ifs[i].ip).map(i=>CLI.longIf?CLI.longIf(i):i)}); },
    ifip:d=>{ const x=dev(d); const R={}; for(const i of Object.values(x.ifs)) if(i.ip) R[i.name]={ipv4:{[i.ip]:{prefix_length:i.mask.split(".").reduce((a,o)=>a+((Number(o)>>>0).toString(2).match(/1/g)||[]).length,0)}}}; return JSON.stringify(R); },
    runcfg:d=>run(d,["show running-config"])[0],
    compare:(d,cand)=>{ st.compare++; const have=new Set(run(d,["show running-config"])[0].split("\n").map(x=>x.trim())); return JSON.parse(cand).filter(l=>l.trim()&&!have.has(l.trim())).map(l=>"+"+l).join("\n"); },
    restconf:(method,url,hdrs,auth,body)=>{ const H=JSON.parse(hdrs||"{}"); const A=JSON.parse(auth||"null"); const lc={}; for(const k in H) lc[k.toLowerCase()]=String(H[k]); const res=(code,obj)=>JSON.stringify([code,obj==null?"":typeof obj==="string"?obj:JSON.stringify(obj,null,2)]);
      const m=String(url).match(/^https?:\/\/([\d.]+)(?::\d+)?(\/restconf\/.*)$/); if(!m) return res(0,"ConnectionError: unsupported URL "+url); const d=HOSTS[m[1]]; if(!d) return res(0,"ConnectTimeout: "+m[1]);
      if(!A||A[0]!==USER||A[1]!==PASS) return res(401,{errors:{error:[{"error-tag":"access-denied"}]}}); const acc=lc.accept||""; if(method==="GET"&&!/yang-data\+json/.test(acc)) return res(406,{errors:{error:[{"error-message":"Accept must be application/yang-data+json"}]}});
      if(method!=="GET"&&!/yang-data\+json/.test(lc["content-type"]||"")) return res(415,{errors:{error:[{"error-message":"Content-Type must be application/yang-data+json"}]}});
      const x=dev(d); const path=decodeURIComponent(m[2]).replace(/\/+$/,""); st.rest++;
      const ifJson=i=>({name:CLI.longIf(i.name),description:i.desc||undefined,type:/^Lo/.test(i.name)?"iana-if-type:softwareLoopback":"iana-if-type:ethernetCsmacd",enabled:!i.shutdown,"ietf-ip:ipv4":i.ip?{address:[{ip:i.ip,netmask:i.mask}]}:{}});
      if(path==="/restconf/data/ietf-interfaces:interfaces"){ if(method!=="GET") return res(405,null); st.restGet++; return res(200,{"ietf-interfaces:interfaces":{interface:Object.values(x.ifs).filter(i=>!/^Vlan/.test(i.name)||i.ip).map(ifJson)}}); }
      let mm=path.match(/^\/restconf\/data\/ietf-interfaces:interfaces\/interface=(.+)$/); if(mm){ const n=CLI.normIf(mm[1]); const i=n&&x.ifs[n]; if(!i) return res(404,{errors:{error:[{"error-tag":"invalid-value"}]}});
        if(method==="GET"){ st.restGet++; return res(200,{"ietf-interfaces:interface":ifJson(i)}); }
        if(method==="PATCH"||method==="PUT"){ let b; try{ b=JSON.parse(body||"{}"); }catch(e){ return res(400,{errors:{error:[{"error-message":"malformed JSON"}]}}); } const v=b["ietf-interfaces:interface"]||b.interface||{}; if(v.description!=null){ i.desc=String(v.description); } if(v.enabled!=null) i.shutdown=!v.enabled; L.N.recompute(); st.restPatch++; return res(204,null); }
        return res(405,null); }
      if(path==="/restconf/data/Cisco-IOS-XE-native:native/hostname"){ if(method==="GET"){ st.restGet++; return res(200,{"Cisco-IOS-XE-native:hostname":x.hostname}); } if(method==="PUT"||method==="PATCH"){ const b=JSON.parse(body||"{}"); const h=b["Cisco-IOS-XE-native:hostname"]; if(!h) return res(400,null); x.hostname=String(h); st.restPatch++; return res(204,null); } }
      if(path==="/restconf/data/Cisco-IOS-XE-native:native/ntp"&&method==="GET"){ st.restGet++; return res(200,{"Cisco-IOS-XE-native:ntp":{server:{"server-list":((x.svc||{}).ntp||[]).map(a=>({"ip-address":a}))}}}); }
      return res(404,{errors:{error:[{"error-tag":"invalid-value","error-message":"uri keypath not found"}]}}); },
    nc_get:(d)=>{ const x=dev(d); return "<data><native xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-native\"><hostname>"+x.hostname+"</hostname></native><interfaces xmlns=\"urn:ietf:params:xml:ns:yang:ietf-interfaces\">"+Object.values(x.ifs).filter(i=>!/^Vlan/.test(i.name)||i.ip).map(i=>"<interface><name>"+CLI.longIf(i.name)+"</name>"+(i.desc?"<description>"+i.desc+"</description>":"")+"<enabled>"+(!i.shutdown)+"</enabled></interface>").join("")+"</interfaces></data>"; },
    nc_edit:(d,xml)=>{ const x=dev(d); const h=String(xml).match(/<hostname>\s*([^<]+?)\s*<\/hostname>/); let ch=0; if(h){ x.hostname=h[1]; ch++; }
      for(const m of String(xml).matchAll(/<interface>\s*<name>\s*([^<]+?)\s*<\/name>\s*<description>\s*([^<]*?)\s*<\/description>/g)){ const n=CLI.normIf(m[1]); if(n&&x.ifs[n]){ x.ifs[n].desc=m[2]; ch++; } }
      if(!ch) return "<rpc-error><error-tag>invalid-value</error-tag></rpc-error>"; st.ncEdit++; return "<ok/>"; } }; }
// ---------- Python-модулі-імітації ----------
const PY={
"netmiko/__init__.py":`import json, simnet
from netmiko.exceptions import NetmikoTimeoutException, NetmikoAuthenticationException
class ConnectHandler:
    def __init__(self, device_type="cisco_ios", host=None, ip=None, username=None, password=None, secret=None, port=22, **kw):
        if not str(device_type).startswith("cisco_ios"):
            raise ValueError("Unsupported device_type: %s (use cisco_ios)" % device_type)
        h = host or ip
        r = simnet.connect(str(h), str(username), str(password))
        if r == "timeout": raise NetmikoTimeoutException("TCP connection to device failed. Device: %s:%s" % (h, port))
        if r == "auth": raise NetmikoAuthenticationException("Authentication to device failed. Device: %s:%s" % (h, port))
        self.host = h; self._dev = r
    def __enter__(self): return self
    def __exit__(self, *a): self.disconnect()
    def find_prompt(self): return simnet.prompt(self._dev)
    def enable(self): return self.find_prompt()
    def send_command(self, command_string, use_textfsm=False, **kw):
        if use_textfsm:
            r = simnet.textfsm(self._dev, command_string)
            if r: return json.loads(r)
        return simnet.cmd(self._dev, command_string)
    def send_config_set(self, config_commands=None, **kw):
        if isinstance(config_commands, str): config_commands = [config_commands]
        r = json.loads(simnet.cfg(self._dev, json.dumps(list(config_commands or []))))
        return r["out"]
    def send_config_from_file(self, config_file=None, **kw):
        with open(config_file) as f: return self.send_config_set(f.read().splitlines())
    def save_config(self, *a, **kw): return simnet.save(self._dev)
    def disconnect(self): pass
`,
"netmiko/exceptions.py":`class NetmikoTimeoutException(Exception): pass
class NetmikoAuthenticationException(Exception): pass
`,
"netmiko/ssh_exception.py":`from netmiko.exceptions import NetmikoTimeoutException, NetmikoAuthenticationException
`,
"napalm/__init__.py":`import json, simnet
def get_network_driver(name):
    if name not in ("ios", "cisco_ios"): raise ValueError("driver %s is not available in this lab (use ios)" % name)
    return IOSDriver
class ConnectionException(Exception): pass
class IOSDriver:
    def __init__(self, hostname, username, password, timeout=60, optional_args=None):
        self.hostname, self.username, self.password = hostname, username, password; self._dev = None; self._cand = None
    def open(self):
        r = simnet.connect(str(self.hostname), str(self.username), str(self.password))
        if r in ("timeout", "auth"): raise ConnectionException("Cannot connect to %s (%s)" % (self.hostname, r))
        self._dev = r
    def close(self): pass
    def __enter__(self): self.open(); return self
    def __exit__(self, *a): self.close()
    def get_facts(self): return json.loads(simnet.facts(self._dev))
    def get_interfaces_ip(self): return json.loads(simnet.ifip(self._dev))
    def get_config(self, retrieve="all"): return {"running": simnet.runcfg(self._dev), "startup": "", "candidate": "\\n".join(self._cand or [])}
    def load_merge_candidate(self, filename=None, config=None):
        if filename:
            with open(filename) as f: config = f.read()
        self._cand = [l for l in str(config).splitlines() if l.strip() and not l.strip().startswith("!")]
    def compare_config(self):
        if not self._cand: return ""
        return simnet.compare(self._dev, json.dumps(self._cand))
    def commit_config(self, message="", revert_in=None):
        if not self._cand: return
        r = json.loads(simnet.cfg(self._dev, json.dumps(self._cand)))
        if r["err"]: raise Exception("MergeConfigException: " + r["err"])
        self._cand = None
    def discard_config(self): self._cand = None
`,
"requests/__init__.py":`import json as _json, simnet
from requests import exceptions
class Response:
    def __init__(self, code, text, url):
        self.status_code = code; self.text = text; self.url = url; self.ok = 200 <= code < 400; self.reason = {200:"OK",201:"Created",204:"No Content",400:"Bad Request",401:"Unauthorized",404:"Not Found",405:"Method Not Allowed",406:"Not Acceptable",415:"Unsupported Media Type"}.get(code, "")
        self.content = text.encode()
    def json(self):
        if not self.text: raise ValueError("Response has no JSON body (status %d)" % self.status_code)
        return _json.loads(self.text)
    def raise_for_status(self):
        if not self.ok: raise exceptions.HTTPError("%d %s for url: %s" % (self.status_code, self.reason, self.url), response=self)
    def __repr__(self): return "<Response [%d]>" % self.status_code
def request(method, url, headers=None, auth=None, json=None, data=None, verify=True, timeout=None, **kw):
    body = _json.dumps(json) if json is not None else (data if isinstance(data, str) else (_json.dumps(data) if data is not None else ""))
    code, text = _json.loads(simnet.restconf(method.upper(), url, _json.dumps(headers or {}), _json.dumps(list(auth) if auth else None), body))
    if code == 0:
        raise exceptions.ConnectionError(text)
    return Response(code, text, url)
def get(url, **kw): return request("GET", url, **kw)
def post(url, **kw): return request("POST", url, **kw)
def put(url, **kw): return request("PUT", url, **kw)
def patch(url, **kw): return request("PATCH", url, **kw)
def delete(url, **kw): return request("DELETE", url, **kw)
class _Pk:
    class urllib3:
        @staticmethod
        def disable_warnings(*a, **k): pass
packages = _Pk()
`,
"requests/exceptions.py":`class RequestException(Exception):
    def __init__(self, *a, response=None, **k):
        super().__init__(*a); self.response = response
class HTTPError(RequestException): pass
class ConnectionError(RequestException): pass
`,
"requests/auth.py":`class HTTPBasicAuth(tuple):
    def __new__(cls, u, p): return tuple.__new__(cls, (u, p))
`,
"urllib3/__init__.py":`def disable_warnings(*a, **k): pass
class exceptions:
    class InsecureRequestWarning(Warning): pass
`,
"ncclient/__init__.py":`from ncclient import manager
`,
"ncclient/manager.py":`import simnet
class _Reply:
    def __init__(self, xml): self.xml = xml; self.data_xml = xml; self.ok = "<ok/>" in xml
    def __str__(self): return self.xml
class Manager:
    def __init__(self, dev): self._dev = dev
    def __enter__(self): return self
    def __exit__(self, *a): pass
    def get_config(self, source="running", filter=None): return _Reply(simnet.nc_get(self._dev))
    def edit_config(self, config=None, target="running", **kw):
        r = simnet.nc_edit(self._dev, str(config))
        if "rpc-error" in r: raise Exception("RPCError: invalid-value")
        return _Reply(r)
    @property
    def server_capabilities(self): return ["urn:ietf:params:netconf:base:1.0", "urn:ietf:params:netconf:base:1.1", "http://cisco.com/ns/yang/Cisco-IOS-XE-native"]
    def close_session(self): pass
def connect(host=None, port=830, username=None, password=None, hostkey_verify=True, device_params=None, **kw):
    r = simnet.connect(str(host), str(username), str(password))
    if r in ("timeout", "auth"): raise Exception("SSHError: could not open NETCONF session to %s:%s (%s)" % (host, port, r))
    return Manager(r)
`};
function newLab(){ const L=ANSIBLE.newLab(); L.track={connects:new Set(),authFail:0,textfsm:0,cfg:0,compare:0,rest:0,restGet:0,restPatch:0,ncEdit:0,cmds:0,lastOk:false,caught:false}; L.runs=0; return L; }
async function run(L,code,onMsg){ const py=await getPy(onMsg); onMsg&&onMsg("Виконую…");
  py.registerJsModule("simnet",bridge(L));
  const base="/home/pyodide/simlibs"; try{ py.FS.mkdirTree(base); }catch(e){}
  for(const [p,src] of Object.entries(PY)){ const dir=base+"/"+p.split("/").slice(0,-1).join("/"); try{ py.FS.mkdirTree(dir); }catch(e){} py.FS.writeFile(base+"/"+p,src); }
  let out=""; py.setStdout({batched:s=>{ out+=s+"\n"; }}); py.setStderr({batched:s=>{ out+=s+"\n"; }});
  py.runPython("import sys, importlib\nif '"+base+"' not in sys.path: sys.path.insert(0,'"+base+"')\nfor m in [k for k in list(sys.modules) if k.split('.')[0] in ('netmiko','napalm','requests','ncclient','urllib3','simnet')]: del sys.modules[m]");
  let ok=true; try{ await py.runPythonAsync(code); }catch(e){ ok=false; const lines=String(e.message||e).replace(/^PythonError: /,"").split("\n"); const k=lines.findIndex(l=>/File "<exec>"/.test(l)); const keep=k>=0? ["Traceback (most recent call last):"].concat(lines.slice(k)) : lines; out+=keep.filter(l=>l.trim()&&!/File "\/lib\/|_pyodide|pyodide\//.test(l)).join("\n")+"\n"; }
  L.runs++; L.track.lastOk=ok; if(ok&&L.track.authFail>0) L.track.caught=true; L.N.recompute(); return {ok,out}; }
const TASKS=[
 {id:"loop",t:"Netmiko: у циклі підключіться до всіх трьох пристроїв (10.0.0.1, 10.0.0.11, 10.0.0.12; admin / Cisco123!) і виведіть find_prompt() кожного.",ok:L=>L.track.connects.size>=3},
 {id:"tfsm",t:"Отримайте show ip interface brief як список словників (use_textfsm=True) і виведіть лише інтерфейси зі статусом up.",ok:L=>L.track.textfsm>0},
 {id:"vlan",t:"send_config_set: створіть VLAN 50 з назвою PYTHON на обох комутаторах.",ok:L=>["S1","S2"].every(d=>L.N.dev[d].vlans[50]&&String(L.N.dev[d].vlans[50].name).toUpperCase()==="PYTHON")},
 {id:"exc",t:"Обробка помилок: спробуйте підключитися з неправильним паролем і перехопіть NetmikoAuthenticationException — скрипт має завершитися без падіння.",ok:L=>L.track.caught},
 {id:"napalm",t:"NAPALM: на R1 зробіть load_merge_candidate з «ntp server 10.1.1.123», виведіть compare_config() і зробіть commit_config().",ok:L=>L.track.compare>0&&((L.N.dev.R1.svc||{}).ntp||[]).includes("10.1.1.123")},
 {id:"rget",t:"RESTCONF: requests.get до https://10.0.0.1/restconf/data/ietf-interfaces:interfaces (Accept: application/yang-data+json, auth) і виведіть назви інтерфейсів.",ok:L=>L.track.restGet>0},
 {id:"rpatch",t:"RESTCONF: PATCH опису GigabitEthernet0/0 на R1 → «Uplink to S1» (Content-Type: application/yang-data+json).",ok:L=>(L.N.dev.R1.ifs["Gi0/0"].desc||"")==="Uplink to S1"},
 {id:"nc",t:"NETCONF (ncclient): змініть hostname S2 на S2-NC через edit_config (порт 830).",ok:L=>L.N.dev.S2.hostname==="S2-NC"&&L.track.ncEdit>0}];
const SAMPLE=`from netmiko import ConnectHandler

devices = ["10.0.0.1", "10.0.0.11", "10.0.0.12"]
for ip in devices:
    with ConnectHandler(device_type="cisco_ios", host=ip,
                        username="admin", password="Cisco123!") as conn:
        print(ip, conn.find_prompt())
`;
window.PYLAB={newLab,run,TASKS,SAMPLE,PY,bridge,CDN,VER};
})();
