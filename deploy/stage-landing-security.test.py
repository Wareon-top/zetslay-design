import importlib.util,json,os,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('landing_stage',ROOT/'deploy/stage-landing-security.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class LandingSecurityTests(unittest.TestCase):
 def fixture(self,root):
  local,incoming,out=[root/n for n in ['local','incoming','out']];local.mkdir();incoming.mkdir()
  original=b'<html>\r\n<head>PRIVATE_HEAD</head><body><main>VIDEO_BANNER PROXY_BANNER<section id="faq">FAQ</section></main><footer>PRIVATE_LEGAL</footer></body></html>\r\n'
  (local/'index.html').write_bytes(original)
  for name in ['landing-security.html','landing-security.css']:(incoming/name).write_bytes((ROOT/name).read_bytes())
  (incoming/'landing-security-manifest.json').write_bytes((ROOT/'deploy/landing-security-manifest.json').read_bytes())
  return local,incoming,out,original
 def test_first_install_preserves_surrounding_bytes_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as d:
   local,inc,out,original=self.fixture(Path(d));m.stage(local,inc,out);result=(out/'index.html').read_bytes()
   start=result.index(m.START.encode());end=result.index(m.END.encode())+len(m.END)
   stripped=result[:start]+result[end+1:];link=('<link rel="stylesheet" href="'+m.CSS+'" data-zetslay-security-style>\n').encode()
   self.assertEqual(stripped.replace(link,b''),original)
   self.assertEqual(result.count(b'id="security"'),1);self.assertEqual((local/'index.html').read_bytes(),original)
   m.stage(out,inc,Path(d)/'again');self.assertEqual(result,(Path(d)/'again/index.html').read_bytes())
 def test_replaces_deployed_marked_section_and_cache_path(self):
  with tempfile.TemporaryDirectory() as d:
   local,inc,out,original=self.fixture(Path(d));old=(m.START+'<section id="security">OLD_DEPLOYED_SECTION</section>'+m.END).encode()
   (local/'index.html').write_bytes(original.replace(b'</main>',old+b'</main>').replace(b'</head>',b'<link rel="stylesheet" href="landing-security.css?v=old" data-zetslay-security-style></head>'))
   m.stage(local,inc,out);result=(out/'index.html').read_text();self.assertNotIn('OLD_DEPLOYED_SECTION',result);self.assertIn(m.CSS,result);self.assertEqual(result.count('data-zetslay-security-style'),1)
 def test_unknown_sections_broken_markers_duplicate_styles_and_tampering_fail_before_output(self):
  for mode in ['unknown','markers','duplicate-id','style','tamper']:
   with self.subTest(mode=mode),tempfile.TemporaryDirectory() as d:
    local,inc,out,original=self.fixture(Path(d))
    if mode=='unknown':original=original.replace(b'</main>',b'<section id="security">UNKNOWN</section></main>')
    if mode=='markers':original+=m.START.encode()
    if mode=='duplicate-id':original+=((m.START+'<section id="security"></section>'+m.END)+'<div id="security"></div>').encode()
    if mode=='style':original=original.replace(b'</head>',b'<link rel="stylesheet" href="landing-security.css"></head>')
    if mode=='tamper':(inc/'landing-security.css').write_text('corrupt')
    (local/'index.html').write_bytes(original)
    with self.assertRaises(ValueError):m.stage(local,inc,out)
    self.assertFalse(out.exists());self.assertEqual((local/'index.html').read_bytes(),original)
 def test_shell_install_preflight_permissions_and_failed_publish_rollback(self):
  for mode in ['install','preflight','rollback']:
   with self.subTest(mode=mode),tempfile.TemporaryDirectory() as d:
    root=Path(d);local,inc,out,original=self.fixture(root);repo=root/'site';repo.mkdir();(repo/'deploy').mkdir();backup=root/'backup';backup.mkdir()
    for name in ['landing-security.html','landing-security.css']:(repo/name).write_bytes((ROOT/name).read_bytes())
    for name in ['stage-landing-security.py','landing-security-manifest.json']:(repo/'deploy'/name).write_bytes((ROOT/'deploy'/name).read_bytes())
    (repo/'index.html').write_bytes(original)
    (repo/'app').mkdir();(repo/'app/index.html').write_text('ACCOUNT_KEEP')
    def git(*args):return subprocess.check_output(['git',*args],cwd=repo,text=True,stderr=subprocess.DEVNULL).strip()
    git('init');git('config','user.email','fixture@example.invalid');git('config','user.name','Fixture');git('add','.');git('commit','-m','fixture');revision=git('rev-parse','HEAD');(repo/'landing-security.css').write_text('LEGACY_CSS_KEEP')
    env={**os.environ,'ZETSLAY_SITE_DIR':str(repo),'ZETSLAY_BACKUP_DIR':str(backup),'ZETSLAY_SECURITY_DESIGN_REVISION':revision}
    if mode=='preflight':env['ZETSLAY_SECURITY_DESIGN_PREFLIGHT_ONLY']='true'
    if mode=='rollback':
     bin=root/'bin';bin.mkdir();p=bin/'mv';p.write_text('#!/bin/bash\ncase "$*" in *index.html*) exit 23;; esac\nexec /bin/mv "$@"\n');p.chmod(0o755);env['PATH']=str(bin)+':'+env['PATH']
    r=subprocess.run(['bash',str(ROOT/'deploy/update-landing-security.sh')],env=env,capture_output=True,text=True,timeout=20)
    if mode=='install':self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertIn(m.CSS,(repo/'index.html').read_text());self.assertEqual((repo/m.CSS).stat().st_mode&0o777,0o644)
    else:self.assertEqual((repo/'index.html').read_bytes(),original);self.assertFalse((repo/m.CSS).exists());self.assertEqual(r.returncode==0,mode=='preflight')
    self.assertEqual((repo/'app/index.html').read_text(),'ACCOUNT_KEEP');self.assertEqual((repo/'landing-security.css').read_text(),'LEGACY_CSS_KEEP')
    if mode!='preflight':self.assertEqual(next(backup.iterdir()).stat().st_mode&0o777,0o600)
if __name__=='__main__':unittest.main()
