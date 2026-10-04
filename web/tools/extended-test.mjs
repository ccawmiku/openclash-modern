import {chromium,request} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
import {normalizeSchema,formPayload} from '../src/form.js'
const host='http://127.0.0.1:18081',base=host+'/cgi-bin/luci/admin/services/openclash/',privacy=host+'/cgi-bin/luci/admin/services/router_privacy/',health=host+'/cgi-bin/luci/admin/services/router_node_health/'
const api=await request.newContext(),report={},browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('response',r=>{if(r.url()==='http://127.0.0.1:19090/version'&&r.status()===200)report.dashboard_api_connected=true})
page.on('console',m=>{if(m.type()==='error'&&m.location().url.startsWith(host+'/'))errors.push(m.text())})
async function get(url){const r=await api.get(url);if(!r.ok())throw Error(`${url}: ${r.status()}`);return r.json()}
const flatten=s=>s.maps.flatMap(m=>m.sections.flatMap(s=>s.rows.flatMap(r=>r.fields)))
async function schema(model,extra={}){return normalizeSchema(await get(base+'modern_schema?'+new URLSearchParams({model,...extra})))}
async function submit(model,s,extra={}){const fields=flatten(s),values=Object.fromEntries(fields.map(f=>[f.id,f.value])),body=formPayload(s,values,null,'');body.set('model',model);for(const[k,v]of Object.entries(extra))body.set(k,v);const r=await api.post(base+'modern_submit',{form:Object.fromEntries(body)});if(!r.ok())throw Error(`submit ${model} ${r.status()}`);const d=await r.json();if(!d.ok)throw Error(JSON.stringify(d));return d}
async function bad(url,config){const r=await api.post(url,{form:{config:JSON.stringify(config)}});if(r.status()!==400)throw Error(`Invalid config accepted ${r.status()}`)}
try{
 await get(base+'modern_dashboard_info')
 const before=await get(privacy+'settings')
 for(const config of [{lan_interface:'bad-type'},{fallback_ips:{bad:'1.1.1.1'}},{dns_enabled:true},{resolver_url:'https://223.5.5.5:evil/dns-query'},{resolver_url:'http://223.5.5.5/dns-query'},{unexpected:'key'}])await bad(privacy+'configure',config)
 if(JSON.stringify(before)!==JSON.stringify(await get(privacy+'settings')))throw Error('Invalid privacy request changed UCI')
 for(const config of [{interval:'1'},{timeout:3000},{targets:['http://example.com/']},{targets:{url:'https://example.com/'}},{enabled:'yes'}])await bad(health+'configure',config)
 report.strict_validation=true
 const original=await schema('config-subscribe'),oldIds=new Set(original.maps.flatMap(m=>m.sections.flatMap(s=>s.rows.map(r=>r.id))))
 const group=original.maps.flatMap(m=>m.sections).find(s=>s.type==='config_subscribe')
 await submit('config-subscribe',original,{[`cbi.cts.openclash.${group.type}.new`]:'1'})
 let created=await schema('config-subscribe');const sid=created.maps.flatMap(m=>m.sections.filter(s=>s.type===group.type).flatMap(s=>s.rows)).find(r=>!oldIds.has(r.id))?.id
 if(!sid)throw Error('CBI create did not add subscription')
 try{
  const detail=await schema('config-subscribe-edit',{section:sid});const fields=flatten(detail),values=Object.fromEntries(fields.map(f=>[f.id,f.value]));for(const f of fields){if(f.option==='name')values[f.id]='lab-roundtrip';if(f.option==='address')values[f.id]='https://example.com/lab.yaml'}
  const body=formPayload(detail,values,null,'');body.set('model','config-subscribe-edit');body.set('section',sid);const r=await api.post(base+'modern_submit',{form:Object.fromEntries(body)});const d=await r.json();if(!d.ok)throw Error(JSON.stringify(d));const saved=flatten(await schema('config-subscribe-edit',{section:sid}));if(saved.find(f=>f.option==='name')?.value!=='lab-roundtrip')throw Error('Subscription update did not persist')
  report.subscription_crud=true
 }finally{created=await schema('config-subscribe');await submit('config-subscribe',created,{[`cbi.rts.openclash.${sid}`]:'1'})}
 const name='lab-modern-overwrite.yaml',form={filename:name,old_filename:'',type:'file',url:'',config:'lab-example.yaml',enable:'0',order:'1',update_days:'',update_hour:'',param:'',operation:'upload',config_file:'rules: []\n'}
 let r=await api.post(base+'modern_overwrite',{form}),d=await r.json();if(!r.ok()||d.status==='error'||d.error)throw Error(JSON.stringify(d))
 try{
  const text=await get(base+'config_file_read?'+new URLSearchParams({config_file:'/etc/openclash/overwrite/'+name}));if(text.content!==form.config_file)throw Error('Overwrite upload did not persist')
  const invalid=await api.post(base+'modern_overwrite',{form:{...form,order:'invalid',config_file:'changed'}});if(invalid.status()!==400)throw Error('Invalid overwrite order accepted')
  const unchanged=await get(base+'config_file_read?'+new URLSearchParams({config_file:'/etc/openclash/overwrite/'+name}));if(unchanged.content!==form.config_file)throw Error('Invalid overwrite modified file')
  report.overwrite_roundtrip=true
 }finally{await api.post(base+'modern_overwrite',{form:{...form,operation:'delete'}})}
 await page.goto(host);await page.locator('.oc-shell').waitFor();await page.locator('nav').getByRole('button',{name:/Dashboard/}).click();await page.locator('.oc-dashboard-frame').waitFor();await page.waitForTimeout(1500)
 report.dashboard_url=await page.locator('iframe').getAttribute('src');report.dashboard_http=(await api.get(report.dashboard_url)).status();if(report.dashboard_http!==200)throw Error('Embedded original dashboard unavailable')
 const frame=page.frameLocator('iframe');await page.waitForTimeout(1500);if(await frame.locator('#url').isVisible()){await frame.locator('#url').fill('http://127.0.0.1:19090');await frame.getByRole('button',{name:'连接',exact:true}).click();await frame.locator('#url').waitFor({state:'hidden',timeout:15000})}
 if(!report.dashboard_api_connected)throw Error('Original dashboard did not connect to standard Mihomo API')
 await page.screenshot({path:'../artifacts/dashboard-desktop.png',fullPage:true})
 await page.locator('nav').getByRole('button',{name:/节点监控/}).click();await page.getByRole('heading',{name:'持续监控中',exact:true}).waitFor();await page.getByRole('button',{name:/Lab-Healthy/}).click();await page.locator('.oc-health-chart').waitFor();await page.screenshot({path:'../artifacts/node-health-desktop.png',fullPage:true})
 report.node_history=(await get(health+'status?node=Lab-Healthy')).detail.samples.length
 const successfulPoints=page.locator('.oc-health-chart circle[fill="#2563eb"]');if(!await successfulPoints.count()||!await page.locator('.oc-health-chart polyline').count())throw Error('Healthy samples were not drawn as latency points')
 if(Number(await successfulPoints.first().getAttribute('cy'))>=190)throw Error('Latency curve incorrectly drawn at zero')
 if(await page.locator('.oc-health-hour span').count()!==168)throw Error('Seven-day hourly timeline incomplete')
 report.latency_curve_measured=true
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'../artifacts/node-health-mobile.png',fullPage:true});report.health_mobile_overflow=await page.locator('#openclash-modern').evaluate(el=>el.scrollWidth>el.clientWidth+1)
 await page.locator('nav').getByRole('button',{name:/隐私监控/}).click();await page.getByRole('heading',{name:'独立保护运行中',exact:true}).waitFor();await page.screenshot({path:'../artifacts/security-mobile.png',fullPage:true});report.security_mobile_overflow=await page.locator('#openclash-modern').evaluate(el=>el.scrollWidth>el.clientWidth+1)
 await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'../artifacts/security-desktop.png',fullPage:true});let polling=0;const listener=r=>{if(r.url().includes('/router_privacy/status')||r.url().includes('/router_node_health/status'))polling++};await page.locator('nav').getByRole('button',{name:/概览/}).click();page.on('request',listener);await page.waitForTimeout(5500);page.off('request',listener);report.polling_after_leave=polling;report.page_errors=errors
 if(report.health_mobile_overflow||report.security_mobile_overflow||polling||errors.length)throw Error(JSON.stringify(report))
 await page.locator('nav').getByRole('button',{name:/节点策略/}).click();await page.getByRole('tab',{name:'代理节点',exact:true}).click();const nodeCard=page.locator('.oc-record-grid article').first();await nodeCard.waitFor();if(!(await nodeCard.innerText()).includes('Lab-Server'))throw Error('Node record identity missing')
 for(const name of ['策略组','代理节点','节点来源（Provider）','导入与批量操作'])if(!await page.getByRole('tab',{name,exact:true}).count())throw Error('Node policy categories missing')
 if(await page.locator('.oc-setting-items button').filter({hasText:'策略组名称'}).count())throw Error('Group fields still mixed into node category')
 await page.screenshot({path:'../artifacts/node-policies-desktop.png',fullPage:true});report.node_policy_categories_separated=true;await nodeCard.getByRole('button',{name:'完整详情',exact:true}).click();await page.getByRole('button',{name:'← 返回记录列表',exact:true}).waitFor();await page.locator('.oc-setting-items button').first().waitFor();report.node_record_detail_navigation=true
 await writeFile('../artifacts/extended-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}catch(e){await page.screenshot({path:'../artifacts/extended-failure.png',fullPage:true});console.error(e,errors);process.exitCode=1}finally{await browser.close();await api.dispose()}
