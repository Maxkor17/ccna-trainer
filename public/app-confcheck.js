"use strict";
// Аналізатор конфігурацій: вставте show running-config одного чи кількох пристроїв (Packet Tracer або реальне обладнання),
// за бажання — show vlan brief. Розбір → перевірки помилок на кожному пристрої й між пристроями (за спільними підмережами),
// оцінка захищеності за чеклістом і перевірка синтаксису симулятором.
const CC_LS = "ccna.confcheck";
const CC_PFX = [["tengigabitethernet", "Te"], ["gigabitethernet", "Gi"], ["fastethernet", "Fa"], ["ethernet", "Et"], ["serial", "Se"], ["port-channel", "Po"], ["loopback", "Lo"], ["tunnel", "Tu"], ["vlan", "Vlan"],
  ["gig", "Gi"], ["fas", "Fa"], ["ten", "Te"], ["ser", "Se"], ["eth", "Et"], ["te", "Te"], ["gi", "Gi"], ["g", "Gi"], ["fa", "Fa"], ["f", "Fa"], ["et", "Et"], ["e", "Et"], ["se", "Se"], ["s", "Se"], ["po", "Po"], ["lo", "Lo"], ["tu", "Tu"]];
function ccIf(n) { n = String(n || "").trim().replace(/\s+/g, ""); const m = n.match(/^([a-z-]+)([\d/.:]+)$/i); if (!m) return n; const p = CC_PFX.find(([k]) => m[1].toLowerCase() === k); return p ? p[1] + m[2] : n; }
const ip2n = s => { const p = String(s).split(".").map(Number); return p.length === 4 && p.every(x => x >= 0 && x <= 255) ? ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3] : null; };
const n2ip = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
const maskLen = m => { const n = ip2n(m); if (n == null) return null; const b = n.toString(2).padStart(32, "0"); return /^1*0*$/.test(b) ? b.indexOf("0") < 0 ? 32 : b.indexOf("0") : null; };
const netOf = (ip, len) => len === 0 ? 0 : (ip2n(ip) & (0xffffffff << (32 - len))) >>> 0;
// ---- розбір ----
function ccSplit(text) { // кілька пристроїв: розділяємо за "hostname", "Building configuration" або рядком з ===
  const lines = String(text || "").replace(/\r/g, "").split("\n"); const blocks = []; let cur = null; let pend = [];
  for (const l of lines) { if (/^\s*(Building configuration|Current configuration|={3,}|-{5,})/i.test(l)) { if (cur && cur.some(x => x.trim())) blocks.push(cur); cur = []; continue; }
    if (/^hostname\s+\S+/i.test(l) && cur && cur.some(x => /^hostname\s/i.test(x))) { blocks.push(cur); cur = []; }
    (cur = cur || []).push(l); }
  if (cur && cur.some(x => x.trim())) blocks.push(cur); return blocks.length ? blocks : [lines]; }
