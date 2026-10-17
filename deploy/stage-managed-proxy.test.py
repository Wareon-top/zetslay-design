import importlib.util,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-managed-proxy.py'));mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class StageTest(unittest.TestCase):
 def test_preserves_custom_cabinet_and_adds_only_managed_assets(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);local=root/'local';incoming=root/'in';out=root/'out';local.mkdir();incoming.mkdir()
   original='<head><!-- custom --></head><body>PRIVATE-CUSTOM<script src="profile.js"></script><script src="admin-panel.js"></script><script src="connection-wizard-ui.js"></script></body>'
   (local/'index.html').write_text(original);(local/'app.js').write_text('CUSTOM-JS')
   for asset in mod.ASSETS:(incoming/asset).write_text('NEW '+asset)
   mod.stage(local,incoming,out);html=(out/'index.html').read_text();self.assertIn('PRIVATE-CUSTOM',html);self.assertIn('<!-- custom -->',html);self.assertEqual((local/'app.js').read_text(),'CUSTOM-JS');self.assertFalse((out/'app.js').exists())
   self.assertEqual(html.count('managed-proxy-ui.js'),1);self.assertGreater(html.index('managed-proxy-ui.js'),html.index('connection-wizard-ui.js'))
   second=root/'second';mod.stage(out,incoming,second);self.assertEqual((second/'index.html').read_text().count('managed-proxy-ui.js'),1)
 def test_rejects_unconfirmed_structure_without_writing(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'index.html').write_text('<head></head><body></body>')
   with self.assertRaises(ValueError):mod.stage(root,root,root/'out')
   self.assertFalse((root/'out').exists())
if __name__=='__main__':unittest.main()
