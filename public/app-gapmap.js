"use strict";
// Карта прогалин Obsidian: які поняття CCNA мають нотатку у vault, які мають SR-картки, а де нотатка є, але точність у тренажері низька.
// Джерела назв нотаток: дерево GitHub-репозиторію vault (як в імпорті), файли, з яких імпортовано картки, або вставлений список назв.
const GAP_LS = "ccna.gap.notes";
const GAP_C = [ // [поняття, тема, regex для назви нотатки]
  ["Моделі OSI і TCP/IP, інкапсуляція", "ITN3", /osi|tcp\/?ip.?mod|інкапсул|encapsul|pdu/i], ["Ethernet-кадр і MAC-адреси", "ITN7", /ethernet|mac.?(адрес|address|table|таблиц)|frame|кадр/i],
  ["ARP", "ITN9", /\barp\b/i], ["IPv4 і підмережі", "ITN11", /ipv4|subnet|підмереж|cidr|маск/i], ["VLSM", "ITN11", /vlsm/i], ["IPv6-адресація", "ITN12", /ipv6|eui-?64|link.?local/i],
  ["TCP і UDP", "ITN14", /\btcp\b|\budp\b|handshake|рукостискан/i], ["DNS", "ITN15", /\bdns\b/i], ["Базова безпека пристрою (SSH, паролі)", "SRWE1", /\bssh\b|enable secret|password|парол|basic.?config|базов.*налашт/i],
  ["Принципи комутації", "SRWE2", /switching.?concept|комутац|forwarding|cut.?through|store.?and/i], ["VLAN", "SRWE3", /\bvlan(?!.?inter)/i], ["Trunk і 802.1Q", "SRWE3", /trunk|802\.1q|native/i], ["DTP", "SRWE3", /\bdtp\b/i],
  ["Inter-VLAN routing (ROAS, SVI)", "SRWE4", /inter.?vlan|router.?on.?a.?stick|roas|\bsvi\b/i], ["STP і вибір root", "SRWE5", /\bstp\b|spanning|root.?bridge/i], ["RSTP, PortFast, BPDU Guard", "SRWE5", /rstp|portfast|bpdu/i],
  ["EtherChannel (LACP/PAgP)", "SRWE6", /etherchannel|lacp|pagp|port.?channel/i], ["DHCPv4", "SRWE7", /dhcp(?!v6)/i], ["SLAAC і DHCPv6", "SRWE8", /slaac|dhcpv6|\bra\b.?(guard|flag)|ndp/i],
  ["FHRP / HSRP", "SRWE9", /hsrp|fhrp|vrrp|glbp/i], ["Атаки LAN і AAA", "SRWE10", /aaa|radius|tacacs|802\.1x|атак|attack/i], ["Port security", "SRWE11", /port.?security|sticky/i], ["DHCP snooping і DAI", "SRWE11", /snooping|\bdai\b|arp.?inspect/i],
  ["Wi-Fi: стандарти й канали", "SRWE12", /802\.11|wi.?fi|wlan|канал|channel.?(2\.4|5)|ssid/i], ["WLC, CAPWAP, режими AP", "SRWE13", /wlc|capwap|lightweight|flexconnect|access.?point/i], ["WPA2/WPA3", "SRWE12", /wpa|psk|sae/i],
  ["Таблиця маршрутизації, AD і метрика", "SRWE14", /routing.?table|таблиц.*маршрут|administrative.?dist|\bad\b|longest.?match/i], ["Статичні й default маршрути", "SRWE15", /static.?rout|статичн|default.?route|floating/i],
  ["OSPF: сусідство, DR/BDR", "ENSA1", /ospf.*(neighbor|сусід|dr|bdr|adjacen)|\bdr\b.?bdr/i], ["OSPF: налаштування", "ENSA2", /ospf/i], ["ACL: стандартні й розширені", "ENSA5", /\bacl\b|access.?list/i], ["Wildcard-маски", "ENSA4", /wildcard/i],
  ["NAT / PAT", "ENSA6", /\bnat\b|\bpat\b|overload/i], ["WAN і VPN, IPsec", "ENSA8", /vpn|ipsec|\bwan\b|gre/i], ["QoS", "ENSA9", /qos|dscp|queu|черг/i], ["NTP, Syslog, SNMP", "ENSA10", /ntp|syslog|snmp/i],
  ["CDP / LLDP", "ENSA10", /cdp|lldp/i], ["Проєктування мережі (2-/3-tier, spine-leaf)", "ENSA11", /tier|spine|leaf|campus|hierarch|ієрарх/i], ["Віртуалізація і контейнери", "ENSA13", /virtual|hypervisor|контейнер|container|docker|\bvm\b/i],
  ["SDN, контролери, REST API", "ENSA14", /sdn|controller|rest.?api|\bapi\b|dna.?center|catalyst.?center/i], ["JSON / YAML", "ENSA14", /json|yaml/i], ["Ansible, Terraform, автоматизація", "ENSA14", /ansible|terraform|puppet|chef|automat|автоматиз/i],
  ["Генеративний ШІ і промпти (v2.0)", "ENSA14", /\bai\b|\bшi\b|ші\b|llm|prompt|промпт|agentic|machine.?learn/i], ["Extended ping / traceroute", "SRWE16", /extended.?ping|traceroute|tracert|ping/i]];
