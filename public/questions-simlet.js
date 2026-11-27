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
// ---------- Захоплення пакетів (вивід у стилі Wireshark) ----------
const CAP=(rows)=>"No.  Time      Source              Destination         Protocol  Info\n"+rows.map((r,i)=>String(i+1).padEnd(5)+r[0].padEnd(10)+r[1].padEnd(20)+r[2].padEnd(20)+r[3].padEnd(10)+r[4]).join("\n");
simlet("sl-cap-arp","ITN9",["PC1 (192.168.1.10) уперше пінгує шлюз. Проаналізуйте захоплення на порту PC1.","PC1 (192.168.1.10) pings its gateway for the first time. Analyze the capture on the PC1 port."],[
 ["Захоплення (Wireshark)",CAP([["0.000","Dell_aa:bb:cc","Broadcast","ARP","Who has 192.168.1.1? Tell 192.168.1.10"],["0.001","Cisco_11:22:33","Dell_aa:bb:cc","ARP","192.168.1.1 is at 00:1a:2b:11:22:33"],["0.002","192.168.1.10","192.168.1.1","ICMP","Echo (ping) request id=0x0001, seq=1, ttl=128"],["0.004","192.168.1.1","192.168.1.10","ICMP","Echo (ping) reply id=0x0001, seq=1, ttl=255"]])],
 ["Кадр 1 — деталі","Ethernet II, Src: Dell_aa:bb:cc (00:50:56:aa:bb:cc), Dst: Broadcast (ff:ff:ff:ff:ff:ff)\n    Type: ARP (0x0806)\nAddress Resolution Protocol (request)\n    Opcode: request (1)\n    Sender MAC address: 00:50:56:aa:bb:cc\n    Sender IP address: 192.168.1.10\n    Target MAC address: 00:00:00:00:00:00\n    Target IP address: 192.168.1.1"]],[
 [["Яка MAC-адреса призначення в кадрі 1 і чому?","What is the destination MAC in frame 1, and why?"],[
  ["FF:FF:FF:FF:FF:FF — PC1 ще не знає MAC шлюзу, тому ARP-запит іде широкомовно","Правильно.","FF:FF:FF:FF:FF:FF — PC1 does not know the gateway MAC yet, so the ARP request is a broadcast","Correct."],
  ["00:00:00:00:00:00 — так позначено невідому адресу в заголовку Ethernet","Нулі — у полі Target MAC усередині ARP, а не в Ethernet.","00:00:00:00:00:00 — this marks an unknown address in the Ethernet header","The zeros are in the ARP Target MAC field, not the Ethernet header."],
  ["00:1a:2b:11:22:33 — MAC шлюзу","Її PC1 дізнається лише з кадру 2.","00:1a:2b:11:22:33 — the gateway MAC","PC1 learns it only from frame 2."],
  ["01:00:5E:00:00:01 — багатоадресна","ARP не використовує multicast.","01:00:5E:00:00:01 — multicast","ARP does not use multicast."]],[0]],
 [["Яким є кадр 2 (ARP reply)?","What kind of frame is frame 2 (ARP reply)?"],[
  ["Одноадресним (unicast) — шлюз відповідає прямо на MAC PC1","Правильно: відповідач знає MAC запитувача з поля Sender MAC.","Unicast — the gateway replies directly to the PC1 MAC","Correct: the responder learned the requester's MAC from the Sender MAC field."],
  ["Широкомовним, щоб усі оновили ARP-кеш","Це gratuitous ARP, а не звичайна відповідь.","Broadcast, so everyone updates their ARP cache","That is gratuitous ARP, not a normal reply."],
  ["Багатоадресним","Ні.","Multicast","No."],
  ["Його надсилає комутатор","Комутатор лише пересилає кадр.","It is sent by the switch","The switch only forwards the frame."]],[0]],
 [["Чому в ICMP-відповіді TTL=255, а в запиті 128?","Why is the TTL 255 in the ICMP reply but 128 in the request?"],[
  ["Різні ОС мають різний початковий TTL: Windows — 128, Cisco IOS — 255","Правильно. Пакет не пройшов жодного маршрутизатора.","Different OSes use different initial TTLs: Windows uses 128, Cisco IOS uses 255","Correct. The packet did not cross any router."],
  ["Шлюз додав 127 хопів","TTL лише зменшується.","The gateway added 127 hops","The TTL only ever decreases."],
  ["Відповідь пройшла через 127 маршрутизаторів","Тоді TTL зменшився б.","The reply passed through 127 routers","Then the TTL would have dropped."],
  ["Через помилку захоплення","Це нормальна поведінка.","Because of a capture error","This is normal behavior."]],[0]]]);

