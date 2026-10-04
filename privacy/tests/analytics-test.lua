local A=dofile('/usr/share/router-privacy/analytics.lua')
local tested=0
local function classify(c,expected)local actual=A.classify(c);assert(actual==expected,actual..' ~= '..expected);tested=tested+1 end
classify({rule='GeoSite',rule_payload='cn'},'domestic')
classify({rule='GeoSite',rule_payload='geolocation-!cn'},'overseas')
classify({rule='GeoIP',rule_payload='CN'},'domestic')
classify({rule='GeoIP',rule_payload='US'},'overseas')
classify({rule='Match',chains={'DIRECT'}},'unknown')
classify({rule='Match',chains={'PROXY'}},'unknown')
classify({rule='RuleSet',rule_payload='my-china-proxy-list'},'unknown')
classify({rule='RuleSet',rule_payload='cn'},'unknown')
classify({rule='GeoIP',rule_payload='ZZ'},'unknown')
classify({destination_geoip={'CN'}},'domestic')
classify({destination_geoip={'JP'}},'overseas')
classify({destination_geoip={'CN','US'}},'unknown')
classify({rule='GeoSite',rule_payload='cn',destination_geoip={'US'}},'domestic')
classify({},'unknown')
assert(A.encryption('quic-uninspected')=='unknown')
assert(A.encryption('encrypted-dns-candidate')=='unknown')
assert(A.encryption('tls-incomplete')=='unknown')
local flows={
 {external_target=true,site_region='overseas',route='direct-observed',wan_sni_visible=true,wan_protocol='tls-clienthello',wan_ech_offered=true,protocol_evidence='tls-clienthello',bytes=100},
 {external_target=true,site_region='domestic',route='proxy-reported',bytes=200},
 {site_region='domestic',protocol_evidence='plaintext-dns',vantage='lan-ingress'},
 {external_target=true,site_region='unknown',route='direct-observed',protocol_evidence='plaintext-dns',wan_plain_dns=true,wan_protocol='plaintext-dns',bytes=30},
 {external_target=false,site_region='unknown',route='unknown',bytes=400}
}
local wan={{protocol_evidence='tls-clienthello',bytes=100},{protocol_evidence='plaintext-dns',bytes=30},{protocol_evidence='quic-uninspected',bytes=70}}
local d=A.aggregate(flows,wan,true)
assert(d.wan_total.count==3 and d.wan_total.bytes==200)
assert(d.encryption.encrypted.count==1 and d.encryption.plaintext.count==1 and d.encryption.unknown.count==1)
assert(d.encryption.encrypted.bytes/d.wan_total.bytes==.5)
assert(d.dns.lan_plaintext==1 and d.dns.wan_plaintext==1)
assert(d.geography.domestic.plaintext_dns==0 and d.geography.domestic.lan_dns==1)
assert(d.sni.overseas==1 and d.sni.ech_offered==1 and d.risks.overseas_direct==1)
assert(d.routes.unknown==0 and d.routes.direct==1 and d.routes.proxy==1)
assert(not A.aggregate(flows,wan,false).available)
print(require('luci.jsonc').stringify({classification_cases=tested,unknown_not_safe=true,lan_dns_not_wan_leak=true,wan_bytes_not_double_counted=true,geosite_precedes_address_location=true,risk_aggregation=true,stale_not_live=true}))
