// Додаткові питання для модулів, де їх було менше 20 (SRWE8–16, ENSA1–11).
// Двомовні записи: українська й англійська поруч; генератор розкладає їх у QB_MORE і QB_TR.
(function(){ const QB=window.QB_MORE=[], TR=window.QB_TR=window.QB_TR||{};
const perm=(id,n)=>{ let h=2166136261; for(const c of id) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0; const p=[...Array(n).keys()]; for(let i=n-1;i>0;i--){ h=Math.imul(h^(h>>>13),1597334677)>>>0; const j=h%(i+1); [p[i],p[j]]=[p[j],p[i]]; } return p; };
const mix=(id,o,a)=>{ const p=perm(id,o.length); return {o:p.map(i=>o[i]), a:a.map(x=>p.indexOf(x)).sort((x,y)=>x-y)}; };
const mc=(id,t,q,o0,a0)=>{ const {o,a}=mix(id,o0,a0); QB.push({id,t,q:q[0],o:o.map(x=>[x[0],x[1]]),a}); TR[id]={q:q[1],o:o.map(x=>[x[2],x[3]])}; };
const match=(id,t,q,pairs,e)=>{ QB.push({id,t,type:"match",q:q[0],pairs:pairs.map(p=>[p[0],p[1]]),e:e[0]}); TR[id]={q:q[1],pairs:pairs.map(p=>[p[2],p[3]]),e:e[1]}; };
const order=(id,t,q,items,e)=>{ QB.push({id,t,type:"order",q:q[0],items:items.map(x=>x[0]),e:e[0]}); TR[id]={q:q[1],items:items.map(x=>x[1]),e:e[1]}; };

// ===== SRWE8: SLAAC і DHCPv6 =====
mc("m-s8-1","SRWE8",["Які прапорці RA вказують клієнту: адресу — через SLAAC, а DNS — від DHCPv6-сервера?","Which RA flags tell a client to build its address with SLAAC and get DNS from a DHCPv6 server?"],[
 ["A=1, O=1, M=0","Правильно: stateless DHCPv6.","A=1, O=1, M=0","Correct: stateless DHCPv6."],
 ["A=0, O=0, M=1","Це stateful DHCPv6.","A=0, O=0, M=1","That is stateful DHCPv6."],
 ["A=1, O=0, M=0","Це лише SLAAC без DHCPv6.","A=1, O=0, M=0","That is SLAAC only, without DHCPv6."],
 ["A=0, O=1, M=0","Без A клієнт не будує адресу сам.","A=0, O=1, M=0","Without A the client does not build its own address."]],[0]);
mc("m-s8-2","SRWE8",["Яка команда на інтерфейсі маршрутизатора встановлює прапорець M=1 у RA?","Which interface command on a router sets the M=1 flag in RAs?"],[
 ["ipv6 nd managed-config-flag","Правильно.","ipv6 nd managed-config-flag","Correct."],
 ["ipv6 nd other-config-flag","Це прапорець O.","ipv6 nd other-config-flag","That is the O flag."],
 ["ipv6 dhcp relay destination","Це relay.","ipv6 dhcp relay destination","That is the relay."],
 ["ipv6 address autoconfig","Це робить сам інтерфейс SLAAC-клієнтом.","ipv6 address autoconfig","That makes the interface itself a SLAAC client."]],[0]);
mc("m-s8-3","SRWE8",["Що клієнт IPv6 робить перед тим, як почати використовувати адресу, отриману через SLAAC?","What does an IPv6 client do before it starts using an address obtained through SLAAC?"],[
 ["Перевіряє унікальність через DAD (Neighbor Solicitation на свою адресу)","Правильно.","It checks uniqueness with DAD (a Neighbor Solicitation for its own address)","Correct."],
 ["Надсилає ARP-запит","ARP немає в IPv6.","It sends an ARP request","IPv6 has no ARP."],
 ["Отримує підтвердження від DHCPv6-сервера","У SLAAC сервер не потрібен.","It gets a confirmation from the DHCPv6 server","SLAAC needs no server."],
 ["Пінгує шлюз","Ні.","It pings the gateway","No."]],[0]);
mc("m-s8-4","SRWE8",["На які порти UDP працює DHCPv6?","Which UDP ports does DHCPv6 use?"],[
 ["Клієнт — 546, сервер — 547","Правильно.","Client 546, server 547","Correct."],
 ["Клієнт — 68, сервер — 67","Це DHCPv4.","Client 68, server 67","That is DHCPv4."],
 ["Обидва — 547","Ні.","Both use 547","No."],
 ["TCP 546/547","DHCPv6 працює на UDP.","TCP 546/547","DHCPv6 runs over UDP."]],[0]);
mc("m-s8-5","SRWE8",["На яку адресу клієнт надсилає DHCPv6 SOLICIT?","To which address does a client send a DHCPv6 SOLICIT?"],[
 ["FF02::1:2 — усі DHCPv6-сервери й relay на лінку","Правильно.","FF02::1:2 — all DHCPv6 servers and relays on the link","Correct."],
 ["FF02::1","Це всі вузли.","FF02::1","That is all nodes."],
 ["FF02::2","Це всі маршрутизатори (для RS).","FF02::2","That is all routers (used for RS)."],
 ["255.255.255.255","Це IPv4 broadcast.","255.255.255.255","That is the IPv4 broadcast."]],[0]);

// ===== SRWE9: FHRP =====
mc("m-s9-1","SRWE9",["Яка віртуальна MAC-адреса HSRP версії 1 для групи 10?","What is the HSRP version 1 virtual MAC address for group 10?"],[
 ["0000.0C07.AC0A","Правильно: 0000.0C07.ACxx, xx — група в hex.","0000.0C07.AC0A","Correct: 0000.0C07.ACxx, where xx is the group in hex."],
 ["0000.0C9F.F00A","Це HSRPv2.","0000.0C9F.F00A","That is HSRPv2."],
 ["0000.5E00.010A","Це VRRP.","0000.5E00.010A","That is VRRP."],
 ["0007.B400.0A01","Це GLBP.","0007.B400.0A01","That is GLBP."]],[0]);
mc("m-s9-2","SRWE9",["Який FHRP дозволяє кільком маршрутизаторам одночасно пересилати трафік однієї групи (балансування)?","Which FHRP lets several routers forward traffic for the same group at once (load balancing)?"],[
 ["GLBP","Правильно: AVG роздає різні віртуальні MAC кожному AVF.","GLBP","Correct: the AVG hands out a different virtual MAC to each AVF."],
 ["HSRP","Один active.","HSRP","Only one active router."],
 ["VRRP","Один master.","VRRP","Only one master."],
 ["IRDP","Застарілий протокол виявлення.","IRDP","An obsolete discovery protocol."]],[0]);
match("m-s9-3","SRWE9",["Зіставте стан HSRP з описом.","Match each HSRP state with its description."],[
 ["Active","Пересилає трафік для віртуальної IP","Active","Forwards traffic for the virtual IP"],
 ["Standby","Резерв, готовий стати active","Standby","Backup, ready to become active"],
 ["Speak","Надсилає hello й бере участь у виборах","Speak","Sends hellos and takes part in the election"],
 ["Listen","Знає віртуальну IP, але не є ні active, ні standby","Listen","Knows the virtual IP but is neither active nor standby"]],
 ["HSRP: Initial → Learn → Listen → Speak → Standby → Active.","HSRP: Initial → Learn → Listen → Speak → Standby → Active."]);

// ===== SRWE10: принципи безпеки LAN =====
mc("m-s10-1","SRWE10",["Що відбувається під час атаки переповнення MAC-таблиці (MAC flooding)?","What happens during a MAC address table overflow (MAC flooding) attack?"],[
 ["Таблиця заповнюється фальшивими MAC, і комутатор розсилає кадри на всі порти VLAN, як концентратор","Правильно. Захист — port security.","The table fills with fake MACs and the switch floods frames out all VLAN ports like a hub","Correct. The defense is port security."],
 ["Комутатор перезавантажується","Ні.","The switch reboots","No."],
 ["Порти переходять у err-disabled","Так буває лише з port security.","Ports go err-disabled","That only happens with port security."],
 ["Атакувальник отримує доступ до CLI","Ні.","The attacker gains CLI access","No."]],[0]);
mc("m-s10-2","SRWE10",["Яка роль автентифікатора в 802.1X?","What is the authenticator's role in 802.1X?"],[
 ["Комутатор або AP: передає EAP-повідомлення між клієнтом і RADIUS-сервером і відкриває порт після успіху","Правильно.","The switch or AP: relays EAP messages between the client and the RADIUS server and opens the port on success","Correct."],
 ["Клієнтський пристрій, що просить доступ","Це supplicant.","The client device requesting access","That is the supplicant."],
 ["Сервер, що перевіряє облікові дані","Це authentication server (RADIUS).","The server that checks credentials","That is the authentication server (RADIUS)."],
 ["Центр сертифікації","Ні.","The certificate authority","No."]],[0]);
mc("m-s10-3","SRWE10",["Як атака DHCP starvation підготовлює атаку з фальшивим DHCP-сервером?","How does a DHCP starvation attack set up a rogue DHCP server attack?"],[
 ["Вичерпує пул легітимного сервера, після чого клієнтам відповідає лише фальшивий сервер","Правильно. Захист — DHCP snooping і port security.","It exhausts the legitimate server's pool, so only the rogue server answers clients","Correct. Defenses: DHCP snooping and port security."],
 ["Вимикає DNS","Ні.","It disables DNS","No."],
 ["Перехоплює ARP-відповіді","Це ARP spoofing.","It intercepts ARP replies","That is ARP spoofing."],
 ["Змінює native VLAN","Це VLAN hopping.","It changes the native VLAN","That is VLAN hopping."]],[0]);

// ===== SRWE12: принципи WLAN =====
mc("m-s12-1","SRWE12",["Які неперекривні канали в діапазоні 2,4 ГГц (Північна Америка, 20 МГц)?","Which channels do not overlap in the 2.4 GHz band (North America, 20 MHz)?"],[
 ["1, 6, 11","Правильно.","1, 6, 11","Correct."],
 ["1, 5, 9, 13","Так у деяких країнах з шириною 20 МГц, але класична відповідь — 1, 6, 11.","1, 5, 9, 13","Used in some regions, but the classic answer is 1, 6, 11."],
 ["36, 40, 44","Це 5 ГГц.","36, 40, 44","Those are 5 GHz."],
 ["2, 7, 12","Ні.","2, 7, 12","No."]],[0]);
mc("m-s12-2","SRWE12",["Що таке BSSID?","What is a BSSID?"],[
 ["MAC-адреса радіоінтерфейсу AP, яка ідентифікує конкретний BSS","Правильно.","The MAC address of the AP radio, which identifies a specific BSS","Correct."],
 ["Назва бездротової мережі","Це SSID.","The wireless network name","That is the SSID."],
 ["Номер каналу","Ні.","The channel number","No."],
 ["Пароль WPA2","Ні.","The WPA2 password","No."]],[0]);
mc("m-s12-3","SRWE12",["Як клієнти Wi-Fi уникають колізій у спільному середовищі?","How do Wi-Fi clients avoid collisions on the shared medium?"],[
 ["CSMA/CA: слухають канал, чекають випадковий час і отримують ACK","Правильно.","CSMA/CA: they listen to the channel, wait a random backoff and expect an ACK","Correct."],
 ["CSMA/CD: виявляють колізію під час передачі","Радіо не може виявити колізію під час передачі.","CSMA/CD: they detect collisions while transmitting","Radios cannot detect collisions while transmitting."],
 ["Token passing","Ні.","Token passing","No."],
 ["Full duplex","Радіоканал — half duplex.","Full duplex","The radio channel is half duplex."]],[0]);
mc("m-s12-4","SRWE12",["Яку функцію в split MAC-архітектурі виконує легка AP, а не WLC?","In the split MAC architecture, which function does the lightweight AP perform rather than the WLC?"],[
 ["Маяки (beacons), відповіді на probe, ACK і шифрування кадрів у реальному часі","Правильно.","Beacons, probe responses, ACKs and real-time frame encryption","Correct."],
 ["Автентифікацію й асоціацію клієнтів","Це робить WLC.","Client authentication and association","The WLC does that."],
 ["Керування радіоресурсами (RRM)","Це WLC.","Radio resource management (RRM)","That is the WLC."],
 ["Роумінг між AP","Це WLC.","Roaming between APs","That is the WLC."]],[0]);
mc("m-s12-5","SRWE12",["Який режим AP передає трафік клієнтів локально в комутатор, а з WLC тримає лише керування?","Which AP mode switches client traffic locally while keeping only control traffic to the WLC?"],[
 ["FlexConnect","Правильно.","FlexConnect","Correct."],
 ["Local","У local усі дані тунелюються CAPWAP на WLC.","Local","In local mode all data is tunneled to the WLC with CAPWAP."],
 ["Monitor","Лише сканує ефір.","Monitor","It only scans the air."],
 ["Sniffer","Захоплює кадри для аналізу.","Sniffer","It captures frames for analysis."]],[0]);
mc("m-s12-6","SRWE12",["Що таке Evil twin?","What is an evil twin?"],[
 ["Фальшива AP з тим самим SSID, що й легітимна, щоб перехопити клієнтів","Правильно.","A rogue AP with the same SSID as the legitimate one, used to lure clients","Correct."],
 ["Дві AP на одному каналі","Це просто перешкоди.","Two APs on the same channel","That is just interference."],
 ["Клієнт із двома радіо","Ні.","A client with two radios","No."],
 ["Резервний WLC","Ні.","A backup WLC","No."]],[0]);

// ===== SRWE13: налаштування WLAN =====
mc("m-s13-1","SRWE13",["Що потрібно для WPA2-Enterprise на WLC?","What is required for WPA2-Enterprise on a WLC?"],[
 ["RADIUS-сервер і 802.1X/EAP; кожен користувач має власні облікові дані","Правильно.","A RADIUS server and 802.1X/EAP; every user has their own credentials","Correct."],
 ["Лише спільний пароль (PSK)","Це WPA2-Personal.","Only a shared password (PSK)","That is WPA2-Personal."],
 ["TACACS+","Для бездротових клієнтів використовують RADIUS.","TACACS+","Wireless clients use RADIUS."],
 ["WEP-ключ","WEP застарів.","A WEP key","WEP is obsolete."]],[0]);
mc("m-s13-2","SRWE13",["Що таке динамічний інтерфейс (dynamic interface) на WLC?","What is a dynamic interface on a WLC?"],[
 ["Логічний інтерфейс, що прив'язує WLAN (SSID) до VLAN дротової мережі","Правильно.","A logical interface that maps a WLAN (SSID) to a wired VLAN","Correct."],
 ["Інтерфейс керування WLC","Це management interface.","The WLC management interface","That is the management interface."],
 ["Фізичний порт до комутатора","Це port.","A physical port to the switch","That is a port."],
 ["Інтерфейс для CAPWAP","Ні.","The CAPWAP interface","No."]],[0]);
mc("m-s13-3","SRWE13",["Як має бути налаштований порт комутатора до WLC, що обслуговує кілька WLAN у різних VLAN?","How should the switch port to a WLC serving several WLANs in different VLANs be configured?"],[
 ["Як 802.1Q trunk з дозволеними VLAN усіх динамічних інтерфейсів і керування","Правильно.","As an 802.1Q trunk allowing the VLANs of all dynamic interfaces and management","Correct."],
 ["Як access-порт у VLAN керування","Тоді працюватиме лише одна VLAN.","As an access port in the management VLAN","Then only one VLAN would work."],
 ["Як маршрутизований порт","WLC потребує L2 trunk.","As a routed port","The WLC needs an L2 trunk."],
 ["З увімкненим BPDU guard","BPDU guard не пов'язаний із VLAN.","With BPDU guard enabled","BPDU guard has nothing to do with VLANs."]],[0]);
mc("m-s13-4","SRWE13",["Через який протокол бездротовий маршрутизатор SOHO найчастіше налаштовують?","Which method is most commonly used to configure a SOHO wireless router?"],[
 ["Веб-інтерфейс (HTTP/HTTPS) за адресою шлюзу","Правильно.","A web interface (HTTP/HTTPS) at the gateway address","Correct."],
 ["Консольний кабель і IOS CLI","Так налаштовують корпоративні пристрої.","A console cable and the IOS CLI","That is for enterprise devices."],
 ["SNMP","Ні.","SNMP","No."],
 ["TFTP","Ні.","TFTP","No."]],[0]);
mc("m-s13-5","SRWE13",["Чому WPS варто вимикати на бездротовому маршрутизаторі?","Why should WPS be disabled on a wireless router?"],[
 ["PIN WPS легко підібрати перебором, і зловмисник отримає ключ мережі","Правильно.","The WPS PIN is easy to brute-force, giving the attacker the network key","Correct."],
 ["Він уповільнює Wi-Fi","Ні.","It slows down Wi-Fi","No."],
 ["Він вимикає DHCP","Ні.","It disables DHCP","No."],
 ["Він потрібен лише для 5 ГГц","Ні.","It is only needed for 5 GHz","No."]],[0]);
mc("m-s13-6","SRWE13",["Яке шифрування рекомендоване для WPA2?","Which encryption is recommended with WPA2?"],[
 ["AES (CCMP)","Правильно.","AES (CCMP)","Correct."],
 ["TKIP","Застарів і повільніший.","TKIP","Deprecated and slower."],
 ["RC4","Використовувався у WEP.","RC4","It was used in WEP."],
 ["DES","Ні.","DES","No."]],[0]);
mc("m-s13-7","SRWE13",["Що дає WPA3-Personal порівняно з WPA2-Personal?","What does WPA3-Personal add compared to WPA2-Personal?"],[
 ["SAE замість PSK-рукостискання: стійкість до офлайн-підбору пароля","Правильно.","SAE instead of the PSK handshake: resistance to offline password guessing","Correct."],
 ["Відсутність пароля","Це OWE (Enhanced Open).","No password at all","That is OWE (Enhanced Open)."],
 ["Обов'язковий RADIUS","Це Enterprise.","A mandatory RADIUS server","That is Enterprise."],
 ["Шифрування TKIP","Ні.","TKIP encryption","No."]],[0]);
mc("m-s13-8","SRWE13",["Навіщо на WLC додають RADIUS-сервер у розділі Security → AAA?","Why do you add a RADIUS server under Security → AAA on a WLC?"],[
 ["Щоб WLAN з 802.1X могли перевіряти користувачів на цьому сервері","Правильно.","So WLANs with 802.1X can authenticate users against it","Correct."],
 ["Щоб видавати IP-адреси клієнтам","Це DHCP.","To assign IP addresses to clients","That is DHCP."],
 ["Для синхронізації часу","Це NTP.","For time synchronization","That is NTP."],
 ["Щоб AP знайшли WLC","Це DHCP option 43 або DNS.","So APs can find the WLC","That is DHCP option 43 or DNS."]],[0]);
mc("m-s13-9","SRWE13",["Клієнти підключаються до SSID, але отримують 169.254.x.x. Що перевірити на WLC насамперед?","Clients join the SSID but get 169.254.x.x addresses. What should you check first on the WLC?"],[
 ["Динамічний інтерфейс WLAN: VLAN, шлюз і адресу DHCP-сервера","Правильно.","The WLAN's dynamic interface: VLAN, gateway and DHCP server address","Correct."],
 ["Потужність радіо","Асоціація вже відбулася.","The radio transmit power","Association already succeeded."],
 ["Ім'я SSID","Клієнти вже підключилися.","The SSID name","Clients already joined."],
 ["Версію CAPWAP","Ні.","The CAPWAP version","No."]],[0]);
match("m-s13-10","SRWE13",["Зіставте інтерфейс WLC з призначенням.","Match each WLC interface with its purpose."],[
 ["Management","Керування WLC і CAPWAP з AP","Management","WLC management and CAPWAP from APs"],
 ["Dynamic","Прив'язка WLAN до VLAN клієнтів","Dynamic","Maps a WLAN to a client VLAN"],
 ["Virtual","Веб-автентифікація й DHCP relay (наприклад, 192.0.2.1)","Virtual","Web authentication and DHCP relay (e.g. 192.0.2.1)"],
 ["Service port","Позасмугове керування","Service port","Out-of-band management"]],
 ["Кожна WLAN прив'язується до інтерфейсу, найчастіше динамічного.","Every WLAN is bound to an interface, usually a dynamic one."]);

// ===== SRWE14: принципи маршрутизації =====
mc("m-s14-1","SRWE14",["Що таке «рекурсивний пошук» у таблиці маршрутизації?","What is a recursive lookup in the routing table?"],[
 ["Маршрут вказує лише next-hop IP, і маршрутизатор шукає маршрут ще раз, щоб знайти вихідний інтерфейс","Правильно.","The route specifies only a next-hop IP, so the router looks up the table again to find the exit interface","Correct."],
 ["Пошук у таблиці ARP","Ні.","A lookup in the ARP table","No."],
 ["Обмін маршрутами між протоколами","Це редистрибуція.","Exchanging routes between protocols","That is redistribution."],
 ["Перевірка зворотного шляху (uRPF)","Ні.","A reverse path check (uRPF)","No."]],[0]);
mc("m-s14-2","SRWE14",["Що означає [110/65] у записі O 10.1.1.0/24 [110/65] via 10.0.0.2?","What does [110/65] mean in the entry O 10.1.1.0/24 [110/65] via 10.0.0.2?"],[
 ["AD = 110 (OSPF), метрика = 65","Правильно.","AD = 110 (OSPF), metric = 65","Correct."],
 ["Метрика 110, хопів 65","Порядок навпаки й це не хопи.","Metric 110, 65 hops","The order is reversed and it is not hops."],
 ["Process ID 110, cost 65","Process ID не показується тут.","Process ID 110, cost 65","The process ID is not shown here."],
 ["Час життя маршруту","Ні.","The route's age","No."]],[0]);
mc("m-s14-3","SRWE14",["Що робить CEF (Cisco Express Forwarding) для пришвидшення пересилання?","What does CEF (Cisco Express Forwarding) do to speed up forwarding?"],[
 ["Будує FIB і таблицю суміжності заздалегідь, тож кожен пакет пересилається без звернення до CPU","Правильно.","It prebuilds a FIB and an adjacency table so packets are forwarded without CPU involvement","Correct."],
 ["Кешує лише перший пакет потоку","Це fast switching.","It caches only the first packet of a flow","That is fast switching."],
 ["Передає кожен пакет на CPU","Це process switching.","It sends every packet to the CPU","That is process switching."],
 ["Стискає заголовки","Ні.","It compresses headers","No."]],[0]);
mc("m-s14-4","SRWE14",["Маршрут до 172.16.0.0/16 відомий через OSPF (AD 110) і через статичний (AD 1). Що буде в таблиці?","A route to 172.16.0.0/16 is known via OSPF (AD 110) and a static route (AD 1). What goes into the table?"],[
 ["Лише статичний — менша AD","Правильно.","Only the static route, because of the lower AD","Correct."],
 ["Обидва з балансуванням","Балансування — лише для маршрутів одного джерела з однаковою метрикою.","Both, load-balanced","Load balancing only applies to routes from the same source with equal metrics."],
 ["Лише OSPF — він динамічний","Ні.","Only OSPF, because it is dynamic","No."],
 ["Жодного — конфлікт","Ні.","Neither, because of the conflict","No."]],[0]);
mc("m-s14-5","SRWE14",["Що означає код L у show ip route?","What does the L code mean in show ip route?"],[
 ["Local — /32 адреса самого інтерфейсу маршрутизатора","Правильно.","Local — the /32 address of the router's own interface","Correct."],
 ["Маршрут, вивчений по LLDP","Ні.","A route learned via LLDP","No."],
 ["Маршрут з найменшою метрикою","Ні.","The route with the lowest metric","No."],
 ["Loopback-мережа","Ні, хоча loopback теж має L.","A loopback network","No, although loopbacks get an L too."]],[0]);

// ===== SRWE15: статична маршрутизація =====
mc("m-s15-1","SRWE15",["Чим небезпечний статичний маршрут, що вказує лише Ethernet-інтерфейс без next-hop (ip route … g0/1)?","Why is a static route that points only to an Ethernet interface without a next hop (ip route … g0/1) risky?"],[
 ["Маршрутизатор вважає мережу прямо під'єднаною і робить ARP для кожного адресата, покладаючись на proxy ARP","Правильно. Для Ethernet указуйте next-hop.","The router treats the network as directly connected and ARPs for every destination, relying on proxy ARP","Correct. Use a next hop on Ethernet."],
 ["Такий маршрут неможливо створити","Можна.","Such a route cannot be created","It can."],
 ["Він має AD 255","AD — 1.","It has AD 255","Its AD is 1."],
 ["Він працює лише для IPv6","Ні.","It only works for IPv6","No."]],[0]);
mc("m-s15-2","SRWE15",["Який маршрут налаштовано: ip route 10.10.10.0 255.255.255.0 192.168.1.2 g0/1?","What kind of route is ip route 10.10.10.0 255.255.255.0 192.168.1.2 g0/1?"],[
 ["Повністю визначений (fully specified) статичний маршрут","Правильно: вказано й інтерфейс, і next-hop.","A fully specified static route","Correct: both the interface and the next hop are given."],
 ["Маршрут за замовчуванням","Це не 0.0.0.0/0.","A default route","It is not 0.0.0.0/0."],
 ["Floating static","Немає AD.","A floating static route","There is no AD."],
 ["Маршрут до хоста","Маска /24.","A host route","The mask is /24."]],[0]);
mc("m-s15-3","SRWE15",["Як налаштувати маршрут за замовчуванням IPv6 через 2001:db8:1::1?","How do you configure an IPv6 default route via 2001:db8:1::1?"],[
 ["ipv6 route ::/0 2001:db8:1::1","Правильно.","ipv6 route ::/0 2001:db8:1::1","Correct."],
 ["ipv6 route 0.0.0.0 0.0.0.0 2001:db8:1::1","Це синтаксис IPv4.","ipv6 route 0.0.0.0 0.0.0.0 2001:db8:1::1","That is IPv4 syntax."],
 ["ip route ::/0 2001:db8:1::1","Потрібна команда ipv6 route.","ip route ::/0 2001:db8:1::1","The command is ipv6 route."],
 ["ipv6 default-gateway 2001:db8:1::1","Так налаштовують L2-комутатор.","ipv6 default-gateway 2001:db8:1::1","That is for an L2 switch."]],[0]);
mc("m-s15-4","SRWE15",["Що потрібно увімкнути на маршрутизаторі, щоб він пересилав пакети IPv6 між інтерфейсами?","What must be enabled on a router to forward IPv6 packets between interfaces?"],[
 ["ipv6 unicast-routing","Правильно.","ipv6 unicast-routing","Correct."],
 ["ip routing","Це IPv4 (і на маршрутизаторах увімкнено за замовчуванням).","ip routing","That is IPv4 (and on by default on routers)."],
 ["ipv6 enable","Лише вмикає IPv6 на інтерфейсі.","ipv6 enable","It only enables IPv6 on an interface."],
 ["ipv6 cef","Не вмикає маршрутизацію.","ipv6 cef","It does not enable routing."]],[0]);
mc("m-s15-5","SRWE15",["Якщо next-hop IPv6 статичного маршруту — link-local (FE80::2), що ще треба вказати?","If the next hop of an IPv6 static route is link-local (FE80::2), what else must you specify?"],[
 ["Вихідний інтерфейс: ipv6 route 2001:db8:2::/64 g0/1 fe80::2","Правильно: link-local унікальна лише в межах лінку.","The exit interface: ipv6 route 2001:db8:2::/64 g0/1 fe80::2","Correct: a link-local address is unique only on its link."],
 ["AD","Не обов'язково.","The AD","Not required."],
 ["Маску у вигляді 255.255…","В IPv6 — довжина префікса.","A dotted mask","IPv6 uses a prefix length."],
 ["Нічого","Без інтерфейсу IOS не прийме маршрут.","Nothing","Without the interface IOS rejects the route."]],[0]);
mc("m-s15-6","SRWE15",["Що таке підсумковий (summary) статичний маршрут?","What is a summary static route?"],[
 ["Один маршрут, що охоплює кілька суміжних мереж, наприклад 172.16.0.0/22 замість чотирьох /24","Правильно.","One route covering several contiguous networks, e.g. 172.16.0.0/22 instead of four /24s","Correct."],
 ["Маршрут з найменшою AD","Ні.","The route with the lowest AD","No."],
 ["Маршрут за замовчуванням","Це окремий випадок, але ні.","A default route","A special case, but no."],
 ["Маршрут до loopback","Ні.","A route to a loopback","No."]],[0]);

// ===== SRWE16: діагностика статичних маршрутів =====
mc("m-s16-1","SRWE16",["PC1 → ping 10.2.2.2 повертає «Request timed out», а tracert зупиняється на першому хопі. Найімовірніша причина?","A ping from PC1 to 10.2.2.2 times out, and tracert stops at the first hop. What is the most likely cause?"],[
 ["У шлюзу (першого маршрутизатора) немає маршруту до 10.2.2.0 або немає зворотного маршруту в наступного","Правильно: перевірте show ip route на обох.","The gateway (first router) has no route to 10.2.2.0, or the next router has no return route","Correct: check show ip route on both."],
 ["Неправильна маска на PC1","Тоді не було б і першого хопу.","A wrong mask on PC1","Then even the first hop would fail."],
 ["Вимкнено DNS","ping за IP DNS не потребує.","DNS is disabled","Ping by IP does not need DNS."],
 ["Кабель PC1 пошкоджено","Перший хоп відповідає.","PC1's cable is damaged","The first hop answers."]],[0]);
mc("m-s16-2","SRWE16",["Ping від маршрутизатора R1 до 10.3.3.3 успішний, а від ПК за R1 — ні. Що перевірити?","A ping from router R1 to 10.3.3.3 succeeds, but from a PC behind R1 it fails. What should you check?"],[
 ["Зворотний маршрут до мережі ПК на віддалених маршрутизаторах (R1 пінгує з адреси свого WAN-інтерфейсу)","Правильно. Перевірте ping 10.3.3.3 source g0/0.","The return route to the PC's network on the remote routers (R1 pings from its WAN interface address)","Correct. Try ping 10.3.3.3 source g0/0."],
 ["Таблицю ARP на ПК","Ні.","The ARP table on the PC","No."],
 ["Версію IOS","Ні.","The IOS version","No."],
 ["CDP","Ні.","CDP","No."]],[0]);
mc("m-s16-3","SRWE16",["Що показує символ «U» у виводі ping на Cisco IOS?","What does a «U» in Cisco IOS ping output indicate?"],[
 ["Отримано ICMP Destination Unreachable — маршрутизатор на шляху не знає, куди надіслати пакет","Правильно.","An ICMP Destination Unreachable was received — a router on the path has no route","Correct."],
 ["Тайм-аут","Це «.».","A timeout","That is «.»."],
 ["Успішна відповідь","Це «!».","A successful reply","That is «!»."],
 ["Перевищено TTL","Ні.","TTL exceeded","No."]],[0]);
mc("m-s16-4","SRWE16",["Статичний маршрут налаштовано, але його немає в show ip route. Чому?","A static route is configured but does not appear in show ip route. Why?"],[
 ["Вихідний інтерфейс down або next-hop недосяжний (немає маршруту до нього)","Правильно.","The exit interface is down or the next hop is unreachable (no route to it)","Correct."],
 ["Статичні маршрути показує лише show ip static","Ні.","Static routes are shown only by show ip static","No."],
 ["Маршрут має AD 1","Це нормально.","The route has AD 1","That is normal."],
 ["Не збережено конфігурацію","Running-config діє одразу.","The configuration was not saved","The running config applies immediately."]],[0]);
mc("m-s16-5","SRWE16",["Яка команда покаже, через який маршрут IOS відправить пакет до 10.1.5.9?","Which command shows which route IOS will use for a packet to 10.1.5.9?"],[
 ["show ip route 10.1.5.9","Правильно: показує найдовший збіг.","show ip route 10.1.5.9","Correct: it shows the longest match."],
 ["show ip interface brief","Лише інтерфейси.","show ip interface brief","Interfaces only."],
 ["show arp","Лише ARP.","show arp","ARP only."],
 ["show ip protocols","Лише протоколи маршрутизації.","show ip protocols","Routing protocols only."]],[0]);
mc("m-s16-6","SRWE16",["Що означає «*» біля S* у show ip route?","What does the «*» in S* mean in show ip route?"],[
 ["Кандидат у маршрут за замовчуванням (gateway of last resort)","Правильно.","Candidate default route (gateway of last resort)","Correct."],
 ["Маршрут вимкнено","Ні.","The route is disabled","No."],
 ["Маршрут із BGP","Ні.","A BGP route","No."],
 ["Маршрут щойно змінився","Ні.","The route just changed","No."]],[0]);
order("m-s16-7","SRWE16",["Розташуйте кроки діагностики «немає зв'язку між мережами» у логічному порядку (знизу вгору).","Put the steps for troubleshooting «no connectivity between networks» in a logical order (bottom-up)."],[
 ["Перевірити стан інтерфейсів (show ip interface brief)","Check interface status (show ip interface brief)"],
 ["Перевірити IP-адреси й маски на інтерфейсах","Check IP addresses and masks on the interfaces"],
 ["Перевірити маршрути в обидва боки (show ip route)","Check routes in both directions (show ip route)"],
 ["Перевірити ACL на шляху (show access-lists)","Check ACLs on the path (show access-lists)"]],
 ["Від фізичного рівня до політик: інтерфейси → адресація → маршрути → фільтрація.","From the physical layer to policies: interfaces → addressing → routes → filtering."]);
mc("m-s16-8","SRWE16",["tracert показує *, * , * після 3-го хопу, а далі адресат відповідає. Як це пояснити?","tracert shows * * * at hop 3, but the destination still answers further on. How do you explain it?"],[
 ["Маршрутизатор на 3-му хопі не надсилає (або фільтрує) ICMP Time Exceeded, але пересилає трафік","Правильно.","The hop-3 router does not send (or filters) ICMP Time Exceeded, but still forwards traffic","Correct."],
 ["Маршрутна петля","Тоді адресат не відповів би.","A routing loop","Then the destination would not answer."],
 ["Пакети губляться на 3-му хопі","Адресат відповідає — пакети проходять.","Packets are lost at hop 3","The destination answers, so packets get through."],
 ["Неправильний шлюз на ПК","Ні.","A wrong gateway on the PC","No."]],[0]);
mc("m-s16-9","SRWE16",["На R1 два маршрути: S 10.0.0.0/8 via 1.1.1.1 і S 10.10.0.0/16 via 2.2.2.2. Куди піде пакет до 10.10.5.5?","R1 has two routes: S 10.0.0.0/8 via 1.1.1.1 and S 10.10.0.0/16 via 2.2.2.2. Where does a packet to 10.10.5.5 go?"],[
 ["Через 2.2.2.2 — найдовший збіг (/16)","Правильно.","Via 2.2.2.2 — the longest match (/16)","Correct."],
 ["Через 1.1.1.1 — маршрут налаштовано першим","Порядок налаштування не важить.","Via 1.1.1.1, because it was configured first","Configuration order does not matter."],
 ["Через обидва","Ні.","Via both","No."],
 ["Буде відкинуто","Ні.","It is dropped","No."]],[0]);

// ===== ENSA1: принципи OSPFv2 =====
mc("m-e1-1","ENSA1",["Які три таблиці (бази) підтримує маршрутизатор OSPF?","Which three tables (databases) does an OSPF router maintain?"],[
 ["Таблицю сусідів (adjacency), LSDB (топологію) і таблицю маршрутизації (forwarding)","Правильно.","The neighbor (adjacency) table, the LSDB (topology) and the routing (forwarding) table","Correct."],
 ["ARP, MAC і маршрутизації","Ні.","ARP, MAC and routing tables","No."],
 ["Таблицю DR, BDR і DROTHER","Це ролі, а не бази.","The DR, BDR and DROTHER tables","Those are roles, not databases."],
 ["Таблицю ACL, NAT і маршрутизації","Ні.","ACL, NAT and routing tables","No."]],[0]);
mc("m-e1-2","ENSA1",["Який тип пакета OSPF використовують для підтвердження отримання LSU?","Which OSPF packet type acknowledges receipt of an LSU?"],[
 ["LSAck (тип 5)","Правильно.","LSAck (type 5)","Correct."],
 ["Hello (тип 1)","Ні.","Hello (type 1)","No."],
 ["DBD (тип 2)","Це опис бази.","DBD (type 2)","That describes the database."],
 ["LSR (тип 3)","Це запит.","LSR (type 3)","That is a request."]],[0]);
mc("m-e1-3","ENSA1",["Навіщо OSPF обирає DR на multiaccess-сегментах?","Why does OSPF elect a DR on multiaccess segments?"],[
 ["Щоб зменшити кількість суміжностей і LSA: усі обмінюються оновленнями лише з DR і BDR","Правильно.","To reduce the number of adjacencies and LSAs: everyone exchanges updates only with the DR and BDR","Correct."],
 ["Щоб балансувати трафік","Ні.","To load-balance traffic","No."],
 ["Щоб шифрувати оновлення","Ні.","To encrypt updates","No."],
 ["Бо так вимагає point-to-point","На P2P DR не обирають.","Because point-to-point requires it","No DR is elected on point-to-point links."]],[0]);
mc("m-e1-4","ENSA1",["Як OSPF за замовчуванням обчислює cost інтерфейсу?","How does OSPF calculate interface cost by default?"],[
 ["Reference bandwidth (100 Мбіт/с) ÷ смуга інтерфейсу","Правильно, тому FastEthernet і GigabitEthernet мають cost 1 без auto-cost reference-bandwidth.","Reference bandwidth (100 Mbps) ÷ interface bandwidth","Correct, which is why FastEthernet and GigabitEthernet both have cost 1 without auto-cost reference-bandwidth."],
 ["За кількістю хопів","Це RIP.","By hop count","That is RIP."],
 ["За затримкою й навантаженням","Це EIGRP (складена метрика).","By delay and load","That is EIGRP's composite metric."],
 ["Завжди 10","Ні.","It is always 10","No."]],[0]);
mc("m-e1-5","ENSA1",["Що таке ABR в OSPF?","What is an ABR in OSPF?"],[
 ["Маршрутизатор з інтерфейсами в кількох областях, зокрема в області 0","Правильно.","A router with interfaces in multiple areas, including area 0","Correct."],
 ["Маршрутизатор, що імпортує зовнішні маршрути","Це ASBR.","A router that imports external routes","That is an ASBR."],
 ["Резервний DR","Це BDR.","A backup DR","That is the BDR."],
 ["Маршрутизатор лише в області 0","Це backbone router.","A router only in area 0","That is a backbone router."]],[0]);

// ===== ENSA3: принципи мережевої безпеки =====
mc("m-e3-1","ENSA3",["Чим відрізняється вразливість, загроза й ризик?","How do a vulnerability, a threat and a risk differ?"],[
 ["Вразливість — слабке місце; загроза — потенційна небезпека, що може його використати; ризик — імовірність і наслідки","Правильно.","A vulnerability is a weakness; a threat is a potential danger that could exploit it; risk is the likelihood and impact","Correct."],
 ["Це синоніми","Ні.","They are synonyms","No."],
 ["Загроза — це вже здійснена атака","Ні.","A threat is an attack that already happened","No."],
 ["Ризик — це лише вартість обладнання","Ні.","Risk is only the cost of equipment","No."]],[0]);
mc("m-e3-2","ENSA3",["Що таке атака «людина посередині» (on-path)?","What is an on-path (man-in-the-middle) attack?"],[
 ["Атакувальник непомітно стає між двома сторонами й перехоплює або змінює їхній трафік","Правильно. Приклад — ARP spoofing.","The attacker silently sits between two parties and intercepts or alters their traffic","Correct. ARP spoofing is an example."],
 ["Перевантаження сервера запитами","Це DoS.","Flooding a server with requests","That is DoS."],
 ["Підбір пароля","Це brute force.","Guessing a password","That is brute force."],
 ["Фішинговий лист","Це соціальна інженерія.","A phishing email","That is social engineering."]],[0]);
mc("m-e3-3","ENSA3",["Чим черв'як відрізняється від вірусу?","How does a worm differ from a virus?"],[
 ["Черв'як поширюється мережею самостійно, вірус потребує дії користувача або носія","Правильно.","A worm spreads across the network on its own; a virus needs a user action or a host file","Correct."],
 ["Черв'як завжди шифрує файли","Це ransomware.","A worm always encrypts files","That is ransomware."],
 ["Вірус не шкодить","Ні.","A virus does no harm","No."],
 ["Це одне й те саме","Ні.","They are the same","No."]],[0]);
mc("m-e3-4","ENSA3",["Який алгоритм асиметричний?","Which algorithm is asymmetric?"],[
 ["RSA","Правильно: пара ключів — публічний і приватний.","RSA","Correct: a public/private key pair."],
 ["AES","Симетричний.","AES","Symmetric."],
 ["3DES","Симетричний.","3DES","Symmetric."],
 ["SHA-256","Це хеш-функція.","SHA-256","That is a hash function."]],[0]);
mc("m-e3-5","ENSA3",["Яку властивість даних забезпечує хешування (наприклад, SHA-256)?","Which data property does hashing (e.g. SHA-256) provide?"],[
 ["Цілісність","Правильно.","Integrity","Correct."],
 ["Конфіденційність","Хеш не шифрує дані.","Confidentiality","A hash does not encrypt data."],
 ["Доступність","Ні.","Availability","No."],
 ["Анонімність","Ні.","Anonymity","No."]],[0]);
mc("m-e3-6","ENSA3",["Що таке розвідка (reconnaissance) в контексті атаки?","What is reconnaissance in the context of an attack?"],[
 ["Збір інформації про мережу: ping sweep, сканування портів, запити whois/DNS","Правильно.","Gathering information about the network: ping sweeps, port scans, whois/DNS queries","Correct."],
 ["Вимкнення сервісів","Це DoS.","Disabling services","That is DoS."],
 ["Отримання прав адміністратора","Це атака доступу.","Gaining admin rights","That is an access attack."],
 ["Знищення журналів","Ні.","Deleting logs","No."]],[0]);
mc("m-e3-7","ENSA3",["Що таке DDoS?","What is DDoS?"],[
 ["Відмова в обслуговуванні з багатьох скомпрометованих пристроїв (ботнет) одночасно","Правильно.","Denial of service from many compromised devices (a botnet) at once","Correct."],
 ["Атака з одного комп'ютера","Це DoS.","An attack from one computer","That is DoS."],
 ["Перехоплення DNS-запитів","Ні.","Intercepting DNS queries","No."],
 ["Підробка DHCP","Ні.","DHCP spoofing","No."]],[0]);
match("m-e3-8","ENSA3",["Зіставте інструмент безпеки з функцією.","Match each security tool with its function."],[
 ["IPS","Виявляє й блокує атаки в потоці трафіку","IPS","Detects and blocks attacks inline"],
 ["IDS","Виявляє атаки й сповіщає, не блокуючи","IDS","Detects attacks and alerts without blocking"],
 ["SIEM","Збирає й корелює журнали подій","SIEM","Collects and correlates event logs"],
 ["VPN","Шифрує трафік через ненадійну мережу","VPN","Encrypts traffic over an untrusted network"]],
 ["IPS стоїть у розриві (inline), IDS — на копії трафіку (SPAN).","An IPS sits inline; an IDS works on a copy of the traffic (SPAN)."]);

// ===== ENSA4: принципи ACL =====
mc("m-e4-1","ENSA4",["Який wildcard відповідає хостам 192.168.1.64–192.168.1.127?","Which wildcard matches hosts 192.168.1.64–192.168.1.127?"],[
 ["192.168.1.64 0.0.0.63","Правильно: 64 адреси, блок /26.","192.168.1.64 0.0.0.63","Correct: 64 addresses, a /26 block."],
 ["192.168.1.64 0.0.0.127","Це 128 адрес.","192.168.1.64 0.0.0.127","That is 128 addresses."],
 ["192.168.1.64 255.255.255.192","Це маска, а не wildcard.","192.168.1.64 255.255.255.192","That is a mask, not a wildcard."],
 ["192.168.1.0 0.0.0.63","Це .0–.63.","192.168.1.0 0.0.0.63","That is .0–.63."]],[0]);
mc("m-e4-2","ENSA4",["Що означає ключове слово host у рядку ACL?","What does the host keyword mean in an ACL entry?"],[
 ["Одна адреса — те саме, що wildcard 0.0.0.0","Правильно.","A single address — the same as wildcard 0.0.0.0","Correct."],
 ["Будь-яка адреса","Це any.","Any address","That is any."],
 ["Адреса маршрутизатора","Ні.","The router's address","No."],
 ["Лише хости, не мережі","Ні.","Only hosts, not networks","No."]],[0]);
mc("m-e4-3","ENSA4",["Скільки ACL можна застосувати на одному інтерфейсі?","How many ACLs can be applied on one interface?"],[
 ["Одну на протокол і на напрямок (наприклад, IPv4 in, IPv4 out, IPv6 in, IPv6 out)","Правильно: правило «трьох P».","One per protocol per direction (e.g. IPv4 in, IPv4 out, IPv6 in, IPv6 out)","Correct: the «three Ps» rule."],
 ["Скільки завгодно","Нова замінить попередню.","As many as you like","A new one replaces the previous one."],
 ["Лише одну загалом","Ні.","Only one in total","No."],
 ["Дві на напрямок","Ні.","Two per direction","No."]],[0]);
mc("m-e4-4","ENSA4",["Що станеться з трафіком, якщо застосувати ACL, що містить лише рядки deny?","What happens to traffic if you apply an ACL that contains only deny statements?"],[
 ["Блокується весь трафік: явні deny + неявний deny any","Правильно. Потрібен хоча б один permit.","All traffic is blocked: explicit denies plus the implicit deny any","Correct. At least one permit is needed."],
 ["Блокується лише вказане","Неявний deny блокує решту.","Only the listed traffic is blocked","The implicit deny blocks the rest."],
 ["ACL не застосується","Застосується.","The ACL will not apply","It will."],
 ["Дозволено все","Ні.","Everything is permitted","No."]],[0]);
mc("m-e4-5","ENSA4",["Що фільтрує стандартний ACL?","What does a standard ACL filter on?"],[
 ["Лише IPv4-адресу джерела","Правильно.","Only the source IPv4 address","Correct."],
 ["Джерело, призначення й порти","Це розширений ACL.","Source, destination and ports","That is an extended ACL."],
 ["MAC-адреси","Ні.","MAC addresses","No."],
 ["Лише адресу призначення","Ні.","Only the destination address","No."]],[0]);
mc("m-e4-6","ENSA4",["Чи фільтрує вихідний ACL на інтерфейсі пакети, згенеровані самим маршрутизатором (наприклад, його ping)?","Does an outbound ACL on an interface filter packets generated by the router itself (e.g. its own ping)?"],[
 ["Ні — вихідний ACL не застосовується до трафіку, що походить з маршрутизатора","Правильно.","No — an outbound ACL does not apply to traffic originated by the router","Correct."],
 ["Так, завжди","Ні.","Yes, always","No."],
 ["Лише ICMP","Ні.","Only ICMP","No."],
 ["Лише якщо ACL розширений","Ні.","Only if the ACL is extended","No."]],[0]);

// ===== ENSA5: налаштування ACL =====
mc("m-e5-1","ENSA5",["Як обмежити доступ до vty лише з мережі 10.0.0.0/24?","How do you restrict vty access to the 10.0.0.0/24 network only?"],[
 ["access-list 10 permit 10.0.0.0 0.0.0.255; line vty 0 15 → access-class 10 in","Правильно.","access-list 10 permit 10.0.0.0 0.0.0.255; line vty 0 15 → access-class 10 in","Correct."],
 ["ip access-group 10 in на line vty","На лініях — access-class.","ip access-group 10 in under line vty","Lines use access-class."],
 ["transport input ssh","Обмежує протокол, а не джерело.","transport input ssh","It restricts the protocol, not the source."],
 ["ip ssh source 10.0.0.0","Немає такої команди.","ip ssh source 10.0.0.0","There is no such command."]],[0]);
mc("m-e5-2","ENSA5",["Що робить ключове слово established у розширеному ACL?","What does the established keyword do in an extended ACL?"],[
 ["Дозволяє TCP-сегменти з прапорцем ACK або RST — тобто відповіді на сесії, ініційовані зсередини","Правильно.","It permits TCP segments with ACK or RST set — replies to sessions started from inside","Correct."],
 ["Дозволяє весь UDP","Ні.","It permits all UDP","No."],
 ["Перевіряє стан як stateful firewall","Ні, лише прапорці.","It checks state like a stateful firewall","No, only the flags."],
 ["Дозволяє лише SYN","Навпаки.","It permits only SYN","The opposite."]],[0]);
mc("m-e5-3","ENSA5",["Як додати рядок між 10 і 20 в іменований ACL WEB?","How do you add an entry between lines 10 and 20 in named ACL WEB?"],[
 ["ip access-list extended WEB, потім 15 permit …","Правильно.","ip access-list extended WEB, then 15 permit …","Correct."],
 ["Видалити ACL і створити заново","Можна, але не обов'язково.","Delete the ACL and recreate it","Possible, but unnecessary."],
 ["access-list WEB insert 15","Немає такої команди.","access-list WEB insert 15","There is no such command."],
 ["Неможливо","Можливо.","It is impossible","It is possible."]],[0]);
mc("m-e5-4","ENSA5",["Як застосувати IPv6 ACL на інтерфейсі?","How do you apply an IPv6 ACL to an interface?"],[
 ["ipv6 traffic-filter NAME in|out","Правильно.","ipv6 traffic-filter NAME in|out","Correct."],
 ["ipv6 access-group NAME in","Так у IPv4: ip access-group.","ipv6 access-group NAME in","IPv4 uses ip access-group."],
 ["ip access-group NAME in","Це IPv4.","ip access-group NAME in","That is IPv4."],
 ["access-class NAME in","Це для vty.","access-class NAME in","That is for vty lines."]],[0]);

// ===== ENSA6: NAT =====
mc("m-e6-1","ENSA6",["Що таке inside global адреса?","What is an inside global address?"],[
 ["Публічна адреса, якою внутрішній хост представлений в Інтернеті після NAT","Правильно.","The public address that represents an inside host on the Internet after NAT","Correct."],
 ["Приватна адреса внутрішнього хоста","Це inside local.","The inside host's private address","That is inside local."],
 ["Адреса зовнішнього сервера","Це outside global.","The address of an outside server","That is outside global."],
 ["Адреса шлюзу","Ні.","The gateway address","No."]],[0]);
mc("m-e6-2","ENSA6",["Як PAT розрізняє сесії багатьох внутрішніх хостів за однією публічною адресою?","How does PAT distinguish many inside hosts' sessions behind a single public address?"],[
 ["За номерами портів джерела (за потреби змінює їх)","Правильно.","By source port numbers (changing them if needed)","Correct."],
 ["За MAC-адресами","Ні.","By MAC addresses","No."],
 ["За TTL","Ні.","By TTL","No."],
 ["Ніяк — працює лише один хост","Ні.","It cannot — only one host works","No."]],[0]);
mc("m-e6-3","ENSA6",["Яка команда налаштовує статичний NAT для вебсервера 192.168.1.10 ↔ 203.0.113.5?","Which command configures static NAT for web server 192.168.1.10 ↔ 203.0.113.5?"],[
 ["ip nat inside source static 192.168.1.10 203.0.113.5","Правильно.","ip nat inside source static 192.168.1.10 203.0.113.5","Correct."],
 ["ip nat outside source static 192.168.1.10 203.0.113.5","Це для зовнішніх адрес.","ip nat outside source static 192.168.1.10 203.0.113.5","That is for outside addresses."],
 ["ip nat pool WEB 203.0.113.5 203.0.113.5","Це пул для динамічного NAT.","ip nat pool WEB 203.0.113.5 203.0.113.5","That is a pool for dynamic NAT."],
 ["ip nat inside source list 1 interface g0/1 overload","Це PAT.","ip nat inside source list 1 interface g0/1 overload","That is PAT."]],[0]);
mc("m-e6-4","ENSA6",["Яка команда очищає динамічні записи NAT?","Which command clears dynamic NAT entries?"],[
 ["clear ip nat translation *","Правильно.","clear ip nat translation *","Correct."],
 ["no ip nat","Ні.","no ip nat","No."],
 ["clear ip route *","Це маршрути.","clear ip route *","Those are routes."],
 ["reset nat","Немає такої команди.","reset nat","There is no such command."]],[0]);

// ===== ENSA7: принципи WAN =====
mc("m-e7-1","ENSA7",["Яка перевага MPLS VPN від провайдера порівняно з виділеними лініями?","What is an advantage of a provider MPLS VPN over leased lines?"],[
 ["Повнозв'язна (any-to-any) мережа між філіями без окремої лінії для кожної пари й з підтримкою QoS","Правильно.","An any-to-any network between branches without a separate line for each pair, with QoS support","Correct."],
 ["Шифрування за замовчуванням","MPLS сам не шифрує.","Encryption by default","MPLS does not encrypt by itself."],
 ["Безкоштовність","Ні.","It is free","No."],
 ["Не потрібен провайдер","Потрібен.","No provider is needed","One is needed."]],[0]);
mc("m-e7-2","ENSA7",["Який пристрій перетворює цифровий сигнал на сигнал кабельної мережі (DOCSIS)?","Which device converts digital data to a cable network (DOCSIS) signal?"],[
 ["Кабельний модем","Правильно.","A cable modem","Correct."],
 ["DSL-модем","Це для телефонних ліній.","A DSL modem","That is for phone lines."],
 ["CSU/DSU","Це для цифрових виділених ліній T1/E1.","A CSU/DSU","That is for T1/E1 digital leased lines."],
 ["Комутатор доступу","Ні.","An access switch","No."]],[0]);
mc("m-e7-3","ENSA7",["Що таке топологія hub-and-spoke у WAN?","What is a hub-and-spoke WAN topology?"],[
 ["Філії під'єднані до центрального вузла, і трафік між філіями проходить через нього","Правильно.","Branches connect to a central site, and branch-to-branch traffic passes through it","Correct."],
 ["Кожна філія з'єднана з кожною","Це full mesh.","Every branch connects to every other","That is full mesh."],
 ["Одне з'єднання між двома точками","Це point-to-point.","A single link between two sites","That is point-to-point."],
 ["Кілька провайдерів","Це dual-homed / multihomed.","Several providers","That is dual-homed / multihomed."]],[0]);

// ===== ENSA9: QoS =====
mc("m-e9-1","ENSA9",["Які вимоги до голосового трафіку (VoIP) зазвичай рекомендують?","What requirements are usually recommended for voice (VoIP) traffic?"],[
 ["Затримка ≤ 150 мс в один бік, джитер ≤ 30 мс, втрати ≤ 1%","Правильно.","One-way delay ≤ 150 ms, jitter ≤ 30 ms, loss ≤ 1%","Correct."],
 ["Затримка ≤ 1 с","Занадто багато.","Delay ≤ 1 s","Far too much."],
 ["Втрати до 10%","Занадто багато.","Loss up to 10%","Far too much."],
 ["Голос нечутливий до затримки","Чутливий.","Voice is not sensitive to delay","It is sensitive."]],[0]);
mc("m-e9-2","ENSA9",["Що робить LLQ?","What does LLQ do?"],[
 ["Додає до CBWFQ чергу строгого пріоритету для голосу, обмежену policer-ом","Правильно.","It adds a strict-priority queue for voice to CBWFQ, limited by a policer","Correct."],
 ["Відкидає пакети випадково до переповнення черги","Це WRED.","It randomly drops packets before the queue fills","That is WRED."],
 ["Ділить смугу порівну між потоками","Це WFQ.","It shares bandwidth equally among flows","That is WFQ."],
 ["Обслуговує пакети в порядку надходження","Це FIFO.","It serves packets in arrival order","That is FIFO."]],[0]);
mc("m-e9-3","ENSA9",["Де найкраще класифікувати й маркувати трафік?","Where is the best place to classify and mark traffic?"],[
 ["Якомога ближче до джерела — на межі довіри (trust boundary), наприклад на IP-телефоні або access-комутаторі","Правильно.","As close to the source as possible — at the trust boundary, e.g. the IP phone or access switch","Correct."],
 ["На маршрутизаторі ядра","Занадто пізно.","On the core router","Too late."],
 ["У провайдера","Провайдер може не довіряти міткам.","At the provider","The provider may not trust the markings."],
 ["На сервері призначення","Занадто пізно.","On the destination server","Too late."]],[0]);

// ===== ENSA11: проєктування мережі =====
mc("m-e11-1","ENSA11",["Що таке collapsed core?","What is a collapsed core?"],[
 ["Дворівнева модель, де рівні ядра й розподілу об'єднано в одних комутаторах","Правильно. Типово для середніх мереж.","A two-tier design where the core and distribution layers are combined in the same switches","Correct. Typical for medium networks."],
 ["Ядро, що вийшло з ладу","Ні.","A core that has failed","No."],
 ["Мережа без рівня доступу","Ні.","A network without an access layer","No."],
 ["Ядро в хмарі","Ні.","A core in the cloud","No."]],[0]);
mc("m-e11-2","ENSA11",["Яка характеристика комутатора важлива на рівні доступу для IP-телефонів і точок доступу?","Which switch feature matters at the access layer for IP phones and access points?"],[
 ["PoE (живлення через Ethernet)","Правильно.","PoE (Power over Ethernet)","Correct."],
 ["Висока швидкість пересилання між VLAN","Це для розподілу/ядра.","High inter-VLAN forwarding speed","That is for distribution/core."],
 ["Підтримка BGP","Ні.","BGP support","No."],
 ["Велика таблиця маршрутизації","Ні.","A large routing table","No."]],[0]);
mc("m-e11-3","ENSA11",["Що таке переподписка (oversubscription) на аплінку?","What is oversubscription on an uplink?"],[
 ["Сумарна смуга портів доступу перевищує смугу аплінку (наприклад, 48×1G до 2×10G = 2,4:1)","Правильно: допустимо, бо порти рідко завантажені одночасно.","The total access port bandwidth exceeds the uplink bandwidth (e.g. 48×1G to 2×10G = 2.4:1)","Correct: acceptable because ports are rarely busy at the same time."],
 ["Помилка ліцензування","Ні.","A licensing error","No."],
 ["Занадто багато VLAN","Ні.","Too many VLANs","No."],
 ["Дублювання IP-адрес","Ні.","Duplicate IP addresses","No."]],[0]);
mc("m-e11-4","ENSA11",["Чим stackable-комутатори зручні в проєктуванні?","Why are stackable switches convenient in network design?"],[
 ["Кілька фізичних комутаторів працюють як один логічний: одна точка керування, EtherChannel між членами стека","Правильно.","Several physical switches act as one logical switch: a single management point and EtherChannel across members","Correct."],
 ["Вони не потребують живлення","Ні.","They need no power","No."],
 ["Вони маршрутизують BGP","Ні.","They route BGP","No."],
 ["Вони замінюють WLC","Ні.","They replace the WLC","No."]],[0]);
})();
