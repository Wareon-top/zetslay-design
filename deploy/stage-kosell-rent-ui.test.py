from pathlib import Path
import importlib.util
import shutil
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage',ROOT/'deploy/stage-kosell-rent-ui.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTest(unittest.TestCase):
    def test_local_changes_and_idempotence(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'deploy') as temp:
            root=Path(temp);local=root/'local';local.mkdir();out=root/'out'
            for name in ['plugin-page.js','plugin-rarity.js','index.html']:
                text=(ROOT/'app'/name).read_text()
                if name=='index.html':text=text.replace('https://api.zetslay.pro','https://local-preserved.test')
                (local/name).write_text(text)
            (local/'app.js').write_text('LOCAL ADMIN + COVERS')
            module.stage(local,ROOT/'app',out)
            self.assertIn('local-preserved.test',(out/'index.html').read_text())
            self.assertFalse((out/'app.js').exists())
            module.stage(out,ROOT/'app',root/'again')
            for name in ['index.html','plugin-page.js','plugin-rarity.js']:
                self.assertEqual((out/name).read_text(),(root/'again'/name).read_text())
    def test_older_cabinet_without_sales_pause_context(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'deploy') as temp:
            root=Path(temp);local=root/'local';local.mkdir()
            for name in ['plugin-page.js','plugin-rarity.js','index.html']:
                text=(ROOT/'app'/name).read_text()
                if name=='plugin-page.js':
                    import re
                    text=re.sub(r"plugin.id === 'zetslay.kosell-rent' \? '[^']*' : ", '', text)
                    text=re.sub(r"plugin.id === 'zetslay.sales-pause' \? '[^']*' : ", '', text)
                    text='\n'.join(line for line in text.split('\n') if 'typeof kosellRentMarkup' not in line)
                (local/name).write_text(text)
            module.stage(local,ROOT/'app',root/'out')
            self.assertIn('typeof kosellRentMarkup',(root/'out/plugin-page.js').read_text())
            self.assertIn("plugin.id === 'zetslay.mass-price-editor'",(root/'out/plugin-page.js').read_text())
    def test_unknown_layout_stops_before_any_output(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'deploy') as temp:
            root=Path(temp);local=root/'local';local.mkdir()
            for name in ['plugin-page.js','plugin-rarity.js','index.html']:
                (local/name).write_text('UNKNOWN')
            with self.assertRaises(ValueError):module.stage(local,ROOT/'app',root/'out')
            self.assertFalse((root/'out').exists())
if __name__=='__main__':unittest.main()
