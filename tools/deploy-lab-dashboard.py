"""Serve exact upstream dashboard with an isolated lab core, never transparent mode."""
from pathlib import Path
import subprocess,tarfile,tempfile
root=Path('/var/lib/openclash-lab/vendor')
ssh=['ssh','-i','/var/lib/openclash-lab/id_ed25519','-p','22222','-o','StrictHostKeyChecking=accept-new','-o','UserKnownHostsFile=/var/lib/openclash-lab/known_hosts','root@127.0.0.1']
config='''mixed-port: 17890
allow-lan: true
bind-address: "*"
external-controller: 0.0.0.0:9090
external-ui: /tmp/mihomo-lab/ui
external-ui-name: metacubexd
secret: ""
mode: rule
log-level: warning
ipv6: true
dns:
  enable: false
proxies:
  - name: Lab-Healthy
    type: http
    server: 127.0.0.1
    port: 17891
  - name: Lab-Unreachable
    type: http
    server: 127.0.0.1
    port: 9
proxy-groups:
  - name: Lab-Selection
    type: select
    proxies: [DIRECT, REJECT, Lab-Healthy, Lab-Unreachable]
rules:
  - MATCH,Lab-Selection
'''
init='''#!/bin/sh /etc/rc.common
START=99
USE_PROCD=1
start_service() {
 procd_open_instance
 procd_set_param command /tmp/mihomo-lab/mihomo -d /tmp/mihomo-lab -f /tmp/mihomo-lab/config.yaml
 procd_set_param respawn 3600 5 5
 procd_set_param nice 15
 procd_set_param env GOMEMLIMIT=128MiB GOMAXPROCS=2
 procd_set_param limits core="0"
 procd_set_param stdout 0
 procd_set_param stderr 1
 procd_close_instance
}
'''
import io
with tempfile.TemporaryFile() as archive:
 with tarfile.open(fileobj=archive,mode='w')as tar:
  tar.add(root/'mihomo',arcname='tmp/mihomo-lab/mihomo')
  tar.add(root/'dashboard',arcname='tmp/mihomo-lab/ui/metacubexd')
  for name,content in [('tmp/mihomo-lab/config.yaml',config),('etc/init.d/mihomo-lab',init)]:
   data=content.encode();info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o600 if name.endswith('yaml') else 0o755;tar.addfile(info,io.BytesIO(data))
 archive.seek(0);subprocess.run(ssh+['tar -xf - -C /'],stdin=archive,check=True)
subprocess.run(ssh+['/etc/init.d/mihomo-lab restart'],check=True)
print('Original dashboard and official Mihomo started only in lab; no TUN or transparent routes.')
