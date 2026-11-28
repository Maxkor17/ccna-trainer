"use strict";
// Дві короткі вправи для телефона: «Знайди помилку в конфігурації» і «Збери команду з плиток».
// ---- Знайди помилку: [id, тема, завдання, рядки правильної конфігурації, [[рядок, неправильний варіант, пояснення]…]] ----
const BUGS = [
  ["trunk", "SRWE3", "Gi0/1 — trunk до S2: native VLAN 99, дозволено лише VLAN 10, 20, 99, DTP вимкнено.", ["interface GigabitEthernet0/1", " switchport mode trunk", " switchport trunk native vlan 99", " switchport trunk allowed vlan 10,20,99", " switchport nonegotiate"],
    [[1, " switchport mode dynamic auto", "dynamic auto сам не ініціює trunk, а з nonegotiate DTP вимкнено зовсім — порт лишиться access. Потрібно switchport mode trunk."], [2, " switchport trunk native vlan 1", "За завданням native — 99. Native VLAN 1 ще й небажана з міркувань безпеки (VLAN hopping)."], [3, " switchport trunk allowed vlan 10,20", "VLAN 99 не дозволена — трафік керування й native VLAN не пройдуть через trunk."]]],
  ["voice", "SRWE3", "Fa0/5 — ПК у VLAN 10 і IP-телефон у voice VLAN 150; PortFast і BPDU guard.", ["interface FastEthernet0/5", " switchport mode access", " switchport access vlan 10", " switchport voice vlan 150", " spanning-tree portfast", " spanning-tree bpduguard enable"],
    [[1, " switchport mode trunk", "Порт до ПК з телефоном — access з voice VLAN; trunk тут не потрібен."], [3, " switchport access vlan 150", "Друга команда access vlan перезапише першу — ПК опиниться у VLAN 150. Для телефону — switchport voice vlan 150."], [5, " spanning-tree bpdufilter enable", "BPDU filter просто ігнорує BPDU і не вимикає порт — підключений комутатор може створити петлю. Потрібен bpduguard."]]],
  ["roas", "SRWE4", "R1 Gi0/0 — router-on-a-stick: VLAN 10 (192.168.10.1/24) і VLAN 20 (192.168.20.1/24).", ["interface GigabitEthernet0/0", " no shutdown", "interface GigabitEthernet0/0.10", " encapsulation dot1Q 10", " ip address 192.168.10.1 255.255.255.0", "interface GigabitEthernet0/0.20", " encapsulation dot1Q 20", " ip address 192.168.20.1 255.255.255.0"],
    [[1, " shutdown", "Фізичний інтерфейс вимкнено — разом з ним не працюють усі підінтерфейси."], [6, " encapsulation dot1Q 10", "Підінтерфейс .20 отримав тег VLAN 10 — кадри VLAN 20 не обробляються."], [4, " ip address 192.168.20.1 255.255.255.0", "Підінтерфейс VLAN 10 отримав адресу мережі VLAN 20 — у хостів VLAN 10 не буде шлюзу (а IOS ще й повідомить про перекриття)."]]],
  ["svi", "SRWE4", "L3-комутатор: маршрутизація між VLAN 10 і 20, Gi0/1 — routed-порт до R1 (10.0.0.2/30), маршрут за замовчуванням на R1.", ["ip routing", "interface Vlan10", " ip address 192.168.10.1 255.255.255.0", "interface Vlan20", " ip address 192.168.20.1 255.255.255.0", "interface GigabitEthernet0/1", " no switchport", " ip address 10.0.0.2 255.255.255.252", "ip route 0.0.0.0 0.0.0.0 10.0.0.1"],
    [[0, "no ip routing", "Без ip routing комутатор не маршрутизує між SVI."], [6, " switchport mode trunk", "Щоб дати IP фізичному порту, його роблять routed: no switchport."], [8, "ip default-gateway 10.0.0.1", "ip default-gateway діє, лише коли маршрутизацію вимкнено. З ip routing потрібен ip route 0.0.0.0 0.0.0.0 10.0.0.1."]]],
  ["ec", "SRWE6", "Gi0/1–2 до S2 в EtherChannel 1 з LACP, цей бік ініціює узгодження; канал — trunk.", ["interface range GigabitEthernet0/1 - 2", " channel-group 1 mode active", "interface Port-channel1", " switchport mode trunk"],
    [[1, " channel-group 1 mode desirable", "desirable — режим PAgP, а потрібен LACP (active/passive)."], [1, " channel-group 1 mode passive", "passive не ініціює LACP; за завданням цей бік ініціює — active. Якщо сусід теж passive, канал не збереться."], [0, "interface GigabitEthernet0/1", "Налаштовано лише Gi0/1 — Gi0/2 не ввійде в канал. Потрібно interface range."]]],
  ["stp", "SRWE5", "S1 — root для VLAN 10 і 20, Rapid PVST+, PortFast за замовчуванням на портах доступу з BPDU guard.", ["spanning-tree mode rapid-pvst", "spanning-tree vlan 10,20 priority 4096", "spanning-tree portfast default", "spanning-tree portfast bpduguard default"],
    [[0, "spanning-tree mode pvst", "pvst — класичний 802.1D з повільною збіжністю; за завданням Rapid PVST+."], [1, "spanning-tree vlan 10,20 priority 4000", "Пріоритет задається лише кроком 4096 (0, 4096, 8192…) — IOS відхилить 4000."], [1, "spanning-tree vlan 10,20 priority 61440", "61440 — найгірший пріоритет: S1 точно не стане root."]]],
  ["psec", "SRWE11", "Fa0/10 — один ПК, MAC вивчається автоматично й зберігається в конфігурації; при порушенні — відкидати кадри й журналювати, порт не вимикати.", ["interface FastEthernet0/10", " switchport mode access", " switchport port-security", " switchport port-security maximum 1", " switchport port-security mac-address sticky", " switchport port-security violation restrict"],
    [[1, " switchport mode dynamic auto", "На динамічному порту port security не вмикається — IOS відхилить. Потрібно switchport mode access."], [5, " switchport port-security violation protect", "protect відкидає мовчки — без журналу й лічильника. За завданням потрібен restrict."], [5, " switchport port-security violation shutdown", "shutdown вимкне порт (err-disabled), а за завданням порт не вимикати — restrict."], [4, " switchport port-security mac-address 0050.7966.6800", "Так MAC задається вручну. Щоб вивчати автоматично й зберігати в конфігурації — sticky."]]],
  ["dhcp", "SRWE7", "R1 — DHCP для 192.168.10.0/24: шлюз .1, DNS 8.8.8.8, адреси .1–.10 не видавати.", ["ip dhcp excluded-address 192.168.10.1 192.168.10.10", "ip dhcp pool LAN10", " network 192.168.10.0 255.255.255.0", " default-router 192.168.10.1", " dns-server 8.8.8.8"],
    [[2, " network 192.168.10.0 255.255.0.0", "Маска /16 не відповідає підмережі /24 — пул видаватиме адреси поза мережею інтерфейсу."], [3, " default-router 192.168.1.1", "Шлюз не з мережі пулу — клієнти не вийдуть за межі підмережі."], [0, "ip dhcp excluded-address 192.168.10.100 192.168.10.110", "Виключено не той діапазон — адреси .1–.10 можуть видаватися клієнтам."]]],
  ["relay", "SRWE7", "R1 Gi0/1 — шлюз клієнтів 192.168.20.0/24; запити DHCP пересилати на сервер 10.1.1.5 в іншій мережі.", ["interface GigabitEthernet0/1", " ip address 192.168.20.1 255.255.255.0", " ip helper-address 10.1.1.5", " no shutdown"],
    [[2, " ip helper-address 192.168.20.5", "helper-address — це адреса DHCP-сервера (10.1.1.5), а не адреса в мережі клієнтів."], [1, " ip address 192.168.20.1 255.255.255.252", "Маска /30 замість /24 — більшість клієнтів не в підмережі шлюзу, а relay вписує giaddr з неправильної мережі."], [3, " shutdown", "Інтерфейс вимкнено — запити клієнтів до маршрутизатора не дійдуть."]]],
  ["ospf", "ENSA2", "R1: OSPF процес 10, router-id 1.1.1.1, мережі 10.0.12.0/30 і 192.168.1.0/24 в area 0, LAN-інтерфейс Gi0/1 пасивний.", ["router ospf 10", " router-id 1.1.1.1", " network 10.0.12.0 0.0.0.3 area 0", " network 192.168.1.0 0.0.0.255 area 0", " passive-interface GigabitEthernet0/1"],
    [[2, " network 10.0.12.0 255.255.255.252 area 0", "У network для OSPF потрібна wildcard-маска (0.0.0.3). Маска підмережі тут — помилка: деякі версії IOS її інвертують самі, але покладатися на це не можна."], [3, " network 192.168.1.0 0.0.0.255 area 1", "За завданням LAN — у area 0."], [4, " passive-interface GigabitEthernet0/0", "Пасивним зроблено інтерфейс до сусіда — сусідство OSPF не встановиться. Пасивним має бути LAN Gi0/1."]]],
  ["static", "SRWE15", "R1: основний маршрут до 172.16.0.0/16 через 10.0.12.2, плаваючий резервний через 10.0.13.3, маршрут за замовчуванням через 209.165.200.1.", ["ip route 172.16.0.0 255.255.0.0 10.0.12.2", "ip route 172.16.0.0 255.255.0.0 10.0.13.3 130", "ip route 0.0.0.0 0.0.0.0 209.165.200.1"],
    [[1, "ip route 172.16.0.0 255.255.0.0 10.0.13.3", "Без AD обидва маршрути мають AD 1 — буде балансування, а не резерв. Плаваючому маршруту потрібна більша AD (напр. 130)."], [0, "ip route 172.16.0.0 255.255.255.0 10.0.12.2", "Маска /24 покриває лише 172.16.0.0/24 — решту /16 поведе резервний маршрут."], [2, "ip route 0.0.0.0 255.255.255.255 209.165.200.1", "Це маршрут лише до хоста 0.0.0.0/32. Маршрут за замовчуванням — 0.0.0.0 0.0.0.0."]]],
  ["acl", "ENSA4", "Заборонити мережі 192.168.20.0/24 HTTP до сервера 10.1.1.10, решту трафіку дозволити. ACL на R1 Gi0/1, куди входить трафік з 192.168.20.0/24.", ["ip access-list extended NO_WEB", " deny tcp 192.168.20.0 0.0.0.255 host 10.1.1.10 eq 80", " permit ip any any", "interface GigabitEthernet0/1", " ip access-group NO_WEB in"],
    [[2, " permit tcp any any", "Дозволено лише TCP — DNS (UDP) і ping (ICMP) впадуть під неявний deny."], [1, " deny tcp 192.168.20.0 0.0.0.255 host 10.1.1.10 eq 443", "Заблоковано HTTPS (443), а за завданням — HTTP (80)."], [4, " ip access-group NO_WEB out", "Трафік з 192.168.20.0/24 входить у Gi0/1 (in); у напрямку out він не перевіряється."], [1, " deny tcp 192.168.20.0 255.255.255.0 host 10.1.1.10 eq 80", "Маска підмережі замість wildcard: 255.255.255.0 як wildcard означає зовсім інший набір адрес."]]],
  ["ssh", "SRWE1", "Доступ лише по SSH v2 з локальним користувачем admin.", ["hostname S1", "ip domain-name lab.local", "username admin secret Cisco123!", "crypto key generate rsa general-keys modulus 2048", "ip ssh version 2", "line vty 0 15", " transport input ssh", " login local"],
    [[7, " login", "login перевіряє пароль лінії (password), а не локальних користувачів — потрібен login local."], [6, " transport input all", "all дозволяє ще й Telnet — за завданням лише ssh."], [3, "crypto key generate rsa general-keys modulus 512", "Для SSH v2 потрібен ключ щонайменше 768 біт; рекомендовано 2048."]]],
  ["hsrp", "SRWE9", "R1 — active у HSRP групі 1 для 192.168.1.0/24, віртуальна IP .254; після відновлення R1 має повертати роль.", ["interface GigabitEthernet0/1", " ip address 192.168.1.2 255.255.255.0", " standby version 2", " standby 1 ip 192.168.1.254", " standby 1 priority 150", " standby 1 preempt"],
    [[5, " standby 2 preempt", "preempt налаштовано для групи 2, а не 1 — після відновлення R1 не забере роль active."], [4, " standby 1 priority 90", "Пріоритет 90 нижчий за типовий 100 — R1 не стане active."], [3, " standby 1 ip 192.168.1.2", "Віртуальна IP збігається з адресою інтерфейсу — вона має бути окремою (.254)."]]],
  ["nat", "ENSA6", "R1: PAT для 192.168.1.0/24 через адресу інтерфейсу Gi0/0 (до провайдера).", ["access-list 1 permit 192.168.1.0 0.0.0.255", "ip nat inside source list 1 interface GigabitEthernet0/0 overload", "interface GigabitEthernet0/0", " ip nat outside", "interface GigabitEthernet0/1", " ip nat inside"],
    [[1, "ip nat inside source list 1 interface GigabitEthernet0/0", "Без overload це динамічний NAT 1:1 — одночасно вийде лише один хост."], [3, " ip nat inside", "Обидва інтерфейси inside — трансляції не буде; інтерфейс до провайдера має бути outside."], [0, "access-list 1 permit 192.168.1.0 0.0.0.0", "Wildcard 0.0.0.0 — лише одна адреса 192.168.1.0; жоден хост не транслюватиметься."]]],
  ["snoop", "SRWE11", "Захист від фальшивого DHCP у VLAN 10; довірений лише аплінк Gi0/1 до справжнього сервера.", ["ip dhcp snooping", "ip dhcp snooping vlan 10", "interface GigabitEthernet0/1", " ip dhcp snooping trust", "interface range FastEthernet0/1 - 24", " ip dhcp snooping limit rate 6"],
    [[3, " no ip dhcp snooping trust", "Аплінк до справжнього сервера має бути trusted, інакше його відповіді блокуватимуться."], [1, "ip dhcp snooping vlan 20", "Snooping увімкнено у VLAN 20, а захищати треба VLAN 10."], [0, "no ip dhcp snooping", "Без глобальної ip dhcp snooping функція не працює взагалі."]]]
];
let BGV = null;
function bgNew() { const T = SH_P(BUGS); const n = T[4].length >= 3 && Math.random() < 0.3 ? 2 : 1; const pool = shuffle(T[4]); const pick = []; for (const b of pool) { if (pick.length >= n) break; if (!pick.some(x => x[0] === b[0])) pick.push(b); }
  const lines = T[3].slice(); for (const b of pick) lines[b[0]] = b[1]; BGV = { T, bugs: pick, lines, sel: [], done: false, n: BGV ? BGV.n : 0, ok: BGV ? BGV.ok : 0 }; }
