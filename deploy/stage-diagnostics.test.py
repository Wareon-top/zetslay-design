import importlib.util,json,subprocess,tempfile,unittest
from pathlib import Path
HERE=Path(__file__).parent;ROOT=HERE.parent
spec=importlib.util.spec_from_file_location('stage',HERE/'stage-diagnostics.py');stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)
class StageTests(unittest.TestCase):
 def fixture(self,site):
  for name in ['app/index.html','demo/index.html','demo/demo.js','app/workspace-upgrade.js']:
   path=site/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(subprocess.check_output(['git','show','c5e383ee321fe3627c2490cb21e9d988ca97e34e:'+name],cwd=ROOT))
  p=site/'app/index.html';p.write_text(p.read_text(encoding='utf8').replace('</body>','<script src="independent-runtime.js" defer></script></body>'),encoding='utf8')
 def test_preserves_runtime_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as temp:
   site=Path(temp)/'site';out=Path(temp)/'out';self.fixture(site);result=stage.stage(site,ROOT,out)
   self.assertIn(b'independent-runtime.js',result['app/index.html']);self.assertNotIn('app/app.js',result);self.assertIn(b'ZetSlayDiagnostics',result['app/workspace-upgrade.js'])
   for name,data in result.items():p=site/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
   self.assertEqual(result,stage.stage(site,ROOT,out))
 def test_unknown_assets_and_missing_predecessor_stop_before_writes(self):
  with tempfile.TemporaryDirectory() as temp:
   site=Path(temp)/'site';out=Path(temp)/'out';self.fixture(site);(site/'demo/demo.js').write_text('// independent')
   with self.assertRaisesRegex(ValueError,'Независимые'):stage.stage(site,ROOT,out)
   self.assertFalse(out.exists());self.fixture(site);(site/'demo/index.html').unlink()
   with self.assertRaisesRegex(ValueError,'первый пакет'):stage.stage(site,ROOT,out)
   self.assertFalse(out.exists())
if __name__=='__main__':unittest.main()
