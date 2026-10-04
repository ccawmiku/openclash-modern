import { test } from 'node:test'
import assert from 'node:assert/strict'
import { datatypeValid, validateField, validateYaml } from '../src/validation.js'

test('address and port validators reject malformed values and range boundaries', () => {
  for (const [type, good, bad] of [
    ['ip4addr', ['0.0.0.0', '192.168.1.1'], ['256.1.1.1', '01.2.3.4']],
    ['ip6addr', ['::1', '2001:db8::1'], ['1::2::3', '::gg']],
    ['cidr4', ['198.18.0.1/16'], ['198.18.0.1/33', '198.18.0.1']],
    ['ipmask', ['192.168.1.0/255.255.255.0'], ['192.168.1.0/255.0.255.0']],
    ['port', ['0', '65535'], ['-1', '65536', '1.5']],
    ['or(port, portrange)', ['443', '10000-20000'], ['20000-10000', '0-65536']],
    ['range(0,63)', ['0', '63'], ['64', '-1']]
  ]) {
    good.forEach(value => assert.equal(datatypeValid(type, value), true, `${type}: ${value}`))
    bad.forEach(value => assert.equal(datatypeValid(type, value), false, `${type}: ${value}`))
  }
})
test('selection, UUID, URL and sampling validation rejects illegal input', () => {
  const field = (option, extra = {}) => ({ option, template:'cbi/value', optional:true, ...extra })
  assert.ok(validateField(field('mode', { template:'cbi/lvalue', choices:[{value:'rule'}] }), 'injected'))
  assert.equal(validateField(field('uuid'), '00000000-0000-4000-8000-000000000000'), '')
  assert.ok(validateField(field('uuid'), 'not-a-uuid'))
  assert.ok(validateField(field('test_url'), 'javascript:alert(1)'))
  assert.equal(validateField(field('test_url'), 'https://example.com/check'), '')
  assert.ok(validateField(field('smart_collect_rate'), '1.01'))
  assert.equal(validateField(field('smart_collect_rate'), '0.25'), '')
  assert.ok(validateField(field('reality_short_id'), 'abc'))
  assert.ok(validateField(field('log_size'), '100\0'))
  assert.ok(validateField(field('server', { optional:false }), ''))
})
test('YAML syntax and duplicate keys are rejected before save', async () => {
  assert.equal(await validateYaml('mixed-port: 7890\nproxies: []\n'), '')
  assert.ok(await validateYaml('proxies: [\n'))
  assert.ok(await validateYaml('mixed-port: 7890\nmixed-port: 7891\n'))
  assert.equal(await validateYaml('custom: &values [1, 2]\ncopy: *values\n'), '')
})
