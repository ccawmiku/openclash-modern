"""Stage generated frontend in the OpenClash package tree, run inside WSL."""
import json
from pathlib import Path
import re
import shutil

project = Path(__file__).resolve().parents[1]
dist = project / 'web/dist'
package = project / 'modern'
stage = package / 'root/www/luci-static/openclash-modern'
stage.resolve().relative_to(package.resolve())
manifest = json.loads((dist / '.vite/manifest.json').read_text())
expected = {'index.html', '.vite/manifest.json'}
for asset in manifest.values(): expected.update([asset['file'], *asset.get('css', [])])
for name in expected:
    if name not in {'index.html', '.vite/manifest.json'} and not re.fullmatch(r'assets/[A-Za-z0-9_-]+\.(js|css)', name):
        raise RuntimeError('Unexpected asset path')
for pattern in ['assets/*.js', 'assets/*.css']:
    for old in stage.glob(pattern):
        old.resolve().relative_to(stage.resolve())
        if str(old.relative_to(stage)) not in expected: old.unlink()
for name in expected:
    target = stage / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(dist / name, target)
print(f'Staged {len(expected)} static files for package builds; no Node runtime on router.')
