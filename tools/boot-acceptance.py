"""Checkpoint/hash before shutdown; compare persisted data + guard after boot."""
import json,sys,subprocess,urllib.request
from pathlib import Path
project=Path(__file__).resolve().parents[1];path=project/'artifacts/boot-acceptance.json'
ssh=['ssh','-i','/var/lib/openclash-lab/id_ed25519','-p','22222','-o','UserKnownHostsFile=/var/lib/openclash-lab/known_hosts','root@127.0.0.1']
def hashes():return subprocess.check_output(ssh+['sha256sum /etc/config/openclash /etc/config/router_privacy /etc/config/router_node_health /etc/router-node-health/history.json /www/luci-static/openclash-modern/.vite/manifest.json']).decode().strip()
if sys.argv[1]=='before':
    with urllib.request.urlopen('http://127.0.0.1:18081/',timeout=10)as r:assert r.status==200
    req=urllib.request.Request('http://127.0.0.1:18081/cgi-bin/luci/admin/services/router_node_health/checkpoint',data=b'')
    with urllib.request.urlopen(req,timeout=10)as r:assert not json.load(r).get('error')
    subprocess.run(ssh+['sync'],check=True);path.write_text(json.dumps({'before_hashes':hashes()},indent=2));print('Checkpoint saved and VM filesystem synchronized.')
else:
    report=json.loads(path.read_text());assert report['before_hashes']==hashes(),'Persisted settings, history or frontend changed across boot'
    guard=subprocess.check_output(ssh+['lua -'],input=b"local g=dofile('/usr/share/router-privacy/guard.lua');assert(g.firewall_valid(),'DNS guard missing at boot');print('guard-valid')")
    assert b'guard-valid'in guard
    report.update({'graceful_restart_preserved_config_history_and_frontend':True,'dns_guard_active_before_lab_network_fixture_restore':True});path.write_text(json.dumps(report,indent=2));print('Persisted configuration, history, frontend and boot DNS guard passed.')
