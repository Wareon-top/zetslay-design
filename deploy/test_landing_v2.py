import unittest, importlib.util, tempfile, json, os, stat
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('landing_v2',Path(__file__).with_name('update-landing-v2.py'))
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class LandingInstallerTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='zs-landing-test-');self.addCleanup(self.temp.cleanup)
  self.root=Path(self.temp.name);self.source=self.root/'release';self.site=self.root/'site';self.backup=self.root/'backup'
  (self.source/'deploy').mkdir(parents=True);self.site.mkdir()
  self.before=b'<!doctype html><title>Existing public landing</title>'
  (self.site/'index.html').write_bytes(self.before);(self.site/'session-client.js').write_bytes(b'actual auth client')
  (self.site/'app').mkdir();(self.site/'app/index.html').write_bytes(b'private cabinet untouched')
  (self.site/'legal').mkdir();(self.site/'legal/offer.html').write_bytes(b'current terms untouched')
  entries=[]
  for rel in sorted(mod.FIXED|{'assets/landing-v2/hq-20261114/test.webp'}):
   data=('new runtime '+rel).encode();p=self.source/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
   entries.append({'path':rel,'sha256':mod.sha(data),'allowedBefore':[mod.sha(self.before)] if rel=='index.html' else []})
  self.manifest={'release':mod.RELEASE,'files':entries,'dependencies':[{'path':'session-client.js','allowedSha256':[mod.sha(b'actual auth client')]}]}
  self.save_manifest()
 def save_manifest(self):
  (self.source/'deploy/landing-v2-manifest.json').write_text(json.dumps(self.manifest))
 def publish(self,**kwargs):return mod.publish(self.source,self.site,self.backup,**kwargs)
 def test_preflight_is_readonly(self):
  self.assertTrue(self.publish(preflight_only=True)['preflight']);self.assertFalse(self.backup.exists());self.assertFalse((self.site/'landing-v2.js').exists())
 def test_only_public_runtime_changed(self):
  self.publish();self.assertEqual((self.site/'app/index.html').read_bytes(),b'private cabinet untouched');self.assertEqual((self.site/'legal/offer.html').read_bytes(),b'current terms untouched');self.assertEqual((self.site/'session-client.js').read_bytes(),b'actual auth client')
 def test_second_install_is_idempotent(self):
  self.publish();state=(self.site/'index.html').read_bytes();self.publish();self.assertEqual((self.site/'index.html').read_bytes(),state)
 def test_unknown_page_preserved(self):
  (self.site/'index.html').write_bytes(b'newer custom landing')
  with self.assertRaises(ValueError):self.publish()
  self.assertEqual((self.site/'index.html').read_bytes(),b'newer custom landing');self.assertFalse(self.backup.exists())
 def test_unknown_auth_client_preserved(self):
  (self.site/'session-client.js').write_bytes(b'newer auth fix')
  with self.assertRaises(ValueError):self.publish()
  self.assertEqual((self.site/'index.html').read_bytes(),self.before)
 def test_text_dependency_crlf_is_accepted_without_rewriting_it(self):
  (self.site/'platform.svg').write_bytes(b'<svg>\r\n</svg>\r\n')
  self.manifest['dependencies'].append({'path':'platform.svg','allowedSha256':[mod.sha(b'<svg>\n</svg>\n')]});self.save_manifest()
  self.publish();self.assertEqual((self.site/'platform.svg').read_bytes(),b'<svg>\r\n</svg>\r\n')
 def test_existing_unknown_asset_preserved(self):
  (self.site/'landing-v2.css').write_bytes(b'custom CSS')
  with self.assertRaises(ValueError):self.publish()
  self.assertEqual((self.site/'landing-v2.css').read_bytes(),b'custom CSS')
 def test_corrupt_distribution_refused(self):
  (self.source/'landing-v2.js').write_bytes(b'broken')
  with self.assertRaises(ValueError):self.publish()
  self.assertEqual((self.site/'index.html').read_bytes(),self.before)
 def test_http_failure_rolls_back(self):
  with patch.object(mod.urllib.request,'urlopen',side_effect=OSError('HTTP unavailable')):
   with self.assertRaises(OSError):self.publish(verify_url='https://example.invalid')
  self.assertEqual((self.site/'index.html').read_bytes(),self.before);self.assertFalse((self.site/'landing-v2.css').exists())
 def test_manual_rollback_keeps_assets_for_open_tabs(self):
  result=self.publish();mod.rollback(self.site,Path(result['backup']));self.assertEqual((self.site/'index.html').read_bytes(),self.before);self.assertTrue((self.site/'landing-v2.js').is_file())
 def test_rollback_does_not_erase_later_edits(self):
  result=self.publish();(self.site/'index.html').write_bytes(b'edited after release')
  with self.assertRaises(ValueError):mod.rollback(self.site,Path(result['backup']))
  self.assertEqual((self.site/'index.html').read_bytes(),b'edited after release')
 def test_manifest_cannot_write_cabinet(self):
  self.manifest['files'][0]['path']='app/index.html';self.save_manifest()
  with self.assertRaises(ValueError):self.publish()
  self.assertEqual((self.site/'app/index.html').read_bytes(),b'private cabinet untouched')
 @unittest.skipIf(os.name=='nt','POSIX permissions require Linux')
 def test_private_backup_public_assets_with_umask_077(self):
  previous=os.umask(0o077)
  try:result=self.publish()
  finally:os.umask(previous)
  self.assertEqual(stat.S_IMODE((self.site/'landing-v2.css').stat().st_mode),0o644);self.assertEqual(stat.S_IMODE((self.site/'assets/landing-v2').stat().st_mode),0o755);self.assertEqual(stat.S_IMODE(Path(result['backup']).stat().st_mode),0o700)

if __name__=='__main__':unittest.main()
