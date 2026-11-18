"""Inspect the delivered debug APK itself; no device, live SDK or balance claim."""
import argparse
import hashlib
import json
import re
import struct
import subprocess
import zipfile
from pathlib import Path


def build_config(data):
    def u32(offset):
        return struct.unpack_from('<I', data, offset)[0]

    def leb(offset):
        value = shift = 0
        while True:
            byte = data[offset]
            offset += 1
            value |= (byte & 127) << shift
            if byte < 128:
                return value, offset
            shift += 7

    strings = []
    for i in range(u32(0x38)):
        _, offset = leb(u32(u32(0x3c) + i * 4))
        strings.append(data[offset:data.index(b'\0', offset)].decode('utf-8', errors='replace'))
    types = [strings[u32(u32(0x44) + i * 4)] for i in range(u32(0x40))]
    fields = [strings[u32(u32(0x54) + i * 8 + 4)] for i in range(u32(0x50))]
    for i in range(u32(0x60)):
        offset = u32(0x64) + i * 32
        if types[u32(offset)] != 'Lcom/danilah/asocsolitair/BuildConfig;':
            continue
        cursor = u32(offset + 24)
        sizes = []
        for _ in range(4):
            count, cursor = leb(cursor)
            sizes.append(count)
        names, index = [], 0
        for _ in range(sizes[0]):
            diff, cursor = leb(cursor)
            _, cursor = leb(cursor)
            index += diff
            names.append(fields[index])
        count, cursor = leb(u32(offset + 28))
        result = {}
        for name in names[:count]:
            header = data[cursor]
            cursor += 1
            kind, width = header & 31, (header >> 5) + 1
            if kind in (0x1e, 0x1f):
                value = None if kind == 0x1e else bool(header >> 5)
            else:
                value = int.from_bytes(data[cursor:cursor + width], 'little', signed=kind == 4)
                cursor += width
                if kind == 0x17:
                    value = strings[value]
            result[name] = value
        return result
    return None


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('apk', type=Path)
parser.add_argument('--build-tools', required=True, type=Path)
parser.add_argument('--source', required=True)
parser.add_argument('--run', required=True, type=int)
parser.add_argument('--artifact', required=True, type=int)
parser.add_argument('--archive', type=Path)
parser.add_argument('--dist', type=Path, default=Path('dist'))
parser.add_argument('--version', default='0.18.0')
parser.add_argument('--version-code', type=int, default=27)
parser.add_argument('--output', type=Path, default=Path('docs/qa/content-v7/source-apk.json'))
args = parser.parse_args()
certificate = '0335b87262e17f94803da322f0b8a0ca6ad04101246d0e701f3fc7d358a8b64e'
signature = subprocess.check_output([str(args.build_tools / 'apksigner'), 'verify', '--print-certs', str(args.apk)], text=True)
assert re.findall(r'certificate SHA-256 digest: ([a-f0-9]{64})', signature) == [certificate], 'Incompatible preview signer'
badging = subprocess.check_output([str(args.build_tools / 'aapt'), 'dump', 'badging', str(args.apk)], text=True).splitlines()[0]
assert "name='com.danilah.asocsolitair.debug'" in badging and f"versionCode='{args.version_code}'" in badging and f"versionName='{args.version}'" in badging, badging
with zipfile.ZipFile(args.apk) as apk:
    files = [p for p in args.dist.rglob('*') if p.is_file()]
    for path in files:
        assert apk.read('assets/public/' + path.relative_to(args.dist).as_posix()) == path.read_bytes(), str(path) + ' differs'
    extras = set(n for n in apk.namelist() if n.startswith('assets/public/') and not n.endswith('/')) - {'assets/public/' + p.relative_to(args.dist).as_posix() for p in files}
    assert extras <= {'assets/public/cordova.js', 'assets/public/cordova_plugins.js'}, extras
    assert all(not apk.read(n) for n in extras), 'Unexpected Cordova shim content'
    configs = [c for n in apk.namelist() if re.fullmatch(r'classes\d*\.dex', n) and (c := build_config(apk.read(n))) is not None]
assert len(configs) == 1
expected = {'APPLICATION_ID': 'com.danilah.asocsolitair.debug', 'VERSION_CODE': args.version_code, 'VERSION_NAME': args.version, 'AD_MODE': 'test', 'ANALYTICS_API_KEY': '', 'BANNER_AD_UNIT_ID': 'demo-banner-yandex', 'INTERSTITIAL_AD_UNIT_ID': 'demo-interstitial-yandex', 'REWARDED_AD_UNIT_ID': 'demo-rewarded-yandex'}
assert {k: configs[0].get(k) for k in expected} == expected, 'Packaged debug services differ from the expected test configuration'
report = {'source': args.source, 'run': args.run, 'artifact': args.artifact, 'apk': args.apk.name, 'bytes': args.apk.stat().st_size, 'sha256': hashlib.sha256(args.apk.read_bytes()).hexdigest(), 'signerSHA256': certificate, 'webFilesMatched': len(files), 'runtimeHTMLSHA': hashlib.sha256((args.dist / 'index.html').read_bytes()).hexdigest(), 'emptyCordovaShims': sorted(extras), 'dexBuildConfig': expected, 'limits': 'Packaged source, signer and test configuration verified. Physical Android installation, native ad playback, audio and human balance remain untested.'}
if args.archive:
    report['artifactZIPsha256'] = hashlib.sha256(args.archive.read_bytes()).hexdigest()
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
