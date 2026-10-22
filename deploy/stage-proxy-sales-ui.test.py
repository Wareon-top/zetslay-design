from pathlib import Path
import importlib.util, tempfile, unittest, os, subprocess
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage_proxy_sales',ROOT/'deploy/stage-proxy-sales-ui.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StageTest(unittest.TestCase):
 def test_preserves_local_configuration_and_checkout_behaviour(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);local=root/'local';local.mkdir()
   (local/'index.html').write_text((ROOT/'app/index.html').read_text().replace('https://api.zetslay.pro','https://local-preserved.invalid'))
   (local/'payments.js').write_text((ROOT/'app/payments.js').read_text()+'\n// PRESERVE LOCAL CHECKOUT\n')
   (local/'app.js').write_text('LOCAL APP CONFIG')
   m.stage(local,ROOT/'app',root/'out');html=(root/'out/index.html').read_text()
   self.assertIn('local-preserved.invalid',html);self.assertFalse((root/'out/app.js').exists());self.assertEqual((local/'app.js').read_text(),'LOCAL APP CONFIG')
   self.assertIn('PRESERVE LOCAL CHECKOUT',(root/'out/payments.js').read_text());self.assertIn('proxy_purchase:',(root/'out/payments.js').read_text())
   self.assertLess(html.index('src="managed-proxy-ui.js'),html.index('src="proxy-shop.js'));self.assertLess(html.index('src="payments.js'),html.index('src="proxy-shop.js'))
   m.stage(root/'out',ROOT/'app',root/'twice');self.assertEqual((root/'out/index.html').read_text(),(root/'twice/index.html').read_text())
 def test_rejects_unknown_layout_and_duplicate_scripts_before_output(self):
  for original in ['<head></head><body></body>',(ROOT/'app/index.html').read_text().replace('</body>','<script src="proxy-shop.js"></script></body>')]:
   with tempfile.TemporaryDirectory() as temp:
    root=Path(temp);(root/'index.html').write_text(original);(root/'payments.js').write_text('unknown')
    with self.assertRaises(ValueError):m.stage(root,ROOT/'app',root/'out')
    self.assertFalse((root/'out').exists())
 def test_old_wallet_history_gets_labels_without_other_changes(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);(root/'index.html').write_text((ROOT/'app/index.html').read_text());(root/'payments.js').write_text("KEEP START\nconst labels={chargeback:'Возврат / спор'};\nKEEP END")
   m.stage(root,ROOT/'app',root/'out');s=(root/'out/payments.js').read_text();self.assertTrue(s.startswith('KEEP START'));self.assertTrue(s.endswith('KEEP END'));self.assertIn("proxy_refund:'Возврат за прокси'",s)
 def test_installer_checks_complete_bundle_and_keeps_local_app(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);site=root/'site';(site/'app').mkdir(parents=True);backups=root/'backups';backups.mkdir();bin_dir=root/'bin';bin_dir.mkdir()
   for file in ['index.html','payments.js']:(site/'app'/file).write_text((ROOT/'app'/file).read_text())
   (site/'app/app.js').write_text('LOCAL APP CONFIG')
   git=bin_dir/'git';git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$PROXY_TEST_SOURCE/$file";;\n*) exit 2;;\nesac\n');git.chmod(0o755)
   env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backups),'PROXY_TEST_SOURCE':str(ROOT)}
   r=subprocess.run(['bash',str(ROOT/'deploy/update-proxy-sales-ui.sh')],env=env,capture_output=True,text=True)
   self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertEqual((site/'app/app.js').read_text(),'LOCAL APP CONFIG');self.assertTrue((site/'app/proxy-shop.js').exists());self.assertEqual(len(list(backups.iterdir())),1)
if __name__=='__main__':unittest.main()