simlet("sl-cap-dhcp","SRWE7",["Клієнт у VLAN 20 отримує адресу від DHCP-сервера 10.1.1.5 через relay на R1 (Gi0/0.20 — 192.168.20.1). Захоплення на сервері.","A client in VLAN 20 gets an address from DHCP server 10.1.1.5 through a relay on R1 (Gi0/0.20 — 192.168.20.1). Capture on the server."],[
 ["Захоплення на DHCP-сервері",CAP([["0.000","192.168.20.1","10.1.1.5","DHCP","DHCP Discover - Transaction ID 0x3a1f"],["0.003","10.1.1.5","192.168.20.1","DHCP","DHCP Offer    - Transaction ID 0x3a1f"],["0.010","192.168.20.1","10.1.1.5","DHCP","DHCP Request  - Transaction ID 0x3a1f"],["0.012","10.1.1.5","192.168.20.1","DHCP","DHCP ACK      - Transaction ID 0x3a1f"]])],
 ["Кадр 2 — деталі","User Datagram Protocol, Src Port: 67, Dst Port: 67\nDynamic Host Configuration Protocol (Offer)\n    Client IP address: 0.0.0.0\n    Your (client) IP address: 192.168.20.21\n    Relay agent IP address: 192.168.20.1\n    Client MAC address: 00:50:56:12:34:56\n    Option: (54) DHCP Server Identifier 10.1.1.5\n    Option: (51) IP Address Lease Time (1 day)\n    Option: (3) Router 192.168.20.1\n    Option: (6) Domain Name Server 10.1.1.53"]],[
 [["Як сервер визначив, з якого пулу видати адресу?","How did the server decide which pool to use?"],[
  ["За полем Relay agent IP (giaddr) = 192.168.20.1 — це адреса інтерфейсу relay у мережі клієнта","Правильно.","From the Relay agent IP (giaddr) field = 192.168.20.1, the relay interface address in the client subnet","Correct."],
  ["За MAC-адресою клієнта","MAC використовується для резервацій, а не для вибору мережі.","From the client MAC address","The MAC is used for reservations, not for choosing the subnet."],
  ["За IP джерела 0.0.0.0","Після relay джерело — 192.168.20.1.","From the source IP 0.0.0.0","After the relay the source is 192.168.20.1."],
  ["За опцією 54","Опція 54 — ідентифікатор самого сервера.","From option 54","Option 54 identifies the server itself."]],[0]],
 [["Чому на сервері Discover приходить unicast-ом, а не на 255.255.255.255?","Why does the Discover arrive at the server as unicast and not to 255.255.255.255?"],[
  ["ip helper-address на R1 перетворює broadcast клієнта на unicast до сервера","Правильно: маршрутизатори не пересилають broadcast.","ip helper-address on R1 converts the client broadcast into a unicast to the server","Correct: routers do not forward broadcasts."],
  ["Клієнт знає адресу сервера","Клієнт ще не має навіть своєї адреси.","The client knows the server address","The client does not even have its own address yet."],
  ["Так працює DHCPv6","Це DHCPv4.","That is how DHCPv6 works","This is DHCPv4."],
  ["Сервер у тій самій VLAN","Тоді relay не був би потрібен.","The server is in the same VLAN","Then no relay would be needed."]],[0]],
 [["Яку адресу шлюзу отримає клієнт?","Which default gateway will the client receive?"],[
  ["192.168.20.1 (опція 3)","Правильно.","192.168.20.1 (option 3)","Correct."],
  ["10.1.1.5","Це сервер DHCP.","10.1.1.5","That is the DHCP server."],
  ["10.1.1.53","Це DNS.","10.1.1.53","That is DNS."],
  ["Жодної — шлюз видає лише SLAAC","Опцію 3 видано.","None — only SLAAC provides a gateway","Option 3 was provided."]],[0]]]);

