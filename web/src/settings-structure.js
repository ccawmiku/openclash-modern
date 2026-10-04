import {customTemplates} from './widget-registry.js'
export const isReadOnlyStatus=field=>field.template==='cbi/dvalue'&&!customTemplates.includes(field.originalTemplate)
export function categoryFor(field, model, sectionType) {
 if(model==='servers')return ({groups:'proxy-groups',servers:'proxy-nodes','proxy-provider':'proxy-providers',table:'node-actions'})[sectionType]||'node-actions'
 if (model === 'settings') {
  if (['authentication','lan_ac_traffic'].includes(sectionType)) return 'access'
  return ({ op_mode:'traffic', traffic_control:'traffic', ipv6:'traffic', dns:'dns', lan_ac:'access', stream_enhance:'stream', dashboard:'dashboard', rules_update:'resources', geo_update:'resources', chnr_update:'resources', auto_restart:'maintenance', debug:'maintenance', developer:'maintenance', version_update:'maintenance' })[field.tab] || 'traffic'
 }
 if (model === 'config-overwrite') return sectionType === 'dns_servers' ? 'dns' : ({settings:'general', meta:'general', dns:'dns', rules:'rules', smart:'smart'})[field.tab] || 'general'
 if (model === 'servers-config') {
  const key = field.option
  if (/tls|sni|servername|alpn|reality|fingerprint|cert|_ca/.test(key)) return 'tls'
  if (/quic|hysteria|recv_window|receive_window|hop_|udp|tc_|heartbeat|max_open_streams|request_timeout/.test(key)) return 'udp'
  if (/obfs|_path|_host|headers|transport|grpc|vless_|mux|multiplex|early_data/.test(key)) return 'transport'
  if (/name|config|type|^server$|^port$|password|uuid|key|token|cipher|security|auth/.test(key)) return 'general'
  return 'advanced'
 }
 return 'general'
}
export const categoryNames = {traffic:'运行与接管', dns:'DNS 解析', access:'设备与访问', stream:'服务解锁', resources:'资源更新', dashboard:'面板与控制', maintenance:'维护工具',general:'基础配置',rules:'规则',smart:'Smart 策略',tls:'TLS 与身份',udp:'UDP / QUIC',transport:'传输层',advanced:'高级参数','proxy-groups':'策略组','proxy-nodes':'代理节点','proxy-providers':'节点来源（Provider）','node-actions':'导入与批量操作'}
export const sectionLabel=group=>({groups:'策略组',servers:'代理节点','proxy-provider':'节点来源（Provider）',dns_servers:'DNS 上游',config_subscribe:'配置订阅',authentication:'代理认证',lan_ac_traffic:'设备访问规则'})[group.type]||group.title||group.type
export function topicFor(field, model, type) {
 if(type==='dns_servers')return 'dns-upstreams'
 if(type==='authentication')return 'credentials'
 if(type==='lan_ac_traffic')return 'device-rules'
 const key=field.option||''
 if(model==='config-overwrite'&&field.tab==='dns') {
  if(/fakeip|fake_filter|store_fake/.test(key))return 'fake-ip'
  if(/fallback/.test(key))return 'dns-fallback'
  if(/policy|domain_dns_core|proxy_server_dns/.test(key))return 'dns-policy'
  if(/hosts|custom_host/.test(key))return 'dns-hosts'
  return 'dns-behavior'
 }
 if(model==='config-overwrite'&&field.tab==='meta')return /sniff/.test(key)?'sniffing':'core-options'
 if(model==='config-overwrite')return /_port$/.test(key)?'listeners':'general-options'
 if(model==='config-subscribe')return type==='config_subscribe'?'subscriptions':'schedule'
 if(model==='custom-dns-edit')return /ip$|^port$|^type$|^group$/.test(key)?'resolver-address':/interface|specific_group|direct_nameserver|node_resolve/.test(key)?'resolver-route':'resolver-advanced'
 return field.tab||'general-options'
}
export const topicNames={'dns-upstreams':'上游服务器','credentials':'代理入口认证','device-rules':'设备访问规则','fake-ip':'Fake-IP 与过滤','dns-fallback':'备用解析过滤','dns-policy':'按域名分配 DNS','dns-hosts':'静态 Hosts','dns-behavior':'解析行为','sniffing':'域名嗅探','core-options':'内核行为','listeners':'监听端口','general-options':'通用参数','subscriptions':'订阅来源','schedule':'自动更新计划','resolver-address':'地址与协议','resolver-route':'用途与出站','resolver-advanced':'加密与响应选项'}
export const dnsGroupNames={nameserver:'常规解析',fallback:'备用解析',default:'自举解析',direct:'直连域名解析',node:'节点域名解析'}
export function dnsRole(row,values){const get=key=>{const f=row.fields.find(f=>f.option===key);return f&&(values[f.id]??f.value)};return String(get('node_resolve'))==='1'?'node':String(get('direct_nameserver'))==='1'?'direct':row.dns_role||get('group')||'nameserver'}
export function isCommand(field){return field.template==='cbi/button'||['flush_dns_cache','flush_fakeip_cache','flush_smart_cache','flush_streaming_cache','dnsmasq_restart'].includes(field.option)}
export function fieldSummary(field,value){
 if(isCommand(field))return '点击执行'
 if(Array.isArray(value))return value.length?`${value.length} 项 · ${value.slice(0,2).join('、')}`:/interface|ifname/.test(field.option)?'自动选择接口':'未设置条目'
 if(value==null||value==='')return /interface|ifname/.test(field.option)?'自动选择接口':'未设置'
 return String(value).split('\n')[0]
}
