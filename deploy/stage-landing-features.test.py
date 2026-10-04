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

    def test_missing_mark_stops_without_touching_served_files(self):
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

if __name__ == '__main__':
    unittest.main()
