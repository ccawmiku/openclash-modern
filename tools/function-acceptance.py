"""Native multipart upload, backups, Age, large YAML and offload restoration.
Only synthetic data and the loopback lab. All changed configuration is restored.
"""
import json,subprocess,urllib.request,urllib.parse
from pathlib import Path
project=Path(__file__).resolve().parents[1]
ssh=['ssh','-i','/var/lib/openclash-lab/id_ed25519','-p','22222','-o','UserKnownHostsFile=/var/lib/openclash-lab/known_hosts','root@127.0.0.1']
base='http://127.0.0.1:18081/cgi-bin/luci/admin/services/'
def command(text):return subprocess.check_output(ssh+[text]).decode()
def call(action,data=None,namespace='openclash'):
    req=urllib.request.Request(base+namespace+'/'+action,data=None if data is None else urllib.parse.urlencode(data).encode())
    with urllib.request.urlopen(req,timeout=20)as r:
        text=r.read();return json.loads(text)if 'application/json'in r.headers.get('Content-Type','')else text
report={}
command('set -eu; mkdir -p /tmp/rp-function-backup; cp /etc/config/openclash /tmp/rp-function-backup/openclash; cp /etc/config/router_privacy /tmp/rp-function-backup/router_privacy; cp /etc/config/firewall /tmp/rp-function-backup/firewall; test ! -e /etc/openclash/core/clash_meta; ln -s /tmp/mihomo-lab/mihomo /etc/openclash/core/clash_meta; touch /etc/openclash/config/lab-large.yaml')
try:
    call('modern')
    for kind in ['backup','backup_ex_core','backup_only_config','backup_only_rule','backup_only_proxy']:
        data=call(kind);assert isinstance(data,bytes)and data[:2]==b'\x1f\x8b'
    report['native_backup_downloads']=5
    generated=call('modern_age',{'operation':'generate','algo':'keygen'});assert generated.get('secret')and generated.get('public')
    converted=call('modern_age',{'operation':'convert','secret':generated['secret']});assert converted['public'].strip()==generated['public'].strip()
    saved=call('modern_file_age',{'name':'lab-age','age_secret':generated['secret'],'age_public':generated['public'],'age_algo':'keygen'});assert saved.get('status')=='success'
    info=call('modern_file_age_info?name=lab-age');assert info['secret']==generated['secret']
    report['age_generate_convert_and_persist']=True
    large='proxies: []\npayload: '+('x'*262144)+'\n'
    result=call('modern_file_save',{'config_file':'/etc/openclash/config/lab-large.yaml','content':large});assert result['status']=='success'
    assert call('config_file_read?config_file=/etc/openclash/config/lab-large.yaml')['content']==large
    report['large_yaml_roundtrip_bytes']=len(large)
    boundary='rp-lab-native-upload';content='proxies: []\nrules: []\n'
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file_type"\r\n\r\nconfig\r\n--{boundary}\r\nContent-Disposition: form-data; name="upload"\r\n\r\n1\r\n--{boundary}\r\nContent-Disposition: form-data; name="ulfile"; filename="lab-accept-upload.yaml"\r\nContent-Type: application/octet-stream\r\n\r\n{content}\r\n--{boundary}--\r\n').encode()
    req=urllib.request.Request(base+'openclash/config',data=body,headers={'Content-Type':'multipart/form-data; boundary='+boundary})
    with urllib.request.urlopen(req,timeout=20)as r:assert r.status==200
    assert call('config_file_read?config_file=/etc/openclash/config/lab-accept-upload.yaml')['content']==content
    report['native_multipart_upload']=True
    command('uci set firewall.@defaults[0].flow_offloading=1; uci set firewall.@defaults[0].flow_offloading_hw=1; uci commit firewall')
    call('configure',{'config':json.dumps({'monitor_enabled':'1','disable_offload':'1'})},'router_privacy')
    assert command('uci get firewall.@defaults[0].flow_offloading').strip()=='0'
    call('configure',{'config':json.dumps({'monitor_enabled':'0'})},'router_privacy')
    assert command('uci get firewall.@defaults[0].flow_offloading').strip()=='1'
    assert command('uci get firewall.@defaults[0].flow_offloading_hw').strip()=='1'
    report['previous_offload_restored_on_monitor_disable']=True
finally:
    command('cp /tmp/rp-function-backup/openclash /etc/config/openclash; cp /tmp/rp-function-backup/router_privacy /etc/config/router_privacy; cp /tmp/rp-function-backup/firewall /etc/config/firewall; rm -f /etc/openclash/core/clash_meta /etc/openclash/config/lab-large.yaml /etc/openclash/config/lab-accept-upload.yaml; /etc/init.d/router-privacy restart; /etc/init.d/firewall reload; sync')
(project/'artifacts/function-acceptance.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
