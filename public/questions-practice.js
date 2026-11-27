// Практичні формати: «заповніть пропуски» в конфігурації і «розставте по порядку» (двомовні записи).
(function(){ const QB=window.QB_PRACT=[], TR=window.QB_TR=window.QB_TR||{};
const order=(id,t,q,items,e)=>{ QB.push({id,t,type:"order",q:q[0],items:items.map(x=>x[0]),e:e[0]}); TR[id]={q:q[1],items:items.map(x=>x[1]),e:e[1]}; };
const fill=(id,t,q,cfg,e)=>{ QB.push({id,t,type:"fill",q:q[0],cfg,e:e[0]}); TR[id]={q:q[1],e:e[1]}; };

fill("pf-ec-1","SRWE6",["Об'єднайте Gi0/1–2 у канал LACP 1 (цей бік ініціює переговори) і зробіть канал trunk-ом.","Bundle Gi0/1–2 into LACP channel 1 (this side starts negotiation) and make the channel a trunk."],
 "S1(config)# interface range gi0/1 - 2\nS1(config-if-range)# channel-group [[1]] mode [[active]]\nS1(config-if-range)# exit\nS1(config)# interface [[port-channel|po]] 1\nS1(config-if)# switchport mode [[trunk]]",
 ["Протилежний бік — active або passive. Налаштування Port-channel переходять на всі порти-члени.","The other side uses active or passive. Port-channel settings are inherited by all member ports."]);
fill("pf-ps-1","SRWE11",["Захистіть порт Fa0/5: максимум 2 MAC-адреси, запам'ятовувати їх у конфігурації, при порушенні відкидати кадри з лічильником, але не вимикати порт.","Secure port Fa0/5: at most 2 MAC addresses, remember them in the configuration, and on violation drop frames with a counter but keep the port up."],
 "S1(config)# interface fa0/5\nS1(config-if)# switchport mode access\nS1(config-if)# switchport port-security maximum [[2]]\nS1(config-if)# switchport port-security mac-address [[sticky]]\nS1(config-if)# switchport port-security violation [[restrict]]\nS1(config-if)# switchport [[port-security]]",
 ["restrict відкидає й рахує, protect лише відкидає, shutdown переводить порт у err-disabled.","restrict drops and counts, protect only drops, shutdown puts the port into err-disabled."]);
fill("pf-snoop-1","SRWE11",["Увімкніть DHCP snooping для VLAN 10; довіреним має бути лише uplink Gi0/1 до DHCP-сервера на IOS-маршрутизаторі.","Enable DHCP snooping for VLAN 10; only uplink Gi0/1 toward the DHCP server on an IOS router may be trusted."],
 "S1(config)# ip dhcp [[snooping]]\nS1(config)# ip dhcp snooping vlan [[10]]\nS1(config)# no ip dhcp snooping information [[option]]\nS1(config)# interface gi0/1\nS1(config-if)# ip dhcp snooping [[trust]]",
 ["Без вимкнення опції 82 IOS-сервер відкидатиме запити з giaddr 0.0.0.0.","Without disabling option 82, the IOS server drops requests with giaddr 0.0.0.0."]);
fill("pf-dai-1","SRWE11",["Увімкніть DAI для VLAN 10 і зробіть довіреним uplink Gi0/1.","Enable DAI for VLAN 10 and trust uplink Gi0/1."],
 "S1(config)# ip arp [[inspection]] vlan 10\nS1(config)# interface gi0/1\nS1(config-if)# ip arp inspection [[trust]]",
 ["DAI перевіряє ARP за таблицею DHCP snooping; вузлам зі статичними адресами потрібні ARP ACL або trust.","DAI checks ARP against the DHCP snooping table; hosts with static addresses need ARP ACLs or trust."]);
fill("pf-v6-1","SRWE8",["Налаштуйте на Gi0/2 stateful DHCPv6 з пулом STATEFUL і заборонте хостам SLAAC.","Configure stateful DHCPv6 on Gi0/2 with pool STATEFUL and prevent hosts from using SLAAC."],
 "R1(config)# ipv6 dhcp pool STATEFUL\nR1(config-dhcpv6)# address [[prefix]] 2001:db8:acad:3::/64\nR1(config-dhcpv6)# dns-server 2001:db8:acad:1::254\nR1(config-dhcpv6)# exit\nR1(config)# interface g0/2\nR1(config-if)# ipv6 nd [[managed-config-flag]]\nR1(config-if)# ipv6 nd prefix default [[no-autoconfig]]\nR1(config-if)# ipv6 dhcp [[server]] STATEFUL",
 ["M=1 каже хостам брати адресу в DHCPv6, no-autoconfig знімає прапорець A, тож SLAAC-адреси не буде.","M=1 tells hosts to get their address from DHCPv6; no-autoconfig clears the A flag, so there is no SLAAC address."]);
fill("pf-fs-1","SRWE16",["Додайте основний маршрут до 192.168.2.0/24 через 10.0.12.2 і плаваючий через 10.0.13.2 з AD 5.","Add the primary route to 192.168.2.0/24 via 10.0.12.2 and a floating route via 10.0.13.2 with AD 5."],
 "R1(config)# ip route 192.168.2.0 [[255.255.255.0]] 10.0.12.2\nR1(config)# ip route 192.168.2.0 255.255.255.0 10.0.13.2 [[5]]",
 ["Плаваючий маршрут потрапляє в таблицю лише після зникнення основного (AD 1).","The floating route enters the table only after the primary one (AD 1) disappears."]);
fill("pf-o3-1","ENSA2",["Увімкніть OSPFv3 (процес 1, area 0) на G0/0 маршрутизатора лише з IPv6-адресами.","Enable OSPFv3 (process 1, area 0) on G0/0 of a router that has only IPv6 addresses."],
 "R1(config)# ipv6 [[unicast-routing]]\nR1(config)# ipv6 router ospf 1\nR1(config-rtr)# [[router-id]] 1.1.1.1\nR1(config-rtr)# exit\nR1(config)# interface g0/0\nR1(config-if)# ipv6 ospf 1 [[area]] 0",
 ["Без IPv4-адрес router-id обов'язковий, інакше процес не запуститься.","Without IPv4 addresses the router-id is mandatory, or the process will not start."]);
fill("pf-stp-1","SRWE5",["Зробіть S1 root bridge для VLAN 10 і 20, а на access-порту Fa0/5 до ПК увімкніть PortFast і BPDU Guard.","Make S1 the root bridge for VLANs 10 and 20, and enable PortFast and BPDU Guard on access port Fa0/5 toward a PC."],
 "S1(config)# spanning-tree vlan 10,20 root [[primary]]\nS1(config)# interface fa0/5\nS1(config-if)# spanning-tree [[portfast]]\nS1(config-if)# spanning-tree bpduguard [[enable]]",
 ["root primary ставить пріоритет 24576 або менший, ніж у поточного root.","root primary sets priority 24576 or lower than the current root."]);
order("po-stp-1","SRWE5",["Розставте етапи побудови дерева STP.","Put the stages of building the STP tree in order."],[
 ["Обмін BPDU, кожен вважає root себе","BPDU exchange, every switch claims to be root"],["Вибори root bridge за найменшим BID","Root bridge election by lowest BID"],
 ["Вибір root port на кожному не-root комутаторі","Root port selection on each non-root switch"],["Вибір designated port на кожному сегменті","Designated port selection on each segment"],
 ["Решта портів — alternate (blocking)","Remaining ports become alternate (blocking)"]],["Tie-break для root port: cost до root → BID сусіда → port ID сусіда.","Root port tie-breakers: cost to root → neighbor BID → neighbor port ID."]);
order("po-dhcp6-1","SRWE8",["Розставте обмін повідомленнями, коли хост отримує адресу через stateful DHCPv6.","Put the messages in order when a host gets its address through stateful DHCPv6."],[
 ["Router Solicitation (RS) від хоста","Router Solicitation (RS) from the host"],["Router Advertisement (RA) з прапорцем M=1","Router Advertisement (RA) with the M flag set"],
 ["SOLICIT від хоста до FF02::1:2","SOLICIT from the host to FF02::1:2"],["ADVERTISE від сервера","ADVERTISE from the server"],["REQUEST від хоста","REQUEST from the host"],["REPLY з адресою від сервера","REPLY with the address from the server"]],["Шлюз за замовчуванням хост бере з RA, а не з DHCPv6.","The host takes its default gateway from the RA, not from DHCPv6."]);
order("po-ec-1","SRWE6",["Розставте кроки налаштування EtherChannel між двома комутаторами.","Put the steps of configuring an EtherChannel between two switches in order."],[
 ["Переконатися, що порти мають однакову швидкість, дуплекс і VLAN-налаштування","Make sure the ports have identical speed, duplex, and VLAN settings"],["Додати порти в channel-group з узгодженими режимами","Add the ports to a channel-group with compatible modes"],
 ["Налаштувати interface port-channel (trunk, native, allowed VLAN)","Configure the port-channel interface (trunk, native, allowed VLANs)"],["Перевірити show etherchannel summary: прапорці P і SU","Verify show etherchannel summary: P and SU flags"]],["Налаштування робіть на Port-channel, а не на окремих членах, щоб уникнути suspended-портів.","Configure the port-channel, not the individual members, to avoid suspended ports."]);
})();
