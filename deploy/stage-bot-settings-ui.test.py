from pathlib import Path
import importlib.util,tempfile,unittest,subprocess,os,shutil
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage_bot_settings',ROOT/'deploy/stage-bot-settings-ui.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StageTests(unittest.TestCase):
 def test_patch_preserves_local_profile_and_other_cabinet_assets(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);html=(ROOT/'app/index.html').read_text();profile=(ROOT/'app/profile.js').read_text().replace('data-bot-settings-open','data-profile-connect')+'\n// LOCAL PROFILE CHANGE\n'
   (root/'index.html').write_text(html+'\n<!-- LOCAL CABINET -->\n');(root/'profile.js').write_text(profile)
   m.stage(root,ROOT/'app',root/'out');updated=(root/'out/profile.js').read_text();index=(root/'out/index.html').read_text()
   self.assertIn('LOCAL PROFILE CHANGE',updated);self.assertIn('LOCAL CABINET',index);self.assertEqual(updated.count('data-bot-settings-open'),1);self.assertIn('data-profile-connect',updated);self.assertNotIn('app.js', [p.name for p in (root/'out').iterdir()]);self.assertEqual(index.count('src="bot-settings.js'),1)
   m.stage(root/'out',ROOT/'app',root/'twice');self.assertEqual(index,(root/'twice/index.html').read_text());self.assertEqual(updated,(root/'twice/profile.js').read_text())
 def test_no_automation_section_added_when_missing_on_live_site(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);html=(ROOT/'app/index.html').read_text();import re
   html=re.sub(r'<script[^>]*src="store-tools\.js[^\"]*"[^>]*></script>','',html)
   (root/'index.html').write_text(html);(root/'profile.js').write_text((ROOT/'app/profile.js').read_text());m.stage(root,ROOT/'app',root/'out')
   index=(root/'out/index.html').read_text();self.assertNotIn('src="store-tools.js',index);self.assertNotIn('data-view-target="store-tools"',index)
 def test_unknown_button_stops_without_overwriting_files(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);(root/'index.html').write_text((ROOT/'app/index.html').read_text());(root/'profile.js').write_text('unknown custom profile')
   with self.assertRaises(ValueError):m.stage(root,ROOT/'app',root/'out')
   self.assertFalse((root/'out').exists());self.assertEqual((root/'profile.js').read_text(),'unknown custom profile')
 def test_installer_preserves_app_and_checks_staged_bundle(self,container=False):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);site=root/'site';(site/'app').mkdir(parents=True);bin_dir=root/'bin';bin_dir.mkdir();backups=root/'backups';backups.mkdir()
   for name in ['index.html','profile.js']:(site/'app'/name).write_text((ROOT/'app'/name).read_text())
   (site/'app/app.js').write_text('PRESERVE LOCAL CONFIGURATION')
   git=bin_dir/'git';git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$BOT_TEST_SOURCE/$file";;\n*) exit 2;;\nesac\n');git.chmod(0o755)
   env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backups),'BOT_TEST_SOURCE':str(ROOT)}
   if container:
    node=shutil.which('node')
    for name in ['mkdir','mktemp','rm','rmdir','python3','cat','cmp','chmod','tar','gzip','cp','timeout']:(bin_dir/name).symlink_to(shutil.which(name))
    docker=bin_dir/'docker';docker.write_text('#!/bin/sh\nprintf "%s\\n" "$1" >> "$BOT_DOCKER_LOG"\ncase "$1" in\nps) echo fixture-api;;\nexec) [ "$2" = -i ] && [ "$3" = fixture-api ] && [ "$4" = node ] || exit 2;shift 4;exec '+node+' "$@";;\n*) exit 2;;\nesac\n');docker.chmod(0o755);env.update(PATH=str(bin_dir),BOT_DOCKER_LOG=str(root/'docker.log'))
   result=subprocess.run(['/bin/bash',str(ROOT/'deploy/update-bot-settings-ui.sh')],env=env,capture_output=True,text=True);self.assertEqual(result.returncode,0,result.stdout+result.stderr);self.assertEqual((site/'app/app.js').read_text(),'PRESERVE LOCAL CONFIGURATION');self.assertEqual(len(list(backups.iterdir())),1)
   if container:self.assertEqual((root/'docker.log').read_text().splitlines(),['ps','exec'])
 def test_existing_api_runtime_is_used_without_container_recreation(self):self.test_installer_preserves_app_and_checks_staged_bundle(container=True)
if __name__=='__main__':unittest.main()
