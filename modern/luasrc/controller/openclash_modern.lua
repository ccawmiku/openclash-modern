module('luci.controller.openclash_modern', package.seeall)
local function native_call(name)
 local native=require 'luci.controller.openclash'
 if type(native[name])=='function' then return native[name]() end
 local http=require 'luci.http';http.status(501,'Unsupported by installed OpenClash');http.prepare_content('application/json')
 http.write_json({error='当前安装的 OpenClash 版本未提供此功能，请保留现有配置后按需升级上游插件。'})
end
local function writable()
    local disp = require 'luci.dispatcher'
    local result = require('luci.util').ubus('session', 'access', {
        ubus_rpc_session = disp.context.authsession, scope = 'uci', object = 'openclash', ['function'] = 'write'
    })
    if result and result.access then return true end
    require('luci.http').status(403, 'Write access required')
    return false
end
function index()
    if not require('nixio.fs').access('/etc/config/openclash') then return end
    local node = entry({'admin', 'services', 'openclash', 'modern'}, call('page'), _('Modern management'), 10)
    node.leaf = true
    node.acl_depends = { 'luci-app-openclash' }
    entry({'admin', 'services', 'openclash', 'modern_schema'}, call('schema')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_log'}, call('log')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_action'}, post('mutate')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_file_save'}, post('save_file')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_submit'}, post('submit')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_validate'}, post('validate')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_dashboard_info'}, call('dashboard_info')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_overwrite'}, post('overwrite')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_myip'}, call('myip')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_metrics'}, call('metrics')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_create_record'}, post('create_record')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_record_schema'}, call('record_schema')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_log_level'}, post('log_level')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_debug'}, post('debug')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_age'}, post('age')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_tools'}, post('tools')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_file_age'}, post('file_age')).leaf = true
    entry({'admin', 'services', 'openclash', 'modern_file_age_info'}, call('file_age_info')).leaf = true
end
function metrics()
 local h=require 'luci.http';h.prepare_content('application/json');h.header('Cache-Control','no-store');h.write_json(require('luci.openclash.modern_metrics').read())
end
function record_schema()
 local h=require 'luci.http';h.prepare_content('application/json');h.header('Cache-Control','no-store')
 local model,typ=h.formvalue('model'),h.formvalue('record_type')
 if not ({settings=true,['config-overwrite']=true,['config-subscribe']=true,servers=true})[model]then h.status(400,'Invalid model');h.write_json({error='不支持的设置类别'});return end
 local ok,data=pcall(require('luci.openclash.modern_schema').record_schema,model,typ)
 if not ok then h.status(400,'Invalid record');h.write_json({error=tostring(data)});return end;h.write_json(data)
end
function create_record()
 if not writable()then return end
 local h=require 'luci.http';local j=require 'luci.jsonc';local raw=h.formvalue('record')or ''
 h.prepare_content('application/json');h.header('Cache-Control','no-store')
 if #raw>65536 then h.status(400,'Too large');h.write_json({error='记录过大'});return end
 local ok,result=pcall(require('luci.openclash.modern_schema').create_record,h.formvalue('model'),h.formvalue('record_type'),j.parse(raw))
 if not ok then h.status(400,'Invalid record');h.write_json({error=tostring(result)});return end
 h.write_json(result)
end
local function safe_name(n)return type(n)=='string'and #n>0 and #n<=128 and n:match('^[%w_.%-]+$')and n~='.'and n~='..'end
function file_age_info()
 local h=require 'luci.http';local name=h.formvalue('name');h.prepare_content('application/json');h.header('Cache-Control','no-store')
 if not safe_name(name)then h.status(400,'Invalid filename');h.write_json({error='Invalid filename'});return end
 local result={};require('luci.model.uci').cursor():foreach('openclash','config_age_secret',function(s)if s.name==name then result={secret=s.secret or '',public=s.public or '',algo=s.algo or 'keygen'}end end);h.write_json(result)
end
function file_age()
 if not writable()then return end
 local h=require 'luci.http';local name=h.formvalue('name');local secret=h.formvalue('age_secret')or '';local public=h.formvalue('age_public')or '';local algo=h.formvalue('age_algo')or ''
 if not safe_name(name)or #secret>4096 or secret~=''and not secret:match('^AGE%-SECRET%-KEY%-[A-Z0-9%-]+$')or #public>4096 or public~=''and not public:match('^age[%w%-]+$')or algo~=''and algo~='keygen'and algo~='pq'then
  h.status(400,'Invalid Age config');h.prepare_content('application/json');h.write_json({error='Invalid name, key or algorithm'});return
 end
 return native_call('action_add_age_config')
