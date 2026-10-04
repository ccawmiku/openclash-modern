"""Fetch official stock OpenClash package and a previous core for lab checks."""
import gzip,hashlib,json,shutil,urllib.request
from pathlib import Path
root=Path('/var/lib/openclash-lab/vendor');root.mkdir(parents=True,exist_ok=True)
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'router-proxy-lab'}),timeout=45)as r:return r.read(60*1024*1024)
report={}
for repo,tag,label in [('vernesong/OpenClash','v0.47.156','openclash'),('MetaCubeX/mihomo','v1.19.31','previous-core')]:
    release=json.loads(fetch(f'https://api.github.com/repos/{repo}/releases/tags/{tag}'))
    asset=next(x for x in release['assets'] if (x['name'].endswith('_all.ipk') if label=='openclash'else x['name'].startswith('mihomo-linux-amd64-v1-')and x['name'].endswith('.gz')))
    path=root/asset['name']
    if not path.exists():path.write_bytes(fetch(asset['browser_download_url']))
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    if asset.get('digest')and asset['digest']!='sha256:'+digest:raise RuntimeError('Official package digest mismatch')
    report[label]={'tag':tag,'file':path.name,'sha256':digest,'digest_verified':bool(asset.get('digest'))}
    if label=='previous-core':
        with gzip.open(path,'rb')as src,(root/'mihomo-previous').open('wb')as dest:shutil.copyfileobj(src,dest)
        (root/'mihomo-previous').chmod(0o755)
(root/'compatibility.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
