import importlib.util
from pathlib import Path
import re
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
spec = importlib.util.spec_from_file_location('stage_steps', HERE / 'stage-landing-steps.py')
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)

class StepsStageTests(unittest.TestCase):
    def fixture(self, root):
        local = root / 'local'
        local.mkdir()
        text = (REPO / 'index.html').read_text()
        old = stage.steps_section(text)
        text = text[:old.start()] + '<section id="steps"><h2>VPS OLD STEPS</h2></section>' + text[old.end():]
        text = re.sub(r'  <link rel="stylesheet" href="landing-steps.css[^"\n]*">\n', '', text)
        text = text.replace('</body>', '<img src="assets/plugins/MY-COVER.webp" alt="VPS cover"><script>/* VPS AUTH */</script>\n</body>')
        (local / 'index.html').write_text(text)
        (local / 'app').mkdir()
        (local / 'app/app.js').write_text('WORKING VPS CABINET')
        return local

    def test_preserves_other_sections_and_user_covers_exactly(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            before = (local / 'index.html').read_text()
            stage.stage(local, REPO, root / 'out')
            after = (root / 'out/index.html').read_text()
            def strip_allowed(text):
                section = stage.steps_section(text)
                text = text[:section.start()] + '<STEPS>' + text[section.end():]
                return re.sub(r'  <link rel="stylesheet" href="landing-steps.css[^"\n]*">\n', '', text)
            self.assertEqual(strip_allowed(before), strip_allowed(after))
            self.assertEqual((local / 'index.html').read_text(), before)
            self.assertEqual((local / 'app/app.js').read_text(), 'WORKING VPS CABINET')
            self.assertEqual(sorted(p.name for p in (root / 'out').iterdir()), ['index.html', 'landing-steps.css'])

    def test_repeated_update_and_old_css_url_are_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            p = local / 'index.html'
            p.write_text(p.read_text().replace('</head>', '<link rel="stylesheet" href="landing-steps.css?v=STALE">\n</head>'))
            stage.stage(local, REPO, root / 'out')
            stage.stage(root / 'out', REPO, root / 'again')
            self.assertEqual((root / 'out/index.html').read_bytes(), (root / 'again/index.html').read_bytes())
            self.assertEqual((root / 'out/index.html').read_text().count('href="landing-steps.css?'), 1)

    def test_missing_or_duplicate_sections_and_duplicate_asset_are_rejected(self):
        for mutate in [lambda s: s.replace('id="steps"', 'id="OTHER"'),
                       lambda s: s + '<section id="steps"></section>',
                       lambda s: s.replace('</head>', '<link href="landing-steps.css"><link href="landing-steps.css"></head>')]:
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                local = self.fixture(root)
                p = local / 'index.html'
                p.write_text(mutate(p.read_text()))
                with self.assertRaises(ValueError):
                    stage.stage(local, REPO, root / 'out')
                self.assertFalse((root / 'out').exists())

    def test_missing_stylesheet_leaves_served_files_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            incoming = root / 'incoming'
            incoming.mkdir()
            (incoming / 'index.html').write_bytes((REPO / 'index.html').read_bytes())
            before = (local / 'index.html').read_bytes()
            with self.assertRaises(OSError):
                stage.stage(local, incoming, root / 'out')
            self.assertEqual((local / 'index.html').read_bytes(), before)
            self.assertFalse((root / 'out').exists())

if __name__ == '__main__':
    unittest.main()
