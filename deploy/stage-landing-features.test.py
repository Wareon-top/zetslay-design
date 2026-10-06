import importlib.util
from pathlib import Path
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
spec = importlib.util.spec_from_file_location('stage_features', HERE / 'stage-landing-features.py')
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)

class FeaturesStageTests(unittest.TestCase):
    def fixture(self, root):
        local = root / 'local'
        local.mkdir()
        text = (REPO / 'index.html').read_text()
        section = stage.features_section(text)
        text = text[:section.start()] + '<section class="section" id="features"><h2 id="features-title">OLD LOCAL CARDS</h2></section>' + text[section.end():]
        text = text.replace('Единая панель для селлеров', 'VPS CUSTOM HERO')
        text = text.replace('</body>', '<script>/* VPS AUTH */</script>\n</body>')
        (local / 'index.html').write_text(text)
        (local / 'landing.css').write_text('LOCAL BACKGROUND AND FONTS')
        (local / 'app').mkdir()
        (local / 'app/app.js').write_text('WORKING CABINET AND PLUGIN')
        return local

    def test_preserves_local_hero_auth_other_sections_css_and_cabinet(self):
        with tempfile.TemporaryDirectory(dir=REPO.parent) as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            before = (local / 'index.html').read_text()
            stage.stage(local, REPO, root / 'out')
            after = (root / 'out/index.html').read_text()
            self.assertIn('VPS CUSTOM HERO', after)
            self.assertIn('VPS AUTH', after)
            old, new = stage.features_section(before), stage.features_section(after)
            self.assertEqual(before[before.index('<main'):old.start()], after[after.index('<main'):new.start()])
            self.assertEqual(before[old.end():], after[new.end():])
            self.assertEqual((local / 'landing.css').read_text(), 'LOCAL BACKGROUND AND FONTS')
            self.assertEqual((local / 'app/app.js').read_text(), 'WORKING CABINET AND PLUGIN')
            self.assertFalse((root / 'out/landing.css').exists())
            self.assertFalse((root / 'out/app').exists())

    def test_repeated_updates_are_idempotent(self):
        with tempfile.TemporaryDirectory(dir=REPO.parent) as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            stage.stage(local, REPO, root / 'out')
            stage.stage(root / 'out', REPO, root / 'again')
            self.assertEqual((root / 'out/index.html').read_bytes(), (root / 'again/index.html').read_bytes())

    def test_ambiguous_local_section_stops_before_creating_candidate(self):
        with tempfile.TemporaryDirectory(dir=REPO.parent) as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            text = (local / 'index.html').read_text() + '<section id="features"></section>'
            (local / 'index.html').write_text(text)
            with self.assertRaises(ValueError):
                stage.stage(local, REPO, root / 'out')
            self.assertEqual((local / 'index.html').read_text(), text)
            self.assertFalse((root / 'out').exists())

    def test_missing_asset_stops_without_touching_served_files(self):
        with tempfile.TemporaryDirectory(dir=REPO.parent) as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            before = (local / 'index.html').read_bytes()
            incoming = root / 'incoming'
            incoming.mkdir()
            (incoming / 'index.html').write_text((REPO / 'index.html').read_text())
            (incoming / 'landing-features.css').write_text('CSS')
            with self.assertRaises(OSError):
                stage.stage(local, incoming, root / 'out')
            self.assertEqual((local / 'index.html').read_bytes(), before)
            self.assertFalse((root / 'out').exists())

    def test_preserves_vps_plugin_covers_and_inserts_missing_script_once(self):
        with tempfile.TemporaryDirectory(dir=REPO.parent) as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            text = (local / 'index.html').read_text()
            import re
            text = re.sub(r'  <script src="landing-features.js[^"\n]*" defer></script>\n', '', text)
            text = text.replace('</body>', '<img src="assets/landing-plugins/USER-COVER.webp" alt="CUSTOM COVER">\n</body>')
            (local / 'index.html').write_text(text)
            stage.stage(local, REPO, root / 'out')
            result = (root / 'out/index.html').read_text()
            self.assertIn('USER-COVER.webp', result)
            self.assertEqual(result.count('src="landing-features.js?'), 1)
            self.assertEqual(sorted(p.name for p in (root / 'out').iterdir()), ['index.html', *sorted(stage.FILES)])
            self.assertEqual((local / 'index.html').read_text(), text)

    def test_duplicate_assets_stop_before_creating_candidate(self):
        with tempfile.TemporaryDirectory(dir=REPO.parent) as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            text = (local / 'index.html').read_text().replace('</head>', '<link rel="stylesheet" href="landing-features.css?v=OLD"></head>')
            (local / 'index.html').write_text(text)
            with self.assertRaises(ValueError):
                stage.stage(local, REPO, root / 'out')
            self.assertFalse((root / 'out').exists())

    def test_reference_grid_has_nine_semantic_cards_and_expected_spans(self):
        from html.parser import HTMLParser
        class Cards(HTMLParser):
            def __init__(self):
                super().__init__()
                self.spans = []
                self.headings = 0
                self.images = 0
                self.controls = 0
            def handle_starttag(self, tag, attrs):
                attrs = dict(attrs)
                if tag == 'article':
                    self.spans.append(2 if 'bento-card--wide' in attrs.get('class', '').split() else 1)
                if tag == 'h3': self.headings += 1
                if tag == 'img': self.images += 1
                if tag in ('input', 'button', 'form'): self.controls += 1
        parsed = Cards()
        parsed.feed(stage.features_section((REPO / 'index.html').read_text()).group())
        self.assertEqual(parsed.spans, [2,1,1,1,2,1,1,1,2])
        self.assertEqual(parsed.headings, 9)
        self.assertEqual(parsed.images, 0)
        self.assertEqual(parsed.controls, 0)

if __name__ == '__main__':
    unittest.main()
