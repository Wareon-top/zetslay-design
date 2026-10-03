import importlib.util
from pathlib import Path
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_orders', ROOT / 'deploy/stage-orders-ui.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def main_region(html):
    return re.search(r'<section\b[^>]*data-view="dashboard".*?(?=\s*<section\b[^>]*data-view="orders")', html, re.S).group()


class OrdersStageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.local = self.path / 'local'
        self.out = self.path / 'staged'
        self.local.mkdir()
        source = (ROOT / 'app/app.js').read_text().replace(module.ORDERS_GUARD, '')
        source = source.replace(module.SYNC_WRAPPER + '\n\n' + module.READ_HEADER, module.SYNC_HEADER)
        source = source.replace('function bindInteractions()', '// Local VPS auth and bot changes are preserved.\nfunction bindInteractions()')
        html = (ROOT / 'app/index.html').read_text().replace('https://api.zetslay.pro', 'https://api.custom.test')
        html = html.replace('styles.css?v=20261003-overview', 'styles.css?v=local-style')
        (self.local / 'app.js').write_text(source)
        (self.local / 'index.html').write_text(html)
        (self.local / 'overview.js').write_bytes((ROOT / 'app/overview.js').read_bytes())

    def tearDown(self):
        self.temp.cleanup()

    def stage(self):
        module.stage(self.local, ROOT / 'app', self.out)

    def test_changes_only_the_orders_hook_and_shared_read_header(self):
        original = (self.local / 'app.js').read_text()
        self.stage()
        expected = original.replace('function renderOrders() {\n', 'function renderOrders() {\n' + module.ORDERS_GUARD)
        expected = expected.replace(module.SYNC_HEADER, module.SYNC_WRAPPER + '\n\n' + module.READ_HEADER)
        self.assertEqual((self.out / 'app.js').read_text(), expected)
        self.assertEqual((self.local / 'app.js').read_text(), original)

    def test_preserves_main_api_and_existing_overview_assets(self):
        original = (self.local / 'index.html').read_text()
        self.stage()
        html = (self.out / 'index.html').read_text()
        self.assertEqual(main_region(html), main_region(original))
        self.assertIn('https://api.custom.test', html)
        self.assertIn('styles.css?v=local-style', html)
        self.assertEqual((self.out / 'overview.js').read_bytes(), (self.local / 'overview.js').read_bytes())
        self.assertLess(html.index('src="overview.js'), html.index('src="orders.js'))
        self.assertLess(html.index('src="orders.js'), html.index('src="app.js'))

    def test_repeat_update_is_idempotent(self):
        self.stage()
        second = self.path / 'second'
        module.stage(self.out, ROOT / 'app', second)
        for file in ['app.js', 'index.html', 'orders.js', 'orders.css', 'orders.test.mjs', 'overview.js']:
            self.assertEqual((self.out / file).read_bytes(), (second / file).read_bytes())
        html = (second / 'index.html').read_text()
        self.assertEqual(html.count('src="orders.js'), 1)
        self.assertEqual(html.count('href="orders.css'), 1)

    def test_unknown_render_function_stops_before_any_output(self):
        original = (self.local / 'app.js').read_text().replace("  const target = byId('orders-table-body');", '  customOrders();')
        (self.local / 'app.js').write_text(original)
        with self.assertRaisesRegex(ValueError, 'Неизвестное начало'):
            self.stage()
        self.assertFalse(self.out.exists())
        self.assertEqual((self.local / 'app.js').read_text(), original)

    def test_conflict_markers_or_unknown_read_wrapper_cannot_replace_live_code(self):
        original = (self.local / 'app.js').read_text()
        for candidate in ['<<<<<<< VPS\n' + original, original.replace(module.SYNC_HEADER, 'async function customStoreContent() {')]:
            (self.local / 'app.js').write_text(candidate)
            with self.assertRaises(ValueError):
                self.stage()
            self.assertFalse(self.out.exists())
            self.assertEqual((self.local / 'app.js').read_text(), candidate)


if __name__ == '__main__':
    unittest.main()
