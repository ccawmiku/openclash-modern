const fields = [
  ['en_mode', '运行方式', 'cbi/lvalue', 'redir-host', [['redir-host', 'Redir Host'], ['fake-ip', 'Fake IP']], 'op_mode'],
  ['enable_meta_sniffer', '域名嗅探', 'cbi/fvalue', '0', [], 'op_mode'],
  ['mixed_port', '混合代理端口', 'cbi/value', '7893', [], 'traffic_control'],
  ['enable_custom_dns', '自定义 DNS', 'cbi/fvalue', '1', [], 'dns'],
  ['dns_port', 'DNS 监听端口', 'cbi/value', '7874', [], 'dns'],
  ['cn_port', '控制接口端口', 'cbi/value', '9090', [], 'dashboard'],
  ['dashboard_type', '节点面板', 'cbi/lvalue', 'metacubexd', [['metacubexd', 'MetaCubeXD'], ['zashboard', 'Zashboard']], 'dashboard'],
  ['Commit', '保存设置', 'cbi/button', '', [], null],
].map(([option, label, template, value, choices, tab]) => ({ id: `cbid.openclash.config.${option}`, option, label, button: label, template, value, choices: choices.map(([value, label]) => ({ value, label })), tab, deps: [], enabled: '1', disabled: '0' }))
export function fixtures(action, params) {
  if (action === 'status') return { clash: true, core_type: 'Meta', run_mode: 'fake-ip', rule_mode: 'rule', metacubexd: true, cn_port: '9090', daip: '192.168.1.1' }
  if (action === 'modern_schema') return { model: params.model, maps: [{ config: 'openclash', title: '设置', sections: [{ type: 'openclash', title: '', tabs: [{ name: 'op_mode', title: '运行模式' }, { name: 'traffic_control', title: '流量控制' }, { name: 'dns', title: 'DNS 设置' }, { name: 'dashboard', title: '控制面板' }], rows: [{ id: 'config', fields }] }] }], unsupported: [] }
  if (action === 'config_file_list') return { config_files: [{ name: 'home.yaml', path: '/etc/openclash/config/home.yaml', size: '24 KB' }], current_config: '/etc/openclash/config/home.yaml' }
  if (action === 'modern_log') return { text: params.cursor ? '' : '2026-10-03 10:32:14 [Info] 这是界面演示日志，未连接真实设备。\n', cursor: 'preview', reset: !params.cursor, bytes_read: 0 }
  if (action === 'config_file_read') return { content: '# 演示配置\nmode: rule\nlog-level: info\n' }
  return {}
}
