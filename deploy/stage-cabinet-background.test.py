from pathlib import Path
import importlib.util,os,re,shutil,subprocess,tempfile,tarfile,unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('bg',Path(__file__).with_name('stage-cabinet-background.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class BackgroundTests(unittest.TestCase):
 def bare_html(self):
  html=(ROOT/'app/index.html').read_text()
  html=re.sub(r'[ \t]*<link\b[^>]*href="cabinet-background.css[^\"]*"[^>]*>\n?','',html)
  return re.sub(r'<script\b[^>]*src="cabinet-background.js[^\"]*"[^>]*></script>\n?','',html)
 def test_staging_changes_only_its_two_resource_tags_and_is_repeatable(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);local=root/'local';local.mkdir();html=self.bare_html().replace('https://api.zetslay.pro','https://private-api.test')+'\n<!-- VPS CUSTOM -->\n';(local/'index.html').write_text(html)
   m.stage(local,ROOT/'app',root/'out');result=(root/'out/index.html').read_text();expected=html.replace('</head>','  <link rel="stylesheet" href="cabinet-background.css?v='+m.VERSION+'">\n</head>').replace('</body>','<script src="cabinet-background.js?v='+m.VERSION+'" defer></script>\n</body>')
   self.assertEqual(result,expected);m.stage(root/'out',ROOT/'app',root/'again');self.assertEqual((root/'again/index.html').read_text(),result);self.assertFalse((root/'out/app.js').exists())
 def test_unknown_structure_stops_before_staging(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'index.html').write_text('unknown')
   with self.assertRaises(ValueError):m.stage(root,ROOT/'app',root/'out')
   self.assertFalse((root/'out').exists())
 def test_installer_without_node_backs_up_and_restores_partial_failure(self):
  for fail in (False,True):
   with self.subTest(fail=fail),tempfile.TemporaryDirectory() as d:
    root=Path(d);site=root/'site';(site/'app').mkdir(parents=True);(site/'deploy').mkdir();backup=root/'backup';backup.mkdir()
    (site/'app/index.html').write_text((ROOT/'app/index.html').read_text())
    for name in m.ASSETS:shutil.copy2(ROOT/'app'/name,site/'app'/name)
    shutil.copy2(ROOT/'deploy/stage-cabinet-background.py',site/'deploy/stage-cabinet-background.py')
    def git(*a):return subprocess.run(['git','-C',str(site),*a],capture_output=True,text=True,check=True).stdout.strip()
    git('init','-q');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('add','.');git('commit','-qm','fixture');revision=git('rev-parse','HEAD')
    original=self.bare_html()+'\n<!-- VPS CUSTOM -->';(site/'app/index.html').write_text(original)
    for name in m.ASSETS:(site/'app'/name).unlink()
    (site/'app/app.js').write_text('CURRENT AUTH AND BOT FIXES')
    tools=root/'bin';tools.mkdir()
    for name in ['git','python3','flock','mktemp','mkdir','rm','cp','cmp','chmod','tar','gzip','install','mv','timeout']:(tools/name).symlink_to(shutil.which(name))
    if fail:
     (tools/'mv').unlink();(tools/'mv').write_text('#!/bin/sh\nfor a in "$@";do if [ "$a" = app/index.html ];then exit 1;fi;done\nexec /bin/mv "$@"\n');(tools/'mv').chmod(0o755)
    env={**os.environ,'PATH':str(tools),'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_CABINET_BACKGROUND_REVISION':revision,'ZETSLAY_BACKUP_DIR':str(backup)}
    result=subprocess.run([shutil.which('bash'),str(ROOT/'deploy/update-cabinet-background.sh')],capture_output=True,text=True,env=env,timeout=30)
    self.assertEqual(result.returncode,1 if fail else 0,result.stdout+result.stderr);self.assertEqual((site/'app/app.js').read_text(),'CURRENT AUTH AND BOT FIXES')
    archives=list(backup.glob('*.tar.gz'));self.assertEqual(len(archives),1);self.assertEqual(archives[0].stat().st_mode&0o777,0o600)
    with tarfile.open(archives[0])as archive:self.assertEqual(archive.extractfile('app/index.html').read().decode(),original)
    if fail:
     self.assertEqual((site/'app/index.html').read_text(),original);self.assertTrue(all(not(site/'app'/n).exists()for n in m.ASSETS))
    else:
     self.assertEqual((site/'app/index.html').read_text().count('src="cabinet-background.js?'),1)
     for name in m.ASSETS:self.assertEqual((site/'app'/name).stat().st_mode&0o777,0o644)
if __name__=='__main__':unittest.main()
