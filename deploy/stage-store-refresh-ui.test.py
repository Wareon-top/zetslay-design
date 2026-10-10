import importlib.util
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-store-refresh-ui.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTest(unittest.TestCase):
    def test_preserves_custom_markup_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);local=root/'local';incoming=root/'incoming';out=root/'out'
            local.mkdir();incoming.mkdir()
            html='<head><script src="app.js?v=custom" defer></script></head><main>Мой кабинет</main>'
            (local/'index.html').write_text(html);(incoming/'store-refresh.js').write_text('custom module')
            module.stage(local,incoming,out)
            first=(out/'index.html').read_text()
            self.assertIn('Мой кабинет',first);self.assertIn('app.js?v=custom',first)
            self.assertEqual(first.count('store-refresh.js'),1)
            module.stage(out,incoming,root/'again')
            self.assertEqual((root/'again'/'index.html').read_text(),first)
    def test_unknown_entrypoint_fails_without_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'index.html').write_text('<script src="app.js"></script>')
            with self.assertRaises(ValueError):module.stage(root,root,root/'out')
            self.assertFalse((root/'out').exists())
if __name__=='__main__':unittest.main()
