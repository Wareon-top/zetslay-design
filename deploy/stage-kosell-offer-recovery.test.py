from pathlib import Path
import importlib.util
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage',ROOT/'deploy/stage-kosell-offer-recovery.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTest(unittest.TestCase):
    def fixture(self,root):
        local=root/'local';local.mkdir()
        (local/'kosell-rent.js').write_bytes((ROOT/'app/kosell-rent.js').read_bytes())
        (local/'index.html').write_text('<meta content="https://custom.test"><script src="kosell-rent.js?v=old" defer></script>\n<script src="app.js?v=custom" defer></script>\n<!-- custom finance and profile -->')
        (local/'app.js').write_text('USER CUSTOMIZATION')
        return local
    def test_preserves_custom_cabinet_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);local=self.fixture(root);out=root/'out'
            module.stage(local,ROOT/'app',out)
            self.assertEqual(sorted(p.name for p in out.iterdir()),['index.html','kosell-rent.js'])
            html=(out/'index.html').read_text();self.assertIn('https://custom.test',html);self.assertIn('app.js?v=custom',html);self.assertIn('custom finance and profile',html)
            module.stage(out,ROOT/'app',root/'again');self.assertEqual(html,(root/'again/index.html').read_text())
    def test_unknown_module_leaves_no_staged_output(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);local=self.fixture(root);(local/'kosell-rent.js').write_text('CUSTOM MODULE')
            with self.assertRaises(ValueError):module.stage(local,ROOT/'app',root/'out')
            self.assertFalse((root/'out').exists())
    def test_invalid_asset_order_duplicates_and_conflicts_stop(self):
        for html in ['<script src="app.js" defer></script><script src="kosell-rent.js" defer></script>', '<script src="kosell-rent.js" defer></script>'*2+'<script src="app.js" defer></script>', '<<<<<<< VPS\n<script src="kosell-rent.js" defer></script><script src="app.js" defer></script>']:
            with tempfile.TemporaryDirectory() as temp:
                root=Path(temp);local=self.fixture(root);(local/'index.html').write_text(html)
                with self.assertRaises(ValueError):module.stage(local,ROOT/'app',root/'out')
                self.assertFalse((root/'out').exists())
    def test_legacy_list_is_upgraded_without_replacing_settings_or_other_functions(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);local=self.fixture(root);current=(local/'kosell-rent.js').read_text()
            a=current.index('function kosellOfferDiagnosticsMarkup(');b=current.index('function kosellAutomationFields(')
            current=current[:a]+current[b:];current=current.replace('${kosellOfferDiagnosticsMarkup(j)}',"${j.code?`<p>${escapeHtml(j.code)}</p>`:''}")+'\nfunction customSettings(){return "CUSTOM";}\n'
            import re
            current=re.sub(r'<article><span>Автоматическая выдача</span>.*?</article>',"<article><span>Автоматическая выдача</span><strong>${c.automatic?'Включена':'Выключена'}</strong><small>Автопокупка включается отдельно</small></article>",current,flags=re.S)
            (local/'kosell-rent.js').write_text(current);module.stage(local,ROOT/'app',root/'out')
            updated=(root/'out/kosell-rent.js').read_text();self.assertIn('function customSettings(){return "CUSTOM";}',updated);self.assertEqual(updated.count('function kosellOfferDiagnosticsMarkup('),1)
            self.assertIn('${kosellOfferDiagnosticsMarkup(j)}',updated)
            self.assertIn('MAPPINGS_MISSING',updated);self.assertIn('BASELINE_PENDING',updated);self.assertIn('Готова к новым заказам',updated)
if __name__=='__main__':unittest.main()
