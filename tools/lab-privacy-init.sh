#!/bin/sh
set -eu
opkg install kmod-veth
lua -e 'assert(loadfile("/usr/share/router-privacy/guard.lua")); assert(loadfile("/usr/share/router-privacy/monitor.lua"))'
ip netns list | awk '{print $1}' | grep -qx rp-client || ip netns add rp-client
if ! ip link show veth-rp >/dev/null 2>&1; then
 ip link add veth-rp type veth peer name rp-peer
 ip link set rp-peer netns rp-client
fi
ip addr replace 192.0.2.1/24 dev veth-rp
ip -6 addr replace fd42:5250::1/64 dev veth-rp
ip link set veth-rp up
ip netns exec rp-client ip link set lo up
ip netns exec rp-client ip addr replace 192.0.2.2/24 dev rp-peer
ip netns exec rp-client ip -6 addr replace fd42:5250::2/64 dev rp-peer
ip netns exec rp-client ip link set rp-peer up
ip netns exec rp-client ip route replace default via 192.0.2.1
ip netns exec rp-client ip -6 route replace default via fd42:5250::1
uci set firewall.router_privacy_lab_zone=zone
uci set firewall.router_privacy_lab_zone.name=rp_test
uci set firewall.router_privacy_lab_zone.input=ACCEPT
uci set firewall.router_privacy_lab_zone.output=ACCEPT
uci set firewall.router_privacy_lab_zone.forward=ACCEPT
uci set firewall.router_privacy_lab_zone.device=veth-rp
uci set firewall.router_privacy_lab_forward=forwarding
uci set firewall.router_privacy_lab_forward.src=rp_test
uci set firewall.router_privacy_lab_forward.dest=lan
uci set firewall.@defaults[0].flow_offloading=0
uci set firewall.@defaults[0].flow_offloading_hw=0
uci commit firewall
nft list table ip rp_lab_nat >/dev/null 2>&1 || nft add table ip rp_lab_nat
nft flush table ip rp_lab_nat
nft 'add chain ip rp_lab_nat post { type nat hook postrouting priority 100; policy accept; }'
nft 'add rule ip rp_lab_nat post ip saddr 192.0.2.0/24 oifname "br-lan" masquerade'
printf 1 > /proc/sys/net/ipv4/ip_forward
printf 1 > /proc/sys/net/ipv6/conf/all/forwarding
printf 1 > /proc/sys/net/netfilter/nf_conntrack_acct
uci set router_privacy.main.wan_interface=br-lan
uci set router_privacy.main.monitor_enabled=1
uci set router_privacy.main.dns_enabled=1
uci set router_privacy.main.lan_interface=veth-rp
uci set openclash.config.modern_dashboard_url='http://127.0.0.1:19090/ui/metacubexd/#/setup?hostname=127.0.0.1&port=19090&http=true'
uci commit router_privacy
uci commit openclash
/etc/init.d/router-privacy enable
/etc/init.d/router-privacy restart
/etc/init.d/firewall reload
sleep 3
nft list table inet router_privacy
ubus call service list '{"name":"router-privacy"}'
logread -e router-privacy | tail -10
