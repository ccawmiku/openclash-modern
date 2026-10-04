# OpenClash 与 MetaCubeXD 复用方案

日期：2026-10-03。状态：当前设计方向与源码初步评估，尚未修改或部署生产服务。

最新范围覆盖本文件中的删减与新增提议：用户明确要求保留 OpenClash 全部功能，先讨论页面与管理运行性能；DNS/SNI 安全观察作为并列独立组件另行设计。旧兼容路径、Dashboard 或其他现有功能不得据本文件直接删除。CF 优选等新增功能暂缓。当前要求见 [管理运行性能讨论](management-performance.md)。

## 用户要求

- 拒绝先前手写的界面预览，采用现成的 Web 工程方式。
- 使用 MetaCubeXD，保留 Clash 的多节点与多策略组选择体验。
- Mihomo 为内核；尽量兼容后续内核升级。
- OpenClash 配置界面需要精简，DNS/SNI 隐私、监控、CF 优选与性能要求继续保留。

## 当前结论

推荐从 OpenClash 的可追踪基线出发做定制版本，并在 MetaCubeXD 上添加路由器扩展。网络接管先复用和验证，再逐步收敛；前端以原有 Dashboard 为主。

这是基于已读源码的初步建议，不意味着完整后端审计已经完成。尚未建立定制代码分支，尚未确定最终 OpenClash 基线。

## 已检查事实

- 本机 HTTP 只读访问用户提供的 /ui/metacubexd/，返回 200，标题 MetaCubeXD，引用 _nuxt 静态资源。仅据此识别构建类型，未确认安装的具体面板版本。
- 先前 SSH 检查：生产 OpenClash 为 0.47.097，fw4/nftables，x86/64；Mihomo 是 alpha 版本。
- 当前 OpenClash 上游 Makefile 声明 0.47.156；安装与卸载流程包含服务、配置和防火墙处理。不能将它等同于生产版本。
- 当前 OpenClash 上游 init 脚本同时涉及 dnsmasq、策略路由、防火墙与服务生命周期；LuCI 控制器也承担众多管理动作。
- 当前 MetaCubeXD 上游为 monorepo；UI 使用 Vue、Nuxt、TypeScript、Tailwind/DaisyUI 等，并支持静态生成和 hash 路由。

上述上游代码来自当日默认分支，只用于调查；实施前需要固定可验证的 tag/commit。

## 三个边界

### MetaCubeXD

保留策略组、组内节点选择、延迟测试、连接、规则和日志等现有功能。配置中的策略组仍是切换单位，各组可以独立选择；不把界面改成只能选择一条全局线路。

新增路由器设置、隐私验证、设备统计、历史统计与 CF 优选入口。优先复用现有组件和样式体系，扩展集中在少量页面、菜单入口与 API 客户端，避免深改节点选择组件。

路由器使用静态 UI 模式。开发与构建在 PC 或构建环境进行；不为此在路由器运行 Node.js、Electron 或整套 Docker 管理栈。上游新的 server/agent 模式不自动取代 OpenClash，避免出现两个服务管理同一内核。

### OpenClash

先保留已验证的核心服务管理、订阅/配置处理、dnsmasq 集成与 fw4 接管逻辑。建立后端门面和操作白名单，向新 UI 暴露明确动作及状态；不得暴露通用 shell 执行接口。

后续只针对实际需要逐项精简：旧 LuCI 配置表单、重复面板、额外转换链、无关定时任务与经过验证后可移除的旧平台兼容路径。针对当前 iStoreOS/fw4 设备的定制范围需明确记录。

不能仅依据源码体积删除功能，也不能把隐藏表单当作后台开销已经减少。删除依赖前检查调用链、启停/升级/恢复行为和网络测试。

### Mihomo

保持独立的官方内核。常见节点与策略组请求保留官方 API 语义，网关转发；自有历史数据和路由器管理请求使用独立 API 命名空间。

影响配置所有权、安全策略或服务生命周期的写操作由管理服务统一处理，防止 MetaCubeXD 的配置操作和 OpenClash 覆写机制互相覆盖。

## 前端组织

沿用 MetaCubeXD 现有导航与布局，不继续推进固定五项自制界面。

- 节点/代理：保留多组多节点切换；在适用的 CF 线路或组详情添加优选任务。
- 总览与连接：扩展设备归属、历史趋势和隐私状态，明确统计口径。
- 路由器设置：少量局部分组，涵盖配置与订阅来源、网络/隐私、维护；高级项按需展开。

初期即使设置仍由 LuCI 后端处理，日常入口也应明确，避免重新产生两个节点编辑中心。系统配置与节点选择的所有权不同，用户应能辨认并理解。

## 上游跟进

- OpenClash、MetaCubeXD 和 Mihomo 分别记录版本或 commit、源码来源与构建结果。
- 定制改动保持小范围、可识别，避免一次性格式化上游整库。
- 上游管理插件更新需合并并验证本地补丁；内核更新、面板更新与插件更新分别发布。
- 安装包更新不能静默覆盖定制 UI、配置和守护策略；首轮后端审计需检查各自动更新路径。
- 先按 OpenClash 配置语义建立门面，避免同时运行另一套全面配置生成器；逐步迁移后再切换所有权。
- 只读 API 和节点选择尽量保持上游兼容；只有实际发生差异才增加局部适配。

## 开发顺序

1. 对比生产版本与拟采用的上游基线；固定源码，梳理配置、服务、DNS、fw4、更新、卸载与控制接口调用链。
2. 保持原节点切换行为，完成 MetaCubeXD 的静态构建和 LuCI 入口集成；验证 HTTP、WebSocket、认证、子路径与浏览器缓存更新。
3. 建立少量路由器管理接口，精简配置流程，并统一安全相关设置和写操作。
4. 完成 DNS/IPv6、路由器自身流量与故障阻断验证。
5. 增加经过验证的设备/历史统计与 CF 优选。
6. 基于性能与调用链证据逐项删除后台开销，并执行升级/回滚兼容检查。

源码调查和本地构建可以先做。生产部署时同一时刻只能有一个网络接管管理者，不能让原版与定制版同时修改路由和防火墙。

## 官方参考

- [OpenClash 仓库](https://github.com/vernesong/OpenClash)
- [OpenClash Makefile](https://github.com/vernesong/OpenClash/blob/master/luci-app-openclash/Makefile)
- [OpenClash 服务脚本](https://github.com/vernesong/OpenClash/blob/master/luci-app-openclash/root/etc/init.d/openclash)
- [MetaCubeXD 仓库](https://github.com/MetaCubeX/metacubexd)
- [MetaCubeXD UI package](https://github.com/MetaCubeX/metacubexd/blob/main/packages/ui/package.json)
- [MetaCubeXD 静态 UI 配置](https://github.com/MetaCubeX/metacubexd/blob/main/packages/ui/nuxt.config.ts)
