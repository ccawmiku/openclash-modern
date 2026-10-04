import json
import urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base='http://127.0.0.1:18081/cgi-bin/luci/admin/services/openclash/'
models={'settings':{},'config-overwrite':{},'config-subscribe':{},'servers':{'file':'/etc/openclash/config/lab-example.yaml'},'config':{},'proxy-provider-file-manage':{},'rule-providers-file-manage':{},'servers-config':{'section':'lab_server','file':'/etc/openclash/config/lab-example.yaml'},'groups-config':{'section':'lab_group','file':'/etc/openclash/config/lab-example.yaml'},'proxy-provider-config':{'section':'lab_provider','file':'/etc/openclash/config/lab-example.yaml'},'custom-dns-edit':{'section':'lab_dns'},'config-subscribe-edit':{'section':'lab_sub'},'other-file-edit':{'section':'config','file':'/etc/openclash/config/lab-example.yaml'},'client':{},'log':{}}
from urllib.parse import urlencode
out={}
for model,params in models.items():
    try:
        data=json.load(urllib.request.urlopen(base+'modern_schema?'+urlencode({'model':model,**params}),timeout=30))
        maps=data.get('maps',[]); maps=maps if isinstance(maps,list) else []
        fields=[f for m in maps for s in m.get('sections',[]) for r in (s.get('rows',[]) if isinstance(s.get('rows'),list) else []) for f in r.get('fields',[])]
        out[model]={'fields':[{k:f[k] for k in ('option','label','description','kind','template','datatype','default','placeholder','choices','optional') if k in f} for f in fields], 'templates':data.get('templates',[]), 'sections':[{k:s.get(k) for k in ('type','title','addremove','extedit')} for m in maps for s in m.get('sections',[])]}
        print(model,len(fields), 'unreadable',sum(f.get('kind')=='unsupported' for f in fields))
    except Exception as e: print(model,'ERROR',str(e)); out[model]={'error':str(e)}
(root/'artifacts/all-model-schema.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