end
function tools()
 if not writable()then return end
 local h=require 'luci.http';local op=h.formvalue('operation');local native=require 'luci.controller.openclash'
 local simple={flush_dns_cache='action_flush_dns_cache',close_all_connection='action_close_all_connection',reload_firewall='action_reload_firewall',del_log='action_del_log',del_start_log='action_del_start_log',generate_pac='action_generate_pac'}
 if simple[op]then return native[simple[op]]()end
 if op=='switch_rule_mode'and ({rule=1,global=1,direct=1})[h.formvalue('rule_mode')]then return native.action_switch_rule_mode()end
 if op=='switch_run_mode'and ({['']=1,['-tun']=1,['-mix']=1})[h.formvalue('run_mode')]then return native.action_switch_run_mode()end
 if op=='website_check'then local domain=h.formvalue('domain')or '';if #domain<=253 and domain:match('^[%w][%w%.%-]*[%w]$')and not domain:find('..',1,true)then return native.action_website_check()end end
 h.status(400,'Invalid operation');h.prepare_content('application/json');h.write_json({error='Invalid operation or parameter'})
end
function age()
 if not writable()then return end
 local h=require 'luci.http';local operation=h.formvalue('operation');local secret=h.formvalue('secret')or '';local algo=h.formvalue('algo')or 'keygen'
 if operation=='generate'and (algo=='keygen'or algo=='pq')then return native_call('action_generate_age_key')end
 if operation=='convert'and #secret<=4096 and secret:match('^AGE%-SECRET%-KEY%-[A-Z0-9%-]+$')then return native_call('action_cal_age_public_key')end
 h.status(400,'Invalid Age input');h.prepare_content('application/json');h.write_json({error='Invalid Age operation, algorithm or private key'})
end
function log_level()
 if not writable()then return end
 local h=require 'luci.http';local value=h.formvalue('log_level');local levels={info=1,warning=1,error=1,debug=1,silent=1}
 if not levels[value]then h.status(400,'Invalid level');h.prepare_content('application/json');h.write_json({error='Invalid log level'});return end
 return native_call('action_switch_log')
end
function debug()if writable()then return native_call('action_gen_debug_logs')end end
function myip()
 local h,sys,util=require 'luci.http',require 'luci.sys',require 'luci.util'
 local endpoints={ipify='https://api.ipify.org/?format=json',ipsb='https://api.ip.sb/geoip',pcol='https://whois.pconline.com.cn/ipJson.jsp?json=true',ipip='https://myip.ipip.net/'}
 local name=h.formvalue('provider')or 'ipify';local url=endpoints[name]
 h.prepare_content('application/json');h.header('Cache-Control','no-store')
 if not url then h.status(400,'Invalid provider');h.write_json({error='Unknown provider'});return end
 local out=sys.exec("curl --noproxy '*' --proto '=https' --proto-redir '=https' -fsSL -m 6 --max-filesize 32768 "..util.shellquote(url)..' 2>/dev/null')
 h.write_json(out~='' and {provider=name,content=out:sub(1,32768)}or {error='出口查询失败；未关闭证书验证或回退 HTTP'})
