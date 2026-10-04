# 将隐私监控迁移到 Neko Master 的技术评估

> 历史技术评估。后续已按用户要求完成合并与部署，最终实现见 [neko-smart](https://github.com/ccawmiku/neko-smart)。以下记录保留研究时的结论，不代表当前运行架构。

研究日期：2026-10-04。研究基线为上游 `foru17/neko-master`，提交 `6f72cfd0db69e2952713f24a648812407fef1e78`，根包版本 1.4.0。本次只研究源码并制定迁移方案，没有替换生产界面、安装 Neko Master 或改动路由器服务。

## 结论与部署位置

可以迁移隐私仪表盘、历史记录与分析。建议 Neko Master 的 Web、Collector 和数据库先运行在受限的本机环境，之后再考虑 NAS；路由器保留独立 DNS、防火墙、抓包观察器和有界上报器。LuCI 继续管理 OpenClash 原设置，并提供隐私面板入口。原版 MetaCubeXD 继续用于节点控制。

Neko Master 是 Next.js/React Web、Fastify Collector、SQLite/可选 ClickHouse 和 Go Agent 的组合。其生产 Docker 镜像使用 Node.js，不是现有 LuCI 的纯静态前端替换件。在路由器上运行完整面板虽然可能实现，但是否有性能收益必须实测；目前不应把完整服务搬上路由器。

代理关闭、面板关闭或 Collector 离线均不能停止独立 DNS 防护。不能把“面板连接失败”显示成“流量安全”。

## 已核实的源码边界

| 源码位置 | 当前行为 | 对迁移的影响 |
| --- | --- | --- |
| `apps/web/package.json` | React、Next.js、Recharts、TanStack Query、Tailwind | 可复用原生图表、主题、查询状态与布局；现有 Vue 页面需要重写为 React 组件 |
| `apps/web/components/layout/navigation.tsx` 与 Dashboard Content | 原生导航按页面 ID 注册 | 可新增隐私入口；未发现公开的第三方页面插件注册接口，仍需要少量上游接入改动 |
| `apps/collector/src/modules/collector/gateway.collector.ts` | 从 Mihomo 连接提取域名、IP、规则、节点链与流量增量 | 适合历史流量统计；现有统计对象不保留完整隐私证据 |
| `packages/shared/src/index.ts` | 连接类型包含协议、端口、GeoIP 等元数据 | 类型存在不等于统计流水或 Agent 已保留这些字段 |
| `apps/agent/internal/gateway/client.go` | Go 解码只保留 host、sniffHost、源/目标 IP 等部分连接字段 | 不能直接完成五元组关联；缺失协议、端口及目标 GeoIP |
| `apps/agent/internal/domain/types.go` | 上报域名、IP、源 IP、规则、节点链和流量 | 不包含 WAN 抓包、SNI、明文 DNS、观察位置或覆盖状态 |
| `apps/collector/src/modules/app/app.ts` | 原生 Agent 认证、协议校验、请求去重、批量写入 | 复用认证设计；新增隐私字段不能假定会穿透现有清洗与数据库写入路径 |
| `apps/collector/src/modules/geo/geo.service.ts` | 本地 MMDB 查询失败也会尝试在线 API | 必须显式禁止外部回退；只设置 local 模式不足以避免目标 IP 外发 |
| `apps/web/components/features/health/backend-health-chart.tsx` | 已有后端健康历史图表 | 可复用视觉组件，不能把后端健康等同所有节点的延迟和可用率 |

默认地理信息提供方为 online，默认端点为 `https://api.ipinfo.es/ipinfo`。隐私分类继续读取 Mihomo 的实际规则、规则内容和目标 GeoIP，不以 Neko 的国家统计、节点位置或 DIRECT/PROXY 名称代替网站国内外判断。证据缺失或冲突显示未知。

## 数据链路与模块

```text
路由器 WAN/LAN 抓包元数据 + conntrack/NAT + Mihomo 连接证据
                        ↓
           有界、认证、版本化的隐私上报
                        ↓
       Neko Collector 隐私关联 / 统计 / 历史数据库
                        ↓
       Neko Web 隐私仪表盘 / 风险详情 / 独立设置页

路由器独立 DoH + DNS 路由切换 + 明文 DNS 阻断
               （与上面的面板链路独立运行）
```

建议新增独立 `privacy` Collector 模块、共享隐私类型、React 功能目录和专用历史表。隐私写入与现有流量统计分开，不能再次把 WAN 字节添加到原生 TrafficUpdate，造成重复计费。

初期由现有 router-privacy 生成快照，上报器读取本地数据，先验证面板和统计语义。后续再将昂贵的 Lua 连接关联、汇总与序列化逐步移到 Collector，路由器发送原始元数据和必要的 NAT 映射。后者才可能明显降低路由器 CPU；仅改前端不会降低当前汇总开销。

目前真实路由器隐私汇总约占单核 18%，这是迁移后的重点对照项，不是 Neko 的性能测量。需要在相近业务负载下比较 CPU、RSS、上报字节、丢包和界面响应，不能先承诺固定节省比例。

## 独立上报协议

建议增加专用的 `/api/agent/privacy/report`，以下是设计字段，不是上游已存在的接口：

| 字段组 | 内容与用途 |
| --- | --- |
| 版本与身份 | privacyProtocolVersion、backendId、agentId、observerBootId；复用后端绑定和认证，不上传 LuCI 密码 |
| 去重与时间 | requestId、sequence、observedAt、windowStart、windowEnd；重试不重复写入，重启不串接旧计数器 |
| 覆盖状态 | 接口、采集新鲜度、核心可用性、丢包、容量淘汰、分片、卸载及本地队列丢弃数 |
| 连接身份 | flowId、协议、源/目标地址与端口、观察位置、必要的 NAT 对应关系 |
| 观察证据 | 协议识别依据、WAN 可见 SNI、明文 DNS、ECH 提议、解析器健康与 DNS 路由状态 |
| 核心证据 | Mihomo 连接 ID、规则/内容、节点链、目标 GeoIP、分类依据、证据冲突 |
| 流量计数 | 明确 cumulative 或 delta；不能把当前快照的累计字节当作每次新增流量 |

保留现有流量协议兼容性。若修改上游 Agent 的既有消息契约，应遵循其 AgentProtocolVersion 与服务端最低版本约束；优先独立版本和能力协商，避免让旧 Agent 的普通流量功能失效。

上报只发元数据，不持久保存应用正文、节点密钥或订阅凭据。批量、压缩、退避与队列上限明确；Collector 离线时使用有界 RAM 缓冲，溢出上报缺口，不无限写路由器闪存。跨设备链路采用证书校验和认证。

## 仪表盘设计

主页面使用 Neko 原生主题与时间范围，设备和风险维度可交叉筛选：

1. 顶部持续显示采集覆盖状态、证据更新时间、代理状态与独立 DNS 状态。缺口不能被一枚绿色状态遮住。
2. 加密 / 明文 / 未知的字节比例、可识别协议分布、流量趋势；连接数作为独立切换指标，不与字节混算。
3. DNS 分开显示 LAN 明文请求、WAN 明文外发、独立 DoH 健康、国内外证据与未知分类。LAN 向路由器发明文 DNS 不自动算校园网泄露。
4. SNI 展示 WAN 可见域名、其中有国外证据的域名、路由路径与趋势。Mihomo sniffHost 仅用于关联，不能视为 WAN 已泄露；ECH 提议或 TLS 1.3 不代表域名隐藏成功。
5. 国外直连列表及历史事件展示真实规则、目的端点、关联依据、设备和时间。直连本身与不符合预期的直连区分展示，DNS 上游不混入网站直连统计。
6. 证据详情抽屉串联 LAN、NAT、WAN 与核心规则；提供未知原因、丢包和覆盖缺口。不给缺乏依据的综合“安全评分”。

采集、保留期限与保护配置进入独立设置页，不堆到仪表盘底部。实际 DNS 和防火墙配置仍由路由器执行，远程保存需使用受认证的适配接口并读取结果确认。

新历史采用按时间区间计算的 WAN 字节增量。现有 60 点趋势是当前缓存快照，不可无损转换成严格的历史吞吐；旧数据只在保留对应语义时导入，不能补造历史。

## 升级与验收

尽量让隐私模块独立，只在导航、路由注册、认证复用及必要的核心元数据接入处维护小补丁。目前没有可确认的官方扩展 SDK，不能承诺上游升级完全零改动。固定上游基线、记录补丁边界，升级时验证契约与接口能力。

按以下顺序实施：

1. 本机受限环境接入现有真实快照，重建 Neko 隐私页面；以“现有数据展示”标明历史与覆盖能力。
2. 增加去重、累计计数差分、历史保留和离线缺口，验证明文 DNS / SNI / 国外直连的证据链。
3. 增加完整核心元数据与 NAT 上报，把关联汇总移到 Collector，并做实际性能对照。
4. 验证代理关闭、核心 API 失效、面板停机及重连：DNS 防护继续工作，未知与缺口正确显示。
5. 保持原 OpenClash 设置、配置文件、订阅和 MetaCubeXD；确认结果后切换 LuCI 面板入口，保留回退。

测试重点是流量重复计数、计数器重置、迟到/重试批次、NAT 误关联、LAN/WAN 混淆、GeoIP 外部回退、未知与证据冲突、页面离开停止刷新及手机布局。Neko 修改按其 AGENTS.md 要求执行相关校验，数据库变更同时处理迁移、保留、删除及 ClickHouse 对应行为。

## 研究来源

- [上游仓库与部署说明](https://github.com/foru17/neko-master)
- [Agent 架构与认证约束](https://github.com/foru17/neko-master/blob/6f72cfd0db69e2952713f24a648812407fef1e78/docs/agent/overview.md)
- [Go 连接解码](https://github.com/foru17/neko-master/blob/6f72cfd0db69e2952713f24a648812407fef1e78/apps/agent/internal/gateway/client.go)
- [Collector 连接处理](https://github.com/foru17/neko-master/blob/6f72cfd0db69e2952713f24a648812407fef1e78/apps/collector/src/modules/collector/gateway.collector.ts)
- [GeoIP 查询与回退](https://github.com/foru17/neko-master/blob/6f72cfd0db69e2952713f24a648812407fef1e78/apps/collector/src/modules/geo/geo.service.ts)
- [上游开发约束](https://github.com/foru17/neko-master/blob/6f72cfd0db69e2952713f24a648812407fef1e78/AGENTS.md)

上游为 MIT，保留其版权和许可。现有独立路由器组件的许可保持原有声明；通过协议交互不应误标为全部源码均采用上游 MIT。
