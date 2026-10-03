import importlib.util
from pathlib import Path
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_messages', ROOT / 'deploy/stage-messages-ui.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MessagesStageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.local = self.path / 'local'
        self.out = self.path / 'out'
        self.local.mkdir()
        self.source = (ROOT / 'app/app.js').read_text().replace(module.GUARD, '')
        self.source = self.source.replace(module.SYNC_WRAPPER + '\n\n' + module.READ_HEADER, module.SYNC_HEADER)
        self.source += '\n// Local VPS connector, auth and admin customization.\n'
        (self.local / 'app.js').write_text(self.source)
        self.html = (ROOT / 'app/index.html').read_text().replace('https://api.zetslay.pro', 'https://api.custom.test').replace('styles.css?v=20261003-overview', 'styles.css?v=local-brand')
        (self.local / 'index.html').write_text(self.html)
        (self.local / 'overview.js').write_text('local overview asset')

    def tearDown(self):
        self.temp.cleanup()

    def stage(self):
        module.stage(self.local, ROOT / 'app', self.out)

    def test_only_render_hooks_and_shared_read_header_change(self):
        self.stage()
        expected = self.source
        for name in ['renderConversations', 'renderActiveConversation']:
            header = f'function {name}() {{\n'
            expected = expected.replace(header, header + module.GUARD)
        expected = expected.replace(module.SYNC_HEADER, module.SYNC_WRAPPER + '\n\n' + module.READ_HEADER)
        self.assertEqual((self.out / 'app.js').read_text(), expected)
        self.assertEqual((self.local / 'app.js').read_text(), self.source)

    def test_other_views_api_and_existing_assets_are_retained(self):
        self.stage()
        html = (self.out / 'index.html').read_text()
        a, b = module.region(self.html)
        c, d = module.region(html)
        strip_assets = lambda value: re.sub(r'^.*messages\.(?:css|js).*\n', '', re.sub(r'(src="app\.js\?v=)[A-Za-z0-9_-]+', r'\1PRESERVED', value), flags=re.M)
        self.assertEqual(strip_assets(self.html[:a]), strip_assets(html[:c]))
        self.assertEqual(strip_assets(self.html[b:]), strip_assets(html[d:]))
        self.assertIn('https://api.custom.test', html)
        self.assertIn('styles.css?v=local-brand', html)
        self.assertEqual((self.out / 'overview.js').read_text(), 'local overview asset')

    def test_repeat_staging_is_idempotent(self):
        self.stage()
        second = self.path / 'second'
        module.stage(self.out, ROOT / 'app', second)
        for file in ['app.js', 'index.html', 'messages.js', 'messages.css', 'messages.test.mjs']:
            self.assertEqual((self.out / file).read_bytes(), (second / file).read_bytes())
        html = (second / 'index.html').read_text()
        self.assertEqual(html.count('src="messages.js'), 1)
        self.assertEqual(html.count('href="messages.css'), 1)

    def test_unknown_hooks_or_shared_read_fail_without_output(self):
        for candidate in [self.source.replace("  const target = byId('conversation-items');", '  customizedInbox();'), self.source.replace(module.SYNC_HEADER, 'async function privateSync() {')]:
            (self.local / 'app.js').write_text(candidate)
            with self.assertRaises(ValueError):
                self.stage()
            self.assertFalse(self.out.exists())
            self.assertEqual((self.local / 'app.js').read_text(), candidate)

    def test_conflicts_and_duplicate_view_bounds_are_rejected(self):
        for candidate in ['<<<<<<< VPS\n' + self.html, self.html.replace('data-view="lots"', 'data-view="custom"'), self.html + '\n<section data-view="messages">']:
            (self.local / 'index.html').write_text(candidate)
            with self.assertRaises(ValueError):
                self.stage()
            self.assertFalse(self.out.exists())
            self.assertEqual((self.local / 'index.html').read_text(), candidate)


if __name__ == '__main__':
    unittest.main()
