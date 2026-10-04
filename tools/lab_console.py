"""Send a task-owned command file to the isolated VM serial console, inside WSL."""
import argparse
from pathlib import Path
import socket
import time

parser = argparse.ArgumentParser()
parser.add_argument('--commands', type=Path)
parser.add_argument('--seconds', type=float, default=4)
args = parser.parse_args()
sock = socket.socket(socket.AF_UNIX)
sock.connect('/var/lib/openclash-lab/serial.sock')
sock.settimeout(0.3)
sock.sendall(b'\r')
if args.commands:
    for line in args.commands.read_text().splitlines():
        sock.sendall(line.encode() + b'\r')
        time.sleep(0.1)
deadline = time.monotonic() + args.seconds
pending = b''
while time.monotonic() < deadline:
    try:
        data = sock.recv(65536)
        if not data:
            break
        pending += data
        lines = pending.split(b'\n')
        pending = lines.pop()
        for raw in lines:
            line = raw.decode(errors='replace').replace('\r', '')
            if any(word in line for word in ('chpasswd', 'ssh-rsa', 'ssh-ed25519', 'authorized_keys')):
                continue
            print(line)
    except socket.timeout:
        pass
if pending:
    line = pending.decode(errors='replace').replace('\r', '')
    if not any(word in line for word in ('chpasswd', 'ssh-rsa', 'ssh-ed25519', 'authorized_keys')):
        print(line)
