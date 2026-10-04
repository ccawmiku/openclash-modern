<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { base, preview, token } from '../api.js'
import {validateYaml} from '../validation.js'
const Maintenance = defineAsyncComponent(() => import('./Maintenance.vue'))
const props = defineProps(['field', 'values', 'model', 'section', 'fields', 'context'])
const emit = defineEmits(['changed', 'reload', 'navigate'])
const type = computed(() => props.field.originalTemplate?.split('/')[1] || 'upload')
const busy = ref(false), output = ref(''), text = ref(''), algorithm = ref('keygen'), uploadType = ref('config'), selectedFile = ref(null), dashboardType = ref('Official')
const filename = computed(() => String(props.field.value || props.field.widget_value || '').split('/').pop().replace(/\.ya?ml$/i, ''))
async function run(action, params = {}) {
  if (preview || busy.value) return
  busy.value = true; output.value = ''
  try {
    const response = await fetch(`${base}/${action}?${new URLSearchParams(params)}`, { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) throw Error(`操作失败 (${response.status})`)
    const result = await response.text()
    let data; try { data = JSON.parse(result) } catch { output.value = result || '操作已提交'; return }
    if (data.status === 'error' || data.error) throw Error(data.message || data.msg || data.error || '操作失败')
    output.value = JSON.stringify(data, null, 2); return data
  } catch (e) { output.value = e.message } finally { busy.value = false }
}
const key = option => props.field.id.slice(0, props.field.id.lastIndexOf('.') + 1) + option
async function age(calculate = false) {
  if(preview||busy.value)return
  const secret=String(props.values[key('config_age_secret')]||'')
  if(calculate&&(!/^AGE-SECRET-KEY-[A-Z0-9-]+$/.test(secret)||secret.length>4096)){output.value='请填写合法 Age 私钥';return}
  busy.value=true;let result
  try{const r=await fetch(`${base}/modern_age`,{method:'POST',body:new URLSearchParams({operation:calculate?'convert':'generate',secret:calculate?secret:'',algo:props.values[key('config_age_algo')]||algorithm.value,token})});result=await r.json();if(!r.ok||result.status==='error'||result.error)throw Error(result.message||result.error||'Age 操作失败')}catch(e){output.value=e.message;return}finally{busy.value=false}
  if (result?.public) props.values[key('config_age_public')] = result.public
  if (result?.secret) props.values[key('config_age_secret')] = result.secret
  if (result) { output.value = '密钥已填入表单，请保存。'; emit('changed') }
}
async function share(importing) {
  try {
    const { createShareCodec } = await import('../share-codec.js'), codec = createShareCodec(props.values, props.fields || [])
    if (importing) { codec.import(text.value, props.section); emit('changed'); output.value = '已导入表单，请检查并保存。' }
    else text.value = codec.export(props.section)
  } catch (e) { output.value = e.message }
}
async function rename() {
  if (!text.value) return
  if(!/^[\w.-]{1,128}$/.test(text.value)||['.','..'].includes(text.value)){output.value='文件名需为 1–128 位字母、数字、点、下划线或连字符';return}
  await run('rename_file', { new_file_name: text.value, file_path: props.field.option, file_name: props.field.widget_value }); emit('reload')
}
async function upload() {
  if (!selectedFile.value || preview) return
  const file=selectedFile.value
  if(!/^[\w.-]{1,128}$/.test(file.name)||['.','..'].includes(file.name)){output.value='文件名不合法';return}
  if(['config','proxy-provider','rule-provider'].includes(uploadType.value)&&/\.ya?ml$/i.test(file.name)){
   if(file.size>10*1024*1024){output.value='YAML 配置最多 10 MiB';return}
   const problem=await validateYaml(await file.text());if(problem){output.value=problem;return}
  }
  busy.value = true
  try {
    const data = new FormData(); data.set('token', token); data.set('file_type', uploadType.value); data.set('ulfile', selectedFile.value); data.set('upload', '1')
    const response = await fetch(`${base}/config`, { method: 'POST', credentials: 'same-origin', body: data })
    if (!response.ok) throw Error(`上传失败 (${response.status})`)
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
    const error = doc.querySelector('.cbi-value-error, .cbi-section-error')
    if (error) throw Error(error.textContent.trim())
    output.value = '上传已提交。'; emit('reload')
  } catch (e) { output.value = e.message } finally { busy.value = false }
}
</script>
<template>
  <Maintenance v-if="type === 'update'" :type="type" :context="context" />
  <template v-else>
    <div class="oc-actions" :data-widget="field.originalTemplate">
      <button v-if="['flush_dns_cache', 'flush_smart_cache'].includes(type)" :disabled="busy || preview" @click="run(type)">清空缓存</button>
      <button v-if="type === 'switch_mode'" :disabled="busy || preview" @click="run('switch_mode').then(() => emit('reload'))">切换 Fake-IP / Redir-Host 设置模式</button>
      <template v-if="type === 'other_stream_option'"><button :disabled="busy || preview" @click="run('manual_stream_unlock_test', { type: field.widget_value })">测试当前选择</button><button :disabled="busy || preview" @click="run('all_proxies_stream_test', { type: field.widget_value })">测试所有节点</button></template>
      <template v-if="type === 'switch_dashboard'"><select v-model="dashboardType" aria-label="面板版本"><option>Official</option><option v-if="['Dashboard', 'Yacd'].includes(field.option)">Meta</option></select><button :disabled="busy || preview" @click="run('switch_dashboard', { name: field.option, type: dashboardType })">安装 / 更新</button><button :disabled="busy || preview" @click="run('default_dashboard', { name: field.option })">设为默认</button><button :disabled="busy || preview" @click="run('delete_dashboard', { name: field.option })">删除面板</button><button :disabled="busy" @click="run('dashboard_type')">查看状态</button></template>
      <template v-if="type === 'debug'"><input v-model="text" placeholder="诊断域名或 IP" aria-label="诊断地址"><button :disabled="busy || preview" @click="run('diag_connection', { addr: text })">连接诊断</button><button :disabled="busy || preview" @click="run('diag_dns', { addr: text })">DNS 诊断</button><button :disabled="busy || preview" @click="run('gen_debug_logs')">生成调试日志</button><a :href="`${base}/get_debug_logs`" download>下载调试日志</a></template>
      <template v-if="type === 'generate_age'"><button :disabled="busy || preview" @click="age()">生成 Age 密钥</button><button :disabled="busy || preview" @click="age(true)">计算公钥</button></template>
      <template v-if="type === 'server_url'"><textarea v-model="text" rows="3" aria-label="节点分享链接" placeholder="粘贴或导出节点分享链接"></textarea><button @click="share(true)">导入分享链接</button><button @click="share(false)">导出分享链接</button></template>
      <button v-if="type === 'update_config'" :disabled="busy || preview" @click="run('update_config', { filename })">更新订阅</button>
      <template v-if="type === 'input_rename'"><input v-model="text" placeholder="新文件名（含扩展名）" aria-label="新文件名"><button :disabled="busy || preview" @click="rename">重命名</button></template>
      <template v-if="type === 'input_file_name'"><input v-model="text" placeholder="文件名（含扩展名）" aria-label="创建文件名"><button :disabled="busy || preview" @click="run('create_file', { filename: text, filepath: field.widget_value }).then(() => emit('reload'))">创建文件</button></template>
      <template v-if="type === 'sub_info_show'"><button :disabled="busy" @click="run('sub_info_get', { filename })">读取订阅流量</button><input v-model="text" placeholder="订阅信息 URL" aria-label="订阅信息链接"><button :disabled="busy || preview" @click="run('set_subinfo_url', { filename, url: text })">保存信息 URL</button><button @click="emit('navigate', `${base}/config-subscribe`)">编辑订阅</button></template>
      <template v-if="type === 'upload'"><select v-model="uploadType" aria-label="上传文件类型"><option value="config">配置文件</option><option value="proxy-provider">代理 Provider</option><option value="rule-provider">规则 Provider</option><option value="clash_meta">Mihomo 内核</option><option value="backup-file">恢复备份</option></select><input type="file" aria-label="上传文件" @change="selectedFile = $event.target.files[0]"><button :disabled="busy || preview || !selectedFile" @click="upload">上传</button><a :href="`${base}/backup`" download>备份全部文件</a></template>
    </div>
    <p v-if="busy" class="oc-muted">正在执行…</p><pre v-if="output" class="oc-widget-output" role="status">{{ output }}</pre>
  </template>
</template>
