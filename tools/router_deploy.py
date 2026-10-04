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
parser.add_argument('--phase',choices=['inspect','backup','script','install'],default='inspect')
parser.add_argument('--script',type=Path)
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
        print(run('opkg install '+' '.join('/tmp/openclash-modern-install/'+x['file'] for x in manifest),timeout=300))
    else:
        assert args.script and args.script.is_file(),'A local script is required'
        stdin,stdout,stderr=client.exec_command('sh -s',timeout=300)
        stdin.write(args.script.read_text(encoding='utf-8-sig').replace('\r\n','\n'));stdin.flush();stdin.channel.shutdown_write()
        out,err=stdout.read().decode(errors='replace'),stderr.read().decode(errors='replace');code=stdout.channel.recv_exit_status()
        (private/'last-script.log').write_text(out+'\n'+err,encoding='utf-8')
        print(out[:12000])
        if code:raise RuntimeError(f'Router script failed ({code}): {err[:500]}')
finally:client.close()
