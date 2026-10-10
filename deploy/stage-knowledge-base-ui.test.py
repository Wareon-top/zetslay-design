import importlib.util
from pathlib import Path
import tempfile
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('kb_stage',ROOT/'deploy/stage-knowledge-base-ui.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class StagingTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.local=Path(self.temp.name)/'local';self.local.mkdir()
        self.out=Path(self.temp.name)/'out'
        for name in ('app.js','plugin-rarity.js'):(self.local/name).write_bytes((ROOT/'app'/name).read_bytes())
        html=(ROOT/'app/index.html').read_text();a,b=module.view_span(html)
        html=html[:a]+'<section class="view" data-view="guide"><section>Old instructions</section></section>'+html[b:]
        html=html.replace('</head>','<meta name="local-api" content="preserve">\n</head>')+'\n<!-- local billing customisation -->'
        (self.local/'index.html').write_text(html)

    def test_preserve_unrelated_layout_and_update_twice(self):
        module.stage(self.local,ROOT/'app',self.out)
        html=(self.out/'index.html').read_text()
        self.assertIn('local-api',html);self.assertIn('local billing customisation',html)
        self.assertIn('overview-period-toolbar',html);self.assertIn('plugin-purchase-options.js',html)
        self.assertIn('data-knowledge-base',html);self.assertNotIn('Old instructions',html)
        def unrelated(text):
            a,b=module.view_span(text)
            text=text[:a]+'<GUIDE>'+text[b:]
            text=re.sub(r'^[ \t]*<(?:link|script)\b[^\n]*(?:href|src)="knowledge-base\.(?:css|js)(?:\?[^"\n]*)?"[^\n]*>(?:</script>)?\n?', '', text, flags=re.M)
            return text.replace('  </head>', '</head>')
        self.assertEqual(unrelated((self.local/'index.html').read_text()),unrelated(html))
        # Stage fixtures include only the unchanged rarity map, never a cabinet controller.
        (self.out/'app.js').write_bytes((self.local/'app.js').read_bytes())
        again=self.out.parent/'again';module.stage(self.out,ROOT/'app',again)
        self.assertEqual(html,(again/'index.html').read_text())
        self.assertEqual((self.local/'app.js').read_bytes(),(ROOT/'app/app.js').read_bytes())

    def test_missing_or_duplicate_view_stops_before_writing(self):
        for html in ('<html><head></head><body></body></html>','<head></head><body><section data-view="guide"></section><section data-view="guide"></section></body>'):
            (self.local/'index.html').write_text(html)
            with self.assertRaises(ValueError):module.stage(self.local,ROOT/'app',self.out)
            self.assertFalse(self.out.exists())

if __name__=='__main__':unittest.main()
