// Симлети: кілька виводів show-команд і кілька питань до них (як на реальному іспиті CCNA).
// Двомовні записи: питання й варіанти — українською й англійською; виводи IOS однакові.
(function(){ const QB=window.QB_SIM=[], TR=window.QB_TR=window.QB_TR||{};
// part: [[q_ua,q_en], [[ua,uaWhy,en,enWhy],...], answers]
const perm=(id,n)=>{ let h=2166136261; for(const c of id) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0; const p=[...Array(n).keys()]; for(let i=n-1;i>0;i--){ h=Math.imul(h^(h>>>13),1597334677)>>>0; const j=h%(i+1); [p[i],p[j]]=[p[j],p[i]]; } return p; };
const mix=(id,o,a)=>{ const p=perm(id,o.length); return {o:p.map(i=>o[i]), a:a.map(x=>p.indexOf(x)).sort((x,y)=>x-y)}; };
const simlet=(id,t,q,ex,parts0)=>{ const parts=parts0.map(([pq,o,a],i)=>{ const m=mix(id+"#"+i,o,a); return [pq,m.o,m.a]; });
  QB.push({id,t,type:"simlet",q:q[0],ex,parts:parts.map(([pq,o,a])=>({q:pq[0],o:o.map(x=>[x[0],x[1]]),a}))});
  TR[id]={q:q[1],parts:parts.map(([pq,o])=>({q:pq[1],o:o.map(x=>[x[2],x[3]])}))}; };
const EC_HDR="Flags:  D - down        P - bundled in port-channel\n        I - stand-alone s - suspended\n        S - Layer2      R - Layer3\n        U - in use      N - not in use, no aggregation\n\nNumber of channel-groups in use: 1\nNumber of aggregators:           1\n\nGroup  Port-channel  Protocol    Ports\n------+-------------+-----------+-----------------------------------------------\n";

simlet("sl-ec-1","SRWE6",["Між S1 і S2 налаштовано Port-channel 1 на двох лінках, але канал не працює. Проаналізуйте виводи.","Port-channel 1 is configured on two links between S1 and S2, but the channel does not work. Analyze the output."],[
 ["S1# show etherchannel summary",EC_HDR+"1      Po1(SD)       LACP        Gi0/1(I) Gi0/2(s)"],
 ["S2# show etherchannel summary",EC_HDR+"1      Po1(SD)       LACP        Gi0/1(I) Gi0/2(I)"],
 ["S1# show running-config interface gi0/2","interface GigabitEthernet0/2\n switchport trunk allowed vlan 10\n switchport mode trunk\n channel-group 1 mode passive\nend"],
 ["S2# show running-config interface gi0/1","interface GigabitEthernet0/1\n switchport mode trunk\n channel-group 1 mode passive\nend"]],[
 [["Що означає прапорець I біля Gi0/1?","What does the I flag next to Gi0/1 mean?"],[
  ["Порт працює окремо (stand-alone), не в каналі","Правильно.","The port operates stand-alone, not in the channel","Correct."],
  ["Порт у каналі й використовується","Це P.","The port is bundled and in use","That is P."],
  ["Порт вимкнений","Це D.","The port is down","That is D."],
  ["Порт на рівні 3","Це R для Port-channel.","The port is Layer 3","That is R for a port-channel."]],[0]],
 [["Чому канал LACP не узгоджується на жодному з лінків?","Why does LACP fail to negotiate on both links?"],[
  ["Обидва боки в режимі passive: ніхто не починає переговори","Правильно. Потрібен хоча б один active.","Both sides are passive, so neither starts the negotiation","Correct. At least one side must be active."],
  ["LACP не підтримує trunk","Підтримує.","LACP does not support trunks","It does."],
  ["Номери каналів мають відрізнятися","Номери локальні й можуть збігатися.","The channel numbers must differ","Channel numbers are local and may match."],
  ["Потрібен mode on з обох боків","On — без протоколу; LACP теж працює, але треба active.","Mode on is required on both sides","On means no protocol; LACP works too but needs active."]],[0]],
 [["Чому Gi0/2 на S1 у стані s (suspended)?","Why is Gi0/2 on S1 suspended (s)?"],[
  ["Його список дозволених VLAN відрізняється від інших членів і Po1","Правильно: усі члени мають мати однакові параметри.","Its allowed VLAN list differs from the other members and Po1","Correct: all members must have identical settings."],
  ["Кабель пошкоджено","Тоді був би D.","The cable is damaged","Then it would be D."],
  ["На S2 немає Gi0/2","Порт є, він I.","S2 has no Gi0/2","The port exists and is I."],
  ["Порт у режимі access","Він trunk.","The port is in access mode","It is a trunk."]],[0]]]);

simlet("sl-stp-1","SRWE5",["Проаналізуйте вивід STP на S4.","Analyze the STP output on S4."],[
 ["S4# show spanning-tree","VLAN0001\n  Spanning tree enabled protocol ieee\n  Root ID    Priority    24577\n             Address     0019.e811.1a00\n             Cost        23\n             Port        FastEthernet0/2\n             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec\n\n  Bridge ID  Priority    32769  (priority 32768 sys-id-ext 1)\n             Address     0019.e800.1a00\n\nInterface           Role Sts Cost      Prio.Nbr Type\n------------------- ---- --- --------- -------- --------------------------------\nFa0/1               Altn BLK 30        128.1    P2p\nFa0/2               Root FWD 19        128.2    P2p\nFa0/10              Desg FWD 19        128.10   P2p"]],[
 [["Який пріоритет налаштовано на root bridge (без sys-id-ext)?","What priority is configured on the root bridge (without the sys-id-ext)?"],[
  ["24576","Правильно: 24577 − VLAN 1. Типово після root primary.","24576","Correct: 24577 minus VLAN 1. Typical after root primary."],
  ["24577","Це разом із sys-id-ext.","24577","That includes the sys-id-ext."],["32768","Це пріоритет S4.","32768","That is S4's priority."],["23","Це cost.","23","That is the cost."]],[0]],
 [["Чому в S4 Fa0/1 має cost 30, а не 19?","Why does Fa0/1 on S4 have cost 30 instead of 19?"],[
  ["На порту вручну задано spanning-tree cost 30","Правильно. Типовий cost FastEthernet — 19.","spanning-tree cost 30 was configured manually on the port","Correct. The default FastEthernet cost is 19."],
  ["Бо це EtherChannel","Тоді був би Po.","Because it is an EtherChannel","Then it would be a Po."],
  ["Через half-duplex","Cost не залежить від дуплексу.","Because of half duplex","Cost does not depend on duplex."],
  ["Бо порт заблоковано","Роль не змінює cost.","Because the port is blocked","The role does not change the cost."]],[0]],
 [["Що станеться, якщо лінк Fa0/2 обірветься?","What happens if the Fa0/2 link fails?"],[
  ["Fa0/1 стане root port і перейде в forwarding (з rapid-pvst — за 1–2 с)","Правильно. Alternate — це резервний root port.","Fa0/1 becomes the root port and moves to forwarding (within 1–2 s with rapid-pvst)","Correct. Alternate is the backup root port."],
  ["S4 стане root bridge","Кращий BID у S1 нікуди не зник.","S4 becomes the root bridge","S1 still has the better BID."],
  ["Fa0/10 стане root port","Fa0/10 веде до ПК.","Fa0/10 becomes the root port","Fa0/10 leads to a PC."],
  ["Зв'язок з root зникне назавжди","Є резервний шлях.","Connectivity to the root is lost for good","There is a backup path."]],[0]]]);

simlet("sl-rt-1","SRWE14",["Проаналізуйте таблицю маршрутизації R1.","Analyze the R1 routing table."],[
 ["R1# show ip route","Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP\n       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area\n\nGateway of last resort is 203.0.113.1 to network 0.0.0.0\n\nS*    0.0.0.0/0 [1/0] via 203.0.113.1\n      10.0.0.0/8 is variably subnetted, 5 subnets, 3 masks\nO        10.1.1.0/24 [110/3] via 10.0.12.2, 00:12:44, GigabitEthernet0/1\nS        10.1.1.64/26 [1/0] via 10.0.13.3\nO        10.1.2.0/24 [110/2] via 10.0.12.2, 00:12:44, GigabitEthernet0/1\nC        10.0.12.0/30 is directly connected, GigabitEthernet0/1\nL        10.0.12.1/32 is directly connected, GigabitEthernet0/1\n      203.0.113.0/24 is variably subnetted, 2 subnets, 2 masks\nC        203.0.113.0/30 is directly connected, GigabitEthernet0/0\nL        203.0.113.2/32 is directly connected, GigabitEthernet0/0"]],[
 [["Куди R1 надішле пакет для 10.1.1.70?","Where will R1 send a packet for 10.1.1.70?"],[
  ["10.0.13.3 — збіг /26 довший за /24","Правильно: longest prefix match.","10.0.13.3 — the /26 match is longer than the /24","Correct: longest prefix match."],
  ["10.0.12.2 — OSPF має кращу метрику","AD і метрика порівнюються лише для однакових префіксів.","10.0.12.2 — OSPF has the better metric","AD and metric are compared only for identical prefixes."],
  ["203.0.113.1 — маршрут за замовчуванням","Є конкретніші збіги.","203.0.113.1 — the default route","There are more specific matches."],
  ["Пакет буде відкинуто","Маршрут є.","The packet is dropped","A route exists."]],[0]],
 [["Що означає [110/3] у маршруті до 10.1.1.0/24?","What does [110/3] mean in the route to 10.1.1.0/24?"],[
  ["AD 110 (OSPF) і метрика (cost) 3","Правильно.","AD 110 (OSPF) and a metric (cost) of 3","Correct."],["110 хопів і 3 секунди","Ні.","110 hops and 3 seconds","No."],["VLAN 110 і пріоритет 3","Ні.","VLAN 110 and priority 3","No."],["Метрика 110 і AD 3","Навпаки.","Metric 110 and AD 3","The other way round."]],[0]],
 [["Куди піде пакет для 172.16.5.5?","Where will a packet for 172.16.5.5 go?"],[
  ["До 203.0.113.1 через маршрут за замовчуванням","Правильно: gateway of last resort.","To 203.0.113.1 via the default route","Correct: the gateway of last resort."],
  ["Буде відкинуто","Є маршрут 0.0.0.0/0.","It is dropped","There is a 0.0.0.0/0 route."],
  ["До 10.0.12.2","Немає збігу з 172.16.0.0.","To 10.0.12.2","There is no match for 172.16.0.0."],
  ["До 10.0.13.3","Немає збігу.","To 10.0.13.3","There is no match."]],[0]]]);

simlet("sl-ospf-1","ENSA2",["Проаналізуйте стан OSPF на R1, підключеному до спільного Ethernet-сегмента.","Analyze the OSPF state on R1, which is connected to a shared Ethernet segment."],[
 ["R1# show ip ospf neighbor","Neighbor ID     Pri   State           Dead Time   Address         Interface\n4.4.4.4           1   FULL/DR         00:00:35    192.168.1.4     GigabitEthernet0/0\n3.3.3.3           1   FULL/BDR        00:00:32    192.168.1.3     GigabitEthernet0/0\n2.2.2.2           1   2WAY/DROTHER    00:00:38    192.168.1.2     GigabitEthernet0/0"],
 ["R1# show ip ospf interface g0/0","GigabitEthernet0/0 is up, line protocol is up\n  Internet Address 192.168.1.1/24, Area 0, Attached via Network Statement\n  Process ID 1, Router ID 1.1.1.1, Network Type BROADCAST, Cost: 1\n  Transmit Delay is 1 sec, State DROTHER, Priority 1\n  Designated Router (ID) 4.4.4.4, Interface address 192.168.1.4\n  Backup Designated router (ID) 3.3.3.3, Interface address 192.168.1.3\n  Timer intervals configured, Hello 10, Dead 40, Wait 40, Retransmit 5"]],[
 [["Чому сусідство з 2.2.2.2 у стані 2WAY, а не FULL?","Why is the adjacency with 2.2.2.2 in 2WAY rather than FULL?"],[
  ["Це норма: DROTHER-маршрутизатори повністю синхронізуються лише з DR і BDR","Правильно.","That is normal: DROTHER routers fully synchronize only with the DR and BDR","Correct."],
  ["Не збігаються таймери hello","Тоді сусідства не було б зовсім.","The hello timers do not match","Then there would be no neighbor at all."],
  ["Різні області","Тоді сусідства не було б.","Different areas","Then there would be no neighbor."],
  ["Пошкоджений кабель","Інші сусіди FULL на тому самому інтерфейсі.","A damaged cable","Other neighbors are FULL on the same interface."]],[0]],
 [["Чому DR став саме 4.4.4.4, якщо пріоритети всіх маршрутизаторів однакові?","Why did 4.4.4.4 become DR if all routers have the same priority?"],[
  ["За рівного пріоритету перемагає найвищий router ID (або він уже був DR — вибори не витісняють)","Правильно.","With equal priority the highest router ID wins (or it was already DR — elections are not preemptive)","Correct."],
  ["Найменша IP-адреса інтерфейсу","Ні.","The lowest interface IP address","No."],
  ["Найменший router ID","Навпаки.","The lowest router ID","The other way round."],
  ["Найбільший cost","Cost на вибори не впливає.","The highest cost","Cost does not affect the election."]],[0]],
 [["Яка команда на R1 гарантує, що він ніколи не стане DR чи BDR на цьому сегменті?","Which command on R1 ensures it never becomes DR or BDR on this segment?"],[
  ["ip ospf priority 0 на G0/0","Правильно.","ip ospf priority 0 on G0/0","Correct."],["ip ospf priority 255","Навпаки, найвищий пріоритет.","ip ospf priority 255","The opposite: the highest priority."],["router-id 0.0.0.0","Некоректний router ID.","router-id 0.0.0.0","An invalid router ID."],["passive-interface g0/0","Зникнуть усі сусідства на G0/0.","passive-interface g0/0","All adjacencies on G0/0 would disappear."]],[0]]]);

simlet("sl-ps-1","SRWE11",["На S1 з'явилося повідомлення. Проаналізуйте стан port security.","A message appeared on S1. Analyze the port security state."],[
 ["S1 log","%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address 0050.7966.6866 on port FastEthernet0/3."],
 ["S1# show port-security interface fa0/3","Port Security              : Enabled\nPort Status                : Secure-up\nViolation Mode             : Restrict\nAging Time                 : 0 mins\nAging Type                 : Absolute\nSecureStatic Address Aging : Disabled\nMaximum MAC Addresses      : 1\nTotal MAC Addresses        : 1\nConfigured MAC Addresses   : 0\nSticky MAC Addresses       : 1\nLast Source Address:Vlan   : 0050.7966.6866:10\nSecurity Violation Count   : 14"]],[
 [["Що відбувається з кадрами від MAC 0050.7966.6866?","What happens to frames from MAC 0050.7966.6866?"],[
  ["Відкидаються; лічильник порушень росте, надсилається syslog","Правильно: так працює restrict.","They are dropped; the violation counter grows and a syslog message is sent","Correct: that is restrict."],
  ["Порт переходить у err-disabled","Так було б у режимі shutdown; статус Secure-up.","The port goes err-disabled","That would be shutdown mode; the status is Secure-up."],
  ["Кадри пропускаються","Ні.","The frames are forwarded","No."],
  ["Відкидаються без лічильника й повідомлень","Це protect.","They are dropped with no counter or message","That is protect."]],[0]],
 [["Як дозволити на цьому порту два пристрої (наприклад, ноутбук і телефон)?","How do you allow two devices on this port (for example a laptop and a phone)?"],[
  ["switchport port-security maximum 2","Правильно.","switchport port-security maximum 2","Correct."],["no switchport port-security","Вимкне захист повністю.","no switchport port-security","Disables protection entirely."],["switchport port-security violation protect","Порушник однаково буде заблокований.","switchport port-security violation protect","The violator would still be blocked."],["shutdown, потім no shutdown","Не змінить ліміт.","shutdown, then no shutdown","Does not change the limit."]],[0]],
 [["Як називається тип дозволеної адреси, що вже є на порту?","What is the type of the permitted address already on the port?"],[
  ["SecureSticky: вивчена автоматично й записана в running-config","Правильно (Sticky MAC Addresses: 1).","SecureSticky: learned automatically and written to the running-config","Correct (Sticky MAC Addresses: 1)."],
  ["SecureConfigured","Тоді Configured MAC Addresses був би 1.","SecureConfigured","Then Configured MAC Addresses would be 1."],
  ["SecureDynamic","Тоді Sticky був би 0.","SecureDynamic","Then Sticky would be 0."],
  ["Static ARP","Не стосується port security.","Static ARP","Not related to port security."]],[0]]]);

simlet("sl-hsrp-1","SRWE9",["R1 і R2 забезпечують резервний шлюз для VLAN 10.","R1 and R2 provide a redundant gateway for VLAN 10."],[
 ["R1# show standby brief","                     P indicates configured to preempt.\n                     |\nInterface   Grp  Pri P State   Active          Standby         Virtual IP\nGi0/0.10    10   110 P Active  local           192.168.10.3    192.168.10.1"],
 ["R2# show standby brief","                     P indicates configured to preempt.\n                     |\nInterface   Grp  Pri P State   Active          Standby         Virtual IP\nGi0/0.10    10   100   Standby 192.168.10.2    local           192.168.10.1"]],[
 [["Яку адресу шлюзу мають отримувати ПК у VLAN 10?","Which gateway address should PCs in VLAN 10 use?"],[
  ["192.168.10.1","Правильно: віртуальна IP-адреса групи.","192.168.10.1","Correct: the group's virtual IP."],["192.168.10.2","Реальна адреса R1.","192.168.10.2","R1's real address."],["192.168.10.3","Реальна адреса R2.","192.168.10.3","R2's real address."],["Будь-яку з двох реальних","Тоді резервування не працюватиме.","Either real address","Then redundancy would not work."]],[0]],
 [["R1 Gi0/0 впав, R2 став Active. Через 10 хвилин R1 відновився. Що станеться?","R1 Gi0/0 failed and R2 became Active. Ten minutes later R1 recovers. What happens?"],[
  ["R1 знову стане Active, бо в нього вищий пріоритет і налаштовано preempt (P)","Правильно.","R1 becomes Active again because it has a higher priority and preempt (P) is configured","Correct."],
  ["R2 лишиться Active, бо preempt у HSRP вимкнено за замовчуванням","На R1 preempt увімкнено вручну.","R2 stays Active because HSRP preempt is off by default","Preempt was enabled manually on R1."],
  ["Обидва стануть Active","Ні.","Both become Active","No."],
  ["Віртуальна адреса зміниться на 192.168.10.2","Віртуальна адреса не змінюється.","The virtual IP changes to 192.168.10.2","The virtual IP does not change."]],[0]],
 [["Яку версію HSRP імовірно використано, судячи з номера групи 10 і MAC 0000.0c07.ac0a?","Which HSRP version is likely used, given group 10 and MAC 0000.0c07.ac0a?"],[
  ["HSRPv1 (MAC 0000.0c07.acXX)","Правильно. У v2 — 0000.0c9f.fXXX.","HSRPv1 (MAC 0000.0c07.acXX)","Correct. v2 uses 0000.0c9f.fXXX."],["HSRPv2","У v2 інший префікс MAC.","HSRPv2","v2 uses a different MAC prefix."],["VRRP","У VRRP — 0000.5e00.01XX.","VRRP","VRRP uses 0000.5e00.01XX."],["GLBP","Ні.","GLBP","No."]],[0]]]);

simlet("sl-nat-1","ENSA6",["Проаналізуйте NAT на граничному маршрутизаторі R1.","Analyze NAT on the edge router R1."],[
 ["R1# show ip nat translations","Pro  Inside global         Inside local          Outside local         Outside global\ntcp  209.165.200.226:1024  192.168.10.11:51544   93.184.216.34:443     93.184.216.34:443\ntcp  209.165.200.226:1025  192.168.10.12:49812   93.184.216.34:443     93.184.216.34:443\n---  209.165.200.230       192.168.10.50         ---                   ---"],
 ["R1# show running-config | include nat","ip nat inside source list 1 interface GigabitEthernet0/0 overload\nip nat inside source static 192.168.10.50 209.165.200.230"]],[
 [["Який тип NAT застосовано до 192.168.10.11 і 192.168.10.12?","Which type of NAT is applied to 192.168.10.11 and 192.168.10.12?"],[
  ["PAT (overload): одна глобальна адреса, різні порти","Правильно.","PAT (overload): one global address with different ports","Correct."],["Статичний NAT","Статичний — для .50.","Static NAT","Static is for .50."],["Динамічний NAT з пулом без overload","Тоді були б різні глобальні адреси.","Dynamic NAT with a pool without overload","Then the global addresses would differ."],["NAT64","Ні.","NAT64","No."]],[0]],
 [["Як із Інтернету звертатися до сервера 192.168.10.50?","How is server 192.168.10.50 reached from the Internet?"],[
  ["За адресою 209.165.200.230 (статичний NAT)","Правильно.","At 209.165.200.230 (static NAT)","Correct."],["За адресою 209.165.200.226","Це адреса для PAT.","At 209.165.200.226","That is the PAT address."],["За адресою 192.168.10.50","Приватна адреса в Інтернеті не маршрутизується.","At 192.168.10.50","Private addresses are not routed on the Internet."],["Ніяк","Статичний запис дозволяє вхідні з'єднання.","It cannot be","The static entry allows inbound connections."]],[0]],
 [["Що таке inside local у першому рядку?","What is the inside local address in the first row?"],[
  ["192.168.10.11:51544 — реальна адреса ПК усередині мережі","Правильно.","192.168.10.11:51544 — the PC's real address inside the network","Correct."],["209.165.200.226:1024","Це inside global.","209.165.200.226:1024","That is inside global."],["93.184.216.34:443","Це outside.","93.184.216.34:443","That is outside."],["Адреса інтерфейсу Gi0/0","Це джерело inside global.","The Gi0/0 interface address","That is the source of inside global."]],[0]]]);

simlet("sl-trunk-1","SRWE3",["ПК у VLAN 30 на S1 не бачать ПК у VLAN 30 на S2. Проаналізуйте trunk.","PCs in VLAN 30 on S1 cannot reach PCs in VLAN 30 on S2. Analyze the trunk."],[
 ["S1# show interfaces trunk","Port        Mode             Encapsulation  Status        Native vlan\nGi0/1       on               802.1q         trunking      99\n\nPort        Vlans allowed on trunk\nGi0/1       10,20,99\n\nPort        Vlans allowed and active in management domain\nGi0/1       10,20,99\n\nPort        Vlans in spanning tree forwarding state and not pruned\nGi0/1       10,20,99"],
 ["S2# show interfaces trunk","Port        Mode             Encapsulation  Status        Native vlan\nGi0/1       on               802.1q         trunking      1\n\nPort        Vlans allowed on trunk\nGi0/1       1-4094\n\nPort        Vlans allowed and active in management domain\nGi0/1       1,10,20,30,99\n\nPort        Vlans in spanning tree forwarding state and not pruned\nGi0/1       1,10,20,30,99"],
 ["S2 log","%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on GigabitEthernet0/1 (1), with S1 GigabitEthernet0/1 (99)."]],[
 [["Чому VLAN 30 не проходить між комутаторами?","Why does VLAN 30 not pass between the switches?"],[
  ["На S1 VLAN 30 немає в списку дозволених на trunk","Правильно: allowed 10,20,99.","VLAN 30 is not in S1's allowed list on the trunk","Correct: allowed 10,20,99."],
  ["На S2 trunk не піднявся","Status — trunking.","The trunk is not up on S2","The status is trunking."],
  ["Невідповідність інкапсуляції","Обидва 802.1q.","An encapsulation mismatch","Both use 802.1q."],
  ["VLAN 30 не існує на S2","Вона є в active.","VLAN 30 does not exist on S2","It is listed as active."]],[0]],
 [["Яку ще проблему видно у виводах?","Which other problem do the outputs show?"],[
  ["Native VLAN не збігається: 99 на S1 і 1 на S2","Правильно, про це й каже CDP.","The native VLAN does not match: 99 on S1 and 1 on S2","Correct, that is what CDP reports."],["Різні режими DTP","Обидва on.","Different DTP modes","Both are on."],["Порт S2 в err-disabled","Ні.","S2's port is err-disabled","No."],["Петля STP","Ні.","An STP loop","No."]],[0]],
 [["Яка пара команд виправить обидві проблеми?","Which pair of commands fixes both problems?"],[
  ["S1: switchport trunk allowed vlan add 30; S2: switchport trunk native vlan 99","Правильно.","S1: switchport trunk allowed vlan add 30; S2: switchport trunk native vlan 99","Correct."],
  ["S1: switchport trunk allowed vlan 30; S2: switchport mode access","Перша команда прибере 10,20,99, друга зламає trunk.","S1: switchport trunk allowed vlan 30; S2: switchport mode access","The first removes 10,20,99, the second breaks the trunk."],
  ["S2: no vlan 30","Ні.","S2: no vlan 30","No."],
  ["Обидва: switchport nonegotiate","DTP тут ні до чого.","Both: switchport nonegotiate","DTP is not the issue here."]],[0]]]);
})();
