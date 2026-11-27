// Нові теми CCNA 200-301 v2.0 (з 03.02.2027): агентний AI і промпти, підходи до керування, Ansible, DNS-записи,
// SFTP/SCP, AAA (TACACS+/RADIUS), OSPFv3, VRRP, root/loop guard, storm control, RA guard, діагностика клієнтів.
// Двомовні записи: українська й англійська поруч; генератор розкладає їх у QB_V2 і QB_TR.
(function(){ const QB=window.QB_V2=[], TR=window.QB_TR=window.QB_TR||{};
const perm=(id,n)=>{ let h=2166136261; for(const c of id) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0; const p=[...Array(n).keys()]; for(let i=n-1;i>0;i--){ h=Math.imul(h^(h>>>13),1597334677)>>>0; const j=h%(i+1); [p[i],p[j]]=[p[j],p[i]]; } return p; };
const mix=(id,o,a)=>{ const p=perm(id,o.length); return {o:p.map(i=>o[i]), a:a.map(x=>p.indexOf(x)).sort((x,y)=>x-y)}; };
const mc=(id,t,q,o0,a0)=>{ const {o,a}=mix(id,o0,a0); QB.push({id,t,q:q[0],o:o.map(x=>[x[0],x[1]]),a,v2:1}); TR[id]={q:q[1],o:o.map(x=>[x[2],x[3]])}; };
const order=(id,t,q,items,e)=>{ QB.push({id,t,type:"order",q:q[0],items:items.map(x=>x[0]),e:e[0],v2:1}); TR[id]={q:q[1],items:items.map(x=>x[1]),e:e[1]}; };
const match=(id,t,q,pairs,e)=>{ QB.push({id,t,type:"match",q:q[0],pairs:pairs.map(p=>[p[0],p[1]]),e:e[0],v2:1}); TR[id]={q:q[1],pairs:pairs.map(p=>[p[2],p[3]]),e:e[1]}; };
const fill=(id,t,q,cfg,e)=>{ QB.push({id,t,type:"fill",q:q[0],cfg,e:e[0],v2:1}); TR[id]={q:q[1],e:e[1]}; };

// ----- 5.1 Агентний AI -----
mc("v2-ai-1","ENSA14",["Чим агентний AI відрізняється від звичайного чат-асистента в мережевих операціях?","How does agentic AI differ from a regular chat assistant in network operations?"],[
 ["Агент планує кілька кроків до мети й сам викликає інструменти: show-команди, телеметрію, API, тікети — у межах наданих прав","Правильно.","An agent plans several steps toward a goal and calls tools itself — show commands, telemetry, APIs, tickets — within the permissions it is given","Correct."],
 ["Агент лише відповідає текстом на одне питання","Так працює звичайний чат.","An agent only answers one question with text","That is how a plain chat works."],
 ["Це нова назва SNMP-менеджера","Ні.","It is a new name for an SNMP manager","No."],
 ["Агент працює без будь-яких обмежень доступу — так і має бути","Навпаки, права агента обмежують.","An agent runs with no access limits, as it should","On the contrary, an agent's permissions are restricted."]],[0]);
mc("v2-ai-2","ENSA14",["AI-агент проаналізував логи й пропонує змінити конфігурацію на 40 комутаторах. Яка правильна практика?","After analyzing logs, an AI agent proposes a configuration change on 40 switches. What is the right practice?"],[
 ["Людина переглядає план і затверджує його; зміна — у вікні змін з планом відкату й перевіркою результату","Правильно: human-in-the-loop.","A human reviews and approves the plan; the change runs in a change window with a rollback plan and verification","Correct: human in the loop."],
 ["Дозволити агенту застосувати зміну одразу","Масова зміна без перевірки — великий ризик.","Let the agent apply the change immediately","A mass change without review is a big risk."],
 ["Вимкнути логування, щоб агент не відволікався","Ні.","Disable logging so the agent is not distracted","No."],
 ["Дати агенту обліковий запис з privilege 15 на всіх пристроях без журналювання","Порушує принцип найменших привілеїв.","Give the agent a privilege 15 account on every device with no logging","Violates least privilege."]],[0]);
mc("v2-ai-3","ENSA14",["Який принцип безпеки застосовують до AI-агента з доступом до мережевих пристроїв?","Which security principle applies to an AI agent with access to network devices?"],[
 ["Найменші привілеї: за замовчуванням лише читання, окремі облікові дані, аудит усіх дій","Правильно.","Least privilege: read-only by default, dedicated credentials, and an audit of every action","Correct."],
 ["Спільний пароль адміністратора","Ні.","A shared administrator password","No."],
 ["Повний доступ, щоб агент міг усе виправити сам","Ризиковано.","Full access so the agent can fix everything itself","Risky."],
 ["Доступ без автентифікації для швидкості","Ні.","Access without authentication for speed","No."]],[0]);
mc("v2-ai-4","ENSA14",["Цифровий мережевий асистент назвав ймовірну причину проблеми. Як правильно оцінити цю рекомендацію?","A digital network assistant named a likely root cause. How should you evaluate this recommendation?"],[
 ["Перевірити її за даними: show-виводи, логи, телеметрія; AI може помилятися","Правильно.","Verify it against data: show output, logs, telemetry; AI can be wrong","Correct."],
 ["Прийняти без перевірки","Ні.","Accept it without checking","No."],
 ["Ігнорувати будь-які рекомендації AI","Корисні підказки теж втрачаються.","Ignore every AI recommendation","You would lose useful hints too."],
 ["Перезавантажити мережу, щоб перевірити","Ні.","Reload the network to test it","No."]],[0]);

// ----- 5.2 Промпти до GenAI -----
mc("v2-pr-1","ENSA14",["Який промпт до GenAI найкраще підходить для аналізу syslog?","Which GenAI prompt is best for analyzing syslog?"],[
 ["«Ти — мережевий інженер. Проаналізуй ці 20 рядків syslog (паролі й публічні IP вилучено), знайди причину падіння OSPF-сусідства. Відповідь — таблиця: час, пристрій, подія, ймовірна причина.»","Правильно: роль, задача, очищені дані, формат.","'You are a network engineer. Analyze these 20 syslog lines (passwords and public IPs removed) and find why the OSPF adjacency dropped. Answer as a table: time, device, event, likely cause.'","Correct: role, task, sanitized data, format."],
 ["«Що не так з мережею?»","Немає ні даних, ні контексту.","'What is wrong with the network?'","No data and no context."],
 ["«Ось повний running-config з паролями, знайди помилку»","Секрети не можна передавати.","'Here is the full running-config with passwords, find the error'","Secrets must not be shared."],
 ["«Напиши щось про OSPF»","Задача не сформульована.","'Write something about OSPF'","The task is not defined."]],[0]);
mc("v2-pr-2","ENSA14",["Що не можна вставляти в промпт публічного GenAI-сервісу? (Оберіть два.)","What must you not paste into a prompt for a public GenAI service? (Choose two.)"],[
 ["Паролі, ключі й інші секрети","Правильно.","Passwords, keys, and other secrets","Correct."],
 ["Конфіденційні дані компанії й персональні дані клієнтів","Правильно: класифікація даних.","Confidential company data and customer personal data","Correct: data classification."],
 ["Загальне питання про роботу OSPF","Це безпечно.","A general question about how OSPF works","That is safe."],
 ["Знеособлений фрагмент show ip ospf neighbor","Після очищення — допустимо.","A sanitized excerpt of show ip ospf neighbor","Acceptable once sanitized."]],[0,1]);
mc("v2-pr-3","ENSA14",["Навіщо в промпті явно вказувати формат відповіді (таблиця, JSON, список команд)?","Why specify the answer format explicitly in a prompt (table, JSON, list of commands)?"],[
 ["Щоб отримати передбачуваний результат, який легко перевірити й обробити автоматично","Правильно.","To get a predictable result that is easy to verify and process automatically","Correct."],
 ["Щоб AI не помилявся","Формат не гарантує правильності.","So the AI never makes mistakes","Format does not guarantee correctness."],
 ["Щоб відповідь була зашифрована","Ні.","So the answer is encrypted","No."],
 ["Формат ні на що не впливає","Впливає.","The format has no effect","It does."]],[0]);
mc("v2-pr-4","ENSA14",["Що дає вказівка персони в промпті («Ти — досвідчений інженер з мережевої безпеки»)?","What does setting a persona in a prompt ('You are an experienced network security engineer') do?"],[
 ["Задає контекст, рівень експертизи й термінологію відповіді","Правильно.","It sets the context, expertise level, and terminology of the answer","Correct."],
 ["Надає AI доступ до пристроїв","Ні.","It gives the AI access to devices","No."],
 ["Гарантує правильну відповідь","Не гарантує.","It guarantees a correct answer","It does not."],
 ["Обходить політики безпеки","Ні.","It bypasses security policies","No."]],[0]);

// ----- 5.3 Підходи до керування, 5.5 Ansible -----
match("v2-mg-1","ENSA14",["Зіставте підхід до керування мережею з прикладом.","Match the network management approach with an example."],[
 ["На кожному пристрої","CLI через SSH на кожен комутатор окремо","Device-based","CLI over SSH to each switch separately"],
 ["Хмарне керування","Панель Meraki в браузері","Cloud-based","The Meraki dashboard in a browser"],
 ["Контролерне","Catalyst Center або WLC керує групою пристроїв","Controller-based","Catalyst Center or a WLC manages a group of devices"],
 ["Автоматизація","Ansible-плейбук виконує команди на 50 пристроях","Automation-based","An Ansible playbook runs commands on 50 devices"],
 ["Інфраструктура як код","Бажаний стан у файлах Terraform у Git з рев'ю змін","Infrastructure as code","Desired state in Terraform files in Git with change review"]],["На іспиті v2.0 важливо розуміти, коли який підхід доречний.","For the v2.0 exam, know when each approach fits."]);
mc("v2-mg-2","ENSA14",["Яка головна ідея Infrastructure as Code?","What is the main idea of Infrastructure as Code?"],[
 ["Бажана конфігурація зберігається як код у системі контролю версій, проходить рев'ю й застосовується автоматично й відтворювано","Правильно.","The desired configuration is stored as code in version control, reviewed, and applied automatically and reproducibly","Correct."],
 ["Конфігурацію пишуть вручну на кожному пристрої","Ні.","Configuration is typed by hand on each device","No."],
 ["Пристрої програмують мовою асемблера","Ні.","Devices are programmed in assembly language","No."],
 ["Код замінює протоколи маршрутизації","Ні.","Code replaces routing protocols","No."]],[0]);
mc("v2-mg-3","ENSA13",["Яка перевага хмарного керування мережею?","What is an advantage of cloud-based network management?"],[
 ["Єдина панель, доступна звідусіль, zero-touch provisioning і жодного локального контролера","Правильно.","A single dashboard reachable from anywhere, zero-touch provisioning, and no on-premises controller","Correct."],
 ["Працює без доступу до Інтернету","Для керування Інтернет потрібен.","It works without Internet access","Management needs Internet access."],
 ["Не потребує облікових записів","Ні.","It needs no accounts","No."],
 ["Увесь користувацький трафік іде через хмару","Через хмару йде керування.","All user traffic goes through the cloud","Management goes through the cloud."]],[0]);
mc("v2-an-1","ENSA14",["Який модуль Ansible використовують, щоб виконати show-команду на Cisco IOS і отримати вивід?","Which Ansible module runs a show command on Cisco IOS and returns the output?"],[
 ["cisco.ios.ios_command","Правильно.","cisco.ios.ios_command","Correct."],
 ["cisco.ios.ios_config","Вносить зміни в конфігурацію.","cisco.ios.ios_config","It changes the configuration."],
 ["cisco.ios.ios_vlans","Керує VLAN декларативно.","cisco.ios.ios_vlans","Manages VLANs declaratively."],
 ["ansible.builtin.ping","Перевіряє зв'язок Ansible з вузлом (для мережевих пристроїв не підходить).","ansible.builtin.ping","Checks Ansible connectivity to a host (not for network devices)."]],[0]);
order("v2-an-2","ENSA14",["Розставте кроки першого запуску Ansible для мережевих пристроїв.","Put the steps of a first Ansible run for network devices in order."],[
 ["Описати пристрої й групи в inventory","Describe devices and groups in the inventory"],
 ["Задати змінні підключення: ansible_network_os, ansible_connection=network_cli, облікові дані","Set connection variables: ansible_network_os, ansible_connection=network_cli, credentials"],
 ["Написати playbook із задачами","Write a playbook with tasks"],
 ["Запустити ansible-playbook","Run ansible-playbook"],
 ["Перевірити результат; повторний запуск має дати changed=0","Check the result; a second run should show changed=0"]],["changed=0 на другому запуску — ознака ідемпотентного плейбука.","changed=0 on the second run indicates an idempotent playbook."]);

// ----- 4.4 DNS-записи -----
match("v2-dns-1","ITN15",["Зіставте тип DNS-запису з призначенням.","Match the DNS record type with its purpose."],[
 ["A","Ім'я → IPv4-адреса","A","Name to IPv4 address"],["AAAA","Ім'я → IPv6-адреса","AAAA","Name to IPv6 address"],["CNAME","Псевдонім для іншого імені","CNAME","Alias for another name"],
 ["MX","Поштовий сервер домену","MX","Mail server for the domain"],["NS","Авторитетний DNS-сервер зони","NS","Authoritative name server for the zone"],["PTR","IP-адреса → ім'я (зворотна зона)","PTR","IP address to name (reverse zone)"]],["У v2.0 треба діагностувати проблеми саме за типами записів.","In v2.0 you must troubleshoot problems by record type."]);
mc("v2-dns-2","ITN15",["Сайт компанії працює, але зовнішня пошта на домен не доходить. Який запис перевірити першим?","The company website works, but external mail to the domain is not delivered. Which record do you check first?"],[
 ["MX","Правильно. Він вказує поштовий сервер домену.","MX","Correct. It points to the domain's mail server."],["A для www","Сайт працює, тож A в порядку.","The A record for www","The site works, so A is fine."],["PTR","Впливає на перевірки антиспаму, але доставку визначає MX.","PTR","Affects anti-spam checks, but delivery is determined by MX."],["NS","Тоді не працював би й сайт.","NS","Then the site would fail too."]],[0]);
mc("v2-dns-3","ITN15",["nslookup 10.1.1.20 повертає «Non-existent domain», хоча nslookup srv1.corp.local дає 10.1.1.20. Якого запису бракує?","nslookup 10.1.1.20 returns 'Non-existent domain', although nslookup srv1.corp.local returns 10.1.1.20. Which record is missing?"],[
 ["PTR у зворотній зоні","Правильно.","A PTR record in the reverse zone","Correct."],["A","Прямий пошук працює.","A","The forward lookup works."],["CNAME","Не пов'язано.","CNAME","Unrelated."],["MX","Не пов'язано.","MX","Unrelated."]],[0]);
mc("v2-dns-4","ITN15",["www.corp.example має бути псевдонімом для web01.corp.example. Який запис створити?","www.corp.example must be an alias for web01.corp.example. Which record do you create?"],[
 ["CNAME","Правильно.","CNAME","Correct."],["PTR","Зворотний пошук.","PTR","Reverse lookup."],["MX","Пошта.","MX","Mail."],["NS","Делегування зони.","NS","Zone delegation."]],[0]);

// ----- 4.2 SFTP/SCP -----
mc("v2-scp-1","ENSA10",["Яка команда безпечно копіює startup-config з маршрутизатора на сервер?","Which command securely copies the startup-config from a router to a server?"],[
 ["copy startup-config sftp://admin@10.1.1.10/r1.cfg","Правильно. SFTP працює поверх SSH.","copy startup-config sftp://admin@10.1.1.10/r1.cfg","Correct. SFTP runs over SSH."],
 ["copy startup-config tftp:","TFTP без шифрування й автентифікації.","copy startup-config tftp:","TFTP has no encryption or authentication."],
 ["write sftp 10.1.1.10","Такої команди немає.","write sftp 10.1.1.10","There is no such command."],
 ["show startup-config | sftp","Ні.","show startup-config | sftp","No."]],[0]);
mc("v2-scp-2","ENSA10",["Чим SFTP відрізняється від FTPS?","How does SFTP differ from FTPS?"],[
 ["SFTP — підсистема SSH (TCP 22), FTPS — класичний FTP, захищений TLS","Правильно.","SFTP is an SSH subsystem (TCP 22); FTPS is classic FTP protected by TLS","Correct."],
 ["Це одне й те саме","Різні протоколи.","They are the same thing","They are different protocols."],
 ["SFTP працює через UDP 69","Це TFTP.","SFTP runs over UDP 69","That is TFTP."],
 ["FTPS не шифрує","Шифрує через TLS.","FTPS does not encrypt","It encrypts with TLS."]],[0]);

// ----- 4.1 AAA -----
mc("v2-aaa-1","SRWE10",["Чим TACACS+ відрізняється від RADIUS? (Оберіть два.)","How does TACACS+ differ from RADIUS? (Choose two.)"],[
 ["TACACS+ шифрує все тіло пакета, RADIUS — лише пароль","Правильно.","TACACS+ encrypts the whole packet body; RADIUS encrypts only the password","Correct."],
 ["TACACS+ розділяє автентифікацію, авторизацію й облік і вміє авторизувати кожну команду (TCP 49)","Правильно. Тому його обирають для адміністрування пристроїв.","TACACS+ separates authentication, authorization, and accounting and can authorize each command (TCP 49)","Correct. That is why it is chosen for device administration."],
 ["RADIUS використовує TCP 49","RADIUS — UDP 1812/1813.","RADIUS uses TCP 49","RADIUS uses UDP 1812/1813."],
 ["TACACS+ працює через UDP 1812","Ні.","TACACS+ runs over UDP 1812","No."]],[0,1]);
fill("v2-aaa-2","SRWE10",["Налаштуйте вхід адміністраторів через TACACS+ із резервом на локальну базу.","Configure administrator login through TACACS+ with fallback to the local database."],
 "R1(config)# username admin secret Str0ng!\nR1(config)# aaa [[new-model]]\nR1(config)# tacacs server ISE1\nR1(config-server-tacacs)# address ipv4 10.1.1.5\nR1(config-server-tacacs)# key K3y!\nR1(config)# aaa authentication login default group [[tacacs+]] [[local]]\nR1(config)# line vty 0 4\nR1(config-line)# login authentication default",
 ["Локальна база спрацює, лише коли TACACS+-сервер не відповідає; якщо сервер відхилив пароль, вхід заборонено.","The local database is used only when the TACACS+ server does not respond; if the server rejects the password, login is denied."]);
mc("v2-aaa-3","SRWE10",["Команда: aaa authentication login default group tacacs+ local. Коли буде використано локальну базу?","Command: aaa authentication login default group tacacs+ local. When is the local database used?"],[
 ["Лише якщо TACACS+-сервер недоступний (немає відповіді)","Правильно.","Only if the TACACS+ server is unreachable (no response)","Correct."],
 ["Якщо сервер відхилив пароль","Відмова сервера — остаточна.","If the server rejected the password","A server rejection is final."],
 ["Завжди першою","Порядок — зліва направо.","Always first","The order is left to right."],
 ["Ніколи","Ні.","Never","No."]],[0]);

// ----- 3.3 OSPFv3 -----
mc("v2-o3-1","ENSA2",["Як увімкнути класичний OSPFv3 на інтерфейсі?","How do you enable classic OSPFv3 on an interface?"],[
 ["Командою ipv6 ospf 1 area 0 в режимі інтерфейсу (плюс ipv6 unicast-routing і router-id)","Правильно. Команди network в OSPFv3 немає.","With ipv6 ospf 1 area 0 in interface mode (plus ipv6 unicast-routing and a router-id)","Correct. OSPFv3 has no network command."],
 ["network 2001:db8::/64 area 0","Так не працює.","network 2001:db8::/64 area 0","That does not work."],
 ["router ospf 1, потім ipv6 enable","Ні.","router ospf 1, then ipv6 enable","No."],
 ["ospf ipv6 area 0","Такої команди немає.","ospf ipv6 area 0","There is no such command."]],[0]);
mc("v2-o3-2","ENSA2",["Чому маршрутизатору лише з IPv6-адресами для OSPFv3 потрібен явний router-id?","Why does a router with only IPv6 addresses need an explicit router-id for OSPFv3?"],[
 ["Router ID — 32-бітне значення у форматі IPv4; без IPv4-адрес його ні з чого взяти, і процес не запуститься","Правильно.","The router ID is a 32-bit value in IPv4 format; with no IPv4 addresses there is nothing to derive it from, so the process will not start","Correct."],
 ["Бо OSPFv3 не використовує router ID","Використовує.","Because OSPFv3 does not use a router ID","It does."],
 ["Router ID має бути IPv6-адресою","Ні, він 32-бітний.","The router ID must be an IPv6 address","No, it is 32-bit."],
 ["Щоб увімкнути шифрування","Ні.","To enable encryption","No."]],[0]);
mc("v2-o3-3","ENSA2",["Які адреси використовує OSPFv3 для hello?","Which addresses does OSPFv3 use for hellos?"],[
 ["Джерело — link-local, призначення — FF02::5 (усі OSPF-маршрутизатори)","Правильно. FF02::6 — для DR/BDR.","Source is link-local, destination is FF02::5 (all OSPF routers)","Correct. FF02::6 is for the DR/BDR."],
 ["Джерело — глобальна адреса, призначення — FF02::1","Ні.","Source is a global address, destination is FF02::1","No."],
 ["224.0.0.5","Це OSPFv2.","224.0.0.5","That is OSPFv2."],
 ["Unicast на кожного сусіда","Лише на певних типах мереж.","Unicast to each neighbor","Only on certain network types."]],[0]);

// ----- 3.4 VRRP -----
mc("v2-vr-1","SRWE9",["Чим VRRP відрізняється від HSRP? (Оберіть два.)","How does VRRP differ from HSRP? (Choose two.)"],[
 ["VRRP — відкритий стандарт IETF, HSRP — протокол Cisco","Правильно.","VRRP is an open IETF standard; HSRP is a Cisco protocol","Correct."],
 ["У VRRP preempt увімкнено за замовчуванням, у HSRP — ні","Правильно.","In VRRP, preemption is enabled by default; in HSRP it is not","Correct."],
 ["VRRP працює лише з IPv6","Підтримує обидва.","VRRP works only with IPv6","It supports both."],
 ["У VRRP ролі називаються active і standby","У VRRP — master і backup.","In VRRP the roles are active and standby","In VRRP they are master and backup."]],[0,1]);
mc("v2-vr-2","SRWE9",["show vrrp brief: R1 — Master, priority 110; R2 — Backup, priority 100. Що станеться, якщо на R2 задати priority 120?","show vrrp brief: R1 is Master with priority 110; R2 is Backup with priority 100. What happens if R2 is set to priority 120?"],[
 ["R2 стане Master, бо preempt у VRRP увімкнено за замовчуванням","Правильно.","R2 becomes Master because VRRP preemption is on by default","Correct."],
 ["Нічого, поки R1 працює","Так було б у HSRP без preempt.","Nothing while R1 is up","That would be HSRP without preempt."],
 ["Обидва стануть Master","Ні.","Both become Master","No."],
 ["Віртуальна IP-адреса зміниться","Ні.","The virtual IP address changes","No."]],[0]);

// ----- 2.5 root guard, loop guard; 4.7 storm control, RA guard -----
mc("v2-sg-1","SRWE5",["Що робить root guard?","What does root guard do?"],[
 ["Якщо на порт приходить кращий (superior) BPDU, переводить порт у root-inconsistent і блокує його, захищаючи розташування root","Правильно.","If a superior BPDU arrives on the port, it puts the port into root-inconsistent state and blocks it, protecting the root placement","Correct."],
 ["Переводить порт в err-disabled на будь-який BPDU","Це BPDU guard.","Err-disables the port on any BPDU","That is BPDU guard."],
 ["Захищає від односпрямованих лінків","Це loop guard.","Protects against unidirectional links","That is loop guard."],
 ["Обмежує широкомовний трафік","Це storm control.","Limits broadcast traffic","That is storm control."]],[0]);
mc("v2-sg-2","SRWE5",["Від чого захищає loop guard?","What does loop guard protect against?"],[
 ["Якщо root- або alternate-порт перестав отримувати BPDU (наприклад, односпрямований лінк), порт переходить у loop-inconsistent замість forwarding","Правильно.","If a root or alternate port stops receiving BPDUs (for example on a unidirectional link), the port goes loop-inconsistent instead of forwarding","Correct."],
 ["Від чужого комутатора з пріоритетом 0","Це root guard.","From a rogue switch with priority 0","That is root guard."],
 ["Від rogue DHCP","Це DHCP snooping.","From rogue DHCP","That is DHCP snooping."],
 ["Від MAC flooding","Це port security.","From MAC flooding","That is port security."]],[0]);
mc("v2-sg-3","SRWE5",["Де вмикають root guard, а де — BPDU guard?","Where do you enable root guard, and where BPDU guard?"],[
 ["Root guard — на designated-портах до комутаторів, які ніколи не повинні стати root; BPDU guard — на access-портах з PortFast до кінцевих пристроїв","Правильно.","Root guard on designated ports toward switches that must never become root; BPDU guard on PortFast access ports toward end devices","Correct."],
 ["Обидва — лише на trunk до ядра","Ні.","Both only on trunks to the core","No."],
 ["Root guard — на портах до ПК, BPDU guard — на uplink","Навпаки й небезпечно: uplink піде в err-disabled.","Root guard toward PCs, BPDU guard on uplinks","Reversed and dangerous: the uplink would err-disable."],
 ["Лише на root bridge","Ні.","Only on the root bridge","No."]],[0]);
mc("v2-sg-4","SRWE11",["Що робить команда storm-control broadcast level 20 на інтерфейсі?","What does storm-control broadcast level 20 do on an interface?"],[
 ["Коли широкомовний трафік перевищує 20% смуги порту, надлишок відкидається (або порт вимикається, якщо задано action shutdown)","Правильно.","When broadcast traffic exceeds 20% of the port bandwidth, the excess is dropped (or the port shuts down if action shutdown is set)","Correct."],
 ["Дозволяє лише 20 MAC-адрес","Це port security.","Allows only 20 MAC addresses","That is port security."],
 ["Обмежує DHCP до 20 пакетів за секунду","Це DHCP snooping rate limit.","Limits DHCP to 20 packets per second","That is the DHCP snooping rate limit."],
 ["Ставить пріоритет 20 для широкомовлення","Ні.","Sets priority 20 for broadcasts","No."]],[0]);
mc("v2-sg-5","SRWE11",["Від якої атаки захищає IPv6 RA guard?","Which attack does IPv6 RA guard protect against?"],[
 ["Від підроблених Router Advertisement з портів кінцевих вузлів (фальшивий шлюз або префікс)","Правильно.","Spoofed Router Advertisements from host ports (a fake gateway or prefix)","Correct."],
 ["Від rogue DHCPv4","Це DHCP snooping.","Rogue DHCPv4","That is DHCP snooping."],
 ["Від ARP-спуфінгу","Це DAI.","ARP spoofing","That is DAI."],
 ["Від петель STP","Це BPDU guard і loop guard.","STP loops","That is BPDU guard and loop guard."]],[0]);

// ----- 2.4 packet capture, 1.6 клієнти, 1.5 завади -----
mc("v2-pc-1","ENSA12",["У захопленні пакетів видно TCP SYN від клієнта на порт 443 сервера, а у відповідь — RST. Що це означає?","A packet capture shows a TCP SYN from the client to server port 443 and an RST in reply. What does this mean?"],[
 ["Сервер досяжний, але на порту 443 ніщо не слухає (або з'єднання відхиляється)","Правильно. Якби фільтрував firewall, найчастіше відповіді не було б зовсім.","The server is reachable, but nothing is listening on port 443 (or the connection is rejected)","Correct. If a firewall filtered it, there would usually be no reply at all."],
 ["Сервер недосяжний на рівні 3","Тоді RST не прийшов би.","The server is unreachable at Layer 3","Then no RST would come back."],
 ["Не працює DNS","Ім'я вже розв'язано: є IP.","DNS is broken","The name is already resolved: there is an IP."],
 ["З'єднання встановлено успішно","Для цього потрібен SYN-ACK.","The connection succeeded","That requires a SYN-ACK."]],[0]);
mc("v2-cl-1","ITN13",["Яка команда в Linux показує IP-адреси інтерфейсів?","Which Linux command shows interface IP addresses?"],[
 ["ip address show (скорочено ip a)","Правильно.","ip address show (short: ip a)","Correct."],["ipconfig /all","Це Windows.","ipconfig /all","That is Windows."],["show ip interface brief","Це Cisco IOS.","show ip interface brief","That is Cisco IOS."],["netsh interface show","Це Windows.","netsh interface show","That is Windows."]],[0]);
mc("v2-cl-2","ITN13",["Яка команда в macOS показує таблицю маршрутизації разом зі шлюзом за замовчуванням?","Which macOS command shows the routing table including the default gateway?"],[
 ["netstat -rn","Правильно (також route -n get default).","netstat -rn","Correct (also route -n get default)."],["ipconfig /all","Це Windows.","ipconfig /all","That is Windows."],["ip route","Це Linux.","ip route","That is Linux."],["show ip route","Це Cisco IOS.","show ip route","That is Cisco IOS."]],[0]);
mc("v2-wl-1","SRWE12",["Що найчастіше створює завади в діапазоні 2,4 ГГц?","What most often causes interference in the 2.4 GHz band?"],[
 ["Мікрохвильова піч, Bluetooth і сусідні мережі на каналах, що перекриваються","Правильно. Неперекривні канали — 1, 6, 11.","A microwave oven, Bluetooth, and neighboring networks on overlapping channels","Correct. The non-overlapping channels are 1, 6, and 11."],
 ["Оптоволоконний кабель","Світло не створює радіозавад.","A fiber-optic cable","Light does not cause radio interference."],
 ["Точка доступу на каналі 36","Це діапазон 5 ГГц.","An access point on channel 36","That is the 5 GHz band."],
 ["UTP-кабель категорії 6","Ні.","A Category 6 UTP cable","No."]],[0]);
})();
