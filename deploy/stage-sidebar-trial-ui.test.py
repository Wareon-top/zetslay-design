import importlib.util
from pathlib import Path
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('trial_stage',ROOT/'deploy/stage-sidebar-trial-ui.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.local=Path(self.temp.name)/'local';self.local.mkdir();self.out=self.local.parent/'out'
        for name in ['index.html','billing.js','admin-panel.js']:(self.local/name).write_bytes((ROOT/'app'/name).read_bytes())
    def test_replaces_old_support_preserves_other_sections_and_is_idempotent(self):
        html=(self.local/'index.html').read_text();a,b=module.card_span(html);old='<div class="support-card"><div><strong>Поддержка</strong></div><button>Написать</button></div>'
        html=html[:a]+old+html[b:];html=html.replace('</head>','<meta name="api-custom" content="keep">\n</head>')+'\n<!-- custom feature -->';(self.local/'index.html').write_text(html)
        (self.local/'billing.js').write_text((self.local/'billing.js').read_text().replace(", trial_3d:'Пробный доступ · 3 дня'",''))
        (self.local/'admin-panel.js').write_text((self.local/'admin-panel.js').read_text().replace(",trial_3d:'Пробный · 3 дня'",'').replace(",['trial_3d','Пробный · 3 дня']",''))
        module.stage(self.local,ROOT/'app',self.out);result=(self.out/'index.html').read_text()
        self.assertNotIn('class="support-card"',result);self.assertIn('api-custom',result);self.assertIn('custom feature',result);self.assertIn('data-knowledge-base',result);self.assertIn('overview-period-toolbar',result)
        self.assertIn("trial_3d:",(self.out/'billing.js').read_text());self.assertIn("['trial_3d'",(self.out/'admin-panel.js').read_text())
        again=self.local.parent/'again';module.stage(self.out,ROOT/'app',again)
        for name in ['index.html','billing.js','admin-panel.js']:self.assertEqual((self.out/name).read_bytes(),(again/name).read_bytes())
    def test_missing_or_duplicate_card_does_not_write(self):
        for text in ['<head></head><body></body>','<head></head><body><div class="support-card"></div><aside data-sidebar-trial></aside></body>']:
            (self.local/'index.html').write_text(text)
            with self.assertRaises(ValueError):module.stage(self.local,ROOT/'app',self.out)
            self.assertFalse(self.out.exists())
if __name__=='__main__':unittest.main()
