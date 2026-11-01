import importlib.util,json,tempfile,unittest,shutil
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('kosell_ui_stage',HERE/'stage-kosell-workspace.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class KosellUiTests(unittest.TestCase):
 def test_combined_launcher_pins_the_tested_core_and_contains_all_offline_assets(self):
  script=(HERE/'start-kosell-workspace.sh').read_text()
  self.assertIn('core_revision=12f2b763cec134b7ed5071dbffc1efb5629c82dc',script)
  for name in ['update-kosell-workspace.py','kosell-workspace-probe.mjs','kosell-workspace-patches.json','bot-reliability-probe.mjs','update-trust-foundation.py','trust-foundation-patches.json','trust-foundation-probe.mjs','switch-steelproxy-direct.py','check-steelproxy-readiness.py','bot-reliability.mjs','kosell-storefront-console.mjs']:self.assertIn(name,script)
  self.assertIn('ZETSLAY_KOSELL_WORKSPACE_PREFLIGHT_ONLY=true',script)
 def fixture(self,root):
  local,incoming,out=[root/n for n in ['local','incoming','out']];local.mkdir();incoming.mkdir();manifest=json.loads((HERE/'kosell-workspace-manifest.json').read_text())
  for n in manifest['assets']:shutil.copy2(HERE.parent/'app'/n,incoming/n)
  shutil.copy2(HERE/'kosell-workspace-manifest.json',incoming/'kosell-workspace-manifest.json')
  html='<html><head><meta name="PRIVATE_CABINET_CANARY" content="preserve"><link href="other.css"></head><body><div class="view-stack" data-overview><div class="overview-grid"></div></div><script src="kosell-rent.js?v=old" defer></script><script src="kosell-storefront.js?v=old" defer></script><script src="app.js"></script><script src="proxy-shop.js"></script></body></html>'
  (local/'index.html').write_text(html)
  return local,incoming,out
 def test_private_cabinet_and_unrelated_assets_are_preserved_and_stage_is_idempotent(self):
  with tempfile.TemporaryDirectory() as tmp:
   local,incoming,out=self.fixture(Path(tmp));m.stage(local,incoming,out);html=(out/'index.html').read_text();self.assertIn('PRIVATE_CABINET_CANARY',html);self.assertIn('<script src="proxy-shop.js"></script>',html);self.assertIn('<link href="other.css">',html);self.assertEqual(html.count('kosell-workspace.css'),1);self.assertIn('20261029-kosell-3',html)
   target=Path(tmp)/'again';m.stage(out,incoming,target);self.assertEqual((target/'index.html').read_bytes(),(out/'index.html').read_bytes());self.assertEqual(set(p.name for p in out.iterdir()),{'index.html','kosell-rent.js','kosell-storefront.js','kosell-workspace.css'})
 def test_unknown_existing_javascript_and_tampered_release_fail_without_writes(self):
  for tamper in [False,True]:
   with tempfile.TemporaryDirectory() as tmp:
    local,incoming,out=self.fixture(Path(tmp));(incoming/'kosell-rent.js' if tamper else local/'kosell-rent.js').write_text('// UNRECOGNIZED');before=(local/'index.html').read_bytes()
    with self.assertRaises(ValueError):m.stage(local,incoming,out)
    self.assertEqual((local/'index.html').read_bytes(),before);self.assertFalse(out.exists())
 def test_duplicate_scripts_are_rejected(self):
  with tempfile.TemporaryDirectory() as tmp:
   local,incoming,out=self.fixture(Path(tmp));p=local/'index.html';p.write_text(p.read_text().replace('</body>','<script src="kosell-rent.js"></script></body>'))
   with self.assertRaises(ValueError):m.stage(local,incoming,out)
if __name__=='__main__':unittest.main()
