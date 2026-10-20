from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('stage', Path(__file__).with_name('stage-lot-raise-ui.py'))
module = module_from_spec(spec)
spec.loader.exec_module(module)
class StageTests(unittest.TestCase):
    def test_preserves_local_sections_and_is_repeatable(self):
        with TemporaryDirectory() as d:
            root = Path(d)
            local, incoming, out, again = [root / p for p in ['local', 'incoming', 'out', 'again']]
            local.mkdir(); incoming.mkdir()
            html = '<head></head><section data-lots-workspace>LOCAL</section><script src="lots.js?v=old" defer></script><script src="lot-management.js?v=old" defer></script><script src="keep.js"></script>'
            (local / 'index.html').write_text(html)
            for f in ['lot-raise.js', 'lot-raise.css', 'lot-raise.test.mjs']: (incoming / f).write_text(f)
            module.stage(local, incoming, out); module.stage(out, incoming, again)
            self.assertEqual((out / 'index.html').read_text(), (again / 'index.html').read_text())
            self.assertIn('LOCAL', (out / 'index.html').read_text())
            self.assertIn('keep.js', (out / 'index.html').read_text())
    def test_rejects_unconfirmed_layout(self):
        with TemporaryDirectory() as d:
            root = Path(d); (root / 'index.html').write_text('<head></head>')
            with self.assertRaises(AssertionError): module.stage(root, root, root / 'out')
if __name__ == '__main__': unittest.main()