simlet("sl-cap-tcp","ITN14",["Користувач відкриває сторінку на веб-сервері 10.1.1.20. Проаналізуйте початок сесії.","A user opens a page on web server 10.1.1.20. Analyze the start of the session."],[
 ["Захоплення",CAP([["0.000","192.168.1.10","10.1.1.20","TCP","51544 → 443 [SYN] Seq=0 Win=64240 MSS=1460"],["0.012","10.1.1.20","192.168.1.10","TCP","443 → 51544 [SYN, ACK] Seq=0 Ack=1 Win=65160 MSS=1460"],["0.012","192.168.1.10","10.1.1.20","TCP","51544 → 443 [ACK] Seq=1 Ack=1 Win=64240"],["0.013","192.168.1.10","10.1.1.20","TLSv1.3","Client Hello"],["0.026","10.1.1.20","192.168.1.10","TCP","443 → 51544 [ACK] Seq=1 Ack=518"]])]],[
 [["Скільки байтів даних клієнт надіслав у кадрі 4 (Client Hello)?","How many bytes of data did the client send in frame 4 (Client Hello)?"],[
  ["517 — сервер підтверджує Ack=518, тобто наступний очікуваний байт","Правильно: Ack = Seq + довжина даних.","517 — the server acknowledges Ack=518, the next byte it expects","Correct: Ack = Seq + data length."],
  ["518","518 — номер наступного байта.","518","518 is the next byte number."],
  ["1460","Це MSS — максимум, а не фактичний розмір.","1460","That is the MSS, the maximum, not the actual size."],
  ["64240","Це вікно.","64240","That is the window."]],[0]],
 [["Що з цього правильно щодо портів?","Which statement about the ports is correct?"],[
  ["443 — відомий порт сервера (HTTPS), 51544 — динамічний порт клієнта","Правильно.","443 is the server's well-known port (HTTPS), 51544 is the client's dynamic port","Correct."],
  ["51544 — порт сервера","Сервер відповідає з 443.","51544 is the server port","The server replies from 443."],
  ["Обидва порти — зареєстровані","51544 — з динамічного діапазону 49152–65535.","Both ports are registered ports","51544 is from the dynamic range 49152–65535."],
  ["Порт 443 означає HTTP без шифрування","HTTP — 80.","Port 443 means unencrypted HTTP","HTTP is 80."]],[0]],
 [["Скільки сегментів потрібно для встановлення сесії TCP?","How many segments does it take to establish the TCP session?"],[
  ["Три: SYN, SYN-ACK, ACK","Правильно — триетапне рукостискання.","Three: SYN, SYN-ACK, ACK","Correct — the three-way handshake."],
  ["Два: SYN і ACK","Сервер також надсилає свій SYN.","Two: SYN and ACK","The server also sends its own SYN."],
  ["Чотири, як і для завершення","Завершення (FIN/ACK ×2) — чотири, встановлення — три.","Four, the same as for termination","Termination (FIN/ACK twice) takes four; establishment takes three."],
  ["Один, якщо UDP","Це TCP.","One, if UDP is used","This is TCP."]],[0]]]);

simlet("sl-cap-dot1q","SRWE3",["Захоплення на trunk-лінку між S1 і S2 (native VLAN 99).","Capture on the trunk link between S1 and S2 (native VLAN 99)."],[
 ["Кадр 1","Ethernet II, Src: 00:50:56:01:01:01, Dst: 00:50:56:02:02:02\n802.1Q Virtual LAN, PRI: 0, DEI: 0, ID: 20\n    000. .... .... .... = Priority: Best Effort (0)\n    .... 0000 0001 0100 = ID: 20\n    Type: IPv4 (0x0800)\nInternet Protocol Version 4, Src: 192.168.20.11, Dst: 192.168.20.12"],
 ["Кадр 2","Ethernet II, Src: 00:19:e8:11:1a:01, Dst: 01:00:0c:cc:cc:cd\n    Type/Length: 0x0032\nLogical-Link Control\nCisco Shared Spanning Tree Protocol (PVST+)\n    Root Identifier: 24675 / 0019.e811.1a00"],
 ["Кадр 3","Ethernet II, Src: 00:50:56:09:09:09, Dst: ff:ff:ff:ff:ff:ff\n    Type: ARP (0x0806)\nAddress Resolution Protocol (request) Who has 192.168.99.1?"]],[
 [["До якої VLAN належить кадр 3?","Which VLAN does frame 3 belong to?"],[
  ["99 — кадр без тегу на trunk належить native VLAN","Правильно.","99 — an untagged frame on a trunk belongs to the native VLAN","Correct."],
  ["1 — VLAN за замовчуванням","Native тут змінено на 99.","1 — the default VLAN","The native VLAN here was changed to 99."],
  ["Жодної — його буде відкинуто","Untagged кадри на trunk приймаються в native VLAN.","None — it will be dropped","Untagged frames on a trunk are accepted into the native VLAN."],
  ["20, як попередній","Тег є лише в кадрі 1.","20, like the previous frame","Only frame 1 carries a tag."]],[0]],
 [["Скільки байтів додає тег 802.1Q і яке поле визначає пріоритет CoS?","How many bytes does an 802.1Q tag add, and which field carries the CoS priority?"],[
  ["4 байти; 3-бітове поле PRI (PCP)","Правильно.","4 bytes; the 3-bit PRI (PCP) field","Correct."],
  ["2 байти; поле DEI","DEI — 1 біт, ознака відкидання.","2 bytes; the DEI field","DEI is 1 bit, the drop-eligible indicator."],
  ["4 байти; поле ID","ID — номер VLAN (12 біт).","4 bytes; the ID field","ID is the VLAN number (12 bits)."],
  ["26 байтів, як ISL","ISL інкапсулює кадр цілком і застарів.","26 bytes, like ISL","ISL encapsulates the entire frame and is obsolete."]],[0]],
 [["Якщо на S2 native VLAN — 1, що відбудеться?","What happens if the native VLAN on S2 is 1?"],[
  ["CDP повідомить про native VLAN mismatch, а untagged трафік VLAN 99 на S1 потрапить у VLAN 1 на S2","Правильно.","CDP reports a native VLAN mismatch, and untagged VLAN 99 traffic from S1 ends up in VLAN 1 on S2","Correct."],
  ["Trunk не підніметься","Trunk працює, але з витоком між VLAN.","The trunk will not come up","The trunk works, but traffic leaks between VLANs."],
  ["Кадр 1 потрапить у VLAN 1","Він має тег 20.","Frame 1 ends up in VLAN 1","It carries tag 20."],
  ["Нічого — native VLAN локальна","Вона має збігатися з обох боків.","Nothing — the native VLAN is local","It must match on both sides."]],[0]]]);

