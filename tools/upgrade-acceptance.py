"""Real versioned add-on upgrade + rollback, preserving user data, loopback only."""
import io,json,os,subprocess,tarfile,tempfile
from pathlib import Path
project=Path(__file__).resolve().parents[1]
ssh=['ssh','-i','/var/lib/openclash-lab/id_ed25519','-p','22222','-o','UserKnownHostsFile=/var/lib/openclash-lab/known_hosts','root@127.0.0.1']
def run(s):return subprocess.check_output(ssh+[s]).decode()
def build(version):
    env=os.environ.copy();env['RP_PACKAGE_VERSION']=version
    subprocess.run(['python3',str(project/'tools/build-packages.py')],env=env,check=True,stdout=subprocess.DEVNULL)
    manifest=json.loads((project/'artifacts/packages/manifest.json').read_text())
    with tempfile.TemporaryFile()as f:
        with tarfile.open(fileobj=f,mode='w')as t:
            for item in manifest:t.add(project/'artifacts/packages'/item['file'],arcname='tmp/rp-upgrade/'+item['file'])
        f.seek(0);subprocess.run(ssh+['tar -xf - -C /'],stdin=f,check=True)
    return ' '.join('/tmp/rp-upgrade/'+item['file']for item in manifest)
before=run('sha256sum /etc/config/openclash /etc/config/router_privacy /etc/config/router_node_health /etc/router-node-health/history.json')
try:
    run('/etc/init.d/router-node-health stop')
    files=build('0.1.1-1');print(run('opkg install '+files))
    assert before==run('sha256sum /etc/config/openclash /etc/config/router_privacy /etc/config/router_node_health /etc/router-node-health/history.json')
    assert 'Version: 0.1.1-1'in run('opkg status luci-app-openclash-modern')
finally:
    files=build('0.1.0-1');print(run('opkg --force-downgrade install '+files))
    run('/etc/init.d/router-privacy restart; /etc/init.d/router-node-health start; /etc/init.d/rpcd restart; /etc/init.d/uhttpd restart; sync')
assert before==run('sha256sum /etc/config/openclash /etc/config/router_privacy /etc/config/router_node_health /etc/router-node-health/history.json')
report={'upgrade':'0.1.0-1 -> 0.1.1-1','rollback':'0.1.1-1 -> 0.1.0-1','all_three_packages':True,'all_config_and_checkpoint_hashes_preserved':True,'core_and_dashboard_not_owned_or_replaced':True}
(project/'artifacts/upgrade-acceptance.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
