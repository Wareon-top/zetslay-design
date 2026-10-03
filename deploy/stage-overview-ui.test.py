import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_overview', ROOT / 'deploy/stage-overview-ui.py')
stage_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage_module)
NEW = "  if (typeof renderOverview === 'function') renderOverview();\n  else { renderDashChart(); renderDashDonut(); }\n}"
OLD = '  renderDashChart();\n  renderDashDonut();\n}'


class StageOverviewTests(unittest.TestCase):
    def setUp(self):
        self.work = tempfile.TemporaryDirectory()
        self.path = Path(self.work.name)
        self.local = self.path / 'local'
        self.out = self.path / 'staged'
        self.local.mkdir()
        source = (ROOT / 'app/app.js').read_text().replace(NEW, OLD)
        source = source.replace('function bindInteractions()', '// Local VPS customization remains here.\nfunction bindInteractions()')
        html = (ROOT / 'app/index.html').read_text().replace('https://api.zetslay.pro', 'https://api.custom.test')
        html = html.replace('styles.css?v=20261003-overview', 'styles.css?v=custom-local')
        (self.local / 'app.js').write_text(source)
        (self.local / 'index.html').write_text(html)

    def tearDown(self):
        self.work.cleanup()

    def stage(self):
        stage_module.stage(self.local, ROOT / 'app', self.out)

    def test_preserves_api_domain_and_unrelated_js(self):
        original = (self.local / 'app.js').read_text()
        self.stage()
        self.assertEqual((self.out / 'app.js').read_text(), original.replace(OLD, NEW))
        html = (self.out / 'index.html').read_text()
        self.assertIn('https://api.custom.test', html)
        self.assertIn('styles.css?v=custom-local', html)
        self.assertIn('data-overview', html)
        self.assertEqual((self.local / 'app.js').read_text(), original)

    def test_update_is_idempotent_and_assets_are_loaded_once_in_order(self):
        self.stage()
        second = self.path / 'second'
        stage_module.stage(self.out, ROOT / 'app', second)
        for file in ['app.js', 'index.html', 'overview.js', 'overview.css', 'overview.test.mjs']:
            self.assertEqual((self.out / file).read_bytes(), (second / file).read_bytes())
        html = (self.out / 'index.html').read_text()
        self.assertEqual(html.count('src="overview.js'), 1)
        self.assertEqual(html.count('href="overview.css'), 1)
        self.assertLess(html.index('src="overview.js'), html.index('src="app.js'))

    def test_conflicted_files_fail_before_output_or_source_changes(self):
        original = '<<<<<<< VPS\n' + (self.local / 'app.js').read_text()
        (self.local / 'app.js').write_text(original)
        with self.assertRaisesRegex(ValueError, 'маркеры конфликта'):
            self.stage()
        self.assertFalse(self.out.exists())
        self.assertEqual((self.local / 'app.js').read_text(), original)

    def test_unknown_dashboard_hook_does_not_overwrite_custom_code(self):
        original = (self.local / 'app.js').read_text().replace(OLD, '  customDashboard();\n}')
        (self.local / 'app.js').write_text(original)
        with self.assertRaisesRegex(ValueError, 'Неизвестное окончание'):
            self.stage()
        self.assertFalse(self.out.exists())
        self.assertEqual((self.local / 'app.js').read_text(), original)

    def test_missing_orders_boundary_fails_before_modification(self):
        original = (self.local / 'index.html').read_text().replace('data-view="orders"', 'data-view="custom-orders"')
        (self.local / 'index.html').write_text(original)
        with self.assertRaisesRegex(ValueError, 'границы Главной'):
            self.stage()
        self.assertFalse(self.out.exists())
        self.assertEqual((self.local / 'index.html').read_text(), original)


if __name__ == '__main__':
    unittest.main()
