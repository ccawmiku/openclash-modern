import test from 'node:test'
import assert from 'node:assert/strict'
import { dependsMatch, formPayload, normalizeSchema } from '../src/form.js'
const field = (option, template, extra = {}) => ({ id: `cbid.openclash.config.${option}`, template, deps: [], enabled: '1', disabled: '0', ...extra })
test('Lua empty tables normalize without breaking tables and dependency checks', () => {
  const schema = normalizeSchema({ unsupported: {}, maps: [{ sections: [{ tabs: {}, rows: {} }] }] })
  assert.deepEqual(schema.unsupported, [])
  assert.deepEqual(schema.maps[0].sections[0].rows, [])
})
test('native CBI payload preserves flags, repeated lists and omits inactive dependencies', () => {
  const fields = [field('enabled', 'cbi/fvalue'), field('domains', 'cbi/dynlist'), field('nested', 'cbi/value', { deps: [{ enabled: '1' }] }), field('Commit', 'cbi/button')]
  const schema = { maps: [{ sections: [{ rows: [{ fields }] }] }] }
  const values = { [fields[0].id]: '0', [fields[1].id]: ['one.test', 'two.test'], [fields[2].id]: 'hidden' }
  const body = formPayload(schema, values, fields[3], 'session-csrf')
  assert.equal(body.get('token'), 'session-csrf')
  assert.equal(body.get('cbi.cbe.openclash.config.enabled'), '1')
  assert.equal(body.has(fields[0].id), false)
  assert.deepEqual(body.getAll(fields[1].id), ['one.test', 'two.test'])
  assert.equal(body.has(fields[2].id), false)
  assert.equal(body.get(fields[3].id), '1')
})
test('dependencies support cross-section, OR groups and inverse conditions', () => {
  const f = field('dependent', 'cbi/value', { deps: [{ 'openclash.other.mode': 'rule' }, { enabled: '1', '!reverse': true }] })
  assert.equal(dependsMatch(f, { 'cbid.openclash.other.mode': 'direct', 'cbid.openclash.config.enabled': '1' }), false)
  assert.equal(dependsMatch(f, { 'cbid.openclash.other.mode': 'rule', 'cbid.openclash.config.enabled': '1' }), true)
  assert.equal(dependsMatch(f, { 'cbid.openclash.config.enabled': '0' }), true)
})
