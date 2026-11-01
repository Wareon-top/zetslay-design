import importlib.util,unittest,tempfile,os,subprocess
from pathlib import Path
S=Path(__file__).with_name('stage-service-access-policy.py');spec=importlib.util.spec_from_file_location('stage',S);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);REPO=Path(__file__).parents[1].resolve()
class StageTests(unittest.TestCase):
 def local(self,root):
  local=root/'local';(local/'app').mkdir(parents=True)
  for path in ['index.html','app/index.html','app/app.js','app/billing-section.html']:(local/path).write_bytes((REPO/path).read_bytes())
  (local/'index.html').write_text((local/'index.html').read_text().replace('</body>','<p>KEEP_LOCAL_CUSTOMIZATION</p></body>'))
  return local
 def test_preserves_local_layouts_and_repeated_staging(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=self.local(root);out=root/'out';second=root/'second';m.stage(local,REPO,out);m.stage(out,REPO,second)
   self.assertIn('KEEP_LOCAL_CUSTOMIZATION',(out/'index.html').read_text());self.assertEqual((out/'app/app.js').read_bytes(),(local/'app/app.js').read_bytes());self.assertEqual((out/'app/app.js').read_bytes(),(second/'app/app.js').read_bytes());self.assertEqual((out/'app/index.html').read_bytes(),(second/'app/index.html').read_bytes());self.assertTrue((out/'legal/archive/2026-10-12-v1/publication.json').is_file())
 def test_patches_only_two_legacy_app_locations(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=self.local(root);text=(local/'app/app.js').read_text()
   for old,new in m.APP_EDITS:text=text.replace(new,old)
   text+='\n// KEEP_LOCAL_APP_CHANGE\n';(local/'app/app.js').write_text(text);m.stage(local,REPO,root/'out');result=(root/'out/app/app.js').read_text()
   self.assertIn('KEEP_LOCAL_APP_CHANGE',result);self.assertIn('data-connection-subscription-note',result)
 def test_unknown_app_is_rejected_without_output(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=self.local(root);(local/'app/app.js').write_text('unknown local implementation')
   with self.assertRaises(ValueError):m.stage(local,REPO,root/'out')
   self.assertFalse((root/'out').exists())
 def test_installer_checks_actual_staged_pages_and_archived_legal_receipt(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=self.local(root);backup=root/'backup';backup.mkdir();bin_dir=root/'bin';bin_dir.mkdir();(local/'assets/fonts').mkdir(parents=True);(local/'assets/fonts/fonts.css').write_bytes((REPO/'assets/fonts/fonts.css').read_bytes())
   git=bin_dir/'git';git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$ACCESS_FIXTURE_SOURCE/$file";;\nls-tree) exec find "$ACCESS_FIXTURE_SOURCE/legal" -type f -printf "legal/%P\\n";;\n*) exit 2;;\nesac\n');git.chmod(0o755)
   env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'ZETSLAY_SITE_DIR':str(local),'ZETSLAY_BACKUP_DIR':str(backup),'ACCESS_FIXTURE_SOURCE':str(REPO)}
   result=subprocess.run(['bash',str(REPO/'deploy/update-service-access-policy-ui.sh')],env=env,capture_output=True,text=True)
   self.assertEqual(result.returncode,0,result.stdout+result.stderr);self.assertIn('KEEP_LOCAL_CUSTOMIZATION',(local/'index.html').read_text());self.assertTrue((local/'legal/archive/2026-10-12-v1/publication.json').is_file());self.assertEqual(len(list(backup.iterdir())),1)
if __name__=='__main__':unittest.main()
