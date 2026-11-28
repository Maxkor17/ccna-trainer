"use strict";
// Планувальник адресації VLSM: відділи й кількість хостів → підмережі, VLAN, шлюзи, діапазони DHCP; передача в генератор конфігурацій.
const VL_LS = "ccna.vlsm";
const VL_DEF = { base: "192.168.0.0/22", reserve: 20, firstVlan: 10, step: 10, gwLast: false, dhcpSkip: 10, rows: "USERS 120\nVOICE 60\nPRINTERS 20\nWIFI-GUEST 100\nMGMT 10\nLINK-R1-ISP 2" };
function vlPlan(c) { const m = String(c.base || "").trim().match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/); if (!m || ip2n(m[1]) == null || +m[2] > 30) return { err: "Вкажіть базову мережу у форматі 192.168.0.0/22" };
  const blen = +m[2], bnet = netOf(m[1], blen), bsize = 2 ** (32 - blen); if (bnet !== ip2n(m[1])) return { err: `${m[1]} — не адреса мережі для /${blen}; мережа — ${n2ip(bnet)}/${blen}` };
  const rows = String(c.rows || "").split("\n").map(l => l.trim().match(/^(.+?)\s+(\d+)$/)).filter(Boolean).map(x => ({ name: x[1].trim().toUpperCase().replace(/\s+/g, "-"), hosts: +x[2] }));
  if (!rows.length) return { err: "Додайте рядки «НАЗВА кількість_хостів»" };
  const need = rows.map((r, k) => { const isLink = r.hosts <= 2 && /LINK|WAN|P2P/i.test(r.name); const want = isLink ? 2 : Math.ceil(r.hosts * (1 + (+c.reserve || 0) / 100)); let bits = 2; while (2 ** bits - 2 < want) bits++; return Object.assign({}, r, { k, want, len: 32 - bits, size: 2 ** bits, link: isLink }); });
  const order = need.slice().sort((a, b) => b.size - a.size || a.k - b.k); let cur = bnet; const out = []; let vl = +c.firstVlan || 10;
  for (const r of order) { if (cur + r.size > bnet + bsize) return { err: `Не вистачає місця: для ${r.name} потрібно /${r.len} (${r.size} адрес), а базова мережа /${blen} вже заповнена. Збільште базову мережу або зменште резерв.` };
    const net = cur, bc = cur + r.size - 1; const gw = c.gwLast ? bc - 1 : net + 1; const first = net + 1, last = bc - 1; const skip = r.link ? 0 : Math.min(+c.dhcpSkip || 0, r.size - 4);
    out.push(Object.assign(r, { net: n2ip(net), mask: n2ip((0xffffffff << (32 - r.len)) >>> 0), bc: n2ip(bc), gw: n2ip(gw), first: n2ip(first), last: n2ip(last), usable: r.size - 2, dhcp: r.link ? null : [n2ip(c.gwLast ? first : first + skip), n2ip(c.gwLast ? last - 1 - skip : last)], vlan: r.link ? null : vl }));
    if (!r.link) vl += +c.step || 10; cur += r.size; }
  const used = out.reduce((a, r) => a + r.size, 0); return { rows: out, base: n2ip(bnet) + "/" + blen, used, free: bsize - used, bsize, next: cur < bnet + bsize ? n2ip(cur) : null }; }
function vlMd(P) { const L = ["# План адресації " + P.base, "", "| VLAN | Назва | Хостів (потрібно) | Мережа | Маска | Шлюз | Діапазон | Broadcast | DHCP |", "|---|---|---|---|---|---|---|---|---|"];
  for (const r of P.rows) L.push(`| ${r.vlan || "—"} | ${r.name} | ${r.usable} (${r.hosts}) | ${r.net}/${r.len} | ${r.mask} | ${r.link ? "—" : r.gw} | ${r.first}–${r.last} | ${r.bc} | ${r.dhcp ? r.dhcp.join("–") : "—"} |`);
  L.push("", `Використано ${P.used} з ${P.bsize} адрес${P.next ? `, вільно з ${P.next} (${P.free} адрес)` : ""}.`); return L.join("\n") + "\n"; }
