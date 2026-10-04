import { readFile, writeFile } from 'node:fs/promises'
import { fieldHelp } from '../src/field-help.js'
import { customTemplates, structuralTemplates } from '../src/widget-registry.js'
const models = JSON.parse(await readFile('../artifacts/all-model-schema.json', 'utf8'))
const missing = [], unknownTemplates = new Set(), unique = new Set()
let total = 0
for (const [model, data] of Object.entries(models)) {
  for (const field of data.fields || []) {
    const id = `${model}:${field.option}`
    if (unique.has(id)) continue
    unique.add(id); total++
    const help = fieldHelp({ ...field, originalTemplate: field.template, template: field.kind, choices: Array.isArray(field.choices) ? field.choices : [], deps: [] }, model)
    if (help.purpose.includes('是当前配置条目的')) missing.push({ model, option: field.option, label: field.label })
    if (!help.format || !help.recommended || !help.required) throw Error(`Incomplete structured help: ${id}`)
  }
  for (const item of Array.isArray(data.templates) ? data.templates : []) {
    if (!customTemplates.includes(item.template) && !structuralTemplates.includes(item.template)) unknownTemplates.add(item.template)
  }
}
await writeFile('../artifacts/help-audit.json', JSON.stringify({ total, missing, unknownTemplates: [...unknownTemplates] }, null, 2))
console.log(JSON.stringify({ total, missing, unknownTemplates: [...unknownTemplates] }, null, 2))