function ccParse(lines) {
  const D = { host: "?", ifs: {}, ospf: null, routes: [], acls: {}, pools: {}, excl: [], vty: [], con: null, users: [], g: {}, vlanBrief: null, lines: [], sw: false, natIn: [] };
  let ctx = null, ctxKind = null; const top = [];
  for (let raw of lines) { const l = raw.replace(/\s+$/, ""); if (!l.trim() || /^\s*!/.test(l)) { if (/^!/.test(l)) { ctx = null; ctxKind = null; } continue; }
    D.lines.push(l.trim()); const ind = /^\s/.test(l); const t = l.trim(); let m;
    if (!ind) { ctx = null; ctxKind = null; }
    if (!ind && (m = t.match(/^hostname\s+(\S+)/i))) { D.host = m[1]; continue; }
    if (!ind && (m = t.match(/^interface\s+range\s+(.+)$/i))) { ctx = ccRange(m[1]).map(n => D.ifs[n] = D.ifs[n] || { name: n, cfg: [], shut: false }); ctxKind = "if"; continue; }
    if (!ind && (m = t.match(/^interface\s+(\S+(?:\s\d\S*)?)/i))) { const n = ccIf(m[1]); ctx = [D.ifs[n] = D.ifs[n] || { name: n, cfg: [], shut: false }]; ctxKind = "if"; continue; }
    if (!ind && (m = t.match(/^router ospf\s+(\d+)/i))) { ctx = D.ospf = D.ospf || { pid: m[1], nets: [], passive: [], passDef: false, rid: null }; ctxKind = "ospf"; continue; }
    if (!ind && (m = t.match(/^ip access-list (standard|extended)\s+(\S+)/i))) { ctx = D.acls[m[2]] = D.acls[m[2]] || { type: m[1].toLowerCase(), rules: [] }; ctxKind = "nacl"; continue; }
    if (!ind && (m = t.match(/^ip dhcp pool\s+(\S+)/i))) { ctx = D.pools[m[1]] = { name: m[1], net: null, gw: null, dns: null }; ctxKind = "pool"; continue; }
    if (!ind && (m = t.match(/^line (vty|con(?:sole)?)\s+(\d+)(?:\s+(\d+))?/i))) { ctx = { kind: m[1].toLowerCase().startsWith("vty") ? "vty" : "con", from: +m[2], to: +(m[3] || m[2]), cfg: [] }; if (ctx.kind === "vty") D.vty.push(ctx); else D.con = ctx; ctxKind = "line"; continue; }
    if (!ind && /^(vlan\s+\d|router\s|ip dhcp|ip access|line\s|interface\s|class-map|policy-map|crypto|key chain|banner)/i.test(t) === false) { ctx = null; ctxKind = null; }
    if (ind && ctxKind === "if") { for (const I of ctx) ccIfLine(D, I, t); continue; }
    if (ind && ctxKind === "ospf") { if ((m = t.match(/^network (\S+) (\S+) area (\S+)/i))) ctx.nets.push({ net: m[1], wc: m[2], area: m[3] });
      else if (/^passive-interface default/i.test(t)) ctx.passDef = true; else if ((m = t.match(/^no passive-interface (\S+)/i))) (ctx.noPass = ctx.noPass || []).push(ccIf(m[1]));
      else if ((m = t.match(/^passive-interface (\S+)/i))) ctx.passive.push(ccIf(m[1])); else if ((m = t.match(/^router-id (\S+)/i))) ctx.rid = m[1]; continue; }
    if (ind && ctxKind === "nacl") { if ((m = t.match(/^(?:\d+\s+)?(permit|deny|remark)\s*(.*)/i)) && m[1].toLowerCase() !== "remark") ctx.rules.push({ act: m[1].toLowerCase(), rest: m[2] }); continue; }
    if (ind && ctxKind === "pool") { if ((m = t.match(/^network (\S+) (\S+)/i))) ctx.net = [m[1], m[2]]; else if ((m = t.match(/^default-router (\S+)/i))) ctx.gw = m[1]; else if ((m = t.match(/^dns-server (\S+)/i))) ctx.dns = m[1]; continue; }
    if (ind && ctxKind === "line") { ctx.cfg.push(t); continue; }
    if (ind) continue;
    top.push(t);
    if ((m = t.match(/^access-list (\d+) (permit|deny|remark)\s*(.*)/i))) { const id = m[1]; const a = D.acls[id] = D.acls[id] || { type: +id < 100 || (+id >= 1300 && +id < 2000) ? "standard" : "extended", rules: [] }; if (m[2].toLowerCase() !== "remark") a.rules.push({ act: m[2].toLowerCase(), rest: m[3] }); }
    else if ((m = t.match(/^ip route (\S+) (\S+) (\S+)(?:\s+(\d+))?/i))) D.routes.push({ net: m[1], mask: m[2], nh: m[3], ad: m[4] ? +m[4] : 1 });
    else if ((m = t.match(/^ip dhcp excluded-address (\S+)(?:\s+(\S+))?/i))) D.excl.push([ip2n(m[1]), ip2n(m[2] || m[1])]);
    else if ((m = t.match(/^username (\S+)(.*)/i))) D.users.push({ name: m[1], secret: /\bsecret\b/i.test(m[2]), plain: /\bpassword( 0)? /i.test(m[2]) });
    else if ((m = t.match(/^ip nat inside source (list|static) (\S+)(.*)/i))) D.natIn.push({ kind: m[1].toLowerCase(), acl: m[1].toLowerCase() === "list" ? m[2] : null, rest: m[3] });
    else if (/^vlan \d/i.test(t)) D.sw = true;
    const G = D.g;
    if (/^enable secret/i.test(t)) G.esecret = true; if (/^enable password/i.test(t)) G.epass = true; if (/^service password-encryption/i.test(t)) G.spe = true;
    if (/^ip ssh version 2/i.test(t)) G.ssh2 = true; if (/^ip http server/i.test(t)) G.http = true; if (/^ip http secure-server/i.test(t)) G.https = true; if (/^banner (motd|login)/i.test(t)) G.banner = true;
    if (/^logging (host )?\d/i.test(t)) G.syslog = true; if (/^ntp server/i.test(t)) G.ntp = true; if (/^ip routing/i.test(t)) G.iprouting = true; if (/^no ip routing/i.test(t)) G.noiprouting = true;
    if ((m = t.match(/^ip default-gateway (\S+)/i))) G.dgw = m[1]; if (/^spanning-tree portfast (edge )?bpduguard default/i.test(t)) G.bgDef = true; if (/^spanning-tree portfast (edge )?default/i.test(t)) G.pfDef = true;
    if (/^ip dhcp snooping$/i.test(t)) G.snoop = true; if ((m = t.match(/^ip dhcp snooping vlan (\S+)/i))) G.snoopVlans = ccList(m[1]); if (/^ip arp inspection vlan/i.test(t)) G.dai = true;
    if ((m = t.match(/^spanning-tree mode (\S+)/i))) G.stpMode = m[1].toLowerCase(); if (/^aaa new-model/i.test(t)) G.aaa = true; if (/^login block-for/i.test(t)) G.blockFor = true;
    if (/^ip domain[- ]name/i.test(t)) G.domain = true; if (/^no cdp run/i.test(t)) G.nocdp = true;
  }
  if (!D.sw) D.sw = Object.values(D.ifs).some(I => /^(Fa|Gi|Te)\d\/\d+$/.test(I.name) && !I.ip && !I.noSw) && Object.keys(D.ifs).some(n => n.startsWith("Vlan"));
  return D;
}
function ccIfLine(D, I, t) { let m; I.cfg.push(t);
      if (/^shutdown$/i.test(t)) I.shut = true;
      else if ((m = t.match(/^switchport mode (access|trunk|dynamic (?:auto|desirable))/i))) { I.mode = m[1].toLowerCase(); D.sw = true; }
      else if ((m = t.match(/^switchport access vlan (\d+)/i))) { I.acc = +m[1]; D.sw = true; }
      else if ((m = t.match(/^switchport voice vlan (\d+)/i))) I.voice = +m[1];
      else if ((m = t.match(/^switchport trunk native vlan (\d+)/i))) I.native = +m[1];
      else if ((m = t.match(/^switchport trunk allowed vlan (?:add\s+)?([\d,\-]+|all|none)/i))) { const v = m[1].toLowerCase(); if (/ add /i.test(" " + t + " ") && I.allowed) I.allowed = I.allowed.concat(ccList(v)); else I.allowed = v === "all" ? null : v === "none" ? [] : ccList(v); }
      else if (/^switchport nonegotiate/i.test(t)) I.noneg = true;
      else if (/^switchport port-security$/i.test(t)) I.ps = true;
      else if ((m = t.match(/^switchport port-security (maximum|violation|mac-address)\s*(.*)/i))) { I.psCfg = I.psCfg || {}; I.psCfg[m[1].toLowerCase()] = m[2]; }
      else if ((m = t.match(/^channel-group (\d+) mode (\S+)/i))) { I.ch = +m[1]; I.chMode = m[2].toLowerCase(); }
      else if (/^spanning-tree portfast(?! trunk)( edge)?$/i.test(t)) I.pf = true;
      else if (/^spanning-tree portfast (edge )?trunk/i.test(t)) I.pfTrunk = true;
      else if (/^spanning-tree bpduguard enable/i.test(t)) I.bg = true;
      else if ((m = t.match(/^ip address (\S+) (\S+)( secondary)?/i)) && !m[3]) { I.ip = m[1]; I.mask = m[2]; I.len = maskLen(m[2]); }
      else if ((m = t.match(/^ip helper-address (\S+)/i))) (I.helper = I.helper || []).push(m[1]);
      else if ((m = t.match(/^encapsulation dot1q (\d+)( native)?/i))) { I.dot1q = +m[1]; I.dot1qNative = !!m[2]; }
      else if ((m = t.match(/^ip ospf hello-interval (\d+)/i))) I.hello = +m[1];
      else if ((m = t.match(/^ip ospf dead-interval (\d+)/i))) I.dead = +m[1];
      else if ((m = t.match(/^ip ospf (\d+) area (\S+)/i))) I.ospfArea = m[2];
      else if ((m = t.match(/^ip ospf priority (\d+)/i))) I.ospfPrio = +m[1];
      else if ((m = t.match(/^ip mtu (\d+)/i))) I.mtu = +m[1];
      else if ((m = t.match(/^(standby|vrrp) (\d+) ip (\S+)/i))) { I.fhrp = { p: m[1].toLowerCase(), g: +m[2], vip: m[3] }; }
      else if ((m = t.match(/^(standby|vrrp) (\d+) priority (\d+)/i))) I.fhrpPrio = +m[3];
      else if (/^(standby|vrrp) \d+ preempt/i.test(t)) I.preempt = true;
      else if ((m = t.match(/^ip nat (inside|outside)/i))) I.nat = m[1].toLowerCase();
      else if ((m = t.match(/^ip access-group (\S+) (in|out)/i))) (I.acg = I.acg || []).push([m[1], m[2].toLowerCase()]);
      else if (/^ip dhcp snooping trust/i.test(t)) I.snTrust = true;
      else if ((m = t.match(/^(speed|duplex) (\S+)/i))) I[m[1].toLowerCase()] = m[2].toLowerCase();
      else if (/^no switchport/i.test(t)) I.noSw = true;
      else if (/^switchport/i.test(t)) D.sw = true;
}
function ccRange(s) { const out = []; for (const part of s.split(/\s*,\s*/)) { const m = part.trim().match(/^([a-z-]+)\s*([\d/]*\/)(\d+)(?:\s*-\s*(\d+))?$/i); if (!m) continue; for (let k = +m[3]; k <= +(m[4] || m[3]) && k - m[3] < 100; k++) out.push(ccIf(m[1] + m[2] + k)); } return out; }
function ccList(s) { const out = []; for (const p of String(s).split(",")) { const m = p.match(/^(\d+)(?:-(\d+))?$/); if (!m) continue; const a = +m[1], b = +(m[2] || m[1]); for (let v = a; v <= b && v - a < 4100; v++) out.push(v); } return out; }
function ccVlanBrief(text) { // show vlan brief: номер → порти
  const V = {}; let last = null; for (const l of String(text).split("\n")) { let m = l.match(/^(\d{1,4})\s+(\S+)\s+(active|act\/unsup|suspended)\s*(.*)$/); if (m) { last = +m[1]; V[last] = { name: m[2], ports: m[4].split(/,\s*/).filter(Boolean).map(ccIf) }; continue; }
    m = l.match(/^\s{20,}(\S.*)$/); if (m && last != null) V[last].ports.push(...m[1].split(/,\s*/).filter(Boolean).map(ccIf)); }
  return Object.keys(V).length ? V : null; }
