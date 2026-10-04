-- Small RAM snapshot; standard core API, no subprocesses or permanent history.
local M={}
local nx,fs,j=require 'nixio',require 'nixio.fs',require 'luci.jsonc'
local function core(port,secret)
 local s=nx.socket('inet','stream');if not s then return nil end
 s:setopt('socket','rcvtimeo',1);s:setopt('socket','sndtimeo',1)
 if not s:connect('127.0.0.1',port)then s:close();return nil end
 local req='GET /connections HTTP/1.0\r\nHost: localhost\r\nAuthorization: Bearer '..secret..'\r\nConnection: close\r\n\r\n'
 local offset=1;while offset<=#req do local n=s:send(req:sub(offset));if not n or n<=0 then s:close();return nil end;offset=offset+n end
 local parts,size={},0;local start=nx.gettimeofday()
 while size<524288 and nx.gettimeofday()-start<2 do local b=s:recv(math.min(8192,524288-size));if not b or b==''then break end;parts[#parts+1]=b;size=size+#b end
 s:close();if size>=524288 then return nil end
 local raw=table.concat(parts);if not raw:match('^HTTP/%d%.%d 200')then return nil end
 return j.parse(raw:match('\r\n\r\n(.*)')or '')
end
function M.read()
 local u=require('luci.model.uci').cursor();local port=tonumber(u:get('openclash','config','cn_port'))or 9090
 local secret=u:get('openclash','config','dashboard_password')or '';local data
 if port>=1 and port<=65535 and not secret:find('[\r\n%z]')then data=core(port,secret)end
 local now=nx.gettimeofday();local cache='/tmp/openclash-modern-metrics.json';local previous=j.parse(fs.readfile(cache)or '{}')or {}
 local total,idle=0,0;local cpu=(fs.readfile('/proc/stat')or ''):match('^cpu%s+([^\n]+)')or ''
 local i=0;for v in cpu:gmatch('%d+')do i=i+1;if i<=8 then total=total+tonumber(v)end;if i==4 or i==5 then idle=idle+tonumber(v)end end
 local dt=now-(previous.time or now);local r={timestamp=now,core_available=data~=nil,load=(fs.readfile('/proc/loadavg')or ''):match('^[%d.]+'),uptime=tonumber((fs.readfile('/proc/uptime')or ''):match('^[%d.]+'))}
 local mem=fs.readfile('/proc/meminfo')or '';r.memory_total=(tonumber(mem:match('MemTotal:%s*(%d+)'))or 0)*1024;r.memory_available=(tonumber(mem:match('MemAvailable:%s*(%d+)'))or 0)*1024
 if previous.cpu_total and total>previous.cpu_total then r.cpu_percent=math.max(0,math.min(100,(1-(idle-previous.cpu_idle)/(total-previous.cpu_total))*100))end
 if data then
  r.upload_total=tonumber(data.uploadTotal)or 0;r.download_total=tonumber(data.downloadTotal)or 0;r.connections=type(data.connections)=='table'and #data.connections or 0
  if dt>0 and dt<30 and previous.upload and r.upload_total>=previous.upload and r.download_total>=previous.download then r.upload_rate=(r.upload_total-previous.upload)/dt;r.download_rate=(r.download_total-previous.download)/dt end
 end
 fs.writefile(cache..'.new',j.stringify({time=now,cpu_total=total,cpu_idle=idle,upload=r.upload_total,download=r.download_total}));fs.chmod(cache..'.new','600');fs.rename(cache..'.new',cache)
 return r
end
return M
