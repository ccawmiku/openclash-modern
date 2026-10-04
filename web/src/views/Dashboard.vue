<script setup>
import { computed, onMounted, ref } from 'vue'
import { preview, request } from '../api.js'
const props=defineProps({initialRoute:String})
const configured = ref(localStorage.getItem('oc.dashboard.url') || ''), detected = ref(''), error = ref(''), generation = ref(0)
const validURL = value => {
  try { const u = new URL(value, location.origin); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password && !(location.protocol==='https:' && u.protocol==='http:') ? u.href : '' } catch { return '' }
}
const address = computed(() => {const value=validURL(configured.value||detected.value);if(!value||!props.initialRoute)return value;const url=new URL(value);const query=url.hash.split('?')[1];url.hash='/'+props.initialRoute+(query?'?'+query:'');return url.href})
onMounted(async () => { if (!preview) try { const data = await request('modern_dashboard_info'); detected.value = data.url || '' } catch(e) { error.value=e.message } })
function save() { if (configured.value && !validURL(configured.value)) {error.value='请输入 HTTP / HTTPS 面板地址；HTTPS 管理页需要 HTTPS 面板。';return} localStorage.setItem('oc.dashboard.url',configured.value);error.value='';generation.value++ }
</script>
<template>
 <div class="oc-toolbar oc-dashboard-tools"><input v-model="configured" aria-label="Dashboard 地址" :placeholder="detected || '独立部署的 MetaCubeXD 地址'" @keyup.enter="save"><button @click="save">保存地址</button><button @click="generation++">重新加载</button><a v-if="address" :href="address" target="_blank" rel="noopener noreferrer">独立打开 ↗</a></div>
 <p v-if="error" class="oc-error">{{error}}</p>
 <iframe v-if="address && !preview" :key="address+generation" :src="address" class="oc-dashboard-frame" title="MetaCubeXD Dashboard" referrerpolicy="no-referrer" allow="clipboard-write; fullscreen"></iframe>
 <div v-else class="oc-empty">{{preview ? '演示模式不连接 Dashboard' : '未找到本机面板，请先安装 MetaCubeXD 或填写它的独立地址。'}}</div>
 <p class="oc-note">直接加载原版面板，管理页不修改它的资源、界面或 API。面板与内核可分别更新；连接地址和访问密钥在原版面板中配置。</p>
</template>