simlet("sl-cap-ospf","ENSA2",["R1 і R2 на спільному лінку не встановлюють сусідство OSPF. Проаналізуйте Hello-пакети.","R1 and R2 on a shared link do not form an OSPF adjacency. Analyze the Hello packets."],[
 ["Захоплення",CAP([["0.000","10.0.12.1","224.0.0.5","OSPF","Hello Packet"],["4.993","10.0.12.2","224.0.0.5","OSPF","Hello Packet"],["10.002","10.0.12.1","224.0.0.5","OSPF","Hello Packet"]])],
 ["Кадр 1 — R1","OSPF Header: Version 2, Type Hello, Router ID 1.1.1.1, Area ID 0.0.0.0\nOSPF Hello Packet\n    Network Mask: 255.255.255.252\n    Hello Interval [sec]: 10\n    Router Priority: 1\n    Router Dead Interval [sec]: 40\n    Designated Router: 0.0.0.0\n    Active Neighbor: (none)"],
 ["Кадр 2 — R2","OSPF Header: Version 2, Type Hello, Router ID 2.2.2.2, Area ID 0.0.0.0\nOSPF Hello Packet\n    Network Mask: 255.255.255.252\n    Hello Interval [sec]: 5\n    Router Priority: 1\n    Router Dead Interval [sec]: 20\n    Designated Router: 0.0.0.0\n    Active Neighbor: (none)"]],[
 [["Чому сусідство не встановлюється?","Why does the adjacency not form?"],[
  ["Hello і Dead інтервали не збігаються (10/40 проти 5/20)","Правильно: вони мають бути однаковими.","The Hello and Dead intervals do not match (10/40 vs 5/20)","Correct: they must be identical."],
  ["Різні router ID","Router ID якраз мають бути різними.","The router IDs differ","Router IDs must differ."],
  ["Однаковий пріоритет 1","Пріоритет впливає лише на вибір DR.","The priority is 1 on both","Priority only affects DR election."],
  ["Пакети йдуть на multicast 224.0.0.5","Це звичайна адреса AllSPFRouters.","Packets are sent to multicast 224.0.0.5","That is the normal AllSPFRouters address."]],[0]],
 [["Як виправити на R2?","How do you fix it on R2?"],[
  ["no ip ospf hello-interval і no ip ospf dead-interval на інтерфейсі (або задати 10/40)","Правильно.","no ip ospf hello-interval and no ip ospf dead-interval on the interface (or set 10/40)","Correct."],
  ["router-id 1.1.1.1","Router ID тоді збігся б — нова проблема.","router-id 1.1.1.1","Then the router IDs would collide, creating a new problem."],
  ["ip ospf priority 0","Це не стосується таймерів.","ip ospf priority 0","That has nothing to do with the timers."],
  ["clear ip ospf process","Таймери від цього не зміняться.","clear ip ospf process","That does not change the timers."]],[0]],
 [["Що ще в Hello має збігатися для сусідства?","What else in the Hello must match for an adjacency?"],[
  ["Area ID, маска мережі (на multiaccess), автентифікація, прапорець stub","Правильно.","Area ID, network mask (on multiaccess), authentication, and the stub flag","Correct."],
  ["Router ID і пріоритет","Ні, вони різні у різних маршрутизаторів.","Router ID and priority","No, these differ between routers."],
  ["Номер процесу OSPF","Номер процесу локальний.","The OSPF process ID","The process ID is local."],
  ["Cost інтерфейсу","Cost може відрізнятися.","The interface cost","Cost may differ."]],[0]]]);

