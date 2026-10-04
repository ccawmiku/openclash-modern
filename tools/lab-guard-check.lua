local g=dofile('/usr/share/router-privacy/guard.lua');local json=require 'luci.jsonc'
local result=g.firewall_status();print(json.stringify(result));print('valid',g.firewall_valid())
