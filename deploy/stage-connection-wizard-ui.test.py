from pathlib import Path
import importlib.util
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_connection', ROOT / 'deploy/stage-connection-wizard-ui.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StageTest(unittest.TestCase):
    def local_copy(self, root):
        local = root / 'local'
        local.mkdir()
        html = (ROOT / 'app/index.html').read_text().replace('https://api.zetslay.pro', 'https://private-api.test')
        html = html.replace('</body>', '<div data-local-custom="preserve-me"></div>\n</body>')
        (local / 'index.html').write_text(html)
        (local / 'app.js').write_text((ROOT / 'app/app.js').read_text() + '\n// LOCAL ADMIN AND COVER FIXES\n')
        return local

    def test_preserves_custom_code_api_and_non_wizard_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = self.local_copy(root)
            module.stage(local, ROOT / 'app', root / 'out')
            html = (root / 'out/index.html').read_text()
            self.assertIn('https://private-api.test', html)
            self.assertIn('preserve-me', html)
            self.assertIn('kosell-rent.js?v=20261005-kosell-1-2', html)
            self.assertIn('plugin-cover.js?v=20261005-cover-upload', html)
            self.assertEqual((local / 'app.js').read_bytes(), (root / 'out/app.js').read_bytes())
            self.assertEqual(html.count('src="connection-wizard-ui.js?'), 1)
            self.assertLess(html.index('src="app.js?'), html.index('src="connection-wizard-ui.js?'))

    def test_repeated_installation_is_identical(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = self.local_copy(root)
            module.stage(local, ROOT / 'app', root / 'out')
            module.stage(root / 'out', ROOT / 'app', root / 'again')
            self.assertEqual((root / 'out/index.html').read_bytes(), (root / 'again/index.html').read_bytes())

    def test_rejects_unknown_app_or_markup_before_output(self):
        for broken in ('app.js', 'index.html'):
            with tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                local = self.local_copy(root)
                (local / broken).write_text('UNKNOWN')
                with self.assertRaises(ValueError):
                    module.stage(local, ROOT / 'app', root / 'out')
                self.assertFalse((root / 'out').exists())

    def test_older_asset_version_is_replaced_once(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = self.local_copy(root)
            path = local / 'index.html'
            path.write_text(path.read_text().replace(module.VERSION, 'old-version'))
            module.stage(local, ROOT / 'app', root / 'out')
            html = (root / 'out/index.html').read_text()
            self.assertNotIn('old-version', html)
            self.assertEqual(html.count('connection-wizard-ui.css?v='), 1)


if __name__ == '__main__':
    unittest.main()
