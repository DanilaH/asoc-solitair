"""Check compiled Android identity against the exact embedded-build contract."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

manifest=json.loads(Path('dist/release-manifest.json').read_text())
aapt=Path(os.environ['ANDROID_HOME'])/'build-tools/36.0.0/aapt'
badging=subprocess.check_output([str(aapt),'dump','badging',sys.argv[1]],text=True)
match=re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'",badging)
assert match, 'No compiled Android identity'
assert match.groups()==(manifest['packageId'],str(manifest['androidVersionCode']),manifest['gameVersion'])
print('APK_IDENTITY_OK '+json.dumps({'package':match[1],'versionCode':int(match[2]),'version':match[3]}))
