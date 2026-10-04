"""Real local fixture failure/recovery and offline-core semantics. Loopback only."""
import json,subprocess,time,urllib.parse,urllib.request
from pathlib import Path
project=Path(__file__).resolve().parents[1]
ssh=['ssh','-i','/var/lib/openclash-lab/id_ed25519','-p','22222','-o','UserKnownHostsFile=/var/lib/openclash-lab/known_hosts','root@127.0.0.1']
base='http://127.0.0.1:18081/cgi-bin/luci/admin/services/router_node_health/'
def command(text):subprocess.run(ssh+[text],check=True,stdout=subprocess.DEVNULL)
def get():
    with urllib.request.urlopen(base+'status?node=Lab-Healthy',timeout=15)as r:return json.load(r)
def post(action,**data):
    req=urllib.request.Request(base+action,data=urllib.parse.urlencode(data).encode())
    with urllib.request.urlopen(req,timeout=15)as r:return json.load(r)
def wait_for(predicate,limit=40):
    end=time.monotonic()+limit
    while time.monotonic()<end:
        data=get()
        if predicate(data):return data
        time.sleep(.5)
    data=get();raise RuntimeError('Node state acceptance timed out: '+json.dumps({k:data.get(k)for k in ['core_state','stale','timestamp','error']})+' '+json.dumps({k:data.get('detail',{}).get(k)for k in ['status','checked','streak','ok','failed','unknown']}))
report={}
try:
    checked=get().get('detail',{}).get('checked',0);post('probe',node='Lab-Healthy');good=wait_for(lambda d:d.get('detail',{}).get('status')=='up' and d['detail']['checked']>checked)
    report['healthy_initial']=good['detail']['ok'];initial=good['detail']['checked']
    command('/etc/init.d/rp-node-fixture stop')
    post('probe',node='Lab-Healthy');first=wait_for(lambda d:d['detail']['checked']>initial and d['detail']['status']in ['degraded','down']);initial=first['detail']['checked'];time.sleep(1.1)
    post('probe',node='Lab-Healthy');down=wait_for(lambda d:d['detail']['checked']>initial and d['detail']['status']=='down')
    command('/etc/init.d/rp-node-fixture start');time.sleep(1.1);post('probe',node='Lab-Healthy');recovered=wait_for(lambda d:d['detail']['status']=='up')
    assert recovered['detail']['recoveries']>good['detail']['recoveries']
    report['real_fault_recovery']={'failures':down['detail']['streak'],'recoveries':recovered['detail']['recoveries'],'observed_outage_seconds':recovered['detail']['last_outage']}
    command('/etc/init.d/mihomo-lab stop; /etc/init.d/router-node-health restart');offline=wait_for(lambda d:d.get('core_state')=='core-offline')
    assert offline['detail']['status']=='unknown'
    assert offline['detail']['failed']==recovered['detail']['failed']
    report['core_offline_not_node_failure']=True
    post('checkpoint');saved=offline['detail']['ok']
    command('/etc/init.d/router-node-health stop; rm -f /var/run/router-node-health/history.json; /etc/init.d/mihomo-lab start; /etc/init.d/router-node-health start')
    restored=wait_for(lambda d:d.get('core_state')=='available' and d.get('detail',{}).get('ok',0)>=saved)
    report['restored_from_disk']=True
    (project/'artifacts/node-acceptance.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report))
finally:
    command('/etc/init.d/rp-node-fixture start; /etc/init.d/mihomo-lab start; /etc/init.d/router-node-health start')
