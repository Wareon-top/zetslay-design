import unittest,tempfile,shutil,importlib.util,subprocess,os
from pathlib import Path
REPO=Path(__file__).parents[1].resolve();spec=importlib.util.spec_from_file_location('stage',REPO/'deploy/stage-auto-refresh.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StageTest(unittest.TestCase):
 def test_idempotent_and_preserves_other_modules(self):
  with tempfile.TemporaryDirectory() as d:
   out=Path(d)/'out';again=Path(d)/'again';shutil.copytree(REPO/'app',out);m.stage(REPO/'app',REPO/'app',out);m.stage(out,REPO/'app',again)
   for name in m.ASSETS+['overview.js','index.html']:self.assertEqual((out/name).read_bytes(),(again/name).read_bytes())
   html=(out/'index.html').read_text();self.assertEqual(html.count('src="auto-refresh.js'),1);self.assertNotIn('src="store-refresh.js',html);self.assertLess(html.index('src="payments.js'),html.index('src="auto-refresh.js'));self.assertIn('payment-confirmation.js?v=20261016-confirmation-ticket',html)
 def test_unknown_layout_does_not_write(self):
  with tempfile.TemporaryDirectory() as d:
   local=Path(d)/'local';local.mkdir();(local/'index.html').write_text('unknown');(local/'overview.js').write_text('unknown')
   with self.assertRaises(ValueError):m.stage(local,REPO/'app',Path(d)/'out')
   self.assertFalse((Path(d)/'out').exists())
 def test_actual_installer_preserves_current_app_auth_messages_and_payments(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);site=root/'site';shutil.copytree(REPO/'app',site/'app');backup=root/'backup';backup.mkdir();bin=root/'bin';bin.mkdir();names=['app.js','messages.js','messages-actions.js','payments.js','subscription-access.js'];before={n:(site/'app'/n).read_bytes() for n in names};git=bin/'git';git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$AUTO_REFRESH_FIXTURE_SOURCE/$file";;\n*) exit 2;;\nesac\n');git.chmod(0o755)
   env={**os.environ,'PATH':str(bin)+os.pathsep+os.environ['PATH'],'AUTO_REFRESH_FIXTURE_SOURCE':str(REPO),'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backup)}
   r=subprocess.run(['bash',str(REPO/'deploy/update-auto-refresh-ui.sh')],env=env,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stdout[-3000:]+r.stderr[-3000:]);self.assertEqual({n:(site/'app'/n).read_bytes() for n in names},before);self.assertEqual(len(list(backup.iterdir())),1)
if __name__=='__main__':unittest.main()
