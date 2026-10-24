from pathlib import Path
import importlib.util
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('stage_cabinet', Path(__file__).with_name('stage-cabinet-ui.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

PAGE = '''<!doctype html><html><head>
<meta name="zetslay-api-base-url" content="https://custom-api.test">
<link rel="stylesheet" href="styles.css?local=1">
<link rel="stylesheet" href="custom-cover.css">
</head><body><div class="app-shell" hidden>
<aside class="sidebar"><button data-view-target="plugins">Плагины</button></aside>
<header class="topbar"><strong data-topbar-balance>—</strong></header>
<div data-admin-only hidden>Admin</div><div data-selected-store-avatar>FP</div>
<input type="password" data-vps-field>
</div><script src="app.js?v=local" defer></script>
<script src="custom-local.js" defer></script></body></html>'''


class StageTest(unittest.TestCase):
    def prepare(self, root, page=PAGE):
        local, incoming = root / 'local', root / 'incoming'
        local.mkdir()
        incoming.mkdir()
        (local / 'index.html').write_text(page)
        (local / 'app.js').write_bytes(b'// custom VPS changes\n')
        (local / 'custom-cover.css').write_bytes(b'.cover { aspect-ratio: 4/3; }')
        (incoming / module.ASSET).write_text('/* new presentation */\n:root { --bg:#101114; }')
        return local, incoming

    def test_preserves_every_local_byte_except_new_stylesheet_link(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local, incoming = self.prepare(root)
            before = {p.name: p.read_bytes() for p in local.iterdir()}
            module.stage(local, incoming, root / 'out')
            updated = (root / 'out/index.html').read_text()
            link = f'<link rel="stylesheet" href="{module.ASSET}?v={module.VERSION}">\n  '
            self.assertEqual(updated.replace(link, ''), PAGE)
            self.assertEqual(before, {p.name: p.read_bytes() for p in local.iterdir()})
            self.assertEqual(set(p.name for p in (root / 'out').iterdir()), {'index.html', module.ASSET})

    def test_installation_is_idempotent_and_stylesheet_is_last(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local, incoming = self.prepare(root)
            module.stage(local, incoming, root / 'out')
            module.stage(root / 'out', incoming, root / 'again')
            self.assertEqual((root / 'out/index.html').read_bytes(), (root / 'again/index.html').read_bytes())
            page = module.CabinetPage()
            page.feed((root / 'out/index.html').read_text())
            self.assertTrue(page.styles[-1][0].startswith(module.ASSET))
            self.assertEqual(sum(href.startswith(module.ASSET) for href, _ in page.styles), 1)

    def test_unknown_layout_or_styles_outside_head_stop_before_writes(self):
        for page in (PAGE.replace('class="topbar"', 'class="unknown"'), PAGE.replace('</body>', '<link rel="stylesheet" href="late.css"></body>'), PAGE.replace('app.js?v=local', 'other.js')):
            with self.subTest(page=page), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                local, incoming = self.prepare(root, page)
                with self.assertRaises(ValueError):
                    module.stage(local, incoming, root / 'out')
                self.assertFalse((root / 'out').exists())
                self.assertEqual((local / 'index.html').read_text(), page)

    def test_empty_asset_stops_before_writes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local, incoming = self.prepare(root)
            (incoming / module.ASSET).write_text('')
            with self.assertRaises(ValueError):
                module.stage(local, incoming, root / 'out')
            self.assertFalse((root / 'out').exists())


if __name__ == '__main__':
    unittest.main()
