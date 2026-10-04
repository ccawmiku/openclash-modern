"""Provision only the task-owned QEMU guest, run as root inside WSL."""
from pathlib import Path
import subprocess
import socket
import time

root = Path('/var/lib/openclash-lab')
key = root / 'id_ed25519'
if not key.exists():
    subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(key)], check=True)
pub = key.with_suffix('.pub').read_text().strip()
commands = [
    "uci set network.lan.proto='dhcp'",
    "uci delete network.lan.ipaddr; uci delete network.lan.netmask; uci delete network.lan.ip6assign",
    "uci set dhcp.lan.ignore='1'; uci commit network; uci commit dhcp",
    "mkdir -p /etc/dropbear; chmod 700 /etc/dropbear",
    "printf '%s\\n' '" + pub + "' > /etc/dropbear/authorized_keys; chmod 600 /etc/dropbear/authorized_keys",
    "/etc/init.d/network restart; /etc/init.d/dropbear restart",
]
sock = socket.socket(socket.AF_UNIX)
sock.connect(str(root / 'serial.sock'))
sock.sendall(b'\r')
time.sleep(.2)
for command in commands:
    sock.sendall(command.encode() + b'\r')
    time.sleep(.3)
sock.close()
print('Guest DHCP and task-owned SSH key configured; private key remains in WSL.')
