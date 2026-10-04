"""Build reproducible IPKs from existing artifacts; Linux/WSL, bounded file sets.

Native observer is x86_64-musl here. Other architectures use privacy/Makefile in
their matching OpenWrt SDK. No runtime Node, no dashboard fork, no core bundled.
"""
from pathlib import Path
import gzip,hashlib,io,json,os,re,subprocess,tarfile,tempfile
project=Path(__file__).resolve().parents[1]
out=project/'artifacts/packages';out.mkdir(parents=True,exist_ok=True)
version=os.environ.get('RP_PACKAGE_VERSION','0.1.0-3')
assert re.fullmatch(r'\d+\.\d+\.\d+-\d+',version),'Invalid package version'
def tree(root,prefix=''):
    return [(str(Path(prefix)/p.relative_to(root)),p.read_bytes(),0o755 if p.parent.name=='init.d' or p.name=='guard.lua' else 0o644) for p in sorted(root.rglob('*')) if p.is_file()]
def archive(entries):
    result=io.BytesIO()
    with gzip.GzipFile(fileobj=result,mode='wb',mtime=0) as gz:
        with tarfile.open(fileobj=gz,mode='w')as tar:
            parents={str(parent)for name,_,_ in entries for parent in Path(name).parents if str(parent)!='.'}
            for directory in sorted(parents,key=lambda p:(p.count('/'),p)):
                item=tarfile.TarInfo(directory);item.type=tarfile.DIRTYPE;item.mode=0o755;item.uid=item.gid=0;item.mtime=0;tar.addfile(item)
            for name,data,mode in sorted(entries):
                item=tarfile.TarInfo(name);item.size=len(data);item.mode=mode;item.uid=item.gid=0;item.mtime=0;tar.addfile(item,io.BytesIO(data))
    return result.getvalue()
report=[]
def package(name,arch,depends,entries,config=None):
    size=sum(len(data)for _,data,_ in entries)
    control=f'Package: {name}\nVersion: {version}\nArchitecture: {arch}\nMaintainer: Local project\nSection: net\nPriority: optional\nDepends: {depends}\nInstalled-Size: {size}\nDescription: Independent modern router management module\n'
    controls=[('control',control.encode(),0o644)]
    if config:controls.append(('conffiles',(config+'\n').encode(),0o644))
    # The shipped defaults are disabled. Standard LuCI session/ACL applies on routers.
    controls.append(('postinst',b'#!/bin/sh\n[ -n "$IPKG_INSTROOT" ] && exit 0\nrm -f /tmp/luci-indexcache.*.json\nexit 0\n',0o755))
    target=out/f'{name}_{version}_{arch}.ipk'
    # OpenWrt opkg's native IPK container is a gzipped tar, not Debian ar.
    target.write_bytes(archive([('debian-binary',b'2.0\n',0o644),('control.tar.gz',archive(controls),0o644),('data.tar.gz',archive(entries),0o644)]))
    report.append({'package':name,'version':version,'architecture':arch,'file':target.name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'installed_bytes':size,'files':len(entries)})
pkg=project/'modern'
modern=tree(pkg/'root/www/luci-static/openclash-modern','www/luci-static/openclash-modern')+tree(pkg/'luasrc/openclash','usr/lib/lua/luci/openclash')
for path,target in [(pkg/'luasrc/controller/openclash_modern.lua','usr/lib/lua/luci/controller/openclash_modern.lua'),(pkg/'luasrc/view/openclash/modern.htm','usr/lib/lua/luci/view/openclash/modern.htm'),(pkg/'root/usr/share/openclash-modern/validate_yaml.rb','usr/share/openclash-modern/validate_yaml.rb')]:modern.append((target,path.read_bytes(),0o644))
sdk=project/'artifacts/sdk/luci-app-openclash-modern';sdk.mkdir(parents=True,exist_ok=True)
expected={target for target,_,_ in modern}
for stale in (sdk/'root').rglob('*'):
    if stale.is_file()and stale.relative_to(sdk/'root').as_posix()not in expected:
        stale.resolve().relative_to(sdk.resolve());stale.unlink()
for target,data,mode in modern:
    path=sdk/'root'/target;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data);path.chmod(mode)
(sdk/'Makefile').write_bytes((project/'packaging/modern/Makefile').read_bytes())
package('luci-app-openclash-modern','all','luci-app-openclash, luci-compat, ruby-yaml',modern)
privacy=tree(project/'privacy/root')+tree(project/'privacy/luasrc','usr/lib/lua/luci')
privacy.append(('usr/sbin/router-privacy-observer',Path('/var/lib/openclash-lab/packet-observer').read_bytes(),0o755))
package('router-privacy','x86_64','luci-base, luci-compat, https-dns-proxy, ca-bundle, dnsmasq, nftables-json, kmod-nf-conntrack-netlink',privacy,'/etc/config/router_privacy')
package('router-node-health','all','luci-base, luci-compat',tree(project/'node-health/root')+tree(project/'node-health/luasrc','usr/lib/lua/luci'),'/etc/config/router_node_health')
(out/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
