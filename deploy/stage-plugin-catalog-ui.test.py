from pathlib import Path
import importlib.util
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_catalog', ROOT / 'deploy/stage-plugin-catalog-ui.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StageTest(unittest.TestCase):
    def test_preserves_custom_ui_and_api_and_does_not_write_app_js(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = root / 'local'
            local.mkdir()
            html = (ROOT / 'app/index.html').read_text().replace('https://api.zetslay.pro', 'https://custom-api.test')
            html = html.replace('</body>', '<p data-vps-custom>Local edits</p>\n</body>')
            (local / 'index.html').write_text(html)
            (local / 'app.js').write_text('LOCAL PATCHES')
            (local / 'plugin-cover.css').write_text('LOCAL COVER SETTINGS')
            module.stage(local, ROOT / 'app', root / 'out')
            updated = (root / 'out/index.html').read_text()
            self.assertIn('https://custom-api.test', updated)
            self.assertIn('data-vps-custom', updated)
            self.assertIn('connection-wizard-ui.js', updated)
            self.assertEqual(updated.count('href="plugin-catalog.css?'), 1)
            self.assertEqual(sorted(p.name for p in (root / 'out').iterdir()), ['index.html', 'plugin-catalog.css'])
            self.assertEqual((local / 'app.js').read_text(), 'LOCAL PATCHES')
            self.assertEqual((local / 'plugin-cover.css').read_text(), 'LOCAL COVER SETTINGS')

    def test_installation_is_repeatable(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = root / 'local'
            local.mkdir()
            (local / 'index.html').write_text((ROOT / 'app/index.html').read_text())
            module.stage(local, ROOT / 'app', root / 'out')
            module.stage(root / 'out', ROOT / 'app', root / 'again')
            self.assertEqual((root / 'out/index.html').read_bytes(), (root / 'again/index.html').read_bytes())

    def test_unknown_catalog_stops_before_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = root / 'local'
            local.mkdir()
            (local / 'index.html').write_text('<html><head></head><body>UNKNOWN</body></html>')
            with self.assertRaises(ValueError):
                module.stage(local, ROOT / 'app', root / 'out')
            self.assertFalse((root / 'out').exists())


if __name__ == '__main__':
    unittest.main()
