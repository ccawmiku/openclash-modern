import { onMounted, onUnmounted } from 'vue'
import { normalizeSchema } from './form.js'
const root = document.getElementById('openclash-modern')
export const preview = root.dataset.preview === 'true'
export const base = root.dataset.base || '/cgi-bin/luci/admin/services/openclash'
export const token = root.dataset.token || ''
export async function request(action, params = {}, signal) {
  if (preview) {
    const { fixtures } = await import('./fixtures.js')
    return structuredClone(fixtures(action, params))
  }
  const response = await fetch(`${base}/${action}?${new URLSearchParams(params)}`, { signal, credentials: 'same-origin', cache: 'no-store', headers: { 'Accept': 'application/json' } })
  if (response.headers.get('X-LuCI-Login-Required')) throw Error('登录已过期，请刷新页面登录')
  if (!response.ok) throw Error(`接口 ${action} 返回 ${response.status}`)
  const data = await response.json()
  if (data.error || data.status === 'error') throw Error(data.error || data.message)
  return action === 'modern_schema' ? normalizeSchema(data) : data
}
// Exactly one request at a time. Hidden/unmounted views stop polling and abort.
export function usePoll(work, interval = 5000) {
  let timer, controller, disposed = false
  async function run() {
    clearTimeout(timer)
    if (disposed || document.hidden || controller) return
    controller = new AbortController()
    try { await work(controller.signal) } catch (error) { if (error.name !== 'AbortError') console.warn(error.message) }
    finally { controller = null; if (!disposed && !document.hidden) timer = setTimeout(run, interval) }
  }
  function visibility() {
    clearTimeout(timer)
    if (document.hidden) controller?.abort()
    else run()
  }
  onMounted(() => { document.addEventListener('visibilitychange', visibility); run() })
  onUnmounted(() => { disposed = true; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', visibility) })
}
