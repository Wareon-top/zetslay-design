import importlib.util,json,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-store-tools-ui.py'));mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class StageTest(unittest.TestCase):
 def test_separate_password_flow_is_preserved_by_later_automation_updates(self):
  project=Path(__file__).resolve().parents[1]
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);incoming=root/'incoming';incoming.mkdir()
   for name in ['store-tools.js','store-tools.css','store-tools.test.mjs']:(incoming/name).write_bytes((project/'app'/name).read_bytes())
   (incoming/'store-tools-app-patches.json').write_bytes((project/'deploy/store-tools-app-patches.json').read_bytes())
   mod.stage(project/'app',incoming,root/'out')
   self.assertEqual((root/'out/app.js').read_bytes(),(project/'app/app.js').read_bytes())
   self.assertIn('app.js?v=20261024-bot-password-step',(root/'out/index.html').read_text())
 def test_preserves_local_assets_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);local=root/'local';incoming=root/'incoming';first=root/'first';second=root/'second';local.mkdir();incoming.mkdir()
   (local/'index.html').write_text('<html><head></head><body><section data-lots-workspace>Custom</section><script src="app.js?v=custom" defer></script><script src="support.js?v=custom"></script></body></html>')
   (local/'app.js').write_text('custom\nold wizard\ncustom end')
   (incoming/'store-tools-app-patches.json').write_text(json.dumps([['old wizard','new password wizard']]))
   for name in ['store-tools.js','store-tools.css','store-tools.test.mjs']:(incoming/name).write_text('fixture')
   mod.stage(local,incoming,first);self.assertIn('support.js?v=custom',(first/'index.html').read_text());self.assertEqual((first/'app.js').read_text(),'custom\nnew password wizard\ncustom end');mod.stage(first,incoming,second);self.assertEqual((first/'index.html').read_text(),(second/'index.html').read_text());self.assertEqual((local/'app.js').read_text(),'custom\nold wizard\ncustom end')
 def test_unrecognized_wizard_stops_without_overwrite(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp);(p/'index.html').write_text('<head></head><body data-lots-workspace><script src="app.js?v=x"></script></body>');(p/'app.js').write_text('other');(p/'store-tools-app-patches.json').write_text(json.dumps([['old','new']]))
   with self.assertRaises(AssertionError):mod.stage(p,p,p/'out')
   self.assertFalse((p/'out').exists());self.assertEqual((p/'app.js').read_text(),'other')
if __name__=='__main__':unittest.main()
