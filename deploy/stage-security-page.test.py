import importlib.util,json,hashlib,os,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('security_page',ROOT/'deploy/stage-security-page.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SecurityPageTests(unittest.TestCase):
 def fixture(self,root):
  local,incoming,out=[root/n for n in ['local','incoming','out']]
  for p in [local,incoming]:(p/'security').mkdir(parents=True)
  old=b'<html><head><title>Known old public security page</title></head><body>OLD_PAGE</body></html>\n'
  (local/'security/index.html').write_bytes(old);(local/'security/security.css').write_bytes(b'OLD_CSS');(local/'security/security.js').write_bytes(b'OLD_JS')
  for name in m.FILES:(incoming/name).write_bytes((ROOT/name).read_bytes())
  manifest=json.loads((ROOT/'deploy/security-page-manifest.json').read_text());manifest['sourceHtmlAccepted'].append(hashlib.sha256(m.normalized(old)).hexdigest())
  (incoming/'security-page-manifest.json').write_text(json.dumps(manifest));return local,incoming,out,old
 def test_recognized_page_and_transport_variants_are_staged_without_writing_source(self):
  for mode in ['plain','crlf','bom']:
   with self.subTest(mode=mode),tempfile.TemporaryDirectory() as d:
    local,inc,out,old=self.fixture(Path(d))
    if mode=='crlf':old=old.replace(b'\n',b'\r\n')
    if mode=='bom':old=b'\xef\xbb\xbf'+old
    (local/'security/index.html').write_bytes(old);m.stage(local,inc,out)
    self.assertEqual((local/'security/index.html').read_bytes(),old)
    for name in m.FILES:self.assertEqual((out/name).read_bytes(),(ROOT/name).read_bytes())
    m.stage(out,inc,Path(d)/'again');self.assertEqual((out/'security/index.html').read_bytes(),(Path(d)/'again/security/index.html').read_bytes())
 def test_unknown_page_or_corrupt_incoming_asset_refuses_before_writing(self):
  for mode in ['unknown','css','js','html']:
   with self.subTest(mode=mode),tempfile.TemporaryDirectory() as d:
    local,inc,out,old=self.fixture(Path(d))
    if mode=='unknown':(local/'security/index.html').write_bytes(old+b'CUSTOM_OPERATOR_COPY')
    else:(inc/('security/'+{'css':'security.css','js':'security.js','html':'index.html'}[mode])).write_bytes(b'corrupt')
    with self.assertRaises(ValueError):m.stage(local,inc,out)
    self.assertFalse(out.exists())
 def test_current_and_deployed_legacy_pages_are_supported(self):
  manifest=json.loads((ROOT/'deploy/security-page-manifest.json').read_text())
  self.assertIn('4412ee685be785ee57fe0fff154ebc5c3692c4475b4c1ad8ae0e4c0fb62d4fb3',manifest['sourceHtmlAccepted'])
  self.assertGreaterEqual(len(manifest['sourceHtmlAccepted']),3)
  self.assertIn(hashlib.sha256(m.normalized((ROOT/'security/index.html').read_bytes())).hexdigest(),manifest['sourceHtmlAccepted'])
 def test_install_preflight_and_mid_publish_failure_preserve_other_pages(self):
  for mode in ['install','preflight','rollback']:
   with self.subTest(mode=mode),tempfile.TemporaryDirectory() as d:
    root=Path(d);local,inc,out,old=self.fixture(root);repo=root/'site';(repo/'security').mkdir(parents=True);(repo/'deploy').mkdir();(repo/'app').mkdir();backups=root/'backups';backups.mkdir()
    for name in m.FILES:(repo/name).write_bytes((inc/name).read_bytes())
    (repo/'deploy/security-page-manifest.json').write_bytes((inc/'security-page-manifest.json').read_bytes());(repo/'deploy/stage-security-page.py').write_bytes((ROOT/'deploy/stage-security-page.py').read_bytes())
    (repo/'index.html').write_text('PRIVATE_LANDING_LEGAL');(repo/'app/index.html').write_text('PRIVATE_ACCOUNT_2FA_KEEP')
    def git(*args):return subprocess.check_output(['git',*args],cwd=repo,text=True,stderr=subprocess.DEVNULL).strip()
    git('init');git('config','user.email','fixture@example.invalid');git('config','user.name','Fixture');git('add','.');git('commit','-m','fixture');revision=git('rev-parse','HEAD')
    for name in m.FILES:(repo/name).write_bytes((local/name).read_bytes())
    env={**os.environ,'ZETSLAY_SITE_DIR':str(repo),'ZETSLAY_BACKUP_DIR':str(backups),'ZETSLAY_SECURITY_PAGE_REVISION':revision}
    if mode=='preflight':env['ZETSLAY_SECURITY_PAGE_PREFLIGHT_ONLY']='true'
    if mode=='rollback':
     bin=root/'bin';bin.mkdir();p=bin/'mv';p.write_text('#!/bin/bash\ncase "$*" in *index.html*) exit 23;; esac\nexec /bin/mv "$@"\n');p.chmod(0o755);env['PATH']=str(bin)+':'+env['PATH']
    result=subprocess.run(['bash',str(ROOT/'deploy/update-security-page.sh')],env=env,capture_output=True,text=True,timeout=20)
    self.assertEqual(result.returncode==0,mode!='rollback',result.stdout+result.stderr)
    for name in m.FILES:
     expected=(inc/name).read_bytes() if mode=='install' else (local/name).read_bytes()
     self.assertEqual((repo/name).read_bytes(),expected)
     if mode=='install':self.assertEqual((repo/name).stat().st_mode&0o777,0o644)
    self.assertEqual((repo/'index.html').read_text(),'PRIVATE_LANDING_LEGAL');self.assertEqual((repo/'app/index.html').read_text(),'PRIVATE_ACCOUNT_2FA_KEEP')
    if mode=='preflight':self.assertFalse(list(backups.iterdir()))
    else:self.assertEqual(next(backups.iterdir()).stat().st_mode&0o777,0o600)
if __name__=='__main__':unittest.main()
