from pathlib import Path
import importlib.util
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('subscription-access_stage',ROOT/'deploy/stage-subscription-access-ui.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StageTest(unittest.TestCase):
 def test_preserves_local_cabinet_and_order(self):
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);local=base/'local';local.mkdir()
   original=(ROOT/'app/index.html').read_text().replace('https://api.zetslay.pro','https://local-preserved.test')
   (local/'index.html').write_text(original);(local/'app.js').write_text('LOCAL SECRET SETTINGS / ADMIN / COVERS')
   m.stage(local,ROOT/'app',base/'out');html=(base/'out/index.html').read_text()
   self.assertIn('local-preserved.test',html);self.assertFalse((base/'out/app.js').exists());self.assertLess(html.index('src="app.js'),html.index('src="subscription-access.js'))
   self.assertEqual(html.count('src="subscription-access.js'),1)
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
if __name__=='__main__':unittest.main()
