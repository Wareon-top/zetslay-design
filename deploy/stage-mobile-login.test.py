import importlib.util,json,tempfile,unittest
from pathlib import Path
HERE=Path(__file__).parent;ROOT=HERE.parent
spec=importlib.util.spec_from_file_location('mobile_stage',HERE/'stage-mobile-login.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
manifest=json.loads((HERE/'mobile-login-patches.json').read_text())
class MobileLoginStageTests(unittest.TestCase):
 def fixture(self,root):
  local=root/'local';(local/'app').mkdir(parents=True)
  for name,ops in manifest['patches'].items():
   text=(ROOT/name).read_text()
   for op in reversed(ops):text=text.replace(op['after'],op['before'],1)
   (local/name).write_text(text+'\n// PRIVATE_RUNTIME_CANARY\n' if name.endswith('.js') else text)
  html='<!doctype html>\r\n<meta name="private" content="KEEP">\r\n<link rel="stylesheet" href="passkeys.css?v=old" nonce="private-nonce">\r\n<script src="account-security.js?v=old" defer nonce="private-nonce"></script>\r\n<script src="app.js?v=KEEP" defer></script>\r\n'
  (local/'app/index.html').write_bytes(html.encode());return local,html
 def test_patch_matches_new_source_and_keeps_private_html_and_js(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);local,html=self.fixture(root);out=root/'out';m.stage(local,HERE/'mobile-login-patches.json',out)
   self.assertEqual((out/'app/account-security.js').read_text(),(ROOT/'app/account-security.js').read_text()+'\n// PRIVATE_RUNTIME_CANARY\n')
   self.assertEqual((out/'app/passkeys.css').read_bytes(),(ROOT/'app/passkeys.css').read_bytes())
   self.assertEqual((out/'app/index.html').read_bytes().decode(),html.replace('?v=old','?v='+m.VERSION))
   m.stage(out,HERE/'mobile-login-patches.json',root/'again')
   for name in ['app/account-security.js','app/passkeys.css','app/index.html']:self.assertEqual((root/'again'/name).read_bytes(),(out/name).read_bytes())
 def test_unknown_script_or_duplicate_html_reference_stops_without_touching_site(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);local,html=self.fixture(root);original=(local/'app/account-security.js').read_bytes()
   (local/'app/account-security.js').write_text('unknown implementation')
   with self.assertRaises(ValueError):m.stage(local,HERE/'mobile-login-patches.json',root/'out')
   self.assertEqual((local/'app/account-security.js').read_text(),'unknown implementation')
   (local/'app/account-security.js').write_bytes(original);(local/'app/index.html').write_text(html+'<script src="account-security.js"></script>')
   with self.assertRaises(ValueError):m.stage(local,HERE/'mobile-login-patches.json',root/'out')
   self.assertEqual((local/'app/account-security.js').read_bytes(),original)
 def test_cache_versions_do_not_change_other_assets_or_private_nonce(self):
  html='<link href="./passkeys.css"><script nonce="KEEP" src="./account-security.js"></script><script src="app.js?v=PRIVATE"></script>'
  result=m.cache_versions(html);self.assertIn('nonce="KEEP"',result);self.assertIn('app.js?v=PRIVATE',result);self.assertEqual(result.count(m.VERSION),2)
 def test_installer_is_limited_to_three_files_and_does_not_change_api_or_2fa(self):
  text=(HERE/'update-mobile-login.sh').read_text()
  self.assertIn('files=(app/passkeys.css app/account-security.js app/index.html)',text);self.assertIn('VERIFY',text)
  for forbidden in ['docker restart','docker compose','DATABASE_URL','UPDATE account_security','MFA_REQUIRED=false']:self.assertNotIn(forbidden,text)
if __name__=='__main__':unittest.main()
