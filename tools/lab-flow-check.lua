local m=dofile('/usr/share/router-privacy/monitor.lua');local j=require 'luci.jsonc'
local d=m.snapshot();print(j.stringify({metrics=d.metrics,dns=d.dns}))
for _,f in ipairs(d.flows)do if f.source=='192.0.2.2' or (f.domain or ''):find('example',1,true) then print(j.stringify(f))end end
