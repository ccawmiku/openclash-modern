"""Compile the pinned OpenClash PO with official LuCI po2lmo, inside WSL."""
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request

project = Path(__file__).resolve().parents[1]
cache = Path('/var/lib/openclash-lab/po2lmo-src')
cache.mkdir(parents=True, exist_ok=True)
metadata = cache / 'sources.json'
if metadata.exists():
    info = json.loads(metadata.read_text())
else:
    with urllib.request.urlopen('https://api.github.com/repos/openwrt/luci/commits/openwrt-24.10', timeout=30) as r:
        commit = json.load(r)['sha']
    info = {'commit': commit, 'files': {}}
    for path in ['po2lmo.c', 'lib/lmo.h', 'lib/lmo.c']:
        url = f'https://raw.githubusercontent.com/openwrt/luci/{commit}/modules/luci-base/src/{path}'
        with urllib.request.urlopen(url, timeout=30) as r:
            content = r.read()
        target = cache / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        info['files'][path] = hashlib.sha256(content).hexdigest()
    metadata.write_text(json.dumps(info, indent=2))
for path, expected in info['files'].items():
    if hashlib.sha256((cache / path).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Compiler source checksum changed')
source = (cache / 'lib/lmo.c').read_text()
# po2lmo only links sfh_hash; avoid linking the runtime/plural parser.
body = source[source.index('uint32_t sfh_hash('):source.index('uint32_t lmo_canon_hash(')]
(cache / 'hash.c').write_text(source[:source.index('#include')] + '#include "lib/lmo.h"\n' + body)
subprocess.run(['gcc', '-O2', '-o', str(cache / 'po2lmo'), str(cache / 'po2lmo.c'), str(cache / 'hash.c')], check=True)
po = project / 'upstream/openclash/luci-app-openclash/po/zh-cn/openclash.zh-cn.po'
out = project / 'artifacts/openclash.zh-cn.lmo'
out.parent.mkdir(parents=True, exist_ok=True)
subprocess.run([str(cache / 'po2lmo'), str(po), str(out)], check=True)
(project / 'artifacts/localization-sources.json').write_text(json.dumps(info, indent=2))
print(f'Compiled original OpenClash Chinese catalog: {out.stat().st_size} bytes')
