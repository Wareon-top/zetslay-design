import importlib.util
from pathlib import Path
import re
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
spec = importlib.util.spec_from_file_location('stage_pricing', HERE / 'stage-landing-pricing.py')
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)

class PricingStageTests(unittest.TestCase):
    def fixture(self, root):
        local = root / 'local'
        local.mkdir()
        text = (REPO / 'index.html').read_text()
        old = stage.pricing_section(text)
        text = text[:old.start()] + '<section id="tariffs"><h2>VPS OLD TARIFFS</h2></section>' + text[old.end():]
        text = re.sub(r'  <link rel="stylesheet" href="landing-pricing.css[^"\n]*">\n', '', text)
        text = re.sub(r'  <script src="landing-pricing.js[^"\n]*" defer></script>\n', '', text)
        text = text.replace('</body>', '<img src="assets/plugins/MY-COVER.webp" alt="VPS cover"><script>/* VPS AUTH */</script>\n</body>')
        (local / 'index.html').write_text(text)
        (local / 'app').mkdir()
        (local / 'app/app.js').write_text('WORKING CABINET')
        return local

    def test_only_tariffs_and_two_asset_tags_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            before = (local / 'index.html').read_text()
            stage.stage(local, REPO, root / 'out')
            after = (root / 'out/index.html').read_text()
            def strip_allowed(text):
                section=stage.pricing_section(text)
                text=text[:section.start()]+'<TARIFFS>'+text[section.end():]
                text=re.sub(r'  <link rel="stylesheet" href="landing-pricing.css[^"\n]*">\n','',text)
                return re.sub(r'  <script src="landing-pricing.js[^"\n]*" defer></script>\n','',text)
            self.assertEqual(strip_allowed(before),strip_allowed(after))
            self.assertEqual((local/'index.html').read_text(),before)
            self.assertEqual((local/'app/app.js').read_text(),'WORKING CABINET')
            self.assertEqual(sorted(p.name for p in (root/'out').iterdir()),['index.html','landing-pricing.css','landing-pricing.js'])

    def test_repeat_install_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); local=self.fixture(root)
            stage.stage(local,REPO,root/'out')
            stage.stage(root/'out',REPO,root/'again')
            self.assertEqual((root/'out/index.html').read_bytes(),(root/'again/index.html').read_bytes())
            for asset in ('landing-pricing.css','landing-pricing.js'):
                self.assertEqual((root/'out/index.html').read_text().count(asset+'?v='),1)

    def test_duplicate_section_asset_or_missing_section_stops_without_output(self):
        for mutate in [lambda s:s+'<section id="tariffs"></section>',
                       lambda s:s.replace('id="tariffs"','id="OTHER"'),
                       lambda s:s.replace('</head>','<link href="landing-pricing.css"><link href="landing-pricing.css"></head>')]:
            with tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp);local=self.fixture(root)
                p=local/'index.html';p.write_text(mutate(p.read_text()))
                with self.assertRaises(ValueError): stage.stage(local,REPO,root/'out')
                self.assertFalse((root/'out').exists())

    def test_missing_asset_does_not_change_served_site(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);local=self.fixture(root);incoming=root/'incoming';incoming.mkdir()
            (incoming/'index.html').write_bytes((REPO/'index.html').read_bytes())
            (incoming/'landing-pricing.css').write_bytes((REPO/'landing-pricing.css').read_bytes())
            before=(local/'index.html').read_bytes()
            with self.assertRaises(OSError): stage.stage(local,incoming,root/'out')
            self.assertEqual((local/'index.html').read_bytes(),before)
            self.assertFalse((root/'out').exists())

if __name__ == '__main__': unittest.main()
