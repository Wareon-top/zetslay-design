import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
HERE=Path(__file__).resolve().parent;ROOT=HERE.parent
spec=importlib.util.spec_from_file_location('stage_operator',HERE/'stage-operator-details.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class OperatorUpdateTest(unittest.TestCase):
    def fixture(self,path):
        path.mkdir();(path/'legal').mkdir()
        (path/'index.html').write_text('<main>KEEP_LOCAL</main><footer><span>Existing links</span></footer>')
        config=json.loads((ROOT/'legal/site-config.json').read_text());config.update(operatorName='',inn='',legalEmail='existing@example.test',postalAddress='KEEP_ADDRESS',providers=['KEEP_PROVIDER'])
        (path/'legal/site-config.json').write_text(json.dumps(config));return path
    def test_only_identity_changes_and_repeat_is_stable(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);local=self.fixture(root/'local');before=(local/'index.html').read_bytes()
            module.stage(local,ROOT,root/'out');module.stage(root/'out',ROOT,root/'again')
            self.assertEqual(before,(local/'index.html').read_bytes())
            for p in (root/'out').rglob('*'):
                if p.is_file():self.assertEqual(p.read_bytes(),(root/'again'/p.relative_to(root/'out')).read_bytes())
            c=json.loads((root/'out/legal/site-config.json').read_text());self.assertEqual(c['legalEmail'],'existing@example.test');self.assertEqual(c['postalAddress'],'KEEP_ADDRESS');self.assertEqual(c['providers'],['KEEP_PROVIDER']);self.assertEqual(c['inn'],'026416567354')
            self.assertIn('KEEP_LOCAL',(root/'out/index.html').read_text());self.assertEqual((root/'out/index.html').read_text().count('data-operator-requisites'),1)
            self.assertFalse((root/'out/app').exists());self.assertEqual(c['status'],'draft');self.assertFalse(c['approved'])
    def test_unknown_local_document_changes_abort_without_output(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);local=self.fixture(root/'local');(local/'legal/documents.json').write_text('{"local":true}')
            with self.assertRaises(ValueError):module.stage(local,ROOT,root/'out')
            self.assertFalse((root/'out').exists())
    def test_unknown_footer_aborts_without_output(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);local=self.fixture(root/'local');(local/'index.html').write_text('unknown')
            with self.assertRaises(ValueError):module.stage(local,ROOT,root/'out')
            self.assertFalse((root/'out').exists())
if __name__=='__main__':unittest.main()
