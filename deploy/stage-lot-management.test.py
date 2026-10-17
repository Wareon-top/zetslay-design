from pathlib import Path
import importlib.util
import tempfile
import shutil
import re
import unittest
BASE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-lot-management.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class Tests(unittest.TestCase):
    def fixture(self,root):
        site=root/'site';(site/'app').mkdir(parents=True)
        for name in ['index.html','lots.js']:shutil.copy2(BASE/'app'/name,site/'app'/name)
        return site
    def test_preserves_live_changes_and_repeated_update(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);site=self.fixture(root)
            p=site/'app/lots.js';p.write_text(p.read_text()+'\n// OWNED_INVENTORY_FILTER\n')
            p=site/'app/index.html';p.write_text(p.read_text().replace('data-lot-operations','data-old-operations',1));p.write_text(re.sub(r'<section class="lot-operations" data-old-operations[^>]*></section>','',p.read_text()))
            out=root/'out';module.stage(site,BASE,out)
            self.assertIn('OWNED_INVENTORY_FILTER',(out/'app/lots.js').read_text())
            self.assertIn('../session-client.js',(out/'app/index.html').read_text())
            self.assertEqual((out/'app/index.html').read_text().count('data-lot-operations'),1)
            again=root/'again';module.stage(out,BASE,again)
            self.assertEqual((again/'app/index.html').read_text().count('src="lot-management.js?'),1)
    def test_unknown_inventory_shape_never_replaces_the_site(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);site=self.fixture(root);p=site/'app/lots.js';p.write_text(p.read_text().replace('function lotRowsMarkup(','function customRows('));before=p.read_text()
            with self.assertRaises(ValueError):module.stage(site,BASE,root/'out')
            self.assertEqual(p.read_text(),before);self.assertFalse((root/'out').exists())
if __name__=='__main__':unittest.main()
