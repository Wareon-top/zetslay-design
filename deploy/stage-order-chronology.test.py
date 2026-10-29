import importlib.util,unittest,tempfile,os,subprocess
from pathlib import Path
REPO=Path(__file__).parents[1].resolve()
spec=importlib.util.spec_from_file_location('stage',REPO/'deploy/stage-order-chronology.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class OrderChronologyStageTests(unittest.TestCase):
 def local(self,root):
  local=root/'local';local.mkdir()
  for name in ['index.html','app.js','overview.js','orders.js','orders.css','orders.test.mjs']:(local/name).write_bytes((REPO/'app'/name).read_bytes())
  (local/'app.js').write_text((local/'app.js').read_text()+'\n// KEEP_AUTH_AND_SHARED_READS\n')
  (local/'index.html').write_text((local/'index.html').read_text().replace('</body>','<p>KEEP_OTHER_SECTIONS</p></body>'))
  return local
 def test_preserves_installed_app_overview_other_sections_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=self.local(root);out=root/'out';second=root/'second'
   m.stage(local,REPO/'app',out);m.stage(out,REPO/'app',second)
   self.assertEqual((out/'app.js').read_bytes(),(local/'app.js').read_bytes());self.assertEqual((out/'overview.js').read_bytes(),(local/'overview.js').read_bytes())
   self.assertIn('KEEP_OTHER_SECTIONS',(out/'index.html').read_text());self.assertEqual((out/'index.html').read_bytes(),(second/'index.html').read_bytes())
   self.assertIn('data-orders-period="today"',(out/'index.html').read_text())
 def test_rejects_unknown_app_or_html_before_writing(self):
  for file,text in [('app.js','unknown app'),('index.html','<section>unknown</section>')]:
   with tempfile.TemporaryDirectory() as d:
    root=Path(d);local=self.local(root);(local/file).write_text(text)
    with self.assertRaises(ValueError):m.stage(local,REPO/'app',root/'out')
    self.assertFalse((root/'out').exists())
 def test_installer_verifies_actual_installed_app_and_keeps_unrelated_files(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);site=root/'site';site.mkdir();local=self.local(root);local.rename(site/'app');backup=root/'backup';backup.mkdir();bin_dir=root/'bin';bin_dir.mkdir()
   git=bin_dir/'git';git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$ORDERS_FIXTURE_SOURCE/$file";;\n*) exit 2;;\nesac\n');git.chmod(0o755)
   original=(site/'app/app.js').read_bytes()
   env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backup),'ORDERS_FIXTURE_SOURCE':str(REPO)}
   result=subprocess.run(['bash',str(REPO/'deploy/update-order-chronology-ui.sh')],env=env,capture_output=True,text=True)
   self.assertEqual(result.returncode,0,result.stdout+result.stderr);self.assertEqual((site/'app/app.js').read_bytes(),original);self.assertIn('KEEP_OTHER_SECTIONS',(site/'app/index.html').read_text());self.assertEqual(len(list(backup.iterdir())),1)
if __name__=='__main__':unittest.main()
