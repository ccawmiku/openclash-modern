"""Explicit router operations. Credentials and backups never enter the repository.

Password must come from ROUTER_PASSWORD in the calling environment. This tool
does not change other devices or redirect the localhost-only lab tools.
"""
import argparse, json, os, time
from pathlib import Path
import paramiko

parser=argparse.ArgumentParser()
parser.add_argument('--host',required=True)
parser.add_argument('--port',type=int,default=22)
parser.add_argument('--user',default='root')
parser.add_argument('--phase',choices=['inspect','backup','script','install','verify','compat','start','preserved'],default='inspect')
parser.add_argument('--script',type=Path)
parser.add_argument('--reinstall',action='store_true',help='Reinstall only the three project add-on packages')
args=parser.parse_args()
project=Path(__file__).resolve().parents[1]
private=project/'.private/router';private.mkdir(parents=True,exist_ok=True)
keys=private/'known_hosts'
client=paramiko.SSHClient()
if keys.exists():client.load_host_keys(str(keys))
class TrustFirstConnection(paramiko.MissingHostKeyPolicy):
    def missing_host_key(self,client,hostname,key):
        client.get_host_keys().add(hostname,key.get_name(),key)
        client.save_host_keys(str(keys))
client.set_missing_host_key_policy(TrustFirstConnection())
client.connect(args.host,port=args.port,username=args.user,password=os.environ['ROUTER_PASSWORD'],look_for_keys=False,allow_agent=False,timeout=12)
def run(command,timeout=60):
    stdin,stdout,stderr=client.exec_command(command,timeout=timeout)
    out,err=stdout.read().decode(errors='replace'),stderr.read().decode(errors='replace')
    code=stdout.channel.recv_exit_status()
    if code:raise RuntimeError(f'Router command failed ({code}): {err[:300]}')
    return out
