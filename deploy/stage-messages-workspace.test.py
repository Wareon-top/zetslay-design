import importlib.util,tempfile,unittest,re
from pathlib import Path
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-messages-workspace.py'));mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
ROOT=Path(__file__).resolve().parents[1]
class StageTest(unittest.TestCase):
 def test_preserves_cabinet_customizations_and_updates_only_messages(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);local=root/'local';out=root/'out';local.mkdir()
   html=(ROOT/'app/index.html').read_text().replace('https://api.zetslay.pro','https://custom.example').replace('</body>','<!-- CUSTOM -->\n</body>');source=(ROOT/'app/app.js').read_text()+'\n// CUSTOM APP\n';(local/'index.html').write_text(html);(local/'app.js').write_text(source)
   mod.stage(local,ROOT/'app',out);result=(out/'index.html').read_text();self.assertIn('https://custom.example',result);self.assertIn('<!-- CUSTOM -->',result);self.assertEqual((local/'app.js').read_text(),source);self.assertFalse((out/'app.js').exists())
   self.assertLess(result.index('src="messages.js'),result.index('src="app.js'));self.assertGreater(result.index('src="messages-actions.js'),result.index('src="app.js'));self.assertEqual(result.count('src="messages-actions.js'),1)
   self.assertIn('managed-proxy-ui.js',result);self.assertIn('data-messages-compose',result)
   (out/'app.js').write_text(source);second=root/'second';mod.stage(out,ROOT/'app',second);self.assertEqual((second/'index.html').read_text().count('src="messages-actions.js'),1)
 def test_unknown_structure_is_rejected_before_writing(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'index.html').write_text('<head></head><body></body>');(root/'app.js').write_text('CUSTOM');
   with self.assertRaises(ValueError):mod.stage(root,ROOT/'app',root/'out')
   self.assertFalse((root/'out').exists())
if __name__=='__main__':unittest.main()
