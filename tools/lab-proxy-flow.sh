set -eu
restore() { curl -s -X PUT -H 'Content-Type: application/json' -d '{"name":"DIRECT"}' http://127.0.0.1:9090/proxies/Lab-Selection >/dev/null; }
trap restore EXIT
curl -s -X PUT -H 'Content-Type: application/json' -d '{"name":"Lab-Healthy"}' http://127.0.0.1:9090/proxies/Lab-Selection >/dev/null
ip netns exec rp-client curl --proxy http://192.0.2.1:17890 --connect-timeout 3 --max-time 25 --limit-rate 20 -s https://example.com >/dev/null &
pid=$!
sleep 5
curl -s http://127.0.0.1:9090/connections
lua -e "local m=dofile('/usr/share/router-privacy/monitor.lua');local j=require 'luci.jsonc';local d=m.snapshot();print(j.stringify(d.metrics));for _,f in ipairs(d.flows)do if f.source=='192.0.2.2'then print(j.stringify(f))end end"
kill "$pid" >/dev/null 2>&1 || true
