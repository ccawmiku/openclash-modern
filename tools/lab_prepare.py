"""Run inside Debian as root; prepare only this task's isolated VM assets."""
import hashlib
import json
import os
from pathlib import Path
import urllib.request
import zlib

ROOT = Path('/var/lib/openclash-lab')
ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
image = 'openwrt-24.10.6-x86-64-generic-ext4-combined.img.gz'
digest = '23dc6904ede514e37e9938604c9951a0601c375efdaf093c0d191d12e463f9b2'
packed = ROOT / image
if not packed.exists():
    with urllib.request.urlopen('https://downloads.openwrt.org/releases/24.10.6/targets/x86/64/' + image, timeout=45) as response:
        packed.write_bytes(response.read())
if hashlib.sha256(packed.read_bytes()).hexdigest() != digest:
    raise SystemExit('Official image SHA256 mismatch; no VM started')
disk = ROOT / 'openwrt.img'
if not disk.exists() or not (ROOT / 'image-verified.json').exists():
    # OpenWrt appends firmware metadata after the gzip member. Decode the
    # verified member without treating that documented trailer as gzip data.
    decoder = zlib.decompressobj(31)
    temporary = ROOT / 'openwrt.img.part'
    with packed.open('rb') as source, temporary.open('wb') as target:
        while chunk := source.read(65536):
            target.write(decoder.decompress(chunk))
            if decoder.eof:
                break
        if not decoder.eof:
            raise SystemExit('Incomplete compressed image')
    temporary.replace(disk)
    (ROOT / 'image-verified.json').write_text(json.dumps({'sha256': digest, 'image': image}))
os.chmod(disk, 0o600)
print(json.dumps({'image_sha256': digest, 'disk': str(disk), 'disk_bytes': disk.stat().st_size}))
