import importlib.util,json,hashlib,os,subprocess,tempfile,unittest
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('stage',HERE/'stage-trust-foundation.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
sha=lambda x:hashlib.sha256(x).hexdigest()
class TrustUiTests(unittest.TestCase):
 def test_real_historical_releases_and_transport_variants_upgrade_without_touching_private_html(self):
  project=HERE.parent;manifest=json.loads((HERE/'trust-ui-manifest.json').read_text())
  for revision,digest in manifest['accountSecurityBaselines'].items():
   baseline=(HERE/'fixtures/trust-security'/(revision+'.js')).read_bytes()
   self.assertEqual(sha(baseline),digest)
   for variant in [baseline,baseline.replace(b'\n',b'\r\n'),b'\xef\xbb\xbf'+baseline,baseline.rstrip(b'\n'),baseline+b'\n\n']:
    with self.subTest(revision=revision,sha=sha(variant)),tempfile.TemporaryDirectory() as tmp:
     root=Path(tmp);local,incoming,a,b=self.fixture(root)
     (incoming/'trust-ui-manifest.json').write_text(json.dumps(manifest))
     for name in manifest['assets']:(incoming/name).write_bytes((project/name).read_bytes())
     (local/'app/account-security.js').write_bytes(variant)
     (local/'app/app.js').write_text('// '+''.join(p['before']+'\n// ' for p in manifest['appPatches'])+'KEEP_CURRENT_PROXY_REPAIR\n')
     m.stage(local,incoming,root/'out')
     self.assertEqual((root/'out/app/account-security.js').read_bytes(),(project/'app/account-security.js').read_bytes())
     self.assertIn(b'KEEP_CURRENT_PROXY_REPAIR',(root/'out/app/app.js').read_bytes())
     self.assertEqual((root/'out/index.html').read_bytes().decode(),a.replace('<a href="/legal/">','<a href="/security/">Данные и безопасность</a> <a href="/legal/">'))
 def test_unknown_security_code_is_rejected_with_digest_without_echoing_source(self):
  manifest=json.loads((HERE/'trust-ui-manifest.json').read_text())
  for revision in manifest['accountSecurityBaselines']:
   baseline=(HERE/'fixtures/trust-security'/(revision+'.js')).read_bytes()
   changed=baseline+b'\n// CANARY_PRIVATE_VALUE\n'
   with self.assertRaisesRegex(ValueError,'SHA256='+sha(changed)) as failure:m.validate_security_script(changed,manifest)
   self.assertNotIn('CANARY_PRIVATE_VALUE',str(failure.exception))
 def fixture(self,root):
  local=root/'local';incoming=root/'incoming';local.mkdir();incoming.mkdir();manifest={'assets':{},'accountSecurityAccepted':[],'appPatches':[{'before':'OLD_COPY','after':'HONEST_COPY'}]}
  for base in [local,incoming]:
   for path in ['app','security']:(base/path).mkdir()
  root_html='<html><head></head><body>PRIVATE_OPERATOR_CANARY<a href="/legal/">Legal</a></body></html>\r\n'
  app_html=root_html.replace('</body>','VIDEO_BANNER PROXY_BANNER<script src="app.js?v=old"></script><script src="account-security.js?v=old"></script></body>')
  (local/'index.html').write_bytes(root_html.encode());(local/'app/index.html').write_bytes(app_html.encode());(local/'app/app.js').write_bytes(b'// OLD_COPY\nconst keep="CURRENT_PROXY_REPAIR";\n');(local/'app/account-security.js').write_bytes(b'// before\n')
  for name in ['app/account-security.js','security/index.html','security/security.css','security/security.js','security/brand.webp']:
   data=b'// after\n';(incoming/name).write_bytes(data);manifest['assets'][name]=sha(data)
  manifest['accountSecurityAccepted']=[sha(b'// before\n'),sha(b'// after\n')];(incoming/'trust-ui-manifest.json').write_text(json.dumps(manifest));return local,incoming,root_html,app_html
 def test_private_html_banners_other_assets_and_idempotency(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);local,incoming,a,b=self.fixture(root);out=root/'out';m.stage(local,incoming,out)
   marker='<a href="/security/">Данные и безопасность</a> '
   self.assertEqual((out/'index.html').read_bytes().decode(),a.replace('<a href="/legal/">',marker+'<a href="/legal/">'))
   self.assertEqual((out/'app/index.html').read_bytes().decode(),b.replace('<a href="/legal/">',marker+'<a href="/legal/">').replace('?v=old','?v=20261026-trust-foundation'))
   self.assertIn(b'CURRENT_PROXY_REPAIR',(out/'app/app.js').read_bytes());m.stage(out,incoming,root/'twice');self.assertEqual((out/'app/app.js').read_bytes(),(root/'twice/app/app.js').read_bytes())
 def test_unknown_copy_duplicate_include_and_corrupt_asset_stop_before_output(self):
  for mode in ['copy','include','asset']:
   with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp);local,incoming,a,b=self.fixture(root)
    if mode=='copy':(local/'app/app.js').write_text('// edited copy')
    if mode=='include':(local/'app/index.html').write_text(b+'<script src="app.js"></script>')
    if mode=='asset':(incoming/'security/security.js').write_text('corrupted')
    with self.assertRaises(ValueError):m.stage(local,incoming,root/'out')
    self.assertFalse((root/'out').exists())
 def install(self,fail=False,preflight=False):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);local,incoming,a,b=self.fixture(root);deploy=local/'deploy';deploy.mkdir();(deploy/'stage-trust-foundation.py').write_bytes((HERE/'stage-trust-foundation.py').read_bytes());(deploy/'trust-ui-manifest.json').write_bytes((incoming/'trust-ui-manifest.json').read_bytes())
   for name in json.loads((incoming/'trust-ui-manifest.json').read_text())['assets']:(local/name).write_bytes((incoming/name).read_bytes())
   def git(*args):return subprocess.run(['git','-C',str(local),*args],check=True,capture_output=True,text=True).stdout.strip()
   git('init');git('config','user.email','fixture@example.invalid');git('config','user.name','Test');git('add','.');git('commit','-m','fixture');revision=git('rev-parse','HEAD');(local/'app/account-security.js').write_bytes(b'// before\n')
   # Simulate the first deployment of a new public section.
   for p in (local/'security').iterdir():p.unlink()
   (local/'security').rmdir()
   backups=root/'backups';backups.mkdir();bin=root/'bin';bin.mkdir()
   if fail:
    mv=bin/'mv';mv.write_text('#!/bin/bash\ncase "$*" in *security/security.js*) exit 23;; esac\nexec /bin/mv "$@"\n');mv.chmod(0o755)
   r=subprocess.run(['bash',str(HERE/'update-trust-ui.sh')],env={**os.environ,'ZETSLAY_SITE_DIR':str(local),'ZETSLAY_TRUST_REVISION':revision,'ZETSLAY_BACKUP_DIR':str(backups),'ZETSLAY_TRUST_PREFLIGHT_ONLY':str(preflight).lower(),'PATH':str(bin)+':'+os.environ['PATH']},capture_output=True,text=True,timeout=20)
   if fail or preflight:
    self.assertEqual((local/'index.html').read_bytes().decode(),a);self.assertEqual((local/'app/index.html').read_bytes().decode(),b);self.assertEqual((local/'app/account-security.js').read_bytes(),b'// before\n');self.assertFalse((local/'security').exists())
    self.assertEqual(r.returncode!=0,fail,r.stdout+r.stderr)
   else:
    self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertEqual((local/'security').stat().st_mode&0o777,0o755);self.assertEqual((local/'app/account-security.js').stat().st_mode&0o777,0o644);self.assertEqual(next(backups.iterdir()).stat().st_mode&0o777,0o600)
 def test_install(self):self.install()
 def test_preflight_has_no_writes(self):self.install(preflight=True)
 def test_mid_publish_failure_restores_files_and_removes_new_public_section(self):self.install(fail=True)
if __name__=='__main__':unittest.main()
