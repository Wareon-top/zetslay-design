import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
HERE=Path(__file__).resolve().parent;ROOT=HERE.parent
spec=importlib.util.spec_from_file_location('legal_stage',HERE/'stage-legal-ui.py');stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)
class LegalStageTest(unittest.TestCase):
 def test_support_contact_updates_legacy_config_without_replacing_local_operator_facts(self):
  with tempfile.TemporaryDirectory() as t:
   tmp=Path(t);local=self.fixture(tmp);(local/'legal').mkdir()
   config=json.loads((ROOT/'legal/site-config.json').read_text());config.pop('legalTelegram');config['postalAddress']='LOCAL POSTAL ADDRESS';config['providers']=['LOCAL PROVIDER']
   (local/'legal/site-config.json').write_text(json.dumps(config))
   stage.stage(local,ROOT,tmp/'out')
   result=json.loads((tmp/'out/legal/site-config.json').read_text())
   self.assertEqual(result['postalAddress'],'LOCAL POSTAL ADDRESS');self.assertEqual(result['providers'],['LOCAL PROVIDER']);self.assertEqual(result['legalTelegram'],'@zetslaysupport')
   for path in ['index.html','landing-footer.html','legal/index.html','legal/offer.html','legal/privacy.html','legal/refunds.html','app/legal-cabinet.js']:
    text=(tmp/'out'/path).read_text();self.assertIn('https://t.me/zetslaysupport',text)
    self.assertNotIn('{{legalTelegram}}',text)
   text=(tmp/'out/legal/index.html').read_text();self.assertNotIn('Внешний юридический контакт ещё не заполнен',text);self.assertNotIn('внешний контакт ещё нужно указать',text)
 def test_support_contact_rejects_untrusted_urls_and_markup(self):
  spec=importlib.util.spec_from_file_location('legal_builder',HERE/'build-legal-pages.py');builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
  for value in ['https://evil.test','@abc\"><script>alert(1)</script>','@a/b','@a']:
   with self.assertRaises(ValueError):builder.support_contact({'legalTelegram':value})
  self.assertEqual(builder.support_contact({'legalTelegram':''}),'')
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
  data=json.loads((ROOT/'legal/documents.json').read_text());self.assertEqual(len(data['documents']),9);self.assertNotEqual('processing','offer')
  for d in data['documents']:
   text=(ROOT/'legal'/f'{d["id"]}.html').read_text();self.assertIn('noindex,follow',text);self.assertIn('data-legal-print',text);self.assertIn('не вступили в силу',text);self.assertNotIn('mailto:',text);self.assertGreater(len(d['sections']),2)
  with tempfile.TemporaryDirectory() as t:
   tmp=Path(t);local=self.fixture(tmp);(local/'legal').mkdir();config=json.loads((ROOT/'legal/site-config.json').read_text());config['status']='active';(local/'legal/site-config.json').write_text(json.dumps(config))
   with self.assertRaises(AssertionError):stage.stage(local,ROOT,tmp/'out')
 def test_tables_escape_content_and_malformed_rows_are_rejected(self):
  spec=importlib.util.spec_from_file_location('legal_builder',HERE/'build-legal-pages.py');builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
  with tempfile.TemporaryDirectory() as t:
   tmp=Path(t);shutil.copy2(ROOT/'legal/site-config.json',tmp/'site-config.json');data=json.loads((ROOT/'legal/documents.json').read_text())
   target=data['documents'][1]['sections'][1]['table'];target['rows'][0][0]='<img src=x onerror=alert(1)>';target['headers'][0]='<script>bad</script>'
   (tmp/'documents.json').write_text(json.dumps(data));builder.build(tmp);html=(tmp/'privacy.html').read_text()
   self.assertIn('&lt;img',html);self.assertIn('&lt;script&gt;bad',html);self.assertNotIn('<img src=x',html);self.assertIn('scope="col"',html);self.assertIn('tabindex="0"',html)
   target['rows'][0].append('unexpected');(tmp/'documents.json').write_text(json.dumps(data))
   with self.assertRaises(AssertionError):builder.build(tmp)
if __name__=='__main__':unittest.main()
