import { request as playwrightRequest } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { normalizeSchema, formPayload } from '../src/form.js'

// Only the loopback lab is allowed. No service start, apply, update or routing actions.
const base = 'http://127.0.0.1:18081/cgi-bin/luci/admin/services/openclash/'
const api = await playwrightRequest.newContext()
const configFile = '/etc/openclash/config/lab-example.yaml'
const models = {
  settings:{}, 'config-overwrite':{}, 'config-subscribe':{}, servers:{file:configFile},
  config:{}, 'proxy-provider-file-manage':{}, 'rule-providers-file-manage':{},
  'servers-config':{section:'lab_server',file:configFile},
  'groups-config':{section:'lab_group',file:configFile},
  'proxy-provider-config':{section:'lab_provider',file:configFile},
  'custom-dns-edit':{section:'lab_dns'}, 'config-subscribe-edit':{section:'lab_sub'},
  'other-file-edit':{section:'config',file:configFile}, client:{}, log:{}
}
const flatten = schema => schema.maps.flatMap(m => m.sections.flatMap(s => s.rows.flatMap(r => r.fields)))
async function schema(model) {
  const response = await api.get(base+'modern_schema', {params:{model,...models[model]}})
  if (!response.ok()) throw Error(`${model}: HTTP ${response.status()}`)
  const data = normalizeSchema(await response.json())
  if (data.error || data.unsupported.length || flatten(data).some(f=>f.template==='unsupported')) throw Error(`${model}: unreadable model`)
  return data
}
const valuesOf = fields => Object.fromEntries(fields.map(f=>[f.id, f.template==='cbi/fvalue' && (f.value==null || f.value==='') ? f.disabled : f.value]))
async function submit(model, data, values, endpoint='modern_validate') {
  const body = formPayload(data, values, null, '')
  for (const [key,value] of Object.entries({model,...models[model]})) body.set(key,value)
  const response = await api.post(base+endpoint, {data:body.toString(),headers:{'Content-Type':'application/x-www-form-urlencoded'}})
  if (!response.ok()) throw Error(`${model}: HTTP ${response.status()}`)
  return response.json()
}
try {
  // Initialize the same session as opening the preview after rpcd was restarted.
  const preview = await api.get(base+'modern')
  if (!preview.ok()) throw Error(`Preview initialization failed: ${preview.status()}`)
  const report = { models:{}, invalid_input:[], writes_on_rejection:false }
  for (const model of Object.keys(models)) {
    const data = await schema(model)
    report.models[model] = {fields:flatten(data).length,unreadable:0}
  }
  const original = await schema('settings'), fields = flatten(original), values = valuesOf(fields)
  if (fields.some(f=>f.originalTemplate==='openclash/oix_login')) throw Error('oixCloud field still exported')
  const delay = fields.find(f=>f.option==='delay_start'), mode = fields.find(f=>f.option==='en_mode')
  if (!delay || !mode) throw Error('Missing source setting')
  for (const [field,bad] of [[delay,'illegal-number'],[mode,'invalid-mode']]) {
    const result = await submit('settings',original,{...values,[field.id]:bad},'modern_submit')
    if (result.ok || !result.errors?.some(e=>e.field===field.id)) throw Error(`Invalid ${field.option} was accepted`)
    report.invalid_input.push(field.option)
  }
  // A valid edit preceding an invalid field must also remain uncommitted.
  const result = await submit('settings', original, {...values,[delay.id]:String(Number(values[delay.id]||0)+1),[mode.id]:'invalid-mode'},'modern_submit')
  if (result.ok) throw Error('Mixed invalid submission accepted')
  const current = valuesOf(flatten(await schema('settings')))
  report.writes_on_rejection = JSON.stringify(values)!==JSON.stringify(current)
  if (report.writes_on_rejection) throw Error('Rejected submission modified configuration')
  const provider = await schema('proxy-provider-config'), providerFields=flatten(provider), providerValues=valuesOf(providerFields)
  if (!providerFields.some(f=>f.id==='cbid.openclash.lab_provider.name')) throw Error('Named section did not retain its real record id')
  const url = providerFields.find(f=>f.option==='provider_url')
  if (!url) throw Error('Provider URL field missing')
  const badURL = await submit('proxy-provider-config',provider,{...providerValues,[url.id]:'javascript:alert(1)'})
  if (badURL.ok || !badURL.errors?.some(e=>e.field===url.id)) throw Error(`Provider URL validation failed: ${JSON.stringify({ok:badURL.ok, errors:badURL.errors,redirect:badURL.redirect})}`)
  report.invalid_input.push('provider_url')
  await writeFile('../artifacts/migration-test.json',JSON.stringify(report,null,2))
  console.log(JSON.stringify(report,null,2))
} finally { await api.dispose() }
