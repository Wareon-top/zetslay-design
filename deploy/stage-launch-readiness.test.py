import importlib.util,json,shutil,tempfile,unittest,subprocess,os
from pathlib import Path
spec=importlib.util.spec_from_file_location('launch',Path(__file__).with_name('stage-launch-readiness.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ROOT=Path(__file__).resolve().parents[1]
class LaunchStageTests(unittest.TestCase):
 def fixture(self):
  temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup);p=Path(temp.name);local=p/'local';incoming=p/'incoming';incoming.mkdir()
  for f in m.FILES[:4]:
   (local/f).parent.mkdir(parents=True,exist_ok=True);shutil.copy(ROOT/f,local/f)
  (local/'assets').mkdir();(local/'assets/zetslay-orderflow.webp').touch()
  for f in ('launch-readiness-patches.json','launch-readiness-fragments.json'):shutil.copy(ROOT/'deploy'/f,incoming/f)
  for f in m.FILES[4:]:
   (incoming/f).parent.mkdir(parents=True,exist_ok=True);shutil.copy(ROOT/f,incoming/f)
  return p,local,incoming
 def test_installed_runtime_preserved_idempotence_and_metadata(self):
  p,local,inc=self.fixture()
  patches=json.loads((inc/'launch-readiness-patches.json').read_text())
  for patch in reversed(patches):
   f=local/patch['file'];f.write_text(f.read_text().replace(patch['after'],patch['before'],1))
  f=local/'app/app.js';f.write_text(f.read_text()+'\n// KEEP_SERVER_FIX\n')
  for f in ['index.html','app/index.html']:
   a=local/f;a.write_text(a.read_text().replace('</body>','<div id="keep-private-current-copy"></div></body>'))
  m.stage(local,inc,p/'out')
  self.assertIn('KEEP_SERVER_FIX',(p/'out/app/app.js').read_text())
  for f in ['index.html','app/index.html']:self.assertIn('keep-private-current-copy',(p/'out'/f).read_text())
  self.assertEqual((p/'out/app/index.html').read_text().count('data-auth-confirm-row'),1)
  self.assertEqual((p/'out/index.html').read_text().count('property="og:title"'),1)
  shutil.copytree(local/'assets',p/'out/assets');m.stage(p/'out',inc,p/'again')
  for f in m.FILES:self.assertEqual((p/'out'/f).read_bytes(),(p/'again'/f).read_bytes())
 def test_old_public_variant_gets_complete_email_recovery(self):
  p,local,inc=self.fixture()
  patches=json.loads((inc/'launch-readiness-patches.json').read_text())
  js=(local/'app/app.js').read_text()
  for patch in reversed(patches):
   if patch['file']=='app/app.js':js=js.replace(patch['after'],patch['before'],1)
  fragments=json.loads((inc/'launch-readiness-fragments.json').read_text())
  js=js.replace("let registrationEmail = '';",'').replace('let authAttemptRevision = 0;','').replace(fragments['resendFunction'],'')
  (local/'app/app.js').write_text(js)
  html=(local/'app/index.html').read_text();start=html.index('<button class="auth-resend"');end=html.index('</button>',start)+len('</button>');(local/'app/index.html').write_text(html[:start]+html[end:])
  m.stage(local,inc,p/'out');out=(p/'out/app/app.js').read_text()
  self.assertEqual(out.count("let registrationEmail = '';"),1);self.assertEqual(out.count('let authAttemptRevision = 0;'),1)
  self.assertEqual(out.count('async function resendVerification('),1);self.assertIn('data-auth-resend',(p/'out/app/index.html').read_text())
  subprocess.run(['node','--check',str(p/'out/app/app.js')],check=True,capture_output=True)
 def test_unknown_runtime_aborts_before_writing(self):
  p,local,inc=self.fixture();(local/'app/app.js').write_text('unrecognized runtime');
  with self.assertRaises(ValueError):m.stage(local,inc,p/'out')
  self.assertFalse((p/'out').exists())
 def test_installer_restores_partial_write_and_removes_new_files(self):
  p,local,inc=self.fixture();backup=p/'backup';backup.mkdir();bin=p/'bin';bin.mkdir()
  # Optional public files were absent on the VPS before the update.
  (local/'legal').mkdir();before={f:(local/f).read_bytes() for f in m.FILES[:4]}
  (bin/'git').write_text("#!/usr/bin/env python3\nimport sys,pathlib\na=sys.argv[1:]\nif a[0]=='rev-parse':print('fixture')\nelif a[0]=='show':sys.stdout.buffer.write((pathlib.Path("+repr(str(ROOT))+")/a[1].split(':',1)[1]).read_bytes())\n")
  (bin/'mv').write_text("#!/usr/bin/env python3\nimport os,sys\nif sys.argv[-1]=='index.html':sys.exit(1)\nos.replace(sys.argv[-2],sys.argv[-1])\n")
  for f in bin.iterdir():f.chmod(0o755)
  env={**os.environ,'PATH':str(bin)+':'+os.environ['PATH'],'ZETSLAY_SITE_DIR':str(local),'ZETSLAY_BACKUP_DIR':str(backup),'ZETSLAY_LAUNCH_READINESS_REVISION':'fixture'}
  r=subprocess.run(['bash',str(ROOT/'deploy/update-launch-readiness-ui.sh')],env=env,capture_output=True,text=True,timeout=30)
  self.assertNotEqual(r.returncode,0,r.stdout+r.stderr);self.assertIn('Прежние файлы восстановлены',r.stdout)
  for f,data in before.items():self.assertEqual((local/f).read_bytes(),data)
  for f in m.FILES[4:]:self.assertFalse((local/f).exists())
if __name__=='__main__':unittest.main()
