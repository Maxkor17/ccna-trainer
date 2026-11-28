// Після CCNA: автоматизація (LNX7–LNX9) і безпека (LNX10–LNX12). Двомовні записи.
(function(){ const QB=window.QB_AUTO=[], TR=window.QB_TR=window.QB_TR||{};
const perm=(id,n)=>{ let h=2166136261; for(const c of id) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0; const p=[...Array(n).keys()]; for(let i=n-1;i>0;i--){ h=Math.imul(h^(h>>>13),1597334677)>>>0; const j=h%(i+1); [p[i],p[j]]=[p[j],p[i]]; } return p; };
const mix=(id,o,a)=>{ const p=perm(id,o.length); return {o:p.map(i=>o[i]), a:a.map(x=>p.indexOf(x)).sort((x,y)=>x-y)}; };
const mc=(id,t,q,o0,a0)=>{ const {o,a}=mix(id,o0,a0); QB.push({id,t,q:q[0],o:o.map(x=>[x[0],x[1]]),a}); TR[id]={q:q[1],o:o.map(x=>[x[2],x[3]])}; };
const cat=(id,t,q,cats,items,e)=>{ QB.push({id,t,type:"cat",q:q[0],cats:cats.map(c=>c[0]),items:items.map(x=>[x[0],x[2]]),e:e[0]}); TR[id]={q:q[1],cats:cats.map(c=>c[1]),items:items.map(x=>[x[1],x[2]]),e:e[1]}; };
const N=(ua,en)=>[ua,"Ні.",en,"No."];

// ===== LNX7: Python для мереж =====
mc("au-7-1","LNX7",["Що робить ConnectHandler у Netmiko?","What does ConnectHandler do in Netmiko?"],[
 ["Відкриває SSH-сесію до пристрою з урахуванням типу (device_type) і повертає об'єкт з'єднання","Правильно.","Opens an SSH session to the device for its device_type and returns a connection object","Correct."],
 N("Надсилає SNMP-запит","Sends an SNMP request"),N("Відкриває RESTCONF-сесію","Opens a RESTCONF session"),N("Завантажує конфігурацію з TFTP","Downloads a config from TFTP")],[0]);
mc("au-7-2","LNX7",["Чим send_config_set() відрізняється від send_command()?","How does send_config_set() differ from send_command()?"],[
 ["send_config_set сам заходить у configure terminal, виконує список команд і виходить; send_command виконує одну show-команду","Правильно.","send_config_set enters configure terminal, runs a list of commands and exits; send_command runs a single show command","Correct."],
 N("Нічим","No difference"),["send_command не повертає виводу","Повертає.","send_command returns no output","It does."],["send_config_set працює лише з NAPALM","Це метод Netmiko.","send_config_set only works with NAPALM","It is a Netmiko method."]],[0]);
mc("au-7-3","LNX7",["Що дає use_textfsm=True у send_command()?","What does use_textfsm=True give in send_command()?"],[
 ["Розбирає текстовий вивід шаблоном TextFSM (ntc-templates) у список словників","Правильно: структуровані дані замість тексту.","Parses the text output with a TextFSM template (ntc-templates) into a list of dictionaries","Correct: structured data instead of text."],
 N("Шифрує вивід","Encrypts the output"),N("Пришвидшує SSH","Speeds up SSH"),N("Перетворює вивід у YAML-файл","Writes the output to a YAML file")],[0]);
mc("au-7-4","LNX7",["Головна перевага NAPALM над Netmiko?","What is NAPALM's main advantage over Netmiko?"],[
 ["Єдиний API для різних вендорів (get_facts, compare_config, commit/rollback) замість CLI-команд конкретної ОС","Правильно.","One vendor-neutral API (get_facts, compare_config, commit/rollback) instead of OS-specific CLI commands","Correct."],
 N("Працює без мережі","Works without a network"),N("Замінює SSH на Telnet","Replaces SSH with Telnet"),["Не потребує облікових даних","Потребує.","Needs no credentials","It does."]],[0]);
mc("au-7-5","LNX7",["Навіщо в NAPALM викликати compare_config() перед commit_config()?","Why call compare_config() before commit_config() in NAPALM?"],[
 ["Щоб побачити diff — які рядки буде додано чи змінено — і не застосувати зайвого","Правильно: перевірка перед зміною.","To see the diff of lines to be added or changed and avoid unintended changes","Correct: a pre-change check."],
 N("Без нього commit неможливий","commit is impossible without it"),N("Щоб зберегти startup-config","To save the startup config"),N("Щоб перезавантажити пристрій","To reload the device")],[0]);
mc("au-7-6","LNX7",["Як правильно зберігати паролі для скриптів автоматизації?","How should passwords for automation scripts be stored?"],[
 ["У змінних середовища або сховищі секретів (Vault, Ansible Vault), а не в коді й Git","Правильно.","In environment variables or a secrets store (Vault, Ansible Vault), not in code or Git","Correct."],
 ["Прямо в скрипті — так простіше","Пароль потрапить у Git.","Hard-coded in the script","The password ends up in Git."],N("У коментарі в конфігурації пристрою","In a comment in the device config"),N("У назві файлу","In the file name")],[0]);
cat("au-7-7","LNX7",["Віднесіть можливості до бібліотеки.","Assign each capability to the library."],
 [["Netmiko","Netmiko"],["NAPALM","NAPALM"]],
 [["send_command / send_config_set через SSH CLI","send_command / send_config_set over SSH CLI",0],["Підтримка сотень типів пристроїв через CLI","Supports hundreds of device types via CLI",0],["get_facts() — однаковий словник для різних вендорів","get_facts() — the same dictionary across vendors",1],["compare_config() і rollback()","compare_config() and rollback()",1],["load_replace_candidate — заміна всієї конфігурації","load_replace_candidate — replace the whole config",1]],
 ["NAPALM для IOS сам використовує Netmiko «під капотом», додаючи уніфіковані методи.","NAPALM for IOS uses Netmiko under the hood and adds unified methods."]);

// ===== LNX8: RESTCONF, NETCONF, YANG =====
mc("au-8-1","LNX8",["Що таке YANG?","What is YANG?"],[
 ["Мова моделювання даних, що описує структуру конфігурації й стану пристрою","Правильно.","A data modeling language describing the structure of device configuration and state","Correct."],
 N("Транспортний протокол","A transport protocol"),N("Формат журналів","A log format"),N("Мова шаблонів Ansible","Ansible's template language")],[0]);
mc("au-8-2","LNX8",["Який транспорт і кодування використовує NETCONF?","Which transport and encoding does NETCONF use?"],[
 ["SSH (порт 830), XML","Правильно.","SSH (port 830), XML","Correct."],
 ["HTTPS (443), JSON","Це RESTCONF (або XML).","HTTPS (443), JSON","That is RESTCONF (or XML)."],N("UDP 161, ASN.1","UDP 161, ASN.1"),N("Telnet, текст","Telnet, plain text")],[0]);
mc("au-8-3","LNX8",["Який заголовок потрібен, щоб RESTCONF повернув JSON?","Which header makes RESTCONF return JSON?"],[
 ["Accept: application/yang-data+json","Правильно.","Accept: application/yang-data+json","Correct."],
 ["Accept: text/html","Ні.","Accept: text/html","No."],["Content-Type: text/plain","Ні.","Content-Type: text/plain","No."],["X-Auth-Token","Це для Catalyst Center.","X-Auth-Token","That is for Catalyst Center."]],[0]);
mc("au-8-4","LNX8",["RESTCONF PATCH на опис інтерфейсу повернув 204. Що це означає?","A RESTCONF PATCH of an interface description returned 204. What does it mean?"],[
 ["Успіх: зміну застосовано, тіла відповіді немає","Правильно.","Success: the change was applied and there is no response body","Correct."],
 ["Ресурс не знайдено","Це 404.","Resource not found","That is 404."],["Неавторизовано","Це 401.","Unauthorized","That is 401."],["Неправильний Accept","Це 406.","Wrong Accept header","That is 406."]],[0]);
mc("au-8-5","LNX8",["Чим відрізняються датастори running і candidate у NETCONF?","How do the running and candidate datastores differ in NETCONF?"],[
 ["Candidate — чернетка: зміни накопичуються й застосовуються разом операцією commit","Правильно. На IOS XE за замовчуванням зазвичай лише running.","Candidate is a draft: changes accumulate and are applied together with commit","Correct. IOS XE usually has only running by default."],
 N("Це одне й те саме","They are the same"),N("Candidate — це startup-config","Candidate is the startup config"),N("Running — лише для читання","Running is read-only")],[0]);
cat("au-8-6","LNX8",["Віднесіть ознаки до протоколу.","Assign each feature to the protocol."],
 [["NETCONF","NETCONF"],["RESTCONF","RESTCONF"]],
 [["SSH, порт 830","SSH, port 830",0],["RPC: <get-config>, <edit-config>","RPCs: <get-config>, <edit-config>",0],["Датастор candidate і commit","Candidate datastore and commit",0],["HTTPS і HTTP-методи GET, PATCH, PUT, DELETE","HTTPS and HTTP methods GET, PATCH, PUT, DELETE",1],["URL виду /restconf/data/…","URLs like /restconf/data/…",1],["JSON або XML (yang-data)","JSON or XML (yang-data)",1]],
 ["Обидва працюють з моделями YANG; RESTCONF — їхня REST-подібна реалізація поверх HTTP.","Both use YANG models; RESTCONF is a REST-like interface over HTTP."]);
mc("au-8-7","LNX8",["Яка команда вмикає RESTCONF на IOS XE?","Which command enables RESTCONF on IOS XE?"],[
 ["restconf (плюс ip http secure-server)","Правильно: RESTCONF працює поверх HTTPS-сервера.","restconf (plus ip http secure-server)","Correct: RESTCONF runs on the HTTPS server."],
 ["netconf-yang","Це NETCONF.","netconf-yang","That is NETCONF."],["ip ssh version 2","Ні.","ip ssh version 2","No."],["snmp-server enable traps","Ні.","snmp-server enable traps","No."]],[0]);

// ===== LNX9: Git і CI для конфігурацій =====
mc("au-9-1","LNX9",["Навіщо зберігати конфігурації мережевих пристроїв у Git?","Why keep network device configurations in Git?"],[
 ["Історія змін, хто й коли змінив, diff між версіями і швидкий відкат","Правильно.","Change history, who changed what and when, diffs between versions and quick rollback","Correct."],
 N("Git замінює резервне копіювання на пристрої автоматично","Git automatically replaces on-device backups"),N("Щоб пристрій працював швидше","So the device runs faster"),N("Git потрібен для SSH","Git is required for SSH")],[0]);
mc("au-9-2","LNX9",["Що таке pull request (merge request) у процесі змін мережі?","What is a pull request (merge request) in a network change process?"],[
 ["Запит на злиття гілки зі змінами: колеги рецензують diff, CI перевіряє його до застосування","Правильно.","A request to merge a branch with changes: peers review the diff and CI checks it before it is applied","Correct."],
 N("Команда завантаження конфігурації з пристрою","A command that pulls the config from a device"),N("Резервна копія","A backup"),N("Тікет у helpdesk","A helpdesk ticket")],[0]);
mc("au-9-3","LNX9",["Що варто запускати в CI для мережевих змін?","What should CI run for network changes?"],[
 ["Перевірку синтаксису YAML/шаблонів, лінтер, тести на лабі (containerlab) і dry-run (--check/--diff)","Правильно.","YAML/template syntax checks, a linter, tests in a lab (containerlab) and a dry run (--check/--diff)","Correct."],
 N("Перезавантаження всіх пристроїв","Rebooting every device"),N("Нічого — мережу не тестують","Nothing — networks are not tested"),N("Лише git push","Only git push")],[0]);
mc("au-9-4","LNX9",["Що показує git diff HEAD~1 -- configs/R1.cfg?","What does git diff HEAD~1 -- configs/R1.cfg show?"],[
 ["Зміни у файлі R1.cfg між попереднім і поточним комітом","Правильно.","Changes to R1.cfg between the previous and the current commit","Correct."],
 N("Усі гілки","All branches"),N("Хто автор файлу","Who authored the file"),N("Стан R1 у мережі","R1's live state")],[0]);
mc("au-9-5","LNX9",["Що таке ідемпотентність у мережевій автоматизації?","What is idempotency in network automation?"],[
 ["Повторний запуск не змінює вже налаштоване — результат той самий, changed=0","Правильно.","Running again does not change what is already configured — same result, changed=0","Correct."],
 N("Запуск лише один раз","Running only once"),N("Шифрування конфігурації","Encrypting the config"),N("Паралельний запуск","Running in parallel")],[0]);
mc("au-9-6","LNX9",["Що з цього НЕ можна комітити в репозиторій конфігурацій?","What must NOT be committed to a config repository?"],[
 ["Відкриті паролі й ключі (enable secret у відкритому вигляді, токени API)","Правильно: секрети — у сховище секретів.","Plain-text passwords and keys (clear enable secrets, API tokens)","Correct: secrets go to a secrets store."],
 N("Шаблони Jinja2","Jinja2 templates"),N("Інвентар пристроїв","The device inventory"),N("Плейбуки","Playbooks")],[0]);

// ===== LNX10: журнали й алерти =====
mc("au-10-1","LNX10",["У /var/log/auth.log сотні рядків «Failed password for root from 203.0.113.9». Що це?","/var/log/auth.log has hundreds of «Failed password for root from 203.0.113.9» lines. What is it?"],[
 ["Підбір пароля SSH (brute force) з однієї адреси","Правильно. Захист: fail2ban, лише ключі, заборона входу root.","An SSH password brute-force attack from one address","Correct. Defenses: fail2ban, key-only auth, no root login."],
 N("Нормальна робота cron","Normal cron activity"),N("Збій диска","A disk failure"),N("Оновлення системи","A system update")],[0]);
mc("au-10-2","LNX10",["Яка команда порахує невдалі входи за IP-адресою?","Which command counts failed logins per IP address?"],[
 ["grep \"Failed password\" auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn","Правильно: фільтр → поле з IP → підрахунок → сортування.","grep \"Failed password\" auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn","Correct: filter → IP field → count → sort."],
 ["cat auth.log | wc -l","Лише кількість рядків.","cat auth.log | wc -l","Only counts lines."],["tail -f auth.log","Лише стежить.","tail -f auth.log","Only follows the file."],["ls -la /var/log","Список файлів.","ls -la /var/log","Lists files."]],[0]);
mc("au-10-3","LNX10",["Що таке хибнопозитивний (false positive) алерт?","What is a false positive alert?"],[
 ["Сповіщення про атаку, хоча атаки не було","Правильно.","An alert about an attack that did not happen","Correct."],
 ["Атака, яку не помітили","Це false negative.","An attack that went unnoticed","That is a false negative."],N("Правильно виявлена атака","A correctly detected attack"),N("Тестовий алерт","A test alert")],[0]);
mc("au-10-4","LNX10",["Навіщо централізований збір журналів (syslog-сервер, SIEM)?","Why collect logs centrally (syslog server, SIEM)?"],[
 ["Кореляція подій з різних пристроїв, зберігання поза пристроєм, який можуть зламати, пошук і алерти","Правильно.","Correlating events across devices, keeping logs off the device that may be compromised, search and alerting","Correct."],
 N("Щоб пристрої працювали швидше","So devices run faster"),N("Щоб не потрібен був NTP","So NTP is not needed"),N("Щоб вимкнути журнали на пристроях","To disable on-device logging")],[0]);
mc("au-10-5","LNX10",["Чому для розслідування інцидентів критично важливий NTP?","Why is NTP critical for incident investigation?"],[
 ["Без синхронного часу неможливо зіставити події з різних журналів у правильному порядку","Правильно.","Without synchronized time you cannot put events from different logs in the right order","Correct."],
 N("NTP шифрує журнали","NTP encrypts logs"),N("NTP блокує атаки","NTP blocks attacks"),N("NTP не потрібен","NTP is not needed")],[0]);
mc("au-10-6","LNX10",["Повідомлення %SEC-6-IPACCESSLOGP: list OUTSIDE denied tcp 198.51.100.7(51544) -> 10.1.1.10(22), 40 packets. Що відбувається?","%SEC-6-IPACCESSLOGP: list OUTSIDE denied tcp 198.51.100.7(51544) -> 10.1.1.10(22), 40 packets. What is happening?"],[
 ["ACL OUTSIDE з ключовим словом log блокує спроби SSH ззовні до 10.1.1.10","Правильно.","ACL OUTSIDE with the log keyword is blocking external SSH attempts to 10.1.1.10","Correct."],
 N("SSH-сесія встановлена","An SSH session was established"),N("Пристрій перезавантажився","The device reloaded"),N("NAT не працює","NAT is broken")],[0]);

// ===== LNX11: атаки в pcap =====
mc("au-11-1","LNX11",["У захопленні з однієї адреси за секунду йдуть SYN на порти 1, 2, 3 … 1024 одного хоста, відповіді — RST. Що це?","A capture shows SYNs from one address to ports 1, 2, 3 … 1024 of one host within a second, answered by RSTs. What is it?"],[
 ["Сканування портів (SYN scan)","Правильно. RST — порт закритий, SYN-ACK — відкритий.","A port scan (SYN scan)","Correct. RST means closed, SYN-ACK means open."],
 N("Звичайний вебтрафік","Normal web traffic"),N("DHCP starvation","DHCP starvation"),N("Резервне копіювання","A backup job")],[0]);
mc("au-11-2","LNX11",["Як ARP spoofing виглядає в Wireshark?","How does ARP spoofing look in Wireshark?"],[
 ["Безперервні ARP reply без запиту «192.168.1.1 is at <MAC атакувальника>» і попередження duplicate use of IP","Правильно.","Unsolicited ARP replies «192.168.1.1 is at <attacker MAC>» and duplicate use of IP warnings","Correct."],
 N("Багато DNS-запитів","Many DNS queries"),N("Пакети ICMP Time Exceeded","ICMP Time Exceeded packets"),N("BPDU з пріоритетом 0","BPDUs with priority 0")],[0]);
mc("au-11-3","LNX11",["Сотні DHCP Discover за секунду з різними MAC-адресами джерела — це…","Hundreds of DHCP Discovers per second with different source MACs is…"],[
 ["DHCP starvation: спроба вичерпати пул","Правильно. Захист: DHCP snooping limit rate і port security.","DHCP starvation: an attempt to exhaust the pool","Correct. Defense: DHCP snooping rate limit and port security."],
 N("Нормальний старт робочого дня","A normal start of the workday"),N("ARP spoofing","ARP spoofing"),N("VLAN hopping","VLAN hopping")],[0]);
mc("au-11-4","LNX11",["Кадр на access-порту має два теги 802.1Q (зовнішній — native VLAN, внутрішній — VLAN 20). Яка атака?","A frame on an access port carries two 802.1Q tags (outer is the native VLAN, inner is VLAN 20). Which attack is it?"],[
 ["Подвійне тегування (VLAN hopping)","Правильно. Захист: native VLAN, не використана хостами, і тегування native.","Double tagging (VLAN hopping)","Correct. Defense: a native VLAN unused by hosts and tagging the native VLAN."],
 N("MAC flooding","MAC flooding"),N("STP manipulation","STP manipulation"),N("SYN flood","SYN flood")],[0]);
cat("au-11-5","LNX11",["Віднесіть ознаку в захопленні до атаки.","Assign each capture symptom to the attack."],
 [["Сканування","Scanning"],["ARP spoofing","ARP spoofing"],["DoS","DoS"]],
 [["ICMP echo по всій підмережі .1–.254","ICMP echo across the whole subnet .1–.254",0],["SYN на сотні портів одного хоста","SYNs to hundreds of ports on one host",0],["Gratuitous ARP з MAC, що змінився для IP шлюзу","Gratuitous ARP with a changed MAC for the gateway IP",1],["Wireshark: duplicate use of 192.168.1.1 detected","Wireshark: duplicate use of 192.168.1.1 detected",1],["Тисячі SYN без завершення рукостискання з різних IP","Thousands of SYNs from many IPs that never finish the handshake",2]],
 ["Фільтри Wireshark: arp.duplicate-address-detected, tcp.flags.syn==1 && tcp.flags.ack==0.","Wireshark filters: arp.duplicate-address-detected, tcp.flags.syn==1 && tcp.flags.ack==0."]);
mc("au-11-6","LNX11",["Який фільтр Wireshark покаже лише SYN без ACK (початок з'єднань)?","Which Wireshark filter shows only SYN without ACK (connection starts)?"],[
 ["tcp.flags.syn == 1 && tcp.flags.ack == 0","Правильно.","tcp.flags.syn == 1 && tcp.flags.ack == 0","Correct."],
 ["tcp.port == 80","Це за портом.","tcp.port == 80","That filters by port."],["arp","Це ARP.","arp","That is ARP."],["icmp.type == 8","Це ping-запити.","icmp.type == 8","Those are ping requests."]],[0]);

// ===== LNX12: харденінг за CIS =====
mc("au-12-1","LNX12",["Що таке CIS Benchmark для Cisco IOS?","What is the CIS Benchmark for Cisco IOS?"],[
 ["Набір рекомендацій із безпечного налаштування (площини управління, керування й даних) з перевірками й командами","Правильно.","A set of secure-configuration recommendations (management, control and data planes) with audit checks and commands","Correct."],
 N("Тест швидкодії","A performance test"),N("Ліцензія Cisco","A Cisco license"),N("Протокол моніторингу","A monitoring protocol")],[0]);
mc("au-12-2","LNX12",["Чому CIS рекомендує no ip source-route?","Why does CIS recommend no ip source-route?"],[
 ["Маршрутизація за джерелом дозволяє відправнику вказати шлях пакета й обійти засоби захисту","Правильно.","Source routing lets the sender dictate the packet path and bypass security controls","Correct."],
 N("Щоб пришвидшити OSPF","To speed up OSPF"),N("Це вимикає статичні маршрути","It disables static routes"),N("Щоб увімкнути NAT","To enable NAT")],[0]);
mc("au-12-3","LNX12",["Навіщо no ip proxy-arp на зовнішніх інтерфейсах?","Why use no ip proxy-arp on external interfaces?"],[
 ["Proxy ARP розширює L2-домен і допомагає атакам на кшталт обходу сегментації","Правильно.","Proxy ARP extends the L2 domain and helps attacks such as bypassing segmentation","Correct."],
 N("Без цього не працює DHCP","DHCP does not work without it"),N("Щоб увімкнути CDP","To enable CDP"),N("Це вимикає ARP повністю","It disables ARP entirely")],[0]);
mc("au-12-4","LNX12",["Яка команда CIS захищає від зависання «мертвих» TCP-сесій на vty?","Which CIS command protects against dead TCP sessions hanging on vty lines?"],[
 ["service tcp-keepalives-in","Правильно.","service tcp-keepalives-in","Correct."],
 ["exec-timeout 0 0","Навпаки, вимикає тайм-аут.","exec-timeout 0 0","The opposite: it disables the timeout."],["no service pad","Інша рекомендація.","no service pad","A different recommendation."],["ip ssh version 2","Інша рекомендація.","ip ssh version 2","A different recommendation."]],[0]);
cat("au-12-5","LNX12",["Віднесіть засоби захисту маршрутизатора до площини, яку вони захищають.","Assign each router protection to the plane it protects."],
 [["Площина управління (management)","Management plane"],["Площина керування (control)","Control plane"],["Площина даних (data)","Data plane"]],
 [["SSH v2, exec-timeout, AAA","SSH v2, exec-timeout, AAA",0],["Банер входу й обмеження vty через access-class","Login banner and vty restriction with access-class",0],["Автентифікація сусідів OSPF","OSPF neighbor authentication",1],["CoPP — обмеження трафіку до CPU","CoPP — rate-limiting traffic to the CPU",1],["no ip source-route і no ip proxy-arp","no ip source-route and no ip proxy-arp",2],["ACL на транзитний трафік, uRPF","ACLs on transit traffic, uRPF",2]],
 ["Управління — доступ адміністраторів; керування — протоколи маршрутизації й CPU; дані — пакети, що проходять крізь пристрій.","Management is admin access; control is routing protocols and the CPU; data is packets passing through the device."]);
mc("au-12-6","LNX12",["Чому вимикають ip http server, але залишають ip http secure-server (якщо потрібен веб або RESTCONF)?","Why disable ip http server but keep ip http secure-server (if the web UI or RESTCONF is needed)?"],[
 ["HTTP передає облікові дані відкритим текстом, HTTPS — шифрує","Правильно.","HTTP sends credentials in clear text; HTTPS encrypts them","Correct."],
 N("HTTPS швидший","HTTPS is faster"),N("HTTP не підтримується","HTTP is not supported"),N("Різниці немає","There is no difference")],[0]);
// ---- симлети: атаки в захопленнях ----
const simlet=(id,t,q,ex,parts0)=>{ const parts=parts0.map(([pq,o,a],i)=>{ const m=mix(id+"#"+i,o,a); return [pq,m.o,m.a]; }); QB.push({id,t,type:"simlet",q:q[0],ex,parts:parts.map(([pq,o,a])=>({q:pq[0],o:o.map(x=>[x[0],x[1]]),a}))}); TR[id]={q:q[1],parts:parts.map(([pq,o])=>({q:pq[1],o:o.map(x=>[x[2],x[3]])}))}; };
const CAP=(rows)=>"No.  Time      Source              Destination         Protocol  Info\n"+rows.map((r,i)=>String(i+1).padEnd(5)+r[0].padEnd(10)+r[1].padEnd(20)+r[2].padEnd(20)+r[3].padEnd(10)+r[4]).join("\n");
simlet("au-sl-scan","LNX11",["IDS сповістив про підозрілу активність до сервера 10.1.1.10. Фрагмент захоплення:","The IDS flagged suspicious activity toward server 10.1.1.10. Capture excerpt:"],[
 ["Wireshark",CAP([["0.0000","198.51.100.66","10.1.1.10","TCP","51001 → 21 [SYN]"],["0.0001","10.1.1.10","198.51.100.66","TCP","21 → 51001 [RST, ACK]"],["0.0002","198.51.100.66","10.1.1.10","TCP","51001 → 22 [SYN]"],["0.0003","10.1.1.10","198.51.100.66","TCP","22 → 51001 [SYN, ACK]"],["0.0004","198.51.100.66","10.1.1.10","TCP","51001 → 22 [RST]"],["0.0005","198.51.100.66","10.1.1.10","TCP","51001 → 23 [SYN]"],["0.0006","10.1.1.10","198.51.100.66","TCP","23 → 51001 [RST, ACK]"],["0.0007","198.51.100.66","10.1.1.10","TCP","51001 → 25 [SYN]"],["…","…","…","…","(996 more ports within 0.4 s)"]])]],[
 [["Що відбувається?","What is happening?"],[["Сканування портів SYN (half-open)","Правильно: після SYN-ACK сканер одразу шле RST.","A SYN (half-open) port scan","Correct: after a SYN-ACK the scanner immediately sends RST."],["Звичайна SSH-сесія","Сесія не встановлюється.","A normal SSH session","No session is established."],["SYN flood","Джерело одне й порти різні — це сканування.","A SYN flood","One source and many ports — that is a scan."],["DNS-запити","Ні.","DNS queries","No."]],[0]],
 [["Який порт на сервері відкритий?","Which port is open on the server?"],[["22","Правильно: відповідь SYN-ACK.","22","Correct: it answered SYN-ACK."],["21","RST — закритий.","21","RST means closed."],["23","RST — закритий.","23","RST means closed."],["51001","Це порт сканера.","51001","That is the scanner's port."]],[0]],
 [["Яка реакція доречна?","What is an appropriate response?"],[["Заблокувати 198.51.100.66 на межі й перевірити, чи потрібен SSH з Інтернету (обмежити ACL/VPN)","Правильно.","Block 198.51.100.66 at the edge and check whether SSH from the Internet is needed (restrict with ACL/VPN)","Correct."],["Вимкнути сервер","Надмірно.","Shut down the server","Excessive."],["Нічого не робити","Розвідка часто передує атаці.","Do nothing","Reconnaissance often precedes an attack."],["Змінити IP шлюзу","Не допоможе.","Change the gateway IP","Will not help."]],[0]]]);
simlet("au-sl-arp","LNX11",["Користувачі VLAN 10 скаржаться на обриви. Захоплення на порту ПК 192.168.10.25:","Users in VLAN 10 report drops. Capture on the port of PC 192.168.10.25:"],[
 ["Wireshark",CAP([["0.000","Intel_7a:11:22","Broadcast","ARP","192.168.10.1 is at 00:1b:21:7a:11:22 (duplicate use of 192.168.10.1 detected!)"],["0.950","Cisco_0a:00:01","Broadcast","ARP","192.168.10.1 is at 00:1a:2b:0a:00:01"],["1.001","Intel_7a:11:22","Broadcast","ARP","192.168.10.1 is at 00:1b:21:7a:11:22"],["2.002","Intel_7a:11:22","Broadcast","ARP","192.168.10.1 is at 00:1b:21:7a:11:22"]])],
 ["S1# show interfaces status | include Fa0/14","Fa0/14    Lab-PC             connected    10         a-full a-100 10/100BaseTX"],
 ["S1# show mac address-table address 001b.217a.1122","Vlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n  10    001b.217a.1122    DYNAMIC     Fa0/14"]],[
 [["Що відбувається?","What is happening?"],[["ARP spoofing: хост на Fa0/14 видає себе за шлюз 192.168.10.1","Правильно.","ARP spoofing: the host on Fa0/14 impersonates gateway 192.168.10.1","Correct."],["Нормальне оновлення ARP","Два MAC для однієї IP — аномалія.","A normal ARP refresh","Two MACs for one IP is an anomaly."],["Петля STP","Ні.","An STP loop","No."],["Конфлікт DHCP","Ні.","A DHCP conflict","No."]],[0]],
 [["Яка функція комутатора запобігає цьому?","Which switch feature prevents this?"],[["Dynamic ARP Inspection (з DHCP snooping)","Правильно: DAI звіряє ARP з таблицею прив'язок.","Dynamic ARP Inspection (with DHCP snooping)","Correct: DAI checks ARP against the binding table."],["BPDU guard","Ні.","BPDU guard","No."],["Storm control","Ні.","Storm control","No."],["PortFast","Ні.","PortFast","No."]],[0]]]);
})();