simlet("sl-cap-dns","ITN15",["Користувач вводить www.corp.lab у браузері. Захоплення на ПК.","A user types www.corp.lab in a browser. Capture on the PC."],[
 ["Захоплення",CAP([["0.000","192.168.1.10","10.1.1.53","DNS","Standard query 0x7c2e A www.corp.lab"],["0.004","10.1.1.53","192.168.1.10","DNS","Standard query response 0x7c2e A www.corp.lab CNAME web01.corp.lab A 10.1.1.20"],["0.005","192.168.1.10","10.1.1.20","TCP","51600 → 80 [SYN]"]])],
 ["Кадр 2 — деталі","User Datagram Protocol, Src Port: 53, Dst Port: 61022\nDomain Name System (response)\n    Flags: 0x8580 Standard query response, No error\n        .... .1.. .... .... = Authoritative: Server is an authority for domain\n    Answers\n        www.corp.lab: type CNAME, class IN, cname web01.corp.lab (TTL 3600)\n        web01.corp.lab: type A, class IN, addr 10.1.1.20 (TTL 300)"]],[
 [["Що означає запис CNAME у відповіді?","What does the CNAME record in the response mean?"],[
  ["www.corp.lab — псевдонім (alias) імені web01.corp.lab","Правильно.","www.corp.lab is an alias for web01.corp.lab","Correct."],
  ["Поштовий сервер домену","Це MX.","The domain's mail server","That is MX."],
  ["Зворотний запис для 10.1.1.20","Це PTR.","A reverse record for 10.1.1.20","That is PTR."],
  ["Адресу IPv6","Це AAAA.","An IPv6 address","That is AAAA."]],[0]],
 [["Який транспорт і порт використано для запиту?","Which transport and port were used for the query?"],[
  ["UDP, порт призначення 53","Правильно. TCP 53 — для великих відповідей і передачі зон.","UDP, destination port 53","Correct. TCP 53 is used for large responses and zone transfers."],
  ["TCP 53","Тут UDP.","TCP 53","It is UDP here."],
  ["UDP 61022","Це динамічний порт клієнта.","UDP 61022","That is the client's dynamic port."],
  ["TCP 80","Це наступне з'єднання з веб-сервером.","TCP 80","That is the next connection, to the web server."]],[0]],
 [["Як довго ПК може тримати в кеші адресу 10.1.1.20?","How long may the PC cache the address 10.1.1.20?"],[
  ["300 с — TTL запису A","Правильно.","300 s — the TTL of the A record","Correct."],
  ["3600 с","Це TTL CNAME.","3600 s","That is the CNAME TTL."],
  ["Безстроково","Кожен запис має TTL.","Indefinitely","Every record has a TTL."],
  ["1 день, як оренда DHCP","Не пов'язано з DHCP.","One day, like the DHCP lease","It is unrelated to DHCP."]],[0]]]);

// ---------- Аналіз виводів ----------
simlet("sl-ospf-mtu","ENSA2",["R1 і R2 бачать одне одного, але маршрути OSPF не з'являються.","R1 and R2 see each other, but no OSPF routes appear."],[
 ["R1# show ip ospf neighbor","Neighbor ID     Pri   State           Dead Time   Address         Interface\n2.2.2.2           1   EXSTART/DR      00:00:36    10.0.12.2       GigabitEthernet0/1"],
 ["R1# show interfaces g0/1 | include MTU","  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,"],
 ["R2# show interfaces g0/1 | include MTU","  MTU 1400 bytes, BW 1000000 Kbit/sec, DLY 10 usec,"]],[
 [["Чому сусідство застрягло в EXSTART?","Why is the adjacency stuck in EXSTART?"],[
  ["Не збігається IP MTU на інтерфейсах: пакети DBD відкидаються","Правильно.","The interface IP MTU does not match, so DBD packets are dropped","Correct."],
  ["Не збігаються Hello-таймери","Тоді не дійшло б навіть до 2-WAY.","The Hello timers do not match","Then it would not even reach 2-WAY."],
  ["Різні області","Тоді не було б сусіда взагалі.","The areas differ","Then there would be no neighbor at all."],
  ["R2 обрано DR","Вибір DR — нормальне явище.","R2 was elected DR","DR election is normal."]],[0]],
 [["Який стан мав би бути між R1 і DR у робочій мережі?","Which state should R1 and the DR reach in a working network?"],[
  ["FULL","Правильно.","FULL","Correct."],
  ["2-WAY","2-WAY — між DROTHER-ами.","2-WAY","2-WAY is between DROTHERs."],
  ["LOADING","Це проміжний стан.","LOADING","That is a transitional state."],
  ["INIT","Це проміжний стан.","INIT","That is a transitional state."]],[0]]]);

