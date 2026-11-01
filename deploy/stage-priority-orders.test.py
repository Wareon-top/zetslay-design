import unittest,tempfile,importlib.util,subprocess,os,shutil
from pathlib import Path
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-priority-orders.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StageTests(unittest.TestCase):
 def test_preserves_other_features_and_repeated_install(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=root/'local';out=root/'out';again=root/'again';local.mkdir();source=Path(__file__).parents[1]/'app'
   for n in ['index.html','plugin-page.js','plugin-rarity.js']:(local/n).write_bytes((source/n).read_bytes())
   (local/'index.html').write_text((local/'index.html').read_text().replace('</body>','<p>LOCAL_CUSTOMIZATION</p></body>'))
   m.stage(local,source,out);m.stage(out,source,again)
   for n in ['plugin-page.js','plugin-rarity.js','priority-orders.js','priority-orders.css']:self.assertEqual((out/n).read_bytes(),(again/n).read_bytes())
   html=(again/'index.html').read_text();self.assertIn('LOCAL_CUSTOMIZATION',html);self.assertEqual(html.count('priority-orders.js?'),1);self.assertEqual(html.count('priority-orders.css?'),1)
   for a in ['messages-actions.js','managed-proxy-ui.js','app.js','kosell-rent.js']:self.assertEqual((local/'index.html').read_text().count(a),html.count(a))
 def test_legacy_page_gets_only_target_hooks(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=root/'local';out=root/'out';local.mkdir();source=Path(__file__).parents[1]/'app'
   (local/'index.html').write_bytes((source/'index.html').read_bytes());(local/'plugin-page.js').write_text((source/'plugin-page.js').read_text().replace(m.HOOK,'').replace(m.CONTEXT,''));(local/'plugin-rarity.js').write_text((source/'plugin-rarity.js').read_text().replace("  'zetslay.priority-orders':'common',\n",''))
   m.stage(local,source,out);self.assertEqual((out/'plugin-page.js').read_bytes(),(source/'plugin-page.js').read_bytes());self.assertEqual((out/'plugin-rarity.js').read_bytes(),(source/'plugin-rarity.js').read_bytes())
 def test_shell_installer_checks_staged_files_and_keeps_existing_app(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);site=root/'site';app=site/'app';app.mkdir(parents=True);backup=root/'backup';backup.mkdir();bin_dir=root/'bin';bin_dir.mkdir();repo=Path(__file__).parents[1].resolve()
   for n in ['index.html','plugin-page.js','plugin-rarity.js','app.js']:(app/n).write_bytes((repo/'app'/n).read_bytes())
   (app/'plugin-page.js').write_text((app/'plugin-page.js').read_text().replace(m.HOOK,'').replace(m.CONTEXT,''))
   original=(app/'app.js').read_bytes()
   git=bin_dir/'git';git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$PRIORITY_FIXTURE_SOURCE/$file";;\n*) exit 2;;\nesac\n');git.chmod(0o755)
   env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backup),'PRIORITY_FIXTURE_SOURCE':str(repo)}
   result=subprocess.run(['bash',str(repo/'deploy/update-priority-orders-ui.sh')],env=env,text=True,capture_output=True)
   self.assertEqual(result.returncode,0,result.stdout+result.stderr);self.assertEqual((app/'app.js').read_bytes(),original);self.assertTrue((app/'priority-orders.js').is_file());self.assertIn(m.HOOK,(app/'plugin-page.js').read_text());self.assertEqual(len(list(backup.iterdir())),1)
 def test_unknown_page_stops_before_output(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=root/'local';out=root/'out';local.mkdir();source=Path(__file__).parents[1]/'app'
   for n in ['index.html','plugin-page.js','plugin-rarity.js']:(local/n).write_bytes((source/n).read_bytes())
   (local/'plugin-page.js').write_text('unrecognized')
   with self.assertRaises(ValueError):m.stage(local,source,out)
   self.assertFalse(out.exists())
if __name__=='__main__':unittest.main()
