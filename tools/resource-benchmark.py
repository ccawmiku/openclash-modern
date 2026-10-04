"""Bounded steady-state sampling of only this project's loopback guest."""
import argparse,json,re,time,subprocess,urllib.request
from pathlib import Path
project=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--output',default='resource-benchmark.json');args=parser.parse_args()
assert re.fullmatch(r'[a-z0-9-]+\.json',args.output),'Output must be an artifact filename'
ssh=['ssh','-i','/var/lib/openclash-lab/id_ed25519','-p','22222','-o','UserKnownHostsFile=/var/lib/openclash-lab/known_hosts','root@127.0.0.1']
script='''local j=require 'luci.jsonc';local fs=require 'nixio.fs';local r={}
for pid in fs.dir('/proc')do if pid:match('^%d+$')then
 local cmd=fs.readfile('/proc/'..pid..'/cmdline')or '';local role
 if cmd:find('/usr/sbin/router-privacy-observer',1,true)then role='packet-observer'
 elseif cmd:find('/router-privacy/monitor.lua',1,true)then role='privacy-summary'
 elseif cmd:find('/router-node-health/daemon.lua',1,true)then role='node-history'
 elseif cmd:find('/usr/sbin/https-dns-proxy',1,true)then role='encrypted-dns'
 elseif cmd:find('/router-privacy/',1,true) and cmd:find('/usr/sbin/dnsmasq',1,true)then role='private-dns-forwarders'
 elseif cmd:find('/tmp/mihomo-lab/mihomo',1,true)then role='mihomo'
 end
 if role then local stat=(fs.readfile('/proc/'..pid..'/stat')or ''):match('%)(.*)');local parts={};for p in (stat or ''):gmatch('%S+')do parts[#parts+1]=p end
 local rss=tonumber((fs.readfile('/proc/'..pid..'/status')or ''):match('VmRSS:%s*(%d+)'))or 0
 r[#r+1]={pid=tonumber(pid),role=role,rss_kib=rss,ticks=(tonumber(parts[12])or 0)+(tonumber(parts[13])or 0)}end
end end
print(j.stringify({processes=r,meminfo=fs.readfile('/proc/meminfo')}))'''
def sample():return json.loads(subprocess.check_output(ssh+['lua -'],input=script.encode()))
def monitor():
    with urllib.request.urlopen('http://127.0.0.1:18081/cgi-bin/luci/admin/services/router_privacy/status',timeout=10)as r:return json.load(r)['monitor']
before=sample();start=time.monotonic();capture_before=monitor();peaks={}
for i in range(4):
    time.sleep(5)
    current=sample()
    for p in current['processes']:peaks[p['role']]=max(peaks.get(p['role'],0),sum(x['rss_kib']for x in current['processes']if x['role']==p['role']))
elapsed=time.monotonic()-start;previous={p['pid']:p for p in before['processes']};cpu={}
for p in current['processes']:
    if p['pid']in previous:cpu[p['role']]=cpu.get(p['role'],0)+(p['ticks']-previous[p['pid']]['ticks'])/100/elapsed*100
report={'seconds':round(elapsed,2),'scenario':'idle management; two nodes checked every 30s; privacy enabled; no bandwidth stress','guest':'2 vCPU / 1024MiB RAM; host VM CPUQuota150%','role_peak_sum_rss_mib':{k:round(v/1024,2)for k,v in peaks.items()},'role_cpu_percent_one_core':{k:round(v,3)for k,v in cpu.items()},'capture_before':capture_before,'capture_after':monitor(),'note':'Sum of process RSS double-counts shared pages. CPU is /proc ticks at CLK_TCK=100. No claim about line-rate observation or physical-router speed.'}
(project/'artifacts'/args.output).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
