"""Install stock and add-on IPKs, then reinstall; ONLY the loopback lab."""
import json,subprocess,tarfile,tempfile
from pathlib import Path
project=Path(__file__).resolve().parents[1]
ssh=['ssh','-i','/var/lib/openclash-lab/id_ed25519','-p','22222','-o','UserKnownHostsFile=/var/lib/openclash-lab/known_hosts','root@127.0.0.1']
def run(script):return subprocess.check_output(ssh+['sh -s'],input=script.encode()).decode()
manifest=json.loads((project/'artifacts/packages/manifest.json').read_text())
files=[project/'artifacts/packages'/item['file']for item in manifest]+[Path('/var/lib/openclash-lab/vendor/luci-app-openclash_0.47.156_all.ipk')]
package_paths=' '.join('/tmp/rp-packages/'+item['file']for item in manifest)
with tempfile.TemporaryFile() as f:
    with tarfile.open(fileobj=f,mode='w')as t:
        for p in files:t.add(p,arcname='tmp/rp-packages/'+p.name)
    f.seek(0);subprocess.run(ssh+['tar -xf - -C /'],stdin=f,check=True)
print(run('''set -eu
mkdir -p /tmp/rp-install-backup
for name in openclash dhcp router_privacy router_node_health; do cp /etc/config/$name /tmp/rp-install-backup/$name; done
if ! opkg status luci-app-openclash | grep -q 'Status: install'; then
 opkg update
 opkg install kmod-tun libnettle8
 cd /tmp/rp-packages
 opkg download dnsmasq-full
 opkg remove dnsmasq
 opkg install ./dnsmasq-full*.ipk
 opkg install ./luci-app-openclash_0.47.156_all.ipk
 for name in openclash dhcp router_privacy router_node_health; do cp /tmp/rp-install-backup/$name /etc/config/$name; done
 /etc/init.d/openclash disable
 /etc/init.d/dnsmasq restart
fi
opkg install PACKAGE_PATHS
'''.replace('PACKAGE_PATHS',package_paths)))
before=run('sha256sum /etc/config/openclash /etc/config/router_privacy /etc/config/router_node_health /etc/router-node-health/history.json')
print(run('''set -eu
opkg --force-reinstall install PACKAGE_PATHS
chmod 755 /etc/init.d/router-privacy /etc/init.d/router-node-health
/etc/init.d/router-privacy enable
/etc/init.d/router-node-health enable
/etc/init.d/router-privacy restart
/etc/init.d/router-node-health restart
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
sync
'''.replace('PACKAGE_PATHS',package_paths)))
after=run('sha256sum /etc/config/openclash /etc/config/router_privacy /etc/config/router_node_health /etc/router-node-health/history.json')
assert before==after,'Configuration or history changed during reinstall'
report={'stock_version':'0.47.156','normal_dependency_install':True,'same_version_reinstall_preserves_config_and_history':True,'config_files':3,'independent_history_preserved':True}
(project/'artifacts/package-acceptance.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
