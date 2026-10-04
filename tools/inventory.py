"""Inventory original routes and distinguish integration from actual validation."""
import json
from pathlib import Path
import re

project = Path(__file__).resolve().parents[1]
source = (project / 'upstream/openclash/luci-app-openclash/luasrc/controller/openclash.lua').read_text(encoding='utf-8')
routes = []
migrated = {'settings': 'native CBI editor; structured help; validation; custom actions',
            'config-overwrite': 'native CBI editor with DNS/rules/general/smart categories',
            'config-subscribe': 'native table and detailed editor; real CRUD tested',
            'status': 'overview read', 'action': 'service control through CSRF-protected wrapper; not started in lab',
            'config_file_list': 'file list read', 'config_file_read': 'file read',
            'config_file_save': 'CSRF-protected YAML validation and native save wrapper',
            'refresh_log':'replaced by bounded incremental modern_log; original endpoint retained',
            'log':'plugin incremental log, original core dashboard log, debug log',
            'myip_check':'replaced by explicit HTTPS-only modern_myip',
            'website_check':'modern overview tools with domain validation',
            'generate_age_key':'POST modern_age; generated secrets do not enter URLs',
            'cal_age_public_key':'POST modern_age; real roundtrip tested',
            'add_age_config':'POST modern_file_age and subscription CBI detail; tested',
            'upload_overwrite':'validated POST modern_overwrite; real upload/read/delete tested',
            'overwrite_subscribe_info':'modern overwrite editor; native persistence',
            'delete_overwrite_file':'validated POST modern_overwrite; native deletion'}
web='\n'.join(p.read_text(encoding='utf-8')for p in (project/'web/src').rglob('*')if p.suffix in {'.js','.vue'})
modern=(project/'modern/luasrc/controller/openclash_modern.lua').read_text(encoding='utf-8')
models_dir=project/'upstream/openclash/luci-app-openclash/luasrc/model/cbi/openclash'
for match in re.finditer(r'entry\(\{"admin",\s*"services",\s*"openclash",\s*"([^"\n]+)"\},\s*(call|cbi|form)\("([^"\n]+)"', source):
    route, kind, handler = match.groups()
    if route.startswith('oix_'):coverage='excluded by user; original stock implementation retained'
    elif kind in {'cbi','form'}:coverage='native schema editor'if (models_dir/(route+'.lua')).exists()else 'obsolete upstream route: referenced model file is absent in baseline'
    elif route in migrated:coverage=migrated[route]
    elif re.search(r"['\"]"+re.escape(route)+r"['\"]",web)or handler in modern:coverage='integrated native operation; see validation report for tested subset'
    else:coverage='retained native backend; used by stock helpers or replaced by schema/dashboard behavior'
    routes.append({'route': route, 'type': kind, 'handler': handler, 'migration': coverage})
output = {'upstream_tag': 'v0.47.156', 'upstream_commit': 'c3a33c1d3407956fdf8f0e0b7c1a4c52e6ad9593',
          'note': 'Original backend is unmodified. All 15 existing CBI models are available. Route presence and static integration do not prove every update/download/protocol behavior was tested. See development-status.md and artifacts for actual validation.',
          'routes': routes}
(project / 'docs/migration-inventory.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Inventoried {len(routes)} original routes with explicit integration/retention/exclusion states.')
