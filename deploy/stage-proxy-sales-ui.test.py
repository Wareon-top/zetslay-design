from pathlib import Path
import importlib.util, tempfile, unittest, os, subprocess, shutil, re
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage_proxy_sales',ROOT/'deploy/stage-proxy-sales-ui.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StageTest(unittest.TestCase):
 def test_preserves_local_configuration_and_checkout_behaviour(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);local=root/'local';local.mkdir()
   (local/'index.html').write_text((ROOT/'app/index.html').read_text().replace('https://api.zetslay.pro','https://local-preserved.invalid'))
   (local/'payments.js').write_text((ROOT/'app/payments.js').read_text()+'\n// PRESERVE LOCAL CHECKOUT\n')
   (local/'app.js').write_text((ROOT/'app/app.js').read_text()+ '\n// LOCAL APP CONFIG\n')
   m.stage(local,ROOT/'app',root/'out');html=(root/'out/index.html').read_text()
   self.assertIn('local-preserved.invalid',html);self.assertTrue((root/'out/app.js').read_text().endswith('// LOCAL APP CONFIG\n'));self.assertEqual((local/'app.js').read_text(),(ROOT/'app/app.js').read_text()+'\n// LOCAL APP CONFIG\n')
   self.assertIn('PRESERVE LOCAL CHECKOUT',(root/'out/payments.js').read_text());self.assertIn('proxy_purchase:',(root/'out/payments.js').read_text())
   self.assertEqual((root/'out/assets/proxy-offer.jpg').read_bytes(),(ROOT/'app/assets/proxy-offer.jpg').read_bytes())
   self.assertLess(html.index('src="managed-proxy-ui.js'),html.index('src="proxy-shop.js'));self.assertLess(html.index('src="payments.js'),html.index('src="proxy-shop.js'))
   m.stage(root/'out',ROOT/'app',root/'twice');self.assertEqual((root/'out/index.html').read_text(),(root/'twice/index.html').read_text())
 def test_rejects_unknown_layout_and_duplicate_scripts_before_output(self):
  for original in ['<head></head><body></body>',(ROOT/'app/index.html').read_text().replace('</body>','<script src="proxy-shop.js"></script></body>')]:
   with tempfile.TemporaryDirectory() as temp:
    root=Path(temp);(root/'index.html').write_text(original);(root/'payments.js').write_text('unknown');(root/'app.js').write_text((ROOT/'app/app.js').read_text())
    with self.assertRaises(ValueError):m.stage(root,ROOT/'app',root/'out')
    self.assertFalse((root/'out').exists())
 def test_old_wallet_history_gets_labels_without_other_changes(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);(root/'index.html').write_text((ROOT/'app/index.html').read_text());(root/'app.js').write_text((ROOT/'app/app.js').read_text());(root/'payments.js').write_text("KEEP START\nconst labels={chargeback:'Возврат / спор'};\nKEEP END")
   m.stage(root,ROOT/'app',root/'out');s=(root/'out/payments.js').read_text();self.assertTrue(s.startswith('KEEP START'));self.assertTrue(s.endswith('KEEP END'));self.assertIn("proxy_refund:'Возврат за прокси'",s)
 def test_installer_checks_complete_bundle_and_keeps_local_app(self, container=False):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);site=root/'site';(site/'app').mkdir(parents=True);backups=root/'backups';backups.mkdir();bin_dir=root/'bin';bin_dir.mkdir()
   for file in ['index.html','payments.js']:(site/'app'/file).write_text((ROOT/'app'/file).read_text())
   (site/'app/app.js').write_text((ROOT/'app/app.js').read_text()+ '\n// LOCAL APP CONFIG\n')
   git=bin_dir/'git';git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$PROXY_TEST_SOURCE/$file";;\n*) exit 2;;\nesac\n');git.chmod(0o755)
   env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backups),'PROXY_TEST_SOURCE':str(ROOT)}
   if container:
    node=shutil.which('node')
    for name in ['mkdir','mktemp','rm','rmdir','python3','cat','cmp','chmod','tar','gzip','cp','timeout']:(bin_dir/name).symlink_to(shutil.which(name))
    docker=bin_dir/'docker';docker.write_text('#!/bin/sh\nprintf "%s\\n" "$1" >> "$PROXY_DOCKER_LOG"\ncase "$1" in\nps) echo fixture-api;;\nexec) [ "$2" = -i ] && [ "$3" = fixture-api ] && [ "$4" = node ] || exit 2; shift 4; exec '+node+' "$@";;\n*) exit 2;;\nesac\n');docker.chmod(0o755)
    env.update(PATH=str(bin_dir),PROXY_DOCKER_LOG=str(root/'docker.log'))
   r=subprocess.run(['/bin/bash',str(ROOT/'deploy/update-proxy-sales-ui.sh')],env=env,capture_output=True,text=True)
   if container:self.assertEqual((root/'docker.log').read_text().splitlines(),['ps','exec'])
   self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertTrue((site/'app/app.js').read_text().endswith('// LOCAL APP CONFIG\n'));self.assertTrue((site/'app/proxy-shop.js').exists());self.assertEqual(len(list(backups.iterdir())),1)
 def test_installer_validates_in_running_api_without_container_mutation(self):
  self.test_installer_checks_complete_bundle_and_keeps_local_app(container=True)
 def test_old_cabinet_gets_one_route_and_preserves_local_app(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);html=(ROOT/'app/index.html').read_text()
   import re
   html=re.sub(r'<button[^>]*data-view-target="proxy-shop".*?</button>', '',html,flags=re.S)
   html=re.sub(r'<section[^>]*data-view="proxy-shop".*?</section>', '',html,flags=re.S)
   app=(ROOT/'app/app.js').read_text().replace("'proxy-shop': 'Прокси', ", '')+'\n// LOCAL API OVERRIDE\n'
   (root/'index.html').write_text(html);(root/'app.js').write_text(app);(root/'payments.js').write_text((ROOT/'app/payments.js').read_text())
   m.stage(root,ROOT/'app',root/'out')
   updated=(root/'out/index.html').read_text();patched=(root/'out/app.js').read_text()
   self.assertNotIn('data-view-target="proxy-shop"',updated);self.assertNotIn('data-proxy-store',updated);self.assertEqual(updated.count('data-proxy-invite="dashboard"'),1);self.assertEqual(updated.count('data-proxy-invite="guide"'),1)
   self.assertIn("'proxy-shop': 'Прокси',",patched);self.assertEqual(patched.replace("\n  'proxy-shop': 'Прокси',",''),app)
   m.stage(root/'out',ROOT/'app',root/'twice');self.assertEqual(patched,(root/'twice/app.js').read_text())
 def test_previous_sidebar_destination_is_replaced_with_context_invitations(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);html=(ROOT/'app/index.html').read_text()
   html=re.sub(r'<section[^>]*data-proxy-invite="(?:dashboard|guide)".*?</section>','',html,flags=re.S)
   html=html.replace('<section class="view" data-view="profile"','<section class="view proxy-store-page" data-view="proxy-shop" data-proxy-store hidden></section><section class="view" data-view="profile"')
   html=html.replace('data-view-target="plugins"','data-view-target="proxy-shop"',1)
   (root/'index.html').write_text(html);(root/'app.js').write_text((ROOT/'app/app.js').read_text());(root/'payments.js').write_text((ROOT/'app/payments.js').read_text())
   m.stage(root,ROOT/'app',root/'out');updated=(root/'out/index.html').read_text()
   self.assertNotIn('data-view-target="proxy-shop"',updated);self.assertNotIn('data-proxy-store',updated)
   self.assertEqual(updated.count('data-proxy-invite="dashboard"'),1);self.assertEqual(updated.count('data-proxy-invite="guide"'),1)
   m.stage(root/'out',ROOT/'app',root/'twice');self.assertEqual(updated,(root/'twice/index.html').read_text())
 def test_existing_invites_are_upgraded_without_changing_trial_or_exit(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);html=(ROOT/'app/index.html').read_text()
   html=re.sub(r'<section[^>]*data-proxy-invite="dashboard".*?</section>','<section class="ps-invite" data-proxy-invite="dashboard"><h2>OLD PROXY OFFER</h2><button data-proxy-open>Купить прокси</button></section>',html,flags=re.S)
   for name,value in [('index.html',html),('app.js',(ROOT/'app/app.js').read_text()),('payments.js',(ROOT/'app/payments.js').read_text())]:(root/name).write_text(value)
   trial=re.search(r'<aside[^>]*data-sidebar-trial.*?</aside>',html,re.S)[0]
   m.stage(root,ROOT/'app',root/'out');updated=(root/'out/index.html').read_text()
   self.assertNotIn('OLD PROXY OFFER',updated);self.assertEqual(updated.count('class="ps-invite-visual"'),2)
   self.assertIn(trial,updated);self.assertIn('sidebar-trial.css?v=20261023-trial-restored',updated);self.assertEqual(updated.count('data-account-signout'),1)
if __name__=='__main__':unittest.main()
