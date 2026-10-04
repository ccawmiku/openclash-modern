"""Install the working source tree in the lab only; never runs the service."""
from pathlib import Path
import subprocess
import tarfile
import tempfile

project = Path(__file__).resolve().parents[1]
pkg = project / 'upstream/openclash/luci-app-openclash'
ssh = ['ssh', '-i', '/var/lib/openclash-lab/id_ed25519', '-p', '22222',
       '-o', 'StrictHostKeyChecking=accept-new', '-o', 'UserKnownHostsFile=/var/lib/openclash-lab/known_hosts', 'root@127.0.0.1']
with tempfile.TemporaryFile() as archive:
    with tarfile.open(fileobj=archive, mode='w') as tar:
        catalog = project / 'artifacts/openclash.zh-cn.lmo'
        if catalog.exists(): tar.add(catalog, arcname='usr/lib/lua/luci/i18n/openclash.zh-cn.lmo')
        for root, prefix in [(pkg / 'root', ''), (pkg / 'luasrc', 'usr/lib/lua/luci'),
                             (project / 'modern/root', ''), (project / 'modern/luasrc', 'usr/lib/lua/luci'), (project / 'web/dist', 'www/luci-static/openclash-modern')]:
            if not root.exists(): raise RuntimeError(f'Missing {root}; build frontend first')
            for path in root.rglob('*'):
                if path.is_file():
                    # Preserve the lab's edited UCI state and fixture sections across rebuilds.
                    if root == pkg / 'root' and path.relative_to(root).as_posix() == 'etc/config/openclash':
                        exists = subprocess.run(ssh + ['test -f /etc/config/openclash'], stdout=subprocess.DEVNULL).returncode == 0
                        if exists: continue
                    tar.add(path, arcname=str(Path(prefix) / path.relative_to(root)), recursive=False)
    archive.seek(0)
    subprocess.run(ssh + ['tar -xf - -C /'], stdin=archive, check=True)
# Lab is intentionally disabled: no proxy kernel or transparent forwarding.
subprocess.run(ssh + ["chmod +x /etc/init.d/openclash /usr/share/openclash/*.sh; uci set openclash.config.enable=0; uci commit openclash; rm -f /tmp/luci-indexcache.*.json; /etc/init.d/rpcd restart; /etc/init.d/uhttpd restart"], check=True)
print('Working source installed only in localhost VM; OpenClash service disabled.')