// ---- перевірки ----
function ccCheck(text) {
  const vb = ccVlanBrief(text); const devs = ccSplit(text).map(ccParse).filter(d => d.lines.length >= 2); const F = [];
  const add = (sev, d, msg, fix) => F.push({ sev, dev: d ? d.host : "мережа", msg, fix });
  for (const d of devs) {
    const I = Object.values(d.ifs); const access = I.filter(i => i.mode === "access" || (!i.mode && i.acc)), trunks = I.filter(i => i.mode === "trunk");
    // інтерфейси й VLAN
    for (const i of I) {
      if (i.ip && i.shut && !/^Vlan/.test(i.name)) add("warn", d, `${i.name} має IP ${i.ip}, але вимкнений (shutdown)`, `interface ${i.name}\n no shutdown`);
      if (i.mode === "trunk" && i.acc && i.acc !== 1) add("info", d, `${i.name}: switchport access vlan ${i.acc} на trunk-порту ігнорується`, "Приберіть рядок або переведіть порт у режим access.");
      if (i.mode === "access" && (i.native || i.allowed)) add("info", d, `${i.name}: налаштування trunk на access-порту не діють`, "Перевірте, чи порт мав бути trunk.");
      if (!i.mode && i.acc && /^(Fa|Gi|Te|Et)\d/.test(i.name)) add("warn", d, `${i.name}: access VLAN задано, але режим порту не вказано — порт лишається динамічним (DTP) і може стати trunk`, `interface ${i.name}\n switchport mode access`);
      if (/^dynamic/.test(i.mode || "")) add("warn", d, `${i.name}: режим ${i.mode} — trunk узгоджується через DTP`, `interface ${i.name}\n switchport mode trunk  (або access)\n switchport nonegotiate`);
      if ((i.psCfg && !i.ps)) add("warn", d, `${i.name}: параметри port security задано, але сам port security не ввімкнено`, `interface ${i.name}\n switchport port-security`);
      if (i.pf && i.mode === "trunk") add("info", d, `${i.name}: spanning-tree portfast на trunk не діє (потрібно portfast trunk, і лише до сервера/гіпервізора)`, "Приберіть portfast з міжкомутаторних trunk.");
      if (i.pf && !i.bg && !d.g.bgDef) add("warn", d, `${i.name}: PortFast без BPDU guard — підключений комутатор може створити петлю`, `interface ${i.name}\n spanning-tree bpduguard enable`);
      if (i.allowed && i.mode === "trunk") { const miss = [...new Set(access.filter(a => !a.shut).map(a => a.acc || 1).concat(access.filter(a => a.voice).map(a => a.voice)))].filter(v => v !== 1 && !i.allowed.includes(v));
        if (miss.length) add("warn", d, `${i.name}: у allowed vlan немає VLAN ${miss.join(", ")}, які використовують порти доступу цього комутатора`, `interface ${i.name}\n switchport trunk allowed vlan add ${miss.join(",")}`);
        if (i.native && i.native !== 1 && !i.allowed.includes(i.native)) add("info", d, `${i.name}: native VLAN ${i.native} не входить в allowed vlan`, "Це нормально лише як захід безпеки, якщо native не несе трафіку."); }
      if (i.dot1q != null && i.ip) { const par = d.ifs[i.name.split(".")[0]]; if (par && par.shut) add("err", d, `${i.name}: фізичний інтерфейс ${par.name} вимкнений — усі підінтерфейси теж не працюють`, `interface ${par.name}\n no shutdown`); }
      for (const [acl, dir] of i.acg || []) { if (!d.acls[acl]) add("warn", d, `${i.name}: ip access-group ${acl} ${dir} посилається на ACL, якого немає`, `Створіть ACL ${acl} або приберіть рядок (порожній ACL нічого не фільтрує).`); }
      if (i.fhrp && i.ip && i.len != null && netOf(i.fhrp.vip, i.len) !== netOf(i.ip, i.len)) add("err", d, `${i.name}: віртуальна IP ${i.fhrp.vip} не з підмережі інтерфейсу ${i.ip}/${i.len}`, "Віртуальна адреса має бути з тієї ж підмережі.");
      if (i.speed && i.duplex === "half") add("warn", d, `${i.name}: duplex half — можливі колізії й late collisions при full на іншому боці`, `interface ${i.name}\n duplex auto  (або full з обох боків)`);
    }
    const subs = I.filter(i => i.dot1q != null); const dupV = subs.map(i => i.dot1q).filter((v, k, a) => a.indexOf(v) !== k); if (dupV.length) add("err", d, `однаковий encapsulation dot1Q ${[...new Set(dupV)].join(", ")} на кількох підінтерфейсах`, "Кожен підінтерфейс — своя VLAN.");
    if (vb) for (const a of access) { if (a.acc && !vb[a.acc]) add("err", d, `${a.name}: access VLAN ${a.acc} не існує (немає в show vlan brief) — порт неактивний`, `vlan ${a.acc}\n name ...`); }
    const nat = [...new Set(trunks.map(t => t.native || 1))]; if (nat.length > 1) add("info", d, `trunk-порти мають різні native VLAN (${nat.join(", ")}) — перевірте, що на сусідах так само`, "Native VLAN має збігатися з обох боків лінку.");
    if (trunks.some(t => (t.native || 1) === 1)) add("info", d, "native VLAN 1 на trunk — рекомендують окрему невикористану VLAN", "switchport trunk native vlan 999");
    // EtherChannel
    const groups = {}; for (const i of I) if (i.ch) (groups[i.ch] = groups[i.ch] || []).push(i);
    for (const [g, mem] of Object.entries(groups)) { const k = x => [x.mode || "", x.acc || 1, x.native || 1, (x.allowed || []).join(","), x.speed || "", x.duplex || ""].join("|"); const modes = [...new Set(mem.map(x => x.chMode))];
      if (modes.length > 1) add("err", d, `Po${g}: члени мають різні режими (${modes.join(", ")})`, `interface range ...\n channel-group ${g} mode ${modes[0]}`);
      if (modes.some(m => ["active", "passive"].includes(m)) && modes.some(m => ["desirable", "auto"].includes(m))) add("err", d, `Po${g}: змішано LACP і PAgP`, "Один протокол на канал.");
      if (new Set(mem.map(k)).size > 1) add("err", d, `Po${g}: члени з різними параметрами (режим, VLAN, native, allowed, speed/duplex) — частину буде suspended`, "Налаштовуйте члени через interface range однаково, а trunk-параметри — на Port-channel.");
      if (mem.length < 2) add("info", d, `Po${g}: лише один член каналу`, "EtherChannel має сенс з 2+ лінками.");
      if (modes.length === 1 && modes[0] === "on") add("info", d, `Po${g}: режим on без узгодження — при помилці на іншому боці можлива петля`, `channel-group ${g} mode active`); }
    // маршрутизація між VLAN
    const svis = I.filter(i => /^Vlan\d/.test(i.name) && i.ip && !i.shut);
    if (svis.length >= 2 && !d.g.iprouting) add("err", d, `${svis.length} SVI з IP, але немає ip routing — маршрутизації між VLAN не буде`, "ip routing");
    if (d.sw && svis.length === 1 && !d.g.iprouting && !d.g.dgw) add("warn", d, "немає ip default-gateway — керувати комутатором з інших мереж не вийде", "ip default-gateway <IP шлюзу VLAN керування>");
    for (const v of I.filter(i => /^Vlan\d/.test(i.name) && i.ip && i.shut)) add("warn", d, `${v.name} вимкнено`, `interface ${v.name}\n no shutdown`);
    // DHCP
    for (const p of Object.values(d.pools)) { if (!p.net) continue; const len = maskLen(p.net[1]); if (len == null) { add("err", d, `пул ${p.name}: некоректна маска ${p.net[1]}`, ""); continue; }
      if (!p.gw) add("warn", d, `пул ${p.name}: немає default-router — клієнти не вийдуть за межі підмережі`, `ip dhcp pool ${p.name}\n default-router ...`);
      else { if (netOf(p.gw, len) !== netOf(p.net[0], len)) add("err", d, `пул ${p.name}: default-router ${p.gw} не з мережі ${p.net[0]}/${len}`, "Шлюз має бути в підмережі пулу.");
        const g = ip2n(p.gw); if (!d.excl.some(([a, b]) => g >= a && g <= b)) add("info", d, `пул ${p.name}: адресу шлюзу ${p.gw} не виключено (ip dhcp excluded-address)`, `ip dhcp excluded-address ${p.gw}`); }
      if (!p.dns) add("info", d, `пул ${p.name}: немає dns-server`, `ip dhcp pool ${p.name}\n dns-server ...`); }
    // ACL
    for (const [n, a] of Object.entries(d.acls)) { if (a.rules.length && a.rules.every(r => r.act === "deny")) add("err", d, `ACL ${n} містить лише deny — там, де його застосовано, неявний deny any заблокує весь трафік`, `access-list ${n} permit any  (або потрібний permit)`);
      for (const r of a.rules) { const w = (r.rest.match(/\b(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)/) || [])[2]; if (w && /^255\./.test(w)) add("warn", d, `ACL ${n}: «${r.act} ${r.rest}» — схоже на маску підмережі замість wildcard`, `Wildcard = інверсія маски, напр. 0.0.0.255 для /24.`); } }
    for (const v of d.vty) { if (v.cfg.some(c => /^transport input (all|telnet)/i.test(c)) || !v.cfg.some(c => /^transport input/i.test(c))) { add("warn", d, `line vty ${v.from} ${v.to}: ${v.cfg.some(c => /^transport input/i.test(c)) ? "дозволено Telnet" : "transport input не задано — на багатьох версіях IOS це дозволяє Telnet"}; паролі Telnet ідуть відкритим текстом`, `line vty ${v.from} ${v.to}\n transport input ssh\n login local`); break; } }
    for (const v of d.vty) for (const c of v.cfg) { const m = c.match(/^access-class (\S+) in/i); if (m && !d.acls[m[1]]) add("warn", d, `line vty: access-class ${m[1]} посилається на ACL, якого немає`, ""); }
    // NAT
    if (d.natIn.length) { if (!I.some(i => i.nat === "inside") || !I.some(i => i.nat === "outside")) add("err", d, "NAT налаштовано, але немає інтерфейсів ip nat inside і ip nat outside одночасно", "interface <LAN>\n ip nat inside\ninterface <WAN>\n ip nat outside");
      for (const r of d.natIn) if (r.acl && !d.acls[r.acl]) add("err", d, `ip nat inside source list ${r.acl}: ACL ${r.acl} не існує`, `access-list ${r.acl} permit <внутрішня мережа> <wildcard>`); }
    // статика
    const conn = I.filter(i => i.ip && i.len != null && !i.shut);
    if (!I.some(i => i.cfg.some(c => /^ip address dhcp/i.test(c)))) for (const r of d.routes) if (ip2n(r.nh) != null && !conn.some(i => netOf(r.nh, i.len) === netOf(i.ip, i.len))) add("info", d, `ip route ${r.net} ${r.mask} ${r.nh}: next hop не з жодної підключеної мережі (рекурсивний пошук або помилка в адресі)`, "Перевірте адресу next hop.");
    // OSPF
    if (d.ospf) { const o = d.ospf; const inOspf = i => i.ospfArea != null || o.nets.some(n => { const w = ip2n(n.wc); const nn = ip2n(n.net); return w != null && nn != null && ((ip2n(i.ip) & ~w) >>> 0) === ((nn & ~w) >>> 0); });
      for (const n of o.nets) if (ip2n(n.wc) != null && /^255\./.test(n.wc)) add("warn", d, `network ${n.net} ${n.wc}: схоже на маску замість wildcard`, "Wildcard = інверсія маски, напр. 0.0.0.3 для /30.");
      for (const i of conn) { i._ospf = inOspf(i); i._passive = o.passDef ? !(o.noPass || []).includes(i.name) : o.passive.includes(i.name); }
      if (!o.rid && !I.some(i => /^Lo/.test(i.name) && i.ip)) add("info", d, "OSPF без router-id і loopback — ID обиратиметься за найбільшою IP активного інтерфейсу й може змінитися", `router ospf ${o.pid}\n router-id X.X.X.X`); }
    // DNS-подібні дрібниці
    if (d.sw) { const unused = I.filter(i => /^(Fa|Gi)\d\/\d+$/.test(i.name) && !i.cfg.length); if (unused.length >= 3) add("info", d, `${unused.length} портів без налаштувань і не вимкнено (${unused.slice(0, 4).map(x => x.name).join(", ")}…)`, "interface range ...\n switchport mode access\n switchport access vlan 999\n shutdown"); }
  }
  // ---- між пристроями: спільні підмережі ----
  const byNet = {}; for (const d of devs) for (const i of Object.values(d.ifs)) if (i.ip && i.len != null) { const k8 = netOf(i.ip, Math.min(i.len, 24)); (byNet[k8] = byNet[k8] || []).push([d, i]); }
  for (const arr of Object.values(byNet)) for (let a = 0; a < arr.length; a++) for (let b = a + 1; b < arr.length; b++) { const [d1, i1] = arr[a], [d2, i2] = arr[b]; if (d1 === d2) continue;
    const short = Math.min(i1.len, i2.len); if (netOf(i1.ip, short) !== netOf(i2.ip, short)) continue;
    if (i1.ip === i2.ip) add("err", null, `дублікат IP ${i1.ip}: ${d1.host} ${i1.name} і ${d2.host} ${i2.name}`, "Кожен інтерфейс — унікальна адреса.");
    if (i1.len !== i2.len) add("err", null, `різні маски на спільній мережі: ${d1.host} ${i1.name} /${i1.len} і ${d2.host} ${i2.name} /${i2.len}`, "Маска має збігатися — інакше OSPF-сусідство не встановиться, а частина адрес буде недосяжна.");
    if (i1.fhrp && i2.fhrp && i1.fhrp.g === i2.fhrp.g && i1.fhrp.vip !== i2.fhrp.vip) add("err", null, `${i1.fhrp.p} ${i1.fhrp.g}: різні віртуальні IP (${d1.host} ${i1.fhrp.vip}, ${d2.host} ${i2.fhrp.vip})`, "Віртуальна IP однакова на всіх членах групи.");
    if (i1.fhrp && i2.fhrp && i1.fhrp.g !== i2.fhrp.g) add("warn", null, `${d1.host} і ${d2.host} на одній мережі мають різні номери груп ${i1.fhrp.p} (${i1.fhrp.g} і ${i2.fhrp.g})`, "Номер групи має збігатися.");
    if (i1.fhrp && i2.fhrp && (i1.fhrpPrio || 100) === (i2.fhrpPrio || 100) && i1.fhrp.p === "standby") add("info", null, `HSRP ${i1.fhrp.g}: однакові пріоритети на ${d1.host} і ${d2.host} — active визначить більша IP`, "Задайте пріоритет 110 і preempt на основному.");
    if (d1.ospf && d2.ospf && i1._ospf && i2._ospf && i1.len === i2.len) { const ar = (d, i) => i.ospfArea != null ? i.ospfArea : (d.ospf.nets.find(n => { const w = ip2n(n.wc); return ((ip2n(i.ip) & ~w) >>> 0) === ((ip2n(n.net) & ~w) >>> 0); }) || {}).area;
      const na = x => x == null ? "?" : /\./.test(x) ? String(ip2n(x)) : String(+x); const A1 = ar(d1, i1), A2 = ar(d2, i2); if (na(A1) !== na(A2)) add("err", null, `OSPF: різні області на лінку ${d1.host} ${i1.name} (area ${A1}) — ${d2.host} ${i2.name} (area ${A2})`, "Область на обох кінцях лінку має збігатися.");
      if ((i1.hello || 10) !== (i2.hello || 10) || (i1.dead || (i1.hello || 10) * 4) !== (i2.dead || (i2.hello || 10) * 4)) add("err", null, `OSPF: різні hello/dead на ${d1.host} ${i1.name} і ${d2.host} ${i2.name}`, "ip ospf hello-interval і dead-interval мають збігатися.");
      if ((i1.mtu || 1500) !== (i2.mtu || 1500)) add("err", null, `OSPF: різний MTU (${i1.mtu || 1500} і ${i2.mtu || 1500}) — сусіди застрягнуть в EXSTART/EXCHANGE`, "Вирівняйте ip mtu.");
      for (const [d, i] of [[d1, i1], [d2, i2]]) if (i._passive) add("err", null, `OSPF: ${d.host} ${i.name} passive, але з іншого боку ${(d === d1 ? d2 : d1).host} теж OSPF — сусідства не буде`, `router ospf ${d.ospf.pid}\n no passive-interface ${i.name}`);
      if (i1.ospfPrio === 0 && i2.ospfPrio === 0) add("err", null, `OSPF: обидва ${d1.host} і ${d2.host} з priority 0 на спільній мережі — немає DR, сусідство не дійде до FULL`, "Хоча б один маршрутизатор з priority > 0."); }
    else if (d1.ospf && d2.ospf && (i1._ospf !== i2._ospf) && i1.len === i2.len) add("warn", null, `OSPF увімкнено лише з одного боку лінку: ${i1._ospf ? d1.host + " " + i1.name : d2.host + " " + i2.name}`, "Додайте network для цієї мережі на іншому маршрутизаторі."); }
  const rids = devs.filter(d => d.ospf && d.ospf.rid).map(d => [d.host, d.ospf.rid]); for (const [h, r] of rids) { const same = rids.filter(x => x[1] === r); if (same.length > 1 && same[0][0] === h) add("err", null, `однаковий OSPF router-id ${r}: ${same.map(x => x[0]).join(", ")}`, "router-id має бути унікальним."); }
  const helpers = devs.flatMap(d => Object.values(d.ifs).flatMap(i => (i.helper || []).map(h => [d, i, h]))); const allIps = new Set(devs.flatMap(d => Object.values(d.ifs).map(i => i.ip).filter(Boolean)));
  const poolDevs = devs.filter(d => Object.keys(d.pools).length); for (const d of poolDevs) for (const p of Object.values(d.pools)) { if (!p.net) continue; const len = maskLen(p.net[1]); const local = Object.values(d.ifs).some(i => i.ip && i.len === len && netOf(i.ip, len) === netOf(p.net[0], len));
    if (!local && !helpers.length && devs.length > 1) add("warn", d, `пул ${p.name} (${p.net[0]}) обслуговує віддалену мережу, але жоден інтерфейс не має ip helper-address`, "На інтерфейсі-шлюзі клієнтів: ip helper-address <IP DHCP-сервера>"); }
  for (const [d, i, h] of helpers) if (devs.length > 1 && poolDevs.length && !allIps.has(h)) add("info", d, `${i.name}: ip helper-address ${h} не збігається з жодною адресою вставлених пристроїв`, "Перевірте адресу DHCP-сервера.");
  return { devs, F, sec: devs.map(ccSecurity), vb };
}
// ---- захищеність: чекліст у стилі CIS ----
function ccSecurity(d) { const g = d.g; const vty = d.vty; const vtyHas = re => vty.length && vty.every(v => v.cfg.some(c => re.test(c)));
  const tIn = vty.flatMap(v => v.cfg.filter(c => /^transport input/i.test(c))); const acc = Object.values(d.ifs).filter(i => i.mode === "access"); const trunks = Object.values(d.ifs).filter(i => i.mode === "trunk");
  const C = [["enable secret (а не enable password)", !!g.esecret && !g.epass], ["service password-encryption", !!g.spe], ["Користувачі з secret, без паролів відкритим текстом", d.users.length > 0 && d.users.every(u => u.secret)],
    ["ip ssh version 2", !!g.ssh2], ["VTY: лише SSH (transport input ssh)", tIn.length > 0 && tIn.every(c => /transport input ssh$/i.test(c))], ["VTY: login local або AAA", vtyHas(/^login local|^login authentication/i) || !!g.aaa],
    ["VTY: access-class (доступ лише з мережі керування)", vtyHas(/^access-class/i)], ["exec-timeout задано й не 0 0", vty.length > 0 && vtyHas(/^exec-timeout (?!0 0)/i)], ["Вимкнено ip http server", !g.http], ["Банер (banner motd/login)", !!g.banner],
    ["Журнали на syslog-сервер", !!g.syslog], ["NTP", !!g.ntp]];
  if (d.sw) C.push(["PortFast-порти з BPDU guard", !Object.values(d.ifs).some(i => i.pf && !i.bg) || !!g.bgDef], ["Port security на портах доступу", acc.length > 0 && acc.filter(i => i.ps).length >= acc.length * 0.8],
    ["DHCP snooping", !!g.snoop], ["Native VLAN не 1 на trunk", !trunks.length || trunks.every(t => (t.native || 1) !== 1)], ["Trunk без DTP (nonegotiate)", !trunks.length || trunks.every(t => t.noneg)],
    ["Невикористані порти вимкнено", Object.values(d.ifs).filter(i => /^(Fa|Gi)\d\/\d+$/.test(i.name) && !i.cfg.length).length === 0]);
  return { host: d.host, items: C, score: C.filter(x => x[1]).length, n: C.length }; }