let GAPV = { f: "all", msg: "" };
function gapNotes() { const saved = lsGet(GAP_LS, { names: [], src: "", ts: 0 }); const fromCards = [...new Set(customQs.filter(q => q.src === "n" && q.file).map(q => String(q.file)))]; const seen = new Set(), names = []; for (const n of saved.names.concat(fromCards)) { const b = gapBase(n).toLowerCase(); if (!seen.has(b)) { seen.add(b); names.push(n); } } return { names, saved, fromCards }; }
const gapBase = n => String(n).split("/").pop().replace(/\.md$/i, "");
function gapCompute() { const { names } = gapNotes(); const cards = customQs.filter(q => q.src === "n");
  const rows = GAP_C.map(([c, t, re]) => { const notes = names.filter(n => re.test(gapBase(n)) || re.test(n)); const cc = cards.filter(q => re.test(gapBase(q.file || "")) || (q.t === t && re.test(q.q + " " + (q.ans || "")))).length; const r = topicReady(t) || { p: 0, n: 0, seen: 0 };
    const acc = r.seen >= 5 ? r.p : null; let st; if (!notes.length) st = "none"; else if (!cc) st = "nocards"; else if (acc != null && acc < 0.6) st = "weak"; else if (acc == null) st = "unseen"; else st = "ok";
    return { c, t, notes, cards: cc, acc, st }; });
  const by = s => rows.filter(r => r.st === s).length; return { rows, names, sum: { none: by("none"), nocards: by("nocards"), weak: by("weak"), unseen: by("unseen"), ok: by("ok") } }; }
