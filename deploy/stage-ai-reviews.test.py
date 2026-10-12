import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('stage', Path(__file__).with_name('stage-ai-reviews.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class StageTests(unittest.TestCase):
    def test_preserves_custom_content_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            src = root / 'src'; src.mkdir()
            inc = Path(__file__).resolve().parents[1] / 'app'
            for filename in ['index.html', 'plugin-page.js', 'plugin-rarity.js', 'subscription-access.js']:
                (src / filename).write_text((inc / filename).read_text() + '\n<!-- CUSTOM CONTENT -->' if filename == 'index.html' else (inc / filename).read_text() + '\n// CUSTOM CONTENT\n')
            module.stage(src, inc, root / 'out')
            module.stage(root / 'out', inc, root / 'again')
            for filename in ['index.html', 'plugin-page.js', 'plugin-rarity.js', 'subscription-access.js']:
                self.assertIn('CUSTOM CONTENT', (root / 'out' / filename).read_text())
                self.assertEqual((root / 'out' / filename).read_bytes(), (root / 'again' / filename).read_bytes())
            self.assertEqual((root / 'out' / 'index.html').read_text().count('src="ai-reviews.js?'), 1)

    def test_missing_access_script_stops(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); src = root / 'src'; src.mkdir(); inc = Path(__file__).resolve().parents[1] / 'app'
            for filename in ['index.html', 'plugin-page.js', 'plugin-rarity.js', 'subscription-access.js']:
                (src / filename).write_text((inc / filename).read_text().replace('src="subscription-access.js', 'src="other.js'))
            with self.assertRaises(ValueError):
                module.stage(src, inc, root / 'out')

if __name__ == '__main__':
    unittest.main()