// ---- синтаксис через симулятор ----
function ccSyntax(lines) { if (!window.CLI) return []; const sw = lines.some(l => /^switchport|^vlan \d|spanning-tree/i.test(l.trim())); const s = CLI.Session(CLI.newState({ hostname: "X", router: !sw, l3: sw && lines.some(l => /^ip routing/i.test(l.trim())) })); s.exec("enable"); s.exec("configure terminal"); const bad = []; let ban = null;
  for (const l of lines) { const t = l.trim(); if (ban) { if (t.includes(ban)) ban = null; continue; } const bm = t.match(/^banner \S+ (\S)(.*)$/i); if (bm) { if (!bm[2].includes(bm[1])) ban = bm[1]; continue; } if (!t || /^(!|end$|version |Building|Current configuration|boot-|service timestamps|license|no service pad|memory-size|spanning-tree extend|redundancy|crypto pki|certificate|quit)/i.test(t)) continue;
    let o = ""; try { o = s.exec(t); } catch (e) { o = "% " + e.message; } if (/% (Invalid|Incomplete|Ambiguous)/.test(o)) bad.push(t); } return bad; }
// ---- екран ----
let CCV = null;
const CC_SAMPLE = `hostname S1
!
spanning-tree mode rapid-pvst
!
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
!
interface FastEthernet0/2
 switchport access vlan 20
 switchport port-security maximum 2
!
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,99
 channel-group 1 mode active
!
interface GigabitEthernet0/2
 switchport mode trunk
 channel-group 1 mode on
!
interface Vlan99
 ip address 192.168.99.11 255.255.255.0
!
line vty 0 4
 password cisco
 login
 transport input all
!
===
hostname R1
!
interface GigabitEthernet0/0
 ip address 10.0.12.1 255.255.255.252
 ip ospf hello-interval 5
!
interface GigabitEthernet0/1
 ip address 192.168.10.1 255.255.255.0
!
router ospf 1
 network 10.0.12.0 0.0.0.3 area 0
 network 192.168.10.0 0.0.0.255 area 0
!
access-list 10 deny 192.168.20.0 0.0.0.255
!
===
hostname R2
!
interface GigabitEthernet0/0
 ip address 10.0.12.2 255.255.255.252
!
router ospf 1
 network 10.0.12.0 0.0.0.3 area 1
`;
const CC_SEV = { err: ["❌", "Помилка", "var(--bad)"], warn: ["⚠️", "Попередження", "var(--warn)"], info: ["ℹ️", "Порада", "var(--muted)"] };
function ccResultHtml(R, syntax) { const by = s => R.F.filter(f => f.sev === s);
  return `<div class="card"><h2>Результат <span class="small muted">${R.devs.length} пристр. · ❌ ${by("err").length} · ⚠️ ${by("warn").length} · ℹ️ ${by("info").length}</span></h2>
    ${R.F.length ? ["err", "warn", "info"].map(s => by(s).map(f => `<div class="kv" style="align-items:flex-start"><span>${CC_SEV[s][0]} <b>${esc(f.dev)}</b>: ${esc(f.msg)}${f.fix ? `<pre class="small" style="margin:4px 0 0;white-space:pre-wrap">${esc(f.fix)}</pre>` : ""}</span></div>`).join("")).join("") : `<p class="small">Помилок не знайдено ✅</p>`}
    ${R.vb ? `<p class="small muted" style="margin:6px 0 0">Враховано show vlan brief: ${Object.keys(R.vb).length} VLAN.</p>` : `<p class="small muted" style="margin:6px 0 0">VLAN не зберігаються в running-config на Catalyst — додайте show vlan brief, щоб перевірити, чи існують access VLAN.</p>`}</div>
  ${R.sec.map(s => `<div class="card"><h2>🛡 Захищеність ${esc(s.host)} <span class="small muted">${s.score}/${s.n}</span></h2><div class="progress"><i style="width:${Math.round(s.score / s.n * 100)}%"></i></div><ul class="checklist small">${s.items.map(([t, ok]) => `<li>${ok ? "✅" : "❌"} ${esc(t)}</li>`).join("")}</ul></div>`).join("")}
  ${syntax ? `<div class="card"><h2>⌨ Синтаксис у симуляторі</h2>${syntax.map(([h, bad]) => `<p class="small" style="margin:4px 0"><b>${esc(h)}</b>: ${bad.length ? `симулятор не прийняв ${bad.length} рядк.` : "усі команди розпізнано ✅"}</p>${bad.length ? `<pre class="small" style="white-space:pre-wrap">${esc(bad.slice(0, 30).join("\n"))}</pre>` : ""}`).join("")}<p class="small muted" style="margin:0">Симулятор знає команди CCNA; службові рядки реального IOS (archive, crypto pki тощо) він може не знати — це не обов'язково помилка, але одруківки так видно одразу.</p></div>` : ""}`; }
VIEWS.confcheck = { html: () => { CCV = CCV || { text: lsGet(CC_LS, ""), res: null };
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🔍 Аналізатор конфігурацій</h2><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:6px 0">Вставте <code>show running-config</code> одного або кількох пристроїв (з Packet Tracer чи реального обладнання). Пристрої розділяються автоматично за рядком <code>hostname</code> або рядком <code>===</code>. Можна додати <code>show vlan brief</code>. Тренажер знайде помилки на кожному пристрої й між ними (спільні підмережі: маски, OSPF, HSRP), оцінить захищеність і перевірить синтаксис.</p>
    <textarea id="cctext" rows="12" style="width:100%;font-family:var(--mono,monospace);font-size:12px" placeholder="hostname S1&#10;!&#10;interface FastEthernet0/1&#10; switchport mode access …">${esc(CCV.text)}</textarea>
    <div class="row" style="margin-top:8px"><button class="primary" data-act="ccrun2">Перевірити</button><button data-act="ccsample">Приклад з помилками</button><button data-act="ccclear">Очистити</button></div>
    <p class="small muted" style="margin:6px 0 0">Конфігурація зберігається лише на цьому пристрої. Паролі й ключі краще замінити перед вставлянням.</p></div>
  ${CCV.res ? ccResultHtml(CCV.res, CCV.syntax) : ""}
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.confcheck = () => { view = "confcheck"; render(); scrollTop(); };
ACTS.ccrun2 = () => { const t = ($("#cctext") || {}).value || ""; CCV.text = t; lsSet(CC_LS, t.length < 60000 ? t : ""); CCV.res = ccCheck(t); CCV.syntax = CCV.res.devs.map(d => [d.host, ccSyntax(d.lines)]); render(); const el = document.querySelectorAll(".card")[1]; if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); };
ACTS.ccsample = () => { CCV.text = CC_SAMPLE; CCV.res = null; render(); };
ACTS.ccclear = () => { CCV.text = ""; CCV.res = null; lsSet(CC_LS, ""); render(); };
