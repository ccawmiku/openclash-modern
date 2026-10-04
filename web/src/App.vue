<script setup>
import { computed, ref, defineAsyncComponent, onBeforeUnmount } from 'vue'
import { preview } from './api.js'
import Overview from './views/Overview.vue'
const Settings = defineAsyncComponent(() => import('./views/Settings.vue'))
const Logs = defineAsyncComponent(() => import('./views/Logs.vue'))
const Dashboard = defineAsyncComponent(() => import('./views/Dashboard.vue'))
const Security = defineAsyncComponent(() => import('./views/Security.vue'))
const NodeHealth = defineAsyncComponent(() => import('./views/NodeHealth.vue'))
const ConfigFiles = defineAsyncComponent(() => import('./views/ConfigFiles.vue'))
const MonitorSettings = defineAsyncComponent(() => import('./views/MonitorSettings.vue'))
const nav = [ ['overview', '概览', '01'], ['settings', '设置', '02'], ['nodes', '节点策略', '03'], ['health', '节点监控', '04'], ['dashboard', 'Dashboard', '05'], ['security', '隐私监控', '06'], ['files', '配置文件', '07'], ['logs', '运行日志', '08'] ]
const localLab=['localhost','127.0.0.1','::1'].includes(location.hostname)
const allowed=[...nav.map(n=>n[0]),'privacy-settings','node-settings']
const route=()=>location.hash.slice(1)
const page = ref(allowed.includes(route())?route():'overview'), dirty = ref(false)
const title = computed(() => ({'privacy-settings':'隐私监控设置','node-settings':'节点监控设置'})[page.value]||nav.find(n => n[0] === page.value)?.[1])
const activePage=computed(()=>({'privacy-settings':'security','node-settings':'health'})[page.value]||page.value)
function navigate(target) {
  if (dirty.value && !window.confirm('存在未保存的修改，确定离开？')) return
  if(!allowed.includes(target))return
  dirty.value = false; page.value = target
  if(route()!==target)location.hash=target
}
function syncRoute(){if(route()!==page.value){navigate(allowed.includes(route())?route():'overview');if(route()!==page.value)location.hash=page.value}}
window.addEventListener('hashchange',syncRoute);onBeforeUnmount(()=>window.removeEventListener('hashchange',syncRoute))
</script>
<template>
  <div class="oc-shell">
    <aside class="oc-sidebar">
      <div class="oc-brand"><span class="oc-mark">O</span><div>OpenClash<small>现代管理界面</small></div></div>
      <nav aria-label="主导航"><button v-for="[key, name, index] in nav" :key="key" :class="{ active: activePage === key }" @click="navigate(key)"><span>{{ name }}</span><small>{{ index }}</small></button></nav>
      <div class="oc-sidebar-foot"><span class="oc-dot"></span> 现代管理扩展<small>LuCI · Mihomo</small></div>
    </aside>
    <main class="oc-main">
      <header class="oc-header"><div><div class="oc-eyebrow">OPENCLASH / MANAGEMENT</div><h1>{{ title }}</h1></div><span class="oc-badge">{{ preview ? '界面演示 · 操作已禁用' : (localLab?'本机实验环境':'路由器管理') }}</span></header>
      <div v-if="preview" class="oc-notice">当前显示示例数据。真实配置读写与性能验证在隔离的 OpenWrt 虚拟机中进行。</div>
      <Overview v-if="page === 'overview'" @settings="navigate('settings')" @navigate="navigate" />
      <Settings v-else-if="page === 'settings' || page === 'nodes'" :key="page" :initial-model="page === 'nodes' ? 'servers' : 'settings'" @dirty="dirty = $event" />
      <ConfigFiles v-else-if="page === 'files'" @dirty="dirty = $event" />
      <Dashboard v-else-if="page === 'dashboard'" />
      <Security v-else-if="page === 'security'" @settings="navigate('privacy-settings')" />
      <NodeHealth v-else-if="page === 'health'" @settings="navigate('node-settings')" />
      <MonitorSettings v-else-if="page === 'privacy-settings'||page === 'node-settings'" :key="page" :kind="page==='privacy-settings'?'privacy':'node'" @dirty="dirty=$event" @back="navigate(page==='privacy-settings'?'security':'health')" />
      <Logs v-else-if="page === 'logs'" />
      <footer class="oc-footer">前端独立构建 · 配置逻辑复用 OpenClash <span>扩展版本 0.1</span></footer>
      <details v-if="page === 'overview'" open class="oc-note"><summary>上游项目与贡献者</summary><p><a v-for="name in ['Dreamacro','vernesong','frainzy1477','SukkaW','haishanh','Zephyruso','Alecthw','TindyX','lmc999','immortalwrt','MetaCubeX']" :href="`https://github.com/${name}`" target="_blank" rel="noreferrer" style="display:inline-block;margin:6px 12px 6px 0">{{name}}</a></p><a href="https://github.com/vernesong/OpenClash/graphs/contributors" target="_blank" rel="noreferrer">全部 OpenClash 贡献者 ↗</a></details>
    </main>
  </div>
</template>
