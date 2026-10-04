"""Deploy independent service only to the loopback VM; configuration preserved."""
from pathlib import Path
import subprocess,tarfile,tempfile
project=Path(__file__).resolve().parents[1]
ssh=['ssh','-i','/var/lib/openclash-lab/id_ed25519','-p','22222','-o','StrictHostKeyChecking=accept-new','-o','UserKnownHostsFile=/var/lib/openclash-lab/known_hosts','root@127.0.0.1']
existing={name:subprocess.run(ssh+['test -f /etc/config/'+name],stdout=subprocess.DEVNULL).returncode==0 for name in ['router_privacy','router_node_health']}
with tempfile.TemporaryFile() as archive:
    with tarfile.open(fileobj=archive,mode='w') as tar:
        for root,prefix in [(project/'privacy/root',''),(project/'privacy/luasrc','usr/lib/lua/luci'),(project/'node-health/root',''),(project/'node-health/luasrc','usr/lib/lua/luci')]:
            for file in root.rglob('*'):
                if file.is_file():
                    relative=file.relative_to(root)
                    if any(present and str(relative)=='etc/config/'+name for name,present in existing.items()): continue
                    tar.add(file,arcname=str(Path(prefix)/relative),recursive=False)
        tar.add('/var/lib/openclash-lab/packet-observer',arcname='usr/sbin/router-privacy-observer')
    archive.seek(0);subprocess.run(ssh+['tar -xf - -C /'],stdin=archive,check=True)
subprocess.run(ssh+['chmod 755 /etc/init.d/router-privacy /etc/init.d/router-node-health /usr/share/router-privacy/guard.lua /usr/sbin/router-privacy-observer; rm -f /tmp/luci-indexcache.*.json; /etc/init.d/rpcd restart; /etc/init.d/uhttpd restart'],check=True)
print('Independent privacy service installed in loopback VM; no production changes.')
