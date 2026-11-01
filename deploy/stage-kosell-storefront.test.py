import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).parents[1]
spec=importlib.util.spec_from_file_location('stage',ROOT/'deploy/stage-kosell-storefront.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class StorefrontStage(unittest.TestCase):
    def test_preserves_other_sections_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);local=root/'local';local.mkdir()
            html='<link href="kosell-rent.css?v=old" rel="stylesheet"><div>LOCAL FEATURE</div><script src="kosell-rent.js?v=old" defer></script><script src="app.js?v=local" defer></script>'
            (local/'index.html').write_text(html);(local/'kosell-rent.js').write_text('function kosellCatalogMarkup(s){}')
            out=root/'out';m.stage(local,ROOT/'app',out)
            result=(out/'index.html').read_text()
            self.assertIn('LOCAL FEATURE',result);self.assertIn('app.js?v=local',result)
            self.assertLess(result.index('kosell-rent.js'),result.index('kosell-storefront.js'))
            self.assertLess(result.index('kosell-storefront.js'),result.index('app.js'))
            (out/'kosell-rent.js').write_text((local/'kosell-rent.js').read_text())
            m.stage(out,ROOT/'app',root/'again')
            self.assertEqual((root/'again/index.html').read_text(),result)
    def test_unknown_layout_is_not_written(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);local=root/'local';local.mkdir();(local/'index.html').write_text('<script src="app.js"></script>');(local/'kosell-rent.js').write_text('function kosellCatalogMarkup(){}')
            with self.assertRaises(ValueError):m.stage(local,ROOT/'app',root/'out')
            self.assertFalse((root/'out').exists())
if __name__=='__main__':unittest.main()
