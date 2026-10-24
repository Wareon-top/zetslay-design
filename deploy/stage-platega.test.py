import unittest,tempfile,shutil,importlib.util,json,subprocess,os
from pathlib import Path
REPO=Path(__file__).parents[1].resolve()
spec=importlib.util.spec_from_file_location('payments_stage',REPO/'deploy/stage-platega.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PaymentStageTest(unittest.TestCase):
 def fixture(self,d):
  local=Path(d)/'local';shutil.copytree(REPO/'app',local/'app');shutil.copytree(REPO/'legal',local/'legal');shutil.copy2(REPO/'index.html',local/'index.html');return local
 def test_preserves_auth_orders_messages_finance_and_stages_idempotently(self):
  with tempfile.TemporaryDirectory() as d:
   local=self.fixture(d);p=local/'app/app.js';p.write_text('// KEEP_LOCAL_AUTH_AND_SYNC\n'+p.read_text());out=Path(d)/'out';again=Path(d)/'again';m.stage(local,REPO,out)
   for name in ['app.js','orders.js','messages-workspace.js','finance-workspace.js']:self.assertFalse((out/'app'/name).exists())
   for p in out.rglob('*'):
    if p.is_file():target=local/p.relative_to(out);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
   m.stage(local,REPO,again)
   for p in out.rglob('*'):
    if p.is_file():self.assertEqual(p.read_bytes(),(again/p.relative_to(out)).read_bytes())
   self.assertTrue((local/'app/app.js').read_text().startswith('// KEEP_LOCAL_AUTH_AND_SYNC'))
   html=(out/'app/index.html').read_text();self.assertEqual(html.count('src="payments.js?'),1);self.assertIn('data-service-wallet',html);self.assertIn('finance-workspace.js?v=20261015-financial-report',html)
 def test_unknown_layout_or_changed_archive_leaves_no_partial_output(self):
  with tempfile.TemporaryDirectory() as d:
   local=self.fixture(d);(local/'app/index.html').write_text('<body>unknown</body>')
   with self.assertRaises(ValueError):m.stage(local,REPO,Path(d)/'out')
   self.assertFalse((Path(d)/'out').exists())
  with tempfile.TemporaryDirectory() as d:
   local=self.fixture(d);(local/'legal/archive/2026-10-15-v1/documents.json').write_text('{}')
   with self.assertRaises(ValueError):m.stage(local,REPO,Path(d)/'out')
   self.assertFalse((Path(d)/'out').exists())
 def test_real_installer_preserves_local_modules_and_backs_up(self):
  with tempfile.TemporaryDirectory() as d:
   local=self.fixture(d);backup=Path(d)/'backup';backup.mkdir();bin_dir=Path(d)/'bin';bin_dir.mkdir();original=(local/'app/app.js').read_bytes()
   for name in ['landing-pricing.js','landing-pricing.css','subscription-plans.json']:shutil.copy2(REPO/name,local/name)
   git=bin_dir/'git';git.write_text('#!/usr/bin/env python3\nimport os,sys\nfrom pathlib import Path\nr=Path(os.environ["PAYMENT_FIXTURE_SOURCE"])\nif sys.argv[1]=="fetch":pass\nelif sys.argv[1]=="rev-parse":print("a"*40)\nelif sys.argv[1]=="show":print((r/sys.argv[2].split(":",1)[1]).read_text(),end="")\nelif sys.argv[1]=="ls-tree":\n for x in ["app","legal","deploy"]:\n  for p in sorted((r/x).rglob("*")):\n   if p.is_file() and p.suffix in [".js",".mjs",".css",".html",".json",".py"]:print(p.relative_to(r))\n print("subscription-plans.json")\nelse:sys.exit(2)\n');git.chmod(0o755)
   env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'PAYMENT_FIXTURE_SOURCE':str(REPO),'ZETSLAY_SITE_DIR':str(local),'ZETSLAY_BACKUP_DIR':str(backup)}
   run=subprocess.run(['bash',str(REPO/'deploy/update-platega-ui.sh')],env=env,capture_output=True,text=True)
   self.assertEqual(run.returncode,0,run.stdout[-5000:]+run.stderr[-5000:]);self.assertEqual((local/'app/app.js').read_bytes(),original);self.assertEqual(len(list(backup.iterdir())),1);self.assertIn('2026-10-16-v1',(local/'legal/publication.json').read_text())
if __name__=='__main__':unittest.main()
