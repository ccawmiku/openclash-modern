param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$unit = 'openclash-lab-ui'
if ($Stop) {
    & wsl -d Debian -u root --exec systemctl stop $unit
    exit $LASTEXITCODE
}
& wsl -d Debian -u root --exec systemctl is-active --quiet openclash-lab-vm
if ($LASTEXITCODE) { throw '先启动 start-lab.ps1，并保持虚拟机终端运行。' }
& wsl -d Debian -u root --exec systemctl is-active --quiet $unit
if ($LASTEXITCODE -eq 0) {
    Write-Host '无需登录的本机界面：http://127.0.0.1:18081/'
    exit 0
}
$bridge = (& wsl -d Debian --exec wslpath -a (Join-Path $PSScriptRoot 'lab_ui.py')).Trim()
& wsl -d Debian -u root --exec systemd-run --unit=$unit --collect -p CPUQuota=50% -p MemoryMax=256M -p MemorySwapMax=0 -p Nice=15 -- python3 $bridge
if ($LASTEXITCODE) { throw '本机界面启动失败' }
Write-Host '无需登录的本机界面：http://127.0.0.1:18081/'
