# OpenClash 现代管理

现代化管理扩展：重做管理界面，复用 OpenClash 原生配置与服务逻辑，独立增加节点历史、流量隐私观察和持续加密 DNS。保留原 OpenClash 配置、内核和官方面板；独立安装三个扩展包。

[公开仓库](https://github.com/ccawmiku/openclash-modern) · [下载发布包](https://github.com/ccawmiku/openclash-modern/releases) · [验收记录](docs/development-status.md) · [安装与升级](docs/install-and-upgrade.md)

## 当前实现

- Vue 3 + Vite 静态页面：概览、设置、节点策略、节点监控、Dashboard、隐私监控、配置文件、日志。路由器无需 Node。
- 首页常用控制默认展开，显示真实流量、连接、CPU、内存和负载，提供五分钟流量图、四服务并发出口查询及访问检查。
- 15 个原生 CBI 模型、结构化参数说明、前后端校验；oixCloud 按要求移除。设置按分类逐项编辑，说明默认展开，格式与范围合为“填写要求”；开关仅显示用途与建议。
- 节点、策略组、Provider、批量操作分开浏览，使用明确名称。保留节点/组/订阅/Provider 编辑、排序、上传、分享、Age、备份、维护与原有更新功能。
- 设置模型使用可见导航；DNS 按主题、用途、记录和详情分层。新增记录先填写校验，取消不创建；记录卡片提供详情、排序、删除和有明确对象的启用开关。只读状态集中展示，操作按钮仅说明用途。
- 原样 iframe 嵌入 MetaCubeXD。面板资源、面板连接配置与内核分别维护，没有改动上游面板代码。
- 独立节点历史：HTTPS 请求耗时、可用率、P95、中位数、波动、故障恢复、近次曲线、7 天小时图、导出和检查点。内核关闭或监控失效记为未知，不算节点故障。
- 独立 DNS：默认阿里 DoH，失败使用腾讯 DNSPod DoH；固定自举记录、TLS 证书校验、IPv4/IPv6 53 端口接管和阻断。代理关闭后继续运行，两家都不可用时不回退明文 DNS。
- 隐私仪表盘：WAN 加密／明文／未知比例（记录或字节）、协议分布、五分钟观察趋势、LAN/WAN 明文 DNS、国外 SNI、国外直连、路径及覆盖问题。国内外仅复用 Mihomo 命中规则和目标 GeoIP，缺少证据显示未知，旧 APNIC 分类已移除。
- 节点监控和隐私监控的设置为独立页面，可直接打开或刷新，仪表盘下方不再显示设置表单。连接详情可查看规则、路径、域名暴露与观察位置。
- RAM 中保存运行快照、抓包元数据、节点记录；节点历史默认每小时写一次检查点，可关闭持久化。原日志保留策略未被偷偷改写。

字段/操作可用、联网功能已验收、真实路由器适用性是不同口径，详见验收记录。当前不包含 Cloudflare 优选新模块。

## 本机运行

从本仓库的父目录执行，或移除命令中的 `router-proxy/` 前缀。虚拟机固定 2 vCPU、1024MiB RAM，宿主 CPU 预算 1.5 核；前端工具另有限制。

```powershell
# 保持这个终端运行；停止用同一脚本的 -Stop，脚本会先同步并关机。
powershell -NoProfile -ExecutionPolicy Bypass -File router-proxy/tools/start-lab.ps1

# 另一个终端启动 localhost 免登录预览。
powershell -NoProfile -ExecutionPolicy Bypass -File router-proxy/tools/start-ui.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File router-proxy/tools/run-web.ps1 build
powershell -NoProfile -ExecutionPolicy Bypass -File router-proxy/tools/run-web.ps1 test
powershell -NoProfile -ExecutionPolicy Bypass -File router-proxy/tools/run-web.ps1 browser-test
powershell -NoProfile -ExecutionPolicy Bypass -File router-proxy/tools/run-web.ps1 migration-test
powershell -NoProfile -ExecutionPolicy Bypass -File router-proxy/tools/run-web.ps1 extended-test
powershell -NoProfile -ExecutionPolicy Bypass -File router-proxy/tools/run-web.ps1 ui-test
powershell -NoProfile -ExecutionPolicy Bypass -File router-proxy/tools/run-web.ps1 record-test
powershell -NoProfile -ExecutionPolicy Bypass -File router-proxy/tools/run-web.ps1 privacy-test
```

实验服务使用 localhost 18080（原生 LuCI）、18081（免登录桥接）、19090（实验内核 API/面板）、22222（实验 SSH）。桥接仅用于本机，路由器原生 LuCI 认证和 ACL 保留。没有修改全局 WSL 资源配置，实验工具固定连接 localhost，不会自动操作生产设备。

重启会清空实验机 `/tmp` 内的内核、面板和测试网卡；恢复方法见安装指南。实验镜像、SSH key、第三方二进制缓存位于 WSL 的 `/var/lib/openclash-lab`，不进入 Drive。

## 代码与安装包

| 路径 | 用途 |
| --- | --- |
| `web/` | 静态前端、字段帮助和浏览器测试 |
| `modern/` | LuCI 适配器、静态资源与配置校验 |
| `upstream/openclash/` | 固定版本上游子模块，构建与实验参考 |
| `privacy/` | 独立 DoH/DNS 防护、包观察器、隐私服务 |
| `node-health/` | 独立节点探测与有界历史 |
| `packaging/modern/` | 管理页面的 OpenWrt SDK 包定义 |
| `tools/` | 受限构建、实验部署、故障与性能验收 |
| `artifacts/packages/` | 已验收的 IPK 与 SHA256 清单 |
| `artifacts/sdk/` | 现代页面的 SDK 源目录 |

页面和节点历史包为 all；原生观察器目前提供 x86_64 包，其他架构要用匹配的 OpenWrt SDK 编译。ARM/MIPS、APK 尚未验证。实际部署与迁移记录见 [路由器部署](docs/router-deployment.md)。

用户已取消每小时优化任务，应用确认该任务已不存在。当前仅完成本轮验收并保留本机网页预览；后续优化列为待办。

## 获取源码

```sh
git clone --recurse-submodules https://github.com/ccawmiku/openclash-modern.git
cd openclash-modern
```

本项目以 GPL-3.0 许可发布，保留 OpenClash、Mihomo 与 MetaCubeXD 的独立升级路径。生产设备使用原生 LuCI 登录与写权限校验；免登录预览仅用于 localhost 实验。
