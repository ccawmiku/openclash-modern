<script setup>
import { computed, reactive, ref } from 'vue'
import { base, preview } from '../api.js'
const props = defineProps(['type', 'context'])
const c = props.context || {}, busy = ref(false), output = ref(''), update = ref({}), history = ref([]), addresses = ref(''), selectedPlugin = ref(''), selectedCore = ref(''), backup = ref('backup')
const form = reactive({ core_ver: c.core_version || 'linux-amd64-v1', release_branch: c.release_branch || 'dev', smart_enable: c.smart_enable || '0', url: c.github_address_mod === '0' ? '' : c.github_address_mod || '' })

const archs = ['linux-386','linux-amd64-v1','linux-amd64-v2','linux-amd64-v3','linux-armv5','linux-armv6','linux-armv7','linux-arm64','linux-loong64-abi1','linux-loong64-abi2','linux-riscv64','linux-s390x','linux-mips-hardfloat','linux-mips-softfloat','linux-mips64','linux-mips64le','linux-mipsle-softfloat','linux-mipsle-hardfloat','0']
const pluginHistory = computed(() => history.value.filter(e => e.type === 'plugin' && e.version))
const coreHistory = computed(() => history.value.filter(e => e.type === (form.smart_enable === '1' ? 'core_smart' : 'core_meta') && e.version))
async function call(action, params = {}) {
  if (preview) return
  const response = await fetch(`${base}/${action}?${new URLSearchParams(params)}`, { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw Error(`操作失败 (${response.status})`)
  const text = await response.text(), messages = text.split('\n').map(line => { try { return JSON.parse(line.trim()) } catch { return null } }).filter(Boolean)
  output.value = messages.length ? messages.map(data => JSON.stringify(data, null, 2)).join('\n') : text || '操作已提交'
  const last = messages.at(-1)
  if (last?.status === 'error' || last?.stage === 'error') throw Error(last.msg || last.message || String(last.result) || '操作失败')
  return messages.length === 1 ? last : messages
}
async function run(action, params) {
  if (busy.value || preview) return
  busy.value = true
  try { return await call(action, params) } catch (e) { output.value = e.message } finally { busy.value = false }
}
async function refresh() { const data = await run('update'); if (data && !Array.isArray(data)) { update.value = data; addresses.value = (data.cdn_list || []).join('\n') } }
async function versions() { const data = await run('version_history', { branch: form.release_branch, force: '1' }); history.value = Array.isArray(data) ? data : data ? [data] : [] }
function downloadURL(kind) {
  const selected = history.value.find(e => e.sha === (kind === 'core' ? selectedCore.value : selectedPlugin.value)), sha = selected?.sha || '', version = selected?.version || '', arch = form.core_ver, branch = form.release_branch, addr = form.url
  const classify = !addr || /raw\.githubusercontent\.com/i.test(addr) ? 'raw' : /jsdelivr|fastly|testingcf/i.test(addr) ? 'jsdelivr' : /dl\.dler\.io/i.test(addr) ? 'dler' : 'proxy'
  const filename = kind === 'core' ? `clash-${arch}.tar.gz` : update.value.pkg_type === 'apk' ? `luci-app-openclash-${version.replace(/^v/, '')}.apk` : `luci-app-openclash_${version.replace(/^v/, '')}_all.ipk`
  if (kind === 'plugin' && !version) return ''
  const sub = form.smart_enable === '1' ? 'smart' : 'meta', path = sha ? `${sha}/${branch}${kind === 'core' ? '/' + sub : ''}` : `${kind === 'core' ? 'core' : 'package'}/${branch}${kind === 'core' ? '/' + sub : ''}`
  return classify === 'jsdelivr' ? `${addr}gh/vernesong/OpenClash@${path}/${filename}` : `${classify === 'raw' ? '' : addr}https://raw.githubusercontent.com/vernesong/OpenClash/${path}/${filename}`
}
async function install(coreOnly) {
  if (!confirm(coreOnly ? '确定安装所选内核？' : '确定更新插件及内核？')) return
  busy.value = true
  try {
    await call('save_corever_branch', { core_ver: form.core_ver, release_branch: form.release_branch, smart_enable: form.smart_enable })
    if (!coreOnly && !selectedPlugin.value) { await call('one_key_update', { url: form.url }); return }
    await call(coreOnly ? 'core_download' : 'one_key_update', { download_url: downloadURL(coreOnly ? 'core' : 'plugin'), url: form.url })
  } catch (e) { output.value = e.message } finally { busy.value = false }
}
</script>
<template>
  <div class="oc-maintenance" :data-widget="`openclash/${type}`">
    <template>
      <div class="oc-actions"><button :disabled="busy" @click="refresh">读取当前版本 / 下载来源</button><button :disabled="busy" @click="versions">读取历史版本</button></div>
      <p v-if="update.coremodel" class="oc-muted">架构 {{ update.coremodel }} · 插件 {{ update.opcv }} · 内核 {{ update.coremetacv }}</p>
      <label>内核架构<select v-model="form.core_ver"><option v-for="arch in archs">{{ arch }}</option></select></label><label>发布分支<select v-model="form.release_branch"><option value="dev">Developer</option><option value="master">Master</option></select></label><label>Smart 内核<select v-model="form.smart_enable"><option value="0">关闭</option><option value="1">开启</option></select></label>
      <label>插件版本<select v-model="selectedPlugin"><option value="">最新版本</option><option v-for="e in pluginHistory" :value="e.sha">{{ e.version }} · {{ e.date }}</option></select></label><label>内核版本<select v-model="selectedCore"><option value="">最新版本</option><option v-for="e in coreHistory" :value="e.sha">{{ e.version }} · {{ e.date }}</option></select></label>
      <label>下载来源 / 自定义 CDN 前缀<input v-model="form.url" list="oc-cdn-list" placeholder="留空使用默认来源"><datalist id="oc-cdn-list"><option v-for="addr in addresses.split('\n').filter(Boolean)" :value="addr" /></datalist></label>
      <div class="oc-actions"><button :disabled="busy || preview" @click="run('save_corever_branch', { core_ver: form.core_ver, release_branch: form.release_branch, smart_enable: form.smart_enable })">保存升级选项</button><button :disabled="busy || preview" @click="run('save_github_address_mod', { value: form.url || '0' })">保存下载来源</button><button :disabled="busy || preview" @click="install(true)">下载内核</button><button :disabled="busy || preview" @click="install(false)">一键更新</button><button :disabled="busy" @click="run('addr_info', { addrs: form.url, branch: form.release_branch, force: '1' })">检测下载来源</button></div>
      <details><summary>备份与恢复</summary><select v-model="backup"><option value="backup">全部备份</option><option value="backup_ex_core">排除内核</option><option value="backup_only_core">仅内核</option><option value="backup_only_config">仅配置</option><option value="backup_only_rule">仅规则 Provider</option><option value="backup_only_proxy">仅代理 Provider</option></select><a :href="`${base}/${backup}`" download>下载备份</a><button :disabled="busy || preview" @click="run('restore')">恢复默认配置</button><button :disabled="busy || preview" @click="run('remove_all_core')">删除全部内核</button></details>
    </template>
    <p v-if="busy" class="oc-muted">正在执行…</p><pre v-if="output" class="oc-widget-output" role="status">{{ output }}</pre>
  </div>
</template>
