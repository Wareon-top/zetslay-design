from pathlib import Path
import importlib.util
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-store-sync-deadline.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTest(unittest.TestCase):
 def local(self,root):
  local=root/'local';local.mkdir()
  for name in ['index.html','app.js','overview.js']:
   text=(ROOT/'app'/name).read_text().replace('https://api.zetslay.pro','https://preserved.test')
   if name!='index.html':text+='\n// LOCAL CONFIG TO PRESERVE\n'
   (local/name).write_text(text)
  return local
 def test_preserves_live_configuration_patches_only_sync_and_changes_cache_keys(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);local=self.local(root)
   module.stage(local,ROOT/'app',root/'out');html=(root/'out/index.html').read_text();self.assertIn('https://preserved.test',html)
   self.assertEqual(html.count('src="store-sync-deadline.js'),1)
   self.assertLess(html.index('src="subscription-access.js'),html.index('src="store-sync-deadline.js'))
   for name in ['app.js','overview.js']:
    self.assertIn('// LOCAL CONFIG TO PRESERVE',(root/'out'/name).read_text())
    self.assertIn(name+'?v=20261011-sync-pipeline-v2',html)
   module.stage(root/'out',ROOT/'app',root/'again')
   for name in ['app.js','overview.js']:
    self.assertEqual((root/'out'/name).read_text(),(root/'again'/name).read_text())
 def test_upgrades_legacy_shared_flight_without_replacing_local_settings(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);local=self.local(root)
   current=(local/'app.js').read_text()
   legacy="""// Share one read request between cabinet views within the same account session.
let storeContentSyncFlight = null;
function syncStoreContent(options = {}) {
  const generation = sessionGeneration;
  if (storeContentSyncFlight?.generation === generation) return storeContentSyncFlight.promise;
  const promise = readStoreContent(options);
  const flight = { generation, promise };
  storeContentSyncFlight = flight;
  const release = () => { if (storeContentSyncFlight === flight) storeContentSyncFlight = null; };
  promise.then(release, release);
  return promise;
}
async function readStoreContent({ silent = false } = {}) {
  await apiRequest('/api/v1/funpay/content', {authenticated:true});
}
function renderTelegramOnboarding"""
   a,b=module.block(current,'// Share one read request','function renderTelegramOnboarding');c,d=module.block(legacy,'// Share one read request','function renderTelegramOnboarding')
   patched=current[:a]+legacy[c:d]+current[b:]
   patched=patched.replace('authenticated = false, signal } = {}) {','authenticated = false } = {}) {',1).replace('JSON.stringify(body) : undefined, signal }','JSON.stringify(body) : undefined }',1)
   patched=patched.replace("\n  storeContentSyncFlight?.cancel();\n  if (typeof overviewState !== 'undefined') Object.assign(overviewState, {busy:false, request:null, error:''});",'',1)
   (local/'app.js').write_text(patched)
   module.stage(local,ROOT/'app',root/'out');self.assertIn('Bound the whole operation',(root/'out/app.js').read_text())
 def test_unknown_layout_or_duplicate_wrapper_fail_before_writes(self):
  for html in ['<html></html>',(ROOT/'app/index.html').read_text().replace('</body>','<script src="store-sync-deadline.js" defer></script><script src="store-sync-deadline.js" defer></script></body>')]:
   with tempfile.TemporaryDirectory() as t:
    root=Path(t);(root/'index.html').write_text(html)
    with self.assertRaises(ValueError):module.stage(root,ROOT/'app',root/'out')
    self.assertFalse((root/'out').exists())
if __name__=='__main__':unittest.main()
