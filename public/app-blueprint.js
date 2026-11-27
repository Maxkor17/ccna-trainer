"use strict";
// Карта покриття іспиту CCNA 200-301 (v1.1 — до 02.02.2027, v2.0 — з 03.02.2027) і прогноз здачі.
// Кожна тема blueprint прив'язана до модулів тренажера (t) і, де модуль спільний для кількох тем, до ключових слів (re).
// also: [[модуль, regex]] — додаткові модулі, з яких беруться лише питання/лаби з цими словами.
// Переліки тем звірено з офіційними матеріалами Cisco (листопад 2026).
const BP_SWITCH = "2027-02-03";
const BLUEPRINTS = {
  "v1.1": { name: "CCNA 200-301 v1.1", until: "до 02.02.2027", domains: [
    { id: "1", n: "Network Fundamentals", ua: "Основи мереж", w: .20, items: [
      ["1.1", "Ролі пристроїв: маршрутизатори, L2/L3-комутатори, NGFW/IPS, AP і WLC, PoE", ["ITN1", "ENSA11", "ENSA3", "SRWE12"], /firewall|IPS|IDS|PoE|точк\w* доступу|\bAP\b|WLC|контролер|L3|multilayer|багаторівнев|роль/i],
      ["1.2", "Архітектури: 2/3-рівнева, spine-leaf, WAN, SOHO, on-prem і хмара", ["ENSA11", "ENSA7", "ENSA13", "ITN1"], /рівнев|tier|spine|leaf|ядр|core|collapsed|WAN|SOHO|хмар|cloud|топологі/i],
      ["1.3", "Інтерфейси й кабелі: SMF/MMF, мідь, shared vs point-to-point", ["ITN4", "ITN6"], /волок|fiber|fibre|оптич|мідн|UTP|STP-кабел|кабел|multimode|single-mode|одномод|багатомод|SMF|MMF|shared|спільн/i],
      ["1.4", "Проблеми інтерфейсів: колізії, помилки, duplex і speed", ["ITN4", "ITN7", "SRWE1", "ENSA12"], /коліз|collision|CRC|runt|giant|duplex|дуплекс|speed|швидк|помилк|error/i],
      ["1.5", "TCP і UDP", ["ITN14"]],
      ["1.6", "IPv4-адресація й підмережі", ["ITN11"]],
      ["1.7", "Приватні IPv4-адреси", ["ITN11", "ENSA6"], /приватн|private|RFC ?1918|10\.0\.0\.0|172\.16|192\.168\.0\.0/i],
      ["1.8", "IPv6-адресація й префікс", ["ITN12", "SRWE8"]],
      ["1.9", "Типи IPv6: GUA, ULA, link-local, anycast, multicast, EUI-64", ["ITN12"], /GUA|global unicast|глобальн|ULA|unique local|link-local|FE80|anycast|multicast|FF0|EUI/i],
      ["1.10", "IP-параметри на Windows, macOS, Linux", ["ITN2", "ITN13", "ITN17", "LNX3"], /ipconfig|ifconfig|ip addr|\bip a\b|netstat|nslookup|Windows|macOS|Linux|traceroute|tracert/i],
      ["1.11", "Бездротові принципи: канали, SSID, RF, шифрування", ["SRWE12"]],
      ["1.12", "Віртуалізація: сервери, контейнери, VRF", ["ENSA13"], /гіпервізор|hypervisor|віртуал|virtual|\bVM\b|контейнер|container|VRF/i],
      ["1.13", "Комутація: MAC learning/aging, flooding, MAC-таблиця", ["ITN7", "SRWE2"], /MAC|flood|лавин|комутац|таблиц|aging|store-and-forward|cut-through/i]] },
    { id: "2", n: "Network Access", ua: "Доступ до мережі", w: .20, items: [
      ["2.1", "VLAN: access, data/voice, default, inter-VLAN", ["SRWE3", "SRWE4"]],
      ["2.2", "Trunk, 802.1Q, native VLAN", ["SRWE3", "SRWE4"], /trunk|транк|802\.1Q|native|DTP|тег/i],
      ["2.3", "CDP і LLDP", ["ENSA10", "SRWE1"], /CDP|LLDP/i],
      ["2.4", "EtherChannel (LACP) L2/L3", ["SRWE6"]],
      ["2.5", "Rapid PVST+: root, ролі й стани, PortFast, root/loop guard, BPDU filter/guard", ["SRWE5"], null, [["SRWE11", /BPDU|PortFast|root guard|loop guard/i]]],
      ["2.6", "Бездротові архітектури й режими AP", ["SRWE12"], /автоном|autonomous|lightweight|CAPWAP|FlexConnect|режим|mode|Meraki|WLC|split-MAC|monitor|sniffer|bridge/i],
      ["2.7", "Підключення компонентів WLAN: AP, WLC, access/trunk, LAG", ["SRWE12", "SRWE13"], /LAG|trunk|порт|port|WLC|\bAP\b|CAPWAP|distribution/i],
      ["2.8", "Доступ до керування: консоль, Telnet, SSH, HTTP(S), TACACS+/RADIUS, хмара", ["SRWE1", "ITN2", "ENSA3", "SRWE10"], /console|консол|Telnet|SSH|HTTP|TACACS|RADIUS|AAA|vty|cloud|хмар/i],
      ["2.9", "GUI WLC: створення WLAN, безпека, QoS-профілі", ["SRWE13"]]] },
    { id: "3", n: "IP Connectivity", ua: "IP-зв'язність", w: .25, items: [
      ["3.1", "Таблиця маршрутизації: коди, префікс, next hop, AD, метрика, gateway of last resort", ["SRWE14"], null, [["SRWE16", /show ip route|таблиц|routing table/i]]],
      ["3.2", "Рішення пересилання: longest prefix, AD, метрика", ["SRWE14"], /найдовш|longest|\bAD\b|administrative|адміністративн|метрик|metric|префікс|prefix/i],
      ["3.3", "Статика IPv4/IPv6: default, network, host, floating", ["SRWE15", "SRWE16"]],
      ["3.4", "OSPFv2 в одній області: сусідство, p2p, broadcast, DR/BDR, router ID", ["ENSA1", "ENSA2"]],
      ["3.5", "FHRP: призначення й принципи", ["SRWE9"]]] },
    { id: "4", n: "IP Services", ua: "IP-сервіси", w: .10, items: [
      ["4.1", "Inside source NAT: static, pools", ["ENSA6"]],
      ["4.2", "NTP: client і server", ["ENSA10"], /NTP|stratum|час/i],
      ["4.3", "Роль DHCP і DNS", ["SRWE7"], null, [["ITN15", /DHCP|DNS/i]]],
      ["4.4", "SNMP", ["ENSA10"], /SNMP|MIB|trap|community/i],
      ["4.5", "Syslog: facilities, рівні", ["ENSA10"], /syslog|severity|рів(ень|ні)|logging|facility/i],
      ["4.6", "DHCP: клієнт і relay", ["SRWE7"], /relay|helper|клієнт|client|DORA|ipconfig/i],
      ["4.7", "QoS: класифікація, маркування, черги, policing, shaping", ["ENSA9"]],
      ["4.8", "SSH для віддаленого доступу", ["SRWE1", "ITN2"], /SSH|crypto|RSA|vty|transport input/i],
      ["4.9", "TFTP і FTP", ["ITN15", "ENSA10"], /TFTP|FTP/i]] },
    { id: "5", n: "Security Fundamentals", ua: "Основи безпеки", w: .15, items: [
      ["5.1", "Загрози, вразливості, експлойти, мітигація", ["ENSA3", "ITN16", "SRWE10"], /загроз|threat|вразлив|vulnerab|експлойт|exploit|атак|attack|malware|DoS|фішинг|phishing|spoof/i],
      ["5.2", "Програма безпеки: обізнаність, навчання, фізичний доступ", ["ENSA3", "ITN16"], /навчан|training|awareness|обізнан|фізичн|physical|політик|policy/i],
      ["5.3", "Доступ до пристроїв із локальними паролями", ["ITN2", "SRWE1", "SRWE10"], /пароль|password|secret|enable|login|username|service password/i],
      ["5.4", "Парольна політика: MFA, сертифікати, біометрія", ["ENSA3", "ITN16", "SRWE10"], /MFA|багатофактор|multifactor|сертифікат|certificate|біометр|biometr|складн|complex/i],
      ["5.5", "IPsec VPN: remote access і site-to-site", ["ENSA8"]],
      ["5.6", "ACL", ["ENSA4", "ENSA5"]],
      ["5.7", "Безпека L2: DHCP snooping, DAI, port security", ["SRWE11", "SRWE10"], /snooping|DAI|ARP inspection|port-security|port security|sticky|violation|VLAN hopping|spoof/i],
      ["5.8", "AAA: автентифікація, авторизація, облік", ["SRWE10", "ENSA3"], /AAA|authentication|authorization|accounting|автентиф|авториз|облік|RADIUS|TACACS|802\.1X/i],
      ["5.9", "WPA, WPA2, WPA3", ["SRWE12", "SRWE13"], /WPA|WEP|AES|TKIP|SAE|802\.1X|PSK|шифрув/i],
      ["5.10", "WLAN з WPA2-PSK у GUI", ["SRWE13"], /PSK|WPA2|WLAN|SSID/i]] },
    { id: "6", n: "Automation and Programmability", ua: "Автоматизація", w: .10, items: [
      ["6.1", "Вплив автоматизації на керування мережею", ["ENSA14"]],
      ["6.2", "Традиційні мережі vs контролерні", ["ENSA13", "ENSA14"], /контролер|controller|SDN|традиц|traditional|DNA/i],
      ["6.3", "SDN: overlay, underlay, fabric, площини, northbound/southbound API", ["ENSA13"], /SDN|overlay|underlay|fabric|plane|площин|northbound|southbound|API|ACI|OpenFlow/i],
      ["6.4", "Генеративний і предиктивний AI, ML в операціях", ["ENSA14", "ENSA13"], /\bAI\b|\bML\b|машинн|machine learning|генератив|generative|предиктив|predictive|ШІ/i],
      ["6.5", "REST API: автентифікація, CRUD, HTTP-дієслова, кодування", ["ENSA14"], /REST|API|CRUD|HTTP|GET|POST|PUT|DELETE|токен|token|Basic|OAuth|status/i],
      ["6.6", "Ansible і Terraform", ["ENSA14"], /Ansible|Terraform|Puppet|Chef|playbook|IaC|YAML/i],
      ["6.7", "JSON", ["ENSA14"], /JSON/i]] }] },
  "v2.0": { name: "CCNA 200-301 v2.0", until: "з 03.02.2027", domains: [
    { id: "1", n: "Network Infrastructure and Connectivity", ua: "Інфраструктура й підключення", w: .25, items: [
      ["1.1", "Діагностика інтерфейсів і кабелів (мідь, оптика): колізії, помилки, duplex/speed, відстань, сигнал, розпіновка", ["ITN4", "ITN7", "SRWE1", "ENSA12"], /коліз|collision|CRC|runt|giant|duplex|дуплекс|speed|швидк|помилк|error|кабел|cable|волок|fiber|оптич|pinout|розпін|сигнал|signal/i],
      ["1.2", "Гіпервізори, віртуальні машини, контейнери", ["ENSA13"], /гіпервізор|hypervisor|\bVM\b|віртуальн|virtual|контейнер|container|Docker/i, [["LNX6", /контейнер|container|Docker/i]]],
      ["1.3", "Діагностика IPv4: адресація, призначення, підмережі, публічні/приватні", ["ITN11"], null, [["ENSA6", /приватн|private|публічн|public/i]]],
      ["1.4", "Діагностика IPv6: адресація, префікси, unicast, EUI-64", ["ITN12", "SRWE8"]],
      ["1.5", "Бездротові принципи: діапазони й канали, RF, протоколи безпеки, завади", ["SRWE12"], null, [["SRWE13", /WPA|канал|channel|GHz|ГГц|RF|завад|interfer/i]]],
      ["1.6", "Підключення клієнтів (дротове й бездротове) на Windows, macOS, Linux", ["ITN13", "ITN17", "LNX3", "ITN2"], /ipconfig|ifconfig|ip addr|Windows|macOS|Linux|nslookup|tracert|traceroute|netsh|nmcli|клієнт|client/i],
      ["1.7", "Діагностика DHCPv4: клієнт, сервер, relay на IOS", ["SRWE7"]]] },
    { id: "2", n: "Switching and Network Access", ua: "Комутація й доступ", w: .25, items: [
      ["2.1", "Підключення switch–switch і switch–router: L2/L3-інтерфейси, 802.1Q trunk, LACP, SVI", ["SRWE3", "SRWE4", "SRWE6"]],
      ["2.2", "Порти до кінцевих вузлів: VLAN, PoE, LACP; ПК, принтери, IoT, AP, VoIP, віртуальні хости", ["SRWE3"], /access|voice|голос|PoE|телефон|phone|принтер|IoT/i, [["SRWE12", /\bAP\b|PoE|точк\w* доступу/i]]],
      ["2.3", "Перевірка документації через CDP і LLDP", ["ENSA10", "SRWE1"], /CDP|LLDP/i],
      ["2.4", "Діагностика L2/L3: show, ping, extended ping, traceroute, packet capture", ["ENSA12"], null, [["ITN13", /ping|traceroute|tracert/i], ["SRWE16", /ping|traceroute|show/i]]],
      ["2.5", "Rapid PVST+: root primary/secondary, ролі й стани, PortFast, root/loop/BPDU guard", ["SRWE5"], null, [["SRWE11", /BPDU|PortFast|root guard|loop guard/i]]]] },
    { id: "3", n: "IP Routing", ua: "IP-маршрутизація", w: .20, items: [
      ["3.1", "Таблиця маршрутизації: next hop, протокол, префікс, AD, метрика, default", ["SRWE14"], null, [["SRWE16", /show ip route|таблиц|routing table/i]]],
      ["3.2", "Діагностика статики IPv4/IPv6: default, network, host, floating", ["SRWE15", "SRWE16"]],
      ["3.3", "OSPFv2 і OSPFv3 в одній області: сусідство, p2p, DR/BDR, router ID", ["ENSA1", "ENSA2"]],
      ["3.4", "FHRP: стан HSRP і VRRP", ["SRWE9"]]] },
    { id: "4", n: "Network Services and Security", ua: "Сервіси й безпека", w: .20, items: [
      ["4.1", "Локальні користувачі й AAA-клієнт (TACACS+, RADIUS)", ["SRWE10", "ENSA3"], /username|AAA|TACACS|RADIUS|login local|802\.1X|автентиф|authentic/i, [["SRWE1", /username|login local/i]]],
      ["4.2", "Файли конфігурації й ПЗ: SFTP/SCP", ["ENSA10"], /SFTP|SCP|TFTP|FTP|copy|flash|образ|image|boot/i, [["ITN15", /FTP|SFTP|SCP/i]]],
      ["4.3", "NAT/PAT на IOS XE", ["ENSA6"]],
      ["4.4", "Діагностика DNS-записів: A, AAAA, CNAME, MX, NS, PTR", ["ITN15"], /DNS|запис|record|AAAA|CNAME|\bMX\b|PTR|\bNS\b/i, [["ENSA12", /DNS|імен|name/i]]],
      ["4.5", "IPsec VPN: протоколи й режими", ["ENSA8"]],
      ["4.6", "IPv4 ACL: standard, extended, numbered, named", ["ENSA4", "ENSA5"]],
      ["4.7", "Безпека L2: DHCP snooping, DAI, storm control, RA guard, port security", ["SRWE11"], null, [["SRWE10", /snooping|DAI|ARP inspection|storm|RA guard|port-security|port security/i]]]] },
    { id: "5", n: "AI, and Network Operations and Management", ua: "AI, операції й керування", w: .10, items: [
      ["5.1", "Роль агентного AI в мережевих операціях", ["ENSA14", "ENSA13"], /агент|agentic|\bAI\b|ШІ|асистент|assistant/i],
      ["5.2", "Промпти до GenAI для мережевих операцій (класифікація даних, формат, персона, інструкції)", ["ENSA14"], /промпт|prompt|GenAI|генератив|generative|LLM|персон|persona/i],
      ["5.3", "Підходи до керування: пристрій, хмара, контролер, автоматизація, IaC", ["ENSA13", "ENSA14"], /хмар|cloud|контролер|controller|SDN|IaC|Terraform|автоматиз|automation|DNA|Meraki/i],
      ["5.4", "SNMP в операціях", ["ENSA10"], /SNMP|MIB|trap|community/i],
      ["5.5", "Керування конфігурацією через Ansible", ["ENSA14"], /Ansible|playbook|YAML|IaC|Terraform/i],
      ["5.6", "Syslog: зміст повідомлень, рівні, facilities", ["ENSA10"], /syslog|severity|рів(ень|ні)|logging|facility|%[A-Z]+-\d/i]] }] }
};
// Ваги для симуляції іспиту: кожен модуль тренажера відноситься до одного домену.
const SIM_DOMAINS = {
  "v1.1": null, // див. DOMAINS в app-screens.js (той самий розподіл, що й раніше)
  "v2.0": [["Інфраструктура й підключення", .25, ["ITN4", "ITN11", "ITN12", "ITN13", "ITN17", "SRWE7", "SRWE8", "SRWE12", "SRWE13", "ENSA13"]],
    ["Комутація й доступ", .25, ["ITN7", "SRWE1", "SRWE2", "SRWE3", "SRWE4", "SRWE5", "SRWE6", "ENSA12"]], ["IP-маршрутизація", .20, ["SRWE9", "SRWE14", "SRWE15", "SRWE16", "ENSA1", "ENSA2"]],
    ["Сервіси й безпека", .20, ["ITN15", "ITN16", "SRWE10", "SRWE11", "ENSA3", "ENSA4", "ENSA5", "ENSA6", "ENSA8"]], ["AI, операції й керування", .10, ["ENSA10", "ENSA14"]]]
};
SIM_DOMAINS["v1.1"] = DOMAINS;
function bpVer() { if (opts.bp && opts.bp !== "auto") return opts.bp; if (opts.examDate) return opts.examDate >= BP_SWITCH ? "v2.0" : "v1.1"; return dkey() >= BP_SWITCH ? "v2.0" : (opts.bpGuess || "v2.0"); }
function bpItemMatch(it) { const [, , ts, re, also] = it; return (txt, t) => (ts.includes(t) && (!re || re.test(txt))) || (also || []).some(([at, ar]) => at === t && ar.test(txt)); }
function bpCoverage(ver) {
  const B = BLUEPRINTS[ver]; const qs = QB.map(q => ({ q, txt: textOf(q) })); const sc = ALLSCEN().map(s => ({ s, txt: s.title + " " + (s.task || []).join(" ") }));
  return B.domains.map(d => { const items = d.items.map(it => { const m = bpItemMatch(it); const mq = qs.filter(x => m(x.txt, x.q.t)).map(x => x.q); const ml = sc.filter(x => m(x.txt, x.s.t)).map(x => x.s);
      const seen = mq.filter(q => prog[q.id]); const ready = seen.length ? mq.reduce((a, q) => a + pKnow(q.id), 0) / mq.length : null; const labsDone = ml.filter(s => labs[s.id] && labs[s.id].ok).length;
      return { id: it[0], name: it[1], n: mq.length, seen: seen.length, ready, labs: ml.length, labsDone, ids: mq.map(q => q.id), tps: [...new Set(mq.map(q => q.t))] }; });
    const tot = items.reduce((a, x) => a + x.n, 0); const ready = tot ? items.reduce((a, x) => a + (x.ready == null ? 0.25 : x.ready) * x.n, 0) / tot : 0;
    return Object.assign({}, d, { items, ready, tot }); });
}
// Прогноз: зважена готовність доменів + результати симуляцій цієї версії (останні три важать більше).
function passForecast(ver) {
  const cov = bpCoverage(ver); const R = cov.reduce((a, d) => a + d.w * d.ready, 0); const fromBank = Math.round(300 + 700 * R);
  const sims = exams.filter(e => e.ccna && (e.bp || "v1.1") === ver && e.n >= 40).slice(0, 3); const simScore = sims.length ? Math.round(sims.reduce((a, e, i) => a + (300 + 700 * e.correct / e.n) * [3, 2, 1][i], 0) / [3, 2, 1].slice(0, sims.length).reduce((a, b) => a + b, 0)) : null;
  const score = simScore == null ? fromBank : Math.round(simScore * 0.65 + fromBank * 0.35); const p = 1 / (1 + Math.exp(-(score - 825) / 45));
  const seenShare = cov.reduce((a, d) => a + d.items.reduce((b, x) => b + x.seen, 0), 0) / Math.max(1, cov.reduce((a, d) => a + d.tot, 0));
  const weak = cov.filter(d => d.ready < 0.65).sort((a, b) => a.ready - b.ready);
  const gaps = cov.flatMap(d => d.items.map(x => Object.assign({ dom: d.id }, x))).filter(x => x.ready != null ? x.ready < 0.55 : x.n > 0).sort((a, b) => (a.ready == null ? -1 : a.ready) - (b.ready == null ? -1 : b.ready)).slice(0, 5);
  const conf = sims.length >= 2 && seenShare > 0.5 ? "висока" : sims.length || seenShare > 0.3 ? "середня" : "низька";
  const verdict = score >= 880 && weak.length === 0 ? "Готовий: можна реєструватися на іспит" : score >= 825 ? "Майже: прохідний бал є, але запасу мало" : score >= 750 ? "Ще ні: бракує 1–3 доменів" : "Ще ні: потрібна системна підготовка";
  return { ver, cov, score, fromBank, simScore, sims: sims.length, p, conf, weak, gaps, verdict, seenShare };
}
const pctC = x => x == null ? "var(--muted)" : x >= 0.75 ? "var(--ok)" : x >= 0.55 ? "var(--warn)" : "var(--bad)";
function forecastCard(compact) {
  const f = passForecast(bpVer()); const pc = Math.round(f.p * 100);
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🔮 Прогноз здачі <span class="small muted">${esc(BLUEPRINTS[f.ver].name)}</span></h2>${compact ? `<button class="linkbtn" data-act="bpview">карта тем</button>` : ""}</div>
    <p style="margin:8px 0 4px"><b style="color:${f.score >= 825 ? "var(--ok)" : f.score >= 750 ? "var(--warn)" : "var(--bad)"}">${f.verdict}</b></p>
    <p class="small" style="margin:0 0 4px">Орієнтовний бал <b>${f.score}</b> / 1000 (прохідний ≈ 825) · ймовірність здачі ≈ <b>${pc}%</b> · достовірність ${f.conf}</p>
    <p class="small muted" style="margin:0 0 6px">${f.simScore != null ? `Симуляції цієї версії (останні ${f.sims}): ${f.simScore}; ` : "Ще немає повних симуляцій цієї версії — пройдіть хоча б одну на 40+ питань; "}за банком питань: ${f.fromBank}. Пройдено ${Math.round(f.seenShare * 100)}% питань, що покривають blueprint.</p>
    ${f.weak.length ? `<p class="small" style="margin:0 0 4px">Слабкі домени: ${f.weak.map(d => `${d.id}. ${esc(d.ua)} — ${Math.round(d.ready * 100)}%`).join("; ")}</p>` : ""}
    ${!compact && f.gaps.length ? `<p class="small" style="margin:0">Почніть з: ${f.gaps.map(g => `<a href="#" data-act="bptrain" data-item="${f.ver}|${g.id}">${g.id}</a> ${esc(g.name.split(":")[0])}`).join("; ")}</p>` : ""}
    <p class="small muted" style="margin:6px 0 0">Це оцінка тренажера, а не офіційний прогноз Cisco: реальний іспит має інші питання й формат.</p></div>`;
}
VIEWS.bpview = { html: () => {
  const ver = bpVer(); const cov = bpCoverage(ver); const thin = cov.flatMap(d => d.items).filter(x => x.n < 6);
  const seg = ["auto", "v1.1", "v2.0"].map(v => `<button class="seg ${(opts.bp || "auto") === v ? "on" : ""}" data-act="bpver" data-v="${v}">${v === "auto" ? "Авто (за датою іспиту)" : v}</button>`).join("");
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🗺 Карта покриття CCNA</h2><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:6px 0">Офіційні теми іспиту і що з них є в тренажері: питання, лаби, ваша готовність. v1.1 — останній день складання 02.02.2027, v2.0 — з 03.02.2027.${opts.examDate ? " Дата вашого іспиту: " + esc(new Date(opts.examDate).toLocaleDateString("uk-UA")) + "." : " Вкажіть дату іспиту в «Плані до екзамену», щоб версія обиралася автоматично."}</p>
    <div class="chips">${seg}</div>
    <p class="small" style="margin:4px 0 0">Зараз: <b>${esc(BLUEPRINTS[ver].name)}</b> (${BLUEPRINTS[ver].until}). Тем з малим покриттям (&lt; 6 питань): ${thin.length}.</p></div>
  ${forecastCard(false)}
  ${cov.map(d => `<div class="card"><div class="row"><h2 class="grow" style="margin:0">${d.id}.0 ${esc(d.ua)} <span class="small muted">${Math.round(d.w * 100)}%</span></h2><b style="color:${pctC(d.ready)}">${Math.round(d.ready * 100)}%</b></div>
    <p class="small muted" style="margin:2px 0 6px">${esc(d.n)}</p>
    ${d.items.map(x => `<div class="kv" style="align-items:flex-start"><span><b>${x.id}</b> ${esc(x.name)}<br><span class="small muted">питань ${x.n}${x.n < 6 ? " ⚠ мало" : ""} · пройдено ${x.seen}${x.labs ? ` · лаб ${x.labsDone}/${x.labs}` : ""}</span></span>
      <span class="row" style="flex-wrap:nowrap"><b style="color:${pctC(x.ready)};min-width:42px;text-align:right">${x.ready == null ? "—" : Math.round(x.ready * 100) + "%"}</b>${x.n ? `<button class="mini" data-act="bptrain" data-item="${ver}|${x.id}">▶</button>` : ""}</span></div>`).join("")}</div>`).join("")}
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.bpview = () => { view = "bpview"; render(); scrollTop(); };
ACTS.bpver = el => { opts.bp = el.dataset.v; lsSet(LS.opts, opts); render(); };
ACTS.bptrain = (el, ev) => { if (ev) ev.preventDefault(); const [ver, id] = el.dataset.item.split("|"); const it = BLUEPRINTS[ver].domains.flatMap(d => d.items).find(x => x[0] === id); if (!it) return;
  const m = bpItemMatch(it); const list = QB.filter(q => m(textOf(q), q.t) && qtype(q) !== "flash"); const now = Date.now();
  const pri = q => { const r = prog[q.id]; return !r ? 1 : r.k === 0 ? 0 : r.d <= now ? 2 : 3; }; const pick = shuffle(list).sort((a, b) => pri(a) - pri(b)).slice(0, 20);
  startSession("train", shuffle(pick), id + " " + it[1].split(":")[0]); render(); scrollTop(); };
