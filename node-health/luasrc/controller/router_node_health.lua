module('luci.controller.router_node_health',package.seeall)
function index()
 for _,name in ipairs({'status','settings','export'})do local n=entry({'admin','services','router_node_health',name},call(name));n.leaf=true;n.acl_depends={'luci-app-router-node-health'}end
 for _,name in ipairs({'configure','checkpoint','probe'})do local n=entry({'admin','services','router_node_health',name},post(name));n.leaf=true;n.acl_depends={'luci-app-router-node-health'}end
end
local function write(data,code)local h=require 'luci.http';if code then h.status(code)end;h.prepare_content('application/json');h.header('Cache-Control','no-store');h.write_json(data)end
local function writable()
 local a=require('luci.util').ubus('session','access',{ubus_rpc_session=require('luci.dispatcher').context.authsession,scope='uci',object='router_node_health',['function']='write'})
 if a and a.access then return true end;write({error='Write access required'},403);return false
end
local function read()
 local fs,json=require 'nixio.fs',require 'luci.jsonc';local p='/var/run/router-node-health/history.json';local s=fs.stat(p)
 if not s then p='/etc/router-node-health/history.json';s=fs.stat(p)end
 return s and s.size<1024*1024 and json.parse(fs.readfile(p)or '')or {version=1,nodes={},timestamp=0}
end
function settings()
 local u=require('luci.model.uci').cursor();local data=u:get_all('router_node_health','main')or {};data.api_secret=nil
 for k in pairs(data)do if k:sub(1,1)=='.'then data[k]=nil end end;write(data)
end
function status()
 local db=read();local h=require 'luci.http';local history=dofile('/usr/share/router-node-health/history.lua');local name=h.formvalue('node');local nodes={}
 local u=require('luci.model.uci').cursor();local enabled=u:get('router_node_health','main','enabled')=='1';local stale=os.time()-(db.timestamp or 0)>30
 if not enabled or stale or db.core_state~='available' then for _,node in pairs(db.nodes)do if not node.removed then node.status='unknown' end end end
 for _,node in pairs(db.nodes)do local item={name=node.name,type=node.type,status=node.status,checked=node.checked,ok=node.ok,failed=node.failed,unknown=node.unknown,streak=node.streak,recoveries=node.recoveries,last_outage=node.last_outage,last_error=node.last_error,removed=node.removed,summary=history.summary(node)};nodes[#nodes+1]=item end
 table.sort(nodes,function(a,b)return a.name<b.name end)
 write({timestamp=db.timestamp or 0,stale=stale,enabled=enabled,core_state=db.core_state,nodes=nodes,detail=name and db.nodes[name],interval=db.interval,keep_samples=db.keep_samples,discovered=db.discovered,capacity_limited=db.capacity_limited,persistence=db.persistence,last_checkpoint=db.last_checkpoint,error=require('nixio.fs').readfile('/var/run/router-node-health/error')})
end
function export()
 local h=require 'luci.http';h.header('Content-Disposition','attachment; filename="node-history.json"');write(read())
end
function checkpoint()
 if not writable()then return end
 local fs,json=require 'nixio.fs',require 'luci.jsonc';fs.mkdirr('/etc/router-node-health');fs.chmod('/etc/router-node-health','700')
 local text=json.stringify(read());if #text>=1024*1024 then write({error='History exceeds capacity'},400);return end
 local p='/etc/router-node-health/history.json';if not fs.writefile(p..'.new',text)then write({error='Checkpoint failed'},500);return end;fs.chmod(p..'.new','600');fs.rename(p..'.new',p);write({ok=true,message='历史已保存到路由器存储；自动检查点最多每小时一次。'})
end
function probe()
 if not writable()then return end
 local name=require('luci.http').formvalue('node');local db=read();if not name or not db.nodes[name] or db.nodes[name].removed then write({error='Unknown node'},400);return end
 local fs=require 'nixio.fs';local path='/var/run/router-node-health/probe';fs.writefile(path..'.new',require('luci.jsonc').stringify({node=name,time=os.time()}));fs.chmod(path..'.new','600');fs.rename(path..'.new',path);write({ok=true,message='已排入检测队列；结果会自动刷新。'})
end
function configure()
 if not writable()then return end
 local h,json,u=require 'luci.http',require 'luci.jsonc',require('luci.model.uci').cursor();local raw=h.formvalue('config')or '';if #raw>8192 then write({error='Configuration too large'},400);return end
 local d=json.parse(raw);if type(d)~='table' then write({error='Invalid JSON'},400);return end
 local allow={enabled=1,interval=1,timeout=1,max_nodes=1,keep_samples=1,persistent=1,api_port=1,api_secret=1,use_openclash=1,targets=1}
 for k,v in pairs(d)do if not allow[k] or k~='targets' and type(v)~='string' then write({error='Invalid configuration key or type'},400);return end end
 for _,k in ipairs({'enabled','persistent','use_openclash'})do if d[k]~=nil and d[k]~='0' and d[k]~='1'then write({error='Invalid switch'},400);return end end
 if d.api_secret and (#d.api_secret>1024 or d.api_secret:find('[\r\n%z]'))then write({error='Invalid API credential'},400);return end
 for k,bounds in pairs({interval={30,3600},timeout={500,10000},max_nodes={1,64},keep_samples={30,360},api_port={1,65535}})do if d[k]~=nil then local n=tonumber(d[k]);if not d[k]:match('^%d+$')or not n or n%1~=0 or n<bounds[1] or n>bounds[2]then write({error=k..' out of range'},400);return end end end
 if d.targets~=nil then
  if type(d.targets)~='table' or #d.targets<1 or #d.targets>2 then write({error='One or two HTTPS test targets required'},400);return end
  for k,url in pairs(d.targets)do if type(k)~='number' or k<1 or k>#d.targets or type(url)~='string' or #url>512 or not url:match('^https://[%w%.%-]+/[^%s]*$')or url:find('[@#%z]')then write({error='Invalid HTTPS test URL'},400);return end end
 end
 u:section('router_node_health','monitor','main');for k,v in pairs(d)do if type(v)=='table'then u:set_list('router_node_health','main',k,v)else u:set('router_node_health','main',k,v)end end;u:commit('router_node_health')
 local s=require 'luci.sys';s.call('/etc/init.d/router-node-health enable; /etc/init.d/router-node-health restart >/dev/null 2>&1');write({ok=true,message='节点监控设置已保存；检测结果只描述选定目标的实际探测。'})
end
