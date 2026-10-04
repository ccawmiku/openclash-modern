module('luci.controller.router_privacy',package.seeall)
function index()
 local function route(name,target,mutate)
  local node=entry({'admin','services','router_privacy',name},mutate and post(target) or call(target));node.leaf=true;node.acl_depends={'luci-app-router-privacy'}
 end
 route('status','status');route('settings','settings');route('configure','configure',true);route('probe','probe',true)
end
local function write(data,code)
 local http=require 'luci.http';if code then http.status(code)end;http.prepare_content('application/json');http.header('Cache-Control','no-store');http.write_json(data)
end
local function guard()return dofile('/usr/share/router-privacy/guard.lua')end
local function writable()
 local access=require('luci.util').ubus('session','access',{ubus_rpc_session=require('luci.dispatcher').context.authsession,scope='uci',object='router_privacy',['function']='write'})
 if access and access.access then return true end;write({error='Write access required'},403);return false
end
function settings()write(guard().settings())end
function status()
 local fs,json,http=require 'nixio.fs',require 'luci.jsonc',require 'luci.http'
 local stat=fs.stat('/var/run/router-privacy/snapshot.json');local data=stat and stat.size<8*1024*1024 and json.parse(fs.readfile('/var/run/router-privacy/snapshot.json') or '') or nil
 data=data or {timestamp=0,monitor={enabled=false},dns={enabled=false},metrics={},flows={},unavailable=true}
 local cfg=guard().settings();data.config=cfg;data.stale=os.time()-(tonumber(data.timestamp)or 0)>20
 data.dns=data.dns or {};data.monitor=data.monitor or {}
 data.dns.enabled=cfg.dns_enabled=='1';data.monitor.enabled=cfg.monitor_enabled=='1'
 if not data.monitor.enabled then data.flows={};data.metrics={};data.dashboard={available=false} end
 local flows=data.flows or {};local query=(http.formvalue('search') or ''):lower();local mode=http.formvalue('filter') or 'all';local region=http.formvalue('region') or 'all';local protocol=http.formvalue('protocol') or '';local filtered={}
 for _,flow in ipairs(flows)do
  local matches=mode=='all' or mode=='direct' and (flow.route=='direct-observed' or flow.route=='direct-reported') or mode=='proxy' and flow.route=='proxy-reported' or mode=='dns' and flow.wan_plain_dns or mode=='sni' and flow.wan_sni_visible or mode=='overseas-sni' and flow.overseas_sni or mode=='overseas-direct' and flow.overseas_direct or mode=='plaintext' and (flow.wan_protocol=='plaintext-http' or flow.wan_plain_dns) or mode=='watched' and flow.watched_direct or mode=='unknown' and (flow.route=='unknown' or flow.route=='wan-egress-unattributed')
  if matches and (region=='all' or (flow.site_region or 'unknown')==region) and (protocol=='' or flow.wan_protocol==protocol or flow.protocol_evidence==protocol) and (query=='' or table.concat({flow.source or '',flow.destination or '',flow.domain or ''},' '):lower():find(query,1,true))then filtered[#filtered+1]=flow end
 end
 local page=math.max(1,math.floor(tonumber(http.formvalue('page'))or 1));local limit=math.max(1,math.min(100,math.floor(tonumber(http.formvalue('limit'))or 50)));data.total=#filtered;data.page=page;data.limit=limit;data.flows={}
 for i=(page-1)*limit+1,math.min(page*limit,#filtered)do data.flows[#data.flows+1]=filtered[i]end
 write(data)
end
function configure()
 if not writable()then return end
 local http,json,uci,sys=require 'luci.http',require 'luci.jsonc',require('luci.model.uci').cursor(),require 'luci.sys'
 local raw=http.formvalue('config') or '';if #raw>16384 then write({error='Configuration too large'},400);return end
 local data=json.parse(raw);if type(data)~='table' then write({error='Invalid configuration'},400);return end
 local g=guard();local problem=g.validate(data);if problem then write({error=problem},400);return end
 local merged=g.settings();for k,v in pairs(data)do merged[k]=v end;data=merged
 problem=g.validate(data);if problem then write({error=problem},400);return end
 if data.monitor_enabled=='1' then
  local ok,device=pcall(g.wan,data.wan_interface)
  if not ok or not require('nixio.fs').access('/sys/class/net/'..device) or device=='lo' then write({error='WAN device unavailable; specify an existing interface'},400);return end
 end
 if (data.monitor_enabled=='1' or data.dns_enabled=='1') and #data.lan_interface==0 then write({error='LAN interface required'},400);return end
 for _,device in ipairs(data.lan_interface)do if not require('nixio.fs').access('/sys/class/net/'..device) then write({error='LAN device unavailable: '..device},400);return end end
 local keys={'monitor_enabled','dns_enabled','wan_interface','lan_interface','resolver_url','fallback_url','resolver_ips','fallback_ips','dns_port','core_adapter','disable_offload','watch_domain'}
 uci:section('router_privacy','privacy','main')
 for _,key in ipairs(keys)do if data[key]~=nil then if type(data[key])=='table' then uci:set_list('router_privacy','main',key,data[key])else uci:set('router_privacy','main',key,tostring(data[key]))end end end
 local reload_firewall=false
 if data.monitor_enabled=='1' and data.disable_offload=='1' then
  if not uci:get('router_privacy','main','previous_offload')then uci:set('router_privacy','main','previous_offload',uci:get('firewall','@defaults[0]','flow_offloading')or '0');uci:set('router_privacy','main','previous_hw_offload',uci:get('firewall','@defaults[0]','flow_offloading_hw')or '0')end
  uci:set('firewall','@defaults[0]','flow_offloading','0');uci:set('firewall','@defaults[0]','flow_offloading_hw','0');reload_firewall=true
 elseif uci:get('router_privacy','main','previous_offload') then
  uci:set('firewall','@defaults[0]','flow_offloading',uci:get('router_privacy','main','previous_offload'))
  uci:set('firewall','@defaults[0]','flow_offloading_hw',uci:get('router_privacy','main','previous_hw_offload')or '0')
  uci:delete('router_privacy','main','previous_offload');uci:delete('router_privacy','main','previous_hw_offload');reload_firewall=true
 end
 if reload_firewall then uci:commit('firewall')end
 uci:commit('router_privacy')
 sys.call('printf 1 > /proc/sys/net/netfilter/nf_conntrack_acct')
 sys.call('/etc/init.d/router-privacy enable; /etc/init.d/router-privacy restart >/dev/null 2>&1')
 if reload_firewall then sys.call('/etc/init.d/firewall reload >/dev/null 2>&1')end
 write({ok=true,message='独立服务设置已保存；状态页将报告实际生效结果。'})
end
function probe()
 if not writable()then return end
 local cfg=guard().settings();if cfg.dns_enabled~='1' then write({error='DNS protection is disabled'},400);return end
 local result=dofile('/usr/share/router-privacy/monitor.lua').dns_probe(tonumber(cfg.dns_port)or 53535)
 write({ok=result,checked_at=os.time(),message=result and '解析测试成功；WAN 是否存在明文请求以观察记录和防火墙状态为准。' or '解析失败；请检查端点连接、证书与服务状态。'})
end
