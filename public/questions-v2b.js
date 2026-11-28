// Тонкі теми CCNA v2.0 — друга порція (60 питань): RA guard, агентний AI і промпти, extended ping і traceroute, гіпервізори, контейнери й хмара,
// OSPFv3 і типи мереж OSPF, storm control, VRRP, діагностика клієнтів, DNS, SFTP/SCP, AAA і 802.1X, Wi-Fi 6/6E, REST, PoE, IPv6. Двомовні записи.
(function(){ const QB=window.QB_V2B=[], TR=window.QB_TR=window.QB_TR||{};
const perm=(id,n)=>{ let h=2166136261; for(const c of id) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0; const p=[...Array(n).keys()]; for(let i=n-1;i>0;i--){ h=Math.imul(h^(h>>>13),1597334677)>>>0; const j=h%(i+1); [p[i],p[j]]=[p[j],p[i]]; } return p; };
const mix=(id,o,a)=>{ const p=perm(id,o.length); return {o:p.map(i=>o[i]), a:a.map(x=>p.indexOf(x)).sort((x,y)=>x-y)}; };
const mc=(id,t,q,o0,a0)=>{ const {o,a}=mix(id,o0,a0); QB.push({id,t,q:q[0],o:o.map(x=>[x[0],x[1]]),a,v2:1}); TR[id]={q:q[1],o:o.map(x=>[x[2],x[3]])}; };
const W="Ні.", Wen="No.";

// ----- RA guard -----
mc("v2b-ra-1","SRWE11",["Від якої атаки захищає IPv6 RA guard?","Which attack does IPv6 RA guard protect against?"],[
 ["Від фальшивих Router Advertisement: зловмисник оголошує себе шлюзом і перехоплює трафік","Правильно: RA guard блокує RA з портів, де маршрутизатора бути не може.","Rogue Router Advertisements: an attacker announces itself as the gateway and intercepts traffic","Correct: RA guard blocks RAs from ports where no router should be."],
 ["Від підбору пароля SSH","Це завдання login block-for і ACL на VTY.","SSH password guessing","That is the job of login block-for and VTY ACLs."],
 ["Від широкомовного шторму","Для цього storm control.","A broadcast storm","That is storm control."],
 ["Від фальшивого DHCPv4-сервера","Для цього DHCP snooping.","A rogue DHCPv4 server","That is DHCP snooping."]],[0]);
mc("v2b-ra-2","SRWE11",["На якому порту комутатора RA guard має пропускати Router Advertisement?","On which switch port should RA guard allow Router Advertisements?"],[
 ["На порту до справжнього маршрутизатора (політика device-role router)","Правильно: решта портів — device-role host, RA з них відкидаються.","On the port facing the real router (policy device-role router)","Correct: other ports use device-role host and their RAs are dropped."],
 ["На всіх портах доступу","Тоді будь-який ПК зможе стати шлюзом.","On all access ports","Then any PC could become a gateway."],
 ["Лише на портах з PortFast","PortFast не стосується RA.","Only on PortFast ports","PortFast is unrelated to RAs."],
 ["На жодному: RA взагалі не потрібні","Без RA не працюють SLAAC і шлюз за замовчуванням IPv6.","On none: RAs are not needed","Without RAs, SLAAC and the IPv6 default gateway don't work."]],[0]);
mc("v2b-ra-3","SRWE11",["Яким механізмом IPv4 найближче відповідає IPv6 RA guard за ідеєю?","Which IPv4 mechanism is conceptually closest to IPv6 RA guard?"],[
 ["DHCP snooping: довірені й недовірені порти для службових повідомлень","Правильно: обидва дозволяють службові відповіді лише з довірених портів.","DHCP snooping: trusted and untrusted ports for control messages","Correct: both allow control replies only from trusted ports."],
 ["NAT","NAT транслює адреси.","NAT","NAT translates addresses."],
 ["HSRP","HSRP — резервування шлюзу.","HSRP","HSRP provides gateway redundancy."],
 ["Port security","Port security обмежує MAC-адреси.","Port security","Port security limits MAC addresses."]],[0]);
mc("v2b-ra-4","SRWE11",["ПК у VLAN отримали IPv6-адреси з чужим префіксом і шлюзом — ноутбук гостя з увімкненим спільним доступом до Інтернету. Що налаштувати на комутаторі?","PCs in a VLAN got IPv6 addresses with a foreign prefix and gateway from a guest laptop with Internet sharing on. What should be configured on the switch?"],[
 ["IPv6 RA guard з політикою host на портах доступу","Правильно.","IPv6 RA guard with a host policy on access ports","Correct."],
 ["BPDU guard","Ноутбук не надсилає BPDU.","BPDU guard","The laptop sends no BPDUs."],
 ["Storm control","Проблема не в обсязі трафіку.","Storm control","The problem is not traffic volume."],
 ["Вимкнути IPv6 на маршрутизаторі","Тоді зламається легітимний IPv6.","Disable IPv6 on the router","That breaks legitimate IPv6."]],[0]);

// ----- Агентний AI і промпти -----
mc("v2b-ai-1","ENSA14",["Що таке «інструмент» (tool) для AI-агента в мережевих операціях?","What is a tool for an AI agent in network operations?"],[
 ["Функція, яку агент може викликати: show-команда, запит до API контролера, створення тікета","Правильно: агент вирішує, що викликати, а інструмент виконує дію.","A function the agent can call: a show command, a controller API request, creating a ticket","Correct: the agent decides what to call and the tool performs the action."],
 ["Фізичний інструмент для обтискання кабелю","Ні, мова про програмні функції.","A physical crimping tool","No, this is about software functions."],
 ["Сам мовний модель без доступу до мережі","Модель без інструментів не може діяти.","The language model itself with no network access","A model without tools cannot act."],
 ["Обов'язково SNMP-трап","Трап — лише один із можливих джерел даних.","Necessarily an SNMP trap","A trap is only one possible data source."]],[0]);
mc("v2b-ai-2","ENSA14",["Які права найкраще дати AI-агенту, що лише діагностує проблеми мережі?","Which permissions are best for an AI agent that only troubleshoots the network?"],[
 ["Лише на читання: show-команди й телеметрія, без права змінювати конфігурацію","Правильно: принцип найменших привілеїв.","Read-only: show commands and telemetry, no right to change configuration","Correct: least privilege."],
 ["Privilege 15 на всіх пристроях","Зайві права — ризик помилки чи зловживання.","Privilege 15 on all devices","Excess rights risk mistakes or abuse."],
 ["Обліковий запис адміністратора домену","Діагностиці мережі він не потрібен.","A domain admin account","Network troubleshooting doesn't need it."],
 ["Права не важливі, якщо модель розумна","Права обмежують наслідки будь-якої помилки.","Permissions don't matter if the model is smart","Permissions limit the impact of any mistake."]],[0]);
mc("v2b-ai-3","ENSA14",["Що таке «галюцинація» генеративного AI?","What is a generative AI hallucination?"],[
 ["Впевнена, але неправдива відповідь — наприклад, команда IOS, якої не існує","Правильно: тому результат перевіряють у лабі чи документації.","A confident but false answer — e.g., an IOS command that does not exist","Correct: that's why output is verified in a lab or documentation."],
 ["Збій живлення сервера з моделлю","Ні.","A power failure on the model's server","No."],
 ["Затримка відповіді","Затримка — не галюцинація.","Response latency","Latency is not a hallucination."],
 ["Відмова відповідати","Відмова — інша ситуація.","Refusing to answer","Refusal is a different situation."]],[0]);
mc("v2b-ai-4","ENSA14",["Який промпт до GenAI найкращий для створення конфігурації?","Which GenAI prompt is best for generating a configuration?"],[
 ["«Ти мережевий інженер. Згенеруй конфігурацію Cisco IOS для 2960: VLAN 10 USERS і 20 VOICE, порти Fa0/1–12 у VLAN 10 з voice VLAN 20, trunk Gi0/1 з native 99. Поверни лише команди, без пояснень.»","Правильно: роль, контекст, конкретні вимоги й формат відповіді.","\"You are a network engineer. Generate Cisco IOS config for a 2960: VLAN 10 USERS and 20 VOICE, ports Fa0/1–12 in VLAN 10 with voice VLAN 20, trunk Gi0/1 with native 99. Return only commands, no explanations.\"","Correct: role, context, specific requirements and output format."],
 ["«Зроби налаштування комутатора»","Немає моделі, вимог і формату.","\"Configure the switch\"","No model, requirements or format."],
 ["«Напиши щось про VLAN»","Це не запит на конфігурацію.","\"Write something about VLANs\"","That is not a configuration request."],
 ["«Конфіг, швидко!!!»","Емоції не замінюють вимог.","\"Config, quickly!!!\"","Urgency doesn't replace requirements."]],[0]);
mc("v2b-ai-5","ENSA14",["Що не можна вставляти в промпт публічного AI-сервісу?","What must not be pasted into a public AI service prompt?"],[
 ["Паролі, ключі, секрети SNMP і повні конфігурації з чутливими даними","Правильно: такі дані можуть зберігатися на стороні сервісу.","Passwords, keys, SNMP secrets and full configs with sensitive data","Correct: such data may be stored by the service."],
 ["Загальне питання про OSPF","Загальні питання безпечні.","A general OSPF question","General questions are safe."],
 ["Опис помилки без адрес і паролів","Знеособлені дані допустимі.","An error description without addresses or passwords","Sanitized data is acceptable."],
 ["Номер версії IOS","Зазвичай не секрет.","The IOS version number","Usually not a secret."]],[0]);
mc("v2b-ai-6","ENSA14",["Навіщо в промпті вказують формат відповіді (наприклад, JSON з полями interface, status)?","Why specify the output format (e.g., JSON with interface and status fields) in a prompt?"],[
 ["Щоб відповідь можна було автоматично обробити скриптом","Правильно: структурований вивід легко парсити.","So a script can process the answer automatically","Correct: structured output is easy to parse."],
 ["Щоб модель працювала швидше","Формат не про швидкість.","So the model runs faster","Format is not about speed."],
 ["JSON обов'язковий для будь-якого запиту","Ні, лише коли це потрібно.","JSON is mandatory for every request","No, only when needed."],
 ["Щоб приховати дані","Формат нічого не приховує.","To hide data","Format hides nothing."]],[0]);
mc("v2b-ai-7","ENSA14",["Що найкраще описує роль людини, коли AI-агент пропонує зміни в мережі?","What best describes the human's role when an AI agent proposes network changes?"],[
 ["Human-in-the-loop: людина перевіряє, затверджує й відповідає за зміну","Правильно.","Human in the loop: a person reviews, approves and owns the change","Correct."],
 ["Людина не потрібна, якщо агент сертифікований","Відповідальність лишається за людьми.","No human needed if the agent is certified","Accountability stays with people."],
 ["Людина лише читає звіт після інциденту","Пізно — затвердження має бути до зміни.","The human only reads the post-incident report","Too late — approval must come before the change."],
 ["Агент і людина вносять зміни одночасно","Це створює конфлікти.","The agent and human change things simultaneously","That creates conflicts."]],[0]);

// ----- Extended ping і traceroute -----
mc("v2b-xp-1","SRWE16",["Ping з маршрутизатора R1 до сервера успішний, а з ПК у LAN за R1 — ні. Яка команда на R1 найкраще перевірить шлях від імені LAN?","A ping from router R1 to a server succeeds, but from a PC on R1's LAN it fails. Which R1 command best tests the path on behalf of the LAN?"],[
 ["ping <сервер> source <LAN-інтерфейс>","Правильно: extended ping з адресою джерела LAN перевіряє і зворотний маршрут до LAN.","ping <server> source <LAN interface>","Correct: an extended ping sourced from the LAN address also tests the return route to the LAN."],
 ["ping <сервер> repeat 100","Більше пакетів, але той самий source.","ping <server> repeat 100","More packets but the same source."],
 ["show ip interface brief","Не перевіряє шлях.","show ip interface brief","Doesn't test the path."],
 ["show cdp neighbors","Показує сусідів, а не маршрути.","show cdp neighbors","Shows neighbors, not routes."]],[0]);
mc("v2b-xp-2","SRWE16",["Яку IP-адресу джерела використовує звичайний ping з маршрутизатора?","Which source IP does a plain ping from a router use?"],[
 ["Адресу вихідного інтерфейсу до призначення","Правильно.","The address of the egress interface toward the destination","Correct."],
 ["Адресу Loopback0","Лише якщо вказати source.","The Loopback0 address","Only if you specify source."],
 ["Найбільшу IP на маршрутизаторі","Так обирається router ID, а не source ping.","The highest IP on the router","That is how a router ID is chosen, not the ping source."],
 ["0.0.0.0","Ні.","0.0.0.0","No."]],[0]);
mc("v2b-xp-3","SRWE16",["Що означає «U.U.U» у ping з Cisco?","What does \"U.U.U\" mean in a Cisco ping?"],[
 ["Маршрутизатор на шляху надсилає ICMP unreachable: немає маршруту або пакет відкинув ACL","Правильно.","A router on the path sends ICMP unreachable: no route or an ACL dropped the packet","Correct."],
 ["Усі відповіді отримано","Це «!!!!!».","All replies received","That is \"!!!!!\"."],
 ["Таймаут без відповіді","Це «.....».","Timeout with no reply","That is \".....\"."],
 ["Перевищено TTL","У traceroute, не в ping.","TTL exceeded","That shows in traceroute, not ping."]],[0]);
mc("v2b-xp-4","SRWE16",["Перший пакет ping з маршрутизатора губиться («.!!!!»), решта проходять. Чому?","The first router ping packet is lost (\".!!!!\"), the rest succeed. Why?"],[
 ["Маршрутизатор робив ARP для наступного переходу й відкинув перший пакет","Правильно: це нормально при першому зверненні.","The router was ARPing for the next hop and dropped the first packet","Correct: this is normal on first contact."],
 ["Ушкоджений кабель","Тоді втрати були б випадковими.","A damaged cable","Then losses would be random."],
 ["ACL блокує перший пакет","ACL не діє лише на перший пакет.","An ACL blocks the first packet","An ACL doesn't act on the first packet only."],
 ["Неправильна маска","Тоді не проходили б усі пакети.","A wrong mask","Then all packets would fail."]],[0]);
mc("v2b-xp-5","SRWE16",["traceroute показує перші два переходи, далі «* * *» до кінця. Що це найчастіше означає?","traceroute shows the first two hops and then \"* * *\" to the end. What does this usually mean?"],[
 ["Після другого переходу пакети або відповіді губляться: немає маршруту далі або назад, або ICMP фільтрується","Правильно.","After the second hop packets or replies are lost: no route onward or back, or ICMP is filtered","Correct."],
 ["Призначення успішно досягнуто","Тоді в кінці була б адреса призначення.","The destination was reached","Then the destination address would appear at the end."],
 ["Проблема на першому переході","Перші переходи відповідають.","A problem on the first hop","The first hops respond."],
 ["DNS не працює","traceroute за IP не залежить від DNS.","DNS is broken","A traceroute by IP doesn't depend on DNS."]],[0]);
mc("v2b-xp-6","SRWE16",["Яка команда Windows відповідає traceroute у Cisco IOS?","Which Windows command corresponds to Cisco IOS traceroute?"],[
 ["tracert","Правильно.","tracert","Correct."],["pathping -n лише","pathping поєднує трасування й статистику, але стандартний відповідник — tracert.","only pathping -n","pathping combines tracing and statistics, but the standard equivalent is tracert."],["netstat","Показує з'єднання.","netstat","Shows connections."],["arp -a","Показує ARP-кеш.","arp -a","Shows the ARP cache."]],[0]);

// ----- Гіпервізори й контейнери -----
mc("v2b-vm-1","ENSA13",["Чим гіпервізор типу 1 відрізняється від типу 2?","How does a type 1 hypervisor differ from type 2?"],[
 ["Тип 1 працює прямо на залізі (ESXi, Hyper-V Server), тип 2 — як програма в ОС (VirtualBox, VMware Workstation)","Правильно.","Type 1 runs directly on hardware (ESXi, Hyper-V Server), type 2 runs as an app on an OS (VirtualBox, VMware Workstation)","Correct."],
 ["Тип 1 лише для Linux","Ні.","Type 1 is Linux-only","No."],
 ["Тип 2 швидший у дата-центрах","Навпаки, у дата-центрах — тип 1.","Type 2 is faster in data centers","The opposite: data centers use type 1."],
 ["Різниці немає","Є суттєва різниця.","There is no difference","There is a significant difference."]],[0]);
mc("v2b-vm-2","ENSA13",["Чим контейнер відрізняється від віртуальної машини?","How does a container differ from a virtual machine?"],[
 ["Контейнер ділить ядро ОС хоста й містить лише застосунок і залежності; ВМ має власну гостьову ОС","Правильно: тому контейнери легші й стартують за секунди.","A container shares the host OS kernel and contains only the app and dependencies; a VM has its own guest OS","Correct: that's why containers are lighter and start in seconds."],
 ["Контейнер завжди безпечніший за ВМ","Ізоляція ВМ зазвичай сильніша.","A container is always more secure than a VM","VM isolation is usually stronger."],
 ["Контейнер потребує окремого фізичного сервера","Ні.","A container needs a dedicated physical server","No."],
 ["ВМ не може працювати в хмарі","Може.","A VM cannot run in the cloud","It can."]],[0]);
mc("v2b-vm-3","ENSA13",["Як ВМ у різних VLAN з'єднуються з фізичною мережею через один фізичний NIC сервера?","How do VMs in different VLANs reach the physical network through one physical server NIC?"],[
 ["Віртуальний комутатор гіпервізора тегує кадри 802.1Q, а порт фізичного комутатора до сервера — trunk","Правильно.","The hypervisor's virtual switch tags frames with 802.1Q and the physical switch port to the server is a trunk","Correct."],
 ["Порт комутатора до сервера — access у VLAN 1","Тоді пройде лише одна VLAN.","The switch port to the server is access in VLAN 1","Then only one VLAN passes."],
 ["Кожна ВМ потребує окремого кабелю","Не обов'язково.","Each VM needs its own cable","Not necessary."],
 ["VLAN не працюють у віртуалізації","Працюють.","VLANs don't work with virtualization","They do."]],[0]);
mc("v2b-vm-4","ENSA13",["Що таке образ контейнера (container image)?","What is a container image?"],[
 ["Незмінний шаблон із застосунком і залежностями, з якого запускають контейнери","Правильно.","An immutable template with the app and dependencies from which containers are started","Correct."],
 ["Знімок екрана контейнера","Ні.","A screenshot of a container","No."],
 ["ISO для встановлення гіпервізора","Ні.","An ISO for installing a hypervisor","No."],
 ["Резервна копія конфігурації комутатора","Ні.","A switch configuration backup","No."]],[0]);
mc("v2b-vm-5","ENSA13",["Що з наведеного є прикладом віртуалізації мережевих функцій (NFV)?","Which is an example of Network Functions Virtualization (NFV)?"],[
 ["Віртуальний маршрутизатор чи файрвол, що працює як ВМ замість окремого пристрою","Правильно.","A virtual router or firewall running as a VM instead of a dedicated appliance","Correct."],
 ["Заміна мідного кабелю оптикою","Ні.","Replacing copper with fiber","No."],
 ["VLAN на комутаторі","Це сегментація, а не NFV.","A VLAN on a switch","That is segmentation, not NFV."],
 ["Резервний блок живлення","Ні.","A redundant power supply","No."]],[0]);
mc("v2b-vm-6","ENSA13",["Навіщо оркестратор контейнерів (наприклад, Kubernetes)?","Why use a container orchestrator such as Kubernetes?"],[
 ["Автоматично розміщувати, масштабувати й перезапускати контейнери на кількох серверах","Правильно.","To automatically place, scale and restart containers across several servers","Correct."],
 ["Щоб замінити DNS","Ні.","To replace DNS","No."],
 ["Для налаштування STP","Ні.","To configure STP","No."],
 ["Щоб шифрувати Wi-Fi","Ні.","To encrypt Wi-Fi","No."]],[0]);

// ----- OSPFv3 -----
mc("v2b-o3-1","ENSA2",["Як увімкнути OSPFv3 на інтерфейсі в класичному синтаксисі IOS?","How do you enable OSPFv3 on an interface in classic IOS syntax?"],[
 ["ipv6 ospf 1 area 0 в режимі інтерфейсу (після ipv6 unicast-routing і ipv6 router ospf 1)","Правильно: в OSPFv3 немає команд network.","ipv6 ospf 1 area 0 in interface mode (after ipv6 unicast-routing and ipv6 router ospf 1)","Correct: OSPFv3 has no network commands."],
 ["network 2001:db8::/64 area 0","У OSPFv3 network не використовують.","network 2001:db8::/64 area 0","OSPFv3 doesn't use network."],
 ["router ospf 1 + ipv6 enable","Це OSPFv2.","router ospf 1 + ipv6 enable","That is OSPFv2."],
 ["ip ospf 1 area 0","Це OSPFv2 на інтерфейсі.","ip ospf 1 area 0","That is OSPFv2 on an interface."]],[0]);
mc("v2b-o3-2","ENSA2",["Які адреси використовують OSPFv3-сусіди для обміну Hello?","Which addresses do OSPFv3 neighbors use to exchange Hellos?"],[
 ["Link-local як джерело і multicast FF02::5 (усі OSPF-маршрутизатори)","Правильно; FF02::6 — для DR/BDR.","Link-local as source and multicast FF02::5 (all OSPF routers)","Correct; FF02::6 is for DR/BDR."],
 ["Глобальні адреси і broadcast","В IPv6 немає broadcast.","Global addresses and broadcast","IPv6 has no broadcast."],
 ["224.0.0.5","Це OSPFv2.","224.0.0.5","That is OSPFv2."],
 ["FF02::1","Це всі вузли.","FF02::1","That is all nodes."]],[0]);
mc("v2b-o3-3","ENSA2",["На маршрутизаторі лише IPv6-адреси, IPv4 немає. Чому OSPFv3 не стартує?","A router has only IPv6 addresses, no IPv4. Why won't OSPFv3 start?"],[
 ["Немає router ID: його треба задати вручну (router-id 1.1.1.1) — він 32-бітний","Правильно.","No router ID: it must be set manually (router-id 1.1.1.1) — it is 32-bit","Correct."],
 ["OSPFv3 вимагає IPv4 на всіх інтерфейсах","Ні, лише router ID.","OSPFv3 requires IPv4 on all interfaces","No, only a router ID."],
 ["Не вистачає network","network в OSPFv3 немає.","A network command is missing","OSPFv3 has no network command."],
 ["OSPFv3 працює лише з EIGRP","Ні.","OSPFv3 only works with EIGRP","No."]],[0]);
mc("v2b-o3-4","ENSA2",["Яка команда показує сусідів OSPFv3?","Which command shows OSPFv3 neighbors?"],[
 ["show ipv6 ospf neighbor","Правильно.","show ipv6 ospf neighbor","Correct."],["show ip ospf neighbor","Це OSPFv2.","show ip ospf neighbor","That is OSPFv2."],["show ipv6 route ospf","Показує маршрути.","show ipv6 route ospf","Shows routes."],["show ospfv3 database ipv4","Ні.","show ospfv3 database ipv4","No."]],[0]);

// ----- Storm control -----
mc("v2b-st-1","SRWE11",["Що робить storm-control broadcast level 5.00 на порту?","What does storm-control broadcast level 5.00 do on a port?"],[
 ["Обмежує broadcast-трафік до 5% смуги порту; надлишок відкидається (або порт вимикається за дією shutdown)","Правильно.","Limits broadcast traffic to 5% of port bandwidth; excess is dropped (or the port shuts down with action shutdown)","Correct."],
 ["Блокує весь broadcast","Обмежує, а не блокує повністю.","Blocks all broadcast","It limits, not blocks completely."],
 ["Вмикає STP","Ні.","Enables STP","No."],
 ["Обмежує кількість MAC","Це port security.","Limits the number of MACs","That is port security."]],[0]);
mc("v2b-st-2","SRWE11",["Які типи трафіку може обмежувати storm control?","Which traffic types can storm control limit?"],[
 ["Broadcast, multicast і unknown unicast","Правильно.","Broadcast, multicast and unknown unicast","Correct."],["Лише TCP","Ні.","Only TCP","No."],["Лише трафік VLAN 1","Ні.","Only VLAN 1 traffic","No."],["Лише IPv6","Ні.","Only IPv6","No."]],[0]);
mc("v2b-st-3","SRWE11",["Що додає storm-control action trap?","What does storm-control action trap add?"],[
 ["Надсилає SNMP-трап при перевищенні порогу","Правильно; action shutdown — переводить порт в err-disabled.","Sends an SNMP trap when the threshold is exceeded","Correct; action shutdown puts the port into err-disabled."],
 ["Вимикає порт назавжди","Ні.","Shuts the port permanently","No."],["Пересилає трафік у VLAN 999","Ні.","Forwards traffic to VLAN 999","No."],["Вимикає broadcast на всьому комутаторі","Ні.","Disables broadcast switch-wide","No."]],[0]);

// ----- VRRP -----
mc("v2b-vr-1","SRWE9",["Чим VRRP відрізняється від HSRP?","How does VRRP differ from HSRP?"],[
 ["VRRP — відкритий стандарт, preempt увімкнено за замовчуванням, віртуальною може бути адреса реального інтерфейсу","Правильно.","VRRP is an open standard, preempt is on by default, the virtual IP can be a real interface address","Correct."],
 ["VRRP — пропрієтарний Cisco","Це HSRP.","VRRP is Cisco proprietary","That is HSRP."],
 ["VRRP балансує трафік у групі","Балансує GLBP.","VRRP load-balances within a group","GLBP does that."],
 ["У VRRP немає пріоритетів","Є, 1–254.","VRRP has no priorities","It does, 1–254."]],[0]);
mc("v2b-vr-2","SRWE9",["Як називаються ролі маршрутизаторів у VRRP?","What are the router roles in VRRP called?"],[
 ["Master і backup","Правильно.","Master and backup","Correct."],["Active і standby","Це HSRP.","Active and standby","That is HSRP."],["AVG і AVF","Це GLBP.","AVG and AVF","That is GLBP."],["DR і BDR","Це OSPF.","DR and BDR","That is OSPF."]],[0]);
mc("v2b-vr-3","SRWE9",["Віртуальна IP групи VRRP 1 збігається з адресою інтерфейсу R1. Хто стане master?","The VRRP group 1 virtual IP equals R1's interface address. Who becomes master?"],[
 ["R1 — він власник адреси (IP owner) з пріоритетом 255","Правильно.","R1 — it is the IP address owner with priority 255","Correct."],
 ["Маршрутизатор з найбільшою MAC","Ні.","The router with the highest MAC","No."],
 ["Той, хто ввімкнувся першим","Ні.","Whoever booted first","No."],
 ["Ніхто — така конфігурація неможлива","Можлива.","Nobody — this config is impossible","It is possible."]],[0]);
mc("v2b-vr-4","SRWE9",["Яка команда показує стан VRRP?","Which command shows VRRP state?"],[
 ["show vrrp brief","Правильно.","show vrrp brief","Correct."],["show standby brief","Це HSRP.","show standby brief","That is HSRP."],["show glbp","Це GLBP.","show glbp","That is GLBP."],["show ip vrrp route","Ні.","show ip vrrp route","No."]],[0]);

// ----- Діагностика клієнтів -----
mc("v2b-cl-1","ITN17",["Яка команда показує IP-налаштування на macOS або Linux?","Which command shows IP settings on macOS or Linux?"],[
 ["ifconfig (macOS) або ip address (Linux)","Правильно.","ifconfig (macOS) or ip address (Linux)","Correct."],["ipconfig /all","Це Windows.","ipconfig /all","That is Windows."],["show ip interface brief","Це Cisco IOS.","show ip interface brief","That is Cisco IOS."],["netsh wlan show interfaces","Це Windows.","netsh wlan show interfaces","That is Windows."]],[0]);
mc("v2b-cl-2","ITN17",["Windows-ПК має адресу 169.254.23.7. Що це означає?","A Windows PC has the address 169.254.23.7. What does it mean?"],[
 ["APIPA: DHCP-сервер не відповів, ПК призначив собі link-local адресу","Правильно.","APIPA: no DHCP server answered and the PC assigned itself a link-local address","Correct."],
 ["Адреса від провайдера","Ні.","An ISP-assigned address","No."],["Статична адреса адміністратора","Ні.","A static admin address","No."],["Адреса шлюзу","Ні.","The gateway address","No."]],[0]);
mc("v2b-cl-3","ITN17",["Як перевірити, який DNS-сервер використовує Linux-клієнт із systemd?","How do you check which DNS server a Linux client with systemd uses?"],[
 ["resolvectl status (або cat /etc/resolv.conf)","Правильно.","resolvectl status (or cat /etc/resolv.conf)","Correct."],["ipconfig /displaydns","Це Windows-кеш.","ipconfig /displaydns","That is the Windows cache."],["show hosts","Це IOS.","show hosts","That is IOS."],["arp -a","ARP, не DNS.","arp -a","ARP, not DNS."]],[0]);
mc("v2b-cl-4","ITN17",["Бездротовий клієнт Windows підключений до Wi-Fi, але повільно. Яка команда покаже рівень сигналу й канал?","A Windows Wi-Fi client is connected but slow. Which command shows signal strength and channel?"],[
 ["netsh wlan show interfaces","Правильно.","netsh wlan show interfaces","Correct."],["ipconfig /release","Скидає адресу.","ipconfig /release","Releases the address."],["tracert","Трасування, не сигнал.","tracert","Tracing, not signal."],["route print","Таблиця маршрутів.","route print","Routing table."]],[0]);
mc("v2b-cl-5","ITN17",["Ping 8.8.8.8 працює, ping google.com — ні. Що перевірити першим?","Ping 8.8.8.8 works, ping google.com doesn't. What to check first?"],[
 ["DNS-сервер клієнта: nslookup google.com","Правильно.","The client's DNS server: nslookup google.com","Correct."],["Шлюз за замовчуванням","Шлюз працює, бо 8.8.8.8 доступний.","The default gateway","The gateway works since 8.8.8.8 is reachable."],["Кабель","Фізика в порядку.","The cable","The physical layer is fine."],["Маску підмережі","Ні.","The subnet mask","No."]],[0]);
mc("v2b-cl-6","ITN17",["Як оновити DHCP-адресу на macOS у терміналі?","How do you renew a DHCP address on macOS in the terminal?"],[
 ["sudo ipconfig set en0 DHCP","Правильно.","sudo ipconfig set en0 DHCP","Correct."],["ipconfig /renew","Це Windows.","ipconfig /renew","That is Windows."],["dhclient -r","Це Linux.","dhclient -r","That is Linux."],["show dhcp lease","IOS.","show dhcp lease","IOS."]],[0]);

// ----- DNS, SFTP/SCP, AAA -----
mc("v2b-dn-1","ITN15",["Який DNS-запис вказує поштовий сервер домену?","Which DNS record specifies a domain's mail server?"],[["MX","Правильно.","MX","Correct."],["CNAME","Псевдонім.","CNAME","Alias."],["PTR","Зворотний запис.","PTR","Reverse record."],["AAAA","IPv6-адреса.","AAAA","IPv6 address."]],[0]);
mc("v2b-dn-2","ITN15",["nslookup 10.1.1.10 повертає ім'я сервера. Який запис використано?","nslookup 10.1.1.10 returns the server name. Which record was used?"],[["PTR у зоні in-addr.arpa","Правильно.","PTR in the in-addr.arpa zone","Correct."],["A","A — ім'я → IPv4.","A","A is name → IPv4."],["NS","NS — сервери зони.","NS","NS is zone servers."],["MX","Пошта.","MX","Mail."]],[0]);
mc("v2b-sf-1","ENSA10",["Чому для копіювання конфігурацій радять SCP або SFTP замість TFTP?","Why use SCP or SFTP instead of TFTP to copy configurations?"],[
 ["SCP/SFTP працюють поверх SSH: автентифікація й шифрування; TFTP — без пароля й відкритим текстом","Правильно.","SCP/SFTP run over SSH with authentication and encryption; TFTP has no password and is cleartext","Correct."],
 ["TFTP повільніший","Річ не в швидкості.","TFTP is slower","It's not about speed."],["SCP працює лише в IPv6","Ні.","SCP works only over IPv6","No."],["TFTP не підтримується Cisco","Підтримується.","TFTP isn't supported by Cisco","It is."]],[0]);
mc("v2b-sf-2","ENSA10",["Що потрібно на маршрутизаторі, щоб копіювати на нього файли через SCP (як на сервер)?","What is needed on a router to copy files to it via SCP (as a server)?"],[
 ["SSH з AAA-авторизацією і ip scp server enable","Правильно.","SSH with AAA authorization and ip scp server enable","Correct."],["Лише ip tftp source-interface","Це TFTP.","Only ip tftp source-interface","That is TFTP."],["service password-encryption","Не стосується SCP.","service password-encryption","Unrelated to SCP."],["Вимкнути SSH","Навпаки.","Disable SSH","The opposite."]],[0]);
mc("v2b-aa-1","SRWE10",["Чим TACACS+ відрізняється від RADIUS?","How does TACACS+ differ from RADIUS?"],[
 ["TACACS+ (TCP 49) шифрує все тіло пакета й розділяє автентифікацію, авторизацію й облік; RADIUS (UDP 1812/1813) шифрує лише пароль","Правильно; TACACS+ зручний для адміністрування пристроїв, RADIUS — для доступу користувачів (802.1X).","TACACS+ (TCP 49) encrypts the whole payload and separates AAA functions; RADIUS (UDP 1812/1813) encrypts only the password","Correct; TACACS+ suits device administration, RADIUS suits user access (802.1X)."],
 ["RADIUS — пропрієтарний Cisco","Пропрієтарний TACACS+ (зараз описаний у RFC 8907), RADIUS — відкритий стандарт.","RADIUS is Cisco proprietary","TACACS+ originated at Cisco (now RFC 8907); RADIUS is an open standard."],
 ["TACACS+ працює по UDP 1812","Ні.","TACACS+ uses UDP 1812","No."],["Різниці немає","Є.","No difference","There is."]],[0]);
mc("v2b-aa-2","SRWE10",["Що означає aaa authentication login default group tacacs+ local?","What does aaa authentication login default group tacacs+ local mean?"],[
 ["Спершу TACACS+; якщо сервер недоступний — локальна база","Правильно: local — резерв лише при недоступності сервера, не при невірному паролі.","TACACS+ first; if the server is unreachable — the local database","Correct: local is a fallback only when the server is unreachable, not on a wrong password."],
 ["Спершу локальна база","Порядок навпаки.","Local database first","The order is the opposite."],["Обидва одночасно","Ні.","Both at once","No."],["Лише TACACS+","Є резерв local.","Only TACACS+","There is a local fallback."]],[0]);
// ----- третя порція: Wi-Fi 6/6E, хмара, REST, PoE, 802.1X, IPv6, OSPF -----
mc("v2b-wf-1","SRWE12",["Яку нову смугу частот додає Wi-Fi 6E?","Which new frequency band does Wi-Fi 6E add?"],[
 ["6 ГГц","Правильно: 6E = 802.11ax у смузі 6 ГГц (крім 2,4 і 5 ГГц).","6 GHz","Correct: 6E = 802.11ax in the 6 GHz band (in addition to 2.4 and 5 GHz)."],
 ["60 ГГц","Це 802.11ad/ay (WiGig).","60 GHz","That is 802.11ad/ay (WiGig)."],["900 МГц","Це 802.11ah.","900 MHz","That is 802.11ah."],["3,6 ГГц","Ні.","3.6 GHz","No."]],[0]);
mc("v2b-wf-2","SRWE12",["Яка технологія Wi-Fi 6 (802.11ax) ділить канал на ресурсні блоки для кількох клієнтів одночасно?","Which Wi-Fi 6 (802.11ax) technology splits a channel into resource units for several clients at once?"],[
 ["OFDMA","Правильно: OFDMA дозволяє AP обслуговувати кількох клієнтів в одній передачі.","OFDMA","Correct: OFDMA lets the AP serve several clients in one transmission."],
 ["CSMA/CD","Це дротовий half-duplex Ethernet.","CSMA/CD","That is wired half-duplex Ethernet."],["DSSS","Стара модуляція 802.11b.","DSSS","Legacy 802.11b modulation."],["CAPWAP","Протокол AP↔WLC, не радіо.","CAPWAP","AP↔WLC protocol, not radio."]],[0]);
mc("v2b-cd-1","ENSA13",["Компанія орендує віртуальні машини в хмарі й сама встановлює ОС і застосунки. Яка це модель?","A company rents virtual machines in the cloud and installs the OS and applications itself. Which model is this?"],[
 ["IaaS","Правильно: провайдер дає обчислення, сховище й мережу; ОС і вище — клієнт.","IaaS","Correct: the provider supplies compute, storage and network; OS and above belong to the customer."],
 ["SaaS","У SaaS клієнт користується готовим застосунком (Microsoft 365).","SaaS","In SaaS the customer uses a ready application (Microsoft 365)."],["PaaS","У PaaS ОС і середовище виконання керує провайдер.","PaaS","In PaaS the provider manages the OS and runtime."],["On-prem","Це власне обладнання, не хмара.","On-prem","That is own hardware, not cloud."]],[0]);
mc("v2b-cd-2","ENSA13",["Яка хмарна модель розгортання поєднує приватну інфраструктуру й публічну хмару з перенесенням навантажень між ними?","Which cloud deployment model combines private infrastructure and a public cloud with workloads moving between them?"],[
 ["Гібридна (hybrid)","Правильно.","Hybrid","Correct."],["Публічна","Лише ресурси провайдера.","Public","Provider resources only."],["Community","Спільна для організацій однієї галузі.","Community","Shared by organizations of one sector."],["Приватна","Лише власна.","Private","Own only."]],[0]);
mc("v2b-rs-1","ENSA14",["Який HTTP-метод REST API зазвичай використовують, щоб створити новий ресурс (наприклад, новий VLAN на контролері)?","Which REST API HTTP method is typically used to create a new resource (e.g. a new VLAN on a controller)?"],[
 ["POST","Правильно: POST — create, GET — read, PUT/PATCH — update, DELETE — delete.","POST","Correct: POST — create, GET — read, PUT/PATCH — update, DELETE — delete."],
 ["GET","GET лише читає.","GET","GET only reads."],["DELETE","Видаляє.","DELETE","Deletes."],["HEAD","Як GET, але без тіла відповіді.","HEAD","Like GET but without a body."]],[0]);
mc("v2b-rs-2","ENSA14",["REST API повернув код 401. Що це означає?","A REST API returned status 401. What does it mean?"],[
 ["Запит не автентифіковано: немає токена або він недійсний","Правильно: 401 Unauthorized; 403 — автентифіковано, але немає прав.","The request is not authenticated: the token is missing or invalid","Correct: 401 Unauthorized; 403 means authenticated but not permitted."],
 ["Ресурс не знайдено","Це 404.","Resource not found","That is 404."],["Успішно створено","Це 201.","Successfully created","That is 201."],["Помилка сервера","Це 5xx.","Server error","That is 5xx."]],[0]);
mc("v2b-pe-1","ITN4",["IP-телефон отримує живлення через той самий кабель Ethernet, що й дані. Яка це технологія?","An IP phone is powered through the same Ethernet cable that carries data. Which technology is this?"],[
 ["PoE (802.3af/at/bt)","Правильно: комутатор як PSE подає живлення на PD.","PoE (802.3af/at/bt)","Correct: the switch as PSE supplies power to the PD."],
 ["LLDP-MED","Допомагає узгодити потужність і voice VLAN, але живлення не передає.","LLDP-MED","Helps negotiate power and voice VLAN but does not carry power."],["CDP","Протокол виявлення сусідів.","CDP","A neighbor discovery protocol."],["UPS","Резервне живлення в розетці.","UPS","Backup power at the outlet."]],[0]);
mc("v2b-dx-1","SRWE10",["У 802.1X яку роль виконує комутатор доступу?","In 802.1X, which role does the access switch play?"],[
 ["Authenticator: пересилає EAP між клієнтом і RADIUS-сервером","Правильно: supplicant — клієнт, authentication server — RADIUS (наприклад, ISE).","Authenticator: relays EAP between the client and the RADIUS server","Correct: the supplicant is the client, the authentication server is RADIUS (e.g. ISE)."],
 ["Supplicant","Це клієнтський пристрій.","Supplicant","That is the client device."],["Authentication server","Це RADIUS.","Authentication server","That is RADIUS."],["Certificate authority","Ні.","Certificate authority","No."]],[0]);
mc("v2b-v6-1","ITN12",["Яким префіксом починаються link-local адреси IPv6?","Which prefix do IPv6 link-local addresses start with?"],[
 ["FE80::/10","Правильно: link-local є на кожному IPv6-інтерфейсі й не маршрутизуються.","FE80::/10","Correct: every IPv6 interface has a link-local address and they are not routed."],
 ["FC00::/7","Це unique local.","FC00::/7","That is unique local."],["FF00::/8","Це multicast.","FF00::/8","That is multicast."],["2000::/3","Це global unicast.","2000::/3","That is global unicast."]],[0]);
mc("v2b-v6-2","SRWE8",["Хост отримав RA з прапорцями M=0, O=1. Як він налаштує IPv6?","A host received an RA with flags M=0, O=1. How will it configure IPv6?"],[
 ["Адреса через SLAAC, а DNS та інші параметри — від stateless DHCPv6","Правильно.","Address via SLAAC, DNS and other options from stateless DHCPv6","Correct."],
 ["Адреса і все інше — від stateful DHCPv6","Це M=1.","Address and everything else from stateful DHCPv6","That is M=1."],["Лише SLAAC, без DHCPv6","Це M=0, O=0.","SLAAC only, no DHCPv6","That is M=0, O=0."],["Статична адреса","Ні.","Static address","No."]],[0]);
mc("v2b-of-1","ENSA2",["Два маршрутизатори з'єднані Ethernet-лінком. Що дає ip ospf network point-to-point на обох інтерфейсах?","Two routers are connected by an Ethernet link. What does ip ospf network point-to-point on both interfaces give?"],[
 ["Немає виборів DR/BDR — сусідство встановлюється швидше","Правильно: на лінку з двох маршрутизаторів DR не потрібен.","No DR/BDR election — adjacency forms faster","Correct: a DR is not needed on a two-router link."],
 ["Сусідство стає неможливим","Лише якщо тип мережі різний на кінцях (таймери).","Adjacency becomes impossible","Only if the network type differs on each end (timers)."],["Вмикається автентифікація","Ні.","Authentication is enabled","No."],["Зростає cost","Ні.","Cost increases","No."]],[0]);
mc("v2b-of-2","ENSA1",["У якому стані OSPF-сусідство застрягає, якщо на кінцях не збігається MTU?","In which state does an OSPF adjacency get stuck if the MTU does not match on both ends?"],[
 ["EXSTART/EXCHANGE","Правильно: DBD-пакети з різним MTU відкидаються.","EXSTART/EXCHANGE","Correct: DBD packets with a different MTU are dropped."],
 ["2-WAY","Це нормальний стан для DROTHER-сусідів.","2-WAY","That is normal between DROTHERs."],["INIT","Типово при односторонньому hello / ACL.","INIT","Typical for one-way hello / ACL."],["FULL","Сусідство вже встановлено.","FULL","The adjacency is already up."]],[0]);
mc("v2b-ai-8","ENSA14",["Що з наведеного — найкраща практика при використанні генеративного ШІ для створення конфігурації мережі?","Which of these is a best practice when using generative AI to create network configuration?"],[
 ["Перевірити згенерований конфіг у лабі / через --check і не передавати в промпт паролі та внутрішні IP","Правильно: ШІ може помилятися (галюцинації), а промпти можуть зберігатися у провайдера.","Validate the generated config in a lab / with --check and keep passwords and internal IPs out of the prompt","Correct: AI can be wrong (hallucinations), and prompts may be stored by the provider."],
 ["Одразу застосувати на продакшені — ШІ не помиляється","Ні.","Apply directly to production — AI makes no mistakes","No."],["Передати повний running-config із секретами для точності","Ризик витоку.","Send the full running-config with secrets for accuracy","Leak risk."],["Використовувати лише для show-команд","Надмірне обмеження.","Use only for show commands","Overly restrictive."]],[0]);
mc("v2b-xp-7","SRWE16",["Ping із маршрутизатора проходить, а з ПК за ним — ні. Яка команда найшвидше перевірить, чи є в далекої мережі маршрут назад до LAN?","A ping from the router works, but from the PC behind it does not. Which command checks fastest whether the remote network has a route back to the LAN?"],[
 ["ping <адреса> source <LAN-інтерфейс>","Правильно: extended ping з LAN-адресою як source відтворює трафік ПК.","ping <address> source <LAN interface>","Correct: an extended ping sourced from the LAN address reproduces the PC's traffic."],
 ["show ip interface brief","Покаже лише стан інтерфейсів.","show ip interface brief","Only shows interface status."],["show cdp neighbors","Лише сусіди L2.","show cdp neighbors","Only L2 neighbors."],["ping <адреса> repeat 100","Source лишиться вихідним інтерфейсом.","ping <address> repeat 100","Source stays the exit interface."]],[0]);
})();
