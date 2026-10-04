"""Execute a command/file ONLY against the task's localhost QEMU guest."""
import argparse
from pathlib import Path
import subprocess

p = argparse.ArgumentParser()
p.add_argument('--file', type=Path)
p.add_argument('--language', choices=['sh', 'lua'], default='sh')
p.add_argument('command', nargs='?', default='uname -a')
a = p.parse_args()
base = ['ssh', '-i', '/var/lib/openclash-lab/id_ed25519', '-p', '22222',
        '-o', 'StrictHostKeyChecking=accept-new', '-o', 'UserKnownHostsFile=/var/lib/openclash-lab/known_hosts',
        '-o', 'ConnectTimeout=10', 'root@127.0.0.1']
result = subprocess.run(base + ([a.language, '-s' if a.language == 'sh' else '-'] if a.file else [a.command]),
                        input=a.file.read_text(encoding='utf-8-sig').replace('\r\n', '\n').replace('\r', '\n').encode() if a.file else None)
raise SystemExit(result.returncode)
