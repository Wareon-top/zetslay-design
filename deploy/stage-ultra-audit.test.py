import hashlib,importlib.util,json,os,subprocess,tempfile,unittest
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('stage_ultra',HERE/'stage-ultra-audit.py');stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)
def digest(data):return hashlib.sha256(data).hexdigest()
class UltraUiTests(unittest.TestCase):
 def fixture(self,root):
  local=root/'app';incoming=root/'incoming';local.mkdir();incoming.mkdir();manifest={}
  html='<html><head></head><body>PRIVATE_OPERATOR_CANARY VIDEO_BANNER PROXY_BANNER\n'+''.join('<script src="'+n+'?v=old" defer></script>\n' for n in stage.FILES)+'</body></html>\r\n'
  (local/'index.html').write_bytes(html.encode())
  for name in stage.FILES:
   before=b"const oldValue=1;\n";after=b"const newValue=2;\n";(local/name).write_bytes(before);(incoming/name).write_bytes(after);manifest[name]={'before':digest(before),'after':digest(after)}
  (incoming/'ultra-ui-manifest.json').write_text(json.dumps(manifest));return local,incoming,html
 def test_preserves_private_html_and_banners_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);local,incoming,html=self.fixture(root);stage.stage(local,incoming,root/'out');result=(root/'out/index.html').read_bytes().decode()
   self.assertEqual(result,html.replace('?v=old','?v=20261026-ultra-audit'))
   stage.stage(root/'out',incoming,root/'twice');self.assertEqual((root/'out/index.html').read_bytes(),(root/'twice/index.html').read_bytes())
 def test_unrecognized_assets_and_duplicate_includes_fail_before_output(self):
  for mode in ['asset','include']:
   with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp);local,incoming,html=self.fixture(root)
    if mode=='asset':(local/stage.FILES[0]).write_text('// independent edit')
    else:(local/'index.html').write_text(html+'<script src="ai-reviews.js"></script>')
    with self.assertRaises(ValueError):stage.stage(local,incoming,root/'out')
    self.assertFalse((root/'out').exists())
 def run_installer(self,fail=False):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);local,incoming,html=self.fixture(root);deploy=root/'deploy';deploy.mkdir();(deploy/'stage-ultra-audit.py').write_bytes((HERE/'stage-ultra-audit.py').read_bytes());(deploy/'ultra-ui-manifest.json').write_bytes((incoming/'ultra-ui-manifest.json').read_bytes())
   for name in stage.FILES:(local/name).write_bytes((incoming/name).read_bytes())
   def git(*args):return subprocess.run(['git','-C',str(root),*args],check=True,capture_output=True,text=True).stdout.strip()
   git('init');git('config','user.email','fixture@example.invalid');git('config','user.name','Test');git('add','app','deploy');git('commit','-m','fixture');revision=git('rev-parse','HEAD')
   for name in stage.FILES:(local/name).write_bytes(b'const oldValue=1;\n')
   backups=root/'backups';backups.mkdir();bin=root/'bin';bin.mkdir()
   if fail:
    mv=bin/'mv';mv.write_text('#!/bin/bash\ncase "$*" in *app/robux-relay.js*) exit 23;; esac\nexec /bin/mv "$@"\n');mv.chmod(0o755)
   result=subprocess.run(['bash',str(HERE/'update-ultra-ui.sh')],env={**os.environ,'ZETSLAY_SITE_DIR':str(root),'ZETSLAY_ULTRA_AUDIT_REVISION':revision,'ZETSLAY_BACKUP_DIR':str(backups),'PATH':str(bin)+':'+os.environ['PATH']},text=True,capture_output=True,timeout=15)
   if fail:
    self.assertNotEqual(result.returncode,0);self.assertEqual((local/'index.html').read_bytes().decode(),html)
    for name in stage.FILES:self.assertEqual((local/name).read_bytes(),b'const oldValue=1;\n')
   else:
    self.assertEqual(result.returncode,0,result.stderr);self.assertEqual((local/'index.html').read_bytes().decode(),html.replace('?v=old','?v=20261026-ultra-audit'))
    for name in stage.FILES:self.assertEqual((local/name).stat().st_mode&0o777,0o644)
   self.assertEqual(next(backups.iterdir()).stat().st_mode&0o777,0o600)
 def test_atomic_install(self):self.run_installer()
 def test_mid_publish_failure_restores_all_files(self):self.run_installer(True)
if __name__=='__main__':unittest.main()
