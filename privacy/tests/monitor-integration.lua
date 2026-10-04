-- Isolated fixture test of the actual snapshot pipeline; no real socket, UCI
-- mutation, firewall call or capture replacement. Execute with lab_ssh.py.
local original_dofile=dofile
local json=require 'luci.jsonc'
assert(loadfile('/usr/share/router-privacy/monitor.lua'))
local now=os.time()
local cfg={monitor_enabled='1',core_adapter='1',dns_enabled='1',dns_port='53535',watch_domain={'foreign.example'}}
local capture={timestamp=now,flows={
 {vantage='wan-egress',network='tcp',source='10.0.2.15',destination='203.0.113.8',source_port=52000,destination_port=443,protocol_evidence='tls-clienthello',domain='foreign.example',bytes=200,first=now,last=now},
 {vantage='wan-egress',network='udp',source='10.0.2.15',destination='223.5.5.5',source_port=54000,destination_port=53,protocol_evidence='plaintext-dns',domain='foreign.example',bytes=70,first=now,last=now},
 {vantage='lan-ingress',network='udp',source='192.0.2.2',destination='192.0.2.1',source_port=44000,destination_port=53,protocol_evidence='plaintext-dns',domain='foreign.example',bytes=70,first=now,last=now},
 {vantage='wan-egress',network='tcp',source='10.0.2.15',destination='10.0.2.2',source_port=80,destination_port=50000,protocol_evidence='tcp-unknown',domain='',bytes=1000,first=now,last=now}
}}
local core={connections={{metadata={network='tcp',sourceIP='192.0.2.2',destinationIP='203.0.113.8',sourcePort='41000',destinationPort='443',host='foreign.example',destinationGeoIP={'US'}},chains={'DIRECT'},rule='GeoSite',rulePayload='geolocation-!cn'}}}
local wire='HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n'..json.stringify(core)
package.loaded.nixio={sysinfo=function()return {uptime=100}end,socket=function()local consumed=false;return {setopt=function()end,connect=function()return true end,send=function()return true end,recv=function()if not consumed then consumed=true;return wire end end,close=function()end}end}
package.loaded['nixio.fs']={stat=function(path)if path:match('capture.json$')then return {size=4096}end end,readfile=function(path)if path:match('capture.json$')then return json.stringify(capture)end end}
package.loaded['luci.model.uci']={cursor=function()return {unload=function()end,get=function(_,config,section,key)if config=='router_privacy' then return cfg[key]elseif config=='openclash' then return key=='cn_port' and '9090' or '' end;return '0' end}end}
package.loaded['luci.util']={ubus=function()return {['router-privacy']={instances={dns={running=true}}}}end}
dofile=function(path)if path:match('/guard.lua$')then return {settings=function()return cfg end,firewall_valid=function()return true end}end;return original_dofile(path)end
local original_open=io.open
local lines={
 'ipv4 2 tcp 6 100 ESTABLISHED src=192.0.2.2 dst=203.0.113.8 sport=41000 dport=443 bytes=200 src=203.0.113.8 dst=10.0.2.15 sport=443 dport=52000 bytes=50',
 'ipv4 2 udp 17 100 src=192.0.2.2 dst=223.5.5.5 sport=44000 dport=53 bytes=70 src=223.5.5.5 dst=10.0.2.15 sport=53 dport=54000 bytes=0'
}
io.open=function(path,mode)if path=='/proc/net/nf_conntrack'then return {lines=function()local i=0;return function()i=i+1;return lines[i]end end,close=function()end}end;return original_open(path,mode)end
local M=original_dofile('/usr/share/router-privacy/monitor.lua')
local s=M.snapshot({checked_at=now,available=true})
assert(s.monitor.core=='available' and s.dashboard.available)
assert(s.dashboard.wan_total.count==2 and s.dashboard.wan_total.bytes==270)
assert(s.dashboard.excluded_management_records==1)
assert(s.dashboard.sni.overseas==1 and s.dashboard.risks.overseas_direct==1)
assert(s.dashboard.dns.wan_plaintext==1 and s.dashboard.dns.lan_plaintext==1)
assert(s.dashboard.geography.overseas.plaintext_dns==1)
for _,f in ipairs(s.flows)do if f.wan_plain_dns then assert(f.site_region=='overseas' and not f.overseas_direct)end end
local enriched=false;for _,f in ipairs(s.flows)do if f.wan_sni_visible and f.rule_payload=='geolocation-!cn' then enriched=true end end;assert(enriched)
print(json.stringify({standard_api_rule_enrichment=true,nat_wan_sni_correlation=true,dns_domain_association=true,management_excluded=true,dns_not_website_direct=true,no_duplicate_wan_bytes=true,fixture_only=true}))
