import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('stage', Path(__file__).with_name('stage-ai-reviews.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class StageTests(unittest.TestCase):
    def test_upgrades_existing_legendary_entry_and_invalidates_old_asset_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); src = root / 'src'; src.mkdir()
            inc = Path(__file__).resolve().parents[1] / 'app'
            for filename in ['index.html', 'plugin-page.js', 'plugin-rarity.js', 'subscription-access.js']:
                source = (inc / filename).read_text()
                if filename == 'plugin-rarity.js':
                    source = source.replace("'zetslay.ai-reviews':'ultra'", "'zetslay.ai-reviews':'legendary'")
                if filename == 'subscription-access.js':
                    source = source.replace("'zetslay.ai-reviews':2", "'zetslay.ai-reviews':3")
                source = source.replace('20261012-ai-reviews-ultra', '20261012-ai-reviews')
                (src / filename).write_text(source)
            module.stage(src, inc, root / 'out')
            self.assertIn("'zetslay.ai-reviews':'ultra'", (root / 'out' / 'plugin-rarity.js').read_text())
            self.assertIn("'zetslay.ai-reviews':2", (root / 'out' / 'subscription-access.js').read_text())
            html = (root / 'out' / 'index.html').read_text()
            self.assertIn('ai-reviews.js?v=20261012-ai-reviews-ultra', html)
            self.assertIn('ai-reviews.css?v=20261012-ai-reviews-ultra', html)

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
