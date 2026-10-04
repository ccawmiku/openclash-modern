<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { base, preview, request, token } from '../api.js'
import { dependsMatch, formPayload } from '../form.js'
import Field from '../widgets/Field.vue'
import DraftField from '../widgets/DraftField.vue'
import { validateField, validateYaml, yamlOptions } from '../validation.js'
import { displayLabel,recordValue } from '../field-help.js'
import { categoryFor, categoryNames,sectionLabel,topicFor,topicNames,dnsGroupNames,dnsRole,isCommand,fieldSummary,isReadOnlyStatus } from '../settings-structure.js'
const props = defineProps({ initialModel: { default: 'settings' } })
const emit = defineEmits(['dirty'])
const models = [['settings', '插件设置'], ['config-overwrite', '覆写设置'], ['config-subscribe', '订阅设置'], ['servers', '节点与策略组'], ['config', '配置与文件管理'], ['proxy-provider-file-manage', '代理 Provider 文件'], ['rule-providers-file-manage', '规则 Provider 文件']]
const model = ref(props.initialModel), section = ref(''), file = ref(''), schema = ref(null), values = reactive({}), tab = ref(''), search = ref(''), loading = ref(false), dirty = ref(false), error = ref(''), success = ref(''), history = ref([])
const allFields = computed(() => schema.value?.maps.flatMap(m => m.sections.flatMap(s => s.rows.flatMap(r => r.fields))) || [])
const topic=ref(''),recordId=ref(''),recordPage=ref(0),dnsGroup=ref('nameserver'),draft=ref(null),draftValues=reactive({}),draftError=ref('')
const selectedKey = ref(''), touched = reactive({}), serverErrors = reactive({}), yamlErrors = reactive({})
const entries = computed(() => schema.value?.maps.flatMap((map, mi) => map.sections.flatMap((group, si) => group.rows.flatMap(row => row.fields.filter(f => !(f.template === 'cbi/button' && ['Commit','Apply','Back'].includes(f.option))).map(field => ({ key: `${field.id}:${field.originalTemplate}:${field.label}`, field:{...field,section_type:group.type}, map, group, row, groupKey: `${mi}.${si}`, category: categoryFor(field, model.value, group.type) }))))) || [])
const navigationEntries=computed(()=>[...entries.value,...(schema.value?.maps.flatMap(map=>map.sections.flatMap(group=>(group.prototype||[]).map(field=>({field,group,category:categoryFor(field,model.value,group.type)}))))||[])])
const tabs = computed(() => [...new Set(navigationEntries.value.map(e => e.category))].map(name => ({ name, title: categoryNames[name] || name })).sort((a,b)=>model.value==='servers'?['proxy-nodes','proxy-groups','proxy-providers','node-actions'].indexOf(a.name)-['proxy-nodes','proxy-groups','proxy-providers','node-actions'].indexOf(b.name):0))
const categoryEntries=computed(()=>entries.value.filter(e=>e.category===tab.value))
const topics=computed(()=>[...new Set(navigationEntries.value.filter(e=>e.category===tab.value).map(e=>topicFor(e.field,model.value,e.group.type)))].map(name=>({name,title:topicNames[name]||schema.value?.maps.flatMap(m=>m.sections.flatMap(g=>g.tabs)).find(t=>t.name===name)?.title||'通用参数'})))
watch(tab,()=>{topic.value=topics.value[0]?.name||'';recordId.value='';search.value=''})
watch(topics,list=>{if(!list.some(t=>t.name===topic.value))topic.value=list[0]?.name||''})
const topicEntries=computed(()=>categoryEntries.value.filter(e=>topicFor(e.field,model.value,e.group.type)===topic.value))
const collectionGroups=computed(()=>schema.value?.maps.flatMap(map=>map.sections.filter(group=>group.addremove&&categoryFor({},model.value,group.type)===tab.value&&topicFor({},model.value,group.type)===topic.value).map(group=>({map,group})))||[])
const records=computed(()=>collectionGroups.value.flatMap(({map,group})=>group.rows.filter(row=>group.type!=='dns_servers'||dnsRole(row,values)===dnsGroup.value).map(row=>({map,group,row}))))
const currentRecord=computed(()=>records.value.find(r=>r.row.id===recordId.value))
const recordPages=computed(()=>Math.max(1,Math.ceil(records.value.length/6)))
const pagedRecords=computed(()=>records.value.slice(recordPage.value*6,recordPage.value*6+6))
watch([tab,topic,dnsGroup],()=>recordPage.value=0)
watch(recordPages,count=>{if(recordPage.value>=count)recordPage.value=count-1})
const statuses=computed(()=>topicEntries.value.filter(e=>!e.group.addremove&&isReadOnlyStatus(e.field)))
const statusRecords=computed(()=>[...new Set(statuses.value.map(e=>e.row))].map(row=>({row,entries:statuses.value.filter(e=>e.row===row)})))
const filtered = computed(() => entries.value.filter(e => dependsMatch(e.field, values) && !(isReadOnlyStatus(e.field)) && (search.value ? `${displayLabel(e.field)} ${e.field.option} ${e.field.description}`.toLowerCase().includes(search.value.toLowerCase()) : e.category === tab.value && topicFor(e.field,model.value,e.group.type)===topic.value && (!e.group.addremove || e.row.id===recordId.value) && !(e.group.addremove&&e.field.option==='enabled'))))
const selected = computed(() => filtered.value.find(e => e.key === selectedKey.value) || filtered.value[0])
const localErrors = computed(() => Object.fromEntries(allFields.value.filter(f => dependsMatch(f, values)).map(f => [f.id, validateField(f, values[f.id]) || yamlErrors[f.id]]).filter(([, message]) => message)))
const activeError = computed(() => selected.value && (serverErrors[selected.value.field.id] || (touched[selected.value.field.id] && localErrors.value[selected.value.field.id])))
watch(filtered, list => { if (!list.some(e => e.key === selectedKey.value)) selectedKey.value = list[0]?.key || '' })
let yamlTimer
onBeforeUnmount(() => { loadId++; clearTimeout(yamlTimer) })
watch(() => [selected.value?.field.id, selected.value && values[selected.value.field.id]], ([id, value]) => {
  clearTimeout(yamlTimer)
  const field = selected.value?.field
  if (!field || !yamlOptions.has(field.option)) return
  yamlTimer = setTimeout(async () => { const message = await validateYaml(String(value || '')); if (values[id] === value) yamlErrors[id] = message }, 250)
})
function select(entry) { selectedKey.value = entry.key }
function showError(id) { const entry = entries.value.find(e => e.field.id === id); if (entry) { search.value = ''; tab.value = entry.category; topic.value=topicFor(entry.field,model.value,entry.group.type);recordId.value=entry.row.id;selectedKey.value = entry.key } }
function fieldValue(field) {const value=values[field.id];if(isCommand(field))return '点击执行';if(field.password)return value?'已填写':'未设置';if(field.template==='cbi/fvalue')return String(value)===String(field.enabled)?'开启':'关闭';if(Array.isArray(value))return fieldSummary(field,value);return fieldSummary(field,recordValue(field,field.choices.find(c=>String(c.value)===String(value))?.label||value))}
function rowTitle(row){const f=row.fields.find(f=>['name','username','ip','mac'].includes(f.option));return f?String(values[f.id]||f.value||'未命名记录'):'记录 '+row.id}
function rowSummary(row){return row.fields.filter(f=>['group','type','server','port','config','address'].includes(f.option)).map(f=>f.password?'':fieldValue(f)).filter(Boolean).join(' · ')}
function rowEnabled(row){return row.fields.find(f=>f.option==='enabled')}
function toggleRow(row,event){const f=rowEnabled(row);values[f.id]=event.target.checked?f.enabled:f.disabled;dirty.value=true;emit('dirty',true)}
function rowHasParameters(row){return row.fields.some(f=>f.option!=='enabled'&&!isReadOnlyStatus(f)&&dependsMatch(f,values))}
function pickRecord(row){const group=collectionGroups.value.find(g=>g.group.rows.includes(row))?.group;if(!rowHasParameters(row)&&group?.extedit)return navigate(group.extedit.replace('%s',row.id));recordId.value=row.id;selectedKey.value=''}
const scheduleSummary=computed(()=>{const fields=allFields.value;const get=option=>{const f=fields.find(f=>f.option===option);return f?values[f.id]:''};if(get('auto_update')!=='1')return '自动更新已关闭';if(get('config_auto_update_mode')==='1')return `每隔 ${get('config_update_interval')} 分钟更新`;const day=get('config_update_week_time');return `${day==='*'?'每天':({'0':'每周日','1':'每周一','2':'每周二','3':'每周三','4':'每周四','5':'每周五','6':'每周六'})[day]||'所选日期'} ${String(get('auto_update_time')||0).padStart(2,'0')}:00 更新（路由器本地时间）`})
const buttons = computed(() => allFields.value.filter(f => f.template === 'cbi/button' && ['Commit', 'Apply', 'Back'].includes(f.option)))
const unknownEditable = computed(() => allFields.value.filter(f => f.template === 'unsupported'))
let loadId = 0
const params = () => ({ model: model.value, ...(section.value ? { section: section.value } : {}), ...(file.value ? { file: file.value } : {}) })
async function load() {
  const id = ++loadId
  loading.value = true; error.value = ''; schema.value = null
  try {
    if (model.value === 'servers' && !file.value) {
      const list = await request('config_file_list'), files = Array.isArray(list.config_files) ? list.config_files : []
      if (!files.length) throw Error('请先在配置文件中上传或创建配置，再编辑节点。')
      file.value = files[0].path || '/etc/openclash/config/' + files[0].name
    }
    const data = await request('modern_schema', params())
    if (id !== loadId) return
    for (const key of Object.keys(values)) delete values[key]
    schema.value = data
    for (const key of Object.keys(touched)) delete touched[key]
    for (const key of Object.keys(serverErrors)) delete serverErrors[key]
    for (const key of Object.keys(yamlErrors)) delete yamlErrors[key]
    for (const f of allFields.value) values[f.id] = f.template === 'cbi/dynlist' || f.template === 'cbi/mvalue' ? (Array.isArray(f.value) ? f.value : f.value ? [f.value] : []) : f.template === 'cbi/fvalue' && (f.value === '' || f.value == null) ? f.disabled : f.value
    tab.value = tabs.value[0]?.name || ''; dirty.value = false; emit('dirty', false)
  } catch (e) { if (id === loadId) error.value = e.message } finally { if (id === loadId) loading.value = false }
}
let loadTask
watch(model, ()=>{loadTask=load()}, { immediate: true })
function changeModel(event) {
  if (dirty.value && !confirm('切换将丢弃未保存的修改，确定继续？')) { event.target.value = model.value; return }
  section.value = ''; file.value = ''; history.value = []; search.value = ''; recordId.value='';topic.value='';model.value = event.target.value
}
function changed() { if (selected.value) { touched[selected.value.field.id] = true; delete serverErrors[selected.value.field.id] } dirty.value = true; emit('dirty', true); success.value = '' }
async function navigate(url) {
  if(dirty.value&&!confirm('进入详情将丢弃未保存的修改，确定继续？'))return
  const parsed = new URL(url, location.origin), parts = parsed.pathname.slice(base.length + 1).split('/')
  if (!models.some(([id]) => id === parts[0]) && !['custom-dns-edit', 'config-subscribe-edit', 'servers-config', 'groups-config', 'proxy-provider-config', 'other-file-edit'].includes(parts[0])) return
  history.value.push({...params(),view:{tab:tab.value,topic:topic.value,record:recordId.value,role:dnsGroup.value,page:recordPage.value}}); section.value = parts[1] || ''; file.value = parsed.searchParams.get('file') || ''
  if (model.value === parts[0]) await load(); else {model.value = parts[0];await nextTick();await loadTask}
}
async function back() {
  if (dirty.value && !confirm('返回将丢弃未保存的修改，确定继续？')) return
  const previous = history.value.pop(); if (!previous) return
  section.value = previous.section || ''; file.value = previous.file || ''
  if (model.value === previous.model) await load(); else {model.value = previous.model;await nextTick();await loadTask}
  if(previous.view){tab.value=previous.view.tab;await nextTick();topic.value=previous.view.topic;dnsGroup.value=previous.view.role;await nextTick();recordId.value=previous.view.record;recordPage.value=previous.view.page}
}
async function save(button, extra = {}) {
  if (preview || unknownEditable.value.length) return
  for (const field of allFields.value.filter(f => dependsMatch(f, values) && yamlOptions.has(f.option))) yamlErrors[field.id] = await validateYaml(String(values[field.id] || ''))
  const invalid = Object.keys(localErrors.value)
  if (invalid.length && !Object.keys(extra).some(k => k.startsWith('cbi.rts.'))) {
    invalid.forEach(id => touched[id] = true); showError(invalid[0]); error.value = `有 ${invalid.length} 项未通过校验，请修正后提交。`; return
  }
  loading.value = true; error.value = ''; success.value = ''
  try {
    const body = formPayload(schema.value, values, button, token)
    for (const [key, value] of Object.entries({ ...params(), ...extra })) body.set(key, value)
    const response = await fetch(`${base}/modern_submit`, { method: 'POST', credentials: 'same-origin', body })
    if (!response.ok) throw Error(`操作失败 (${response.status})`)
    if (response.headers.get('Content-Disposition')?.includes('attachment')) {
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a'); link.href = url; link.download = response.headers.get('Content-Disposition').match(/filename="?([^";]+)/)?.[1] || 'openclash-download'; link.click(); URL.revokeObjectURL(url); return
    }
    const result = await response.json()
    if (!result.ok) {
      const errors = Array.isArray(result.errors) ? result.errors : []
      for (const item of errors) if (item.field) serverErrors[item.field] = item.message
      if (errors[0]?.field) showError(errors[0].field)
      throw Error(errors.map(item => typeof item === 'string' ? item : `${item.label || ''}：${item.message}`).join('；') || '配置未通过校验')
    }
    dirty.value=false;emit('dirty',false)
    if (result.redirect && (!result.redirect.includes(`/${model.value}`) || result.redirect.includes('-config/') || result.redirect.includes('-edit/'))) await navigate(result.redirect)
    else await load()
    success.value = '已通过原生 OpenClash 配置处理器提交。'
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
async function create(map,group) {
 if(dirty.value){error.value='请先保存当前修改，再添加记录。';return}
 const required=({dns_servers:['ip'],authentication:['username','password'],config_subscribe:['name','address'],servers:['name','type','server','port'],groups:['name','type'],'proxy-provider':['name','type']})[group.type]||[]
 let source
 try{const data=await request('modern_record_schema',{model:model.value,record_type:group.type,...(file.value?{file:file.value}:{})});source=(Array.isArray(data.fields)?data.fields:[]).map(f=>({...f,template:f.kind||f.template,originalTemplate:f.template,choices:Array.isArray(f.choices)?f.choices:[],deps:Array.isArray(f.deps)?f.deps:[]}))}catch(e){error.value=e.message;return}
 const fields=source.filter(f=>!['cbi/button','unsupported'].includes(f.template)&&(!f.readonly)&&(['cbi/value','cbi/tvalue','cbi/fvalue','cbi/lvalue','cbi/dynlist'].includes(f.template)||f.option==='name')).map(f=>({...f,id:'cbid.openclash.modern_draft_record.'+f.option,template:f.option==='name'?'cbi/value':f.template,optional:required.includes(f.option)?false:f.optional,section_type:group.type}))
 for(const key of Object.keys(draftValues))delete draftValues[key]
 for(const f of fields)draftValues[f.id]=f.option==='group'?['node','direct'].includes(dnsGroup.value)?'nameserver':dnsGroup.value:f.default??(f.template==='cbi/fvalue'?f.disabled:f.template==='cbi/dynlist'?[]:'')
 for(const [key,role]of [['node_resolve','node'],['direct_nameserver','direct']]){const f=fields.find(f=>f.option===key);if(f&&dnsGroup.value===role)draftValues[f.id]=f.enabled}
 for(const f of fields)if(!Array.isArray(draftValues[f.id]))draftValues[f.id]=String(draftValues[f.id]??'')
 const name=fields.find(f=>f.option==='name');if(name)draftValues[name.id]=''
 const enabled=fields.find(f=>f.option==='enabled');if(enabled)draftValues[enabled.id]=enabled.enabled
 draft.value={map,group,fields};draftError.value=''
}
const draftBasic=f=>['name','type','server','port','ip','group','username','password','uuid','cipher','security','address','provider_url'].includes(f.option)||(!f.optional&&f.template!=='cbi/fvalue')
async function submitDraft(){
 const invalid=draft.value.fields.filter(f=>dependsMatch(f,draftValues)).map(f=>[displayLabel(f),validateField(f,draftValues[f.id])]).filter(([,e])=>e)
 if(invalid.length){draftError.value=invalid.map(([label,error])=>`${label}：${error}`).join('；');return}
 loading.value=true;draftError.value=''
 try{const record=Object.fromEntries(draft.value.fields.filter(f=>dependsMatch(f,draftValues)&&draftValues[f.id]!==''&&draftValues[f.id]!=null).map(f=>[f.option,draftValues[f.id]]));if(model.value==='servers')record.config=file.value.split('/').pop()
 const response=await fetch(`${base}/modern_create_record`,{method:'POST',body:new URLSearchParams({token,model:model.value,...(file.value?{file:file.value}:{}),record_type:draft.value.group.type,record:JSON.stringify(record)})});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'创建失败')
 const category=tab.value,subtopic=topic.value;draft.value=null;await load();tab.value=category;await nextTick();topic.value=subtopic;await nextTick();recordId.value=result.section;recordPage.value=Math.max(0,Math.floor(records.value.findIndex(r=>r.row.id===result.section)/6));success.value='记录已保存，可在下面查看、编辑或删除。'
 }catch(e){draftError.value=e.message}finally{loading.value=false}
}
async function remove(map, row) { if (confirm(`确定删除“${rowTitle(row)}”？`)) await save(buttons.value.find(b => b.option === 'Commit'), { [`cbi.rts.${map.config}.${row.id}`]: '1' }) }
async function sort(map, group, index, delta) {
  const rows = [...group.rows], target = index + delta
  if (target < 0 || target >= rows.length) return
  ;[rows[index], rows[target]] = [rows[target], rows[index]]
  await save(buttons.value.find(b => b.option === 'Commit'), { [`cbi.sts.${map.config}.${group.type}`]: rows.map(r => r.id).join(' ') })
}
</script>
<template>
 <div class="oc-settings-top"><div><span class="oc-eyebrow">配置工作区</span><p>先选主题，再编辑参数或管理记录</p></div><button v-if="history.length" @click="back">← 返回记录列表</button><input v-model="search" type="search" aria-label="搜索配置项" placeholder="搜索参数名称…"></div>
 <nav v-if="!history.length && initialModel === 'settings'" class="oc-model-nav" aria-label="设置类别"><button v-for="[id,name] in models" :class="{active:model===id}" @click="changeModel({target:{value:id}})">{{name}}</button></nav>
 <label v-if="model==='servers'" class="oc-file-path">当前配置<input v-model="file" aria-label="节点配置文件" @change="load"></label>
 <div class="oc-tabs" role="tablist"><button v-for="t in tabs" :class="{active:tab===t.name}" role="tab" :aria-selected="tab===t.name" @click="tab=t.name">{{t.title}}</button></div>
 <p v-if="model === 'config-overwrite' && tab === 'dns'" class="oc-dns-intro">这里管理 OpenClash 内核的解析配置；不依赖代理的加密 DNS 保护在左侧“隐私监控”。按主题编辑基础行为，按用途管理上游服务器。</p><div v-if="topics.length>1&&!search" class="oc-topic-nav" aria-label="设置主题"><button v-for="t in topics" :class="{active:topic===t.name}" @click="topic=t.name;recordId=''">{{t.title}}</button></div>
 <p v-if="model==='config-subscribe'&&topic==='schedule'" class="oc-schedule-summary">{{scheduleSummary}}<small>执行日期与执行时刻组合成一条计划；并不是两种互相冲突的更新周期。</small></p>
 <p v-if="error" class="oc-error" role="alert">{{error}}</p><p v-if="success" class="oc-success" role="status">{{success}}</p>
 <p v-if="loading&&!schema" class="oc-muted">正在读取配置…</p>
 <template v-if="schema">
 <section v-if="collectionGroups.length&&!search" class="oc-record-browser">
  <header><div><h3>{{topics.length===1?categoryNames[tab]:topicNames[topic]||categoryNames[tab]}}</h3><p>{{records.length}} 条记录 · 选择记录查看或编辑，新建记录填写后才保存</p></div><div class="oc-actions"><button v-for="item in collectionGroups" :disabled="loading||preview" @click="create(item.map,item.group)">＋ 添加{{sectionLabel(item.group)}}</button></div></header>
  <div v-if="collectionGroups.some(g=>g.group.type==='dns_servers')" class="oc-dns-roles"><button v-for="(name,key) in dnsGroupNames" :class="{active:dnsGroup===key}" @click="dnsGroup=key;recordId=''">{{name}}<small>{{collectionGroups.flatMap(g=>g.group.rows).filter(r=>dnsRole(r,values)===key).length}}</small></button></div>
  <div class="oc-record-grid"><article v-for="item in pagedRecords" :class="{active:recordId===item.row.id}"><button class="oc-record-pick" @click="pickRecord(item.row)"><strong>{{rowTitle(item.row)}}</strong><small>{{rowSummary(item.row)}}</small></button><label v-if="rowEnabled(item.row)" class="oc-record-enable"><input type="checkbox" :checked="String(values[rowEnabled(item.row).id])===String(rowEnabled(item.row).enabled)" @change="toggleRow(item.row,$event)">使用此{{item.group.type==='dns_servers'?'服务器':item.group.type==='authentication'?'账号':'记录'}}</label><div class="oc-record-buttons"><button v-if="rowHasParameters(item.row)" @click="pickRecord(item.row)">参数</button><button v-if="item.group.extedit" @click="navigate(item.group.extedit.replace('%s',item.row.id))">完整详情</button><button v-if="item.group.sortable" :disabled="loading||item.group.rows.indexOf(item.row)===0" @click="sort(item.map,item.group,item.group.rows.indexOf(item.row),-1)">上移</button><button v-if="item.group.sortable" :disabled="loading||item.group.rows.indexOf(item.row)===item.group.rows.length-1" @click="sort(item.map,item.group,item.group.rows.indexOf(item.row),1)">下移</button><button @click="remove(item.map,item.row)">删除</button></div></article></div>
  <footer v-if="records.length>6" class="oc-record-pagination"><button :disabled="recordPage===0" @click="recordPage--">上一页</button><span>第 {{recordPage+1}} / {{recordPages}} 页 · 每页 6 条</span><button :disabled="recordPage+1===recordPages" @click="recordPage++">下一页</button></footer><p v-if="!records.length" class="oc-muted">这一组还没有记录。点击上方添加，填写完整后保存。</p>
 </section>
 <section v-if="statuses.length&&!search" class="oc-status-strip" aria-label="文件状态"><article v-for="item in statusRecords"><h4>{{rowTitle(item.row)}}</h4><div v-for="e in item.entries"><span>{{displayLabel(e.field)}}</span><strong>{{fieldValue(e.field)}}</strong></div></article></section>
 <div v-if="filtered.length" class="oc-setting-workspace">
  <aside class="oc-setting-list"><header class="oc-parameter-count">{{search?'搜索结果':currentRecord?rowTitle(currentRecord.row):topicNames[topic]||categoryNames[tab]}}<span>{{filtered.length}} 项</span></header><div class="oc-setting-items"><button v-for="entry in filtered" :key="entry.key" :class="{active:selected?.key===entry.key,invalid:localErrors[entry.field.id]||serverErrors[entry.field.id]}" @click="select(entry)"><span>{{displayLabel(entry.field)}}</span><small>{{fieldValue(entry.field)}}</small><i v-if="touched[entry.field.id]">•</i></button></div></aside>
  <section class="oc-setting-detail"><template v-if="selected"><header class="oc-detail-head"><div><span class="oc-eyebrow">{{categoryNames[selected.category]}} / {{topicNames[topicFor(selected.field,model,selected.group.type)]||sectionLabel(selected.group)}}</span><h2>{{displayLabel(selected.field)}}</h2></div><span class="oc-badge">{{isCommand(selected.field)?'操作':selected.field.template==='cbi/fvalue'?'开关':selected.field.optional?'可选':'必填'}}</span></header>
  <Field :key="selected.key" :field="selected.field" :values="values" :fields="allFields" :context="schema.context" :model="model" :section="section" :error="activeError" v-model="values[selected.field.id]" @update:model-value="changed" @action="save" @reload="load" @navigate="navigate" /></template></section>
 </div>
 <p v-else-if="!collectionGroups.length&&!statuses.length" class="oc-muted">没有匹配的参数。</p>
 <p v-if="unknownEditable.length" class="oc-error">存在无法读取的控件，保存已禁用：{{unknownEditable.map(f=>f.option).join('、')}}</p>
 <div class="oc-savebar"><span><strong>{{dirty?'有未保存的修改':'配置已同步'}}</strong><small> 所有修改通过校验后统一保存</small></span><div class="oc-actions"><button v-for="button in buttons" :class="{primary:button.option==='Commit'}" :disabled="preview||loading||unknownEditable.length>0" @click="button.option==='Back'&&history.length?back():save(button)">{{button.button||button.option}}</button></div></div>
 </template>
 <div v-if="draft" class="oc-modal-backdrop"><section class="oc-draft" role="dialog" aria-modal="true" :aria-label="'添加'+sectionLabel(draft.group)"><header><div><h2>添加{{sectionLabel(draft.group)}}</h2><p>填写并保存后才创建记录，取消不会改动配置。</p></div><button :disabled="loading" @click="draft=null">关闭</button></header><form @submit.prevent="submitDraft"><DraftField v-for="f in draft.fields.filter(f=>draftBasic(f)&&dependsMatch(f,draftValues))" :key="f.id" :field="f" :model="model" v-model="draftValues[f.id]"/><details class="oc-draft-advanced"><summary>更多参数与协议选项</summary><div><DraftField v-for="f in draft.fields.filter(f=>!draftBasic(f)&&f.option!=='enabled'&&dependsMatch(f,draftValues))" :key="f.id" :field="f" :model="model" v-model="draftValues[f.id]"/></div></details><p v-if="draftError" class="oc-error" role="alert">{{draftError}}</p><footer><button type="button" :disabled="loading" @click="draft=null">取消</button><button class="primary" :disabled="loading||preview">保存新记录</button></footer></form></section></div>
</template>
