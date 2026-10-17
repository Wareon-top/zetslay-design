from pathlib import Path
import importlib.util
import tempfile
import re
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage_pause',ROOT/'deploy/stage-sales-pause-ui.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTests(unittest.TestCase):
    def test_preserves_covers_profile_inventory_api_local_edits_and_repeat_install(self):
        with tempfile.TemporaryDirectory() as folder:
            local=Path(folder)/'local';out=Path(folder)/'out';second=Path(folder)/'second';local.mkdir()
            page=(ROOT/'app/plugin-page.js').read_text()+'\n// VPS_ADMIN_OVERRIDE\n'
            html=(ROOT/'app/index.html').read_text().replace('https://api.zetslay.pro','https://api.local.test')
            (local/'plugin-page.js').write_text(page);(local/'index.html').write_text(html);(local/'plugin-rarity.js').write_bytes((ROOT/'app/plugin-rarity.js').read_bytes())
            module.stage(local,ROOT/'app',out);module.stage(out,ROOT/'app',second)
            for name in ['index.html','plugin-page.js','plugin-rarity.js','sales-pause.js','sales-pause.css']:
                self.assertEqual((out/name).read_bytes(),(second/name).read_bytes(),name)
            new=(out/'plugin-page.js').read_text()
            pattern=r'function pluginCoverSource\(plugin\) \{.*?\n\}'
            self.assertEqual(re.search(pattern,page,re.S).group(),re.search(pattern,new,re.S).group())
            self.assertIn('VPS_ADMIN_OVERRIDE',new)
            result=(out/'index.html').read_text()
            for marker in ['api.local.test','data-view="lots"','data-view="profile"','src="lots.js','src="profile.js']:
                self.assertIn(marker,result)
            self.assertEqual(result.count('src="sales-pause.js'),1)
            self.assertEqual((local/'index.html').read_text(),html)
    def test_unknown_page_stops_without_output(self):
        with tempfile.TemporaryDirectory() as folder:
            local=Path(folder)/'local';out=Path(folder)/'out';local.mkdir()
            for name in ['plugin-page.js','plugin-rarity.js','index.html']:(local/name).write_bytes((ROOT/'app'/name).read_bytes())
            p=local/'plugin-page.js';p.write_text(p.read_text().replace('plugin-page-sidebar','custom-sidebar'))
            with self.assertRaises(ValueError):module.stage(local,ROOT/'app',out)
            self.assertFalse(out.exists())
if __name__=='__main__':unittest.main()