end
function overwrite()
 if not writable()then return end
 local h=require 'luci.http';local function fail(text)h.status(400,'Invalid input');h.prepare_content('application/json');h.write_json({error=text})end
 local op=h.formvalue('operation');local name=h.formvalue('filename')or '';local old=h.formvalue('old_filename')or ''
 local function safe(n)return #n<=128 and n:match('^[%w_.%-]+$') and n~='.' and n~='..' end
 if not safe(name) or old~='' and not safe(old) then return fail('Invalid filename')end
 if op=='delete'then return native_call('delete_overwrite_file')end
 if op~='save' and op~='upload'then return fail('Invalid operation')end
 local order=tonumber(h.formvalue('order')or '0');if not order or order%1~=0 or order<0 or order>65535 then return fail('Order must be 0–65535')end
 local typ=h.formvalue('type');if typ~='http' and typ~='file'then return fail('Invalid source type')end
 local enable=h.formvalue('enable');if enable~='0' and enable~='1'then return fail('Invalid switch')end
 local days=h.formvalue('update_days')or '';if days~='' and days~='*'then if days:find('[^0-6,]')or days:find(',,',1,true)or days:sub(1,1)==','or days:sub(-1)==','then return fail('Invalid weekday')end end
 local hour=h.formvalue('update_hour')or '';if hour~='' and hour~='*'then local n=tonumber(hour);if not n or n%1~=0 or n<0 or n>23 then return fail('Invalid hour')end end
 local param=h.formvalue('param')or '';if #param>4096 or param:find('%z')then return fail('Invalid script parameter')end
 local url=h.formvalue('url')or '';if typ=='http'and (#url>4096 or not url:match('^https?://[^/%s]+')or url:find('[%s|%z]')or url:find('://[^/]*@'))then return fail('Invalid subscription URL')end
 if op=='upload'then local content=h.formvalue('config_file')or '';if #content==0 or #content>10*1024*1024 or content:find('%z')then return fail('Invalid file size or binary content')end
  if name:match('%.ya?ml$')and not require('luci.openclash.modern_validation').yaml(content)then return fail('Invalid YAML; nothing saved')end
  return native_call('action_upload_overwrite')
 end
 return native_call('action_overwrite_subscribe_info')
end
function dashboard_info()
    local http, uci = require 'luci.http', require('luci.model.uci').cursor()
    local port = tonumber(uci:get('openclash', 'config', 'dashboard_forward_port')) or tonumber(uci:get('openclash', 'config', 'cn_port')) or 9090
    if port<1 or port>65535 then port=9090 end
    local host=uci:get('openclash','config','dashboard_forward_domain')
    if not host or host=='' then host=(http.getenv('HTTP_HOST') or 'localhost'):gsub(':%d+$', '') end
    local protocol=uci:get('openclash','config','dashboard_forward_ssl')=='1' and 'https' or 'http'
    local configured = uci:get('openclash', 'config', 'modern_dashboard_url')
    http.prepare_content('application/json'); http.header('Cache-Control','no-store')
    local default=protocol..'://'..host..':'..port..'/ui/metacubexd/#/setup?hostname='..http.urlencode(host)..'&port='..port..'&'..protocol..'=true'
    local native=require 'luci.controller.openclash'
    http.write_json({url = configured or default, capabilities={age=type(native.action_add_age_config)=='function' and type(native.action_generate_age_key)=='function'}})
end
function submit(validate_only)
    if not writable() then return end
    local http = require 'luci.http'
    local adapter = require 'luci.openclash.modern_schema'
    local model, section = http.formvalue('model'), http.formvalue('section')
    if not adapter.models[model] or (section and not section:match('^[%w_%-]+$')) then http.status(400, 'Invalid model or section'); return end
    local ok, result, attachment = pcall(adapter.submit, model, section and {section} or {}, validate_only)
    if attachment then return end
    http.prepare_content('application/json')
    http.header('Cache-Control', 'no-store')
    if not ok then http.status(500, 'Configuration failed'); http.write_json({error = tostring(result)}); return end
    http.write_json(result)
end
function validate() return submit(true) end
function mutate()
    if not writable() then return end
    local http = require 'luci.http'
    local action = http.formvalue('action')
    if action ~= 'start' and action ~= 'stop' and action ~= 'restart' then http.status(400, 'Invalid action'); return end
    return native_call('action_oc_action')
end
function save_file()
    if not writable() then return end
    local http = require 'luci.http'
    if not require('luci.openclash.modern_validation').yaml(http.formvalue('content') or '') then
        http.status(400, 'Invalid YAML'); http.prepare_content('application/json')
        http.write_json({status = 'error', message = 'YAML 语法无效，文件未保存'}); return
    end
    return native_call('action_config_file_save')
end
function page()
    local http = require 'luci.http'
    local fs = require 'nixio.fs'
    local disp = require 'luci.dispatcher'
    local manifest = require('luci.jsonc').parse(fs.readfile('/www/luci-static/openclash-modern/.vite/manifest.json') or '{}')
    local asset = manifest['index.html']
    if not asset then http.status(503, 'Frontend not built'); http.write('Build the modern frontend first.'); return end
    http.header('Cache-Control', 'no-store')
    require('luci.template').render('openclash/modern', {
        modern_js = asset.file, modern_css = (asset.css or {})[1],
        modern_base = disp.build_url('admin', 'services', 'openclash'),
        modern_token = disp.context.authtoken or ''
    })
end
function schema()
    local http = require 'luci.http'
    local adapter = require 'luci.openclash.modern_schema'
    local model = http.formvalue('model') or 'settings'
    if not adapter.models[model] then http.status(400, 'Invalid model'); return end
    local arg = http.formvalue('section')
    if arg and not arg:match('^[%w_%-]+$') then http.status(400, 'Invalid section'); return end
    local ok, result = pcall(adapter.read, model, arg and {arg} or {})
    http.prepare_content('application/json')
    http.header('Cache-Control', 'no-store')
    if not ok then http.status(500, 'Schema failed'); http.write_json({ error = tostring(result) }); return end
    http.write_json(result)
end
function log()
    local http = require 'luci.http'
    local cursor = http.formvalue('cursor')
    if cursor and #cursor > 160 then http.status(400, 'Invalid cursor'); return end
    local function open(path)
        local fd = require('nixio').open(path, 'r')
        if not fd then return nil end
        return {
            read = function(_, count)
                local chunks, remaining = {}, count
                while remaining > 0 do
                    local data = fd:read(math.min(8192, remaining))
                    if not data or data == '' then break end
                    chunks[#chunks + 1] = data
                    remaining = remaining - #data
                end
                return table.concat(chunks)
            end,
            seek = function(_, whence, offset) return fd:seek(offset or 0, whence) end,
            stat = function() return fd:stat() end,
            close = function() return fd:close() end
        }
    end
    local result = require('luci.openclash.log_cursor').read('/tmp/openclash.log', cursor, require('nixio.fs').stat, open)
    if http.formvalue('translate')=='1' and result.text~='' then
        local transform=require('luci.controller.openclash').trans_line;local lines={}
        for line in result.text:gmatch('[^\n]+')do lines[#lines+1]=transform(line)end
        result.display_text=table.concat(lines,'\n')
    end
    http.prepare_content('application/json')
    http.header('Cache-Control', 'no-store')
    http.write_json(result)
end
