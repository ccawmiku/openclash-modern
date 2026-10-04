# 安装、升级与实验恢复

当前产物在 `artifacts/packages/`，文件和 SHA256 以 `manifest.json` 为准。安装包已在 localhost OpenWrt 24.10.6 和现有 iStoreOS 24.10.6 x86/64 路由器验证；生产迁移步骤见 router-deployment.md。

## 三个独立包

| 包 | 依赖与边界 |
| --- | --- |
| luci-app-openclash-modern | 已有 OpenClash、luci-compat、ruby-yaml；静态页面、CBI 适配和 YAML 验证 |
| router-node-health | LuCI Lua 支持；通过本机标准 Mihomo API 顺序探测，不依赖 OpenClash 服务启动 |
| router-privacy | https-dns-proxy、ca-bundle、dnsmasq、nftables-json、conntrack；原生观察器按目标架构编译 |

页面/节点包是 all；观察器目前为 x86_64。隐私 SDK 源在 `privacy/Makefile`，节点 SDK 源在 `node-health/Makefile`，页面的完整 SDK 源树在 `artifacts/sdk/luci-app-openclash-modern/`。其他架构需对应固件 SDK/工具链，未发布已验证 ARM/MIPS 或 APK 包。

使用官方包源解决依赖，保留现有 dnsmasq-full（提供 dnsmasq）。生产环境不要照搬实验机替换 dnsmasq 的流程。实验机为安装原版 OpenClash，已正常安装 dnsmasq-full 和 kmod-tun。

## 安装和启用

先备份原 OpenClash 数据、UCI、网络与防火墙配置；节点历史检查点独立备份 `/etc/router-node-health/history.json`。安装三个匹配的 IPK。默认两个新增服务关闭，安装不会自动改变 DNS 出口或防火墙策略。LuCI 页面入口为“OpenClash → Modern management”。

```sh
opkg install ./luci-app-openclash-modern_0.1.0-1_all.ipk
opkg install ./router-node-health_0.1.0-1_all.ipk
opkg install ./router-privacy_0.1.0-1_x86_64.ipk
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

在独立监控页启用服务：

- 节点监控通常继承 OpenClash API 端口/密钥；独立内核可以填写本机 API 端口和密钥。默认 120 秒/节点、32 个节点；小型路由器优先 120–300 秒。不要为此把内核 API 暴露到公网。
- DNS/隐私页核对实际 WAN 和全部客户端 LAN 接口。默认阿里 DoH、腾讯 DNSPod 备用、自举地址与端口；确认没有监听端口冲突。两家解析失败时保持阻断，解析会不可用。
- 完整观察模式会关闭流量卸载；它提高可见性，可能降低峰值转发速度。停止监控会恢复先前卸载设置；明确关闭 DNS 才撤销 DNS 保护。

免登录桥接仅为 PC localhost 实验入口，不是路由器上的通用免认证服务。

## 升级与回退

三个模块不打包内核或 MetaCubeXD。内核与原版面板按照原有方式单独更新，历史模块只依赖稳定 API。先保存检查点，再备份两个新 UCI 文件与原 OpenClash 数据。

正常 `opkg install 新版本.ipk` 保留 `/etc/config/router_privacy` 和 `/etc/config/router_node_health`；配置差异时 opkg 可能保留 `-opkg` 默认文件，需人工或迁移工具核对。节点检查点是用户数据，不属于安装包覆盖的文件。管理页面不会覆盖 OpenClash UCI。模块升级后重启独立服务、rpcd/uhttpd，重新检查 DNS、面板连接和节点状态。

回退用已有已验证包与 `opkg --force-downgrade install`，然后重新验收。已实际测试三个包从 0.1.0-1 → 0.1.1-1 → 0.1.0-1，三个 UCI 文件和历史检查点哈希不变。已有 Mihomo v1.19.31/v1.19.32 的标准 API 兼容记录；不承诺任意未来内核、上游 CBI 或安装脚本都永远无变化。

原 OpenClash 卸载/部分重装脚本会清理其数据目录，升级原插件前仍需完整备份。现代 YAML 验证器放在独立 `/usr/share/openclash-modern/`，避免被原插件清理 `/usr/share/openclash/` 时顺带删除。

## 实验机恢复

虚拟机磁盘位于 WSL `/var/lib/openclash-lab/openwrt.img`。`start-lab.ps1 -Stop` 先 `sync` 并关机，再停止本项目 unit；不能用全局 `wsl --shutdown` 代替。

虚拟机 `/tmp` 内的官方实验内核、原版面板、测试节点和网络命名空间每次启动后要恢复。保持 `start-lab.ps1` 终端运行，在另一个终端从仓库根目录执行：

```powershell
wsl -d Debian -u root -- python3 /mnt/c/Users/19070/SynologyDrive/NAS-PC-VPS-RT/router-proxy/tools/deploy-lab-dashboard.py
wsl -d Debian -u root -- python3 /mnt/c/Users/19070/SynologyDrive/NAS-PC-VPS-RT/router-proxy/tools/lab_ssh.py --file /mnt/c/Users/19070/SynologyDrive/NAS-PC-VPS-RT/router-proxy/tools/lab-node-fixture.sh
wsl -d Debian -u root -- python3 /mnt/c/Users/19070/SynologyDrive/NAS-PC-VPS-RT/router-proxy/tools/lab_ssh.py --file /mnt/c/Users/19070/SynologyDrive/NAS-PC-VPS-RT/router-proxy/tools/lab-privacy-init.sh
wsl -d Debian -u root -- python3 /mnt/c/Users/19070/SynologyDrive/NAS-PC-VPS-RT/router-proxy/tools/lab_ssh.py --file /mnt/c/Users/19070/SynologyDrive/NAS-PC-VPS-RT/router-proxy/tools/lab-fixtures.sh
powershell -NoProfile -ExecutionPolicy Bypass -File router-proxy/tools/start-ui.ps1
```

上述工具只连接 localhost 22222，不接受生产设备地址。实验节点是本地 HTTP CONNECT 夹具，Mihomo 独立运行，不启用透明接管；从客户端命名空间发起测试流量用于验证 DNS 和路径证据。

源码构建用受限 `run-web.ps1 build`、`stage-web.py`，IPK 构建在 WSL 运行 `build-packages.py`；默认版本 0.1.0-1，升级验收工具会临时构建测试版本并回退。编译原生 C 观察器需 SDK 或实验环境的 musl 编译器；最终安装必须与路由器架构匹配。