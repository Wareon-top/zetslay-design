import hashlib,importlib.util,json,os,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('events_stage',Path(__file__).with_name('stage-event-center.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class EventUiTests(unittest.TestCase):
 def fixture(self,root):
  local,incoming,out=[root/n for n in ['local','incoming','out']];local.mkdir();incoming.mkdir()
  html='<html><head><title>PRIVATE_OPERATOR</title><link href="workspace-upgrade.css?v=old" rel="stylesheet"></head><body><div class="view-stack" data-overview><div class="overview-grid">VIDEO_BANNER PROXY_BANNER</div></div><script src="app.js"></script><script src="proxy-shop.js"></script><script src="workspace-upgrade.js?v=old" defer></script><footer>PRIVATE_LEGAL</footer></body></html>'
  (local/'index.html').write_text(html);manifest=json.loads((ROOT/'deploy/event-center-manifest.json').read_text())
  for name in manifest['assets']:(incoming/name).write_bytes((ROOT/'app'/name).read_bytes())
  (incoming/'event-center-manifest.json').write_text(json.dumps(manifest));(local/'workspace-upgrade.js').write_bytes((incoming/'workspace-upgrade.js').read_bytes());(local/'workspace-upgrade.css').write_text('/* CURRENT_LOCAL_THEME */')
  return local,incoming,out,html
 def test_preserves_private_html_current_theme_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as d:
   local,inc,out,html=self.fixture(Path(d));m.stage(local,inc,out);result=(out/'index.html').read_text()
   for token in ['PRIVATE_OPERATOR','PRIVATE_LEGAL','VIDEO_BANNER','PROXY_BANNER']:self.assertIn(token,result)
   self.assertIn('event-center.css?v=20261027-events-2',result);self.assertEqual((out/'workspace-upgrade.css').read_text(),'/* CURRENT_LOCAL_THEME */');self.assertEqual((local/'index.html').read_text(),html)
   out2=Path(d)/'out2';m.stage(out,inc,out2);self.assertEqual(result,(out2/'index.html').read_text())
 def test_missing_original_module_can_be_bootstrapped(self):
  with tempfile.TemporaryDirectory() as d:
   local,inc,out,html=self.fixture(Path(d));(local/'workspace-upgrade.js').unlink();(local/'workspace-upgrade.css').unlink();(local/'index.html').write_text(html.replace('<script src="workspace-upgrade.js?v=old" defer></script>','').replace('<link href="workspace-upgrade.css?v=old" rel="stylesheet">',''));m.stage(local,inc,out);self.assertTrue((out/'workspace-upgrade.css').is_file())
 def test_unknown_script_duplicate_include_and_bad_assets_stop_before_output(self):
  for mode in ['unknown','duplicate','asset']:
   with self.subTest(mode=mode),tempfile.TemporaryDirectory() as d:
    local,inc,out,html=self.fixture(Path(d))
    if mode=='unknown':(local/'workspace-upgrade.js').write_text('unknown implementation')
    if mode=='duplicate':(local/'index.html').write_text(html+'<script src="workspace-upgrade.js"></script>')
    if mode=='asset':(inc/'event-center.css').write_text('corrupted')
    with self.assertRaises(ValueError):m.stage(local,inc,out)
    self.assertFalse(out.exists())
 def test_transport_variants_are_recognized(self):
  with tempfile.TemporaryDirectory() as d:
   local,inc,out,html=self.fixture(Path(d));value=(local/'workspace-upgrade.js').read_bytes();(local/'workspace-upgrade.js').write_bytes(b'\xef\xbb\xbf'+value.replace(b'\n',b'\r\n'));m.stage(local,inc,out);self.assertEqual((out/'workspace-upgrade.js').read_bytes(),value)
 def test_atomic_install_readable_permissions_and_rollback_on_failed_publication(self):
  for fail in [False,True]:
   with self.subTest(fail=fail),tempfile.TemporaryDirectory() as d:
    root=Path(d);local,inc,out,html=self.fixture(root);repo=root/'site';(repo/'app').mkdir(parents=True);(repo/'deploy').mkdir();backup=root/'backup';backup.mkdir()
    for p in inc.iterdir():
     if p.name!='event-center-manifest.json':(repo/'app'/p.name).write_bytes(p.read_bytes())
    (repo/'app/index.html').write_text(html);(repo/'deploy/event-center-manifest.json').write_bytes((inc/'event-center-manifest.json').read_bytes());(repo/'deploy/stage-event-center.py').write_bytes((ROOT/'deploy/stage-event-center.py').read_bytes())
    def git(*args):return subprocess.check_output(['git',*args],cwd=repo,text=True,stderr=subprocess.DEVNULL).strip()
    git('init');git('config','user.email','fixture@example.invalid');git('config','user.name','Fixture');git('add','.');git('commit','-m','fixture');revision=git('rev-parse','HEAD');(repo/'app/workspace-upgrade.css').write_text('/* CURRENT_LOCAL_THEME */');(repo/'app/event-center.css').unlink()
    env={**os.environ,'ZETSLAY_SITE_DIR':str(repo),'ZETSLAY_BACKUP_DIR':str(backup),'ZETSLAY_EVENTS_REVISION':revision}
    if fail:
     bin=root/'bin';bin.mkdir();mv=bin/'mv';mv.write_text('#!/bin/bash\ncase "$*" in *event-center.css*) exit 23;; esac\nexec /bin/mv "$@"\n');mv.chmod(0o755);env['PATH']=str(bin)+':'+env['PATH']
    r=subprocess.run(['bash',str(ROOT/'deploy/update-event-center-ui.sh')],env=env,capture_output=True,text=True,timeout=20)
    if fail:self.assertNotEqual(r.returncode,0);self.assertEqual((repo/'app/index.html').read_text(),html);self.assertFalse((repo/'app/event-center.css').exists())
    else:self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertEqual((repo/'app/event-center.css').stat().st_mode&0o777,0o644);self.assertIn('20261027-events-2',(repo/'app/index.html').read_text())
    self.assertEqual((repo/'app/workspace-upgrade.css').read_text(),'/* CURRENT_LOCAL_THEME */');self.assertEqual(next(backup.iterdir()).stat().st_mode&0o777,0o600)
if __name__=='__main__':unittest.main()
