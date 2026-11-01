import importlib.util
from pathlib import Path
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_lots', ROOT / 'deploy/stage-lots-ui.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LotsStageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.local = self.path / 'local'
        self.out = self.path / 'out'
        self.local.mkdir()
        app = (ROOT / 'app/app.js').read_text()
        app = app.replace('function bindInteractions()', '// VPS authentication adjustment\nfunction bindInteractions()')
        html = (ROOT / 'app/index.html').read_text().replace('https://api.zetslay.pro', 'https://api.local.test')
        html = re.sub(r'^\s*<(?:script|link)[^\n]*(?:lots.js|lots.css)[^\n]*\n', '', html, flags=re.M)
        html = re.sub(r'^\s*<section[^\n]*data-view="lots".*?(?=^\s*<section[^\n]*data-view="plugins")', '          <section class="view" data-view="lots"><div id="lot-grid"></div></section>\n', html, flags=re.M | re.S)
        (self.local / 'app.js').write_text(app)
        (self.local / 'index.html').write_text(html)

    def tearDown(self):
        self.temp.cleanup()

    def stage(self):
        module.stage(self.local, ROOT / 'app', self.out)

    def test_preserves_every_unrelated_function_and_html_region(self):
        original = (self.local / 'app.js').read_text()
        html = (self.local / 'index.html').read_text()
        self.stage()
        updated = (self.out / 'app.js').read_text()
        touched = {'renderLots', 'resetAccountData', 'renderStoreFleet', 'setView'}
        functions = re.findall(r'^(?:async )?function (\w+)\([^\n]*\) \{.*?^\}\n', original, re.M | re.S)
        for name in functions:
            if name in touched:
                continue
            pattern = r'^(?:async )?function ' + name + r'\([^\n]*\) \{.*?^\}\n'
            self.assertEqual(re.search(pattern, original, re.M | re.S).group(), re.search(pattern, updated, re.M | re.S).group(), name)
        result = (self.out / 'index.html').read_text()
        self.assertIn('https://api.local.test', result)
        self.assertIn('src="profile.js', result)
        for view in ['dashboard', 'orders', 'messages', 'plugins', 'profile']:
            pattern = r'<section\b[^>]*data-view="' + view + r'".*?(?=\s*<section\b[^>]*data-view=|\s*</main>)'
            before = re.search(pattern, html, re.S)
            after = re.search(pattern, result, re.S)
            self.assertIsNotNone(before, view)
            self.assertEqual(before.group(), after.group(), view)
        self.assertIn('// VPS authentication adjustment', updated)
        self.assertEqual((self.local / 'app.js').read_text(), original)
        self.assertEqual((self.local / 'index.html').read_text(), html)

    def test_repeated_install_is_identical_and_assets_precede_app(self):
        self.stage()
        second = self.path / 'second'
        module.stage(self.out, ROOT / 'app', second)
        for name in ['app.js', 'index.html', 'lots.js', 'lots.css', 'lots.test.mjs']:
            self.assertEqual((self.out / name).read_bytes(), (second / name).read_bytes(), name)
        html = (second / 'index.html').read_text()
        self.assertEqual(html.count('src="lots.js'), 1)
        self.assertEqual(html.count('href="lots.css'), 1)
        self.assertLess(html.index('src="lots.js'), html.index('src="app.js'))

    def test_unknown_boundaries_or_conflicts_stop_before_output(self):
        original = (self.local / 'index.html').read_text()
        for html in [original.replace('data-view="lots"', 'data-view="custom"'), '<<<<<<< VPS\n' + original]:
            (self.local / 'index.html').write_text(html)
            with self.assertRaises(ValueError):
                self.stage()
            self.assertFalse(self.out.exists())
            self.assertEqual((self.local / 'index.html').read_text(), html)


if __name__ == '__main__':
    unittest.main()
