import {chromium,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100},locale:'zh-CN'}),errors=[],report={}
const root='http://127.0.0.1:18081',base=root+'/cgi-bin/luci/admin/services/openclash'
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
const nav=name=>page.locator('.oc-sidebar nav').getByRole('button',{name:new RegExp(name)})
const model=name=>page.locator('.oc-model-nav').getByRole('button',{name,exact:true})
const schema=async name=>(await page.request.get(base+'/modern_schema?model='+name+(name==='servers'?'&file=/etc/openclash/config/lab-example.yaml':''))).json()
const dnsRows=s=>s.maps.flatMap(m=>m.sections).find(g=>g.type==='dns_servers').rows
try{
 await page.goto(root);await page.locator('.oc-home-metrics article').first().waitFor();await expect(page.locator('.oc-home-metrics article')).toHaveCount(8)
 await page.waitForTimeout(6000);const metrics=await(await page.request.get(base+'/modern_metrics')).json();if(!metrics.core_available||metrics.cpu_percent==null||!metrics.memory_total)throw Error('Missing measured overview metrics')
 report.real_metrics=true;report.home_expanded=await page.locator('.oc-control-section').isVisible()&&await page.locator('.oc-traffic-chart').isVisible()
 let active=0,max=0,ids=[]
 await page.route('**/modern_myip?*',async route=>{const id=new URL(route.request().url()).searchParams.get('provider');ids.push(id);active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,180));active--;await route.fulfill({status:id==='pcol'?502:200,contentType:'application/json',body:JSON.stringify(id==='pcol'?{error:'单个服务不可达'}:{content:JSON.stringify({ip:'192.0.2.10',country:'测试',region:'示例地区'})})})})
 await page.getByRole('button',{name:'查询全部出口',exact:true}).click();await expect(page.getByRole('button',{name:'查询全部出口',exact:true})).toBeEnabled();if(new Set(ids).size!==4||max!==4)throw Error('Exit queries were not concurrent')
 await expect(page.locator('.oc-exit-grid article')).toHaveCount(4);if(await page.locator('.oc-exit-grid').getByText('查询失败',{exact:true}).count()!==1)throw Error('Exit errors not isolated')
 report.four_exit_queries_parallel=true;await page.screenshot({path:'../artifacts/home-rework-desktop.png',fullPage:true});await page.unroute('**/modern_myip?*')
 await page.setViewportSize({width:390,height:844});report.home_mobile_overflow=await page.locator('#openclash-modern').evaluate(e=>e.scrollWidth>e.clientWidth+1);await page.screenshot({path:'../artifacts/home-rework-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1100})
 await nav('设置').click();await model('覆写设置').waitFor();await expect(page.locator('.oc-model-nav button')).toHaveCount(7)
 if(await page.getByText('上游项目与贡献者',{exact:true}).count())throw Error('Credits shown outside home')
 await page.getByRole('searchbox',{name:'搜索配置项'}).fill('wan_interfaces');await page.waitForTimeout(150);if((await page.locator('.oc-setting-items').textContent()).includes('[]'))throw Error('Raw empty array shown')
 await page.getByRole('searchbox',{name:'搜索配置项'}).fill('flush_dns_cache');await page.getByRole('heading',{name:'清理 DNS 缓存',exact:true}).waitFor();if(await page.locator('.oc-field-help dt').getByText(/填写要求|推荐设置/).count())throw Error('Action has irrelevant help')
 report.command_help_compact=true
 await model('覆写设置').click();await page.getByRole('tab',{name:'DNS 解析',exact:true}).click();await page.locator('.oc-topic-nav').getByRole('button',{name:'上游服务器',exact:true}).click();await page.getByRole('button',{name:'＋ 添加DNS 上游',exact:true}).waitFor()
 const before=dnsRows(await schema('config-overwrite')).map(r=>r.id).sort()
 await page.getByRole('button',{name:'＋ 添加DNS 上游',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'取消',exact:true}).click();if(JSON.stringify(dnsRows(await schema('config-overwrite')).map(r=>r.id).sort())!==JSON.stringify(before))throw Error('Cancel created a record')
 report.cancel_creates_nothing=true
 await page.getByRole('button',{name:'＋ 添加DNS 上游',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'保存新记录',exact:true}).click();await page.locator('.oc-draft .oc-error').waitFor();if(dnsRows(await schema('config-overwrite')).length!==before.length)throw Error('Invalid draft created a record')
 await page.locator('.oc-draft-field').filter({hasText:/^服务器地址/}).locator('input').fill('192.0.2.53');await page.getByRole('button',{name:'保存新记录',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden',timeout:20000});const created=dnsRows(await schema('config-overwrite')).filter(r=>!before.includes(r.id));if(created.length!==1)throw Error('Validated record not saved')
 const card=page.locator('.oc-record-grid article').filter({hasText:'192.0.2.53'});await card.getByRole('button',{name:'参数',exact:true}).click();await page.getByRole('heading',{name:'解析用途',exact:true}).waitFor();await page.screenshot({path:'../artifacts/dns-hierarchy-desktop.png',fullPage:true})
 await card.getByRole('button',{name:'完整详情',exact:true}).click();await page.getByRole('button',{name:'← 返回记录列表',exact:true}).waitFor();await page.screenshot({path:'../artifacts/dns-detail-desktop.png',fullPage:true});await page.getByRole('button',{name:'← 返回记录列表',exact:true}).click();await page.getByRole('tab',{name:'DNS 解析',exact:true}).click();await page.locator('.oc-topic-nav').getByRole('button',{name:'上游服务器',exact:true}).click();await page.locator('.oc-record-grid article').filter({hasText:'192.0.2.53'}).getByRole('button',{name:'删除',exact:true}).click();await page.locator('.oc-success').waitFor();if(dnsRows(await schema('config-overwrite')).length!==before.length)throw Error('Delete did not remove record')
 report.dns_create_view_detail_delete=true
 await page.getByRole('tab',{name:'基础配置',exact:true}).click();await page.locator('.oc-topic-nav').getByRole('button',{name:'代理入口认证',exact:true}).click();await page.getByRole('button',{name:'＋ 添加代理认证',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'取消',exact:true}).click();report.authentication_has_record_ui=true
 await model('订阅设置').click();await expect(page.locator('.oc-schedule-summary')).toBeVisible();report.schedule_combined=true;await page.screenshot({path:'../artifacts/subscription-schedule-desktop.png',fullPage:true})
 await model('配置与文件管理').click();await page.locator('.oc-status-strip').waitFor();if(await page.locator('.oc-setting-items button').filter({hasText:/更新时间|修改时间|配置状态/}).count())throw Error('Read-only state still treated as editable setting');report.readonly_status_cards=true
 await nav('节点策略').click();await page.locator('.oc-record-grid article').first().waitFor();await page.screenshot({path:'../artifacts/node-policies-rework-desktop.png',fullPage:true})
 await page.setViewportSize({width:390,height:844});report.settings_mobile_overflow=await page.locator('#openclash-modern').evaluate(e=>e.scrollWidth>e.clientWidth+1);await page.screenshot({path:'../artifacts/records-rework-mobile.png',fullPage:true})
 report.page_errors=errors;if(report.home_mobile_overflow||report.settings_mobile_overflow||errors.length)throw Error(JSON.stringify(report))
 await writeFile('../artifacts/ui-rework-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}catch(e){await page.screenshot({path:'../artifacts/ui-rework-failure.png',fullPage:true});console.error(e,errors);process.exitCode=1}finally{await browser.close()}