simlet("sl-acl-hits","ENSA5",["Користувачі 192.168.10.0/24 скаржаться, що не відкривається вебсервер 10.1.1.10. ACL застосовано на R1 Gi0/0 in.","Users in 192.168.10.0/24 report that web server 10.1.1.10 does not open. The ACL is applied on R1 Gi0/0 inbound."],[
 ["R1# show access-lists","Extended IP access list WEB\n    10 permit tcp 192.168.10.0 0.0.0.255 host 10.1.1.10 eq 443 (1250 matches)\n    20 deny   tcp any host 10.1.1.10 eq www (88 matches)\n    30 permit tcp 192.168.10.0 0.0.0.255 host 10.1.1.10 eq www\n    40 permit udp any any eq domain (402 matches)"]],[
 [["Чому HTTP (порт 80) до сервера не працює?","Why does HTTP (port 80) to the server not work?"],[
  ["Рядок 20 (deny www) стоїть перед рядком 30, тож рядок 30 ніколи не спрацює","Правильно: ACL перевіряється згори вниз до першого збігу.","Line 20 (deny www) comes before line 30, so line 30 is never reached","Correct: an ACL is processed top-down until the first match."],
  ["Неявний deny в кінці","До нього пакети HTTP не доходять — їх зупиняє рядок 20.","The implicit deny at the end","HTTP packets never reach it; line 20 stops them."],
  ["ACL застосовано не в тому напрямку","HTTPS працює — напрямок правильний.","The ACL is applied in the wrong direction","HTTPS works, so the direction is right."],
  ["Неправильна wildcard","Рядок 10 з тією ж wildcard працює.","The wildcard mask is wrong","Line 10 with the same wildcard works."]],[0]],
 [["Як виправити з мінімальними змінами?","How can it be fixed with minimal changes?"],[
  ["ip access-list extended WEB, no 20 — або додати правило з номером, меншим за 20 (наприклад, 15)","Правильно: нумеровані рядки іменованого ACL можна видаляти й вставляти.","ip access-list extended WEB, then no 20 — or add a rule numbered below 20 (for example 15)","Correct: numbered lines in a named ACL can be removed and inserted."],
  ["Видалити ACL повністю й створити заново","Можна, але це не мінімальна зміна й тимчасово відкриває все.","Delete the whole ACL and recreate it","Possible, but not minimal, and it temporarily permits everything."],
  ["Додати permit ip any any в кінець","Рядок 20 спрацює раніше.","Add permit ip any any at the end","Line 20 still matches first."],
  ["Застосувати ACL на out","Порядок рядків не зміниться.","Apply the ACL outbound","The line order would not change."]],[0]],
 [["Чому в лічильниках не видно відкинутих неявним deny пакетів?","Why are packets dropped by the implicit deny not shown in the counters?"],[
  ["Неявний deny any не відображається — щоб бачити лічильник, додайте явний deny ip any any (log)","Правильно.","The implicit deny any is not displayed; add an explicit deny ip any any (log) to see a counter","Correct."],
  ["Їх немає взагалі","Пакети є, просто лічильника немає.","There are none at all","There are packets, there is just no counter."],
  ["Їх видно в show ip interface","Там лише назва ACL.","They are visible in show ip interface","That only shows the ACL name."],
  ["Лічильники скидаються щохвилини","Ні, лише clear access-list counters.","The counters reset every minute","No, only clear access-list counters resets them."]],[0]]]);

simlet("sl-relay","SRWE7",["ПК у VLAN 30 отримують 169.254.x.x, а у VLAN 10 — адреси від сервера. Сервер 10.1.1.5 має пули для обох VLAN.","PCs in VLAN 30 get 169.254.x.x addresses, while those in VLAN 10 get addresses from the server. Server 10.1.1.5 has pools for both VLANs."],[
 ["R1# show running-config | section interface","interface GigabitEthernet0/0.10\n encapsulation dot1Q 10\n ip address 192.168.10.1 255.255.255.0\n ip helper-address 10.1.1.5\n!\ninterface GigabitEthernet0/0.30\n encapsulation dot1Q 30\n ip address 192.168.30.1 255.255.255.0\n!\ninterface GigabitEthernet0/1\n ip address 10.1.1.1 255.255.255.0\n ip helper-address 10.1.1.5"]],[
 [["Що потрібно виправити?","What needs to be fixed?"],[
  ["Додати ip helper-address 10.1.1.5 на Gi0/0.30","Правильно: relay налаштовують на інтерфейсі, куди приходять broadcast-и клієнтів.","Add ip helper-address 10.1.1.5 on Gi0/0.30","Correct: the relay goes on the interface that receives client broadcasts."],
  ["Додати helper на Gi0/1 ще раз","Gi0/1 дивиться на сервер; helper там зайвий.","Add the helper on Gi0/1 again","Gi0/1 faces the server; the helper is unnecessary there."],
  ["Увімкнути service dhcp на сервері","Сервер працює для VLAN 10.","Enable service dhcp on the server","The server works for VLAN 10."],
  ["Змінити encapsulation на dot1Q 30 native","Інкапсуляція правильна.","Change the encapsulation to dot1Q 30 native","The encapsulation is correct."]],[0]],
 [["Що означає адреса 169.254.x.x?","What does a 169.254.x.x address mean?"],[
  ["APIPA: клієнт не отримав відповіді від DHCP і призначив link-local адресу сам","Правильно.","APIPA: the client got no DHCP reply and assigned itself a link-local address","Correct."],
  ["Сервер видав адресу з резервного пулу","Сервер нічого не видав.","The server assigned an address from a backup pool","The server assigned nothing."],
  ["Це приватна адреса RFC 1918","169.254/16 — не RFC 1918.","It is an RFC 1918 private address","169.254/16 is not RFC 1918."],
  ["Це адреса IPv6","Це IPv4.","It is an IPv6 address","It is IPv4."]],[0]]]);

