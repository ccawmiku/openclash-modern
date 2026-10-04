"""Fetch official, unmodified dashboard and Mihomo for the loopback lab."""
import gzip, hashlib, json, shutil, urllib.request, zipfile
from pathlib import Path

root = Path('/var/lib/openclash-lab/vendor'); root.mkdir(parents=True,exist_ok=True)
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'router-proxy-lab'}),timeout=60) as response:
        return response.read(150*1024*1024)
commit = json.loads(fetch('https://api.github.com/repos/MetaCubeX/metacubexd/commits/gh-pages'))['sha']
archive = root/'dashboard.zip'
if not archive.exists(): archive.write_bytes(fetch('https://codeload.github.com/MetaCubeX/metacubexd/zip/'+commit))
with zipfile.ZipFile(archive) as data:
    # An existing archive stays pinned; never label it with today's branch head.
    archived_commit=Path(data.infolist()[0].filename).parts[0].removeprefix('metacubexd-')
    if len(archived_commit)!=40 or any(c not in '0123456789abcdef' for c in archived_commit):raise RuntimeError('Unexpected archive identity')
    commit=archived_commit
    for item in data.infolist():
        pieces=Path(item.filename).parts[1:]
        if not pieces or item.is_dir(): continue
        target=root/'dashboard'/Path(*pieces)
        target.resolve().relative_to((root/'dashboard').resolve())
        if item.file_size>32*1024*1024: raise RuntimeError('Oversized dashboard file')
        target.parent.mkdir(parents=True,exist_ok=True)
        with data.open(item) as source,target.open('wb') as output: shutil.copyfileobj(source,output)
release=json.loads(fetch('https://api.github.com/repos/MetaCubeX/mihomo/releases/latest'))
asset=next(x for x in release['assets'] if x['name'].startswith('mihomo-linux-amd64-v1-') and x['name'].endswith('.gz'))
binary=root/asset['name']
if not binary.exists(): binary.write_bytes(fetch(asset['browser_download_url']))
digest=hashlib.sha256(binary.read_bytes()).hexdigest()
if asset.get('digest') and asset['digest']!='sha256:'+digest: raise RuntimeError('Mihomo digest mismatch')
with gzip.open(binary,'rb') as source,(root/'mihomo').open('wb') as target: shutil.copyfileobj(source,target)
(root/'mihomo').chmod(0o755)
manifest={'dashboard_commit':commit,'dashboard_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'mihomo_version':release['tag_name'],'mihomo_asset':asset['name'],'mihomo_sha256':digest,'mihomo_digest_verified':bool(asset.get('digest'))}
(root/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
