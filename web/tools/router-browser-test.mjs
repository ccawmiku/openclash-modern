// Read-only production UI acceptance; credentials and screenshots stay private.
import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const host=process.env.ROUTER_HOST,password=process.env.ROUTER_PASSWORD
if(!host||!password)throw Error('Explicit ROUTER_HOST and ROUTER_PASSWORD required')
const url=`http://${host}/cgi-bin/luci/admin/services/openclash/modern`
const folder='../.private/router';await mkdir(folder,{recursive:true})
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1100},locale:'zh-CN'}),page=await context.newPage(),errors=[],report={}
page.on('pageerror',e=>errors.push(e.message))
try{
 await page.request.post(url,{form:{luci_username:'root',luci_password:password}})
 await page.goto(url);await page.locator('.oc-shell').waitFor({timeout:30000})
 await expect(page.getByRole('heading',{name:'OpenClash 运行中',exact:true})).toBeVisible({timeout:30000})
 report.native_core_running=true
 const nav=name=>page.locator('.oc-sidebar nav').getByRole('button',{name:new RegExp(name)})
 await nav('隐私监控').click();await expect(page.getByRole('heading',{name:'独立保护运行中',exact:true})).toBeVisible({timeout:30000})
 await page.locator('.oc-privacy-donut').waitFor()
 await page.screenshot({path:folder+'/router-privacy-desktop.png',fullPage:true})
 report.privacy_dashboard=true
 await page.setViewportSize({width:390,height:844});report.mobile_overflow=await page.locator('#openclash-modern').evaluate(e=>e.scrollWidth>e.clientWidth+1)
 await page.screenshot({path:folder+'/router-privacy-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1100})
 await nav('节点监控').click();await page.locator('.oc-health-layout').waitFor({timeout:30000});report.node_history=true
 await nav('设置').click();await page.locator('.oc-settings-top').waitFor({timeout:30000});await page.waitForTimeout(2000)
 report.settings_error=await page.locator('.oc-error').count()
 await nav('配置文件').click();await page.locator('.oc-files aside button').first().waitFor({timeout:30000});await page.locator('.oc-files aside button').first().click();await page.locator('.oc-editor').waitFor({timeout:30000});report.profiles_accessible=true
 await nav('Dashboard').click();await expect(page.locator('iframe')).toHaveAttribute('src',/\/ui\/metacubexd\//,{timeout:30000});report.official_dashboard=(await page.locator('iframe').getAttribute('src')).includes('/ui/metacubexd/')
 report.script_errors=errors.length
 if(errors.length||report.mobile_overflow||report.settings_error||!report.official_dashboard)throw Error('Production UI acceptance failed; private report contains details')
 await writeFile(folder+'/browser-acceptance.json',JSON.stringify({...report,errors},null,2))
 console.log(JSON.stringify(report))
}finally{await browser.close()}