simlet("sl-vrrp-1","SRWE9",["R1 і R2 надають віртуальний шлюз 192.168.10.1 через VRRP.","R1 and R2 provide virtual gateway 192.168.10.1 using VRRP."],[
 ["R1# show vrrp brief","Interface          Grp Pri Time  Own Pre State   Master addr     Group addr\nGi0/0              10  110 3570      Y   Master  192.168.10.2    192.168.10.1"],
 ["R2# show vrrp brief","Interface          Grp Pri Time  Own Pre State   Master addr     Group addr\nGi0/0              10  100 3609      Y   Backup  192.168.10.2    192.168.10.1"]],[
 [["Що станеться, коли R1 відновиться після збою?","What happens when R1 recovers after a failure?"],[
  ["R1 знову стане Master, бо preempt у VRRP увімкнено за замовчуванням і пріоритет 110 > 100","Правильно.","R1 becomes Master again, because preempt is on by default in VRRP and 110 > 100","Correct."],
  ["R2 лишиться Master, бо preempt треба вмикати вручну","Так у HSRP, не у VRRP.","R2 stays Master, because preempt must be enabled manually","That is HSRP, not VRRP."],
  ["Обидва стануть Master","Ні.","Both become Master","No."],
  ["Група перейде в Init","Ні.","The group goes to Init","No."]],[0]],
 [["Яка віртуальна MAC-адреса групи 10?","What is the virtual MAC address of group 10?"],[
  ["0000.5E00.010A","Правильно: 0000.5E00.01XX, де XX — номер групи в hex.","0000.5E00.010A","Correct: 0000.5E00.01XX, where XX is the group number in hex."],
  ["0000.0C07.AC0A","Це HSRPv1.","0000.0C07.AC0A","That is HSRPv1."],
  ["0000.0C9F.F00A","Це HSRPv2.","0000.0C9F.F00A","That is HSRPv2."],
  ["0007.B400.0A01","Це GLBP.","0007.B400.0A01","That is GLBP."]],[0]],
 [["Чим VRRP відрізняється від HSRP?","How does VRRP differ from HSRP?"],[
  ["Відкритий стандарт (RFC 5798); віртуальна IP може бути адресою інтерфейсу маршрутизатора-власника","Правильно.","It is an open standard (RFC 5798), and the virtual IP may be the owner router's interface address","Correct."],
  ["Балансує навантаження між усіма маршрутизаторами групи","Це GLBP.","It load-balances across all routers in the group","That is GLBP."],
  ["Працює лише на комутаторах","Ні.","It only runs on switches","No."],
  ["Не має пріоритетів","Має, 1–254.","It has no priorities","It does, 1–254."]],[0]]]);

