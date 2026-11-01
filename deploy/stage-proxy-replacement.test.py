import importlib.util,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-proxy-replacement.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTest(unittest.TestCase):
 def test_preserve_config_sync_and_covers_and_repeat_safely(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);local=root/'local';local.mkdir()
   for name in ['app.js','index.html']:
    text=(ROOT/'app'/name).read_text().replace('https://api.zetslay.pro','https://local-config.test')
    if name=='app.js':text+='\n// LOCAL COVER CONFIG\n'
    (local/name).write_text(text)
   module.stage(local,ROOT/'app',root/'out')
   self.assertIn('https://local-config.test',(root/'out/index.html').read_text())
   self.assertIn('// LOCAL COVER CONFIG',(root/'out/app.js').read_text())
   self.assertIn('Bound the whole operation',(root/'out/app.js').read_text())
   self.assertIn('app.js?v=20261012-proxy-replacement-v2',(root/'out/index.html').read_text())
   module.stage(root/'out',ROOT/'app',root/'again')
   self.assertEqual((root/'again/app.js').read_text(),(root/'out/app.js').read_text())
 def test_unknown_functions_refuse_before_mutation(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);(root/'index.html').write_text((ROOT/'app/index.html').read_text());(root/'app.js').write_text('local unknown app')
   with self.assertRaises(ValueError):module.stage(root,ROOT/'app',root/'out')
   self.assertFalse((root/'out').exists())
if __name__=='__main__':unittest.main()
