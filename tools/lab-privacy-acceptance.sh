set -eu
cleanup() {
 nft delete table inet rp_fault >/dev/null 2>&1 || true
 /etc/init.d/mihomo-lab start >/dev/null 2>&1 || true
 [ -n "${capture_pid:-}" ] && kill "$capture_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT
/etc/init.d/router-privacy restart
sleep 3
tcpdump -l -n -i br-lan 'port 53 and (tcp or udp)' >/tmp/rp-wan-dns.txt 2>/tmp/rp-wan-dns-stats.txt &
capture_pid=$!
nonce="rp-accept-$(date +%s)"
ip netns exec rp-client nslookup "$nonce.example.com" 8.8.8.8 > /tmp/rp-query-v4.txt 2>&1 || true
ip netns exec rp-client nslookup "$nonce.example.com" 2001:4860:4860::8888 > /tmp/rp-query-v6.txt 2>&1 || true
ip netns exec rp-client curl --noproxy '*' --connect-timeout 3 --max-time 12 -s -I https://example.com > /tmp/rp-direct.txt
/etc/init.d/openclash stop >/dev/null 2>&1 || true
/etc/init.d/mihomo-lab stop
sleep 2
nslookup example.org 127.0.0.1:53535 > /tmp/rp-proxy-off.txt
echo 'Proxy stopped: independent DNS resolved example.org'
nft 'add table inet rp_fault'
nft 'add chain inet rp_fault fault { type filter hook output priority 0; policy accept; }'
nft 'add rule inet rp_fault fault ip daddr 223.5.5.5 tcp dport 443 reject with tcp reset'
nslookup example.net 127.0.0.1:53535 >/tmp/rp-fallback.txt 2>&1
echo 'Primary inaccessible: domestic DoH fallback resolved example.net'
nft 'add rule inet rp_fault fault ip daddr { 120.53.53.53, 1.12.12.12 } tcp dport 443 reject with tcp reset'
# Local forwarder cache is bypassed by fresh random names.
lua -e "assert(not dofile('/usr/share/router-privacy/monitor.lua').dns_probe(53535),'Unexpected DNS success with both providers blocked')"
/etc/init.d/router-privacy stop
nft list table inet router_privacy >/dev/null
/etc/init.d/firewall reload >/dev/null 2>&1
nft list table inet router_privacy >/dev/null
echo 'Both providers blocked and privacy service stopped: guard retained across firewall reload'
kill "$capture_pid";wait "$capture_pid" || true;capture_pid=''
if grep -q '[^[:space:]]' /tmp/rp-wan-dns.txt;then cat /tmp/rp-wan-dns.txt;exit 1;fi
echo 'WAN port 53 packets: 0 during IPv4/IPv6 interception, proxy stop and resolver faults'
nft delete table inet rp_fault
/etc/init.d/router-privacy start
sleep 4
nslookup example.com 127.0.0.1:53535 >/dev/null
cat /tmp/rp-direct.txt
