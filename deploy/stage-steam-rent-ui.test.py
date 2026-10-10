from pathlib import Path
import importlib.util
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('steam_stage',ROOT/'deploy/stage-steam-rent-ui.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTest(unittest.TestCase):
 def test_local_files_and_idempotence(self):
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);local=base/'local';local.mkdir()
   for name in ['index.html','plugin-page.js','plugin-rarity.js']:
    text=(ROOT/'app'/name).read_text()
    text=text.replace('https://api.zetslay.pro','https://local-preserved.test')
    (local/name).write_text(text)
   (local/'app.js').write_text('LOCAL STORE / ADMIN / COVERS')
   module.stage(local,ROOT/'app',base/'out');module.stage(base/'out',ROOT/'app',base/'again')
   for name in ['index.html','plugin-page.js','plugin-rarity.js']:
    self.assertEqual((base/'out'/name).read_text(),(base/'again'/name).read_text())
   self.assertIn('local-preserved.test',(base/'out/index.html').read_text());self.assertFalse((base/'out/app.js').exists())
 def test_adds_missing_hook_to_old_layout(self):
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);local=base/'local';local.mkdir()
   for name in ['index.html','plugin-page.js','plugin-rarity.js']:
    text=(ROOT/'app'/name).read_text()
    import re
    if name=='plugin-page.js':
     text=re.sub(r"^.*typeof steamRentMarkup.*\n",'',text,flags=re.M)
     text=re.sub(r"plugin.id === 'zetslay.steam-rent' \? '[^']*' : ",'',text)
    if name=='plugin-rarity.js':text=re.sub(r"^.*'zetslay.steam-rent'.*\n",'',text,flags=re.M)
    (local/name).write_text(text)
   module.stage(local,ROOT/'app',base/'out');self.assertIn('steamRentMarkup',(base/'out/plugin-page.js').read_text());self.assertIn("'zetslay.steam-rent':'legendary'",(base/'out/plugin-rarity.js').read_text())
 def test_unknown_layout_writes_nothing(self):
  with tempfile.TemporaryDirectory() as temp:
   base=Path(temp);local=base/'local';local.mkdir()
   for name in ['index.html','plugin-page.js','plugin-rarity.js']:(local/name).write_text('UNKNOWN')
   with self.assertRaises(ValueError):module.stage(local,ROOT/'app',base/'out')
   self.assertFalse((base/'out').exists())
if __name__=='__main__':unittest.main()
