import { numericOptions, yamlOptions } from './validation.js'
import { parameterPurpose } from './parameter-purpose.js'
const coreDocs = 'https://wiki.metacubex.one/config/'
const titles = { custom_domain_dns:'第二 DNS 域名清单', custom_fallback_fil:'Fallback 过滤器内容', custom_fake_filter:'Fake-IP 过滤清单', custom_domain_dns_core:'按域名选择 DNS', custom_proxy_server_dns_policy:'节点域名 DNS 策略', custom_hosts:'静态 Hosts 映射', sniffer_custom:'嗅探器配置', custom_rules:'优先自定义规则', custom_rules_2:'后置自定义规则', firewall_custom:'防火墙自定义脚本', other_parameters:'协议附加 YAML 参数', edit_file:'文件内容', user:'当前配置内容', default:'运行配置内容', _generate_age_btn:'Age 密钥工具', tc_ip:'TUIC 服务器 IP', tc_token:'TUIC v4 Token', tc_uuid:'TUIC v5 UUID', tc_password:'TUIC v5 密码', udp_relay_mode:'UDP 转发方式', congestion_controller:'拥塞控制算法', tc_alpn:'TUIC ALPN', disable_sni:'禁用 SNI', reduce_rtt:'降低握手延迟', heartbeat_interval:'心跳间隔', request_timeout:'请求超时', max_udp_relay_packet_size:'UDP 转发包上限', max_open_streams:'最大并发流数', wg_ip:'WireGuard 本机 IPv4', wg_ipv6:'WireGuard 本机 IPv6', wg_dns:'WireGuard DNS', wg_mtu:'WireGuard MTU', psk:'预共享密钥', snell_version:'Snell 协议版本', alterId:'VMess 旧版额外 ID', host:'伪装 Host', path:'传输路径', h2_host:'HTTP/2 主机名', h2_path:'HTTP/2 路径', http_path:'HTTP 请求路径', custom:'HTTP 请求头', ws_opts_path:'WebSocket 路径', ws_opts_headers:'WebSocket 请求头', xhttp_opts_path:'XHTTP 路径', xhttp_opts_host:'XHTTP 主机名', vless_encryption:'VLESS 加密参数', vless_flow:'VLESS Flow', grpc_service_name:'gRPC 服务名称', reality_public_key:'Reality 公钥', reality_short_id:'Reality Short ID', max_early_data:'最大提前发送数据', early_data_header_name:'提前发送数据请求头', servername:'TLS 服务器名称', sni:'TLS SNI', alpn:'TLS ALPN', hysteria_alpn:'Hysteria ALPN', trojan_ws_path:'Trojan WebSocket 路径', trojan_ws_headers:'Trojan WebSocket 请求头', hysteria_obfs:'Hysteria 混淆方式', hysteria_obfs_password:'Hysteria 混淆密码', hysteria_auth_str:'Hysteria 认证字符串', hysteria_ca:'CA 证书文件路径', hysteria_ca_str:'CA 证书内容', recv_window_conn:'单连接接收窗口', recv_window:'接收窗口', initial_stream_receive_window:'初始流接收窗口', max_stream_receive_window:'最大流接收窗口', initial_connection_receive_window:'初始连接接收窗口', max_connection_receive_window:'最大连接接收窗口', disable_mtu_discovery:'禁用 MTU 探测', 'packet-addr':'封包地址扩展', packet_encoding:'UDP 封包格式', global_padding:'全局填充', authenticated_length:'认证长度', idle_session_check_interval:'空闲会话检查间隔', idle_session_timeout:'空闲会话超时', min_idle_session:'最少空闲会话数', masque_private_key:'MASQUE 私钥', masque_public_key:'MASQUE 公钥', masque_ip:'MASQUE IPv4', masque_ipv6:'MASQUE IPv6', masque_mtu:'MASQUE MTU', masque_remote_dns_resolve:'MASQUE 远端 DNS 解析', masque_dns:'MASQUE DNS', trusttunnel_health_check:'TrustTunnel 健康检查', trusttunnel_quic:'TrustTunnel QUIC', trusttunnel_congestion_controller:'TrustTunnel 拥塞控制', fingerprint:'证书指纹', ip_version:'出站 IP 版本', multiplex:'连接复用', multiplex_protocol:'复用协议', multiplex_max_connections:'复用连接数上限', multiplex_min_streams:'复用流数下限', multiplex_max_streams:'复用流数上限', multiplex_padding:'复用填充', multiplex_statistic:'复用统计', multiplex_only_tcp:'仅复用 TCP', routing_mark:'出站路由标记', dialer_proxy:'上游拨号策略', uselightgbm:'使用 LightGBM 模型', collectdata:'收集训练数据', policy_priority:'策略权重加成', policy_filter:'策略组节点筛选', icon:'策略组图标', ecs_subnet:'ECS 客户端网段', ecs_override:'覆盖 ECS', disable_qtype:'过滤 DNS 查询类型', specific_group:'DNS 出站策略组' }
// These entries explain effects and context; recommended values never overwrite user configuration.
const notes = {
 en_mode: ['控制 OpenClash 的 DNS 工作方式和流量接管方式；TUN / 混合会建立虚拟网络接口。', '一般先保留现有可用模式；新部署可从 Fake-IP 开始，兼容性问题再对照应用调整。'],
 enable_udp_proxy: ['决定是否把 UDP 连接交给代理内核。节点不支持 UDP 时，开启也不能补齐节点能力。', '需要游戏、QUIC 等 UDP 业务且节点支持时开启。'],
 proxy_mode: ['决定流量按规则分流、全部经过代理，还是全部直连。', '日常使用选规则模式；全局模式用于临时排查。'],
 stack_type: ['选择 TUN 处理数据包的网络栈；System 使用系统网络能力，gVisor 提供用户态网络栈。', '优先保留 System；遇到兼容问题再测试其他栈，比较内存与 CPU。'],
 delay_start: ['开机后延迟指定秒数再启动 OpenClash，给 WAN、存储和其他服务留出初始化时间。', '正常启动使用 0；开机网络未就绪时按实测增加。'],
 log_size: ['限制 OpenClash 日志的目标大小，单位 KB；较大日志便于排错，也占用 tmpfs 内存。', '资源有限时先用上游默认大小；排错结束后恢复，不持续保留大量 Debug 日志。'],
 small_flash_memory: ['把内核等运行文件移到 /tmp，减少闪存占用；重启后内存目录内容会丢失。', '闪存足够时关闭；仅在闪存不足且 RAM 余量充足时开启。'],
 bypass_gateway_compatible: ['针对旁路由拓扑修正转发行为；是否适用取决于主路由、网关和回程路径。', '主路由部署保持关闭；旁路由按实际回程问题开启测试。'],
 disable_quic_go_gso: ['关闭 quic-go 的分段卸载，供部分网卡驱动或虚拟网络不兼容时使用。', '正常使用保留关闭；确认 GSO 导致异常后再开启。'],
 enable_redirect_dns: ['把匹配的客户端 DNS 请求接入路由器解析链路；不自动加密请求，也不能覆盖所有应用自带 DoH。', '路由接管场景通常启用，并单独检查加密上游、IPv6 和应用自身 DNS。'],
 enable_custom_domain_dns_server: ['为指定域名单独使用第二 DNS 服务，绕开通常的解析路径。', '没有明确的分域需求时关闭；校园网场景先确认这条路径是否使用明文 DNS。'],
 custom_domain_dns_server: ['指定第二 DNS 服务器的地址，配合第二 DNS 域名清单使用。', '按可信解析服务的连接参数填写，不能把普通 IP 地址当作加密 DNS。'],
 custom_domain_dns: ['匹配这里列出的域名，将它们交给第二 DNS 服务解析。', '只添加确实需要特殊解析的域名，一行一个；保留 # 注释格式。'],
 lan_ac_mode: ['选择以黑名单排除设备，还是仅让白名单中的设备经过代理。', '需要全网接管时使用排除模式；仅代理少数设备时使用白名单模式。'],
 router_self_proxy: ['让路由器自身发起的连接也进入 OpenClash；会影响订阅下载、更新和系统联网。', '按路由器自身是否需要代理选择，检查更新与 DNS 自举是否形成循环。'],
 disable_udp_quic: ['限制 QUIC UDP 流量，使支持回退的应用尝试 TCP；不支持回退的业务可能失效。', '先保留现有设置；为减少 QUIC 旁路可开启，再确认业务能回退。'],
 skip_proxy_address: ['让节点服务器地址绕过透明代理，避免代理连接再次被自己接管。', '通常保留上游默认行为，修改前检查是否会产生代理回环。'],
 common_ports: ['只接管指定的常用目标端口，其他端口可能走直连。', '校园网隐私需求下不要只凭常用端口判断已完整接管；按业务范围配置。'],
 intranet_allowed: ['限制代理入口的访问来源为内网，减少公网侧直接连接入口的机会。', '家庭路由场景通常开启，并核对 WAN 防火墙。'],
 china_ip_route: ['按照指定区域 IP 清单绕过代理；依赖地址库，部分流量会直接连接。', '按实际分流目标选择；需要所有目标隐藏在隧道内时先审查绕过清单。'],
 china_ip6_route: ['按区域 IPv6 清单绕过代理，与 IPv4 清单分别生效。', '启用 IPv6 后单独核对这项与 IPv6 接管路径。'],
 stream_auto_select: ['周期检测流媒体或服务解锁情况，并自动调整符合筛选条件的节点。', '资源受限设备按需开启；没有自动解锁需求时关闭以减少后台检测。'],
 stream_auto_select_interval: ['设置自动解锁检测的间隔，单位分钟；间隔越短，请求与进程开销越多。', '优先使用上游默认间隔，确认需求后再缩短。'],
 stream_auto_select_logic: ['决定自动选择优先考虑连通性测速还是更完整的解锁检测。', '按解锁需求选择；较完整检测通常需要更多时间与外部请求。'],
 stream_auto_select_expand_group: ['检测时展开嵌套策略组，增加可选节点和测试规模。', '策略组较多或设备资源有限时先保持默认，避免不必要的大规模测试。'],
 stream_auto_select_close_con: ['切换解锁节点后关闭旧连接，让新请求更快使用新节点。', '允许业务短暂重连时开启；长连接业务按连续性需求选择。'],
 enable_custom_dns: ['允许这里定义的上游 DNS 服务器覆盖订阅中的解析配置。', '需要统一管理 DNS 时开启；先配置可达的解析服务器。'],
 enable_respect_rules: ['让 DNS 上游连接遵循路由规则；节点域名解析应有独立的自举服务器以防循环。', '配置好节点域名解析与规则后再开启；单独验证上游实际出口。'],
 append_wan_dns: ['把 WAN 提供的 DNS 地址追加到解析配置；它们可能属于校园网或运营商。', '不希望使用校园网 DNS 时关闭，并确保其他可信解析上游能完成自举。'],
 append_default_dns: ['追加插件提供的默认 DNS 项目，可能改变解析链路与自举路径。', '严格控制 DNS 出口时关闭并显式填写解析链路，避免依赖不清楚的默认项。'],
 fakeip_range: ['指定 Fake-IP IPv4 池，用虚拟地址关联域名；必须避免与实际局域网网段冲突。', '没有冲突时保留原配置；修改前核对 LAN、VPN 和其他虚拟网段。'],
 fakeip_range6: ['指定 Fake-IP IPv6 地址池；0 是上游提供的关闭值。', 'IPv6 接管未验证前保留现有设置；启用时使用不冲突的 IPv6 CIDR。'],
 store_fakeip: ['持久保存 Fake-IP 对应关系，帮助重启后保持域名与虚拟地址关联。', '优先保留默认；根据闪存写入需求和重启行为调整。'],
 custom_fallback_fil: ['设置备用 DNS 结果的筛选条件，决定哪些响应需要回退或替换。', '从已有可用模板修改，按实际 DNS 服务和分流目标设置。'],
 custom_fake_filter: ['列出不使用 Fake-IP 的域名；这些域名会返回真实地址。', '仅为确有兼容性问题的域名添加例外，不把整片域名无目的排除。'],
 custom_domain_dns_core: ['把匹配域名交给指定的 Nameserver，实现按域名选择解析服务。', '按明确的分域需求添加，并验证指定上游可达。'],
 custom_proxy_server_dns_policy: ['设置代理服务器域名的 DNS 选择策略，为代理连接建立提供自举解析。', '使用不依赖尚未建立代理连接的解析路径，避免自举回环。'],
 custom_hosts: ['建立静态域名到地址的映射，跳过这些名称的正常上游解析。', '只为地址稳定的目标配置；服务 IP 改变后需要同步修改。'],
 log_level: ['控制内核日志详细程度，Debug 会产生更多日志与格式化开销。', '日常优先 Info 或 Warning；排错时短暂使用 Debug。'],
 enable_tcp_concurrent: ['对 TCP 的候选地址并发发起连接，使用较快成功的连接。', '先保留原有设置；衡量建连收益与并发连接开销后决定。'],
 enable_unified_delay: ['使用统一方法计算节点测试延迟，便于在相同测试方法下比较节点。', '按已有测速与选路方式配置，不用一次测试结果当作长期速度。'],
 find_process_mode: ['控制进程规则匹配，路由器通常看不到 LAN 客户端的具体应用进程。', '路由器环境优先关闭进程匹配；官方文档也建议路由器使用 Off。'],
 geodata_loader: ['选择地理数据库加载方式；不同加载器在内存占用与读取方式上有差别。', 'RAM 较小优先比较低内存加载方式，按实际数据库大小测试。'],
 enable_meta_sniffer: ['从 TLS / HTTP 等流量信息推断域名，用于规则匹配；嗅探本身不会加密 SNI。', '需要域名规则补全时按需开启；域名安全要检查实际隧道与出口。'],
 enable_meta_sniffer_pure_ip: ['尝试为仅有 IP 的连接恢复域名，可能增加探测工作。', '只有纯 IP 业务需要域名匹配时开启，并验证误判与兼容性。'],
 sniffer_custom: ['调整嗅探协议、端口、跳过域名和覆盖行为。', '从内核支持的 Sniffer 示例开始，仅启用业务所需协议。'],
 smart_collect: ['收集 Smart 训练数据，会占用 RAM / 存储并带来写入开销。', '以低运行开销为目标时关闭；需要训练时限定文件大小与采样率。'],
 smart_collect_size: ['设置训练数据收集文件的大小上限，单位 MB。', '启用收集时按实际空闲空间设置，避免使用与可用内存接近的上限。'],
 smart_collect_rate: ['设置训练数据采样比例；1 收集全部样本，0 不收集。', '确需采集时按数据规模降低采样比例；低开销场景优先关闭收集。'],
 enable_custom_clash_rules: ['允许自定义规则参与运行配置；规则按顺序匹配，前面的命中会先决定出口。', '先用少量明确规则验证，再扩大清单。'],
 custom_rules: ['把自定义规则放在配置前部，提高匹配优先级。', '需要优先覆盖订阅规则时使用；策略名必须实际存在。'],
 custom_rules_2: ['把自定义规则放到后置位置，与前置规则的优先级不同。', '用于补充规则，核对前面的规则是否已提前命中。'],
 cn_port: ['Mihomo 外部控制 API 的监听端口，Dashboard 通过它读状态和切换节点。', '保留现有端口；修改后同步面板地址、访问密钥与防火墙。'],
 dashboard_password: ['保护 Mihomo 控制 API 的访问密钥，与本机测试页是否登录是两回事。', '真实部署使用独立的强随机密钥；只在隔离实验环境使用空密钥。'],
 dashboard_forward_domain: ['从公网访问面板时使用的域名，不会自动创建 DNS、转发或证书。', '仅在确有远程访问需求并已配置访问控制时填写。'],
 dashboard_forward_port: ['外部访问映射的端口，需要与反向代理或端口映射一致。', '按实际映射填写；未建立远程入口时保留现有配置。'],
 ipv6_enable: ['控制 IPv6 流量是否进入代理接管路径；IPv4 接管成功不代表 IPv6 同样生效。', '有 IPv6 业务时配置并单独验证，避免客户端经 IPv6 直连旁路。'],
 ipv6_dns: ['控制是否向客户端返回或处理 IPv6 DNS 结果，会影响应用使用 IPv6 出口。', '与 IPv6 接管状态一起配置；仅修改 AAAA 响应不能替代接管验证。'],
 config: ['选择此节点、策略组或 Provider 所属配置文件；All 表示对全部适用。', '只为指定配置使用时选对应文件，避免串入其他订阅。'],
 name: ['定义条目的名称，供文件管理、策略组与规则引用。名称改变后相关引用也需调整。', '使用容易识别且不重复的名称；修改时检查引用关系。'],
 server: ['代理节点的服务器主机名或 IP 地址；这里不填写协议前缀、路径或端口。', '严格按照服务端或订阅给出的地址填写。'],
 port: ['远端服务器的端口，与服务端监听设置一致；DNS 非标准端口也在此指定。', '按服务提供者给出的端口填写，不能由页面自动猜测。'],
 password: ['节点协议使用的认证密码，必须与服务端一致。', '使用服务提供者给出的密码，不复制示例或复用管理密码。'],
 uuid: ['VMess / VLESS 等协议使用的身份标识，格式为标准 UUID。', '从服务端配置或订阅复制，随机修改会使认证失败。'],
 tc_uuid: ['TUIC v5 的身份标识，必须与服务器配置一致。', '复制服务端提供的 UUID；TUIC v4 使用 Token，不能混用。'],
 private_key: ['客户端私钥，用于协议身份或密钥协商；格式依当前节点协议而异。', '从对应协议的密钥工具或服务端配置取得，勿填写公钥。'],
 public_key: ['远端公钥，用来验证或建立加密会话；必须对应服务端私钥。', '从服务端配置复制，保持编码格式与协议一致。'],
 preshared_key: ['WireGuard 可选的额外预共享密钥，双方需一致。', '服务器配置了 PSK 才填写，否则留空。'],
 tls: ['为当前代理传输启用 TLS；握手名称、证书和服务端能力要配套。', '遵循服务端配置；支持受验证 TLS 的服务保持证书校验。'],
 skip_cert_verify: ['跳过 TLS 证书的验证，会失去对服务器身份的一项关键检查。', '通常关闭；仅在可控的证书排错中临时使用，并尽快恢复校验。'],
 sni: ['TLS ClientHello 使用的服务器名称；未使用合适保护时可能被链路观察者看到。', '使用服务器证书与部署要求匹配的名称，不能用随意域名保证隐藏。'],
 servername: ['用于 TLS 握手与证书匹配的服务器名，具体字段由当前协议决定。', '按服务端要求填写；不要把 IP、网址路径和端口拼进名称。'],
 disable_sni: ['在支持该参数的协议中不发送 SNI；可能影响证书、CDN 或虚拟主机连接。', '按协议与服务端要求配置，不把禁用 SNI 视为通用隐私方案。'],
 reality_public_key: ['Reality 服务端的公钥，用于建立认证握手，不能使用普通 TLS 证书代替。', '从实际服务端配置复制，不能填写客户端私钥。'],
 reality_short_id: ['Reality 的短身份值，应与服务端允许的 Short ID 一致。', '从服务端复制；使用偶数位十六进制，最长 16 位。'],
 client_fingerprint: ['选择 TLS 客户端握手指纹，影响握手外观与服务端兼容性。', '优先保留订阅值；更改后检查所用协议和内核是否支持。'],
 fingerprint: ['指定服务端证书指纹，用于协议支持的证书绑定或验证。', '从可信渠道取得真实证书指纹，证书更换后需更新。'],
 path: ['协议专用的资源路径；Provider 场景则是文件路径，两者不能互换。', '节点按服务端传输路径填写；Provider 使用其配置规定的文件路径。'],
 provider_url: ['下载代理集合的 HTTP / HTTPS 地址，内容应为内核支持的 Provider YAML。', '使用可信订阅来源，优先 HTTPS；确认下载出口和认证参数。'],
 provider_interval: ['定时重新下载 Provider 的间隔，单位秒。', '按来源更新频率设置，不用极短间隔重复下载相同内容。'],
 health_check: ['定时检查 Provider 中节点的可达性；节点越多，检查工作越多。', '需要自动选路时开启，并设置合理的检查间隔。'],
 health_check_url: ['节点健康检查使用的 HTTP / HTTPS 测试地址。', '选稳定且响应体小的测试服务，避免登录页面或大文件。'],
 health_check_interval: ['节点健康检查间隔，单位秒。', '按故障切换需求设置；资源受限设备避免不必要的频繁探测。'],
 test_url: ['URL-Test / Fallback 等策略组测试节点连通性的地址。', '使用稳定且小响应的 HTTP / HTTPS 服务，各节点使用相同测试目标。'],
 test_interval: ['策略组进行连通性测试的间隔，单位秒。', '保留现有可靠间隔；缩短会增加测试请求和运行开销。'],
 tolerance: ['允许的延迟差，单位毫秒，用于减少节点因为小幅延迟变化频繁切换。', '按实际延迟波动调整；0 表示不额外提供容忍差，具体看策略类型。'],
 address: ['订阅的下载地址；多条地址按原模型要求分行填写。', '复制服务商提供的链接；URL 中的订阅 Token 属于敏感凭据。'],
 sub_ua: ['订阅下载请求的 User-Agent，服务端可能根据它返回不同格式。', '优先保留上游或服务商指定值，修改后确认仍返回正确格式。'],
 sub_headers: ['订阅下载额外请求头，一行一个，使用 Header: Value 的格式。', '只加入服务端确实要求的请求头，避免无关认证信息。'],
 sub_convert: ['把订阅发送给指定的在线转换服务，按模板生成配置。', '来源可直接支持目标格式时关闭；启用前选择可信转换服务。'],
 convert_address: ['在线订阅转换服务地址，配合转换模板使用。', '使用自建或可信转换服务，并核对 HTTPS 与可达性。'],
 config_age_secret: ['用于解密 Age 配置的私钥，格式由所选 Age 算法决定。', '使用生成工具或配置来源提供的对应密钥，避免对外分享。'],
 config_age_public: ['Age 公开收件人密钥，用于加密给对应私钥持有者。', '通过本页工具从私钥计算，避免粘贴不匹配的公钥。'],
 config_age_algo: ['选择 Age 密钥算法，决定密钥格式与生成方式。', '与配置发送方支持的算法一致，已有可用密钥保持原算法。'],
 other_parameters: ['添加当前节点、策略组或 Provider 的额外内核参数，会参与最终 YAML 合并。', '只有确认当前内核支持时才添加；先使用少量参数并检查最终配置。'],
 interface_name: ['为出站连接选择指定网卡，限制连接的出口接口。', '多出口才按需指定；普通单 WAN 场景保留默认选择。'],
 routing_mark: ['给出站数据包设置路由标记，需要对应的系统策略路由规则。', '没有已配置的策略路由时保留原值，避免把数据包送进错误路由表。'],
 ecs_subnet: ['向支持 ECS 的 DNS 服务提供客户端地址信息，可能改变解析结果并暴露网络区域。', '没有明确 CDN 定位需求时留空；填写前确认愿意提供的地址信息。'],
 disable_qtype: ['丢弃指定 DNS 查询类型；填写 DNS 类型的数值编号。', '仅过滤明确不需要的类型；例如 A 为 1、AAAA 为 28，避免误伤正常解析。'],
 specific_group: ['为 DNS 连接指定出站策略组，控制解析服务连接使用的路径。', '选实际存在且可建立连接的组，避免依赖本次 DNS 查询产生回环。'],
 ip: ['DNS 服务地址或节点地址，按所选协议的格式填写；DNS 页不重复填写协议前缀。', '按服务提供者参数填写；HTTPS DNS 可包含服务路径。'],
 group: ['指定 DNS 的用途：日常解析、备用解析或用于自举的默认解析。', '至少保证 Nameserver 可用；节点域名与自举解析应避免依赖尚未建立的代理。']
}
const formats = { port:'整数 0–65535；0 是否禁用取决于该入口，远端连接通常使用 1–65535', integer:'整数，可带负号', uinteger:'非负整数', ipaddr:'IPv4 或 IPv6 地址，不含 URL 前缀', ip4addr:'IPv4 地址，例如 192.168.1.10', ip6addr:'IPv6 地址，例如 2001:db8::1', ipmask:'IP 或 CIDR / 掩码，例如 192.168.1.0/24', host:'主机名、IPv4 或 IPv6，不含协议、路径和端口', 'list(macaddr)':'MAC 地址；列表一行一项，例如 02:00:00:00:00:01', portrange:'起止端口范围，起点不大于终点，例如 10000-20000', 'or(port, portrange)':'单端口或端口范围，例如 443 或 10000-20000', 'range(0,63)':'0–63 的数值', 'or(ip4addr, ip6addr)':'IPv4 或 IPv6 地址' }
const recordTitles={dns_servers:{enabled:'使用此 DNS 服务器',group:'解析用途',ip:'服务器地址',port:'服务端口',type:'连接协议'},authentication:{enabled:'使用此认证账号'},groups:{enabled:'启用策略组',config:'所属配置文件',type:'选路方式',name:'策略组名称'},servers:{enabled:'启用节点',config:'所属配置文件',type:'节点协议',name:'节点名称',server:'节点地址',port:'节点端口',udp:'启用 UDP 转发'},'proxy-provider':{enabled:'启用节点来源',config:'所属配置文件',type:'来源类型',name:'来源名称',provider_url:'订阅地址'},config_subscribe:{name:'订阅名称',address:'订阅地址'}}
const actionTitles={Delete_Unused_Servers:'清理未使用的节点',Delete_Servers:'删除全部节点',Delete_Proxy_Provider:'删除全部节点来源',Delete_Groups:'删除全部策略组',Load_Config:'从配置文件导入',Commit:'保存配置',Apply:'保存并应用',Back:'返回'}
const scheduleTitles={config_update_week_time:'执行日期（每天或每周指定日）',auto_update_time:'执行时刻（所选日期的小时）',enabled:'启用当前记录'}
export const displayLabel = field => recordTitles[field.section_type]?.[field.option] || scheduleTitles[field.option] || actionTitles[field.option] || titles[field.option] || field.label?.replace(/^\*/, '').trim() || ({ 'openclash/update':'版本与备份', 'openclash/switch_mode':'DNS 设置模式' }[field.originalTemplate]) || field.button?.trim() || field.option || '工具'
export function recordValue(field,value){if(field.section_type==='dns_servers'&&field.option==='group'){const key=String(value||'').trim().toLowerCase();return ({nameserver:'常规解析（nameserver）',fallback:'备用解析（fallback）',default:'自举解析（default-nameserver）','default-nameserver':'自举解析（default-nameserver）'})[key]||value}if(field.option!=='type')return value;const names=field.section_type==='groups'?{select:'手动选择',url_test:'自动测速','url-test':'自动测速',fallback:'故障切换','load-balance':'负载均衡',relay:'链式代理',smart:'智能选路'}:field.section_type==='proxy-provider'?{http:'远程订阅',file:'本地文件',inline:'内嵌节点'}:field.section_type==='servers'?{ss:'Shadowsocks',ssr:'ShadowsocksR',vmess:'VMess',vless:'VLESS',trojan:'Trojan',socks5:'SOCKS5',http:'HTTP',hysteria:'Hysteria',hysteria2:'Hysteria 2',tuic:'TUIC',wireguard:'WireGuard',snell:'Snell',anytls:'AnyTLS',ssh:'SSH'}:null;return names?.[value]||value}
export function fieldHelp(field, model) {
 const option = field.option, label = displayLabel(field), choice = field.choices || [], descriptions = (field.description || '').split(/\n+/).map(s => s.trim()).filter(Boolean)
 let [purpose, recommended] = notes[option] || []
 if (!purpose) purpose = parameterPurpose[option]
 if (!purpose && option.startsWith('stream_auto_select_group_key_')) { purpose = '按正则表达式匹配需要自动选择节点的策略组名称。'; recommended = '只匹配实际需要解锁的组；使用 ^ 和 $ 可避免匹配过宽。' }
 if (!purpose && option.startsWith('stream_auto_select_region_key_')) { purpose = '按正则表达式筛选可接受的解锁地区。'; recommended = '没有地区限制时保留现有筛选；有需求时填写实际地区代号。' }
 if (!purpose && option.startsWith('stream_auto_select_node_key_')) { purpose = '按正则表达式筛选可以参与解锁检测的节点名称。'; recommended = '只纳入所需节点，减少无关节点的检测开销。' }
 if (!purpose && option.startsWith('stream_auto_select_')) { purpose = `为${label}启用或配置自动解锁检测，配合对应策略组、地区与节点筛选使用。`; recommended = '只开启实际使用的服务，确认对应策略组存在。' }
 if (!purpose && /update_week_time$|restart_week_time$/.test(option)) purpose = '设置定时任务运行的星期；所有合法选项按当前插件列出。'
 if (!purpose && /update_day_time$|restart_day_time$|auto_update_time$/.test(option)) purpose = '设置定时任务的运行小时，使用路由器系统时区。'
 if (!purpose && /auto_update$|auto_restart$/.test(option)) { purpose = `控制${label}的定时任务；开启后会按配置的时间周期执行。`; recommended = '按更新需求开启，选择业务较少的时段，避免多个任务同时运行。' }
 if (!purpose && /black_ips|white_ips|network.*pass|chnroute.*pass/.test(option)) { purpose = '定义参与访问控制或绕过代理的地址集合，结合所在分组的黑白名单模式解释。'; recommended = '每项只包含明确需要处理的 IP / CIDR；核对方向，避免把应代理的目标放入绕过清单。' }
 if (!purpose && /black_macs|white_macs/.test(option)) purpose = '按设备 MAC 地址匹配访问控制条目，决定对应设备是否进入代理。'
 if (!purpose && /filter|keyword/.test(option)) { purpose = `通过${label}筛选节点或规则候选；正则与普通文本的区别以原模型说明为准。`; recommended = '先用少量明确匹配内容测试，再扩大筛选，避免清空全部候选。' }
 if (!purpose && /alpn/.test(option)) { purpose = '设置 TLS 应用层协议协商列表，顺序与服务端支持范围影响连接兼容性。'; recommended = '遵循服务端给出的 ALPN 列表，一行一个协议；不要随意删改。' }
 if (!purpose && /headers/.test(option)) { purpose = '附加传输层 HTTP 请求头，必须与服务端的伪装或鉴权配置一致。'; recommended = '按服务端要求填写，保持字段名、值与原模型格式一致。' }
 if (!purpose && /path$/.test(option)) { purpose = '设置当前传输协议使用的路径，需与服务端反向代理或监听配置匹配。'; recommended = '使用服务端给出的路径，通常以 / 开头；不能填完整网站 URL。' }
 if (!purpose && /host$/.test(option)) { purpose = '设置传输请求的主机名 / Host，供服务端选择对应虚拟主机。'; recommended = '与服务端部署匹配，不在主机名内追加路径或协议。' }
 if (!purpose && /window/.test(option)) { purpose = '设置 QUIC 接收窗口，影响允许缓冲的数据量；窗口增大会增加内存需求。'; recommended = '优先保留协议默认值，只有测得窗口限制后再调整。' }
 if (!purpose && /mtu/.test(option)) { purpose = '设置虚拟接口或隧道的数据包大小上限，需容纳隧道封装开销。'; recommended = '先保留协议默认 MTU；发生分片或大包失败时再测量调整。' }
 if (!purpose && /mux|multiplex/.test(option)) { purpose = '设置多路复用，让多个应用连接共享底层连接；具体能力取决于协议和服务端。'; recommended = '以服务端支持为前提；保留可用默认值，按连接规模测量后调整。' }
 if (!purpose && /password|secret|key|token|psk/.test(option)) { purpose = '填写当前协议对应的认证凭据或密钥；字段格式必须与服务端相符。'; recommended = '从可信的服务端配置复制对应字段，不使用其他协议的密钥代替。' }
 if (!purpose) purpose = descriptions[0] || (field.template === 'cbi/button' || field.originalTemplate?.startsWith('openclash/') ? `执行${label}对应的 OpenClash 功能；结果会在本页显示。` : `${label}是当前配置条目的${choice.length ? '行为选择' : '参数'}，用于${model.includes('subscribe') ? '订阅生成与更新' : model.includes('config') ? '相应协议或策略的运行配置' : '插件接管与管理流程'}。`)
 let format = formats[field.datatype] || (field.datatype ? `按照原生类型 ${field.datatype} 填写；保存前会再次调用原生校验。` : numericOptions.has(option) ? '非负整数；单位见名称与原说明' : yamlOptions.has(option) ? 'YAML 配置片段，空格缩进，禁止 Tab 缩进和重复键' : field.template === 'cbi/fvalue' ? '开关：开启或关闭，界面自动转换为插件要求的值' : ['cbi/lvalue','cbi/mvalue'].includes(field.template) ? '从下面列出的合法值中选择' : field.template === 'cbi/dynlist' ? '每行一个条目；按原说明使用地址、域名或匹配表达式' : field.password ? '按服务端要求填写凭据；区分大小写，保留编码格式' : field.template === 'cbi/tvalue' ? '多行文本，保留原模型规定的缩进、注释和列表格式' : field.template === 'cbi/button' || field.template === 'cbi/dvalue' ? '操作或状态控件，无需填写参数' : '文本；按本项用途和原说明填写，区分大小写')
 if (/uuid/.test(option)) format = '标准 UUID：8-4-4-4-12 位十六进制，例如 00000000-0000-4000-8000-000000000000'
 if (option === 'reality_short_id') format = '偶数位十六进制，最长 16 位；应与服务端一致'
 if (option === 'smart_collect_rate') format = '0–1 的数值，表示采样比例'
 if (['provider_url','test_url','health_check_url','custom_template_url'].includes(option) || option.endsWith('_custom_url')) format = '完整 HTTP / HTTPS URL，例如 https://example.com/config.yaml'
 const reference = field.default !== undefined && field.default !== null && field.default !== '' ? (field.template==='cbi/fvalue'?(String(field.default)===String(field.enabled)?'开启':'关闭'):choice.find(c => String(c.value) === String(field.default))?.label || String(field.default)) : null
 if (!recommended) recommended = reference ? `没有特殊需求时先参考上游默认值“${reference}”；已有稳定配置优先保留，并在修改后检查实际效果。` : field.optional ? '没有明确需求时保留现有值或留空；依赖服务端的参数必须使用服务端实际值。' : '按当前服务端、网络或引用对象的实际参数填写；此项没有通用推荐值。'
 return { label, purpose, format, range: choice.length ? choice.map(c => ({ label:c.label, value:c.value })) : [], required: field.optional ? '允许留空；留空的处理以原模型为准。' : '必填；依赖条件满足时不能为空。', recommended, reference, notes: descriptions.filter(s => s !== purpose), conditions: (field.deps || []).map(rule => Object.entries(rule).filter(([key]) => !key.startsWith('!')).map(([key, value]) => `${key} = ${value}`).join(rule['!or'] ? ' 或 ' : ' 且 ')), source: `https://github.com/vernesong/OpenClash/blob/v0.47.156/luci-app-openclash/luasrc/model/cbi/openclash/${model}.lua`, docs: coreDocs }
}
