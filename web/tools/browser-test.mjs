import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { normalizeSchema } from '../src/form.js'
const artifacts = resolve('../artifacts')
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'zh-CN' })
const page = await context.newPage()
const errors = []
page.on('response', async response => { if (response.status() === 500 && response.url().includes('modern_')) { try { console.log('Backend error:', (await response.json()).error) } catch {} } })
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
try {
  const url = 'http://127.0.0.1:18081/cgi-bin/luci/admin/services/openclash/modern'
  await page.goto(url)
  if (await page.locator('input[name="luci_username"]').count()) throw Error('Preview must open without login')
  await page.locator('.oc-shell').waitFor({ timeout: 20000 })
  const loginErrors = errors.splice(0)
  await page.getByRole('heading', { name: /独立内核运行中|服务已停止|OpenClash 运行中/ }).waitFor()
  await page.screenshot({ path: resolve(artifacts, 'overview-desktop.png'), fullPage: true })
  await page.locator('.oc-sidebar nav').getByRole('button', { name: /设置/ }).click()
  const schemaResponse = await page.request.get(url.replace('/modern', '/modern_schema?model=settings'))
  const schema = normalizeSchema(await schemaResponse.json())
  if (!schemaResponse.ok()) throw Error(JSON.stringify(schema))
  await page.locator('.oc-savebar').waitFor({ timeout: 20000 })
  const desktopHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  const categoryCount = await page.getByRole('tab').count()
  if (desktopHeight > 1250 || categoryCount !== 7) throw Error(`Settings layout is too long or wrongly grouped: ${desktopHeight}px, ${categoryCount} categories`)
  const fields = schema.maps.flatMap(m => m.sections.flatMap(s => s.rows.flatMap(r => r.fields)))
  const summary = {
    schema_status: schemaResponse.status(), fields: fields.length,
    tabs: schema.maps.flatMap(m => m.sections.flatMap(s => s.tabs.map(t => t.title))),
    templates: [...new Set(fields.map(f => f.template))], unsupported: schema.unsupported,
    page_errors: errors, login_page_errors: loginErrors,
    desktop_height: desktopHeight, categories: categoryCount,
  }
  console.log(JSON.stringify({ fields: summary.fields, tabs: summary.tabs, templates: summary.templates }))
  await page.getByRole('searchbox', { name: '搜索配置项' }).fill('small_flash_memory')
  await page.locator('input[type="checkbox"][id$=".small_flash_memory"]').waitFor()
  summary.switch_help_compact = await page.locator('.oc-field-help dt').filter({hasText:/^(填写要求|填写内容|合法范围|生效条件)$/}).count() === 0
  if (!summary.switch_help_compact || !await page.locator('.oc-field-help dt').filter({hasText:'推荐设置'}).count()) throw Error('Switch help should only show purpose and recommendations')
  await page.screenshot({path:resolve(artifacts,'switch-help-desktop.png'),fullPage:true})
  await page.getByRole('searchbox', { name: '搜索配置项' }).fill('delay_start')
  await page.locator('input[id$=".delay_start"]').waitFor()
  if (await page.locator('.oc-field-help dt').filter({hasText:/^填写要求$/}).count() !== 1) throw Error('Non-switch parameter help is missing')
  await page.screenshot({ path: resolve(artifacts, 'settings-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: resolve(artifacts, 'settings-mobile.png'), fullPage: true })
  summary.help_expanded = await page.locator('.oc-field-help').isVisible()
  summary.oixcloud_removed = !await page.getByRole('tab', { name: /oixCloud/i }).count()
  summary.rendered_fields = await page.locator('.oc-field').count()
  summary.mobile_overflow = await page.locator('#openclash-modern').evaluate(el => el.scrollWidth > el.clientWidth + 1)
  const before = await page.locator('input[id$=".delay_start"]').inputValue()
  await page.locator('input[id$=".delay_start"]').fill('invalid-integer')
  const save = page.locator('.oc-savebar button').filter({ hasText: /Commit|保存|提交/ }).first()
  summary.save_disabled = await save.isDisabled()
  if (!summary.save_disabled) {
    await save.click()
    await page.locator('.oc-error').waitFor({ timeout: 20000 })
    summary.invalid_integer_rejected = true
    await page.locator('input[id$=".delay_start"]').fill(before)
    await save.click()
    await page.locator('.oc-success').waitFor({ timeout: 20000 })
    summary.valid_form_saved = true
  }
  await page.locator('.oc-sidebar nav').getByRole('button', { name: /运行日志/ }).click()
  await page.locator('.oc-log').waitFor()
  summary.new_log_response = (await page.request.get(url.replace('/modern', '/modern_log'))).status()
  await page.locator('.oc-log').getByText(/Local VM synthetic log/).waitFor()
  let requestsAfterLeaving = 0
  const countLog = request => { if (request.url().includes('/modern_log')) requestsAfterLeaving++ }
  await page.locator('.oc-sidebar nav').getByRole('button', { name: /配置文件/ }).click()
  await page.getByRole('heading', { name: '配置文件', exact: true }).first().waitFor()
  page.on('request', countLog)
  await page.waitForTimeout(2300)
  page.off('request', countLog)
  summary.log_requests_after_leaving = requestsAfterLeaving
  await page.locator('.oc-files aside').getByRole('button', { name: /lab-example.yaml/ }).click()
  const editor = page.getByRole('textbox', { name: '配置文件内容' })
  const originalFile = await editor.inputValue()
  const changedFile = originalFile + '# browser integration round-trip\n'
  await editor.fill(changedFile)
  await page.getByRole('button', { name: '保存文件', exact: true }).click()
  await page.locator('.oc-success').waitFor()
  const readFile = async () => (await (await page.request.get(url.replace('/modern', '/config_file_read?config_file=/etc/openclash/config/lab-example.yaml'))).json()).content
  summary.file_roundtrip = (await readFile()) === changedFile
  await editor.fill(originalFile)
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/modern_file_save') && response.request().method() === 'POST'),
    page.getByRole('button', { name: '保存文件', exact: true }).click()
  ])
  summary.file_restored = (await readFile()) === originalFile
  summary.model_reads = {}
  for (const model of ['config-overwrite', 'config-subscribe']) {
    const response = await page.request.get(url.replace('/modern', `/modern_schema?model=${model}`))
    summary.model_reads[model] = response.status()
  }
  for (const action of ['modern_action', 'modern_file_save']) {
    summary[`${action}_get_status`] = (await page.request.get(url.replace('/modern', `/${action}`))).status()
    summary[`${action}_no_token_status`] = (await page.request.post(url.replace('/modern', `/${action}`), { form: { action: 'invalid' } })).status()
  }
  await writeFile(resolve(artifacts, 'browser-test.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ ...summary, unsupported: `${summary.unsupported.length} unreadable controls` }, null, 2))
  if (errors.length || !summary.help_expanded || !summary.oixcloud_removed || summary.rendered_fields !== 1 || summary.mobile_overflow || summary.save_disabled || !summary.invalid_integer_rejected || !summary.valid_form_saved || summary.new_log_response !== 200 || summary.log_requests_after_leaving || !summary.file_roundtrip || !summary.file_restored || Object.values(summary.model_reads).some(s => s !== 200) || summary.modern_action_get_status !== 405 || summary.modern_action_no_token_status !== 400) throw Error('Browser integration checks failed')
} catch (error) {
  await page.screenshot({ path: resolve(artifacts, 'browser-failure.png'), fullPage: true })
  const html = (await page.content()).replace(/data-token="[^"]*"/g, 'data-token="REDACTED"').replace(/"(sessionid|token)"\s*:\s*"[^"]*"/g, '"$1":"REDACTED"')
  await writeFile(resolve(artifacts, 'browser-failure.html'), html)
  console.error(error.message, errors)
  process.exitCode = 1
} finally { await browser.close() }

