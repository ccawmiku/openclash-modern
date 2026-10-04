const uint = v => /^\d+$/.test(v) && Number.isSafeInteger(Number(v))
const ipv4 = v => /^\d+\.\d+\.\d+\.\d+$/.test(v) && v.split('.').every(n => /^(0|[1-9]\d*)$/.test(n) && Number(n) <= 255)
const ipv6 = v => { try { return v.includes(':') && new URL(`http://[${v}]/`).hostname.startsWith('[') } catch { return false } }
const host = v => ipv4(v) || ipv6(v) || (v.length <= 253 && v.replace(/\.$/, '').split('.').every(n => /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9])?$/.test(n)))
function mask(v, version) {
  const [address, prefix, ...rest] = v.split('/'); if (rest.length) return false
  const ip = version === 4 ? ipv4(address) : version === 6 ? ipv6(address) : ipv4(address) || ipv6(address)
  if (!ip) return false
  if (prefix === undefined) return true
  if (uint(prefix)) return Number(prefix) <= (ipv4(address) ? 32 : 128)
  return ipv4(address) && ipv4(prefix) && /^1*0*$/.test(prefix.split('.').map(n => Number(n).toString(2).padStart(8, '0')).join(''))
}
function args(value) {
  const out = []; let depth = 0, start = 0
  for (let i = 0; i < value.length; i++) { if (value[i] === '(') depth++; else if (value[i] === ')') depth--; else if (value[i] === ',' && !depth) { out.push(value.slice(start, i).trim()); start = i + 1 } }
  out.push(value.slice(start).trim()); return out
}
export function datatypeValid(type, value) {
  const v = String(value ?? ''), match = type?.match(/^(\w+)\((.*)\)$/), name = match ? match[1] : type, parameters = match ? args(match[2]) : []
  switch (name) {
    case undefined: case 'string': return true
    case 'uinteger': return uint(v)
    case 'integer': return /^-?\d+$/.test(v) && Number.isSafeInteger(Number(v))
    case 'float': return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v) && Number.isFinite(Number(v))
    case 'port': return uint(v) && Number(v) <= 65535
    case 'portrange': { const p = v.split(/[:-]/); return p.length === 2 && p.every(n => datatypeValid('port', n)) && Number(p[0]) <= Number(p[1]) }
    case 'range': return datatypeValid('float', v) && Number(v) >= Number(parameters[0]) && Number(v) <= Number(parameters[1])
    case 'ip4addr': return ipv4(v)
    case 'ip6addr': return ipv6(v)
    case 'ipaddr': return ipv4(v) || ipv6(v)
    case 'ipmask': return mask(v)
    case 'cidr4': return v.includes('/') && mask(v, 4)
    case 'cidr6': return v.includes('/') && mask(v, 6)
    case 'host': case 'hostname': return host(v)
    case 'macaddr': return /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(v)
    case 'list': return v.split(/\s+/).every(n => datatypeValid(parameters[0], n))
    case 'or': return parameters.some(type => datatypeValid(type, v))
    case 'and': return parameters.every(type => datatypeValid(type, v))
    default: return true // Unknown future datatype is checked by the original server validator.
  }
}
export const numericOptions = new Set(['log_size','test_interval','provider_interval','health_check_interval','hop_interval','wg_mtu','masque_mtu','heartbeat_interval','request_timeout','max_udp_relay_packet_size','max_open_streams','smart_collect_size','lgbm_update_interval','idle_session_check_interval','idle_session_timeout','min_idle_session','multiplex_max_connections','multiplex_min_streams','multiplex_max_streams','routing_mark','alterId'])
export const yamlOptions = new Set(['custom_fallback_fil','custom_domain_dns_core','custom_proxy_server_dns_policy','custom_hosts','sniffer_custom','custom_rules','custom_rules_2','other_parameters'])
export function validateField(field, value) {
  if (field.readonly || ['cbi/dvalue','cbi/button','cbi/upload'].includes(field.template)) return ''
  if (value === '' || value == null || (Array.isArray(value) && !value.length)) return field.optional === false ? '此项不能为空' : ''
  const items = Array.isArray(value) ? value : [value]
  for (const item of items) {
    const v = String(item), option = field.option
    if (v.includes('\0')) return '不能包含 NUL 字符'
    if (new TextEncoder().encode(v).length > 2 * 1024 * 1024) return '单项内容不能超过 2 MiB'
    if (field.template === 'cbi/fvalue' && ![field.enabled, field.disabled].map(String).includes(v)) return '开关值无效'
    if (['cbi/lvalue','cbi/mvalue'].includes(field.template) && !field.choices.some(c => String(c.value) === v)) return '请从提供的选项中选择'
    if (!datatypeValid(field.datatype, v)) return `格式或范围不正确：${field.datatype}`
    if (numericOptions.has(option) && !uint(v)) return '请输入非负整数'
    if (option === 'smart_collect_rate' && (!datatypeValid('float', v) || Number(v) < 0 || Number(v) > 1)) return '采样率必须在 0 到 1 之间'
    if (['uuid','tc_uuid'].includes(option) && !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(v)) return 'UUID 应为 8-4-4-4-12 位十六进制'
    if (['fakeip_range','fakeip_range6'].includes(option) && v !== '0' && !datatypeValid(option === 'fakeip_range' ? 'cidr4' : 'cidr6', v)) return '请输入合法的 CIDR；0 是原有特殊值'
    if (option === 'reality_short_id' && (!/^[\da-f]+$/i.test(v) || v.length > 16 || v.length % 2)) return 'short-id 只能是偶数位十六进制，最长 16 位'
    if(option==='config_age_secret'&&(v.length>4096||!/^AGE-SECRET-KEY-[A-Z0-9-]+$/.test(v)))return 'Age 私钥格式不正确'
    if(option==='config_age_public'&&(v.length>4096||!/^age[\w-]+$/.test(v)))return 'Age 公钥格式不正确'
    if (['provider_url','test_url','health_check_url','custom_template_url'].includes(option) || option.endsWith('_custom_url')) {
      try { const u = new URL(v); if (!['http:','https:'].includes(u.protocol) || !u.hostname) return '请输入完整的 HTTP / HTTPS URL' } catch { return '请输入完整的 HTTP / HTTPS URL' }
    }
  }
  return ''
}
export async function validateYaml(text) {
  const { parseDocument } = await import('yaml')
  const doc = parseDocument(text, { uniqueKeys: true, strict: true }); if (doc.errors.length) return doc.errors[0].message
  return ''
}
