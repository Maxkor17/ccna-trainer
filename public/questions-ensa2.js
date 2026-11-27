// ENSA 7–14: додаткові питання з розбором (двомовні записи: українська + англійська в одному місці).
// Генератор нижче розкладає їх у банк QB_ENSA2 і в переклади QB_TR — окремий tr-файл не потрібен.
(function(){ const QB=window.QB_ENSA2=[], TR=window.QB_TR=window.QB_TR||{};
const perm=(id,n)=>{ let h=2166136261; for(const c of id) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0; const p=[...Array(n).keys()]; for(let i=n-1;i>0;i--){ h=Math.imul(h^(h>>>13),1597334677)>>>0; const j=h%(i+1); [p[i],p[j]]=[p[j],p[i]]; } return p; };
const mix=(id,o,a)=>{ const p=perm(id,o.length); return {o:p.map(i=>o[i]), a:a.map(x=>p.indexOf(x)).sort((x,y)=>x-y)}; };
const mc=(id,t,q,o0,a0)=>{ const {o,a}=mix(id,o0,a0); QB.push({id,t,q:q[0],o:o.map(x=>[x[0],x[1]]),a}); TR[id]={q:q[1],o:o.map(x=>[x[2],x[3]])}; };
const order=(id,t,q,items,e)=>{ QB.push({id,t,type:"order",q:q[0],items:items.map(x=>x[0]),e:e[0]}); TR[id]={q:q[1],items:items.map(x=>x[1]),e:e[1]}; };
const match=(id,t,q,pairs,e)=>{ QB.push({id,t,type:"match",q:q[0],pairs:pairs.map(p=>[p[0],p[1]]),e:e[0]}); TR[id]={q:q[1],pairs:pairs.map(p=>[p[2],p[3]]),e:e[1]}; };
const fill=(id,t,q,cfg,e)=>{ QB.push({id,t,type:"fill",q:q[0],cfg,e:e[0]}); TR[id]={q:q[1],e:e[1]}; };

// ===== ENSA 7. Принципи WAN =====
mc("e7x-1","ENSA7",["Що таке точка розмежування (demarcation point) у WAN?","What is the demarcation point in a WAN?"],[
 ["Межа між обладнанням замовника і мережею провайдера, де закінчується відповідальність провайдера","Правильно. Усе з боку провайдера від цієї точки — його зона відповідальності.","The boundary between customer equipment and the provider network, where the provider's responsibility ends","Correct. Everything on the provider side of this point is the provider's responsibility."],
 ["Найближчий до замовника вузол комутації провайдера","Це central office (CO).","The provider switching office closest to the customer","That is the central office (CO)."],
 ["Пристрій, що перетворює цифровий сигнал для лінії провайдера","Це DCE (модем, CSU/DSU).","The device that converts the digital signal for the provider line","That is the DCE (modem, CSU/DSU)."],
 ["Точка обміну трафіком між провайдерами","Це IXP, а не демаркація.","The point where providers exchange traffic","That is an IXP, not the demarcation point."]],[0]);
mc("e7x-2","ENSA7",["Який пристрій на боці провайдера агрегує DSL-лінії абонентів?","Which provider-side device aggregates subscriber DSL lines?"],[
 ["DSLAM","Правильно. DSL Access Multiplexer збирає лінії абонентів.","DSLAM","Correct. The DSL Access Multiplexer aggregates subscriber lines."],
 ["CMTS","Це головна станція кабельної мережі (DOCSIS).","CMTS","That is the cable network headend (DOCSIS)."],
 ["OLT","Це термінал оптичної мережі PON (FTTH).","OLT","That is the optical line terminal of a PON (FTTH)."],
 ["Кабельний модем","Це абонентський пристрій кабельної мережі.","Cable modem","That is the subscriber device in a cable network."]],[0]);
mc("e7x-3","ENSA7",["Компанія має два з'єднання з одним і тим самим провайдером. Як називається такий варіант?","A company has two connections to the same ISP. What is this option called?"],[
 ["Dual-homed","Правильно. Два канали, один провайдер.","Dual-homed","Correct. Two links, one provider."],
 ["Single-homed","Один канал до одного провайдера.","Single-homed","One link to one provider."],
 ["Multihomed","Канали до різних провайдерів.","Multihomed","Links to different providers."],
 ["Dual-multihomed","Кілька каналів до кількох провайдерів.","Dual-multihomed","Multiple links to multiple providers."]],[0]);
mc("e7x-4","ENSA7",["Яка технологія доступу використовує коаксіальну інфраструктуру кабельного телебачення?","Which access technology uses the coaxial cable TV infrastructure?"],[
 ["Кабельний Інтернет (DOCSIS)","Правильно.","Cable Internet (DOCSIS)","Correct."],
 ["DSL","Використовує телефонну мідну пару.","DSL","Uses the copper telephone pair."],
 ["Metro Ethernet","Оптика або мідь провайдера з Ethernet-сервісом.","Metro Ethernet","Provider fiber or copper with an Ethernet service."],
 ["VSAT","Супутниковий зв'язок.","VSAT","Satellite connectivity."]],[0]);
mc("e7x-5","ENSA7",["Які твердження про MPLS правильні? (Оберіть два.)","Which statements about MPLS are true? (Choose two.)"],[
 ["Пакети пересилаються за мітками, а не за IP-адресою призначення","Правильно. Маршрутизатори провайдера комутують за коротким label.","Packets are forwarded based on labels rather than the destination IP address","Correct. Provider routers switch on a short label."],
 ["MPLS може переносити різні протоколи: IPv4, IPv6, Ethernet","Правильно, звідси Multiprotocol.","MPLS can carry different protocols: IPv4, IPv6, Ethernet","Correct, hence Multiprotocol."],
 ["MPLS шифрує трафік клієнтів","Ні. Ізоляція є, шифрування — немає; для нього потрібен IPsec.","MPLS encrypts customer traffic","No. It isolates traffic but does not encrypt it; IPsec is needed for that."],
 ["MPLS працює лише на рівні 1","MPLS розташовують між рівнями 2 і 3.","MPLS operates only at Layer 1","MPLS sits between Layers 2 and 3."]],[0,1]);
match("e7x-6","ENSA7",["Зіставте тип WAN-з'єднання з його ознакою.","Match the WAN connection type with its characteristic."],[
 ["Виділена лінія","Постійний канал точка-точка з фіксованою ціною","Leased line","Permanent point-to-point circuit at a fixed price"],
 ["Комутація каналів","Канал встановлюється на час сеансу","Circuit-switched","A circuit is set up for the duration of a session"],
 ["Комутація пакетів","Спільна інфраструктура з віртуальними каналами","Packet-switched","Shared infrastructure with virtual circuits"],
 ["Інтернет-VPN","Найдешевше: публічний Інтернет плюс шифрування","Internet VPN","Cheapest: the public Internet plus encryption"]],["Сучасні компанії найчастіше поєднують MPLS або Metro Ethernet з Інтернет-VPN як резервом.","Modern companies often combine MPLS or Metro Ethernet with an Internet VPN as backup."]);

// ===== ENSA 8. VPN і IPsec =====
mc("e8x-1","ENSA8",["Чим AH відрізняється від ESP?","How does AH differ from ESP?"],[
 ["AH забезпечує цілісність і автентифікацію без шифрування, ESP може ще й шифрувати","Правильно. AH — IP-протокол 51, ESP — 50.","AH provides integrity and authentication without encryption; ESP can also encrypt","Correct. AH is IP protocol 51, ESP is 50."],
 ["AH шифрує, а ESP лише перевіряє цілісність","Навпаки.","AH encrypts while ESP only checks integrity","It is the other way round."],
 ["Обидва шифрують, але AH швидший","AH не шифрує зовсім.","Both encrypt, but AH is faster","AH does not encrypt at all."],
 ["ESP працює лише в transport mode","ESP працює і в transport, і в tunnel mode.","ESP works only in transport mode","ESP works in both transport and tunnel mode."]],[0]);
mc("e8x-2","ENSA8",["У якому режимі IPsec шифрується весь вихідний IP-пакет разом із заголовком і додається новий IP-заголовок?","In which IPsec mode is the entire original IP packet, including its header, encrypted and a new IP header added?"],[
 ["Tunnel mode","Правильно. Так працюють site-to-site VPN між шлюзами.","Tunnel mode","Correct. Site-to-site VPNs between gateways work this way."],
 ["Transport mode","Захищається лише корисне навантаження, оригінальний заголовок лишається.","Transport mode","Only the payload is protected; the original header stays."],
 ["Aggressive mode","Це режим фази 1 IKEv1, а не режим IPsec.","Aggressive mode","That is an IKEv1 phase 1 mode, not an IPsec mode."],
 ["Main mode","Це теж режим фази 1 IKEv1.","Main mode","That is also an IKEv1 phase 1 mode."]],[0]);
mc("e8x-3","ENSA8",["Які номери протоколу IP мають ESP і AH?","Which IP protocol numbers do ESP and AH use?"],[
 ["ESP — 50, AH — 51","Правильно.","ESP is 50, AH is 51","Correct."],
 ["ESP — 51, AH — 50","Переплутано.","ESP is 51, AH is 50","Swapped."],
 ["ESP — UDP 500, AH — UDP 4500","UDP 500 — IKE, UDP 4500 — NAT-T.","ESP uses UDP 500, AH uses UDP 4500","UDP 500 is IKE, UDP 4500 is NAT-T."],
 ["Обидва — TCP 443","Це HTTPS/SSL VPN.","Both use TCP 443","That is HTTPS/SSL VPN."]],[0]);
mc("e8x-4","ENSA8",["Навіщо IPsec використовує NAT-T (UDP 4500), коли між шлюзами є NAT?","Why does IPsec use NAT-T (UDP 4500) when there is NAT between the gateways?"],[
 ["У ESP немає портів, тому PAT не може його розрізнити; NAT-T загортає ESP в UDP","Правильно.","ESP has no ports, so PAT cannot track it; NAT-T encapsulates ESP in UDP","Correct."],
 ["Щоб пришвидшити шифрування","На швидкість шифрування NAT-T не впливає.","To speed up encryption","NAT-T does not affect encryption speed."],
 ["Бо AH не підтримує IPv6","Не пов'язано з NAT.","Because AH does not support IPv6","Unrelated to NAT."],
 ["Щоб замінити IKE","IKE все одно потрібен для узгодження ключів.","To replace IKE","IKE is still needed to negotiate keys."]],[0]);
mc("e8x-5","ENSA8",["Який алгоритм забезпечує конфіденційність у сучасному IPsec і вважається рекомендованим?","Which algorithm provides confidentiality in modern IPsec and is recommended?"],[
 ["AES","Правильно. Зазвичай AES-256 (або AES-GCM).","AES","Correct. Usually AES-256 (or AES-GCM)."],
 ["DES","Застарілий 56-бітний шифр, легко зламується.","DES","An obsolete 56-bit cipher that is easy to break."],
 ["SHA-256","Це хеш для цілісності, а не шифрування.","SHA-256","That is a hash for integrity, not encryption."],
 ["RSA","Використовується для автентифікації (підписів).","RSA","Used for authentication (signatures)."]],[0]);
mc("e8x-6","ENSA8",["Які з наведених — алгоритми цілісності в IPsec? (Оберіть два.)","Which of these are IPsec integrity algorithms? (Choose two.)"],[
 ["SHA-256","Правильно.","SHA-256","Correct."],
 ["MD5","Правильно: це алгоритм цілісності, хоча й застарілий.","MD5","Correct: it is an integrity algorithm, although obsolete."],
 ["AES","Конфіденційність (шифрування).","AES","Confidentiality (encryption)."],
 ["DH group 14","Обмін ключами.","DH group 14","Key exchange."]],[0,1]);
mc("e8x-7","ENSA8",["Навіщо використовують GRE over IPsec?","Why is GRE over IPsec used?"],[
 ["GRE переносить multicast і протоколи маршрутизації (наприклад, OSPF), а IPsec їх шифрує","Правильно. Сам IPsec через crypto map передає лише unicast.","GRE carries multicast and routing protocols (for example OSPF), and IPsec encrypts them","Correct. Plain IPsec with a crypto map carries unicast only."],
 ["GRE шифрує, а IPsec маршрутизує","GRE не шифрує.","GRE encrypts and IPsec routes","GRE does not encrypt."],
 ["Щоб обійтися без IKE","IKE усе одно потрібен.","To avoid using IKE","IKE is still required."],
 ["Щоб тунель працював без IP-адрес","Тунелю потрібні адреси джерела й призначення.","So the tunnel works without IP addresses","The tunnel needs source and destination addresses."]],[0]);
mc("e8x-8","ENSA8",["Віддаленому працівнику потрібен доступ до внутрішнього веб-порталу без встановлення будь-якого VPN-клієнта. Який варіант підходить?","A remote worker needs access to an internal web portal without installing any VPN client. Which option fits?"],[
 ["Clientless SSL VPN через браузер","Правильно.","Clientless SSL VPN through a browser","Correct."],
 ["Client-based remote access VPN (Cisco Secure Client)","Потребує встановленого клієнта.","Client-based remote-access VPN (Cisco Secure Client)","Requires an installed client."],
 ["Site-to-site IPsec","Потребує VPN-шлюзу на боці користувача.","Site-to-site IPsec","Requires a VPN gateway on the user side."],
 ["GRE-тунель","Не шифрує і не призначений для користувачів.","GRE tunnel","Does not encrypt and is not meant for end users."]],[0]);
order("e8x-9","ENSA8",["Розставте етапи встановлення IPsec-тунелю з IKE.","Put the stages of establishing an IPsec tunnel with IKE in order."],[
 ["Цікавий трафік ініціює тунель","Interesting traffic triggers the tunnel"],
 ["IKE фаза 1: узгодження параметрів, DH, автентифікація сторін","IKE phase 1: negotiate parameters, DH, authenticate peers"],
 ["IKE фаза 2: узгодження IPsec SA","IKE phase 2: negotiate the IPsec SAs"],
 ["Передача даних через IPsec SA","Data transfer over the IPsec SAs"],
 ["Завершення: тайм-аут або видалення SA","Termination: timeout or SA deletion"]],["Фаза 1 будує захищений канал керування (IKE SA), фаза 2 — SA для самих даних.","Phase 1 builds a protected management channel (the IKE SA); phase 2 builds the SAs for the data itself."]);

// ===== ENSA 9. QoS =====
mc("e9x-1","ENSA9",["Яку максимальну односторонню затримку рекомендують для голосу?","What is the recommended maximum one-way delay for voice?"],[
 ["150 мс","Правильно.","150 ms","Correct."],["30 мс","Це рекомендований максимум джитеру.","30 ms","That is the recommended maximum jitter."],["400 мс","Занадто багато для розмови.","400 ms","Too much for a conversation."],["1 с","Розмова стане неможливою.","1 s","Conversation becomes impossible."]],[0]);
mc("e9x-2","ENSA9",["Чим LLQ відрізняється від CBWFQ?","How does LLQ differ from CBWFQ?"],[
 ["LLQ додає до CBWFQ чергу зі строгим пріоритетом для чутливого до затримки трафіку","Правильно. Голос обслуговується першим, але з обмеженням смуги.","LLQ adds a strict-priority queue to CBWFQ for delay-sensitive traffic","Correct. Voice is served first, but with a bandwidth limit."],
 ["LLQ — це FIFO для всіх класів","Ні.","LLQ is FIFO for all classes","No."],
 ["CBWFQ має пріоритетну чергу, а LLQ — ні","Навпаки.","CBWFQ has a priority queue and LLQ does not","It is the other way round."],
 ["LLQ відкидає голос першим","Голос захищають, а не відкидають.","LLQ drops voice first","Voice is protected, not dropped."]],[0]);
mc("e9x-3","ENSA9",["Скільки бітів має поле DSCP і де воно розташоване?","How many bits does the DSCP field have and where is it located?"],[
 ["6 бітів у байті ToS/Traffic Class IP-заголовка","Правильно.","6 bits in the ToS/Traffic Class byte of the IP header","Correct."],
 ["3 біти в тегу 802.1Q","Це CoS (PCP).","3 bits in the 802.1Q tag","That is CoS (PCP)."],
 ["8 бітів у заголовку TCP","DSCP — поле рівня 3.","8 bits in the TCP header","DSCP is a Layer 3 field."],
 ["16 бітів у заголовку Ethernet","Ні.","16 bits in the Ethernet header","No."]],[0]);
mc("e9x-4","ENSA9",["Що означає маркування AF41?","What does the AF41 marking mean?"],[
 ["Клас 4 з низькою ймовірністю відкидання; типово для інтерактивного відео","Правильно. AFxy: x — клас, y — ймовірність відкидання.","Class 4 with low drop probability; typical for interactive video","Correct. AFxy: x is the class, y the drop probability."],
 ["Клас 1 з високою ймовірністю відкидання","Переплутано.","Class 1 with high drop probability","Swapped."],
 ["Expedited Forwarding для голосу","Це EF (DSCP 46).","Expedited Forwarding for voice","That is EF (DSCP 46)."],
 ["Best effort","Це DSCP 0.","Best effort","That is DSCP 0."]],[0]);
mc("e9x-5","ENSA9",["Де застосовують traffic shaping і як він обробляє надлишок?","Where is traffic shaping applied and how does it handle excess traffic?"],[
 ["На вихідному інтерфейсі; надлишок буферизується й надсилається пізніше","Правильно. Policing натомість відкидає або перемарковує.","Outbound; excess traffic is buffered and sent later","Correct. Policing drops or re-marks instead."],
 ["Лише на вхідному; надлишок відкидається","Це policing.","Inbound only; excess traffic is dropped","That is policing."],
 ["На вході й виході; надлишок завжди перемарковується","Ні.","Both directions; excess is always re-marked","No."],
 ["Лише на комутаторах доступу","Ні.","Only on access switches","No."]],[0]);
mc("e9x-6","ENSA9",["Який механізм QoS вибірково відкидає TCP-пакети ще до заповнення черги, щоб уникнути перевантаження?","Which QoS mechanism selectively drops TCP packets before the queue fills to avoid congestion?"],[
 ["WRED","Правильно.","WRED","Correct."],["Tail drop","Відкидає все підряд, коли черга вже повна.","Tail drop","Drops everything once the queue is already full."],["LLQ","Це механізм черг.","LLQ","That is a queuing mechanism."],["CoS","Це маркування.","CoS","That is marking."]],[0]);

// ===== ENSA 10. Керування мережею =====
mc("e10x-1","ENSA10",["Повідомлення: %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to down. Що означає цифра 5?","Message: %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to down. What does the 5 mean?"],[
 ["Рівень серйозності 5 — notifications","Правильно. Формат: %FACILITY-SEVERITY-MNEMONIC.","Severity level 5 — notifications","Correct. Format: %FACILITY-SEVERITY-MNEMONIC."],
 ["Facility номер 5","Facility тут — LINEPROTO.","Facility number 5","The facility here is LINEPROTO."],
 ["П'ятий інтерфейс","Інтерфейс указано в тексті.","The fifth interface","The interface is in the text."],
 ["Повідомлення повторилося 5 разів","Ні.","The message repeated 5 times","No."]],[0]);
mc("e10x-2","ENSA10",["Яка команда надсилатиме на syslog-сервер повідомлення рівнів 0–4?","Which command sends severity levels 0–4 to the syslog server?"],[
 ["logging trap warnings","Правильно (те саме, що logging trap 4).","logging trap warnings","Correct (same as logging trap 4)."],
 ["logging trap 5","Включить і рівень 5.","logging trap 5","That would include level 5 as well."],
 ["logging buffered 4","Це локальний буфер, а не сервер.","logging buffered 4","That is the local buffer, not the server."],
 ["logging console warnings","Це консоль.","logging console warnings","That is the console."]],[0]);
mc("e10x-3","ENSA10",["Які повідомлення SNMP агент надсилає сам, без запиту менеджера? (Оберіть два.)","Which SNMP messages does an agent send on its own, without a manager request? (Choose two.)"],[
 ["Trap","Правильно. Без підтвердження.","Trap","Correct. Unacknowledged."],["Inform","Правильно. Як trap, але з підтвердженням.","Inform","Correct. Like a trap, but acknowledged."],
 ["Get","Запит менеджера.","Get","A manager request."],["Set","Запит менеджера на зміну.","Set","A manager request to change a value."]],[0,1]);
mc("e10x-4","ENSA10",["Який рівень безпеки SNMPv3 забезпечує і автентифікацію, і шифрування?","Which SNMPv3 security level provides both authentication and encryption?"],[
 ["authPriv","Правильно.","authPriv","Correct."],["authNoPriv","Лише автентифікація.","authNoPriv","Authentication only."],["noAuthNoPriv","Ні того, ні іншого.","noAuthNoPriv","Neither."],["Community string","Це v1/v2c.","Community string","That is v1/v2c."]],[0]);
mc("e10x-5","ENSA10",["Які порти використовує SNMP?","Which ports does SNMP use?"],[
 ["UDP 161 для запитів до агента і UDP 162 для trap/inform","Правильно.","UDP 161 for requests to the agent and UDP 162 for traps/informs","Correct."],
 ["TCP 161 і TCP 162","SNMP працює через UDP.","TCP 161 and TCP 162","SNMP runs over UDP."],["UDP 514","Це syslog.","UDP 514","That is syslog."],["UDP 123","Це NTP.","UDP 123","That is NTP."]],[0]);
mc("e10x-6","ENSA10",["Яку перевагу має SCP/SFTP над TFTP для копіювання конфігурацій?","What advantage does SCP/SFTP have over TFTP for copying configurations?"],[
 ["Передача шифрується й автентифікується через SSH","Правильно. TFTP передає все відкритим текстом і без пароля.","The transfer is encrypted and authenticated over SSH","Correct. TFTP sends everything in clear text with no password."],
 ["Працює без автентифікації, тому швидше","Навпаки, автентифікація є.","It works without authentication, so it is faster","On the contrary, it authenticates."],
 ["Використовує UDP 69","Це TFTP.","It uses UDP 69","That is TFTP."],
 ["Не потребує IP-зв'язності","Потребує.","It needs no IP connectivity","It does."]],[0]);
fill("e10x-7","ENSA10",["Увімкніть на R1 SCP-сервер, щоб безпечно забирати з нього файли.","Enable the SCP server on R1 so files can be copied from it securely."],
 "R1(config)# aaa new-model\nR1(config)# aaa authentication login default local\nR1(config)# aaa authorization exec default local\nR1(config)# username admin privilege 15 secret Str0ng!\nR1(config)# ip [[scp]] server [[enable]]",
 ["SCP працює поверх SSH і потребує AAA-авторизації exec; користувач має мати privilege 15.","SCP runs over SSH and requires AAA exec authorization; the user needs privilege 15."]);
mc("e10x-8","ENSA10",["Яке значення config-register використовують для відновлення пароля (ігнорувати startup-config)?","Which config-register value is used for password recovery (ignore the startup-config)?"],[
 ["0x2142","Правильно. Після відновлення повертають 0x2102.","0x2142","Correct. Set it back to 0x2102 afterwards."],
 ["0x2102","Звичайне завантаження з конфігурацією з NVRAM.","0x2102","Normal boot using the NVRAM configuration."],
 ["0x2100","Завантаження в ROMMON.","0x2100","Boot into ROMMON."],
 ["0x1234","Такого стандартного значення немає.","0x1234","There is no such standard value."]],[0]);
mc("e10x-9","ENSA10",["Порт має приймати LLDP-повідомлення, але не надсилати власні. Яка конфігурація правильна?","A port must receive LLDP messages but not send its own. Which configuration is correct?"],[
 ["Глобально lldp run; на порту no lldp transmit (lldp receive лишається)","Правильно.","Global lldp run; on the port no lldp transmit (lldp receive stays)","Correct."],
 ["no lldp run","Вимикає LLDP повністю.","no lldp run","Disables LLDP completely."],
 ["cdp run і no cdp enable","Це CDP, а не LLDP.","cdp run and no cdp enable","That is CDP, not LLDP."],
 ["lldp transmit only","Такої команди немає.","lldp transmit only","There is no such command."]],[0]);
mc("e10x-10","ENSA10",["Як зробити маршрутизатор NTP-сервером для мережі, якщо зовнішнього джерела часу немає?","How do you make a router an NTP server for the network when there is no external time source?"],[
 ["ntp master 3","Правильно. Маршрутизатор стає авторитетним джерелом зі stratum 3.","ntp master 3","Correct. The router becomes an authoritative source at stratum 3."],
 ["ntp server 127.0.0.1","Це клієнтська команда до самого себе.","ntp server 127.0.0.1","That is a client command pointing at itself."],
 ["clock set на всіх пристроях","Годинники розійдуться.","clock set on every device","The clocks will drift apart."],
 ["ntp peer 0.0.0.0","Некоректно.","ntp peer 0.0.0.0","Invalid."]],[0]);

// ===== ENSA 11. Проєктування мережі =====
mc("e11x-1","ENSA11",["Яка характеристика архітектури spine-leaf?","Which is a characteristic of a spine-leaf architecture?"],[
 ["Кожен leaf з'єднаний з кожним spine, spine між собою не з'єднані; будь-який шлях leaf–leaf має однакову довжину","Правильно.","Every leaf connects to every spine, spines are not interconnected, and every leaf-to-leaf path has the same length","Correct."],
 ["Кожен leaf з'єднаний з усіма іншими leaf","Ні, leaf-и з'єднуються лише через spine.","Every leaf connects to every other leaf","No, leaves connect only through spines."],
 ["Spine-комутатори з'єднані в кільце","Ні.","Spine switches are connected in a ring","No."],
 ["Сервери підключаються до spine","Сервери підключаються до leaf.","Servers connect to the spines","Servers connect to the leaves."]],[0]);
mc("e11x-2","ENSA11",["Навіщо комутатору доступу PoE?","Why does an access switch need PoE?"],[
 ["Щоб живити IP-телефони, точки доступу й камери через Ethernet-кабель","Правильно.","To power IP phones, access points, and cameras over the Ethernet cable","Correct."],
 ["Щоб збільшити швидкість портів","PoE не впливає на швидкість.","To increase port speed","PoE does not affect speed."],
 ["Щоб резервувати uplink","Це EtherChannel або STP.","To provide uplink redundancy","That is EtherChannel or STP."],
 ["Щоб шифрувати трафік","Ні.","To encrypt traffic","No."]],[0]);
mc("e11x-3","ENSA11",["Коли доцільний дворівневий дизайн (collapsed core)?","When does a two-tier (collapsed core) design make sense?"],[
 ["У невеликих і середніх кампусах, де рівні ядра й розподілу можна об'єднати для економії","Правильно.","In small and medium campuses where the core and distribution layers can be combined to save cost","Correct."],
 ["У великих кампусах з кількома будівлями","Там потрібен окремий рівень ядра.","In large multi-building campuses","A separate core layer is needed there."],
 ["Лише в дата-центрах","Для дата-центрів типовий spine-leaf.","Only in data centers","Spine-leaf is typical for data centers."],
 ["Коли потрібно більше доменів відмови","Ні.","When more failure domains are needed","No."]],[0]);
mc("e11x-4","ENSA11",["Що таке oversubscription на uplink-порту комутатора?","What is oversubscription on a switch uplink?"],[
 ["Сумарна смуга access-портів більша за смугу uplink; це прийнятно, бо всі порти рідко зайняті одночасно","Правильно. Типове співвідношення на рівні доступу — 20:1.","The total access port bandwidth exceeds the uplink bandwidth, which is acceptable because all ports are rarely busy at once","Correct. A typical access-layer ratio is 20:1."],
 ["Uplink швидший за всі access-порти разом","Це відсутність oversubscription.","The uplink is faster than all access ports combined","That means no oversubscription."],
 ["Помилка конфігурації, яку треба виправити","Це нормальна проєктна практика.","A configuration error that must be fixed","It is normal design practice."],
 ["Перевищення ліміту MAC-адрес","Ні.","Exceeding the MAC address limit","No."]],[0]);
mc("e11x-5","ENSA11",["Що зазвичай поєднує SOHO-маршрутизатор?","What does a SOHO router usually combine?"],[
 ["Маршрутизатор, комутатор, точку доступу Wi-Fi, NAT, DHCP і базовий firewall","Правильно.","A router, a switch, a Wi-Fi access point, NAT, DHCP, and a basic firewall","Correct."],
 ["Лише модуль маршрутизації BGP","Ні.","Only a BGP routing module","No."],
 ["Spine і leaf в одному корпусі","Ні.","A spine and a leaf in one chassis","No."],
 ["Контролер WLC для сотень AP","Це корпоративне рішення.","A WLC for hundreds of APs","That is an enterprise solution."]],[0]);

// ===== ENSA 12. Діагностика мережі =====
mc("e12x-1","ENSA12",["Навіщо використовувати extended ping з указанням source-інтерфейсу (наприклад, LAN)?","Why use an extended ping that specifies a source interface (for example the LAN)?"],[
 ["Щоб перевірити, чи є в далекої сторони зворотний маршрут до цієї мережі","Правильно. Звичайний ping іде з адреси вихідного інтерфейсу.","To test whether the far end has a return route to that network","Correct. A standard ping is sourced from the exit interface."],
 ["Щоб пінг працював без маршруту","Маршрут однаково потрібен.","To make ping work without a route","A route is still needed."],
 ["Щоб зашифрувати ICMP","Ні.","To encrypt ICMP","No."],
 ["Щоб перевірити DNS","Ні.","To test DNS","No."]],[0]);
mc("e12x-2","ENSA12",["У show interfaces зростає лічильник late collisions. Яка найімовірніша причина?","In show interfaces, the late collisions counter keeps increasing. What is the most likely cause?"],[
 ["Невідповідність дуплексу (один бік half-duplex) або надто довгий кабель","Правильно.","A duplex mismatch (one side half-duplex) or a cable that is too long","Correct."],
 ["Неправильна маска підмережі","Це рівень 3, колізії — рівень 1–2.","A wrong subnet mask","That is Layer 3; collisions are Layer 1–2."],
 ["Не той native VLAN","Дає повідомлення CDP, а не колізії.","A wrong native VLAN","That produces CDP messages, not collisions."],
 ["ACL на інтерфейсі","Ні.","An ACL on the interface","No."]],[0]);
mc("e12x-3","ENSA12",["tracert показує відповіді двох маршрутизаторів, далі лише * * *. Що це означає?","tracert shows replies from two routers and then only * * *. What does this mean?"],[
 ["Пакети губляться після другого хопа: наступний пристрій недосяжний, блокує ICMP або немає зворотного маршруту","Правильно. Шукати проблему між хопом 2 і 3.","Packets are lost after the second hop: the next device is unreachable, blocks ICMP, or has no return route","Correct. Look between hop 2 and hop 3."],
 ["Ціль досягнуто","Тоді була б відповідь від цілі.","The destination was reached","Then the destination would reply."],
 ["Проблема з DNS","tracert за IP від DNS не залежить.","A DNS problem","tracert to an IP does not depend on DNS."],
 ["Проблема на самому ПК","Перші хопи відповідають, тож ПК працює.","A problem on the PC itself","The first hops answer, so the PC works."]],[0]);
mc("e12x-4","ENSA12",["Інженер почав діагностику з ping (рівень 3), і ping пройшов. Куди рухатися далі в методі divide-and-conquer?","An engineer started troubleshooting with ping (Layer 3) and the ping succeeded. Where next in the divide-and-conquer method?"],[
 ["Вгору: транспортний і прикладний рівні, бо рівні 1–3 працюють","Правильно.","Up: the transport and application layers, because Layers 1–3 work","Correct."],
 ["Вниз: перевіряти кабелі","Рівні 1–2 вже працюють, раз ping пройшов.","Down: check the cables","Layers 1–2 already work since ping succeeded."],
 ["Перезавантажити всі пристрої","Не метод діагностики.","Reload all devices","Not a troubleshooting method."],
 ["Почати з нуля методом top-down","Втрата часу.","Start over with top-down","A waste of time."]],[0]);
mc("e12x-5","ENSA12",["Захоплення пакетів показує DHCPDISCOVER від клієнта, але DHCPOFFER немає. Що перевірити першим?","A packet capture shows DHCPDISCOVER from the client but no DHCPOFFER. What should you check first?"],[
 ["ip helper-address на шлюзі VLAN і доступність сервера, а за DHCP snooping — trust на uplink","Правильно.","The ip helper-address on the VLAN gateway and server reachability, and with DHCP snooping, trust on the uplink","Correct."],
 ["DNS-сервер у пулі","DNS не заважає отримати OFFER.","The DNS server in the pool","DNS does not prevent an OFFER."],
 ["Маску на ПК","У ПК ще немає адреси.","The mask on the PC","The PC has no address yet."],
 ["NAT на граничному маршрутизаторі","Не пов'язано.","NAT on the edge router","Unrelated."]],[0]);
mc("e12x-6","ENSA12",["Інтерфейс у стані up, line protocol down. На якому рівні проблема?","An interface is up, line protocol down. Which layer has the problem?"],[
 ["Канальному (рівень 2): невідповідність інкапсуляції, keepalive тощо","Правильно. Фізичний сигнал є.","Data link (Layer 2): encapsulation mismatch, keepalives, and so on","Correct. The physical signal is present."],
 ["Фізичному: кабель не під'єднано","Тоді статус був би down/down.","Physical: the cable is unplugged","Then the status would be down/down."],
 ["Мережевому: не та IP-адреса","IP на line protocol не впливає.","Network: a wrong IP address","IP does not affect line protocol."],
 ["Адміністративно вимкнено","Тоді administratively down.","Administratively shut down","Then it would show administratively down."]],[0]);
mc("e12x-7","ENSA12",["На інтерфейсі багато CRC-помилок. На що це вказує?","An interface shows many CRC errors. What does this point to?"],[
 ["На проблему фізичного рівня: пошкоджений кабель, завади або дуплекс","Правильно.","A physical-layer problem: a damaged cable, interference, or duplex","Correct."],
 ["На неправильний маршрут","Ні.","A wrong route","No."],
 ["На помилку в ACL","Ні.","An ACL error","No."],
 ["На вичерпаний пул DHCP","Ні.","An exhausted DHCP pool","No."]],[0]);
mc("e12x-8","ENSA12",["Яка команда показує локальний буфер повідомлень syslog на пристрої Cisco?","Which command shows the local syslog message buffer on a Cisco device?"],[
 ["show logging","Правильно.","show logging","Correct."],["show syslog","Такої команди немає.","show syslog","There is no such command."],["show history","Історія команд.","show history","Command history."],["debug all","Небезпечно і не те.","debug all","Dangerous and not that."]],[0]);
mc("e12x-9","ENSA12",["Сайт за IP відкривається, а за іменем — ні. Яка команда на Windows допоможе перевірити DNS?","A site opens by IP but not by name. Which Windows command helps check DNS?"],[
 ["nslookup","Правильно.","nslookup","Correct."],["arp -a","ARP-кеш.","arp -a","The ARP cache."],["netstat -r","Таблиця маршрутизації.","netstat -r","The routing table."],["ipconfig /release","Звільнить адресу DHCP.","ipconfig /release","Releases the DHCP address."]],[0]);
order("e12x-10","ENSA12",["Розставте кроки діагностики методом bottom-up.","Put the bottom-up troubleshooting steps in order."],[
 ["Фізичний рівень: кабель, статус порту, помилки","Physical: cable, port status, errors"],
 ["Канальний: VLAN, trunk, MAC-таблиця","Data link: VLAN, trunk, MAC table"],
 ["Мережевий: IP-адреса, маска, шлюз, маршрути","Network: IP address, mask, gateway, routes"],
 ["Транспортний: порти, ACL, NAT","Transport: ports, ACLs, NAT"],
 ["Прикладний: служба, DNS, сервер застосунку","Application: service, DNS, application server"]],["Bottom-up зручний, коли проблема схожа на фізичну; для складних випадків — divide-and-conquer.","Bottom-up suits problems that look physical; for complex cases use divide-and-conquer."]);

// ===== ENSA 13. Віртуалізація мережі =====
mc("e13x-1","ENSA13",["Що таке VRF?","What is a VRF?"],[
 ["Кілька незалежних таблиць маршрутизації на одному маршрутизаторі; адреси в різних VRF можуть перетинатися","Правильно.","Multiple independent routing tables on one router; addresses in different VRFs may overlap","Correct."],
 ["Протокол резервування шлюзу","Це FHRP.","A gateway redundancy protocol","That is an FHRP."],
 ["Тип віртуальної машини","Ні.","A type of virtual machine","No."],
 ["Механізм шифрування трафіку","Ні.","A traffic encryption mechanism","No."]],[0]);
mc("e13x-2","ENSA13",["Що таке underlay у fabric-мережі?","What is the underlay in a fabric network?"],[
 ["Фізична IP-мережа, що забезпечує зв'язність для тунелів overlay (наприклад, VXLAN)","Правильно.","The physical IP network that provides connectivity for the overlay tunnels (for example VXLAN)","Correct."],
 ["Віртуальна мережа поверх фізичної","Це overlay.","A virtual network on top of the physical one","That is the overlay."],
 ["Хмарний сервіс керування","Ні.","A cloud management service","No."],
 ["Площина керування пристрою","Ні.","The device management plane","No."]],[0]);
mc("e13x-3","ENSA13",["Що робить гіпервізор?","What does a hypervisor do?"],[
 ["Розподіляє CPU, пам'ять і сховище між віртуальними машинами та ізолює їх одна від одної","Правильно.","It allocates CPU, memory, and storage among virtual machines and isolates them from each other","Correct."],
 ["Маршрутизує трафік між VLAN","Це L3-пристрій.","It routes traffic between VLANs","That is a Layer 3 device."],
 ["Шифрує диски","Ні.","It encrypts disks","No."],
 ["Замінює операційну систему у ВМ","У кожної ВМ своя гостьова ОС.","It replaces the operating system inside the VM","Each VM has its own guest OS."]],[0]);
mc("e13x-4","ENSA13",["Що характерно для хмарно керованих мереж (наприклад, Cisco Meraki)?","What is characteristic of cloud-managed networks (for example Cisco Meraki)?"],[
 ["Налаштування й моніторинг через хмарну панель; пристрої самі забирають конфігурацію","Правильно.","Configuration and monitoring through a cloud dashboard; devices pull their configuration themselves","Correct."],
 ["Користувацький трафік обов'язково йде через хмару","Через хмару йде керування, а не дані.","User traffic must pass through the cloud","Management goes through the cloud, not data."],
 ["Працюють без Інтернету","Для керування потрібен Інтернет.","They work without Internet access","Management requires Internet access."],
 ["Налаштовуються лише через консольний кабель","Ні.","They are configured only through a console cable","No."]],[0]);
mc("e13x-5","ENSA13",["Де в контролерній мережі (SDN) розміщена логіка площини керування?","Where is the control plane logic in a controller-based (SDN) network?"],[
 ["Централізовано на контролері","Правильно. Пристрої виконують пересилання.","Centrally on the controller","Correct. Devices do the forwarding."],
 ["На кожному пристрої окремо","Це традиційна модель.","On each device separately","That is the traditional model."],
 ["На ПК користувачів","Ні.","On user PCs","No."],
 ["У DNS-сервері","Ні.","In the DNS server","No."]],[0]);
mc("e13x-6","ENSA13",["Які протоколи — приклади southbound API? (Оберіть два.)","Which protocols are examples of southbound APIs? (Choose two.)"],[
 ["OpenFlow","Правильно.","OpenFlow","Correct."],["NETCONF","Правильно.","NETCONF","Correct."],
 ["REST API застосунку до контролера","Це northbound.","A REST API from an application to the controller","That is northbound."],
 ["Браузер оператора до веб-інтерфейсу","Ні.","An operator browser to the web UI","No."]],[0,1]);
mc("e13x-7","ENSA13",["Хто відповідає за оновлення ОС віртуальних машин у моделі IaaS?","Who is responsible for patching the VM operating systems in the IaaS model?"],[
 ["Клієнт","Правильно. Провайдер дає інфраструктуру, ОС і застосунки — турбота клієнта.","The customer","Correct. The provider supplies infrastructure; the OS and applications are the customer's job."],
 ["Провайдер","Так у PaaS і SaaS.","The provider","That is the case in PaaS and SaaS."],
 ["Ніхто","Ні.","Nobody","No."],
 ["Виробник процесора","Ні.","The CPU vendor","No."]],[0]);
mc("e13x-8","ENSA13",["Як віртуальні машини на одному хості обмінюються трафіком між собою?","How do virtual machines on the same host exchange traffic with each other?"],[
 ["Через віртуальний комутатор (vSwitch) у гіпервізорі","Правильно.","Through a virtual switch (vSwitch) in the hypervisor","Correct."],
 ["Лише через фізичний маршрутизатор","Не обов'язково.","Only through a physical router","Not necessarily."],
 ["Через USB","Ні.","Over USB","No."],
 ["Ніяк — ВМ ізольовані","Ізоляція не означає відсутність мережі.","They cannot — VMs are isolated","Isolation does not mean no networking."]],[0]);

// ===== ENSA 14. Автоматизація мережі =====
mc("e14x-1","ENSA14",["Що визначає вкладеність у YAML?","What defines nesting in YAML?"],[
 ["Відступи пробілами","Правильно. Табуляція заборонена.","Indentation with spaces","Correct. Tabs are not allowed."],["Фігурні дужки","Це JSON.","Curly braces","That is JSON."],["Теги","Це XML.","Tags","That is XML."],["Коми","Ні.","Commas","No."]],[0]);
mc("e14x-2","ENSA14",["Яка характеристика Terraform?","Which is a characteristic of Terraform?"],[
 ["Декларативна інфраструктура як код (HCL) зі збереженням стану й провайдерами для різних платформ","Правильно.","Declarative infrastructure as code (HCL) with a state file and providers for different platforms","Correct."],
 ["Агент на кожному пристрої","Це Puppet/Chef.","An agent on every device","That is Puppet/Chef."],
 ["Імперативні скрипти Ruby","Це Chef.","Imperative Ruby scripts","That is Chef."],
 ["Працює лише з обладнанням Cisco","Ні.","Works only with Cisco hardware","No."]],[0]);
mc("e14x-3","ENSA14",["Що таке inventory в Ansible?","What is an inventory in Ansible?"],[
 ["Перелік керованих вузлів і їхніх груп","Правильно.","The list of managed hosts and their groups","Correct."],
 ["Набір задач","Це playbook.","A set of tasks","That is a playbook."],
 ["Агент на пристрої","Ansible — безагентний.","An agent on the device","Ansible is agentless."],
 ["Журнал змін","Ні.","A change log","No."]],[0]);
mc("e14x-4","ENSA14",["Що означає ідемпотентність у керуванні конфігурацією?","What does idempotency mean in configuration management?"],[
 ["Повторний запуск дає той самий результат: зміни вносяться лише тоді, коли стан відрізняється від бажаного","Правильно.","Running again yields the same result: changes are made only if the state differs from the desired one","Correct."],
 ["Кожен запуск перезаписує все","Ні.","Every run overwrites everything","No."],
 ["Задачі виконуються паралельно","Ні.","Tasks run in parallel","No."],
 ["Конфігурація шифрується","Ні.","The configuration is encrypted","No."]],[0]);
mc("e14x-5","ENSA14",["Який спосіб автентифікації REST API передає логін і пароль у заголовку Authorization в кодуванні Base64, без шифрування?","Which REST API authentication method sends the username and password in the Authorization header encoded in Base64, without encryption?"],[
 ["Basic","Правильно. Тому використовують лише з HTTPS.","Basic","Correct. Hence it is used only with HTTPS."],
 ["Bearer token","Передається токен, а не пароль.","Bearer token","A token is sent, not the password."],
 ["OAuth 2.0","Токени від сервера авторизації.","OAuth 2.0","Tokens from an authorization server."],
 ["API key у заголовку","Передається ключ, а не пароль.","An API key in a header","A key is sent, not the password."]],[0]);
mc("e14x-6","ENSA14",["Який код повертає успішний POST, що створив новий ресурс?","Which status code does a successful POST that created a new resource return?"],[
 ["201 Created","Правильно.","201 Created","Correct."],["200 OK","Загальний успіх (наприклад, GET).","200 OK","General success (for example GET)."],["204 No Content","Успіх без тіла відповіді (часто DELETE).","204 No Content","Success with no body (often DELETE)."],["404 Not Found","Ресурс не знайдено.","404 Not Found","Resource not found."]],[0]);
mc("e14x-7","ENSA14",["Який тип значення має \"vlans\": [10, 20, 30] у JSON?","What type of value is \"vlans\": [10, 20, 30] in JSON?"],[
 ["Масив (array)","Правильно.","Array","Correct."],["Об'єкт (object)","Об'єкт — у фігурних дужках.","Object","An object uses curly braces."],["Рядок (string)","Рядок — у лапках.","String","A string is in quotes."],["Логічне значення","Це true/false.","Boolean","That is true/false."]],[0]);
mc("e14x-8","ENSA14",["Що з наведеного — приклад предиктивного AI в мережевих операціях?","Which of these is an example of predictive AI in network operations?"],[
 ["Прогноз перевантаження каналу або відмови пристрою за трендами телеметрії","Правильно.","Forecasting link congestion or device failure from telemetry trends","Correct."],
 ["Генерація конфігурації з текстового опису","Це генеративний AI.","Generating a configuration from a text description","That is generative AI."],
 ["Чат-бот, що пояснює вивід show-команди","Це генеративний AI.","A chatbot that explains show command output","That is generative AI."],
 ["Ручне опитування SNMP раз на годину","Це не AI.","Manual SNMP polling once an hour","That is not AI."]],[0]);
mc("e14x-9","ENSA14",["GenAI-асистент згенерував ACL. Що обов'язково зробити перед застосуванням?","A GenAI assistant generated an ACL. What must you do before applying it?"],[
 ["Перевірити логіку й порядок рядків, протестувати в лабі або вікні змін","Правильно. AI може помилятися.","Check the logic and line order, and test in a lab or change window","Correct. AI can be wrong."],
 ["Застосувати одразу, бо AI не помиляється","AI може «галюцинувати».","Apply it immediately because AI does not make mistakes","AI can hallucinate."],
 ["Надіслати AI паролі пристроїв для контексту","Секрети в промпт не передають.","Send the device passwords to the AI for context","Never put secrets in a prompt."],
 ["Вимкнути логування, щоб не заважало","Ні.","Disable logging so it does not interfere","No."]],[0]);
mc("e14x-10","ENSA14",["Який транспорт і кодування використовує NETCONF?","Which transport and encoding does NETCONF use?"],[
 ["SSH (порт 830) і XML","Правильно.","SSH (port 830) and XML","Correct."],["HTTPS і JSON","Так може RESTCONF.","HTTPS and JSON","RESTCONF can do that."],["UDP 161 і ASN.1","Це SNMP.","UDP 161 and ASN.1","That is SNMP."],["Telnet і текст","Ні.","Telnet and plain text","No."]],[0]);
})();
