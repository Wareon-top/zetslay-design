import hashlib,importlib.util,json,tarfile,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('ui_update',Path(__file__).with_name('update-kosell-control-ui.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def setup_files(self,root):
  (root/'app').mkdir();manifest={};contents={}
  for name in m.FILES:
   old=('before '+name).encode();new=('after '+name).encode();(root/name).write_bytes(old)
   manifest[name]={'before':m.digest(old),'after':m.digest(new)};contents[name]=new
  index=b'<html>KEEP_PRIVATE_MARKUP<script src="kosell-storefront.js?v=old"></script><link href="kosell-workspace.css?v=old"></html>'
  (root/'app/index.html').write_bytes(index);contents['deploy/kosell-control-ui-manifest.json']=json.dumps(manifest).encode()
  return contents,index
 def test_preflight_success_idempotence_and_backup(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);contents,index=self.setup_files(root);original=m.git;m.git=lambda root,rev,path:contents[path]
   try:
    changes=m.prepare(root,'a'*40);self.assertEqual(len(changes),3);self.assertEqual((root/'app/index.html').read_bytes(),index)
    backup=m.apply(root,changes,lambda:None,root)
    self.assertIn(b'KEEP_PRIVATE_MARKUP',(root/'app/index.html').read_bytes());self.assertEqual(m.prepare(root,'a'*40),{})
    with tarfile.open(backup) as archive:self.assertEqual(archive.extractfile('app/index.html').read(),index)
   finally:m.git=original
 def test_failed_publication_rolls_back_every_changed_file(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);contents,index=self.setup_files(root);original=m.git;m.git=lambda root,rev,path:contents[path]
   try:
    before={path:(root/path).read_bytes() for path in {*m.FILES,'app/index.html'}}
    changes=m.prepare(root,'a'*40)
    def fail():raise ValueError('synthetic HTTP mismatch')
    with self.assertRaises(ValueError):m.apply(root,changes,fail,root)
    self.assertTrue(all((root/path).read_bytes()==data for path,data in before.items()))
   finally:m.git=original
 def test_unknown_source_and_duplicate_links_never_modify_the_site(self):
  for mode in ['source','links']:
   with tempfile.TemporaryDirectory() as temp:
    root=Path(temp);contents,index=self.setup_files(root);original=m.git;m.git=lambda root,rev,path:contents[path]
    try:
     if mode=='source':(root/'app/kosell-storefront.js').write_bytes(b'CUSTOM_CHANGE')
     else:(root/'app/index.html').write_bytes(index+b'<script src="kosell-storefront.js"></script>')
     before=(root/'app/index.html').read_bytes()
     with self.assertRaises(ValueError):m.prepare(root,'a'*40)
     self.assertEqual((root/'app/index.html').read_bytes(),before)
    finally:m.git=original
if __name__=='__main__':unittest.main()
