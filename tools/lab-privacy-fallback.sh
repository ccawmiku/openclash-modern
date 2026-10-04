set -eu
uci set router_privacy.main.fallback_url='https://doh.pub/dns-query'
uci -q delete router_privacy.main.fallback_ips || true
uci add_list router_privacy.main.fallback_ips='120.53.53.53'
uci add_list router_privacy.main.fallback_ips='1.12.12.12'
uci commit router_privacy
/etc/init.d/router-privacy restart
sleep 4
nslookup example.com 127.0.0.1:53532
