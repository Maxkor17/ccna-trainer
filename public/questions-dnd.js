// Питання «перетягни в категорію» (drag-and-drop, як на іспиті CCNA). Тип "cat":
// cats — назви категорій, items — [текст, індекс правильної категорії]. Двомовні: UA і EN поруч.
(function(){ const QB=window.QB_DND=[], TR=window.QB_TR=window.QB_TR||{};
// cat(id, тема, [питання UA, EN], [[категорія UA, EN]…], [[елемент UA, EN, категорія]…], [пояснення UA, EN])
const cat=(id,t,q,cats,items,e)=>{ QB.push({id,t,type:"cat",q:q[0],cats:cats.map(c=>c[0]),items:items.map(x=>[x[0],x[2]]),e:e[0]});
  TR[id]={q:q[1],cats:cats.map(c=>c[1]),items:items.map(x=>[x[1],x[2]]),e:e[1]}; };
cat("dd-osi","ITN3",["Перетягніть протоколи на рівні моделі OSI.","Drag the protocols to the OSI layers."],
 [["Прикладний (7)","Application (7)"],["Транспортний (4)","Transport (4)"],["Мережевий (3)","Network (3)"],["Канальний (2)","Data link (2)"]],
 [["HTTP","HTTP",0],["DNS","DNS",0],["TCP","TCP",1],["UDP","UDP",1],["IPv4","IPv4",2],["ICMP","ICMP",2],["Ethernet II","Ethernet II",3],["802.11 (MAC-підрівень)","802.11 (MAC sublayer)",3]],
 ["DNS і HTTP — прикладні протоколи, TCP/UDP — транспорт, IP і ICMP — мережевий рівень, Ethernet і 802.11 — канальний.","DNS and HTTP are application protocols, TCP/UDP are transport, IP and ICMP are network layer, Ethernet and 802.11 are data link."]);
cat("dd-tcpudp","ITN14",["Віднесіть характеристики до TCP або UDP.","Assign each characteristic to TCP or UDP."],
 [["TCP","TCP"],["UDP","UDP"]],
 [["Встановлює сесію (триетапне рукостискання)","Establishes a session (three-way handshake)",0],["Підтверджує отримання й повторно передає втрачене","Acknowledges data and retransmits lost segments",0],["Керує потоком через розмір вікна","Uses window size for flow control",0],["Нумерує сегменти для збирання в правильному порядку","Numbers segments so they can be reassembled in order",0],["Мінімальний заголовок — 8 байтів","Minimal 8-byte header",1],["Без підтверджень — підходить для VoIP і відео","No acknowledgments — suits VoIP and video",1],["Використовується для звичайних запитів DNS і DHCP","Used for regular DNS queries and DHCP",1]],
 ["TCP надійний і з установленням з'єднання; UDP швидкий і без підтверджень.","TCP is reliable and connection-oriented; UDP is fast and has no acknowledgments."]);
cat("dd-priv","ITN11",["Розподіліть адреси на приватні (RFC 1918) і публічні.","Sort the addresses into private (RFC 1918) and public."],
 [["Приватна","Private"],["Публічна","Public"]],
 [["10.200.5.1","10.200.5.1",0],["172.20.0.9","172.20.0.9",0],["192.168.77.1","192.168.77.1",0],["172.32.1.1","172.32.1.1",1],["192.169.1.1","192.169.1.1",1],["8.8.4.4","8.8.4.4",1],["11.0.0.1","11.0.0.1",1]],
 ["Приватні: 10.0.0.0/8, 172.16.0.0/12 (172.16–172.31), 192.168.0.0/16. 172.32.x.x і 192.169.x.x — уже публічні.","Private: 10.0.0.0/8, 172.16.0.0/12 (172.16–172.31), 192.168.0.0/16. 172.32.x.x and 192.169.x.x are public."]);
cat("dd-v6","ITN12",["Визначте тип кожної IPv6-адреси.","Identify the type of each IPv6 address."],
 [["Link-local","Link-local"],["Глобальна unicast","Global unicast"],["Унікальна локальна (ULA)","Unique local (ULA)"],["Multicast","Multicast"]],
 [["FE80::1","FE80::1",0],["FE80::A8BB:CCFF:FE00:1","FE80::A8BB:CCFF:FE00:1",0],["2001:DB8:ACAD:1::10","2001:DB8:ACAD:1::10",1],["2A00:1450:4001::200E","2A00:1450:4001::200E",1],["FD12:3456:789A::1","FD12:3456:789A::1",2],["FF02::1","FF02::1",3],["FF02::1:FF00:10","FF02::1:FF00:10",3]],
 ["FE80::/10 — link-local, 2000::/3 — глобальні, FC00::/7 (на практиці FD) — ULA, FF00::/8 — multicast (FF02::1:FFxx:xxxx — solicited-node).","FE80::/10 is link-local, 2000::/3 global, FC00::/7 (FD in practice) ULA, FF00::/8 multicast (FF02::1:FFxx:xxxx is solicited-node)."]);
cat("dd-sw","SRWE2",["Віднесіть властивості до методу комутації.","Assign the properties to the switching method."],
 [["Store-and-forward","Store-and-forward"],["Cut-through","Cut-through"]],
 [["Перевіряє FCS і відкидає пошкоджені кадри","Checks the FCS and drops damaged frames",0],["Потрібен для QoS-аналізу й комутації між портами різної швидкості","Required for QoS analysis and switching between ports of different speeds",0],["Буферизує кадр повністю","Buffers the whole frame",0],["Починає пересилати, щойно прочитано MAC призначення","Starts forwarding as soon as the destination MAC is read",1],["Мінімальна затримка, але може пересилати пошкоджені кадри","Lowest latency, but may forward corrupted frames",1],["Варіант fragment-free перевіряє перші 64 байти","The fragment-free variant checks the first 64 bytes",1]],
 ["Store-and-forward — основний метод Cisco Catalyst; cut-through швидший, але не перевіряє FCS.","Store-and-forward is the main Cisco Catalyst method; cut-through is faster but does not check the FCS."]);
cat("dd-rstp","SRWE5",["Яким станам RSTP відповідають стани класичного 802.1D?","Which RSTP state corresponds to each classic 802.1D state?"],
 [["Discarding","Discarding"],["Learning","Learning"],["Forwarding","Forwarding"]],
 [["Disabled","Disabled",0],["Blocking","Blocking",0],["Listening","Listening",0],["Learning","Learning",1],["Forwarding","Forwarding",2]],
 ["RSTP об'єднав disabled, blocking і listening в один стан discarding.","RSTP merged disabled, blocking and listening into one discarding state."]);
cat("dd-ec","SRWE6",["Віднесіть режими channel-group до протоколу.","Assign the channel-group modes to the protocol."],
 [["LACP (802.3ad)","LACP (802.3ad)"],["PAgP (Cisco)","PAgP (Cisco)"],["Без протоколу","No protocol"]],
 [["active","active",0],["passive","passive",0],["desirable","desirable",1],["auto","auto",1],["on","on",2]],
 ["LACP: active/passive; PAgP: desirable/auto; on — статичне об'єднання без переговорів.","LACP: active/passive; PAgP: desirable/auto; on is a static bundle without negotiation."]);
cat("dd-fhrp","SRWE9",["Віднесіть ознаки до протоколу резервування шлюзу.","Assign each feature to the first-hop redundancy protocol."],
 [["HSRP","HSRP"],["VRRP","VRRP"],["GLBP","GLBP"]],
 [["Пропрієтарний Cisco, ролі active/standby","Cisco proprietary, active/standby roles",0],["Віртуальна MAC 0000.0C07.ACxx (v1)","Virtual MAC 0000.0C07.ACxx (v1)",0],["Відкритий стандарт RFC 5798","Open standard RFC 5798",1],["Preempt увімкнено за замовчуванням, ролі master/backup","Preempt on by default, master/backup roles",1],["Віртуальна MAC 0000.5E00.01xx","Virtual MAC 0000.5E00.01xx",1],["AVG роздає різні віртуальні MAC — балансування в одній групі","The AVG hands out different virtual MACs — load balancing in one group",2]],
 ["HSRP і GLBP — Cisco; VRRP — стандарт. Балансування в межах однієї групи вміє лише GLBP.","HSRP and GLBP are Cisco; VRRP is a standard. Only GLBP load-balances within one group."]);
cat("dd-l2sec","SRWE11",["Зіставте атаку із засобом захисту на комутаторі.","Match each attack with the switch feature that mitigates it."],
 [["Port security","Port security"],["DHCP snooping","DHCP snooping"],["Dynamic ARP Inspection","Dynamic ARP Inspection"],["BPDU guard / root guard","BPDU guard / root guard"],["Вимкнути DTP, змінити native VLAN","Disable DTP, change the native VLAN"]],
 [["Переповнення MAC-таблиці","MAC address table overflow",0],["Фальшивий DHCP-сервер","Rogue DHCP server",1],["Виснаження пулу DHCP (starvation)","DHCP starvation",1],["ARP spoofing / отруєння ARP-кешу","ARP spoofing / ARP cache poisoning",2],["Підключення комутатора з пріоритетом 0","Connecting a switch with priority 0",3],["VLAN hopping через підробку trunk","VLAN hopping by spoofing a trunk",4],["Подвійне тегування 802.1Q","802.1Q double tagging",4]],
 ["DHCP snooping обмежує й starvation (rate limit), і фальшиві сервери (untrusted-порти). DAI спирається на таблицю прив'язок DHCP snooping.","DHCP snooping limits starvation (rate limit) and rogue servers (untrusted ports). DAI relies on the DHCP snooping binding table."]);
cat("dd-band","SRWE12",["Віднесіть ознаки до діапазону Wi-Fi.","Assign each feature to the Wi-Fi band."],
 [["2,4 ГГц","2.4 GHz"],["5 ГГц","5 GHz"]],
 [["Лише три неперекривні канали (1, 6, 11)","Only three non-overlapping channels (1, 6, 11)",0],["Краще проходить крізь стіни, більша дальність","Better wall penetration, longer range",0],["Багато перешкод від мікрохвильовок і Bluetooth","Lots of interference from microwaves and Bluetooth",0],["Стандарти 802.11b/g","802.11b/g standards",0],["Значно більше неперекривних каналів","Many more non-overlapping channels",1],["Стандарти 802.11a/ac","802.11a/ac standards",1],["Менша дальність, але менше завантажений ефір","Shorter range but a less crowded spectrum",1]],
 ["802.11n і 802.11ax працюють в обох діапазонах.","802.11n and 802.11ax work in both bands."]);
cat("dd-route","SRWE14",["Віднесіть переваги до статичної чи динамічної маршрутизації.","Assign each advantage to static or dynamic routing."],
 [["Статична","Static"],["Динамічна","Dynamic"]],
 [["Немає службового трафіку протоколу маршрутизації","No routing protocol overhead",0],["Безпечніша: маршрути не оголошуються в мережу","More secure: routes are not advertised",0],["Передбачуваний шлях","Predictable path",0],["Сама реагує на зміни топології","Adapts automatically to topology changes",1],["Добре масштабується для великих мереж","Scales well for large networks",1],["Менше ручної роботи при додаванні мереж","Less manual work when networks are added",1]],
 ["На практиці їх поєднують: динамічна маршрутизація всередині, статичний маршрут за замовчуванням до провайдера.","In practice they are combined: dynamic routing inside, a static default route to the ISP."]);
cat("dd-ospfst","ENSA1",["Віднесіть стани OSPF до етапу.","Assign the OSPF states to the phase."],
 [["Пошук сусідів","Neighbor discovery"],["Синхронізація бази (LSDB)","Database (LSDB) synchronization"]],
 [["Down","Down",0],["Init","Init",0],["Two-Way","Two-Way",0],["ExStart","ExStart",1],["Exchange","Exchange",1],["Loading","Loading",1],["Full","Full",1]],
 ["На multiaccess-мережах DROTHER-и залишаються в Two-Way між собою, а з DR/BDR доходять до Full.","On multiaccess networks DROTHERs stay in Two-Way with each other and reach Full with the DR/BDR."]);
cat("dd-acl","ENSA4",["Віднесіть твердження до стандартного чи розширеного ACL.","Assign each statement to a standard or extended ACL."],
 [["Стандартний","Standard"],["Розширений","Extended"]],
 [["Фільтрує лише за адресою джерела","Filters only on the source address",0],["Номери 1–99 і 1300–1999","Numbers 1–99 and 1300–1999",0],["Розміщують якомога ближче до призначення","Placed as close to the destination as possible",0],["Може фільтрувати за протоколом і портом","Can filter by protocol and port",1],["Номери 100–199 і 2000–2699","Numbers 100–199 and 2000–2699",1],["Розміщують якомога ближче до джерела","Placed as close to the source as possible",1]],
 ["Розширений ACL біля джерела не пускає зайвий трафік у мережу; стандартний біля джерела заблокував би занадто багато.","An extended ACL near the source keeps unwanted traffic off the network; a standard one near the source would block too much."]);
cat("dd-nat","ENSA6",["ПК 192.168.1.10 відкриває сайт 203.0.113.80; R1 транслює ПК у 209.165.200.226. Визначте тип кожної адреси.","PC 192.168.1.10 opens a website at 203.0.113.80; R1 translates the PC to 209.165.200.226. Identify each address type."],
 [["Inside local","Inside local"],["Inside global","Inside global"],["Outside global","Outside global"]],
 [["192.168.1.10","192.168.1.10",0],["209.165.200.226","209.165.200.226",1],["203.0.113.80","203.0.113.80",2]],
 ["Inside — наш хост: local — до трансляції, global — після. Outside global — реальна адреса зовнішнього сервера.","Inside is our host: local before translation, global after. Outside global is the outside server's real address."]);
cat("dd-attack","ENSA3",["Віднесіть атаки до категорії.","Assign each attack to its category."],
 [["Розвідка","Reconnaissance"],["Атака доступу","Access attack"],["Відмова в обслуговуванні","Denial of service"]],
 [["Ping sweep","Ping sweep",0],["Сканування портів","Port scanning",0],["Запити whois і DNS про ціль","whois and DNS queries about the target",0],["Підбір пароля","Password brute force",1],["Людина посередині","Man-in-the-middle",1],["Експлуатація довіри між хостами","Trust exploitation",1],["SYN flood","SYN flood",2],["Ботнет (DDoS)","Botnet (DDoS)",2]],
 ["Розвідка збирає інформацію, атака доступу отримує неавторизований доступ, DoS вимикає сервіс.","Reconnaissance gathers information, an access attack gains unauthorized access, DoS takes a service down."]);
cat("dd-qos","ENSA9",["Віднесіть механізми QoS до їхньої ролі.","Assign the QoS mechanisms to their role."],
 [["Класифікація й маркування","Classification and marking"],["Керування чергами","Queuing"],["Уникнення перевантаження","Congestion avoidance"],["Обмеження швидкості","Rate limiting"]],
 [["DSCP","DSCP",0],["CoS (802.1p)","CoS (802.1p)",0],["NBAR","NBAR",0],["LLQ","LLQ",1],["CBWFQ","CBWFQ",1],["WRED","WRED",2],["Policing","Policing",3],["Shaping","Shaping",3]],
 ["Policing відкидає надлишок, shaping його буферизує й згладжує.","Policing drops the excess; shaping buffers and smooths it."]);
cat("dd-wan","ENSA7",["Віднесіть варіанти підключення до типу WAN.","Assign each connection option to the WAN type."],
 [["Приватна WAN","Private WAN"],["Через Інтернет","Internet-based"]],
 [["Виділена лінія (leased line)","Leased line",0],["MPLS VPN провайдера","Provider MPLS VPN",0],["Metro Ethernet","Metro Ethernet",0],["DSL","DSL",1],["Кабель (DOCSIS)","Cable (DOCSIS)",1],["4G/5G","4G/5G",1],["Site-to-site IPsec VPN через Інтернет","Site-to-site IPsec VPN over the Internet",1]],
 ["Приватна WAN дає гарантії від провайдера; інтернет-варіанти дешевші, а безпеку забезпечує VPN.","A private WAN comes with provider guarantees; Internet options are cheaper, with VPN providing security."]);
cat("dd-planes","ENSA13",["Віднесіть функції до площини мережевого пристрою.","Assign each function to the plane of a network device."],
 [["Площина керування (control)","Control plane"],["Площина даних (data)","Data plane"],["Площина управління (management)","Management plane"]],
 [["Обмін маршрутами OSPF","OSPF route exchange",0],["Обчислення STP","STP calculation",0],["Пересилання пакетів за FIB/CEF","Packet forwarding using the FIB/CEF",1],["Застосування ACL до транзитних пакетів","Applying ACLs to transit packets",1],["SSH-доступ адміністратора","Administrator SSH access",2],["SNMP і syslog","SNMP and syslog",2]],
 ["SDN-контролер переносить площину керування з пристроїв у центральний контролер.","An SDN controller moves the control plane from the devices to a central controller."]);
})();
