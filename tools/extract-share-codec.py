"""Reuse upstream protocol codecs without LuCI's DOM, forms or legacy UI."""
from pathlib import Path
import re
import hashlib

root = Path(__file__).resolve().parents[1]
source = root / 'upstream/openclash/luci-app-openclash/luasrc/view/openclash/server_url.htm'
text = source.read_text(encoding='utf-8')
script = text.split('//<![CDATA[', 1)[1].split('//]]>', 1)[0]
remove = {'getFormElements', 'dispatchFieldChange', 'getCodeMirrorInstance', 'setElementValue',
          'getElementValue', 'getDynamicListContainer', 'getDynamicListInputs', 'syncDynamicListSelect',
          'tryExpandDynamicListRows', 'setFormValue', 'getFormValue', 'export_url', 'import_url'}
parts = re.split(r'(?=^function \w+\()', script, flags=re.M)
kept = []
for part in parts:
    name = re.match(r'function (\w+)\(', part)
    if name and name[1] not in remove: kept.append(part)
body = ''.join(kept)
assert 'document.' not in body and '<%' not in body and 'setTimeout' not in body
adapter = '''
function getFormValue(sid, field) {
  const value = values['cbid.openclash.' + sid + '.' + field];
  return Array.isArray(value) ? value.join(',') : String(value ?? '');
}
function setFormValue(sid, field, value) {
  const id = 'cbid.openclash.' + sid + '.' + field;
  const kind = fields.find(f => f.id === id)?.template;
  values[id] = ['cbi/dynlist', 'cbi/mvalue'].includes(kind) ? normalizeListValue(value) : String(value ?? '');
}
const codecs = { ss: [parseSS, exportSS], ssr: [parseSSR, exportSSR], vmess: [parseVmess, exportVmess],
  vless: [parseVless, exportVless], trojan: [parseTrojan, exportTrojan], hysteria: [parseHysteria, exportHysteria],
  hysteria2: [parseHysteria2, exportHysteria2], hy2: [parseHysteria2, exportHysteria2], tuic: [parseTuic, exportTuic],
  socks5: [parseSocks, exportSocks], socks: [parseSocks, exportSocks], http: [parseHttp, exportHttp],
  https: [parseHttp, exportHttp], anytls: [parseAnyTLS, exportAnyTLS], mieru: [parseMieru, exportMieru] };
return {
  import(link, sid) {
    const scheme = link.split('://')[0].toLowerCase(), codec = codecs[scheme];
    if (!codec) throw Error('不支持的分享协议');
    beginImportOtherParameters(sid);
    try {
      const payload = ['ss', 'ssr', 'vmess'].includes(scheme) ? link.split('://').slice(1).join('://') : link;
      if (!codec[0](payload, sid)) throw Error('分享链接格式无效');
    } finally { endImportOtherParameters(); }
  },
  export(sid) {
    const codec = codecs[getFormValue(sid, 'type').toLowerCase()];
    const link = codec?.[1](sid);
    if (!link) throw Error('该协议不支持导出，或必要字段未填写');
    return link;
  }
};
'''
output = '// Generated from upstream server_url.htm; regenerate with tools/extract-share-codec.py.\n'
output += '// SHA256 ' + hashlib.sha256(source.read_bytes()).hexdigest() + '\n'
output += 'export function createShareCodec(values, fields) {\n' + body + '\n' + adapter + '\n}\n'
(root / 'web/src/share-codec.js').write_text(output, encoding='utf-8')
print('Protocol codec extracted, no legacy DOM or template dependencies.')
