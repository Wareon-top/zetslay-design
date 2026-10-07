import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
HERE=Path(__file__).resolve().parent;ROOT=HERE.parent
spec=importlib.util.spec_from_file_location('legal_stage',HERE/'stage-legal-ui.py');stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)
class LegalStageTest(unittest.TestCase):
 def fixture(self,tmp):
  local=tmp/'local';(local/'app').mkdir(parents=True)
  (local/'index.html').write_text((ROOT/'index.html').read_text()+'\n<!-- KEEP_LOCAL_LANDING -->')
  (local/'app/index.html').write_text((ROOT/'app/index.html').read_text()+'\n<!-- KEEP_LOCAL_CABINET -->')
  (local/'landing-footer.html').write_text((ROOT/'landing-footer.html').read_text())
  (local/'app/app.js').write_text('// DO_NOT_REPLACE_WORKING_CABINET')
  return local
 def test_preserves_local_work_and_operator_config_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as t:
   tmp=Path(t);local=self.fixture(tmp);before=(local/'index.html').read_bytes();(local/'legal').mkdir();config=json.loads((ROOT/'legal/site-config.json').read_text());config['operatorName']='Локальное имя оператора';(local/'legal/site-config.json').write_text(json.dumps(config,ensure_ascii=False))
   stage.stage(local,ROOT,tmp/'out');stage.stage(tmp/'out',ROOT,tmp/'again')
   for p in (tmp/'out').rglob('*'):
    if p.is_file():self.assertEqual(p.read_bytes(),(tmp/'again'/p.relative_to(tmp/'out')).read_bytes(),str(p))
   self.assertEqual((local/'index.html').read_bytes(),before);self.assertFalse((tmp/'out/app/app.js').exists());self.assertIn('KEEP_LOCAL_CABINET',(tmp/'out/app/index.html').read_text());self.assertIn('Локальное имя оператора',(tmp/'out/legal/index.html').read_text());self.assertIn('Проекты документов',(tmp/'out/legal/index.html').read_text())
   for p in ['index.html','app/index.html']:
    text=(tmp/'out'/p).read_text();self.assertNotIn('fonts.googleapis.com',text);self.assertNotIn('fonts.gstatic.com',text);self.assertEqual(text.count('privacy-controls.js?v='),1);self.assertEqual(text.count('assets/fonts/fonts.css?v='),1)
 def test_unknown_markup_fails_before_output(self):
  with tempfile.TemporaryDirectory() as t:
   tmp=Path(t);local=self.fixture(tmp);(local/'app/index.html').write_text('unknown')
   with self.assertRaises(ValueError):stage.stage(local,ROOT,tmp/'out')
   self.assertFalse((tmp/'out').exists())
 def test_documents_are_printable_separate_and_cannot_be_activated_by_config(self):
  data=json.loads((ROOT/'legal/documents.json').read_text());self.assertEqual(len(data['documents']),7);self.assertNotEqual('processing','offer')
  for d in data['documents']:
   text=(ROOT/'legal'/f'{d["id"]}.html').read_text();self.assertIn('noindex,follow',text);self.assertIn('data-legal-print',text);self.assertIn('не вступили в силу',text);self.assertNotIn('mailto:',text);self.assertGreater(len(d['sections']),2)
  with tempfile.TemporaryDirectory() as t:
   tmp=Path(t);local=self.fixture(tmp);(local/'legal').mkdir();config=json.loads((ROOT/'legal/site-config.json').read_text());config['status']='active';(local/'legal/site-config.json').write_text(json.dumps(config))
   with self.assertRaises(AssertionError):stage.stage(local,ROOT,tmp/'out')
if __name__=='__main__':unittest.main()
