import importlib.util,unittest,tempfile,shutil,subprocess,os,re
from pathlib import Path
REPO=Path(__file__).parents[1].resolve()
spec=importlib.util.spec_from_file_location('stage',REPO/'deploy/stage-financial-report.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class FinancialStageTests(unittest.TestCase):
 def fixture(self,root):
  local=root/'local';local.mkdir();incoming=root/'incoming';incoming.mkdir()
  for name in ['index.html','app.js','billing-section.html','learning.js','knowledge-base.js','plugin-purchase-options.js','profile.js','subscription-access.js']:(local/name).write_bytes((REPO/'app'/name).read_bytes())
  for name in [*m.ASSETS,'subscription-access.js']:(incoming/name).write_bytes((REPO/'app'/name).read_bytes())
  shutil.copy2(REPO/'deploy/stage-subscription-navigation.py',incoming/'stage-subscription-navigation.py')
  (local/'app.js').write_text('// PRESERVE_LOCAL_SYNC_FIX\n'+(local/'app.js').read_text())
  return local,incoming
 def test_preserves_local_modules_and_stages_idempotently(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local,incoming=self.fixture(root);out=root/'out';again=root/'again';m.stage(local,incoming,out);m.stage(out,incoming,again)
   for name in ['app.js','index.html','subscription-access.js']:self.assertEqual((out/name).read_bytes(),(again/name).read_bytes())
   self.assertEqual((local/'app.js').read_bytes(),(out/'app.js').read_bytes());html=(out/'index.html').read_text();self.assertEqual(html.count('data-finance-workspace'),1);self.assertIn('orders.js?v=20261015-orders-periods',html);self.assertIn("'finance']",(out/'subscription-access.js').read_text())
 def test_unknown_layout_rejected_before_writing(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local,incoming=self.fixture(root);(local/'index.html').write_text('<body>Unknown</body>')
   with self.assertRaises(ValueError):m.stage(local,incoming,root/'out')
   self.assertFalse((root/'out').exists())
 def test_actual_installer_preserves_unrelated_orders_and_auth_with_backup(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);site=root/'site';(site/'app').mkdir(parents=True);backup=root/'backup';backup.mkdir();bin_dir=root/'bin';bin_dir.mkdir()
   for p in (REPO/'app').glob('*'):
    if p.is_file() and p.suffix in ['.js','.css','.html']:shutil.copy2(p,site/'app'/p.name)
   for name in ['index.html','landing-pricing.js','landing-pricing.css','subscription-plans.json']:shutil.copy2(REPO/name,site/name)
   original=(site/'app/orders.js').read_bytes();git=bin_dir/'git';git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$FINANCE_FIXTURE_SOURCE/$file";;\n*) exit 2;;\nesac\n');git.chmod(0o755)
   env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'FINANCE_FIXTURE_SOURCE':str(REPO),'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backup)}
   r=subprocess.run(['bash',str(REPO/'deploy/update-financial-report-ui.sh')],env=env,capture_output=True,text=True)
   self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertEqual((site/'app/orders.js').read_bytes(),original);self.assertEqual(len(list(backup.iterdir())),1);self.assertTrue((site/'app/finance-model.js').is_file())
if __name__=='__main__':unittest.main()
