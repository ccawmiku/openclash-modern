-- Read existing CBI models, preserving original validators and write handlers.
local M = {}
local function native_load(model,args)
 local http=require 'luci.http';local formvalue,redirect=http.formvalue,http.redirect
 -- Older OpenClash models require an explicit profile context. Newer models
 -- derive it internally; supplying the active profile preserves both versions.
 http.formvalue=function(key,...)
  local value=formvalue(key,...)
  if key=='file' and (not value or value=='') then return require('luci.model.uci').cursor():get('openclash','config','config_path') end
  return value
 end
 http.redirect=function()end
 local ok,maps=pcall(require('luci.cbi').load,'openclash/'..model,unpack(args or {}))
 http.formvalue,http.redirect=formvalue,redirect
 return ok,maps
end
M.models = {
    settings = true, ['config-overwrite'] = true, ['config-subscribe'] = true,
    servers = true, ['custom-dns-edit'] = true, config = true, client = true, log = true,
    ['proxy-provider-file-manage'] = true, ['rule-providers-file-manage'] = true,
    ['other-file-edit'] = true, ['config-subscribe-edit'] = true,
    ['servers-config'] = true, ['groups-config'] = true, ['proxy-provider-config'] = true
}
local function plain(value)
    if type(value) == 'string' then return value:gsub('<[bB][rR]%s*/?>', '\n'):gsub('</[pP]>', '\n'):gsub('<[^>]*>', ''):gsub('&nbsp;', ' '):gsub('&amp;', '&') end
    return type(value) == 'number' and tostring(value) or ''
end
local function section_ids(section)
    if section.cfgsections then return section:cfgsections() end
    if require('luci.util').instanceof(section, require('luci.cbi').NamedSection) then
        return {section.section}
    end
    return {1} -- SimpleSection and button tables use their synthetic row id.
