import hashlib
import json
from pathlib import Path
import sys
from zipfile import ZipFile

manifest = Path("dist/release-manifest.json").read_bytes()
prefix = "assets/public/"
with ZipFile(sys.argv[1]) as apk:
    if apk.read(prefix + "release-manifest.json") != manifest:
        raise ValueError("APK and web manifests differ")
    files = json.loads(manifest)["webPayload"]["files"]
    for path, expected in files.items():
        actual = hashlib.sha256(apk.read(prefix + path)).hexdigest()
        if actual != expected:
            raise ValueError(f"APK web payload differs at {path}")
    payload = "".join(f"{path}\0{digest}\n" for path, digest in files.items())
    if hashlib.sha256(payload.encode()).hexdigest() != json.loads(manifest)["webPayload"]["sha256"]:
        raise ValueError("Invalid web payload digest")
print(f"APK contains the verified {len(files)}-file web payload")
