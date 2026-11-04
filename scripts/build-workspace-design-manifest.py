"""Regenerate the reviewed design overlay, relative to the diagnostics release."""
import difflib,hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE='bf3f875f8ce03f5e6328ce2a1fb0a8820b62a2ab'
def digest(data):return hashlib.sha256(data.replace(b'\r\n',b'\n')).hexdigest()
def old(name):return subprocess.check_output(['git','show',BASE+':'+name],cwd=ROOT)
assets=['assets/ui-foundation.css','assets/workspace-navigation.js','site-design.css','app/workspace-design.css','demo/workspace-design.css','app/cabinet-demo.js','demo/demo.js','demo/index.html','docs/index.html','docs/funpay-connect/index.html','docs/auto-delivery/index.html','docs/troubleshooting/index.html','pricing/index.html']
data={'version':'20261104-design-1','baseline':BASE,'assets':{},'accepted':{},'patches':{},'heads':[str(p.relative_to(ROOT)).replace('\\','/') for p in sorted((ROOT/'legal').glob('*.html'))]+['security/index.html']}
for name in assets:
 data['assets'][name]=digest((ROOT/name).read_bytes())
 if not name.endswith('workspace-design.css') and not name.startswith('assets/') and name!='site-design.css':data['accepted'][name]=[digest(old(name))]
name='index.html';before=old(name).decode().splitlines(True);after=(ROOT/name).read_text(encoding='utf8').splitlines(True);ops=[]
for group in difflib.SequenceMatcher(None,before,after).get_grouped_opcodes(2):ops.append({'before':''.join(before[group[0][1]:group[-1][2]]),'after':''.join(after[group[0][3]:group[-1][4]])})
data['patches'][name]=ops
target=ROOT/'deploy/workspace-design.json';text=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
if '--check' in sys.argv:
 if target.read_text(encoding='utf8')!=text:raise SystemExit('Regenerate workspace design manifest')
else:target.write_text(text,encoding='utf8')
