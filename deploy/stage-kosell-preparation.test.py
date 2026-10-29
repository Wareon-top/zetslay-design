import hashlib,importlib.util,json,os,subprocess,tempfile,unittest
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('kosell_stage',HERE/'stage-kosell-preparation.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
sha=lambda b:hashlib.sha256(b).hexdigest()
class KosellPreparationTests(unittest.TestCase):
 def fixture(self,root):
  local=root/'local';incoming=root/'incoming';local.mkdir();incoming.mkdir()
  html=b'<html><head>PRIVATE_HEAD</head><body>VIDEO_BANNER PROXY_BANNER LEGAL_OPERATOR<section data-plugin-page></section><script src="kosell-rent.js?v=keep"></script><script src="kosell-storefront.js?v=old"></script><script src="app.js?v=keep"></script><script src="account-security.js?v=keep"></script></body></html>\r\n'
  old=b'// reviewed previous reader\n';target=b'// bounded new reader\n'
  (local/'index.html').write_bytes(html);(local/'kosell-storefront.js').write_bytes(old);(incoming/'kosell-storefront.js').write_bytes(target)
  (incoming/'manifest.json').write_text(json.dumps({'acceptedSha256':[sha(old),sha(target)],'targetSha256':sha(target)}))
  return local,incoming,html,old,target
 def test_preserves_every_html_byte_except_the_single_include_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);local,incoming,html,old,target=self.fixture(root);out=root/'out';m.stage(local,incoming,out)
   self.assertEqual((out/'index.html').read_bytes(),html.replace(b'kosell-storefront.js?v=old',b'kosell-storefront.js?v=20261026-kosell-bounded-preparation'))
   self.assertEqual((out/'kosell-storefront.js').read_bytes(),target);m.stage(out,incoming,root/'twice');self.assertEqual((out/'index.html').read_bytes(),(root/'twice/index.html').read_bytes())
 def test_unknown_source_duplicate_script_order_or_tampered_target_stop_before_output(self):
  for mode in ['source','duplicate','order','target']:
   with self.subTest(mode=mode),tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp);local,incoming,html,old,target=self.fixture(root)
    if mode=='source':(local/'kosell-storefront.js').write_bytes(old+b'// private change')
    if mode=='duplicate':(local/'index.html').write_bytes(html+b'<script src="kosell-storefront.js"></script>')
    if mode=='order':(local/'index.html').write_bytes(html.replace(b'kosell-storefront.js?v=old',b'temp').replace(b'app.js?v=keep',b'kosell-storefront.js?v=old').replace(b'temp',b'app.js?v=keep'))
    if mode=='target':(incoming/'kosell-storefront.js').write_bytes(b'// tampered')
    with self.assertRaises(ValueError):m.stage(local,incoming,root/'out')
    self.assertFalse((root/'out').exists())
 def test_exact_repository_blob_identity_accepts_historical_source_but_not_arbitrary_edits(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);local,incoming,html,old,target=self.fixture(root);manifest=json.loads((incoming/'manifest.json').read_text())
   manifest['acceptedSha256']=[];manifest['acceptedGitBlobs']=[hashlib.sha1(b'blob '+str(len(old)).encode()+b'\0'+old).hexdigest()];(incoming/'manifest.json').write_text(json.dumps(manifest))
   m.stage(local,incoming,root/'out');self.assertEqual((root/'out/kosell-storefront.js').read_bytes(),target)
   (local/'kosell-storefront.js').write_bytes(old+b'// unknown modification')
   with self.assertRaises(ValueError):m.stage(local,incoming,root/'bad')
 def install(self,mode='ok'):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);local,incoming,html,old,target=self.fixture(root);site=root/'site';(site/'app').mkdir(parents=True);(site/'deploy').mkdir()
   (site/'app/index.html').write_bytes(html);(site/'app/kosell-storefront.js').write_bytes(target);(site/'app/app.js').write_bytes(b'// KEEP_AUTH');(site/'app/account-security.js').write_bytes(b'// KEEP_MFA');(site/'deploy/kosell-preparation-manifest.json').write_bytes((incoming/'manifest.json').read_bytes());(site/'deploy/stage-kosell-preparation.py').write_bytes((HERE/'stage-kosell-preparation.py').read_bytes())
   def git(*args):return subprocess.run(['git','-C',str(site),*args],check=True,capture_output=True,text=True).stdout.strip()
   git('init');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('add','.');git('commit','-m','fixture');revision=git('rev-parse','HEAD');(site/'app/kosell-storefront.js').write_bytes(old)
   bin=root/'bin';bin.mkdir();backups=root/'backups';backups.mkdir()
   if mode=='fail':
    p=bin/'mv';p.write_text('#!/bin/bash\ncase "$*" in *app/index.html*) exit 23;; esac\nexec /bin/mv "$@"\n');p.chmod(0o755)
   if mode=='backup':
    p=bin/'tar';p.write_text('#!/bin/bash\n/bin/tar "$@" || exit $?\nif [ "$1" = "-czf" ];then printf broken > "$2";fi\n');p.chmod(0o755)
   result=subprocess.run(['bash',str(HERE/'update-kosell-preparation.sh')],env={**os.environ,'PATH':str(bin)+':'+os.environ['PATH'],'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backups),'ZETSLAY_KOSELL_PREPARATION_REVISION':revision,'ZETSLAY_KOSELL_PREPARATION_PREFLIGHT_ONLY':str(mode=='preflight').lower()},capture_output=True,text=True,timeout=20)
   self.assertEqual(result.returncode==0,mode in ['ok','preflight'],result.stdout+result.stderr)
   self.assertEqual((site/'app/app.js').read_bytes(),b'// KEEP_AUTH');self.assertEqual((site/'app/account-security.js').read_bytes(),b'// KEEP_MFA');self.assertFalse((site/'.zetslay-kosell-preparation-update.lock').exists())
   if mode=='ok':
    self.assertEqual((site/'app/kosell-storefront.js').read_bytes(),target);self.assertEqual(next(backups.iterdir()).stat().st_mode&0o777,0o600);self.assertEqual((site/'app/kosell-storefront.js').stat().st_mode&0o777,0o644)
   else:self.assertEqual((site/'app/kosell-storefront.js').read_bytes(),old);self.assertEqual((site/'app/index.html').read_bytes(),html)
   if mode=='fail':self.assertIn('Прежний раздел восстановлен',result.stdout)
   if mode=='backup':self.assertEqual(len(list(backups.iterdir())),1)
 def test_install(self):self.install()
 def test_preflight_does_not_write(self):self.install('preflight')
 def test_partial_publish_restores_exact_previous_files(self):self.install('fail')
 def test_corrupt_backup_stops_before_any_site_write(self):self.install('backup')
if __name__=='__main__':unittest.main()
