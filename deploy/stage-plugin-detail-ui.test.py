from pathlib import Path
import importlib.util
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_details', ROOT / 'deploy/stage-plugin-detail-ui.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StageTest(unittest.TestCase):
    def prepare(self, root):
        local = root / 'local'
        local.mkdir()
        for name in ('index.html', *module.INPUTS):
            (local / name).write_bytes((ROOT / 'app' / name).read_bytes())
        return local

    def test_preserves_custom_modules_covers_and_api(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = self.prepare(root)
            html = (local / 'index.html').read_text().replace('https://api.zetslay.pro', 'https://custom-api.test')
            html = html.replace('</body>', '<p data-vps-custom>Local edits</p>\n</body>')
            (local / 'index.html').write_text(html)
            for name in module.INPUTS:
                with (local / name).open('a') as file:
                    file.write('\n// VPS custom changes\n')
            (local / 'plugin-cover.css').write_text('CUSTOM COVER SIZE')
            module.stage(local, ROOT / 'app', root / 'out')
            updated = (root / 'out/index.html').read_text()
            for marker in ('https://custom-api.test', 'data-vps-custom', 'connection-wizard-ui.js', 'plugin-catalog.css'):
                self.assertIn(marker, updated)
            for name in module.INPUTS:
                self.assertEqual((root / 'out' / name).read_bytes(), (local / name).read_bytes())
            self.assertEqual((local / 'plugin-cover.css').read_text(), 'CUSTOM COVER SIZE')
            self.assertNotIn('plugin-cover.css', [p.name for p in (root / 'out').iterdir()])
            self.assertEqual((local / 'index.html').read_text(), html)

    def test_repeatable_installation_with_correct_defer_order(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = self.prepare(root)
            module.stage(local, ROOT / 'app', root / 'out')
            module.stage(root / 'out', ROOT / 'app', root / 'again')
            html = (root / 'out/index.html').read_text()
            self.assertEqual(html, (root / 'again/index.html').read_text())
            self.assertEqual(html.count('src="plugin-detail-ui.js?'), 1)
            self.assertEqual(html.count('href="plugin-detail-ui.css?'), 1)
            self.assertLess(html.index('src="plugin-page.js'), html.index('src="app.js'))
            self.assertLess(html.index('src="app.js'), html.index('src="plugin-detail-ui.js'))

    def test_unknown_page_stops_before_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = self.prepare(root)
            (local / 'plugin-page.js').write_text('UNSUPPORTED PAGE')
            with self.assertRaises(ValueError):
                module.stage(local, ROOT / 'app', root / 'out')
            self.assertFalse((root / 'out').exists())

    def test_missing_or_non_deferred_application_stops_before_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = self.prepare(root)
            html = (local / 'index.html').read_text()
            import re
            html = re.sub(r'(<script src="app\.js[^>]+) defer', r'\1', html)
            (local / 'index.html').write_text(html)
            with self.assertRaises(ValueError):
                module.stage(local, ROOT / 'app', root / 'out')
            self.assertFalse((root / 'out').exists())


if __name__ == '__main__':
    unittest.main()