end
function M.read(model, args)
    assert(M.models[model], 'Unsupported model')
    local http = require 'luci.http'
    local previous_write = http.write
    http.write = function() end -- Some upstream model constructors emit UI script.
    local ok, maps = native_load(model,args)
    http.write = previous_write
    if not ok then error(maps) end
    local out = { model = model, maps = {}, unsupported = {}, templates = {}, context = {config_file=require('luci.model.uci').cursor():get('openclash','config','config_path')} }
    if model == 'settings' then
        local cursor = require('luci.model.uci').cursor()
        for _, key in ipairs({'core_version', 'release_branch', 'smart_enable', 'github_address_mod'}) do
            out.context[key] = cursor:get('openclash', 'config', key) or ''
        end
    end
    local cbi = require 'luci.cbi'
    local function kind(field)
        local known = { ['cbi/value'] = true, ['cbi/lvalue'] = true, ['cbi/fvalue'] = true,
            ['cbi/dynlist'] = true, ['cbi/tvalue'] = true, ['cbi/mvalue'] = true,
            ['cbi/dvalue'] = true, ['cbi/button'] = true }
        if known[field.template] then return field.template end
        local classes = { {'Button', 'cbi/button'}, {'DummyValue', 'cbi/dvalue'},
            {'Flag', 'cbi/fvalue'}, {'DynamicList', 'cbi/dynlist'}, {'MultiValue', 'cbi/mvalue'},
            {'ListValue', 'cbi/lvalue'}, {'TextValue', 'cbi/tvalue'}, {'FileUpload', 'cbi/upload'}, {'Value', 'cbi/value'} }
        for _, pair in ipairs(classes) do
            if cbi[pair[1]] and require('luci.util').instanceof(field, cbi[pair[1]]) then return pair[2] end
        end
        return 'unsupported'
    end
    for _, map in ipairs(maps) do
        local item = { title = plain(map.title), description = plain(map.description), config = map.config, sections = {} }
        for _, section in ipairs(map.children or {}) do
            if section.cfgsections or #(section.children or {}) > 0 then
                local group = { type = section.sectiontype, title = plain(section.title),
                    addremove = section.addremove == true, anonymous = section.anonymous == true,
                    sortable = section.sortable == true, extedit = section.extedit,
                    description = plain(section.description), tabs = {}, rows = {} }
                local field_tabs = {}
                for _, name in ipairs(section.tab_names or {}) do
                    local tab = section.tabs[name]
                    if name ~= 'oixcloud' then group.tabs[#group.tabs + 1] = { name = name, title = plain(tab.title) } end
                    for _, field in ipairs(tab.childs or {}) do field_tabs[field] = name end
                end
                local sids = section_ids(section)
                if group.addremove then sids[#sids+1]='__modern_draft__' end
                for _, sid in ipairs(sids or {}) do
                    local row = { id = sid, fields = {} }
                    if group.type=='dns_servers'and sid~='__modern_draft__'then row.dns_role=map.uci:get(map.config,sid,'node_resolve')=='1'and 'node'or map.uci:get(map.config,sid,'direct_nameserver')=='1'and 'direct'or map.uci:get(map.config,sid,'group')or 'nameserver'end
                    for _, field in ipairs(section.children or {}) do
                        if field.cbid and field.template ~= 'openclash/oix_login' then
                            -- A few upstream ListValues populate choices in render(), not their constructor.
                            if kind(field) == 'cbi/lvalue' or field.template == 'openclash/input_rename' then
                                -- Stop at template lookup, after an upstream override populates choices.
                                -- Template writers may bypass http.write, so never render legacy HTML here.
                                local template = field.template
                                field.template = 'openclash/__modern_schema_no_render'
                                pcall(field.render, field, sid, {})
                                field.template = template
                            end
                            local success, value = true, nil
                            if sid~='__modern_draft__' then success,value=pcall(field.cfgvalue,field,sid) end
                            if not success then value = nil end
                            local choices = {}
                            for i, key in ipairs(field.keylist or {}) do
                                choices[#choices + 1] = { value = key, label = plain((field.vallist or {})[i] or key) }
                            end
                            local f = { id = field:cbid(sid), option = field.option, section_type=section.sectiontype,
                                label = plain(field.title and field.title ~= '' and field.title or field.option),
                                description = plain(field.description), template = field.template,
                                kind = kind(field), tab = field_tabs[field], value = value or field.default or '',
                                choices = choices, deps = field.deps or {}, password = field.password == true,
                                enabled = field.enabled or '1', disabled = field.disabled or '0',
                                button = plain(field.inputtitle or field.title), readonly = field.readonly == true,
                                widget_value = field.value, file_path = field.file_path,
                                optional = field.rmempty ~= false, default = field.default, placeholder = field.placeholder,
                                datatype = type(field.datatype) == 'string' and field.datatype or nil }
                            if not success then f.kind = 'unsupported'; f.read_error = true end
                            row.fields[#row.fields + 1] = f
                            if field.template and not field.template:match('^cbi/') then
                                out.templates[#out.templates + 1] = { template = field.template, field = f.id }
                            end
                        end
                    end
                    if sid=='__modern_draft__' then group.prototype=row.fields else group.rows[#group.rows + 1] = row end
                end
                item.sections[#item.sections + 1] = group
            elseif section.template then
                out.templates[#out.templates + 1] = { template = section.template }
            end
        end
        out.maps[#out.maps + 1] = item
    end
    return out
end
-- Validate the complete draft before creating a UCI section. Native model fields
-- and create/write hooks remain the source of configuration behavior.
local details={dns_servers='custom-dns-edit',config_subscribe='config-subscribe-edit',servers='servers-config',groups='groups-config',['proxy-provider']='proxy-provider-config'}
local function draft_cursor(typ,payload)
 -- LuCI's ubus cursor can share pending state across requests. Overlay a
 -- virtual section instead of calling section()/set() on that real cursor.
 local real=require('luci.model.uci').cursor();local values={['.name']='modern_draft_record',['.type']=typ,['.anonymous']=true};local proxy={}
 setmetatable(proxy,{__index=function(_,key)local value=real[key];if type(value)=='function'then return function(_,...)return value(real,...)end end;return value end})
 for key,value in pairs(payload or {})do if type(key)=='string'and key:sub(1,1)~='.'then values[key]=value end end
 function proxy:get(config,sid,option)if config=='openclash'and sid=='modern_draft_record'then return option and values[option]or typ end;return real:get(config,sid,option)end
 function proxy:get_all(config,sid)if config=='openclash'and sid=='modern_draft_record'then return values end;return real:get_all(config,sid)end
 function proxy:set(config,sid,key,value)assert(config=='openclash'and sid=='modern_draft_record','草稿只能修改虚拟记录');values[key]=value;return true end
 function proxy:set_list(config,sid,key,value)return self:set(config,sid,key,value)end
 function proxy:save()error('草稿禁止保存')end
 function proxy:commit()error('草稿禁止提交')end
 function proxy:delete()error('草稿禁止删除')end
 function proxy:section()error('草稿禁止创建实际分组')end
 function proxy:add()error('草稿禁止创建实际分组')end
 function proxy:reorder()error('草稿禁止排序')end
 function proxy:apply()error('草稿禁止应用')end
 function proxy:revert()error('草稿禁止撤销实际配置')end
 return proxy
end
function M.record_schema(model,typ)
 local parent=M.read(model);local prototype
 for _,map in ipairs(parent.maps)do for _,group in ipairs(map.sections)do if group.type==typ and group.addremove then prototype=group.prototype end end end
 assert(prototype,'不支持的记录类型')
 if not details[typ]then return {fields=prototype}end
 local module=require 'luci.model.uci';local cursor=module.cursor;local u=draft_cursor(typ);module.cursor=function()return u end
 local ok,data=pcall(M.read,details[typ],{'modern_draft_record'});module.cursor=cursor
 if not ok then error(data)end
 local fields={};for _,map in ipairs(data.maps)do for _,group in ipairs(map.sections)do if group.type==typ then for _,f in ipairs(group.rows[1]and group.rows[1].fields or {})do if f.kind~='cbi/button'then fields[#fields+1]=f end end end end end
 for _,f in ipairs(prototype)do if f.option=='enabled'then fields[#fields+1]=f end end
 return {fields=fields}
end
function M.create_record(model,typ,payload)
 local allowed={settings={lan_ac_traffic=true},['config-overwrite']={dns_servers=true,authentication=true},['config-subscribe']={config_subscribe=true},servers={servers=true,groups=true,['proxy-provider']=true}}
 assert(allowed[model]and allowed[model][typ]and type(payload)=='table','不支持的记录类型')
 local h,cbi,util=require 'luci.http',require 'luci.cbi',require 'luci.util';local oldwrite,oldredirect=h.write,h.redirect;local target
 h.write=function()end;h.redirect=function(url)target=url end
 local ok,result=pcall(function()
  local maps=cbi.load('openclash/'..model);local map,section
  for _,m in ipairs(maps)do for _,s in ipairs(m.children or {})do if s.sectiontype==typ and s.addremove then map,section=m,s end end end
  assert(section,'找不到记录定义');local fields={};for _,f in ipairs(section.children or {})do fields[f.option]=f end
  if details[typ]then
   local module=require 'luci.model.uci';local oldcursor=module.cursor;local u=draft_cursor(typ,payload);module.cursor=function()return u end
   local loaded,detailmaps=pcall(cbi.load,'openclash/'..details[typ],'modern_draft_record');module.cursor=oldcursor;assert(loaded,'读取详情定义失败')
   for _,m in ipairs(detailmaps)do for _,s in ipairs(m.children or {})do if s.sectiontype==typ then for _,f in ipairs(s.children or {})do fields[f.option]=f end end end end
  end
  local required=({dns_servers={'ip'},authentication={'username','password'},config_subscribe={'name','address'},servers={'name','type','server','port'},groups={'name','type'},['proxy-provider']={'name','type'}})[typ]or {}
  for _,key in ipairs(required)do assert(type(payload[key])=='string'and payload[key]~='','请填写 '..key)end
  if typ=='proxy-provider' then assert(payload.type~='http'or type(payload.provider_url)=='string'and payload.provider_url~='','请填写订阅地址')end
  local clean={}
  for key,f in pairs(fields)do
   if payload[key]==nil and not f.readonly and not util.instanceof(f,cbi.DummyValue)and not util.instanceof(f,cbi.Button)then
    if f.default~=nil and type(f.default)~='function'then payload[key]=type(f.default)=='table'and f.default or tostring(f.default)
    elseif util.instanceof(f,cbi.Flag)then payload[key]=key=='enabled'and f.enabled or f.disabled end
   end
  end
  local function active(f)
   if #(f.deps or {})==0 then return true end
   for _,rule in ipairs(f.deps)do local count,matched=0,0
    for key,expected in pairs(rule)do if key:sub(1,1)~='!'then count=count+1;local option=key:match('([^.]+)$');local value=payload[option]or (fields[option]and fields[option].default);if tostring(value or '')==tostring(expected)then matched=matched+1 end end end
    local valid=rule['!or']and matched>0 or matched==count;if rule['!reverse']then valid=not valid end;if valid then return true end
   end;return false
  end
  for key in pairs(payload)do if fields[key]and not active(fields[key])then payload[key]=nil end end
  for key,f in pairs(fields)do
   if f.rmempty==false and not f.readonly and not util.instanceof(f,cbi.Flag)and not util.instanceof(f,cbi.DummyValue)and not util.instanceof(f,cbi.Button)and active(f)then
    local value=payload[key]or f.default;assert(value~=nil and value~=''and (type(value)~='table'or #value>0),'请填写 '..key)
   end
  end
  for key,value in pairs(payload)do
   assert(type(key)=='string'and fields[key]and (type(value)=='string'or type(value)=='table'),'未知字段或数据类型')
   local f=fields[key]
   assert(not util.instanceof(f,cbi.Button),'操作不能作为记录参数')
   if key=='name'and util.instanceof(f,cbi.DummyValue)then assert(#value<=128 and value:match('^[%w_%-%.]+$')and value~='.'and value~='..','名称只能包含字母、数字、点、下划线或连字符');clean[key]=value
   else
    assert(not util.instanceof(f,cbi.DummyValue)and not f.readonly,'只读字段不能写入')
    if util.instanceof(f,cbi.ListValue)then local template=f.template;f.template='openclash/__modern_schema_no_render';pcall(f.render,f,'__modern_draft__',{});f.template=template end
    local valid,message=f:validate(value,'modern_draft_record');local strict=require('luci.openclash.modern_validation').check(f,value)
    assert(valid~=nil and valid~=false and not strict,strict or message or '参数无效')
    if util.instanceof(f,cbi.Flag)then assert(value==f.enabled or value==f.disabled,'开关值无效')end
    clean[key]=valid
   end
  end
  if typ=='dns_servers'then assert(not payload.ip:find('[%s%z]')and not payload.ip:find('://',1,true),'地址不要包含协议前缀或空格')end
  -- Nothing above writes, creates or commits configuration.
  local before={};map.uci:foreach(map.config,typ,function(s)before[s['.name']]=true end)
  local sid=section:create(nil)
  if not sid then map.uci:foreach(map.config,typ,function(s)if not before[s['.name']]then sid=s['.name']end end)end
  assert(sid,'原生创建处理器未返回记录')
  -- Validation comes from the detailed model. Store into the native parent's
  -- cursor to avoid committing the temporary draft cursor used for metadata.
  local written,message=pcall(function()
   for key,value in pairs(clean)do local f=fields[key];f.map.uci=map.uci;if util.instanceof(f,cbi.DummyValue)then map.uci:set(map.config,sid,key,value)else f:write(sid,value)end end
   assert(map.uci:save(map.config),'保存失败');assert(map.uci:commit(map.config),'提交失败')
  end)
  if not written then map.uci:delete(map.config,sid);map.uci:save(map.config);error(message)end
  return {ok=true,section=sid,redirect=section.extedit and section.extedit:gsub('%%s',sid)or nil}
 end)
 h.write,h.redirect=oldwrite,oldredirect;if not ok then error(result)end;return result
end
-- Parse the unmodified CBI models, including their create/remove/sort and button hooks.
-- Redirects become navigation data so no old page is rendered after an operation.
function M.submit(model, args, validate_only)
    assert(M.models[model], 'Unsupported model')
    local http = require 'luci.http'
    local redirect, write, header = http.redirect, http.write, http.header
    local target, attachment
    http.redirect = function(url) target = target or url end
    http.write = function() end
    local ok, maps = native_load(model,args)
    http.write = write
    local errors, states = {}, {}
    http.header = function(name, value)
        if name:lower() == 'content-disposition' then attachment = true end
        return header(name, value)
    end
    if ok then
        ok, maps = pcall(function()
            local cbi, policy = require 'luci.cbi', require 'luci.openclash.modern_validation'
            local function active(field, sid)
                if #(field.deps or {}) == 0 then return true end
                for _, rule in ipairs(field.deps) do
                    local matches, total = 0, 0
                    for key, expected in pairs(rule) do
                        if key:sub(1, 1) ~= '!' then
                            total = total + 1
                            local id = key:find('.', 1, true) and 'cbid.' .. key or 'cbid.' .. field.config .. '.' .. sid .. '.' .. key
                            local actual = http.formvalue(id)
                            if actual == nil and http.formvalue('cbi.cbe.' .. id:sub(6)) then actual = '0' end
                            if actual == nil then actual = field.map:get(sid, key) end
                            if tostring(actual or '') == tostring(expected) then matches = matches + 1 end
                        end
                    end
                    local result = rule['!or'] and matches > 0 or matches == total
                    if rule['!reverse'] then result = not result end
                    if result then return true end
                end
                return false
            end
            for _, map in ipairs(maps) do
                map.readinput = true
                for _, section in ipairs(map.children or {}) do
                    local sids = section_ids(section)
                    for _, sid in ipairs(sids) do
                        if not http.formvalue('cbi.rts.' .. map.config .. '.' .. sid) then
                            for _, field in ipairs(section.children or {}) do
                                if field.cbid and not require('luci.util').instanceof(field, cbi.DummyValue)
                                    and not require('luci.util').instanceof(field, cbi.Button) and active(field, sid) and not field.readonly then
                                    if require('luci.util').instanceof(field, cbi.ListValue) then
                                        local template = field.template; field.template = 'openclash/__modern_schema_no_render'
                                        pcall(field.render, field, sid, {}); field.template = template
                                    end
                                    local value = field:formvalue(sid)
                                    if value and (type(value) == 'table' or #value > 0) then
                                        local valid, message = field:validate(value, sid)
                                        message = policy.check(field, value) or (not valid and (message or '格式或取值范围无效'))
                                        if require('luci.util').instanceof(field, cbi.Flag) and value ~= field.enabled and value ~= field.disabled then message = '开关值无效' end
                                        if message then errors[#errors + 1] = { field = field:cbid(sid), message = plain(message), label = plain(field.title or field.option) } end
                                    elseif field.rmempty == false and not require('luci.util').instanceof(field, cbi.Flag) then
                                        errors[#errors + 1] = { field = field:cbid(sid), message = '此项不能为空', label = plain(field.title or field.option) }
                                    end
                                end
                            end
                        end
                    end
                end
            end
            if validate_only or #errors > 0 then return end
            for _, map in ipairs(maps) do
                map.flow = {}
                local state = map:parse()
                states[#states + 1] = state
                for _, section in ipairs(map.children or {}) do
                    if section.err_invalid or section.invalid_cts then errors[#errors + 1] = '分组名称无效或已存在' end
                    for _, field in ipairs(section.children or {}) do
                        for sid, message in pairs(type(field.error) == 'table' and field.error or {}) do
                            errors[#errors + 1] = {field = field:cbid(sid), message = plain(message), label = plain(field.title or field.option)}
                        end
                    end
                end
                if state == require('luci.cbi').FORM_INVALID and #errors == 0 then errors[#errors + 1] = '配置未通过原生校验' end
            end
        end)
    end
    http.redirect, http.write, http.header = redirect, write, header
    if not ok then error(maps) end
    return { ok = #errors == 0, errors = errors, states = states, redirect = target }, attachment
end
return M
