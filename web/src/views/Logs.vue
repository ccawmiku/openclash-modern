<script setup>
import { computed, ref, watch, defineAsyncComponent } from 'vue'
import { request, usePoll, base, token, preview } from '../api.js'
const Dashboard=defineAsyncComponent(()=>import('./Dashboard.vue'))
import { appendBounded } from '../log-buffer.js'
const lines = ref([]), cursor = ref(''), paused = ref(false), query = ref(''), error = ref(''), read = ref(0)
const tab=ref('plugin'),translated=ref(true),level=ref('info'),debugText=ref(''),debugBusy=ref(false)
watch(translated,()=>{lines.value=[];cursor.value=''})
usePoll(async signal => {
  if (paused.value||tab.value!=='plugin') return
  try {
    const data = await request('modern_log', {...(cursor.value?{cursor:cursor.value}:{}),translate:translated.value?'1':'0'}, signal)
    if (data.reset) lines.value = []
    cursor.value = data.cursor; read.value = data.bytes_read
    lines.value = appendBounded(lines.value, (data.display_text??data.text).split('\n').filter(Boolean))
    error.value = ''
  } catch (e) { error.value = e.message }
}, 2000)
async function mutate(name,params={}){try{const r=await fetch(`${base}/${name}`,{method:'POST',body:new URLSearchParams({...params,token})});if(!r.ok)throw Error(`操作失败 ${r.status}`);error.value='';return r}catch(e){error.value=e.message}}
async function clearLogs(){if(preview||!confirm('清空插件日志及启动日志？'))return;await mutate('modern_tools',{operation:'del_log'});await mutate('modern_tools',{operation:'del_start_log'});lines.value=[];cursor.value=''}
async function debug(generate){debugBusy.value=true;try{if(generate)await mutate('modern_debug');const r=await fetch(`${base}/get_debug_logs`,{cache:'no-store'});if(!r.ok)throw Error(`调试日志 ${r.status}`);const text=await r.text();debugText.value=text.slice(-1024*1024)}catch(e){error.value=e.message}finally{debugBusy.value=false}}
const displayed = computed(() => lines.value.filter(l => l.toLowerCase().includes(query.value.toLowerCase())))
function exportLog() {
  const url = URL.createObjectURL(new Blob([lines.value.join('\n')], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = 'openclash-visible.log'; a.click(); URL.revokeObjectURL(url)
}
</script>
<template><div class="oc-tabs" role="tablist"><button v-for="[id,label] in [['plugin','插件与落盘日志'],['core','内核实时日志'],['debug','调试日志']]" role="tab" :aria-selected="tab===id" :class="{active:tab===id}" @click="tab=id">{{label}}</button></div><p v-if="error" class="oc-error" role="alert">{{error}}</p>
<template v-if="tab==='plugin'"><div class="oc-toolbar"><input v-model="query" type="search" placeholder="筛选日志内容…" aria-label="筛选日志"><select :value="translated?'1':'0'" aria-label="日志翻译" @change="translated=$event.target.value==='1'"><option value="1">原版翻译</option><option value="0">原始文本</option></select><button @click="paused=!paused">{{paused?'继续更新':'暂停更新'}}</button><button @click="exportLog">导出当前日志</button><button :disabled="preview" @click="clearLogs">清空日志</button></div><div class="oc-log-meta"><span>{{displayed.length}} 行 · 最多保留 1,500 行</span><span>正文读取 {{read.toLocaleString()}} 字节</span></div><pre class="oc-log" aria-label="运行日志"><span v-if="!displayed.length" class="oc-muted">暂时没有日志</span><div v-for="(line,i) in displayed" :key="i" :class="{'oc-log-error':/\[(Error|Fatal|错误|致命)\]|level=error/i.test(line)}">{{line}}</div></pre><p class="oc-note">日志按游标增量读取，每次最多 128KB。隐藏或离开本视图停止请求。插件日志翻译复用上游词库；原文可随时切换。</p></template>
<template v-else-if="tab==='core'"><div class="oc-toolbar"><label>内核日志级别<select v-model="level"><option v-for="name in ['info','warning','error','debug','silent']">{{name}}</option></select></label><button :disabled="preview" @click="mutate('modern_log_level',{log_level:level})">设置运行级别</button></div><Dashboard initial-route="logs"/><p class="oc-note">原版面板直接连接内核日志流，保留过滤、暂停和下载功能；日志级别变更需要内核运行。</p></template>
<template v-else><div class="oc-toolbar"><button :disabled="debugBusy||preview" @click="debug(true)">生成调试日志</button><button :disabled="debugBusy||preview" @click="debug(false)">读取调试日志</button><a :href="`${base}/get_debug_logs`" download>下载完整调试日志</a></div><pre class="oc-log">{{debugText||'点击生成或读取调试日志。页面最多显示最近 1 MiB。'}}</pre></template></template>