let VLV = null;
VIEWS.vlsm = { html: () => { VLV = VLV || { c: Object.assign({}, VL_DEF, lsGet(VL_LS, {})), P: null }; const c = VLV.c; const P = VLV.P;
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🧮 Планувальник адресації (VLSM)</h2><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:6px 0">Кожен рядок — «НАЗВА кількість_хостів». Найбільші мережі розміщуються першими, щоб не було дірок. Рядки з LINK, WAN або P2P і 2 хостами стають /30 для з'єднань між маршрутизаторами.</p>
    <label class="small">Базова мережа<input data-vl="base" value="${esc(c.base)}" style="width:100%"></label>
    <label class="small" style="display:block;margin-top:6px">Відділи й хости<textarea data-vl="rows" rows="6" style="width:100%">${esc(c.rows)}</textarea></label>
    <div class="row" style="margin-top:6px"><label class="small">Резерв, %<input data-vl="reserve" type="number" value="${esc(c.reserve)}" style="width:70px"></label><label class="small">Перша VLAN<input data-vl="firstVlan" type="number" value="${esc(c.firstVlan)}" style="width:70px"></label><label class="small">Крок VLAN<input data-vl="step" type="number" value="${esc(c.step)}" style="width:70px"></label><label class="small">Не видавати DHCP перші<input data-vl="dhcpSkip" type="number" value="${esc(c.dhcpSkip)}" style="width:70px"></label></div>
    <div class="row" style="margin-top:6px"><button class="seg ${c.gwLast ? "" : "on"}" data-act="vlgw" data-v="0">Шлюз — перша адреса</button><button class="seg ${c.gwLast ? "on" : ""}" data-act="vlgw" data-v="1">Шлюз — остання</button></div>
    <div class="row" style="margin-top:10px"><button class="primary" data-act="vlrun">Розрахувати</button><button data-act="vlreset">Скинути</button></div></div>
  ${P && P.err ? `<div class="card"><p class="small" style="color:var(--bad);margin:0">${esc(P.err)}</p></div>` : ""}
  ${P && !P.err ? `<div class="card"><h2>План ${esc(P.base)} <span class="small muted">використано ${P.used}/${P.bsize}</span></h2><div class="progress"><i style="width:${Math.round(P.used / P.bsize * 100)}%"></i></div>
    <div style="overflow-x:auto"><table><tr><th>VLAN</th><th>Мережа</th><th>Шлюз</th><th class="num">Хостів</th></tr>${P.rows.map(r => `<tr><td>${r.vlan || "—"}</td><td><b>${esc(r.name)}</b><br>${r.net}/${r.len}<br><span class="small muted">${r.first} – ${r.last}<br>bc ${r.bc}${r.dhcp ? "<br>DHCP " + r.dhcp[0] + " – " + r.dhcp[1] : ""}</span></td><td>${r.link ? "—" : r.gw}</td><td class="num">${r.usable}<br><span class="small muted">потр. ${r.hosts}</span></td></tr>`).join("")}</table></div>
    ${P.next ? `<p class="small muted" style="margin:6px 0 0">Вільно для росту: з ${P.next}, ${P.free} адрес.</p>` : ""}
    <div class="row" style="margin-top:8px"><button class="primary" data-act="vltogen">🛠 У генератор конфігурацій</button><button data-act="vlmd">⬇ .md</button><button data-act="vlcsv">⬇ CSV</button></div></div>` : ""}
  <button class="ghost" data-act="home">На головну</button>`; } };
function vlRead() { document.querySelectorAll("[data-vl]").forEach(e => { VLV.c[e.dataset.vl] = e.value; }); lsSet(VL_LS, VLV.c); }
ACTS.vlsm = () => { view = "vlsm"; render(); scrollTop(); };
ACTS.vlrun = () => { vlRead(); VLV.P = vlPlan(VLV.c); render(); };
ACTS.vlgw = el => { vlRead(); VLV.c.gwLast = el.dataset.v === "1"; if (VLV.P) VLV.P = vlPlan(VLV.c); render(); };
ACTS.vlreset = () => { VLV.c = Object.assign({}, VL_DEF); lsSet(VL_LS, {}); VLV.P = null; render(); };
ACTS.vlmd = () => saveDownload("План адресації.md", vlMd(VLV.P), "text/markdown");
ACTS.vlcsv = () => saveDownload("vlsm.csv", "﻿VLAN;Назва;Потрібно;Доступно;Мережа;Префікс;Маска;Шлюз;Перша;Остання;Broadcast;DHCP з;DHCP по\n" + VLV.P.rows.map(r => [r.vlan || "", r.name, r.hosts, r.usable, r.net, r.len, r.mask, r.link ? "" : r.gw, r.first, r.last, r.bc, r.dhcp ? r.dhcp[0] : "", r.dhcp ? r.dhcp[1] : ""].join(";")).join("\n"), "text/csv");
ACTS.vltogen = () => { const rows = VLV.P.rows.filter(r => r.vlan); const c = Object.assign({}, CG_DEF, lsGet(CG_LS, {}), { role: "router", host: "R1", vlans: rows.map(r => `${r.vlan} ${r.name} ${r.gw}/${r.len}`).join("\n"), dhcpOn: true });
  const mg = rows.find(r => /MGMT/.test(r.name)); if (mg) c.mgmtNet = mg.net + "/" + mg.len; lsSet(CG_LS, c); CGV = null; view = "confgen"; render(); scrollTop(); };
