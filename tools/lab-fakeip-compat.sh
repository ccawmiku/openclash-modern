set -eu
mkdir -p /tmp/rp-fakeip
cp /etc/config/openclash /tmp/rp-fakeip/openclash.before
cp /etc/config/dhcp /tmp/rp-fakeip/dhcp.before
cleanup() {
 [ -n "${fake_pid:-}" ] && kill "$fake_pid" 2>/dev/null || true
 cp /tmp/rp-fakeip/openclash.before /etc/config/openclash
 cp /tmp/rp-fakeip/dhcp.before /etc/config/dhcp
 /etc/init.d/dnsmasq restart >/dev/null 2>&1
 sleep 3
}
trap cleanup EXIT
cp /tmp/mihomo-lab/mihomo /tmp/rp-fakeip/clash
chmod 755 /tmp/rp-fakeip/clash
cat >/tmp/rp-fakeip/config.yaml <<'YAML'
mode: rule
log-level: warning
dns:
  enable: true
  listen: 127.0.0.1:7874
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver: [127.0.0.1:53535]
rules: ["MATCH,DIRECT"]
YAML
# The legacy core and its transparent firewall are never started in this test.
/tmp/rp-fakeip/clash -d /tmp/rp-fakeip -f /tmp/rp-fakeip/config.yaml >/tmp/rp-fakeip/core.log 2>&1 &
fake_pid=$!
uci set openclash.config.enable=1
uci set openclash.config.dns_port=7874
uci -q delete dhcp.@dnsmasq[0].server || true
uci add_list dhcp.@dnsmasq[0].server='127.0.0.1#7874'
uci commit openclash;uci commit dhcp
/etc/init.d/dnsmasq restart
sleep 5
grep -q 'native-fake-ip' /var/run/router-privacy/dns-route.json
ip netns exec rp-client nslookup rp-fakeip-test.example.org 8.8.8.8 > /tmp/rp-fakeip/active.txt
grep -q '198.18.' /tmp/rp-fakeip/active.txt
echo 'Active core: LAN redirected DNS retained Fake-IP result'
kill "$fake_pid";wait "$fake_pid" || true;fake_pid=''
sleep 4
grep -q 'independent-doh' /var/run/router-privacy/dns-route.json
ip netns exec rp-client nslookup example.org 8.8.8.8 >/tmp/rp-fakeip/stopped.txt
if grep -q '198.18.' /tmp/rp-fakeip/stopped.txt;then echo 'Unexpected cached Fake-IP after stop';exit 1;fi
echo 'Core stopped: LAN DNS automatically resolved through independent DoH'
lua -e "assert(dofile('/usr/share/router-privacy/guard.lua').firewall_valid())"