VIEWS.bugs = { html: () => { if (!BGV) bgNew(); const { T, bugs, lines } = BGV; const isBug = i => bugs.some(b => b[0] === i);
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🐞 Знайди помилку</h2><span class="small muted">${BGV.ok}/${BGV.n}</span><button class="mini ghost" data-act="home">✕</button></div>
    <p class="small muted" style="margin:6px 0">${tlabel(T[1])} · Завдання:</p><p style="margin:0 0 6px"><b>${esc(T[2])}</b></p>
    <p class="small">Натисніть ${bugs.length > 1 ? `<b>${bugs.length}</b> рядки` : "рядок"} з помилкою.</p>
    <div class="shout">${lines.map((l, i) => { let c = "shl"; if (BGV.done) { if (isBug(i)) c += " key"; else if (BGV.sel.includes(i)) c += " bad"; } else if (BGV.sel.includes(i)) c += " on";
      const b = bugs.find(x => x[0] === i); return `<div class="${c}" ${BGV.done ? "" : `data-act="bgpick" data-i="${i}"`}>${esc(l)}</div>${BGV.done && b ? `<div class="shn">✅ Має бути: <code>${esc(T[3][i].trim())}</code><br>${esc(b[2])}</div>` : ""}`; }).join("")}</div>
    ${BGV.done ? `<div class="verdict ${BGV.win ? "ok" : "bad"}">${BGV.win ? "Правильно!" : "Не зовсім"}</div><div class="navbar"><button class="primary" data-act="bgnext">Наступна конфігурація →</button></div>`
      : `<div class="navbar"><button class="primary" data-act="bgcheck" ${BGV.sel.length === bugs.length ? "" : "disabled"}>Перевірити</button></div>`}</div>
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.bugs = () => { BGV = null; view = "bugs"; render(); scrollTop(); };
ACTS.bgpick = el => { const i = Number(el.dataset.i); const s = BGV.sel; const k = s.indexOf(i); if (k >= 0) s.splice(k, 1); else { s.push(i); if (s.length > BGV.bugs.length) s.shift(); } render(); };
ACTS.bgcheck = () => { BGV.done = true; BGV.win = BGV.bugs.every(b => BGV.sel.includes(b[0])); BGV.n++; if (BGV.win) BGV.ok++; record("bg-" + BGV.T[0], BGV.win); render(); };
ACTS.bgnext = () => { bgNew(); render(); scrollTop(); };
// ---- Збери команду: "режим|завдання|відповідь|зайві плитки|інші правильні варіанти через ;" ----
const CB = `S1(config-if)#|Зробити порт портом доступу|switchport mode access|trunk dynamic auto|
S1(config-if)#|Призначити порт у VLAN 20|switchport access vlan 20|trunk native mode allowed|
S1(config-if)#|Зробити порт trunk без узгодження режиму|switchport mode trunk|access dynamic desirable|
S1(config-if)#|Native VLAN на trunk — 99|switchport trunk native vlan 99|access allowed voice|
S1(config-if)#|Додати VLAN 30 до вже дозволених на trunk|switchport trunk allowed vlan add 30|remove except native|
S1(config-if)#|Вимкнути DTP на порту|switchport nonegotiate|no negotiate mode dynamic|
S1(config-if)#|Голосова VLAN 150 для IP-телефона|switchport voice vlan 150|access native trunk|
S1(config)#|Створити VLAN 10|vlan 10|name interface create|
S1(config-vlan)#|Назвати VLAN SALES|name SALES|vlan description set|
S1#|Показати VLAN і порти доступу|show vlan brief|interfaces trunk all|
S1#|Показати trunk-порти й дозволені VLAN|show interfaces trunk|vlan brief switchport|
S1(config-if-range)#|Додати порти в EtherChannel 1 з LACP, ініціювати узгодження|channel-group 1 mode active|passive desirable on port-channel|
S1(config-if-range)#|EtherChannel 2 з PAgP, лише відповідати на узгодження|channel-group 2 mode auto|desirable active passive|
S1#|Перевірити стан EtherChannel|show etherchannel summary|port-channel detail lacp|
S1(config)#|Балансувати EtherChannel за src і dst IP|port-channel load-balance src-dst-ip|src-mac dst-mac etherchannel|
S1(config)#|Увімкнути Rapid PVST+|spanning-tree mode rapid-pvst|pvst mst rstp|
S1(config)#|Зробити S1 root primary для VLAN 10|spanning-tree vlan 10 root primary|secondary priority 4096|
S1(config)#|Пріоритет 4096 для VLAN 20|spanning-tree vlan 20 priority 4096|root primary 4000|
S1(config-if)#|PortFast на порту доступу|spanning-tree portfast|trunk bpduguard enable|spanning-tree portfast edge
S1(config-if)#|BPDU guard на порту|spanning-tree bpduguard enable|bpdufilter portfast disable|
S1#|Показати STP для VLAN 10|show spanning-tree vlan 10|summary interface detail|
R1(config-subif)#|Підінтерфейс для VLAN 10 (802.1Q)|encapsulation dot1Q 10|isl native vlan|
R1(config-if)#|Пересилати DHCP-запити на сервер 10.1.1.5|ip helper-address 10.1.1.5|dhcp relay server|
R1(config)#|Не видавати адреси 192.168.1.1–192.168.1.10|ip dhcp excluded-address 192.168.1.1 192.168.1.10|exclude pool range|
R1(dhcp-config)#|Шлюз для клієнтів пулу — 192.168.1.1|default-router 192.168.1.1|gateway dns-server ip|
R1(config-if)#|Отримати IPv4 від DHCP-сервера|ip address dhcp|client auto negotiate|
R1(config)#|Увімкнути маршрутизацію IPv6|ipv6 unicast-routing|routing ip enable|
R1(config-if)#|IPv6 через SLAAC на інтерфейсі|ipv6 address autoconfig|dhcp eui-64 slaac|
R1(config-if)#|RA з прапорцем O (stateless DHCPv6)|ipv6 nd other-config-flag|managed-config-flag ra dhcp|
R1(config-if)#|HSRP група 1, віртуальна IP 192.168.1.254|standby 1 ip 192.168.1.254|vrrp priority preempt|
R1(config-if)#|Повертати роль active після відновлення (HSRP 1)|standby 1 preempt|priority track delay|
S1(config-if)#|Увімкнути port security|switchport port-security|enable mac-address sticky|
S1(config-if)#|Запам'ятовувати MAC у конфігурації|switchport port-security mac-address sticky|maximum violation static|
S1(config-if)#|При порушенні відкидати кадри й журналювати|switchport port-security violation restrict|protect shutdown log|
S1(config)#|Увімкнути DHCP snooping|ip dhcp snooping|arp inspection trust|
S1(config-if)#|Довіряти DHCP-відповідям на аплінку|ip dhcp snooping trust|untrust arp inspection|
S1(config)#|Увімкнути DAI у VLAN 10|ip arp inspection vlan 10|dhcp snooping trust|
R1(config)#|Статичний маршрут до 10.2.0.0/16 через 10.0.0.2|ip route 10.2.0.0 255.255.0.0 10.0.0.2|0.0.255.255 route-static 255.255.255.0|
R1(config)#|Плаваючий маршрут за замовчуванням через 10.0.1.2 з AD 5|ip route 0.0.0.0 0.0.0.0 10.0.1.2 5|255.255.255.255 1 default|
R1(config)#|IPv6 маршрут за замовчуванням через 2001:db8::1|ipv6 route ::/0 2001:db8::1|::/128 ip 0.0.0.0|
R1#|Показати лише статичні маршрути|show ip route static|ospf connected all|
S1(config-line)#|Дозволити на VTY лише SSH|transport input ssh|telnet all none|
S1(config-line)#|Перевіряти локальних користувачів на VTY|login local|password authentication aaa|
S1(config)#|Згенерувати RSA-ключ 2048 біт|crypto key generate rsa general-keys modulus 2048|1024 ssh dsa|
S1(config)#|Шлюз за замовчуванням для керування комутатором — 192.168.99.1|ip default-gateway 192.168.99.1|route default-router 0.0.0.0|`.split("\n").map((r, k) => { const [mode, task, ans, dis, alt] = r.split("|"); return { id: "cb" + k, mode, task, ans, dis: dis.split(" ").filter(Boolean), alt: (alt || "").split(";").filter(Boolean) }; });
let CBV = null;
function cbNew() { const due = CB.filter(x => !prog["cb-" + x.id] || prog["cb-" + x.id].d <= Date.now()); const it = SH_P(due.length ? due : CB);
  CBV = { it, tiles: shuffle(it.ans.split(" ").concat(it.dis)).map((t, i) => ({ t, i })), line: [], done: false, n: CBV ? CBV.n : 0, ok: CBV ? CBV.ok : 0 }; }
VIEWS.cbuild = { html: () => { if (!CBV) cbNew(); const { it } = CBV; const used = new Set(CBV.line); const got = CBV.line.map(i => CBV.tiles[i].t).join(" ");
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">🧩 Збери команду</h2><span class="small muted">${CBV.ok}/${CBV.n}</span><button class="mini ghost" data-act="home">✕</button></div>
    <p style="margin:8px 0"><b>${esc(it.task)}</b></p>
    <div class="cmdline"><span>${esc(it.mode)}</span>${CBV.line.map((ti, k) => `<span class="tile" ${CBV.done ? "" : `data-act="cbdel" data-k="${k}"`}>${esc(CBV.tiles[ti].t)}</span>`).join("")}</div>
    ${CBV.done ? "" : `<div class="tiles">${CBV.tiles.map(x => `<span class="tile ${used.has(x.i) ? "used" : ""}" data-act="cbadd" data-i="${x.i}">${esc(x.t)}</span>`).join("")}</div>`}
    ${CBV.done ? `<div class="verdict ${CBV.win ? "ok" : "bad"}">${CBV.win ? "Правильно!" : "Неправильно"}</div>${CBV.win ? "" : `<p class="small">Правильно: <code>${esc(it.ans)}</code>${it.alt.length ? ` (або <code>${esc(it.alt.join(", "))}</code>)` : ""}</p>`}<div class="navbar"><button class="primary" data-act="cbnext">Наступна →</button></div>`
      : `<div class="navbar"><button data-act="cbclear" ${CBV.line.length ? "" : "disabled"}>Очистити</button><button class="primary" data-act="cbcheck" ${CBV.line.length ? "" : "disabled"}>Перевірити</button></div>`}
    <p class="small muted" style="margin:6px 0 0">${CB.length} команд з інтервальним повторенням. Натисніть плитку в рядку, щоб її прибрати.</p></div>
  <button class="ghost" data-act="home">На головну</button>`; } };
ACTS.cbuild = () => { CBV = null; view = "cbuild"; render(); scrollTop(); };
ACTS.cbadd = el => { if (CBV.done) return; const i = Number(el.dataset.i); if (!CBV.line.includes(i)) CBV.line.push(i); render(); };
ACTS.cbdel = el => { CBV.line.splice(Number(el.dataset.k), 1); render(); };
ACTS.cbclear = () => { CBV.line = []; render(); };
ACTS.cbcheck = () => { const got = CBV.line.map(i => CBV.tiles[i].t).join(" "); CBV.win = got === CBV.it.ans || CBV.it.alt.includes(got); CBV.done = true; CBV.n++; if (CBV.win) CBV.ok++; record("cb-" + CBV.it.id, CBV.win); render(); };
ACTS.cbnext = () => { cbNew(); render(); };
