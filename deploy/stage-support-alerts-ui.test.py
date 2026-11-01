import importlib.util,json,tempfile,unittest
from pathlib import Path
HERE=Path(__file__).parent;ROOT=HERE.parent
spec=importlib.util.spec_from_file_location('support_stage',HERE/'stage-support-alerts-ui.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SupportUiStageTests(unittest.TestCase):
 def test_exact_patch_preserves_private_site_and_is_idempotent(self):
  manifest=json.loads((HERE/'support-alerts-ui-patches.json').read_text());new=(ROOT/'app/admin-panel.js').read_text();old=new
  for op in reversed(manifest['patches']['app/admin-panel.js']):old=old.replace(op['after'],op['before'],1)
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);local=root/'local';(local/'app').mkdir(parents=True);(local/'app/admin-panel.js').write_text(old+'\n// PRIVATE_CANARY\n')
   html='<meta name="private" content="KEEP"><script nonce="KEEP" src="admin-panel.js?v=old"></script><script src="account-security.js?v=KEEP"></script>'
   (local/'app/index.html').write_text(html);m.stage(local,HERE/'support-alerts-ui-patches.json',root/'out')
   self.assertEqual((root/'out/app/admin-panel.js').read_text(),new+'\n// PRIVATE_CANARY\n');self.assertEqual((root/'out/app/index.html').read_text(),html.replace('admin-panel.js?v=old','admin-panel.js?v='+m.VERSION))
   m.stage(root/'out',HERE/'support-alerts-ui-patches.json',root/'again');self.assertEqual((root/'again/app/admin-panel.js').read_bytes(),(root/'out/app/admin-panel.js').read_bytes())
 def test_unknown_script_or_duplicate_reference_is_rejected(self):
  manifest=json.loads((HERE/'support-alerts-ui-patches.json').read_text())
  with self.assertRaises(ValueError):m.patch('unknown implementation',manifest['patches']['app/admin-panel.js'],'admin-panel.js')
  with self.assertRaises(ValueError):m.cache_versions('<script src="admin-panel.js"></script><script src="admin-panel.js"></script>')
 def test_installer_touches_only_the_panel_and_its_cache_reference(self):
  text=(HERE/'update-support-alerts-ui.sh').read_text();self.assertIn('files=(app/admin-panel.js app/index.html)',text);self.assertNotIn('files=(app/account-security',text);self.assertIn('PREFLIGHT_ONLY',text)
if __name__=='__main__':unittest.main()
