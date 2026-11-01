import importlib.util
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_plugin', ROOT / 'deploy/stage-plugin-ui.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PluginStageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.local = self.path / 'local'
        self.incoming = self.path / 'incoming'
        self.output = self.path / 'staged'
        self.local.mkdir()
        shutil.copytree(ROOT / 'app', self.incoming)
        base_path = ROOT.parent / 'plugin-work/base-app.js'
        self.base = base_path.read_text() if base_path.exists() else subprocess.check_output(
            ['git', 'show', 'e27fb9dff8cfe323789ebce08b43878f060cbc67:app/app.js'], cwd=ROOT, text=True)
        (self.incoming / 'base-app.js').write_text(self.base)
        (self.local / 'app.js').write_text(self.base.replace("'Protected single-account connection'", "'Локальная подпись подключения'"))
        html = (ROOT / 'app/index.html').read_text().replace('https://api.zetslay.pro', 'https://api.custom.test')
        (self.local / 'index.html').write_text(html)

    def tearDown(self):
        self.temp.cleanup()

    def stage(self):
        module.stage(self.local, self.incoming, self.output)

    def test_changes_only_plugin_functions_and_keeps_unrelated_vps_edits(self):
        source = (self.local / 'app.js').read_text().replace('function renderOrders() {', '// VPS customization\nfunction renderOrders() {')
        (self.local / 'app.js').write_text(source)
        self.stage()
        staged = (self.output / 'app.js').read_text()
        for name in ['renderOrders', 'renderDashboard', 'readStoreContent', 'renderConnectionWizard', 'initializeAuthFlow']:
            self.assertEqual(module.function(source, name).group(), module.function(staged, name).group())
        self.assertIn('// VPS customization', staged)
        self.assertIn('function canManagePluginCatalog()', staged)
        self.assertIn('parsePluginPageRoute', staged)

    def test_keeps_api_main_orders_and_existing_styles_in_html(self):
        original = (self.local / 'index.html').read_text()
        self.stage()
        staged = (self.output / 'index.html').read_text()
        start, end = module.catalog_region(original)
        new_start, new_end = module.catalog_region(staged)
        original_prefix = re.sub(r'^.*plugin-page\.css.*\n', '', original[:start], flags=re.M)
        new_prefix = re.sub(r'^.*plugin-page\.css.*\n', '', staged[:new_start], flags=re.M)
        self.assertEqual(original_prefix, new_prefix)
        self.assertIn('https://api.custom.test', staged)
        self.assertIn('orders.css?v=20261003-orders', staged)
        self.assertLess(staged.index('src="plugin-page.js'), staged.index('src="app.js'))
        self.assertIn('data-plugin-admin-controls', staged[new_start:new_end])
        self.assertNotIn('data-plugin-publish', staged[new_start:new_end])

    def test_repeat_update_is_idempotent(self):
        self.stage()
        repeated = self.path / 'repeated'
        module.stage(self.output, self.incoming, repeated)
        for file in ['app.js', 'index.html', 'plugin-page.js', 'plugin-page.css']:
            self.assertEqual((self.output / file).read_bytes(), (repeated / file).read_bytes())
        self.assertEqual((repeated / 'index.html').read_text().count('src="plugin-page.js'), 1)

    def test_unknown_catalog_function_stops_before_output_or_live_changes(self):
        source = (self.local / 'app.js').read_text().replace("  const list = filterPluginCatalog(state.plugins, state.pluginFilter);", '  customPluginCatalog();')
        (self.local / 'app.js').write_text(source)
        with self.assertRaises(ValueError):
            self.stage()
        self.assertFalse(self.output.exists())
        self.assertEqual((self.local / 'app.js').read_text(), source)

    def test_missing_catalog_boundary_or_conflict_marker_stops_before_output(self):
        original = (self.local / 'index.html').read_text()
        for html in [original.replace('data-view="telegram"', 'data-view="custom"'), '<<<<<<< VPS\n' + original]:
            (self.local / 'index.html').write_text(html)
            with self.assertRaises(ValueError):
                self.stage()
            self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
