import {request} from '@playwright/test'
import {normalizeSchema,formPayload} from '../src/form.js'
import {writeFile} from 'node:fs/promises'
const api=await request.newContext(),base='http://127.0.0.1:18081/cgi-bin/luci/admin/services/openclash',file='/etc/openclash/config/lab-example.yaml',report={}
const schema=async model=>normalizeSchema(await(await api.get(base+'/modern_schema?'+new URLSearchParams({model,...(model==='servers'?{file}:{})}))).json())
const rows=data=>data.maps.flatMap(m=>m.sections.flatMap(g=>g.rows.map(r=>({type:g.type,...r}))))
const snapshot=data=>JSON.stringify(rows(data).map(r=>({id:r.id,type:r.type,fields:r.fields.map(f=>({key:f.option,value:f.value}))})))
async function create(model,type,record){const response=await api.post(base+'/modern_create_record',{form:{model,record_type:type,record:JSON.stringify(record),...(model==='servers'?{file}:{})}});return {status:response.status(),body:await response.json()}}
async function remove(model,id){const data=await schema(model),fields=data.maps.flatMap(m=>m.sections.flatMap(g=>g.rows.flatMap(r=>r.fields))),values=Object.fromEntries(fields.map(f=>[f.id,f.template==='cbi/fvalue'&&f.value===''?f.disabled:f.value]));const body=formPayload(data,values,fields.find(f=>f.option==='Commit'),'');body.set('model',model);if(model==='servers')body.set('file',file);body.set('cbi.rts.openclash.'+id,'1');const result=await(await api.post(base+'/modern_submit',{form:Object.fromEntries(body)})).json();if(!result.ok)throw Error('Cleanup failed '+JSON.stringify(result.errors))}
const created=[]
try{
 const before=snapshot(await schema('config-overwrite'))
 for(const record of [{ip:'192.0.2.53',port:'65536',type:'https',group:'nameserver'},{ip:'',type:'https',group:'nameserver'},{ip:'192.0.2.53',type:'invalid',group:'nameserver'},{ip:'192.0.2.53',type:'https',group:'nameserver',unknown_option:'1'}]){const result=await create('config-overwrite','dns_servers',record);if(result.status!==400)throw Error('Invalid draft accepted');if(snapshot(await schema('config-overwrite'))!==before)throw Error('Rejected draft changed configuration')}
 report.invalid_drafts_no_writes=true
 for(const [model,type,record]of [
  ['config-overwrite','authentication',{enabled:'1',username:'Lab-UI-Account',password:'test-only-not-a-real-secret'}],
  ['config-subscribe','config_subscribe',{enabled:'1',name:'Lab-UI-Subscribe',address:'https://example.invalid/config.yaml'}],
  ['servers','servers',{enabled:'1',name:'Lab-UI-Node',type:'http',server:'192.0.2.7',port:'443',config:'lab-example.yaml'}],
  ['servers','groups',{enabled:'1',name:'Lab-UI-Group',type:'select',config:'lab-example.yaml'}],
  ['servers','proxy-provider',{enabled:'1',name:'Lab-UI-Provider',type:'http',provider_url:'https://example.invalid/provider.yaml',health_check_url:'https://www.gstatic.com/generate_204',config:'lab-example.yaml'}]
 ]){const initial=snapshot(await schema(model)),result=await create(model,type,record);if(result.status!==200||!result.body.ok)throw Error(type+' create failed: '+result.body.error);created.push([model,result.body.section]);const row=rows(await schema(model)).find(r=>r.id===result.body.section);if(!row||row.type!==type)throw Error('New record missing');await remove(model,result.body.section);created.pop();if(snapshot(await schema(model))!==initial)throw Error(type+' removal changed existing records');report[type+'_create_delete']=true}
 const start=Date.now();const requests=await Promise.allSettled(['ipify','ipsb','pcol','ipip'].map(provider=>api.get(base+'/modern_myip?provider='+provider)));report.real_exit_requests={all_four_completed:true,milliseconds:Date.now()-start,statuses:requests.map(r=>r.status==='fulfilled'?r.value.status():'network-error')}
 await writeFile('../artifacts/record-creation-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}catch(e){console.error(e.message);process.exitCode=1}finally{for(const[model,id]of created)await remove(model,id);await api.dispose()}
