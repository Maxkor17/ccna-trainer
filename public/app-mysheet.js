"use strict";
// Персональна шпаргалка перед іспитом: найслабші теми з помилками, часті помилки, команди, в яких плутаюсь, і ключові таблиці на одній сторінці.
const MS_TABLES = [
  ["Адміністративна відстань", [["Connected", "0"], ["Static", "1"], ["eBGP", "20"], ["EIGRP", "90"], ["OSPF", "110"], ["RIP", "120"], ["DHCP default (ip address dhcp)", "254"]]],
  ["Вартість STP (короткі)", [["10 Мбіт/с", "100"], ["100 Мбіт/с (Fa)", "19"], ["1 Гбіт/с (Gi)", "4"], ["10 Гбіт/с", "2"]]],
  ["EtherChannel — збереться?", [["active + active / passive", "так (LACP)"], ["passive + passive", "ні"], ["desirable + desirable / auto", "так (PAgP)"], ["auto + auto", "ні"], ["on + on", "так, без протоколу"], ["on + active/desirable", "ні"]]],
  ["Прапорці RA (IPv6)", [["M=0, O=0", "SLAAC, DNS з RA (RDNSS)"], ["M=0, O=1", "SLAAC + stateless DHCPv6"], ["M=1", "stateful DHCPv6"]]],
  ["Port security: порушення", [["shutdown (default)", "err-disabled, лічильник, syslog"], ["restrict", "відкидає, лічильник, syslog"], ["protect", "відкидає мовчки"]]],
  ["HSRP і VRRP", [["Стандарт", "Cisco / RFC 5798"], ["Ролі", "active-standby / master-backup"], ["Preempt за замовчуванням", "ні / так"], ["Віртуальна MAC", "0000.0c07.acXX (v1), 0000.0c9f.fXXX (v2) / 0000.5e00.01XX"]]],
  ["Wildcard", [["/24", "0.0.0.255"], ["/25", "0.0.0.127"], ["/26", "0.0.0.63"], ["/27", "0.0.0.31"], ["/28", "0.0.0.15"], ["/29", "0.0.0.7"], ["/30", "0.0.0.3"]]],
  ["Syslog", [["0 emergencies, 1 alerts, 2 critical", "3 errors, 4 warnings"], ["5 notifications, 6 informational", "7 debugging"]]],
  ["IPv6", [["2000::/3", "global unicast"], ["FE80::/10", "link-local"], ["FC00::/7 (FD..)", "unique local"], ["FF00::/8", "multicast (FF02::1 усі, ::2 маршрутизатори)"]]],
  ["Порти", [["20/21 FTP, 22 SSH, 23 Telnet, 25 SMTP", "53 DNS, 67/68 DHCP, 69 TFTP"], ["80 HTTP, 443 HTTPS, 123 NTP", "161/162 SNMP, 514 syslog"]]]
];
function msData() { const T = TOPICS.filter(t => t.g !== "LNX").map(t => [t, topicReady(t.id)]).filter(([, r]) => r && r.seen >= 3).sort((a, b) => a[1].p - b[1].p).slice(0, 6);
  const wrong = Object.entries(prog).filter(([id, r]) => QMAP[id] && r.w > 0 && !QMAP[id].gen).sort((a, b) => (b[1].w - b[1].c * 0.5) - (a[1].w - a[1].c * 0.5));
  const byT = t => wrong.filter(([id]) => QMAP[id].t === t).slice(0, 2).map(([id]) => QMAP[id]);
  const cmds = typeof CB !== "undefined" ? CB.filter(c => { const r = prog["cb-" + c.id]; return r && r.w > 0; }).slice(0, 10) : [];
  const gens = [["sh-", "Читання виводів", k => (typeof SHOW_GEN !== "undefined" && SHOW_GEN[k] ? SHOW_GEN[k].name : k)], ["lg-", "Журнали", k => "%" + k.toUpperCase()], ["pc-", "Захоплення", k => k.toUpperCase()]].map(([p, n, f]) => [n, Object.entries(prog).filter(([k, r]) => k.startsWith(p) && r.w > r.c).map(([k]) => f(k.slice(p.length)))]).filter(([, a]) => a.length);
  return { T: T.map(([t, r]) => ({ t, r, q: byT(t.id) })), top: wrong.slice(0, 10).map(([id]) => QMAP[id]), cmds, gens }; }
