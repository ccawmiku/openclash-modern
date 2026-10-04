export const valueKey = (field) => field.id
const array = value => Array.isArray(value) ? value : []
export function normalizeSchema(schema) {
  return { ...schema, unsupported: array(schema.unsupported), maps: array(schema.maps).map(map => ({ ...map,
    sections: array(map.sections).map(section => ({ ...section, prototype: array(section.prototype).map(field=>({...field,template:field.kind||field.template,originalTemplate:field.template,choices:array(field.choices),deps:array(field.deps)})), tabs: array(section.tabs), rows: array(section.rows).map(row => ({ ...row,
      fields: array(row.fields).map(field => ({ ...field, template: field.kind || field.template, originalTemplate: field.template, choices: array(field.choices), deps: array(field.deps) }))
    })) }))
  })) }
}
export function dependsMatch(field, values) {
  if (!field.deps?.length) return true
  return field.deps.some(rule => {
    const entries = Object.entries(rule).filter(([key]) => !key.startsWith('!'))
    const matches = entries.map(([key, expected]) => {
      const id = key.startsWith('cbid.') ? key : key.includes('.') ? `cbid.${key}` : field.id.slice(0, field.id.lastIndexOf('.') + 1) + key
      const actual = values[id]
      return Array.isArray(actual) ? actual.map(String).includes(String(expected)) : String(actual ?? '') === String(expected)
    })
    const result = rule['!or'] ? matches.some(Boolean) : matches.every(Boolean)
    return rule['!reverse'] ? !result : result
  })
}
export function formPayload(schema, values, button, token) {
  const body = new URLSearchParams({ token, 'cbi.submit': '1' })
  for (const map of schema.maps) for (const group of map.sections) for (const row of group.rows) for (const field of row.fields) {
    if (!dependsMatch(field, values) || field.readonly || ['cbi/dvalue', 'cbi/button'].includes(field.template) || !field.template?.startsWith('cbi/')) continue
    const value = values[field.id]
    if (field.template === 'cbi/fvalue') {
      body.set(`cbi.cbe.${field.id.slice(5)}`, '1')
      if (String(value) === String(field.enabled)) body.set(field.id, field.enabled)
    } else if (Array.isArray(value)) value.forEach(v => body.append(field.id, v))
    else body.set(field.id, value ?? '')
  }
  if (button) body.set(button.id, '1')
  return body
}
export function errorsFromNativeDocument(doc, response) {
  const errors = [...doc.querySelectorAll('.cbi-value-error, .cbi-section-error, .cbi-input-invalid')]
    .map(el => el.textContent.trim() || el.getAttribute('title') || '配置值未通过校验')
  if (response.headers.get('X-CBI-State') === '0' && !errors.length) errors.push('配置未通过原生校验')
  return [...new Set(errors)]
}
