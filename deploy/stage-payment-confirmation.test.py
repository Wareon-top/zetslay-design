import unittest,tempfile,shutil,importlib.util,subprocess,os
from pathlib import Path
REPO=Path(__file__).parents[1].resolve();spec=importlib.util.spec_from_file_location('confirmation_stage',REPO/'deploy/stage-payment-confirmation.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ConfirmationStageTest(unittest.TestCase):
 def test_idempotent_and_preserves_unrelated_routes(self):
  with tempfile.TemporaryDirectory() as d:
   out=Path(d)/'out';again=Path(d)/'again';m.stage(REPO/'app',REPO/'app',out);m.stage(out,REPO/'app',again)
   for name in m.ASSETS+['index.html']:self.assertEqual((out/name).read_bytes(),(again/name).read_bytes())
   html=(out/'index.html').read_text();self.assertLess(html.index('src="payment-confirmation.js'),html.index('src="payments.js'));self.assertEqual(html.count('src="payment-confirmation.js'),1);self.assertIn('finance-workspace.js?v=20261015-financial-report',html)
 def test_unknown_layout_does_not_write(self):
  with tempfile.TemporaryDirectory() as d:
   local=Path(d)/'local';local.mkdir();(local/'index.html').write_text('<body>unknown</body>');(local/'payments.js').write_text('unknown')
   with self.assertRaises(ValueError):m.stage(local,REPO/'app',Path(d)/'out')
   self.assertFalse((Path(d)/'out').exists())
 def test_actual_installer_backs_up_and_leaves_auth_and_payment_config_intact(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);site=root/'site';shutil.copytree(REPO/'app',site/'app');backup=root/'backup';backup.mkdir();bin=root/'bin';bin.mkdir();original=(site/'app/app.js').read_bytes();git=bin/'git';git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$CONFIRMATION_FIXTURE_SOURCE/$file";;\n*) exit 2;;\nesac\n');git.chmod(0o755)
   env={**os.environ,'PATH':str(bin)+os.pathsep+os.environ['PATH'],'CONFIRMATION_FIXTURE_SOURCE':str(REPO),'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backup)}
   r=subprocess.run(['bash',str(REPO/'deploy/update-payment-confirmation-ui.sh')],env=env,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stdout[-4000:]+r.stderr[-4000:]);self.assertEqual((site/'app/app.js').read_bytes(),original);self.assertEqual(len(list(backup.iterdir())),1)
if __name__=='__main__':unittest.main()