try:
    if args.phase=='inspect':
        commands={
            'board':'ubus call system board',
            'architecture':'uname -m; opkg print-architecture',
            'memory':'head -n 3 /proc/meminfo',
            'packages':'opkg list-installed',
            'network':'ubus call network.interface dump',
            'openclash':'printf "version="; opkg status luci-app-openclash | sed -n "/^Version:/p"; printf "enabled="; uci -q get openclash.config.enable; printf "api_port="; uci -q get openclash.config.cn_port; printf "config_path="; uci -q get openclash.config.config_path; printf "running="; pidof clash || true',
            'ports':'netstat -lnptu 2>/dev/null',
            'free_space':'df -k / /tmp',
            'config_hashes':'sha256sum /etc/config/openclash /etc/config/dhcp /etc/config/firewall /etc/config/network',
        }
        result={key:run(command)for key,command in commands.items()}
        (private/'inspect.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({k:result[k]for k in ['board','architecture','memory','openclash','free_space']},ensure_ascii=False,indent=2))
    elif args.phase=='backup':
        stamp=time.strftime('%Y%m%d-%H%M%S');remote='/tmp/openclash-modern-backup-'+stamp+'.tar.gz'
        run('umask 077; export GZIP=-1; tar -czf '+remote+' -C / etc/config etc/openclash etc/init.d/openclash etc/crontabs etc/rc.local etc/sysupgrade.conf 2>/dev/null',timeout=900)
        run('tar -tzf '+remote+' >/dev/null',timeout=120)
        destination=private/Path(remote).name
        sftp=client.open_sftp();sftp.get(remote,str(destination));sftp.close()
        import hashlib
        digest=hashlib.sha256(destination.read_bytes()).hexdigest()
        remote_digest=run('sha256sum '+remote).split()[0]
        assert digest==remote_digest,'Backup checksum mismatch'
        (private/'backup.json').write_text(json.dumps({'file':destination.name,'remote':remote,'sha256':digest,'bytes':destination.stat().st_size},indent=2))
        print(json.dumps({'backup':destination.name,'sha256_verified':True,'bytes':destination.stat().st_size}))
    elif args.phase=='compat':
        sftp=client.open_sftp();folder=private/'native-source';folder.mkdir(exist_ok=True)
        remote='/usr/lib/lua/luci/model/cbi/openclash'
        for name in sftp.listdir(remote):
            if name.endswith('.lua'):sftp.get(remote+'/'+name,str(folder/name))
        sftp.get('/usr/lib/lua/luci/controller/openclash.lua',str(folder/'controller.lua'));sftp.close()
        print('Native model/controller sources copied privately for compatibility review')
    elif args.phase=='preserved':
        import tarfile,hashlib,shlex
        before=json.loads((private/'backup.json').read_text());sftp=client.open_sftp()
        current=private/'openclash.current';sftp.get('/etc/config/openclash',str(current))
        def options(content):
            section='';result={}
            for line in content.decode().splitlines():
                tokens=shlex.split(line,comments=True)
                if not tokens:continue
                if tokens[0]=='config':section=' '.join(tokens[1:]);result[section]={}
                elif tokens[0]=='option':result[section][tokens[1]]=tokens[2:]
                elif tokens[0]=='list':result[section].setdefault(tokens[1],[]).extend(tokens[2:])
            return result
        with tarfile.open(private/before['file'])as backup:
            old=options(backup.extractfile('etc/config/openclash').read());new=options(current.read_bytes())
            changed=[s+'.'+k for s in set(old)|set(new) for k in set(old.get(s,{}))|set(new.get(s,{})) if old.get(s,{}).get(k)!=new.get(s,{}).get(k)]
            assert not changed or changed==['openclash config.enable'],'Unexpected OpenClash settings changed: '+','.join(changed)
            checked=0
            for item in backup.getmembers():
                if item.isfile() and item.name.startswith('etc/openclash/config/'):
                    with sftp.open('/'+item.name,'rb')as file:after=file.read()
                    assert hashlib.sha256(after).digest()==hashlib.sha256(backup.extractfile(item).read()).digest(),'Profile changed'
                    checked+=1
            assert checked>0,'No profiles checked'
        sftp.close();report={'native_settings_preserved':True,'changed_setting_keys':changed,'profile_files_hash_verified':checked}
        (private/'preserved.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
    elif args.phase in ['verify','start']:
        import http.cookiejar,urllib.request,urllib.parse,re
        opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        base='http://'+args.host+'/cgi-bin/luci/admin/services/openclash/'
        login=urllib.request.Request(base+'modern',data=urllib.parse.urlencode({'luci_username':args.user,'luci_password':os.environ['ROUTER_PASSWORD']}).encode())
        page=opener.open(login,timeout=30).read().decode()
        (private/'page.html').write_text(page,encoding='utf-8')
        assert 'openclash-modern' in page,'Modern page did not load'
        import html
        match=re.search(r'data-base="([^"]+)"',page)
        assert match,'Modern API base missing'
        base='http://'+args.host+html.unescape(match[1])+'/'
        if args.phase=='start':
            token=re.search(r'data-token="([^"]*)"',page)
            body=urllib.parse.urlencode({'token':html.unescape(token[1]),'action':'start'}).encode()
            response=opener.open(urllib.request.Request(base+'modern_action',data=body),timeout=60).read()
            (private/'start.response').write_bytes(response)
            for attempt in range(24):
                time.sleep(2)
                if run('pidof clash || true').strip():print('Existing core started through the modern authenticated UI');break
            else:raise RuntimeError('Core did not start; response stored privately')
            raise SystemExit(0)
        report={'page_loaded':True,'models':{}}
        models=['settings','config-overwrite','config-subscribe','servers','config','client','log','proxy-provider-file-manage','rule-providers-file-manage','other-file-edit']
        schemas={}
        for model in models:
            raw=opener.open(base+'modern_schema?model='+model,timeout=30).read()
            (private/('schema-'+model+'.response')).write_bytes(raw)
            try:data=json.loads(raw)
            except Exception:raise RuntimeError('Non-JSON schema response: '+model+'; response saved privately')
            assert not data.get('error'),model+' failed'
            fields=[field for m in data.get('maps',[]) for s in m.get('sections',[]) for r in s.get('rows',[]) for field in r.get('fields',[])]
            report['models'][model]={'fields':len(fields),'unreadable':sum(bool(f.get('read_error')) for f in fields)};schemas[model]=data
        (private/'native-schemas.json').write_text(json.dumps(schemas,ensure_ascii=False),encoding='utf-8')
        for endpoint in ['modern_metrics','modern_dashboard_info','config_file_list']:
            data=json.loads(opener.open(base+endpoint,timeout=30).read());assert not data.get('error'),endpoint+' failed'
            report[endpoint]=True
        (private/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
    elif args.phase=='install':
        import hashlib, re
        manifest=json.loads((project/'artifacts/packages/manifest.json').read_text())
        assert (private/'backup.json').exists(),'Create and verify a backup first'
        run('mkdir -p /tmp/openclash-modern-install; chmod 700 /tmp/openclash-modern-install')
        sftp=client.open_sftp()
        for item in manifest:
            name=item['file'];assert re.fullmatch(r'[a-z0-9_.+-]+\.ipk',name)
            local=project/'artifacts/packages'/name
            assert hashlib.sha256(local.read_bytes()).hexdigest()==item['sha256']
            remote='/tmp/openclash-modern-install/'+name;sftp.put(str(local),remote)
            assert run('sha256sum '+remote).split()[0]==item['sha256']
        sftp.close()
        try:print(run('opkg '+('--force-reinstall ' if args.reinstall else '')+'install '+' '.join('/tmp/openclash-modern-install/'+x['file'] for x in manifest),timeout=300))
        except RuntimeError as error:
            # opkg may also configure an unrelated previously pending package.
            # Never "fix" it by removing/replacing its scripts or services.
            for item in manifest:
                status=run('opkg status '+item['package'])
                assert 'Status: install user installed' in status and 'Version: '+item['version'] in status,'Requested package not installed'
            print('Requested packages verified installed; unrelated opkg configuration error: '+str(error))
    else:
        assert args.script and args.script.is_file(),'A local script is required'
        stdin,stdout,stderr=client.exec_command('sh -s',timeout=300)
        stdin.write(args.script.read_text(encoding='utf-8-sig').replace('\r\n','\n'));stdin.flush();stdin.channel.shutdown_write()
        out,err=stdout.read().decode(errors='replace'),stderr.read().decode(errors='replace');code=stdout.channel.recv_exit_status()
        (private/'last-script.log').write_text(out+'\n'+err,encoding='utf-8')
        print(out[:12000])
        if code:raise RuntimeError(f'Router script failed ({code}): {err[:500]}')
finally:client.close()
