import {datatypeValid} from './validation.js'
const switches=['monitor_enabled','dns_enabled','core_adapter','disable_offload']
export function privacyProblem(cfg){
 for(const key of switches)if(!['0','1'].includes(cfg[key]))return `${key} 只能为开或关`
 const interfaces=[cfg.wan_interface,...cfg.lan_interface];if(!cfg.lan_interface.length||interfaces.some(v=>typeof v!=='string'||v.length>32||!(/^[\w.:-]+$/.test(v))))return '填写实际接口名，最多 32 字符；LAN 至少一个接口'
 for(const key of ['resolver_ips','fallback_ips'])if(cfg[key].length>64||cfg[key].some(v=>!datatypeValid('ipaddr',v)))return '自举地址需为合法 IPv4 / IPv6，每行一个，最多 64 个'
 for(const key of ['resolver_url','fallback_url']){
  const url=cfg[key];if(!url){if(key==='resolver_url'&&cfg.dns_enabled==='1')return '开启加密 DNS 需要主解析端点';continue}
  const match=url.match(/^https:\/\/(\[[^\]]+\]|[\w.-]+)\/[^\s@#]*$/);if(!match||url.length>2048)return '端点需为完整 HTTPS URL，不能包含凭据、片段或自定义端口'
  const host=match[1].replace(/^\[|\]$/g,'');const ips=cfg[key==='resolver_url'?'resolver_ips':'fallback_ips'];if(!datatypeValid('ipaddr',host)&&(!datatypeValid('hostname',host)||!ips.length))return '域名端点必须配置固定自举 IP，不能使用明文 DNS 自举'
 }
 if(!/^\d+$/.test(cfg.dns_port)||!datatypeValid('range(1024,65535)',cfg.dns_port)||[53531,53532,53533].includes(Number(cfg.dns_port)))return '独立 DNS 端口需为 1024–65535 的整数，避开 53531 / 53532 / 53533'
 if(cfg.watch_domain.length>64||cfg.watch_domain.some(v=>!datatypeValid('hostname',v)))return '关注项填写合法域名，每行一个，最多 64 个'
 return ''
}
