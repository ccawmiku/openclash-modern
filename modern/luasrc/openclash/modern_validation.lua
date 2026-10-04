-- Additional strict checks for fields whose upstream validators accept free text.
local M = {}
local numeric = { log_size=true, test_interval=true, provider_interval=true, health_check_interval=true,
    hop_interval=true, wg_mtu=true, masque_mtu=true, heartbeat_interval=true, request_timeout=true,
    max_udp_relay_packet_size=true, max_open_streams=true, smart_collect_size=true,
    lgbm_update_interval=true, idle_session_check_interval=true, idle_session_timeout=true,
    min_idle_session=true, multiplex_max_connections=true, multiplex_min_streams=true,
    multiplex_max_streams=true, routing_mark=true, alterId=true }
local yaml = { custom_fallback_fil=true, custom_domain_dns_core=true, custom_proxy_server_dns_policy=true,
    custom_hosts=true, sniffer_custom=true, custom_rules=true, custom_rules_2=true, other_parameters=true }
function M.yaml(value)
    if #value > 2 * 1024 * 1024 or value:find('%z') then return false end
    local nixio=require 'nixio'
    -- Anonymous RAM file as stdin; YAML never appears in process arguments and
    -- large files do not hit the kernel's per-argument size limit.
    local fd=nixio.mkstemp('/tmp/oc-yaml-XXXXXX');if not fd then return false end
    local offset=1;while offset<=#value do local n=fd:write(value:sub(offset));if not n or n<=0 then fd:close();return false end;offset=offset+n end
    fd:seek(0,'set');local pid=nixio.fork()
    if pid==0 then
        nixio.dup(fd,nixio.stdin);fd:close();local null=nixio.open('/dev/null','w')
        if null then nixio.dup(null,nixio.stdout);nixio.dup(null,nixio.stderr);null:close()end
        nixio.exec('/usr/bin/ruby','/usr/share/openclash-modern/validate_yaml.rb');os.exit(1)
    end
    fd:close();if not pid then return false end
    local _,reason,code=nixio.waitpid(pid);return reason=='exited' and code==0
end
function M.check(field, value)
    if value == nil or value == '' then return nil end
    local option, dt = field.option, require 'luci.cbi.datatypes'
    if type(value) == 'table' then
        for _, item in ipairs(value) do local error = M.check(field, item); if error then return error end end
        return nil
    end
    if value:find('%z') then return '不能包含 NUL 字符' end
    if #value > 2 * 1024 * 1024 then return '单项内容不能超过 2 MiB' end
    if numeric[option] and not value:match('^%d+$') then return '请输入非负整数' end
    if option == 'smart_collect_rate' and (not tonumber(value) or tonumber(value) < 0 or tonumber(value) > 1) then return '采样率必须在 0 到 1 之间' end
    if option == 'uuid' or option == 'tc_uuid' then
        if not value:match('^%x%x%x%x%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%x%x%x%x%x%x%x%x$') then return 'UUID 格式应为 8-4-4-4-12 位十六进制' end
    end
    if option == 'fakeip_range' and value ~= '0' and not dt.cidr4(value) then return '请输入合法的 IPv4 CIDR，或 0 保留原配置' end
    if option == 'fakeip_range6' and value ~= '0' and not dt.cidr6(value) then return '请输入合法的 IPv6 CIDR，或 0 关闭' end
    if option == 'reality_short_id' and (not value:match('^%x+$') or #value > 16 or #value % 2 ~= 0) then return 'short-id 只能是偶数位十六进制，最长 16 位' end
    if option=='config_age_secret'and (#value>4096 or not value:match('^AGE%-SECRET%-KEY%-[A-Z0-9%-]+$'))then return 'Age 私钥格式不正确'end
    if option=='config_age_public'and (#value>4096 or not value:match('^age[%w%-]+$'))then return 'Age 公钥格式不正确'end
    if option == 'provider_url' or option == 'test_url' or option == 'health_check_url' or option == 'custom_template_url' or option:match('_custom_url$') then
        if not value:match('^https?://[^/%s]+') then return '请输入完整的 http:// 或 https:// URL' end
    end
    if yaml[option] then
        if not M.yaml(value) then return 'YAML 语法无效，请检查缩进、重复键、引号和列表格式' end
    end
    return nil
end
return M
