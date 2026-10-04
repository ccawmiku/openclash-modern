"""Alternate original/modern no-change HTTP log polls, only in localhost VM."""
import http.cookiejar
import json
import math
from pathlib import Path
import statistics
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

project = Path(__file__).resolve().parents[1]
base = 'http://127.0.0.1:18080/cgi-bin/luci/admin/services/openclash/'
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
ssh = ['ssh', '-i', '/var/lib/openclash-lab/id_ed25519', '-p', '22222', '-o',
       'UserKnownHostsFile=/var/lib/openclash-lab/known_hosts', 'root@127.0.0.1']
def get(action, **params):
    with opener.open(base + action + '?' + urllib.parse.urlencode(params), timeout=15) as response:
        return json.load(response)

login = urllib.request.Request(base + 'modern', data=urllib.parse.urlencode({'luci_username': 'root', 'luci_password': ''}).encode())
with opener.open(login, timeout=15) as response:
    if b'id="openclash-modern"' not in response.read(): raise RuntimeError('Lab login failed')
subprocess.run(ssh + ['cp /tmp/openclash.log /tmp/oc-modern-log-bench-backup'], check=True)
try:
    script = b"local f=assert(io.open('/tmp/openclash.log','wb')); local line='2026-10-03 12:00:00 [Info] Synthetic HTTP benchmark record only.\\n'; for i=1,135301 do f:write(line) end; f:close()"
    subprocess.run(ssh + ['lua', '-'], input=script, check=True)
    old = get('refresh_log', log_len=0)
    new = get('modern_log')
    times = {'original': [], 'modern': []}
    for i in range(30):
        order = ['original', 'modern'] if i % 2 == 0 else ['modern', 'original']
        for name in order:
            begin = time.perf_counter()
            if name == 'original':
                result = get('refresh_log', log_len=old['len'])
                assert result['update'] is False
            else:
                result = get('modern_log', cursor=new['cursor'])
                assert result['text'] == '' and result['reset'] is False
            times[name].append((time.perf_counter() - begin) * 1000)
    report = {'environment': 'OpenWrt 24.10.6 QEMU KVM; 2vCPU/1024MB; host VM CPUQuota150%; synthetic log ~8MiB; warm caches',
              'scenario': 'Authenticated LuCI HTTP polls with no new log content, 30 alternating samples per API',
              'log_lines': old['len'], 'new_initial_bytes_read': new['bytes_read'],
              'note': 'Includes LuCI/HTTP and loopback networking. Current PC workloads compete for resources. Does not measure production router or network throughput.',
              'measurements': {name: {'p50_ms': statistics.median(values), 'p95_ms': sorted(values)[math.ceil(len(values) * .95) - 1]} for name, values in times.items()}}
    (project / 'artifacts/http-log-benchmark.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))
finally:
    subprocess.run(ssh + ['mv /tmp/oc-modern-log-bench-backup /tmp/openclash.log'], check=True)