const msShort = s => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > 140 ? s.slice(0, 137) + "…" : s; };
function msMd(D) { const L = ["---", "tags: [ccna, шпаргалка]", "updated: " + dkey(), "---", "# Моя шпаргалка перед іспитом", ""];
  if (D.T.length) { L.push("## Найслабші теми", ""); for (const x of D.T) { L.push(`### ${tlabel(x.t.id)} ${x.t.name} — ${Math.round(x.r.p * 100)}%`); for (const q of x.q) L.push(`- ${msShort(q.q)} → **${msShort(ansText(q))}**`); L.push(""); } }
  if (D.top.length) { L.push("## Часті помилки", ""); for (const q of D.top) L.push(`- ${msShort(q.q)} → **${msShort(ansText(q))}**`); L.push(""); }
  if (D.cmds.length) { L.push("## Команди, в яких плутаюсь", ""); for (const c of D.cmds) L.push(`- ${c.task}: \`${c.ans}\``); L.push(""); }
  for (const [n, rows] of MS_TABLES) { L.push("## " + n, "", "| | |", "|---|---|"); for (const [a, b] of rows) L.push(`| ${a} | ${b} |`); L.push(""); } return L.join("\n"); }
VIEWS.mysheet = { html: () => { const D = msData();
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">📄 Моя шпаргалка перед іспитом</h2><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:6px 0">Складається з вашої статистики: найслабші теми, часті помилки й команди, де плутаєтесь, плюс ключові таблиці. Для друку оберіть «Зберегти як PDF».</p>
    <div class="row"><button class="primary" data-act="msprint">🖨 Друк / PDF</button><button data-act="msmd">⬇ .md для Obsidian</button></div></div>
  <div class="card mysheet">${D.T.length ? `<h2>Найслабші теми</h2>${D.T.map(x => `<h3>${tlabel(x.t.id)} ${esc(x.t.name)} <span class="small" style="color:${pctC(x.r.p)}">${Math.round(x.r.p * 100)}%</span></h3>${x.q.map(q => `<div class="small">• ${esc(msShort(q.q))} → <b>${esc(msShort(ansText(q)))}</b></div>`).join("")}`).join("")}` : `<p class="small muted">Слабкі теми з'являться, коли пройдете хоча б по кілька питань у різних модулях.</p>`}
    ${D.top.length ? `<h2>Часті помилки</h2>${D.top.map(q => `<div class="small">• ${esc(msShort(q.q))} → <b>${esc(msShort(ansText(q)))}</b></div>`).join("")}` : ""}
    ${D.cmds.length ? `<h2>Команди, в яких плутаюсь</h2>${D.cmds.map(c => `<div class="small">• ${esc(c.task)}: <code>${esc(c.ans)}</code></div>`).join("")}` : ""}
    ${D.gens.length ? `<h2>Ще тренувати</h2>${D.gens.map(([n, a]) => `<div class="small">• ${n}: ${esc(a.join(", "))}</div>`).join("")}` : ""}
    <h2>Ключові таблиці</h2><div class="ms-grid">${MS_TABLES.map(([n, rows]) => `<div><b class="small">${esc(n)}</b><table class="small">${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table></div>`).join("")}</div></div>
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.mysheet = () => { (typeof loadLazy === "function" ? loadLazy("practice") : Promise.resolve()).catch(() => {}).then(() => { view = "mysheet"; render(); scrollTop(); }); };
ACTS.msprint = () => { try { window.print(); } catch (e) {} };
ACTS.msmd = () => saveDownload("Моя шпаргалка CCNA.md", msMd(msData()), "text/markdown");
