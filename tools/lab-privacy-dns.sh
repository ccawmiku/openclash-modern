#!/bin/sh
set -eu
uci set router_privacy.main.resolver_url=https://223.5.5.5/dns-query
uci set router_privacy.main.fallback_url=https://223.6.6.6/dns-query
uci commit router_privacy
/etc/init.d/router-privacy restart
mkdir -p /etc/netns/rp-client
printf 'nameserver 192.0.2.1\n' > /etc/netns/rp-client/resolv.conf
sleep 4
nslookup example.com 127.0.0.1:53531
ip netns exec rp-client nslookup example.com 8.8.8.8
ip netns exec rp-client nslookup example.com 2001:4860:4860::8888
ip netns exec rp-client curl --noproxy '*' --connect-timeout 3 --max-time 10 -I https://example.com
