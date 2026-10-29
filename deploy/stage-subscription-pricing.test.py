from pathlib import Path
import importlib.util
import shutil
import tempfile
import unittest
import re
import copy
import json

spec=importlib.util.spec_from_file_location('pricing_stage',Path(__file__).with_name('stage-subscription-pricing.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
ROOT=Path(__file__).resolve().parent.parent

class StageTests(unittest.TestCase):
    def test_catalog_rejects_any_full_period_above_provider_limit(self):
        catalog=json.loads((ROOT/'subscription-plans.json').read_text())
        module.builder.validate(catalog)
        excessive=copy.deepcopy(catalog)
        excessive['plans'][-1]['monthlyRub']=1100
        with self.assertRaisesRegex(AssertionError,'лимит'):
            module.builder.validate(excessive)
        for invalid in (1000001,0,'1000000'):
            altered=copy.deepcopy(catalog);altered['maxTransactionKopecks']=invalid
            with self.assertRaises(AssertionError):module.builder.validate(altered)
    def fixture(self,tmp):
        local=Path(tmp)/'live';(local/'app').mkdir(parents=True)
        for name in ('index.html','app/index.html','app/billing.js'):
            (local/name).write_text((ROOT/name).read_text())
        page=local/'index.html';page.write_text(page.read_text().replace('</body>','<p>LOCAL HERO AND COVERS</p></body>'))
        page=local/'app/index.html';page.write_text(page.read_text().replace('</body>','<p>LOCAL DASHBOARD AND PLUGINS</p></body>'))
        page=local/'app/billing.js';page.write_text(page.read_text().replace("title = 'Пополнить баланс';","title = 'LOCAL TOPUP FLOW';"))
        (local/'app/plugin-cover.js').write_text('LOCAL ADMIN UPLOAD')
        return local
    def test_preserves_live_sections_payment_logic_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);live=self.fixture(tmp);before=(live/'app/billing.js').read_text();module.stage(live,ROOT,root/'out')
            self.assertIn('LOCAL HERO AND COVERS',(root/'out/index.html').read_text())
            self.assertIn('LOCAL DASHBOARD AND PLUGINS',(root/'out/app/index.html').read_text())
            self.assertIn('LOCAL TOPUP FLOW',(root/'out/app/billing.js').read_text())
            self.assertEqual((live/'app/billing.js').read_text(),before)
            self.assertEqual((live/'app/plugin-cover.js').read_text(),'LOCAL ADMIN UPLOAD')
            self.assertFalse((root/'out/app/plugin-cover.js').exists())
            module.stage(root/'out',ROOT,root/'again')
            for p in (root/'out').rglob('*'):
                if p.is_file():self.assertEqual(p.read_bytes(),(root/'again'/p.relative_to(root/'out')).read_bytes())
    def test_unknown_dialog_or_duplicate_prices_stop_before_publication(self):
        for target in ('dialog','tariffs'):
            with tempfile.TemporaryDirectory() as tmp:
                live=self.fixture(tmp);out=Path(tmp)/'out'
                if target=='dialog':(live/'app/billing.js').write_text('unknown payment flow')
                else:
                    p=live/'index.html';p.write_text(p.read_text()+'<section id="tariffs"></section>')
                with self.assertRaises(ValueError):module.stage(live,ROOT,out)
                self.assertFalse(out.exists())

if __name__=='__main__':unittest.main()
