import test from 'node:test'
import assert from 'node:assert/strict'
import {privacyProblem} from '../src/monitor-validation.js'
import {compareYaml} from '../src/file-compare.js'
import {createShareCodec} from '../src/share-codec.js'
test('encrypted resolver endpoint, bootstrap and reserved ports',()=>{
 const valid={monitor_enabled:'1',dns_enabled:'1',core_adapter:'1',disable_offload:'1',wan_interface:'auto',lan_interface:['br-lan'],resolver_url:'https://223.5.5.5/dns-query',fallback_url:'https://doh.pub/dns-query',resolver_ips:[],fallback_ips:['120.53.53.53'],dns_port:'53535',watch_domain:['example.com']}
 assert.equal(privacyProblem(valid),'');for(const bad of [{fallback_ips:[]},{dns_port:'53533'},{dns_port:'1e4'},{resolver_url:'http://223.5.5.5/dns-query'},{resolver_ips:['999.1.1.1']},{lan_interface:['name;command']}])assert.ok(privacyProblem({...valid,...bad}))
})
test('bounded semantic YAML comparison',async()=>{
 assert.deepEqual(await compareYaml('a: 1\nb: [x]','b: [x]\na: 2'),[{path:'a',before:'1',after:'2'}]);assert.deepEqual(await compareYaml('# note\na: 1','a: 1'),[]);await assert.rejects(()=>compareYaml('a: 1\na: 2',''));await assert.rejects(()=>compareYaml('x'.repeat(524289),''))
})
test('upstream sharing codec round trips supported credentials and Unicode names',()=>{
 for(const type of ['ss','vmess','vless','trojan']){
  const source={type,name:'实验节点',server:'example.com',port:'443',cipher:'aes-128-gcm',password:'lab-only-pass',uuid:'550e8400-e29b-41d4-a716-446655440000',alterId:'0',security:'auto',tls:'1',network:'tcp'}
  const values=Object.fromEntries(Object.entries(source).map(([k,v])=>[`cbid.openclash.fixture.${k}`,v]));const codec=createShareCodec(values,[]);const uri=codec.export('fixture');const restored={};createShareCodec(restored,[]).import(uri,'restored');assert.equal(restored['cbid.openclash.restored.type'],type);assert.equal(restored['cbid.openclash.restored.server'],source.server);assert.equal(restored['cbid.openclash.restored.port'],source.port)
 }
 assert.throws(()=>createShareCodec({},[]).import('file:///etc/config','invalid'))
})
