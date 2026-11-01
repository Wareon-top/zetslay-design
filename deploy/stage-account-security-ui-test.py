import importlib.util,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-account-security-ui.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StageTest(unittest.TestCase):
 def test_preserves_custom_cabinet_and_api_and_is_idempotent(self):
  incoming=Path(__file__).resolve().parent.parent/'app'
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=root/'local';out=root/'out';local.mkdir()
   html='<html><head><meta name="zetslay-api-base-url" content="https://api.zetslay.pro"></head><body><div data-profile>CUSTOM</div><script src="profile.js" defer></script><script src="app.js?v=VPS" defer></script></body></html>'
   code='async function acceptSession(){}; async function apiRequest(){}; // VPS_CHANGES'
   (local/'index.html').write_text(html);(local/'app.js').write_text(code);(local/'profile.js').write_text('function renderProfile(){}')
   m.stage(local,incoming,out);page=(out/'index.html').read_text();self.assertIn('CUSTOM',page);self.assertIn('https://api.zetslay.pro',page);self.assertLess(page.index('src="app.js'),page.index('src="account-security.js'));self.assertEqual((local/'app.js').read_text(),code)
   (out/'app.js').write_text(code);(out/'profile.js').write_text('function renderProfile(){}');m.stage(out,incoming,out);self.assertEqual((out/'index.html').read_text(),page)
 def test_unknown_version_does_not_modify_local_files(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);(p/'index.html').write_text('UNKNOWN');(p/'app.js').write_text('UNKNOWN');(p/'profile.js').write_text('UNKNOWN')
   with self.assertRaises(ValueError):m.stage(p,p,p/'out')
   self.assertEqual((p/'index.html').read_text(),'UNKNOWN');self.assertFalse((p/'out').exists())
if __name__=='__main__':unittest.main()
