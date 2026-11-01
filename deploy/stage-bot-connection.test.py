import importlib.util,tempfile,unittest,subprocess,os,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-bot-connection.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StageTests(unittest.TestCase):
 def test_preserves_live_customizations_is_repeatable_and_passes_integration(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=root/'local';local.mkdir()
   app=(ROOT/'app/app.js').read_text();start=app.index('async function advanceConnectionWizard()');end=app.index('\nfunction bindInteractions()',start)
   # The production form previously sent only the token. Other unrelated code
   # and privately configured API URLs must survive this targeted update.
   app=app[:start]+"async function advanceConnectionWizard() { /* token-only deployed version */ }\n"+app[end:]+ '\n// LOCAL_PROXY_AND_ADMIN_FIXES\n'
   (local/'app.js').write_text(app);(local/'index.html').write_text((ROOT/'app/index.html').read_text().replace('https://api.zetslay.pro','https://private-api.test'))
   m.stage(local,ROOT/'app',root/'out');m.stage(root/'out',ROOT/'app',root/'again')
   self.assertIn('LOCAL_PROXY_AND_ADMIN_FIXES',(root/'out/app.js').read_text());html=(root/'out/index.html').read_text();self.assertIn('https://private-api.test',html);self.assertEqual(html.count('src="connection-wizard-ui.js?'),1)
   self.assertEqual((root/'out/app.js').read_bytes(),(root/'again/app.js').read_bytes());self.assertEqual(html,(root/'again/index.html').read_text())
   result=subprocess.run(['node','--test',str(root/'out/connection-wizard-ui.test.mjs')],capture_output=True,text=True,timeout=30)
   self.assertEqual(result.returncode,0,result.stdout+result.stderr)
 def test_installer_backs_up_private_files_and_restores_on_partial_publish_failure(self):
  for fail in (False,True):
   with self.subTest(fail=fail),tempfile.TemporaryDirectory() as d:
    root=Path(d);site=root/'site';(site/'app').mkdir(parents=True);(site/'deploy').mkdir();backups=root/'backups';backups.mkdir()
    names=['index.html','app.js','connection-wizard-ui.js','connection-wizard-ui.css','connection-wizard-ui.test.mjs']
    for name in names:shutil.copy2(ROOT/'app'/name,site/'app'/name)
    shutil.copy2(ROOT/'deploy/stage-bot-connection.py',site/'deploy/stage-bot-connection.py')
    def git(*args):return subprocess.run(['git','-C',str(site),*args],capture_output=True,text=True,check=True).stdout.strip()
    git('init','-q');git('config','user.email','fixture@example.invalid');git('config','user.name','Fixture');git('add','.');git('commit','-qm','fixture');revision=git('rev-parse','HEAD')
    original=(site/'app/app.js').read_bytes()+b'\n// LOCAL_PROXY_AND_ADMIN_FIXES\n';(site/'app/app.js').write_bytes(original);html=(site/'app/index.html').read_bytes()
    env={**os.environ,'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BOT_CONNECTION_REVISION':revision,'ZETSLAY_BACKUP_DIR':str(backups)}
    if fail:
     for name in names[2:]:(site/'app'/name).unlink()
     binary=root/'bin';binary.mkdir();mv=binary/'mv';mv.write_text('#!/bin/sh\nfor arg in "$@";do if [ "$arg" = app/index.html ];then exit 1;fi;done\nexec /bin/mv "$@"\n');mv.chmod(0o755);env['PATH']=str(binary)+os.pathsep+env['PATH']
    result=subprocess.run(['bash',str(ROOT/'deploy/update-bot-connection-ui.sh')],capture_output=True,text=True,env=env,timeout=30)
    self.assertEqual(result.returncode,1 if fail else 0,result.stdout+result.stderr)
    archive=list(backups.glob('*.tar.gz'));self.assertEqual(len(archive),1);self.assertEqual(archive[0].stat().st_mode&0o777,0o600)
    if fail:
     self.assertEqual((site/'app/app.js').read_bytes(),original);self.assertEqual((site/'app/index.html').read_bytes(),html)
     self.assertTrue(all(not (site/'app'/name).exists() for name in names[2:]))
    else:
     self.assertIn(b'LOCAL_PROXY_AND_ADMIN_FIXES',(site/'app/app.js').read_bytes());self.assertIn(m.VERSION,(site/'app/index.html').read_text());self.assertEqual((site/'app/app.js').stat().st_mode&0o777,0o644)
 def test_unknown_source_stops_before_any_staging_write(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'app.js').write_text('unknown');(root/'index.html').write_text('<script src="app.js"></script>')
   with self.assertRaises(ValueError):m.stage(root,ROOT/'app',root/'out')
   self.assertFalse((root/'out').exists())
if __name__=='__main__':unittest.main()