simlet("sl-cdp-lldp","ENSA10",["Документуєте мережу. Проаналізуйте виводи протоколів виявлення сусідів на S1.","You are documenting the network. Analyze the neighbor discovery output on S1."],[
 ["S1# show cdp neighbors","Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge\n                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone\n\nDevice ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\nR1               Gig 0/1           151         R B S I    ISR4331   Gig 0/0/1\nSEP001122334455  Fas 0/5           128         H P        IP Phone  Port 1"],
 ["S1# show lldp neighbors","Capability codes:\n    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device\n    (W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other\n\nDevice ID           Local Intf     Hold-time  Capability      Port ID\nAP-Floor2           Fa0/10         112        W               eth0\n\nTotal entries displayed: 1"]],[
 [["Чому точка доступу AP-Floor2 видна лише в LLDP?","Why is access point AP-Floor2 visible only in LLDP?"],[
  ["Це пристрій іншого виробника: CDP — пропрієтарний протокол Cisco, LLDP — стандарт IEEE 802.1AB","Правильно.","It is a non-Cisco device: CDP is Cisco-proprietary, LLDP is the IEEE 802.1AB standard","Correct."],
  ["CDP вимкнено на S1 глобально","Тоді не було б R1 і телефону.","CDP is disabled globally on S1","Then R1 and the phone would be missing too."],
  ["LLDP має більший holdtime","Це не впливає на видимість.","LLDP has a longer holdtime","That does not affect visibility."],
  ["Точки доступу ніколи не підтримують CDP","Точки Cisco підтримують.","Access points never support CDP","Cisco access points do."]],[0]],
 [["Як вимкнути CDP лише на порту до мережі провайдера (міркування безпеки)?","How do you disable CDP only on the port facing the ISP (for security)?"],[
  ["У режимі інтерфейсу: no cdp enable","Правильно. Глобально — no cdp run.","In interface mode: no cdp enable","Correct. Globally it is no cdp run."],
  ["no cdp run","Це вимкне CDP на всіх портах.","no cdp run","That disables CDP on all ports."],
  ["no lldp transmit","Це LLDP.","no lldp transmit","That is LLDP."],
  ["shutdown","Це вимкне весь порт.","shutdown","That shuts down the whole port."]],[0]],
 [["Яка команда покаже IP-адресу керування R1?","Which command shows the management IP address of R1?"],[
  ["show cdp neighbors detail","Правильно.","show cdp neighbors detail","Correct."],
  ["show cdp interface","Там таймери й стан CDP на портах.","show cdp interface","That shows CDP timers and port status."],
  ["show ip interface brief","Це адреси самого S1.","show ip interface brief","Those are S1's own addresses."],
  ["show cdp traffic","Лише лічильники.","show cdp traffic","Counters only."]],[0]]]);

simlet("sl-ntp-syslog","ENSA10",["У журналах різних пристроїв час не збігається, тож події неможливо зіставити.","Timestamps in different devices' logs do not match, so events cannot be correlated."],[
 ["R1# show ntp associations","  address         ref clock       st   when   poll reach  delay  offset   disp\n*~10.1.1.123      .GPS.            1     36     64   377  1.204  -0.311  0.182\n * sys.peer, # selected, + candidate, - outlyer, x falseticker, ~ configured"],
 ["S1# show ntp status","Clock is unsynchronized, stratum 16, no reference clock"],
 ["S1# show logging | include LINK","Mar  1 00:14:22.019: %LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down"]],[
 [["Який stratum матиме R1?","What stratum will R1 have?"],[
  ["2 — на одиницю більше за сервер зі stratum 1","Правильно.","2 — one more than the stratum 1 server","Correct."],
  ["1","1 — у самого сервера з GPS.","1","1 is the GPS server itself."],
  ["16","16 — несинхронізований.","16","16 means unsynchronized."],
  ["0","0 — це сам еталонний годинник.","0","0 is the reference clock itself."]],[0]],
 [["Що з S1?","What is wrong with S1?"],[
  ["Він не синхронізований (stratum 16) — потрібна команда ntp server, напр. 10.1.1.123 або R1","Правильно. Дата Mar 1 00:14 — типовий час після старту без NTP.","It is not synchronized (stratum 16); it needs an ntp server command, e.g. 10.1.1.123 or R1","Correct. Mar 1 00:14 is the typical time after boot without NTP."],
  ["Неправильний рівень syslog","Рівень не впливає на час.","The syslog level is wrong","The level does not affect time."],
  ["Порт Gi0/1 вимкнено","Це подія, а не причина розбіжності часу.","Port Gi0/1 is shut down","That is the event, not the cause of the time mismatch."],
  ["NTP працює, просто інший часовий пояс","Stratum 16 — немає синхронізації.","NTP works, it is just another time zone","Stratum 16 means no synchronization."]],[0]],
 [["Який рівень серйозності має повідомлення %LINK-3-UPDOWN?","What severity does the %LINK-3-UPDOWN message have?"],[
  ["3 — Error","Правильно: 0 Emergency, 1 Alert, 2 Critical, 3 Error, 4 Warning, 5 Notification, 6 Informational, 7 Debugging.","3 — Error","Correct: 0 Emergency, 1 Alert, 2 Critical, 3 Error, 4 Warning, 5 Notification, 6 Informational, 7 Debugging."],
  ["3 — Critical","Critical — 2.","3 — Critical","Critical is 2."],
  ["3 — Warning","Warning — 4.","3 — Warning","Warning is 4."],
  ["3 — Notification","Notification — 5.","3 — Notification","Notification is 5."]],[0]]]);

})();
