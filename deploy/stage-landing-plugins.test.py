from pathlib import Path
import base64
import importlib.util
import json
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('showcase', ROOT / 'deploy/stage-landing-plugins.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5k8AAAAASUVORK5CYII=')


class ShowcaseTest(unittest.TestCase):
    def fixture(self, root):
        local = root / 'local'
        local.mkdir()
        text = (ROOT / 'index.html').read_text()
        current = module.section(text, 'comparison')
        old = '<section id="comparison"><h2>Простые условия.</h2><p>OLD REQUIREMENTS</p></section>'
        legacy = '<section id="plugins"><div class="plugin-track">messages:read telegram:send</div></section>'
        text = text[:current.start()] + old + legacy + text[current.end():]
        text = text.replace('Единая панель для селлеров', 'LOCAL HERO')
        text = text.replace('</body>', '<script>/* LOCAL LOGIN */</script></body>')
        (local / 'index.html').write_text(text)
        (local / 'landing.css').write_text('CUSTOM BACKGROUND')
        (local / 'app').mkdir()
        (local / 'app/app.js').write_text('ACTIVE PLUGIN CONFIGURATION')
        return local

    def export(self, root, entries):
        path = root / 'public.json'
        path.write_text(json.dumps({'entries': entries}))
        return path

    def test_replaces_target_preserving_hero_auth_and_cabinet_without_plugin_actions(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            module.stage(local, ROOT, root / 'out')
            text = (root / 'out/index.html').read_text()
            self.assertIn('LOCAL HERO', text)
            self.assertIn('LOCAL LOGIN', text)
            self.assertNotIn('OLD REQUIREMENTS', text)
            self.assertNotIn('plugin-track', text)
            showcase = module.section(text, 'comparison').group()
            module.ShowcaseValidator().feed(showcase)
            self.assertEqual(showcase.count('data-public-plugin="'), 7)
            self.assertEqual(len(re.findall(r'id="plugins"', text)), 1)
            self.assertIn('href="#plugins"', text)
            self.assertNotIn('planned.', showcase)
            self.assertNotIn('Автоответчик', showcase)
            self.assertNotIn('Telegram-уведомления', showcase)
            self.assertEqual((local / 'landing.css').read_text(), 'CUSTOM BACKGROUND')
            self.assertEqual((local / 'app/app.js').read_text(), 'ACTIVE PLUGIN CONFIGURATION')
            self.assertFalse((root / 'out/app').exists())

    def test_original_cover_bytes_safe_names_and_publication_visibility(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            export = self.export(root, [
                {'id': module.IDS[0], 'name': '<img src=x onerror=alert(1)>', 'cover': 'data:image/png;base64,' + base64.b64encode(PNG).decode(), 'published': True},
                {'id': module.IDS[1], 'name': 'Private draft', 'cover': '', 'published': False}])
            module.stage(local, ROOT, root / 'out', export)
            text = (root / 'out/index.html').read_text()
            self.assertIn('&lt;img src=x onerror=alert(1)&gt;', text)
            self.assertNotIn('<img src=x', text)
            self.assertNotIn('data-public-plugin="' + module.IDS[1] + '"', text)
            self.assertIn('<strong data-public-plugin-count>6</strong>', text)
            assets = list((root / 'out/assets/landing-plugin-covers').iterdir())
            self.assertEqual(len(assets), 1)
            self.assertEqual(assets[0].read_bytes(), PNG)
            self.assertIn('loading="lazy"', text)

    def test_repeat_is_idempotent_and_all_unpublished_has_honest_empty_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            export = self.export(root, [{'id': ident, 'name': 'Hidden', 'cover': '', 'published': False} for ident in module.IDS])
            module.stage(local, ROOT, root / 'out', export)
            module.stage(root / 'out', ROOT, root / 'again', export)
            self.assertEqual((root / 'out/index.html').read_bytes(), (root / 'again/index.html').read_bytes())
            text = (root / 'out/index.html').read_text()
            self.assertIn('Каталог обновляется', text)
            self.assertIn('<strong data-public-plugin-count>0</strong>', text)
            self.assertEqual(text.count('href="landing-plugins.css?'), 1)

    def test_invalid_cover_and_unknown_or_duplicate_ids_stop_before_writes(self):
        invalid = [
            [{'id': module.IDS[0], 'published': True, 'cover': 'https://external.test/cover.png'}],
            [{'id': '../secret', 'published': True}],
            [{'id': module.IDS[0], 'published': True}] * 2,
            [{'id': module.IDS[0], 'published': True, 'cover': 'data:image/png;base64,' + base64.b64encode(b'<script>').decode()}]]
        for entries in invalid:
            with self.subTest(entries=entries), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                local = self.fixture(root)
                before = (local / 'index.html').read_bytes()
                with self.assertRaises(ValueError):
                    module.stage(local, ROOT, root / 'out', self.export(root, entries))
                self.assertFalse((root / 'out').exists())
                self.assertEqual((local / 'index.html').read_bytes(), before)

    def test_unknown_local_block_stops_without_overwriting_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            text = (local / 'index.html').read_text().replace('Простые условия.', 'CUSTOM DIFFERENT SECTION')
            (local / 'index.html').write_text(text)
            with self.assertRaises(ValueError):
                module.stage(local, ROOT, root / 'out')
            self.assertFalse((root / 'out').exists())

    def test_showcase_validator_rejects_install_controls_even_when_disabled(self):
        for unsafe in ('<button disabled data-plugin-id="x">Установить</button>', '<a href="app/#plugins/x">Подробнее</a>', '<div onclick="install()">X</div>'):
            with self.subTest(unsafe=unsafe), self.assertRaises(ValueError):
                module.ShowcaseValidator().feed(unsafe)


if __name__ == '__main__':
    unittest.main()
