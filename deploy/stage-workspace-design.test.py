import importlib.util,json,os,subprocess,tempfile,unittest,io,tarfile
from pathlib import Path
from unittest.mock import patch
HERE=Path(__file__).parent;ROOT=HERE.parent;BASE='bf3f875f8ce03f5e6328ce2a1fb0a8820b62a2ab'
def load(name):
 spec=importlib.util.spec_from_file_location(name,HERE/(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
stage=load('stage-workspace-design');installer=load('apply-workspace-design')
def frozen(target,sha):
 data=subprocess.check_output(['git','archive',sha,'deploy','docs','demo','pricing','app','index.html','robots.txt','sitemap.xml','public-product.css'],cwd=ROOT)
 with tarfile.open(fileobj=io.BytesIO(data)) as archive:
  for member in archive:
   if not member.isfile():continue
   p=target/member.name
   if not p.resolve().is_relative_to(target.resolve()):raise ValueError('Archive path')
   p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(archive.extractfile(member).read())
class DesignTests(unittest.TestCase):
 def fixture(self,temp,sha=BASE,first=None,second=None):
  site=Path(temp)/'site';site.mkdir();names=stage.inputs(ROOT,first,second)
  for name in names:
   try:data=subprocess.check_output(['git','show',sha+':'+name],cwd=ROOT,stderr=subprocess.DEVNULL)
   except subprocess.CalledProcessError:continue
   p=site/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
  p=site/'app/index.html';p.write_bytes(p.read_bytes().replace(b'</body>',b'<script src="keep-independent-runtime.js" defer></script></body>'))
  return site
 def test_preserves_independent_runtime_and_legal_copy_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as temp:
   site=self.fixture(temp);p=site/'legal/index.html';p.write_text(p.read_text(encoding='utf8').replace('</main>','<p>LOCAL_LEGAL_TEXT</p></main>'),encoding='utf8')
   result=stage.stage(site,ROOT,Path(temp)/'out');self.assertIn(b'keep-independent-runtime',result['app/index.html']);self.assertIn(b'LOCAL_LEGAL_TEXT',result['legal/index.html']);self.assertNotIn('app/app.js',result);self.assertNotIn('legal/legal.css',result)
   stage.write(site,result);self.assertEqual(result,stage.stage(site,ROOT,Path(temp)/'again'))
 def test_unknown_asset_or_anchor_rejected_before_output(self):
  with tempfile.TemporaryDirectory() as temp:
   site=self.fixture(temp);(site/'demo/demo.js').write_text('// independent source');out=Path(temp)/'out'
   with self.assertRaisesRegex(ValueError,'Независимые'):stage.stage(site,ROOT,out)
   self.assertFalse(out.exists())
 def test_pinned_prerequisites_compose_without_writing_the_live_site(self):
  with tempfile.TemporaryDirectory() as temp:
   site=self.fixture(temp,'c5e383ee321fe3627c2490cb21e9d988ca97e34e');second=Path(temp)/'second';frozen(second,BASE);before=(site/'app/index.html').read_bytes();result=stage.stage(site,ROOT,Path(temp)/'out',second=second)
   self.assertIn(b'diagnostics-center.js',result['app/index.html']);self.assertIn(b'workspace-design.css',result['app/index.html']);self.assertEqual(before,(site/'app/index.html').read_bytes())
 def test_both_prerequisites_compose_before_any_live_write(self):
  with tempfile.TemporaryDirectory() as temp:
   first=Path(temp)/'first';second=Path(temp)/'second';frozen(first,'c5e383ee321fe3627c2490cb21e9d988ca97e34e');frozen(second,BASE);site=self.fixture(temp,'c5e383ee321fe3627c2490cb21e9d988ca97e34e',first,second)
   p=site/'app/index.html';p.write_text(p.read_text(encoding='utf8').replace('automation-preview.js','not-yet-installed-preview.js'),encoding='utf8')
   m=json.loads((first/'deploy/competitive-release.json').read_text(encoding='utf8'))
   for name,ops in m['patches'].items():
    p=site/name;s=p.read_text(encoding='utf8')
    for op in reversed(ops):s=s.replace(op['after'],op['before'],1)
    p.write_text(s,encoding='utf8')
   original=(site/'app/index.html').read_bytes();result=stage.stage(site,ROOT,Path(temp)/'out',first,second)
   self.assertIn('robots.txt',result);self.assertIn(b'workspace-design.css',result['app/index.html']);self.assertIn(b'diagnostics-center.js',result['app/index.html']);self.assertEqual(original,(site/'app/index.html').read_bytes())
 @unittest.skipIf(os.name!='posix','Linux VPS installer')
 def test_partial_write_restores_only_our_changes(self):
  with tempfile.TemporaryDirectory() as temp:
   site=self.fixture(temp);before={str(p.relative_to(site)):p.read_bytes() for p in site.rglob('*') if p.is_file()};real=installer.os.replace;calls=[]
   def failing(a,b):
    calls.append(b)
    if len(calls)==3:raise OSError('injected write failure')
    return real(a,b)
   with patch.object(installer.os,'replace',side_effect=failing):
    with self.assertRaises(OSError):installer.apply(site,ROOT,temp,install=True)
   after={str(p.relative_to(site)):p.read_bytes() for p in site.rglob('*') if p.is_file() and not p.name.startswith('.zetslay-')};self.assertEqual(before,after)
 @unittest.skipIf(os.name!='posix','Linux VPS installer')
 def test_concurrent_edit_stops_before_backup(self):
  with tempfile.TemporaryDirectory() as temp:
   site=self.fixture(temp);real=installer.module.stage;calls=[]
   def changing(*args,**kwargs):
    result=real(*args,**kwargs);calls.append(True)
    if len(calls)==2:(site/'app/index.html').write_bytes(b'CONCURRENT_RUNTIME_EDIT')
    return result
   with patch.object(installer.module,'stage',side_effect=changing):
    with self.assertRaisesRegex(ValueError,'изменились'):installer.apply(site,ROOT,temp,install=True)
   self.assertEqual((site/'app/index.html').read_bytes(),b'CONCURRENT_RUNTIME_EDIT');self.assertFalse(list(Path(temp).glob('zetslay-before-design-*')))
if __name__=='__main__':unittest.main()
