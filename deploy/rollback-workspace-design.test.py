import importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('rollback',Path(__file__).with_name('rollback-workspace-design.py'));r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
class Rollback(unittest.TestCase):
 def test_real_design_overlay_roundtrips_to_previous_release(self):
  spec=importlib.util.spec_from_file_location('design_tests',Path(__file__).with_name('stage-workspace-design.test.py'));tests=importlib.util.module_from_spec(spec);spec.loader.exec_module(tests)
  with tempfile.TemporaryDirectory() as temp:
   site=tests.DesignTests().fixture(temp);names=tests.stage.inputs(tests.ROOT,None,None);original={n:r.read(site/n) for n in names};result=tests.stage.stage(site,tests.ROOT,Path(temp)/'out');backup=Path(temp)/'zetslay-before-design-real';backup.mkdir()
   for name in result:
    if original[name] is not None:p=backup/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(original[name])
   (backup/'release-files.json').write_text(json.dumps({'site':str(site.resolve()),'created':[n for n in result if original[n] is None],'sha256':{n:r.digest(d) for n,d in result.items()}}));tests.stage.write(site,result);r.restore(site,Path(temp),install=True)
   self.assertEqual({n:r.read(site/n) for n in names},original)
 def fixture(self,temp):
  root=Path(temp);site=root/'site';site.mkdir();backup=root/'zetslay-before-design-test';backup.mkdir();(site/'index.html').write_bytes(b'NEW');(backup/'index.html').write_bytes(b'OLD');(site/'new.css').write_bytes(b'NEW_CSS');(site/'app.js').write_bytes(b'INDEPENDENT_RUNTIME')
  (backup/'release-files.json').write_text(json.dumps({'site':str(site),'created':['new.css'],'sha256':{'index.html':r.digest(b'NEW'),'new.css':r.digest(b'NEW_CSS')}}));return site,root,backup
 def test_exact_restore_removes_only_created_files_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as temp:
   site,root,backup=self.fixture(temp);r.restore(site,root,install=True);self.assertEqual((site/'index.html').read_bytes(),b'OLD');self.assertFalse((site/'new.css').exists());self.assertEqual((site/'app.js').read_bytes(),b'INDEPENDENT_RUNTIME');r.restore(site,root,install=True);self.assertEqual(len(list(root.glob('zetslay-design-rollback-safety-*'))),1)
 def test_conflict_stops_before_any_write(self):
  with tempfile.TemporaryDirectory() as temp:
   site,root,_=self.fixture(temp);(site/'new.css').write_bytes(b'EDITED')
   with self.assertRaisesRegex(ValueError,'изменён файл'):r.restore(site,root,install=True)
   self.assertEqual((site/'index.html').read_bytes(),b'NEW')
 def test_failure_recovers_own_writes(self):
  with tempfile.TemporaryDirectory() as temp:
   site,root,_=self.fixture(temp);replace=r.replace
   def fail(path,data):
    if path.name=='new.css' and data is None:raise OSError('injected failure')
    return replace(path,data)
   with patch.object(r,'replace',side_effect=fail):
    with self.assertRaises(OSError):r.restore(site,root,install=True)
   self.assertEqual((site/'index.html').read_bytes(),b'NEW');self.assertEqual((site/'new.css').read_bytes(),b'NEW_CSS')
 def test_path_escape_is_rejected(self):
  with tempfile.TemporaryDirectory() as temp:
   site,root,backup=self.fixture(temp);p=backup/'release-files.json';m=json.loads(p.read_text());m['sha256']['../outside']=r.digest(b'BAD');p.write_text(json.dumps(m))
   with self.assertRaises(ValueError):r.restore(site,root,install=True)
   self.assertEqual((site/'index.html').read_bytes(),b'NEW')
if __name__=='__main__':unittest.main()
