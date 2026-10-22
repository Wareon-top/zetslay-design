from pathlib import Path
import importlib.util
import tempfile
import os
import subprocess
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('subscription-access_stage',ROOT/'deploy/stage-cabinet-polish-ui.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StageTest(unittest.TestCase):
 def test_preserves_local_cabinet_and_order(self):
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);local=base/'local';local.mkdir()
   original=(ROOT/'app/index.html').read_text().replace('https://api.zetslay.pro','https://local-preserved.test')
   (local/'index.html').write_text(original);(local/'app.js').write_text('LOCAL SECRET SETTINGS / ADMIN / COVERS')
   m.stage(local,ROOT/'app',base/'out');html=(base/'out/index.html').read_text()
   self.assertIn('local-preserved.test',html);self.assertFalse((base/'out/app.js').exists());self.assertLess(html.index('src="app.js'),html.index('src="subscription-access.js'))
   self.assertEqual(html.count('src="subscription-access.js'),1)
   self.assertLess(html.index('src="subscription-access.js'),html.index('src="payments.js'))
   self.assertEqual(html.count('src="cabinet-demo.js'),1)
   self.assertEqual(html.count('href="cabinet-demo.css'),1)
   self.assertLess(html.index('src="app.js'),html.index('src="cabinet-demo.js'))
   self.assertLess(html.index('src="cabinet-demo.js'),html.index('src="subscription-access.js'))
   self.assertTrue((base/'out/cabinet-demo.test.mjs').exists())
   self.assertLess(html.index('src="learning.js'),html.index('src="cabinet-demo.js'))
   self.assertIn('learning.css?v=20261022-cabinet-polish',html)
   self.assertIn('sidebar-trial.css?v=20261022-cabinet-polish',html)
 def test_missing_subscription_module_is_inserted_before_payment_wrapper(self):
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);local=base/'local';local.mkdir()
   import re
   html=re.sub(r'<script[^>]*src="subscription-access\.js[^\"]*"[^>]*>\s*</script>','',(ROOT/'app/index.html').read_text())
   (local/'index.html').write_text(html);m.stage(local,ROOT/'app',base/'out');result=(base/'out/index.html').read_text()
   self.assertLess(result.index('src="app.js'),result.index('src="subscription-access.js'))
   self.assertLess(result.index('src="subscription-access.js'),result.index('src="payments.js'))
 def test_repeated_update_keeps_one_asset_link(self):
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);m.stage(ROOT/'app',ROOT/'app',base/'once');m.stage(base/'once',ROOT/'app',base/'twice')
   a=(base/'once/index.html').read_text();b=(base/'twice/index.html').read_text()
   self.assertEqual(a.count('src="subscription-access.js'),1);self.assertEqual(b.count('src="subscription-access.js'),1)
   self.assertEqual(a.split('href="subscription-access.css')[0].strip(),b.split('href="subscription-access.css')[0].strip())
 def test_unknown_layout_is_rejected_before_any_output(self):
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);local=base/'local';local.mkdir();(local/'index.html').write_text('<html><head></head><body>Unknown</body></html>')
   with self.assertRaises(ValueError):m.stage(local,ROOT/'app',base/'out')
   self.assertFalse((base/'out').exists())
 def test_old_cabinet_gets_demo_before_access_and_repeated_update_has_one_copy(self):
  import re
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);local=base/'local';local.mkdir()
   html=re.sub(r'<script[^>]*src="cabinet-demo\.js[^\"]*"[^>]*>\s*</script>','',(ROOT/'app/index.html').read_text())
   html=re.sub(r'<link[^>]*href="cabinet-demo\.css[^\"]*"[^>]*>','',html)
   (local/'index.html').write_text(html)
   m.stage(local,ROOT/'app',base/'one');m.stage(base/'one',ROOT/'app',base/'two')
   result=(base/'two/index.html').read_text()
   self.assertEqual(result.count('src="cabinet-demo.js'),1);self.assertEqual(result.count('href="cabinet-demo.css'),1)
   self.assertLess(result.index('src="cabinet-demo.js'),result.index('src="subscription-access.js'))
 def test_installer_checks_complete_staged_bundle_and_preserves_local_app(self):
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);site=base/'site';(site/'app').mkdir(parents=True);backups=base/'backups';backups.mkdir();bin_dir=base/'bin';bin_dir.mkdir()
   (site/'app/index.html').write_text((ROOT/'app/index.html').read_text().replace('https://api.zetslay.pro','https://local-preserved.test'))
   (site/'app/app.js').write_text('KEEP LOCAL CONFIGURATION')
   git=bin_dir/'git';git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$DEMO_FIXTURE_SOURCE/$file";;\n*) exit 2;;\nesac\n');git.chmod(0o755)
   env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backups),'DEMO_FIXTURE_SOURCE':str(ROOT)}
   result=subprocess.run(['bash',str(ROOT/'deploy/update-cabinet-polish-ui.sh')],env=env,capture_output=True,text=True)
   self.assertEqual(result.returncode,0,result.stdout+result.stderr);self.assertEqual((site/'app/app.js').read_text(),'KEEP LOCAL CONFIGURATION')
   self.assertIn('local-preserved.test',(site/'app/index.html').read_text());self.assertTrue((site/'app/cabinet-demo.js').exists());self.assertEqual(len(list(backups.iterdir())),1)
 def test_duplicate_asset_rejected_before_output(self):
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);local=base/'local';local.mkdir()
   html=(ROOT/'app/index.html').read_text().replace('</body>','<script src="learning.js"></script></body>')
   (local/'index.html').write_text(html)
   with self.assertRaises(ValueError):m.stage(local,ROOT/'app',base/'out')
   self.assertFalse((base/'out').exists())
 def test_missing_incoming_file_leaves_no_output(self):
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);incoming=base/'incoming';incoming.mkdir()
   with self.assertRaises(OSError):m.stage(ROOT/'app',incoming,base/'out')
   self.assertFalse((base/'out').exists())
if __name__=='__main__':unittest.main()

