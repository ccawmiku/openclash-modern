"""Previous/current official cores using unchanged UI and standard API; loopback."""
import json,subprocess,time,urllib.request,urllib.parse
from pathlib import Path
project=Path(__file__).resolve().parents[1]
ssh=['ssh','-i','/var/lib/openclash-lab/id_ed25519','-p','22222','-o','UserKnownHostsFile=/var/lib/openclash-lab/known_hosts','root@127.0.0.1']
def command(s):subprocess.run(ssh+[s],check=True,stdout=subprocess.DEVNULL)
def get(path):
    with urllib.request.urlopen('http://127.0.0.1:19090'+path,timeout=8)as r:return json.load(r)
report={}
try:
    command('/etc/init.d/mihomo-lab stop; cp /tmp/mihomo-lab/mihomo /tmp/rp-core-current')
    with Path('/var/lib/openclash-lab/vendor/mihomo-previous').open('rb')as f:subprocess.run(ssh+['cat > /tmp/mihomo-lab/mihomo; chmod 755 /tmp/mihomo-lab/mihomo'],stdin=f,check=True)
    command('/etc/init.d/mihomo-lab start');time.sleep(2)
    for label in ['previous','current']:
        version=get('/version');proxies=get('/proxies');connections=get('/connections')
        assert 'Lab-Healthy'in proxies['proxies'] and 'connections'in connections
        delay=get('/proxies/Lab-Healthy/delay?'+urllib.parse.urlencode({'timeout':3000,'url':'https://www.gstatic.com/generate_204'}))
        assert delay['delay']>0
        with urllib.request.urlopen('http://127.0.0.1:19090/ui/metacubexd/',timeout=8)as r:assert r.status==200
        report[label]={'version':version['version'],'proxies':True,'connections':True,'https_delay_ms':delay['delay'],'unmodified_dashboard_http':200}
        if label=='previous':command('/etc/init.d/mihomo-lab stop; cp /tmp/rp-core-current /tmp/mihomo-lab/mihomo; /etc/init.d/mihomo-lab start');time.sleep(2)
    (project/'artifacts/core-acceptance.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
finally:command('/etc/init.d/mihomo-lab stop; cp /tmp/rp-core-current /tmp/mihomo-lab/mihomo; /etc/init.d/mihomo-lab start; rm -f /tmp/rp-core-current')
