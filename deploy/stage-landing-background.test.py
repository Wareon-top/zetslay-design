from pathlib import Path
import importlib.util,os,re,shutil,subprocess,tarfile,tempfile,unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('background',Path(__file__).with_name('stage-landing-background.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class BackgroundTests(unittest.TestCase):
 def test_only_asset_cache_keys_and_canvas_hook_change(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=root/'local';local.mkdir()
   html=(ROOT/'index.html').read_text().replace('20261024-ascii','VPS-VERSION').replace(' data-hero-ascii','').replace('</body>','<script>/* LOCAL AUTH */</script></body>')
   (local/'index.html').write_text(html);m.stage(local,ROOT,root/'out');result=(root/'out/index.html').read_text()
   expected=html.replace('landing-hero.js?v=VPS-VERSION','landing-hero.js?v='+m.VERSION).replace('landing-orderflow.css?v=VPS-VERSION','landing-orderflow.css?v='+m.VERSION).replace('data-hero-particles>','data-hero-particles data-hero-ascii>')
   self.assertEqual(result,expected);m.stage(root/'out',ROOT,root/'again');self.assertEqual((root/'again/index.html').read_text(),result)
 def test_unknown_or_duplicate_markup_stops_before_staging(self):
  for html in ['unknown',(ROOT/'index.html').read_text().replace('</head>','<script src="landing-hero.js"></script></head>')]:
   with tempfile.TemporaryDirectory() as d:
    root=Path(d);(root/'index.html').write_text(html)
    with self.assertRaises(ValueError):m.stage(root,ROOT,root/'out')
    self.assertFalse((root/'out').exists());self.assertEqual((root/'index.html').read_text(),html)
 def test_installer_preserves_current_page_backs_up_and_restores_on_partial_failure_without_node(self):
  for failure in (False,True):
   with self.subTest(failure=failure),tempfile.TemporaryDirectory() as d:
    root=Path(d);site=root/'site';(site/'deploy').mkdir(parents=True);backup=root/'backup';backup.mkdir()
    for name in ['index.html',*m.ASSETS]:shutil.copy2(ROOT/name,site/name)
    shutil.copy2(ROOT/'deploy/stage-landing-background.py',site/'deploy/stage-landing-background.py')
    def git(*args):return subprocess.run(['git','-C',str(site),*args],capture_output=True,text=True,check=True).stdout.strip()
    git('init','-q');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('add','.');git('commit','-qm','fixture');rev=git('rev-parse','HEAD')
    html=(site/'index.html').read_text().replace('20261024-ascii','LIVE').replace(' data-hero-ascii','')+'\n<!-- CUSTOM FOOTER -->\n';(site/'index.html').write_text(html)
    (site/'landing-hero.js').write_text('// LIVE MOTION');(site/'landing-orderflow.css').write_text('/* LIVE CSS */')
    old={name:(site/name).read_bytes() for name in ['index.html',*m.ASSETS]}
    (site/'app').mkdir();(site/'app/app.js').write_text('KEEP CABINET')
    tools=root/'tools';tools.mkdir()
    for name in ['git','python3','flock','mktemp','mkdir','rm','cp','cmp','chmod','tar','gzip','install','mv','timeout']:(tools/name).symlink_to(shutil.which(name))
    if failure:
     (tools/'mv').unlink();(tools/'mv').write_text('#!/bin/sh\nfor a in "$@";do if [ "$a" = index.html ];then exit 1;fi;done\nexec /bin/mv "$@"\n');(tools/'mv').chmod(0o755)
    env={**os.environ,'PATH':str(tools),'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKGROUND_REVISION':rev,'ZETSLAY_BACKUP_DIR':str(backup)}
    r=subprocess.run([shutil.which('bash'),str(ROOT/'deploy/update-landing-background.sh')],capture_output=True,text=True,env=env,timeout=30)
    self.assertEqual(r.returncode,1 if failure else 0,r.stdout+r.stderr)
    archives=list(backup.glob('*.tar.gz'));self.assertEqual(len(archives),1);self.assertEqual(archives[0].stat().st_mode&0o777,0o600)
    with tarfile.open(archives[0]) as saved:
     for name,data in old.items():self.assertEqual(saved.extractfile(name).read(),data)
    if failure:
     for name,data in old.items():self.assertEqual((site/name).read_bytes(),data)
    else:
     self.assertIn('CUSTOM FOOTER',(site/'index.html').read_text());self.assertIn(m.VERSION,(site/'index.html').read_text());self.assertEqual((site/'landing-hero.js').read_bytes(),(ROOT/'landing-hero.js').read_bytes());self.assertEqual((site/'landing-hero.js').stat().st_mode&0o777,0o644)
    self.assertEqual((site/'app/app.js').read_text(),'KEEP CABINET')
if __name__=='__main__':unittest.main()
