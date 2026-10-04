import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categoryFor,sectionLabel } from '../src/settings-structure.js'
import {displayLabel,recordValue}from '../src/field-help.js'
test('native settings and collection categories stay together after regrouping', () => {
  assert.equal(categoryFor({tab:'ipv6'}, 'settings'), 'traffic')
  assert.equal(categoryFor({tab:'dns'}, 'settings'), 'dns')
  assert.equal(categoryFor({}, 'settings', 'authentication'), 'access')
  assert.equal(categoryFor({}, 'config-overwrite', 'dns_servers'), 'dns')
  assert.equal(categoryFor({option:'reality_public_key'}, 'servers-config'), 'tls')
  assert.equal(categoryFor({option:'max_open_streams'}, 'servers-config'), 'udp')
  assert.equal(categoryFor({option:'grpc_service_name'}, 'servers-config'), 'transport')
})
test('node policy records have distinct categories and readable names',()=>{
 assert.equal(new Set(['groups','servers','proxy-provider','table'].map(type=>categoryFor({},'servers',type))).size,4)
 assert.equal(displayLabel({option:'name',section_type:'servers',label:'别名（请勿重名）'}),'节点名称')
 assert.equal(displayLabel({option:'name',section_type:'groups'}),'策略组名称')
 assert.equal(displayLabel({option:'Delete_Servers',label:' '}),'删除全部节点')
 assert.equal(sectionLabel({type:'proxy-provider'}),'节点来源（Provider）')
 assert.equal(recordValue({option:'type',section_type:'groups'},'fallback'),'故障切换')
})
