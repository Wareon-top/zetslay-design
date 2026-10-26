import importlib.util,json,hashlib,os,subprocess,tempfile,unittest
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('stage',HERE/'stage-trust-foundation.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
sha=lambda x:hashlib.sha256(x).hexdigest()
class TrustUiTests(unittest.TestCase):
 def test_landing_section_is_unique_preserves_surroundings_and_rejects_unknown_sections(self):
  fragment=(HERE.parent/'landing-security.html').read_text();original='<html><head>PRIVATE_HEAD</head><body><main>VIDEO_BANNER PROXY_BANNER<section id="faq">FAQ</section></main>PRIVATE_OPERATOR</body></html>'
  result=m.landing_security(original,fragment)
  self.assertEqual(m.landing_security(result,fragment),result)
  self.assertEqual(result.count('id="security"'),1);self.assertEqual(result.count('data-zetslay-security-style'),1)
  self.assertIn('VIDEO_BANNER PROXY_BANNER',result);self.assertIn('PRIVATE_OPERATOR',result)
  for bad in [original.replace('<main>','<main><section id="security"></section>'),'<html><head></head><body>unknown layout</body></html>',original+'<!-- zetslay-security:start -->']:
   with self.assertRaises(ValueError):m.landing_security(bad,fragment)
  self.assertIn('сервер использует расшифрованный ключ',fragment)
  self.assertNotIn('100%',fragment);self.assertNotIn('<script',fragment)
 def test_observed_runtime_replacement_requires_exact_digest_size_target_and_host_contract(self):
  project=HERE.parent;actual=json.loads((HERE/'trust-ui-manifest.json').read_text())
  self.assertEqual(actual['accountSecurityReplacement']['sourceSha256'],'2eb3030b54c4fc28f68595627ad5d9d8296272f0c5370c93aeaceca199befba6')
  self.assertEqual(actual['accountSecurityReplacement']['sourceBytes'],13436)
  self.assertFalse(actual['accountSecurityReplacement']['sourceContentReviewed'])
  self.assertNotIn(actual['accountSecurityReplacement']['sourceSha256'],actual['accountSecurityAccepted'])
  for mode in ['ok','hash','size','target','host','profile','order']:
   with self.subTest(mode=mode),tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp);local,incoming,a,b=self.fixture(root);manifest=json.loads(json.dumps(actual))
    original=b"throw Error('OLD_RUNTIME_CANARY_MUST_NOT_EXECUTE');\n"
    manifest['accountSecurityReplacement'].update(sourceSha256=sha(original),sourceBytes=len(original))
    if mode=='hash':manifest['accountSecurityReplacement']['sourceSha256']='0'*64
    if mode=='size':manifest['accountSecurityReplacement']['sourceBytes']+=1
    if mode=='target':manifest['accountSecurityReplacement']['targetSha256']='0'*64
    (incoming/'trust-ui-manifest.json').write_text(json.dumps(manifest))
    for name in manifest['assets']:(incoming/name).write_bytes((project/name).read_bytes())
    if manifest.get('landingSecurityFragment'):
     name=manifest['landingSecurityFragment']['file'];(incoming/name).write_bytes((project/name).read_bytes())
    (local/'app/account-security.js').write_bytes(original)
    app=(project/'app/app.js').read_text()
    (local/'app/app.js').write_text(app.replace('function resetAccountData(', 'function incompatibleReset(') if mode=='host' else app)
    (local/'app/profile.js').write_bytes((project/'app/profile.js').read_bytes() if mode!='profile' else b'// incompatible')
    html=b.replace('<script src="app.js','<div data-profile></div><script src="profile.js"></script><script src="app.js')
    if mode=='order':html=html.replace('<script src="profile.js"></script>','')+'<script src="profile.js"></script>'
    (local/'app/index.html').write_text(html)
    if mode!='ok':
     with self.assertRaises(ValueError):m.stage(local,incoming,root/'out')
     self.assertFalse((root/'out').exists())
    else:
     m.stage(local,incoming,root/'out')
     self.assertEqual((root/'out/app/account-security.js').read_bytes(),(project/'app/account-security.js').read_bytes())
     self.assertEqual((local/'app/account-security.js').read_bytes(),original)
     self.assertNotIn(b'OLD_RUNTIME_CANARY',(root/'out/app/account-security.js').read_bytes())
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
     if manifest.get('landingSecurityFragment'):
      name=manifest['landingSecurityFragment']['file'];(incoming/name).write_bytes((project/name).read_bytes())
     (local/'app/account-security.js').write_bytes(variant)
     (local/'app/app.js').write_text('// '+''.join(p['before']+'\n// ' for p in manifest['appPatches'])+'KEEP_CURRENT_PROXY_REPAIR\n')
     m.stage(local,incoming,root/'out')
     self.assertEqual((root/'out/app/account-security.js').read_bytes(),(project/'app/account-security.js').read_bytes())
     self.assertIn(b'KEEP_CURRENT_PROXY_REPAIR',(root/'out/app/app.js').read_bytes())
     result=(root/'out/index.html').read_bytes().decode();fragment=(project/manifest['landingSecurityFragment']['file']).read_text();block='<!-- zetslay-security:start -->\n'+fragment.rstrip()+'\n<!-- zetslay-security:end -->\n';link='<link rel="stylesheet" href="landing-security.css?v=20261026-1" data-zetslay-security-style>\n';self.assertEqual(result.replace(block,'',1).replace(link,'',1),a.replace('<a href="/legal/">','<a href="/security/">Данные и безопасность</a> <a href="/legal/">'));self.assertLess(result.index('id="security"'),result.index('id="faq"'))
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
  root_html='<html><head></head><body><main><section id="faq"></section></main>PRIVATE_OPERATOR_CANARY<a href="/legal/">Legal</a></body></html>\r\n'
  app_html=root_html.replace('</body>','VIDEO_BANNER PROXY_BANNER<script src="app.js?v=old"></script><script src="account-security.js?v=old"></script></body>')
  (local/'index.html').write_bytes(root_html.encode());(local/'app/index.html').write_bytes(app_html.encode());(local/'app/app.js').write_bytes(b'// OLD_COPY\nconst keep="CURRENT_PROXY_REPAIR";\n');(local/'app/account-security.js').write_bytes(b'// before\n')
  (local/'app/profile.js').write_bytes(b'// HOST_PROFILE_MUST_REMAIN_UNCHANGED\n')
  for name in ['landing-security.css','app/passkeys.css','app/account-security.js','security/index.html','security/security.css','security/security.js','security/brand.webp']:
   data=b'// after\n';(incoming/name).write_bytes(data);manifest['assets'][name]=sha(data)
  manifest['accountSecurityAccepted']=[sha(b'// before\n'),sha(b'// after\n')];(incoming/'trust-ui-manifest.json').write_text(json.dumps(manifest));return local,incoming,root_html,app_html
 def test_private_html_banners_other_assets_and_idempotency(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);local,incoming,a,b=self.fixture(root);out=root/'out';m.stage(local,incoming,out)
   marker='<a href="/security/">Данные и безопасность</a> '
   self.assertEqual((out/'index.html').read_bytes().decode(),a.replace('<a href="/legal/">',marker+'<a href="/legal/">'))
   self.assertEqual((out/'app/index.html').read_bytes().decode(),b.replace('<a href="/legal/">',marker+'<a href="/legal/">').replace('?v=old','?v=20261026-passkeys-1').replace('</head>','<link rel="stylesheet" href="passkeys.css?v=20261026-1" data-zetslay-passkeys-style>\n</head>'))
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
 def install(self,fail=False,preflight=False,corrupt_backup=False):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);local,incoming,a,b=self.fixture(root);deploy=local/'deploy';deploy.mkdir();(deploy/'stage-trust-foundation.py').write_bytes((HERE/'stage-trust-foundation.py').read_bytes());(deploy/'trust-ui-manifest.json').write_bytes((incoming/'trust-ui-manifest.json').read_bytes())
   for name in json.loads((incoming/'trust-ui-manifest.json').read_text())['assets']:(local/name).write_bytes((incoming/name).read_bytes())
   (local/'landing-security.html').write_text('<section>fixture fragment</section>')
   def git(*args):return subprocess.run(['git','-C',str(local),*args],check=True,capture_output=True,text=True).stdout.strip()
   git('init');git('config','user.email','fixture@example.invalid');git('config','user.name','Test');git('add','.');git('commit','-m','fixture');revision=git('rev-parse','HEAD');(local/'app/account-security.js').write_bytes(b'// before\n')
   # Simulate the first deployment of a new public section.
   for p in (local/'security').iterdir():p.unlink()
   (local/'security').rmdir()
   backups=root/'backups';backups.mkdir();bin=root/'bin';bin.mkdir()
   if fail:
    mv=bin/'mv';mv.write_text('#!/bin/bash\ncase "$*" in *security/security.js*) exit 23;; esac\nexec /bin/mv "$@"\n');mv.chmod(0o755)
   if corrupt_backup:
    tar=bin/'tar';tar.write_text('#!/bin/bash\n/bin/tar "$@" || exit $?\nif [ "$1" = "-czf" ];then printf broken > "$2";fi\n');tar.chmod(0o755)
   r=subprocess.run(['bash',str(HERE/'update-trust-ui.sh')],env={**os.environ,'ZETSLAY_SITE_DIR':str(local),'ZETSLAY_TRUST_REVISION':revision,'ZETSLAY_BACKUP_DIR':str(backups),'ZETSLAY_TRUST_PREFLIGHT_ONLY':str(preflight).lower(),'PATH':str(bin)+':'+os.environ['PATH']},capture_output=True,text=True,timeout=20)
   if fail or preflight or corrupt_backup:
    self.assertEqual((local/'index.html').read_bytes().decode(),a);self.assertEqual((local/'app/index.html').read_bytes().decode(),b);self.assertEqual((local/'app/account-security.js').read_bytes(),b'// before\n');self.assertFalse((local/'security').exists())
    self.assertEqual(r.returncode!=0,fail or corrupt_backup,r.stdout+r.stderr)
   else:
    self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertEqual((local/'security').stat().st_mode&0o777,0o755);self.assertEqual((local/'app/account-security.js').stat().st_mode&0o777,0o644);self.assertEqual(next(backups.iterdir()).stat().st_mode&0o777,0o600)
   self.assertEqual((local/'app/profile.js').read_bytes(),b'// HOST_PROFILE_MUST_REMAIN_UNCHANGED\n')
 def test_install(self):self.install()
 def test_preflight_has_no_writes(self):self.install(preflight=True)
 def test_mid_publish_failure_restores_files_and_removes_new_public_section(self):self.install(fail=True)
 def test_corrupt_backup_stops_before_any_public_file_is_written(self):self.install(corrupt_backup=True)
if __name__=='__main__':unittest.main()
