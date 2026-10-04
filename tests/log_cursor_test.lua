local reader = dofile(arg[1])
local path = '/tmp/oc-modern-log-test.log'
local ino, mtime = 1, 1
local function stat() return { dev = 1, ino = ino, mtime = mtime } end
local function write(s, append)
    local f = assert(io.open(path, append and 'ab' or 'wb')); f:write(s); f:close()
end
local function read(cursor) return reader.read(path, cursor, stat) end
write('first\npartial')
local a = read(); assert(a.text == 'first\n' and a.reset)
local b = read(a.cursor); assert(b.text == '' and not b.reset)
write('-汉字\n', true)
local c = read(b.cursor); assert(c.text == 'partial-汉字\n' and not c.reset)
local d = read(c.cursor); assert(d.text == '' and d.bytes_read == 0)
write('rotated\n'); ino = 2
local e = read(d.cursor); assert(e.reset and e.text == 'rotated\n')
write('short\n')
local f = read(e.cursor); assert(f.reset and f.text == 'short\n')
write('rewrite-with-a-longer-line\n')
local g = read(f.cursor); assert(g.reset and g.text == 'rewrite-with-a-longer-line\n')
write('same-second-and-size-edit\n'); mtime = mtime + 1
local h = read(g.cursor); assert(h.reset)
write(string.rep('x', reader.limit - 1) .. '汉\n')
local i = read(); assert(#i.text <= reader.limit and i.truncated)
write(string.rep('record\n', 100000))
local j = read(); assert(#j.text <= reader.limit and j.reset and j.truncated)
assert(j.text:sub(1, 7) == 'record\n')
write(string.rep('汉', 100000))
local unicode = read()
assert(#unicode.text > 0 and #unicode.text % 3 == 0 and unicode.truncated)
assert(unicode.text:sub(1, 3) == '汉')
local k = read('malformed'); assert(k.reset)
os.remove(path)
local missing = read(k.cursor); assert(missing.missing and missing.reset)
print('PASS: initial, partial UTF-8, unchanged, append, rotation, truncate, rewrite, bounds, malformed, missing')
