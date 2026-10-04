<script setup>
import {onMounted,reactive,ref} from 'vue'
import {base,preview,token} from '../api.js'
import {privacyProblem} from '../monitor-validation.js'
const props=defineProps({kind:String}),emit=defineEmits(['dirty','back'])
const privacy=props.kind==='privacy',root=base.replace(/openclash$/,privacy?'router_privacy':'router_node_health')
const form=reactive({}),loading=ref(true),busy=ref(false),error=ref(''),message=ref(''),secret=ref(''),clearSecret=ref(false)
const lists=privacy?['lan_interface','watch_domain','resolver_ips','fallback_ips']:['targets']
const toggles=privacy?[['dns_enabled','持续加密 DNS','代理关闭后继续保护；两家端点失效时禁止明文回退。'],['monitor_enabled','流量隐私观察','持续采集接口与连接元数据，不保存应用内容。'],['core_adapter','读取 Mihomo 规则与路径','使用标准连接 API 补充国内外判定和节点路径；API 不可用时显示未知。'],['disable_offload','完整监控模式','关闭软硬件流量卸载以提高覆盖；可能降低峰值转发速度。']]:[['enabled','持续节点监控','独立服务，网页关闭后继续探测；内核停止记为未知。'],['persistent','历史持久化','每小时最多保存一次检查点；关闭可减少闪存写入。'],['use_openclash','继承 OpenClash API 设置','仅连接本机标准 API，读取端口与凭据，不修改内核。']]
const fields=privacy?[['wan_interface','WAN 观察接口','auto 从系统读取；也可填写实际设备名，例如 pppoe-wan。','text'],['lan_interface','LAN 观察接口','每行一个实际设备名，至少一个，例如 br-lan。','list'],['resolver_url','主 DoH 端点','默认 https://223.5.5.5/dns-query；必须 HTTPS，保持证书校验。','text'],['resolver_ips','主端点固定自举 IP','IP 端点可留空；域名端点每行一个 IPv4 / IPv6，最多 64 个。','list'],['fallback_url','备用 DoH 端点','默认 https://doh.pub/dns-query；主端点失败时使用，留空只用主端点。','text'],['fallback_ips','备用端点固定自举 IP','腾讯默认 120.53.53.53 和 1.12.12.12；证书仍验证 doh.pub。','list'],['dns_port','独立 DNS 本地端口','1024–65535 的整数，避开 53531、53532、53533 以及已有服务。','number'],['watch_domain','特别关注的直连域名','每行一个域名，最多 64 个；自动匹配子域名，不用于国内外分类。','list']]:[['interval','每节点检测间隔（秒）','30–3600；默认 120，低性能路由器建议 120–300。顺序调度，节点多时实际间隔可能延长。','number'],['timeout','单目标超时（毫秒）','500–10000；默认 3000，失败再检测第二目标。','number'],['max_nodes','最多检测节点数','1–64；默认 32，超额明确提示。','number'],['keep_samples','每节点保留探测次数','30–360；默认 240；另外保留七天小时汇总和 64 条事件。','number'],['api_port','独立 API 端口','1–65535；默认 9090，继承启用时以 OpenClash 为准。','number'],['targets','HTTPS 检测目标','每行一个完整 HTTPS URL，最多两个；不能含凭据、片段和自定义端口。建议轻量 204 地址。','list']]
onMounted(async()=>{try{if(preview)return;const r=await fetch(root+'/settings',{cache:'no-store'});if(!r.ok)throw Error(`读取设置失败 ${r.status}`);const cfg=await r.json();Object.assign(form,cfg);for(const k of lists)form[k]=Array.isArray(cfg[k])?cfg[k].join('\n'):''}catch(e){error.value=e.message}finally{loading.value=false}})
function changed(){emit('dirty',true);message.value=''}
async function save(){
 const config={...form};for(const k of lists)config[k]=String(form[k]||'').split(/\s+/).filter(Boolean)
 if(privacy){const problem=privacyProblem(config);if(problem){error.value=problem;return}}
 else{for(const[k,min,max]of [['interval',30,3600],['timeout',500,10000],['max_nodes',1,64],['keep_samples',30,360],['api_port',1,65535]])if(!/^\d+$/.test(form[k])||+form[k]<min||+form[k]>max){error.value=`${fields.find(f=>f[0]===k)[1]}需为 ${min}–${max} 的整数`;return}if(!config.targets.length||config.targets.length>2||config.targets.some(v=>!/^https:\/\/[\w.-]+\/[^\s@#]*$/.test(v))){error.value='检测目标需为一至两个合法 HTTPS URL';return}if(clearSecret.value)config.api_secret='';else if(secret.value)config.api_secret=secret.value}
 busy.value=true;error.value='';try{const r=await fetch(root+'/configure',{method:'POST',body:new URLSearchParams({token,config:JSON.stringify(config)})});const d=await r.json();if(!r.ok||d.error)throw Error(d.error||`保存失败 ${r.status}`);message.value=d.message||'设置已保存';emit('dirty',false);secret.value='';clearSecret.value=false}catch(e){error.value=e.message}finally{busy.value=false}
}
</script>
<template>
 <div class="oc-monitor-settings-head"><button @click="emit('back')">← 返回{{privacy?'隐私仪表盘':'节点监控'}}</button><p>调整采集与保护参数；监控结果在仪表盘查看。</p></div>
 <p v-if="error" class="oc-error" role="alert">{{error}}</p><p v-if="message" class="oc-success" role="status">{{message}}</p>
 <p v-if="loading">正在读取设置…</p>
 <form v-else class="oc-monitor-settings" @submit.prevent="save" @input="changed" @change="changed">
  <section class="oc-card"><h3>{{privacy?'保护与观察能力':'后台监控与保留'}}</h3><label v-for="[key,label,note] in toggles" class="oc-security-toggle"><input type="checkbox" :checked="form[key]==='1'" @change="form[key]=$event.target.checked?'1':'0'"><span>{{label}}<small>{{note}}</small></span></label></section>
  <section class="oc-card"><h3>{{privacy?'接口与加密解析':'探测参数'}}</h3><div class="oc-monitor-form-grid"><label v-for="[key,label,note,type] in fields"><span>{{label}}</span><textarea v-if="type==='list'" v-model="form[key]" rows="3" :aria-label="label"></textarea><input v-else v-model="form[key]" :inputmode="type==='number'?'numeric':'text'" :aria-label="label"><small>{{note}}</small></label></div>
  <template v-if="!privacy&&form.use_openclash==='0'"><label>独立 API 密钥<input v-model="secret" type="password" autocomplete="new-password"><small>留空保留原密钥，最多 1024 字符，不能换行。原密钥不返回页面。</small></label><label class="oc-security-toggle"><input v-model="clearSecret" type="checkbox"><span>清除已有独立 API 密钥</span></label></template></section>
  <div class="oc-card oc-monitor-settings-save"><span>保存后独立服务重启，仪表盘会报告实际生效状态。</span><button type="submit" class="primary" :disabled="busy||preview">{{busy?'正在保存…':'保存设置'}}</button></div>
 </form>
</template>
