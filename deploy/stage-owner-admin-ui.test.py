import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('owner_stage', ROOT / 'deploy/stage-owner-admin-ui.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class OwnerStageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.local, self.output = root / 'local', root / 'output'
        self.local.mkdir()
        self.incoming = ROOT / 'app'
        source = (ROOT.parent / 'admin-work/base/design/app.js').read_text() if (ROOT.parent / 'admin-work/base/design/app.js').exists() else (ROOT / 'app/app.js').read_text()
        source = source.replace("'Один аккаунт FunPay · защищённое подключение'", "'Подпись VPS'")
        self.original = source
        self.html = (ROOT / 'app/index.html').read_text().replace('https://api.zetslay.pro', 'https://api.custom.test')
        (self.local / 'app.js').write_text(source)
        (self.local / 'index.html').write_text(self.html)

    def tearDown(self):
        self.temp.cleanup()

    def test_preserves_auth_connector_and_all_other_views(self):
        module.stage(self.local, self.incoming, self.output)
        staged = (self.output / 'app.js').read_text()
        for name in ['renderOrders', 'renderDashboard', 'renderConnectionWizard', 'initializeAuthFlow', 'advanceConnectionWizard', 'saveCatalogEntry']:
            self.assertEqual(module.function(self.original, name).group(), module.function(staged, name).group())
        self.assertIn("telegramUserId === '5062414502'", staged)
        html = (self.output / 'index.html').read_text()
        self.assertIn('https://api.custom.test', html)
        self.assertEqual(html, self.html)

    def test_repeat_update_is_idempotent(self):
        module.stage(self.local, self.incoming, self.output)
        repeated = self.output.parent / 'repeated'
        module.stage(self.output, self.incoming, repeated)
        for name in ['app.js', 'index.html', 'admin-access.css']:
            self.assertEqual((self.output / name).read_bytes(), (repeated / name).read_bytes())

    def test_unknown_capability_assignment_fails_without_live_changes(self):
        source = self.original.replace('catalog.canManage === true', 'catalog.admin === true')
        (self.local / 'app.js').write_text(source)
        with self.assertRaises(ValueError):
            module.stage(self.local, self.incoming, self.output)
        self.assertEqual((self.local / 'app.js').read_text(), source)
        self.assertFalse(self.output.exists())

    def test_existing_merge_markers_fail_without_output(self):
        (self.local / 'app.js').write_text(self.original + '\n<<<<<<< VPS\n')
        with self.assertRaises(ValueError):
            module.stage(self.local, self.incoming, self.output)
        self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
