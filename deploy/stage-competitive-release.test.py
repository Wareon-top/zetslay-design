import importlib.util,os,shutil,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
HERE=Path(__file__).parent;ROOT=HERE.parent
def load(name):
 spec=importlib.util.spec_from_file_location(name,HERE/(name+'.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
stage=load('stage-competitive-release');installer=load('apply-competitive-release')
class PublicRelease(unittest.TestCase):
 def fixture(self,folder):
  site=Path(folder)/'site';site.mkdir()
  for name in ['index.html','app/index.html','robots.txt','sitemap.xml','app/cabinet-demo.js','app/connection-wizard-ui.js']:
   target=site/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((ROOT/name).read_bytes())
  for name in ['index.html','app/index.html']:
   target=site/name;target.write_bytes(target.read_bytes().replace(b'</head>',b'<meta name="retain-local-hook" content="yes"></head>'))
  for name in ['app/cabinet-demo.js','app/connection-wizard-ui.js']:
   target=site/name;target.write_bytes(target.read_bytes()+b'\n// RETAIN_LOCAL_MODULE_CHANGE\n')
  return site
 def test_stage_preserves_local_hooks_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as temp:
   site=self.fixture(temp);out=Path(temp)/'out';result=stage.stage(site,ROOT,out)
   for name in ['index.html','app/index.html']:self.assertIn(b'retain-local-hook',result[name])
   for name in ['app/cabinet-demo.js','app/connection-wizard-ui.js']:self.assertIn(b'RETAIN_LOCAL_MODULE_CHANGE',result[name])
   self.assertNotIn('app/app.js',result)
   for name,data in result.items():target=site/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
   self.assertEqual(stage.stage(site,ROOT,Path(temp)/'again'),result)
 def test_unknown_runtime_and_independent_public_asset_stop_before_staging(self):
  with tempfile.TemporaryDirectory() as temp:
   site=self.fixture(temp);(site/'app/cabinet-demo.js').write_text('// unknown implementation')
   with self.assertRaises(ValueError):stage.stage(site,ROOT,Path(temp)/'out')
   self.assertFalse((Path(temp)/'out').exists())
  with tempfile.TemporaryDirectory() as temp:
   site=self.fixture(temp);(site/'public-product.css').write_text('/* custom existing design */')
   with self.assertRaises(ValueError):stage.stage(site,ROOT,Path(temp)/'out')
   self.assertFalse((Path(temp)/'out').exists())
 @unittest.skipIf(os.name!='posix','Linux VPS installer')
 def test_concurrent_edit_during_staging_stops_before_backup_and_install(self):
  with tempfile.TemporaryDirectory() as temp:
   site=self.fixture(temp);real_stage=installer.module.stage;calls=[]
   def changing_stage(*args):
    result=real_stage(*args);calls.append(True)
    if len(calls)==2:(site/'index.html').write_bytes(b'CONCURRENT_SITE_EDIT')
    return result
   with patch.object(installer.module,'stage',side_effect=changing_stage):
    with self.assertRaises(ValueError):installer.apply(site,ROOT,temp,install=True)
   self.assertEqual((site/'index.html').read_bytes(),b'CONCURRENT_SITE_EDIT');self.assertFalse(list(Path(temp).glob('zetslay-before-public-upgrade-*')))
 @unittest.skipIf(os.name!='posix','Linux VPS installer')
 def test_partial_install_restores_old_files_and_removes_new_assets(self):
  with tempfile.TemporaryDirectory() as temp:
   site=self.fixture(temp);before={str(path.relative_to(site)):path.read_bytes() for path in site.rglob('*') if path.is_file()};real_replace=os.replace;calls=[]
   def replace(source,target):
    calls.append(target)
    if len(calls)==3:raise OSError('injected install failure')
    return real_replace(source,target)
   with patch.object(installer.os,'replace',side_effect=replace):
    with self.assertRaises(OSError):installer.apply(site,ROOT,temp,install=True)
   after={str(path.relative_to(site)):path.read_bytes() for path in site.rglob('*') if path.is_file() and not path.name.startswith('.zetslay-')}
   self.assertEqual(after,before)
if __name__=='__main__':unittest.main()
