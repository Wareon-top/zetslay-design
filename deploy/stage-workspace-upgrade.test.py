import importlib.util,subprocess,tempfile,unittest,os
from pathlib import Path
spec=importlib.util.spec_from_file_location('workspace',Path(__file__).with_name('stage-workspace-upgrade.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ROOT=Path(__file__).resolve().parents[1]
class WorkspaceTests(unittest.TestCase):
 def test_stage_preserves_current_pages_banners_and_private_copy(self):
  with tempfile.TemporaryDirectory() as temp:
   p=Path(temp);local=p/'local';local.mkdir();html='<html><head></head><body><main class="view-stack" data-overview><div class="overview-grid"></div>PRIVATE_CANARY <section data-proxy-invite>KEEP_PROXY</section><section data-video-guide>KEEP_VIDEO</section></main><script src="app.js"></script><script src="proxy-shop.js"></script></body></html>';(local/'index.html').write_text(html)
   m.stage(local,ROOT/'app',p/'out');out=(p/'out/index.html').read_text();self.assertIn('PRIVATE_CANARY',out);self.assertIn('KEEP_PROXY',out);self.assertIn('KEEP_VIDEO',out);self.assertEqual(out.count('src="workspace-upgrade.js?'),1);m.stage(p/'out',ROOT/'app',p/'again');self.assertEqual(out,(p/'again/index.html').read_text())
 def test_unknown_structure_fails_before_writing(self):
  with tempfile.TemporaryDirectory() as temp:
   p=Path(temp);(p/'index.html').write_text('<html></html>')
   with self.assertRaises(ValueError):m.stage(p,ROOT/'app',p/'out')
   self.assertFalse((p/'out').exists())
 def test_atomic_installer_restores_html_and_removes_new_assets_after_failure(self):
  with tempfile.TemporaryDirectory() as temp:
   p=Path(temp);site=p/'site';(site/'app').mkdir(parents=True);backup=p/'backup';backup.mkdir();bin=p/'bin';bin.mkdir();html='<html><head></head><body><main class="view-stack" data-overview><div class="overview-grid"></div>KEEP</main><script src="app.js"></script><script src="proxy-shop.js"></script></body></html>';(site/'app/index.html').write_text(html)
   git=bin/'git';git.write_text('#!/usr/bin/env python3\nimport sys,subprocess\nfrom pathlib import Path\na=sys.argv[1:];root=Path('+repr(str(ROOT))+')\nif a[0]=="rev-parse":\n print(subprocess.check_output(["/usr/bin/git","hash-object",str(root/a[1].split(":",1)[1])],text=True).strip() if ":" in a[1] else "fixture")\nelif a[0]=="show":sys.stdout.write((root/a[1].split(":",1)[1]).read_text())\nelif a[0]=="hash-object":subprocess.run(["/usr/bin/git",*a],check=True)\n');git.chmod(0o755)
   mv=bin/'mv';mv.write_text('#!/bin/bash\nif [[ "${@: -1}" == app/index.html ]];then exit 7;fi\nexec /bin/mv "$@"\n');mv.chmod(0o755)
   env={**os.environ,'PATH':str(bin)+':'+os.environ['PATH'],'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backup),'ZETSLAY_WORKSPACE_REVISION':'fixture'};r=subprocess.run(['bash',str(ROOT/'deploy/update-workspace-ui.sh')],env=env,capture_output=True,text=True);self.assertNotEqual(r.returncode,0);self.assertEqual((site/'app/index.html').read_text(),html);self.assertFalse((site/'app/workspace-upgrade.js').exists());self.assertEqual(len(list(backup.glob('*.tar.gz'))),1)
if __name__=='__main__':unittest.main()
