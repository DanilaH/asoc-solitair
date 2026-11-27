import hashlib
import json
from pathlib import Path
import sys
from zipfile import ZipFile

manifest = Path("dist/release-manifest.json").read_bytes()
profile = json.loads(manifest)
if (profile.get("fixtureNavigation") is not False or profile.get("archivedCampaign") is not False or profile.get("archivedEconomy") is not False
        or profile.get("campaignBoardRulesVersion") != 4
        or profile["policies"].get("campaignCore") != "campaign-core-stage1-v1"
        or profile["policies"].get("campaignEconomy") != "e4-m1-r1" or profile["balanceVersion"] != 4):
    raise ValueError("Expected ordinary Rules4 issuance and no fixture navigation")
prefix = "assets/public/"
with ZipFile(sys.argv[1]) as apk:
    if apk.read(prefix + "release-manifest.json") != manifest:
        raise ValueError("APK and web manifests differ")
    files = profile["webPayload"]["files"]
    for path, expected in files.items():
        actual = hashlib.sha256(apk.read(prefix + path)).hexdigest()
        if actual != expected:
            raise ValueError(f"APK web payload differs at {path}")
    payload = "".join(f"{path}\0{digest}\n" for path, digest in files.items())
    if hashlib.sha256(payload.encode()).hexdigest() != profile["webPayload"]["sha256"]:
        raise ValueError("Invalid web payload digest")
print(f"APK contains the verified {len(files)}-file web payload")
