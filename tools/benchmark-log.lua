local nixio = require 'nixio'
local fs = require 'nixio.fs'
local json = require 'luci.jsonc'
local reader = require 'luci.openclash.log_cursor'
local path = '/tmp/oc-modern-benchmark.log'
local line = '2026-10-03 12:00:00 [Info] synthetic management log entry for benchmark only\n'
local n = math.ceil(8 * 1024 * 1024 / #line)
local f = assert(io.open(path, 'wb'))
for i = 1, n do f:write(line) end
f:close()
local function now() local s, us = nixio.gettimeofday(); return s + us / 1000000 end
local function measure(work, count)
    local times = {}
    for i = 1, count do local t = now(); work(); times[i] = (now() - t) * 1000 end
    table.sort(times)
    return { p50_ms = times[math.ceil(count * .5)], p95_ms = times[math.ceil(count * .95)], samples = count }
end
local first = reader.read(path, nil, fs.stat)
local result = { environment = 'OpenWrt 24.10.6 QEMU KVM 2vCPU 1024MB; synthetic 8MiB log; filesystem cache warm',
    bytes = fs.stat(path).size, limit_bytes = reader.limit,
    old_unchanged = measure(function() local p = io.popen('wc -l < ' .. path); p:read('*a'); p:close() end, 30),
    new_unchanged = measure(function() reader.read(path, first.cursor, fs.stat) end, 30),
    old_snapshot = measure(function() local p = io.popen("sed -n '1," .. n .. "p' " .. path .. " | grep -v -E 'level=|^time=' | tail -n 2001"); p:read('*a'); p:close() end, 10),
    new_snapshot = measure(function() reader.read(path, nil, fs.stat) end, 10),
    note = 'Microbenchmark of log reader only; old snapshot models one of upstream pipelines. Excludes HTTP, translation and rendering. Not router performance or network throughput.' }
os.remove(path)
print(json.stringify(result))
