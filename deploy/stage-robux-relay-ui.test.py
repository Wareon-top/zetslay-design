from pathlib import Path
import importlib.util
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-robux-relay-ui.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class StageTest(unittest.TestCase):
    def fixture(self,root):
        local=root/'live';incoming=root/'incoming';local.mkdir();incoming.mkdir()
        (local/'index.html').write_text('<head><!-- custom --></head><script src="plugin-rarity.js?v=old" defer></script><script src="plugin-page.js?v=old" defer></script><script src="app.js?v=custom" defer></script>')
        (local/'plugin-page.js').write_text("// local customization\n      ${plugin.id === 'zetslay.kosell-rent' && typeof kosellRentMarkup === 'function' ? kosellRentMarkup(plugin) : ''}\n")
        (local/'plugin-rarity.js').write_text("const map={\n  'zetslay.tiktok-lzt-market':'ultra',\n}; // custom")
        (local/'app.js').write_text('function resetAccountData() { /* local custom */ }')
        for name in ('robux-relay.js','robux-relay.css'):
            (incoming/name).write_text('new '+name)
        return local,incoming
    def test_keeps_customization_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);local,incoming=self.fixture(root);out=root/'staged'
            module.stage(local,incoming,out)
            self.assertIn('// local customization',(out/'plugin-page.js').read_text())
            html=(out/'index.html').read_text();self.assertIn('app.js?v='+module.VERSION,html);self.assertIn('<!-- custom -->',html)
            self.assertLess(html.index('robux-relay.js'),html.index('app.js'))
            self.assertIn('/* local custom */',(out/'app.js').read_text());self.assertEqual((out/'app.js').read_text().count('resetRobuxUi();'),1)
            repeat=root/'repeat';module.stage(out,incoming,repeat)
            for file in out.iterdir():self.assertEqual(file.read_bytes(),(repeat/file.name).read_bytes())
    def test_unknown_markup_and_conflicts_abort_before_creating_staged_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);local,incoming=self.fixture(root);out=root/'staged'
            (local/'plugin-page.js').write_text('unknown plugin renderer')
            with self.assertRaises(ValueError):module.stage(local,incoming,out)
            self.assertFalse(out.exists())

if __name__=='__main__':unittest.main()
