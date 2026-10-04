local a,b=require('nixio').mkstemp('/tmp/oc-validate-XXXXXX');print(type(a),type(b),tostring(b));if a then a:close()end;if b then require('nixio.fs').unlink(b)end