const GAP_ST = { none: ["🕳", "Немає нотатки", "var(--bad)"], nocards: ["📝", "Нотатка без карток", "var(--warn)"], weak: ["⚠", "Нотатка є, точність низька", "var(--bad)"], unseen: ["👀", "Ще не тренувались", "var(--muted)"], ok: ["✅", "Покрито", "var(--ok)"] };
function gapMd(G) { const L = ["---", "tags: [ccna, moc, gaps]", "updated: " + dkey(), "---", "# Карта прогалин CCNA", "", `Нотаток у vault: ${G.names.length}. Поняття: ✅ ${G.sum.ok} · 🕳 ${G.sum.none} · 📝 ${G.sum.nocards} · ⚠ ${G.sum.weak}`, ""];
  for (const s of ["none", "weak", "nocards", "unseen", "ok"]) { const rs = G.rows.filter(r => r.st === s); if (!rs.length) continue; L.push("## " + GAP_ST[s][0] + " " + GAP_ST[s][1], "");
    for (const r of rs) L.push(`- [ ] ${s === "none" ? `[[${r.t} ${r.c.replace(/[\/\\:#|\[\]^]/g, " ").replace(/\s+/g, " ").trim()}]]` : r.c} — ${r.t}${r.notes.length ? " · нотатки: " + r.notes.slice(0, 3).map(n => `[[${gapBase(n)}]]`).join(", ") : ""}${r.acc != null ? ` · точність ${Math.round(r.acc * 100)}%` : ""}${s === "nocards" ? " · додайте 3–5 карток `питання::відповідь`" : ""}`);
    L.push(""); } return L.join("\n"); }
VIEWS.gapmap = { html: () => { const G = gapCompute(); const { saved, fromCards } = gapNotes(); const ord = ["weak", "none", "nocards", "unseen", "ok"]; const rows = GAPV.f === "all" ? G.rows.slice().sort((a, b) => ord.indexOf(a.st) - ord.indexOf(b.st)) : G.rows.filter(r => r.st === GAPV.f);
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🧭 Карта прогалин Obsidian</h2><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:6px 0">Порівнюю ${GAP_C.length} понять CCNA з назвами нотаток у vault, SR-картками, імпортованими з Obsidian, і вашою точністю в тренажері. Нотаток відомо: <b>${G.names.length}</b> (${saved.names.length} з репозиторію/списку${saved.ts ? ", " + new Date(saved.ts).toLocaleDateString("uk-UA") : ""}, ${fromCards.length} з імпортованих карток).</p>
    <div class="chips">${[["all", "Усі " + G.rows.length]].concat(Object.keys(GAP_ST).map(k => [k, GAP_ST[k][0] + " " + GAP_ST[k][1] + " " + G.sum[k]])).map(([k, t]) => `<button class="seg ${GAPV.f === k ? "on" : ""}" data-act="gapf" data-f="${k}">${esc(t)}</button>`).join("")}</div>
    <table class="small" style="width:100%;border-collapse:collapse;margin-top:8px"><tr class="muted"><th align="left">Поняття</th><th align="left">Тема</th><th>Нотатки</th><th>Картки</th><th>Точність</th></tr>
    ${rows.map(r => `<tr style="border-top:1px solid var(--line)"><td><span style="color:${GAP_ST[r.st][2]}">${GAP_ST[r.st][0]}</span> ${esc(r.c)}${r.notes.length ? `<div class="muted" style="font-size:11px">${r.notes.slice(0, 2).map(n => esc(gapBase(n))).join(" · ")}${r.notes.length > 2 ? " …" : ""}</div>` : ""}</td><td>${esc(r.t)}</td><td align="center">${r.notes.length}</td><td align="center">${r.cards}</td><td align="center" style="color:${r.acc == null ? "var(--muted)" : r.acc >= 0.75 ? "var(--ok)" : r.acc >= 0.6 ? "var(--warn)" : "var(--bad)"}">${r.acc == null ? "—" : Math.round(r.acc * 100) + "%"}</td></tr>`).join("")}</table>
    <div class="row" style="margin-top:10px"><button class="primary" data-act="gapmd">⬇ Карта прогалин.md</button>${G.sum.weak + G.sum.none ? `<button data-act="gaptrain">Тренувати слабкі теми</button>` : ""}</div></div>
  <div class="card"><h2>Звідки взяти назви нотаток</h2>
    <div class="row"><button data-act="gapgh" ${opts.obRepo ? "" : "disabled"}>🐙 Прочитати дерево ${esc(opts.obRepo || "репозиторію")}</button><span class="small muted" id="gapmsg">${esc(GAPV.msg || (opts.obRepo ? "" : "Спершу вкажіть репозиторій у розділі «Імпорт з Obsidian»"))}</span></div>
    <p class="small muted" style="margin:8px 0 4px">Або вставте список назв (по одній на рядок; у Obsidian: панель файлів → виділити все → скопіювати, або <code>ls -R</code> у теці vault):</p>
    <textarea id="gaplist" rows="4" style="width:100%;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px" placeholder="CCNA/SRWE/STP root bridge.md&#10;EtherChannel LACP.md"></textarea>
    <div class="row" style="margin-top:6px"><button class="mini" data-act="gappaste">Додати зі списку</button>${saved.names.length ? `<button class="mini ghost" data-act="gapclear">Очистити збережені назви</button>` : ""}</div></div>
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.gapmap = () => { view = "gapmap"; render(); scrollTop(); };
ACTS.gapf = el => { GAPV.f = el.dataset.f; render(); };
ACTS.gapmd = () => saveDownload("Карта прогалин CCNA.md", gapMd(gapCompute()), "text/markdown;charset=utf-8");
ACTS.gappaste = () => { const t = (($("#gaplist") || {}).value || "").split(/\r?\n/).map(x => x.trim()).filter(x => x && !/^\.|\/\.(obsidian|trash)\//.test(x)); if (!t.length) return; const s = lsGet(GAP_LS, { names: [] }); s.names = [...new Set(s.names.concat(t))].slice(0, 5000); s.ts = Date.now(); s.src = "paste"; lsSet(GAP_LS, s); GAPV.msg = "Додано " + t.length + " назв"; render(); };
ACTS.gapclear = () => { lsSet(GAP_LS, { names: [], src: "", ts: 0 }); GAPV.msg = ""; render(); };
ACTS.gapgh = async () => { const m = $("#gapmsg"); const say = t => { GAPV.msg = t; if (m) m.textContent = t; };
  try { const repo = opts.obRepo; const tok = (() => { try { return localStorage.getItem(GH_TOK) || ""; } catch (e) { return ""; } })(); say("Читаю дерево…"); let br = opts.obBranch; if (!br) br = (await ghJson("https://api.github.com/repos/" + repo, tok)).default_branch;
    const tree = await ghJson("https://api.github.com/repos/" + repo + "/git/trees/" + encodeURIComponent(br) + "?recursive=1", tok); const pre = (opts.obPath || "").replace(/^\/|\/$/g, "");
    const names = (tree.tree || []).filter(x => x.type === "blob" && /\.md$/i.test(x.path) && (!pre || x.path.startsWith(pre + "/")) && !/(^|\/)\.(obsidian|trash)\//.test(x.path)).map(x => x.path);
    lsSet(GAP_LS, { names, src: "gh", ts: Date.now() }); say("Знайдено " + names.length + " нотаток"); render(); } catch (e) { say("Помилка: " + e.message); } };
ACTS.gaptrain = () => { const G = gapCompute(); const ts = [...new Set(G.rows.filter(r => r.st === "weak" || r.st === "none").map(r => r.t))]; if (!ts.length) return; const L = pickTraining(new Set(ts), opts.train || 20); if (!L.length) return; startSession("train", L, "🧭 Прогалини з карти Obsidian"); };
