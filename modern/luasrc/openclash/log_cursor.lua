-- Bounded, stateless incremental log reader. No shell or resident cache.
local M = {}
M.limit = 128 * 1024
local function hash(s)
    local n = 0
    for i = 1, #s do n = (n * 131 + s:byte(i)) % 2147483647 end
    return tostring(n)
end
local function anchor(f, offset)
    local start = math.max(0, offset - 64)
    f:seek('set', start)
    return hash(f:read(offset - start) or '')
end
-- stat() and open() are injected to permit deterministic race/rotation tests.
function M.read(path, cursor, stat, open)
    local f = (open or io.open)(path, 'rb')
    if not f then return { text = '', cursor = '', reset = cursor ~= nil, bytes_read = 0, missing = true } end
    local st = f.stat and f:stat() or stat(path)
    if not st then f:close(); return { text = '', cursor = '', reset = true, bytes_read = 0, missing = true } end
    local size = f:seek('end') or 0
    local identity = tostring(st.dev or 0) .. ':' .. tostring(st.ino or 0)
    local dev, ino, offset, modified, digest = tostring(cursor or ''):match('^(%d+):(%d+):(%d+):(%d+):(%d+)$')
    offset = tonumber(offset)
    local valid = offset and dev .. ':' .. ino == identity and offset <= size
    if valid then
        valid = anchor(f, offset) == digest
        -- Same-size rewrites require a new snapshot; append reads retain their offset.
        if offset == size and tonumber(modified) ~= tonumber(st.mtime or 0) then valid = false end
    end
    local reset = not valid
    local start = valid and offset or math.max(0, size - M.limit)
    f:seek('set', start)
    local data = f:read(math.min(M.limit, size - start)) or ''
    local bytes = #data
    if reset and start > 0 then
        local newline = data:find('\n', 1, true)
        if newline then start = start + newline; data = data:sub(newline + 1)
        else
            local skip = 0
            while skip < #data and data:byte(skip + 1) >= 128 and data:byte(skip + 1) < 192 do skip = skip + 1 end
            start = start + skip; data = data:sub(skip + 1)
        end
    end
    -- Keep incomplete lines for the next request, without losing split UTF-8.
    local finish = data:match('()\n[^\n]*$')
    local oversized = not finish and bytes == M.limit
    if oversized then
        finish = #data
        -- Do not return an incomplete UTF-8 codepoint at a chunk boundary.
        local lead = finish
        while lead > 0 and data:byte(lead) >= 128 and data:byte(lead) < 192 do lead = lead - 1 end
        local b = data:byte(lead) or 0
        local needed = b >= 240 and 4 or b >= 224 and 3 or b >= 192 and 2 or 1
        if lead + needed - 1 > finish then finish = lead - 1 end
    end
    local text = finish and data:sub(1, finish) or ''
    local next_offset = start + (finish or 0)
    local next_cursor = identity .. ':' .. next_offset .. ':' .. tostring(st.mtime or 0) .. ':' .. anchor(f, next_offset)
    f:close()
    return { text = text, cursor = next_cursor, reset = reset, bytes_read = bytes,
             more = next_offset < size and bytes == M.limit, truncated = oversized or (reset and start > 0) }
end
return M
