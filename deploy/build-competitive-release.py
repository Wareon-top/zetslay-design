"""Pin public assets and narrow patches without exporting private runtime data."""
import difflib,hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=subprocess.check_output(['git','rev-parse','d37e6b1'],cwd=ROOT).decode().strip()
ASSETS=['public-product.css','demo/index.html','demo/demo.css','demo/demo.js','docs/index.html','docs/funpay-connect/index.html','docs/auto-delivery/index.html','docs/troubleshooting/index.html','pricing/index.html','app/automation-preview.js','app/automation-preview.css']
patches={}
for path in ['app/cabinet-demo.js','app/connection-wizard-ui.js']:
 old=subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT).decode();new=(ROOT/path).read_text(encoding='utf-8');a,b=old.splitlines(keepends=True),new.splitlines(keepends=True);ops=[]
 for group in difflib.SequenceMatcher(None,a,b,autojunk=False).get_grouped_opcodes(3):
  first,last=group[0],group[-1];before=''.join(a[first[1]:last[2]]);after=''.join(b[first[3]:last[4]])
  if old.count(before)!=1 or new.count(after)!=1:raise ValueError('Non-unique patch: '+path)
  ops.append({'before':before,'after':after})
 patches[path]=ops
manifest={'version':'20261103-competitive-1','baseline':BASE,'assets':{path:hashlib.sha256((ROOT/path).read_bytes().replace(b'\r\n',b'\n')).hexdigest() for path in ASSETS},'patches':patches}
(ROOT/'deploy/competitive-release.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
