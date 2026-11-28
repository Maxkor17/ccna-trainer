// Глосарій, друга частина: терміни, які часто трапляються в англійських питаннях CCNA. [українською, англійською, тема]
(function(){ const G=window.GLOSSARY=window.GLOSSARY||[]; const add=(t,rows)=>{ for(const r of rows.split("\n")){ const [ua,en]=r.split("|").map(x=>x&&x.trim()); if(ua&&en) G.push([ua,en,t]); } };
add("ITN1",`кінцевий пристрій|end device
проміжний пристрій|intermediate device
середовище передавання|transmission medium
топологія|topology
відмовостійкість|redundancy`);
add("ITN4",`мідний кабель|copper cable
витая пара|twisted pair
оптоволокно|fiber-optic cable
одномодове волокно|single-mode fiber
багатомодове волокно|multimode fiber
перехресні перешкоди|crosstalk
електромагнітні завади|electromagnetic interference (EMI)
прямий кабель|straight-through cable
перехресний кабель|crossover cable`);
add("ITN7",`преамбула|preamble
контрольна послідовність кадру|frame check sequence (FCS)
одноадресний|unicast
багатоадресний|multicast
широкомовний|broadcast
організаційно унікальний ідентифікатор|organizationally unique identifier (OUI)
пізня колізія|late collision
дрібний кадр|runt frame
велетенський кадр|giant frame`);
add("ITN8",`час життя|time to live (TTL)
фрагментація|fragmentation
заголовок|header
корисне навантаження|payload
без встановлення з'єднання|connectionless
доставка з максимальними зусиллями|best-effort delivery`);
add("ITN12",`глобальна одноадресна адреса|global unicast address (GUA)
локальна адреса каналу|link-local address (LLA)
унікальна локальна адреса|unique local address (ULA)
ідентифікатор інтерфейсу|interface ID
стиснення нулів|zero compression
двокрапка подвійна|double colon
виявлення сусідів|neighbor discovery (ND)
запит сусіда|neighbor solicitation (NS)
оголошення сусіда|neighbor advertisement (NA)
запит маршрутизатора|router solicitation (RS)
виявлення дубліката адреси|duplicate address detection (DAD)`);
add("ITN14",`з встановленням з'єднання|connection-oriented
повторна передача|retransmission
керування потоком|flow control
порядковий номер|sequence number
сокет|socket
відомі порти|well-known ports
динамічні порти|dynamic (ephemeral) ports`);
add("ITN16",`вразливість|vulnerability
загроза|threat
експлойт|exploit
пом'якшення ризиків|mitigation
розвідка|reconnaissance
атака доступу|access attack
атака «людина посередині»|man-in-the-middle attack
соціальна інженерія|social engineering
фішинг|phishing
брандмауер|firewall
резервне копіювання|backup`);
add("SRWE1",`консольний порт|console port
привілейований режим|privileged EXEC mode
режим глобальної конфігурації|global configuration mode
поточна конфігурація|running configuration
стартова конфігурація|startup configuration
пароль у відкритому вигляді|plaintext password
банер|banner`);
add("SRWE2",`комутація з накопиченням|store-and-forward switching
наскрізна комутація|cut-through switching
автоузгодження|autonegotiation
невідповідність дуплексу|duplex mismatch`);
add("SRWE3",`дозволені VLAN|allowed VLANs
динамічний протокол транкінгу|Dynamic Trunking Protocol (DTP)
невикористаний порт|unused port
тег|tag
нетегований кадр|untagged frame`);
add("SRWE5",`протокол остовного дерева|Spanning Tree Protocol (STP)
швидке остовне дерево|Rapid Spanning Tree Protocol (RSTP)
пріоритет моста|bridge priority
таймер привітання|hello timer
затримка пересилання|forward delay
максимальний вік|max age
стан блокування|blocking state
стан навчання|learning state
стан пересилання|forwarding state
крайовий порт|edge port
захист кореня|root guard
захист від петель|loop guard`);
add("SRWE6",`канал портів|port channel
член каналу|member port
режим узгодження|negotiation mode
призупинений порт|suspended port`);
add("SRWE7",`пул адрес DHCP|DHCP pool
виявлення|discover
пропозиція|offer
запит|request
адреса пересилання шлюзу|gateway IP address (giaddr)`);
add("SRWE8",`з відстеженням стану|stateful
без відстеження стану|stateless
прапорець керованої конфігурації|managed address configuration flag (M flag)
прапорець іншої конфігурації|other configuration flag (O flag)`);
add("SRWE9",`протокол резервування шлюзу|Hot Standby Router Protocol (HSRP)
протокол резервування віртуального маршрутизатора|Virtual Router Redundancy Protocol (VRRP)
відстеження інтерфейсу|interface tracking
група резервування|standby group
віртуальна MAC-адреса|virtual MAC address`);
add("SRWE10",`авторизація|authorization
облік|accounting
підробка ARP|ARP spoofing
голодування DHCP|DHCP starvation
фальшивий сервер|rogue server
динамічна перевірка ARP|Dynamic ARP Inspection (DAI)`);
add("SRWE11",`порушення безпеки|security violation
вимкнено через помилку|error-disabled (err-disabled)
відновлення після помилки|errdisable recovery
придушення шторму|storm control
захист від оголошень маршрутизатора|RA guard
довірений інтерфейс|trusted interface`);
add("SRWE12",`точка доступу|access point
легка точка доступу|lightweight access point
автономна точка доступу|autonomous access point
роумінг|roaming
перекриття каналів|channel overlap
неперекривні канали|non-overlapping channels
маяк|beacon
асоціація|association
рівень сигналу|signal strength (RSSI)
відношення сигнал/шум|signal-to-noise ratio (SNR)`);
add("SRWE13",`попередньо поширений ключ|pre-shared key (PSK)
корпоративний режим|enterprise mode
особистий режим|personal mode
гостьова мережа|guest network`);
add("SRWE14",`рішення про пересилання|forwarding decision
рекурсивний пошук|recursive lookup
вихідний інтерфейс|exit interface
маршрут до мережі|network route`);
add("SRWE15",`повністю вказаний статичний маршрут|fully specified static route
резервний маршрут|backup route
підсумковий маршрут|summary route`);
add("ENSA1",`одна область|single-area
кілька областей|multiarea
пакет привітання|hello packet
інтервал мертвого маршрутизатора|dead interval
база даних стану каналів|link-state database (LSDB)
оголошення стану каналу|link-state advertisement (LSA)
алгоритм найкоротшого шляху|shortest path first (SPF) algorithm`);
add("ENSA3",`атака на відмову в обслуговуванні|denial-of-service (DoS) attack
розподілена атака|distributed denial-of-service (DDoS)
програма-вимагач|ransomware
троян|Trojan horse
черв'як|worm
бот-мережа|botnet`);
add("ENSA4",`стандартний ACL|standard ACL
розширений ACL|extended ACL
іменований ACL|named ACL
запис керування доступом|access control entry (ACE)
вхідний напрямок|inbound direction
вихідний напрямок|outbound direction`);
add("ENSA6",`зовнішня локальна адреса|outside local address
зовнішня глобальна адреса|outside global address
статичний NAT|static NAT
динамічний NAT|dynamic NAT
трансляція адреси порту|port address translation (PAT)`);
add("ENSA7",`виділена лінія|leased line
комутація каналів|circuit switching
комутація пакетів|packet switching
останній кілометр|last mile
постачальник послуг|service provider`);
add("ENSA8",`віртуальна приватна мережа|virtual private network (VPN)
VPN між вузлами|site-to-site VPN
VPN віддаленого доступу|remote-access VPN
обмін ключами|key exchange
цифровий підпис|digital signature
хеш-функція|hash function`);
add("ENSA9",`голосовий трафік|voice traffic
відеотрафік|video traffic
черга з пріоритетом|priority queue
межа довіри|trust boundary
відкидання хвоста|tail drop`);
add("ENSA10",`протокол виявлення|discovery protocol
сервер часу|time server
шар (stratum)|stratum
інформаційна база керування|management information base (MIB)
пастка|trap
файл образу|image file`);
add("ENSA11",`ієрархічна модель|hierarchical model
рівень доступу|access layer
рівень розподілу|distribution layer
рівень ядра|core layer
згорнуте ядро|collapsed core`);
add("ENSA12",`підхід знизу вгору|bottom-up approach
підхід згори вниз|top-down approach
розділяй і володарюй|divide-and-conquer
аналізатор протоколів|protocol analyzer
захоплення пакетів|packet capture`);
add("ENSA13",`хмарні обчислення|cloud computing
інфраструктура як послуга|infrastructure as a service (IaaS)
платформа як послуга|platform as a service (PaaS)
програмне забезпечення як послуга|software as a service (SaaS)
віртуальна машина|virtual machine (VM)
контейнер|container
віртуалізація мережевих функцій|network functions virtualization (NFV)`);
add("ENSA14",`автоматизація|automation
оркестрація|orchestration
ідемпотентність|idempotency
інфраструктура як код|infrastructure as code (IaC)
плейбук|playbook
інвентар|inventory
агентний штучний інтелект|agentic AI
генеративний штучний інтелект|generative AI
промпт|prompt
галюцинація|hallucination
пара ключ-значення|key-value pair
серіалізація даних|data serialization`);
})();
