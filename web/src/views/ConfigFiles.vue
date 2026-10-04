<script setup>
import { defineAsyncComponent, onMounted, ref } from 'vue'
import { base, preview, request, token } from '../api.js'
import { validateYaml } from '../validation.js'
const Settings = defineAsyncComponent(() => import('./Settings.vue'))
const OverwriteFiles = defineAsyncComponent(() => import('../widgets/OverwriteFiles.vue'))
const FileAge=defineAsyncComponent(()=>import('../widgets/FileAge.vue'))
const ageEditing=ref(false)
const ageAvailable=ref(false)
const management = ref(''),runtime=ref(''),comparing=ref(false),changes=ref([])
const emit = defineEmits(['dirty'])
const files = ref([]), selected = ref(''), content = ref(''), dirty = ref(false), error = ref(''), message = ref(''), busy = ref(false)
const sizeLabel = value => typeof value === 'number' ? `${(value / 1024).toFixed(1)} KB` : value
onMounted(async () => { try { const data = await request('config_file_list'); files.value = Array.isArray(data.config_files) ? data.config_files : [];const info=await request('modern_dashboard_info');ageAvailable.value=info.capabilities?.age??true } catch (e) { error.value = e.message } })
async function open(file) {
  if (dirty.value && !confirm('当前文件未保存，确定切换？')) return
  busy.value = true; error.value = ''; message.value = ''
  try { const data = await request('config_file_read', { config_file: file.path }); selected.value = file.path; content.value = data.content;comparing.value=false;ageEditing.value=false;runtime.value='';dirty.value = false; emit('dirty', false) } catch (e) { error.value = e.message } finally { busy.value = false }
}
async function compare(){busy.value=true;error.value='';try{const value=await request('config_file_read',{config_file:'/etc/openclash/'+selected.value.split('/').pop()});runtime.value=value.content;if(!runtime.value)throw Error('当前没有生成运行配置；启动并加载配置后才可比较');const {compareYaml}=await import('../file-compare.js');changes.value=await compareYaml(content.value,runtime.value);comparing.value=true}catch(e){error.value=e.message}finally{busy.value=false}}
async function save() {
  if (preview || busy.value) return
  const invalid = await validateYaml(content.value)
  if (invalid) { error.value = `YAML 语法错误：${invalid}`; return }
  busy.value = true; error.value = ''
  try {
    const response = await fetch(`${base}/modern_file_save`, { method: 'POST', credentials: 'same-origin', body: new URLSearchParams({ config_file: selected.value, content: content.value, token }) })
    if (!response.ok) throw Error(`保存失败 (${response.status})`)
    const data = await response.json(); if (data.status !== 'success') throw Error(data.message || '保存失败')
    dirty.value = false; emit('dirty', false); message.value = '文件已保存。需要重启服务才会加载新的内容。'
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>
<template><div class="oc-toolbar"><button @click="management=management?'':'config'">{{management?'返回文件编辑器':'上传、备份与完整文件操作'}}</button><button @click="management='config-subscribe'">订阅与全部高级选项</button><button @click="management='overwrite'">覆写文件与订阅</button></div>
<OverwriteFiles v-if="management==='overwrite'" @dirty="emit('dirty',$event)"/><Settings v-else-if="management" :key="management" :initial-model="management" @dirty="emit('dirty',$event)"/>
<template v-else><p v-if="error" class="oc-error" role="alert">{{error}}</p><p v-if="message" class="oc-success">{{message}}</p><div class="oc-files"><aside><h3>配置文件</h3><button v-for="file in files" :class="{active:selected===file.path}" :disabled="busy" @click="open(file)">{{file.name}}<small>{{sizeLabel(file.size)}}</small></button><p v-if="!files.length" class="oc-muted">暂无配置文件</p></aside><section><template v-if="selected"><div class="oc-editor-head"><span>{{selected.split('/').pop()}}</span><div class="oc-actions"><button v-if="ageAvailable" @click="ageEditing=!ageEditing">Age 密钥</button><button :disabled="busy" @click="compare">比较运行配置</button><button v-if="comparing" @click="comparing=false">返回编辑</button><button class="primary" :disabled="preview||busy||!dirty" @click="save">保存文件</button></div></div>
<FileAge v-if="ageEditing" :key="selected" :name="selected.split('/').pop().replace(/\.ya?ml$/i,'')"/><template v-else-if="comparing"><p class="oc-note">{{changes.length}} 处参数差异。原文与运行配置分开显示；运行配置只读，原配置修改后重新加载才会生效。只比较参数值，不比较注释与排版。</p><div class="oc-compare-panes"><div><strong>原始配置</strong><textarea :value="content" class="oc-editor" readonly aria-label="原始配置比较内容"></textarea></div><div><strong>运行配置</strong><textarea :value="runtime" class="oc-editor" readonly aria-label="运行配置内容"></textarea></div></div><div class="oc-compare-changes"><div v-for="change in changes"><code>{{change.path}}</code><del>{{change.before}}</del><ins>{{change.after}}</ins></div></div></template>
<textarea v-else v-model="content" class="oc-editor" aria-label="配置文件内容" spellcheck="false" @input="dirty=true;emit('dirty',true)"></textarea></template><div v-else class="oc-empty">选择配置文件查看与编辑</div></section></div><p class="oc-note">保存前检查 YAML 语法。上传、备份、Age 加密、Provider 和订阅高级设置从上方入口打开。</p></template></template>
<style>.oc-compare-panes{display:grid;grid-template-columns:1fr 1fr;gap:15px}.oc-compare-panes>div{min-width:0;font-size:12px}.oc-compare-changes{max-height:230px;overflow:auto;font-size:11px;margin-top:15px}.oc-compare-changes>div{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:8px 0;border-bottom:1px solid #edf0f5;overflow-wrap:anywhere}.oc-compare-changes del{color:#b91c1c}.oc-compare-changes ins{color:#047857;text-decoration:none}@media(max-width:850px){.oc-compare-panes{grid-template-columns:1fr}.oc-compare-changes>div{grid-template-columns:1fr}.oc-files .oc-editor-head{flex-wrap:wrap;gap:10px}}</style>

