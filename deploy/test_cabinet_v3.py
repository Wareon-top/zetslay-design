import unittest,importlib.util,tempfile,json,hashlib,os,stat
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('cabinet_release',Path(__file__).with_name('update-cabinet-v3.py'))
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class InstallerTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='zs-cabinet-test-');self.addCleanup(self.tmp.cleanup)
  self.base=Path(self.tmp.name);self.source=self.base/'source';self.site=self.base/'site';self.backups=self.base/'backups'
  (self.source/'deploy').mkdir(parents=True);(self.source/'app/cabinet-v3').mkdir(parents=True);(self.site/'app').mkdir(parents=True)
  self.original=b'<!doctype html><head><title>custom live page</title></head><body>preserve forms and custom scripts</body>'
  (self.site/'app/index.html').write_bytes(self.original)
  host={}
  for name in ['app.js','workspace-upgrade.js','workspace-upgrade.css','event-center.css','basic-automation.css','basic-automation.js']:
   data=('existing host '+name).encode();(self.site/'app'/name).write_bytes(data);host['app/'+name]=[mod.sha(data)]
  self.files=[]
  for name in ['production.js','production.css']:
   data=('new presentation '+name).encode();p=self.source/'app/cabinet-v3'/name;p.write_bytes(data)
   self.files.append({'path':'app/cabinet-v3/'+name,'sha256':mod.sha(data)})
  (self.source/'deploy/cabinet-v3-manifest.json').write_text(json.dumps({'host':host,'files':self.files}))
 def publish(self,**kwargs):return mod.publish(self.source,self.site,self.backups,**kwargs)
 def test_preflight_readonly(self):
  self.assertTrue(self.publish(preflight_only=True)['preflight']);self.assertEqual((self.site/'app/index.html').read_bytes(),self.original);self.assertFalse((self.site/'app/cabinet-v3').exists())
 def test_preserves_live_page_and_host(self):
  self.publish();text=(self.site/'app/index.html').read_text();self.assertIn('preserve forms and custom scripts',text);self.assertIn('custom live page',text)
  self.assertEqual((self.site/'app/app.js').read_bytes(),b'existing host app.js')
 def test_idempotent(self):
  self.publish();first=(self.site/'app/index.html').read_bytes();self.publish();self.assertEqual((self.site/'app/index.html').read_bytes(),first)
 def test_unknown_host_stops_without_changes(self):
  (self.site/'app/app.js').write_text('new server fixes')
  with self.assertRaises(ValueError):self.publish()
  self.assertEqual((self.site/'app/index.html').read_bytes(),self.original)
 def test_unknown_bundle_is_preserved(self):
  p=self.site/'app/cabinet-v3';p.mkdir();(p/'production.js').write_text('custom UI')
  with self.assertRaises(ValueError):self.publish()
  self.assertEqual((p/'production.js').read_text(),'custom UI')
 def test_broken_package_stops(self):
  (self.source/'app/cabinet-v3/production.js').write_text('modified package')
  with self.assertRaises(ValueError):self.publish()
 def test_http_failure_rolls_back(self):
  with patch.object(mod.urllib.request,'urlopen',side_effect=OSError('network failure')):
   with self.assertRaises(OSError):self.publish(verify_url='https://example.invalid')
  self.assertEqual((self.site/'app/index.html').read_bytes(),self.original);self.assertFalse((self.site/'app/cabinet-v3/production.js').exists())
 def test_explicit_rollback_preserves_open_tab_assets(self):
  info=self.publish();mod.rollback(self.site,Path(info['backup']));self.assertEqual((self.site/'app/index.html').read_bytes(),self.original);self.assertTrue((self.site/'app/cabinet-v3/production.js').exists())
 def test_rollback_refuses_later_live_edit(self):
  info=self.publish();(self.site/'app/index.html').write_text('later edit')
  with self.assertRaises(ValueError):mod.rollback(self.site,Path(info['backup']))
  self.assertEqual((self.site/'app/index.html').read_text(),'later edit')
 def test_ambiguous_or_unmanaged_includes_refused(self):
  for text in ['<head></head><body>cabinet-v3/</body>','<head></head><head></head><body></body>']:
   with self.assertRaises(ValueError):mod.includes(text)
 def test_existing_modules_are_not_loaded_twice(self):
  source='<head><link href="workspace-upgrade.css?v=old"><link href="event-center.css?v=old"><link href="basic-automation.css?v=old"></head><body><script src="workspace-upgrade.js?v=old"></script><script src="basic-automation.js?v=old"></script></body>'
  result=mod.includes(source)
  self.assertEqual(result.count('src="workspace-upgrade.js'),1);self.assertEqual(result.count('src="basic-automation.js'),1)
 @unittest.skipIf(os.name=='nt','POSIX permissions are tested on VPS/Linux')
 def test_assets_readable_with_private_umask(self):
  old=os.umask(0o077)
  try:self.publish()
  finally:os.umask(old)
  self.assertEqual(stat.S_IMODE((self.site/'app/cabinet-v3').stat().st_mode),0o755)
  self.assertEqual(stat.S_IMODE((self.site/'app/cabinet-v3/production.js').stat().st_mode),0o644)
if __name__=='__main__':unittest.main()
