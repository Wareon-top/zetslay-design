import importlib.util,json,tempfile,unittest
from pathlib import Path
HERE=Path(__file__).parent;spec=importlib.util.spec_from_file_location('basic_ui',HERE/'stage-basic-automation.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class BasicUITests(unittest.TestCase):
 def fixture(self,root,existing=True):
  local=root/'local';incoming=root/'incoming';local.mkdir();incoming.mkdir();html='<html><head></head><body><!-- view-stack data-overview overview-grid PRIVATE_CABINET_MARKER --><script src="app.js?v=private"></script><script src="proxy-shop.js"></script></body></html>';(local/'index.html').write_text(html);m=json.loads((HERE/'basic-automation-manifest.json').read_text());(incoming/'basic-automation-manifest.json').write_text(json.dumps(m))
  for n in m['assets']:
   data=(HERE.parent/'app'/n).read_bytes();(incoming/n).write_bytes(data)
   if existing and n.startswith('store-tools'):(local/n).write_bytes(data)
  return local,incoming,root/'out',html
 def test_install_and_reinstall_preserve_private_html_and_surrounding_scripts(self):
  for existing in [False,True]:
   with tempfile.TemporaryDirectory() as tmp:
    local,incoming,out,html=self.fixture(Path(tmp),existing);module.stage(local,incoming,out);result=(out/'index.html').read_text();self.assertIn('PRIVATE_CABINET_MARKER',result);self.assertIn('app.js?v=private',result);self.assertLess(result.index('store-tools.js'),result.index('basic-automation.js'));self.assertLess(result.index('app.js'),result.index('store-tools.js'))
    for p in out.iterdir():(local/p.name).write_bytes(p.read_bytes())
    module.stage(local,incoming,Path(tmp)/'again');self.assertEqual((Path(tmp)/'again/index.html').read_text(),result)
 def test_unknown_assets_and_duplicate_tags_stop_before_publish(self):
  for duplicate in [False,True]:
   with tempfile.TemporaryDirectory() as tmp:
    local,incoming,out,html=self.fixture(Path(tmp))
    if duplicate:(local/'index.html').write_text(html.replace('</body>','<script src="store-tools.js"></script><script src="store-tools.js"></script></body>'))
    else:(local/'store-tools.js').write_text('// UNKNOWN MODIFIED VERSION')
    with self.assertRaises(ValueError):module.stage(local,incoming,out)
    self.assertFalse(out.exists())
if __name__=='__main__':unittest.main()
