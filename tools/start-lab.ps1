param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$unit = 'openclash-lab-vm'
if ($Stop) {
    & wsl -d Debian -u root --exec systemctl stop openclash-lab-ui
    & wsl -d Debian -u root --exec ssh -i /var/lib/openclash-lab/id_ed25519 -p 22222 -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/var/lib/openclash-lab/known_hosts root@127.0.0.1 'sync; poweroff'
    for ($shutdownAttempt=0; $shutdownAttempt -lt 20; $shutdownAttempt++) {
        & wsl -d Debian -u root --exec systemctl is-active --quiet $unit
        if ($LASTEXITCODE -ne 0) { break }
        Start-Sleep -Milliseconds 500
    }
    & wsl -d Debian -u root --exec systemctl is-active --quiet $unit
    if ($LASTEXITCODE -eq 0) {
        & wsl -d Debian -u root --exec systemctl stop $unit
        exit $LASTEXITCODE
    }
    exit 0
}
& wsl -d Debian -u root --exec systemctl is-active --quiet $unit
if ($LASTEXITCODE -eq 0) {
    Write-Host 'Lab already running: http://127.0.0.1:18080/cgi-bin/luci/admin/services/openclash/modern'
    exit 0
}
$prepare = '/mnt/c/Users/19070/SynologyDrive/NAS-PC-VPS-RT/router-proxy/tools/lab_prepare.py'
& wsl -d Debian -u root --exec systemd-run --unit=openclash-lab-prepare --collect --wait --pipe -p CPUQuota=100% -p MemoryMax=256M -p Nice=15 -- python3 $prepare
if ($LASTEXITCODE) { throw 'VM preparation failed' }
Write-Host '2 vCPU / 1024MB guest; VM host CPU <=1.5 logical cores, memory <=1408MB, low priority.'
Write-Host 'Keep this terminal running to retain WSL. Stop from another terminal: ./start-lab.ps1 -Stop'
& wsl -d Debian -u root --exec systemd-run --unit=$unit --collect --wait --pipe -p CPUQuota=150% -p CPUWeight=10 -p MemoryMax=1408M -p MemoryHigh=1280M -p MemorySwapMax=0 -p Nice=15 -p IOWeight=10 -p TasksMax=128 -- qemu-system-x86_64 -enable-kvm -cpu host -smp 2 -m 1024 -display none -no-reboot -monitor none -serial unix:/var/lib/openclash-lab/serial.sock,server=on,wait=off -drive file=/var/lib/openclash-lab/openwrt.img,format=raw,if=virtio -netdev user,id=labnet,hostfwd=tcp:127.0.0.1:22222-:22,hostfwd=tcp:127.0.0.1:18080-:80,hostfwd=tcp:127.0.0.1:19090-:9090 -device virtio-net-pci,netdev=labnet
if ($LASTEXITCODE) { throw 'VM start failed' }
