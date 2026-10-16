import unittest,tempfile,shutil,importlib.util,subprocess,os,json,copy
from contextlib import contextmanager
from pathlib import Path
REPO=Path(__file__).parents[1].resolve();spec=importlib.util.spec_from_file_location('stage',REPO/'deploy/stage-tariff-catalog.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
@contextmanager
def installation():
 with tempfile.TemporaryDirectory() as d:
  root=Path(d);site=root/'site';shutil.copytree(REPO,site,ignore=shutil.ignore_patterns('.git','node_modules','__pycache__'))
  backup=root/'backup';backup.mkdir();logs=root/'logs';logs.mkdir();bin=root/'bin';bin.mkdir();git=bin/'git'
  git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; if [ "$file" = app/tariff-summary.js ] && [ "${TARIFF_FIXTURE_BAD_SCRIPT:-false}" = true ]; then echo "const invalid = ;"; else exec cat "$TARIFF_FIXTURE_SOURCE/$file"; fi;;\n*) exit 2;;\nesac\n');git.chmod(0o755)
  env={**os.environ,'PATH':str(bin)+os.pathsep+os.environ['PATH'],'TARIFF_FIXTURE_SOURCE':str(REPO),'ZETSLAY_SITE_DIR':str(site),'ZETSLAY_BACKUP_DIR':str(backup),'ZETSLAY_LOG_DIR':str(logs)}
  yield site,backup,logs,env

def install(env):
 return subprocess.run(['bash',str(REPO/'deploy/update-tariff-catalog-ui.sh')],env=env,capture_output=True,text=True)

class StageTest(unittest.TestCase):
 def test_idempotent_surgical_sections_and_local_styles(self):
  with tempfile.TemporaryDirectory() as d:
   local=Path(d)/'local';shutil.copytree(REPO,local,ignore=shutil.ignore_patterns('.git','node_modules','__pycache__'));out=Path(d)/'out';again=Path(d)/'again';p=local/'app/index.html';p.write_text(p.read_text().replace('</body>','<p>LOCAL CABINET</p></body>'));p=local/'index.html';p.write_text(p.read_text().replace('</body>','<p>LOCAL LANDING</p></body>'))
   for name in ['landing-pricing.css','app/billing-pricing.css']:
    p=local/name;p.write_text(p.read_text().replace(m.MARKER,'/* LOCAL PRICING COLORS */\n'+m.MARKER))
   m.stage(local,REPO,out);m.stage(out,REPO,again)
   for p in out.rglob('*'):
    if p.is_file():self.assertEqual(p.read_bytes(),(again/p.relative_to(out)).read_bytes())
   self.assertIn('LOCAL CABINET',(out/'app/index.html').read_text());self.assertIn('LOCAL LANDING',(out/'index.html').read_text());self.assertIn('auto-refresh.js?v=20261016-background-snapshots',(out/'app/index.html').read_text());self.assertIn('/* LOCAL PRICING COLORS */',(out/'landing-pricing.css').read_text());self.assertFalse((out/'app/app.js').exists());self.assertFalse((out/'app/payments.js').exists())
 def test_duplicate_sections_fail_without_changes(self):
  with tempfile.TemporaryDirectory() as d:
   local=Path(d)/'local';(local/'app').mkdir(parents=True);(local/'index.html').write_text((REPO/'index.html').read_text()+'<section id="tariffs"></section>');(local/'app/index.html').write_text((REPO/'app/index.html').read_text());out=Path(d)/'out'
   with self.assertRaises(ValueError):m.stage(local,REPO,out)
   self.assertFalse(out.exists())
 def test_actual_installer_preserves_payments_auth_legal_and_different_surface_themes(self):
  with installation() as (site,backup,logs,env):
   names=['app/app.js','app/payments.js','app/billing.js','app/auto-refresh.js','legal/publication.json','legal/documents.json'];before={n:(site/n).read_bytes() for n in names}
   styles={'landing-pricing.css':'/* LIVE LANDING THEME */\n','app/billing-pricing.css':'/* LIVE CABINET THEME */\n'}
   for name,prefix in styles.items():p=site/name;p.write_text(prefix+p.read_text())
   r=install(env);self.assertEqual(r.returncode,0,r.stdout[-4000:]+r.stderr[-3000:]);self.assertEqual({n:(site/n).read_bytes() for n in names},before);self.assertEqual(len(list(backup.iterdir())),1)
   for name,prefix in styles.items():self.assertTrue((site/name).read_text().startswith(prefix))
   log=list(logs.glob('*.log'));self.assertEqual(len(log),1);self.assertIn('# tests 24',log[0].read_text());self.assertIn('# pass 24',log[0].read_text());self.assertEqual(log[0].stat().st_mode & 0o777,0o600);self.assertIn(str(log[0]),r.stdout)
 def test_genuine_access_mismatch_blocks_all_publication_and_survives_in_log(self):
  with installation() as (site,backup,logs,env):
   p=site/'app/plugin-rarity.js';p.write_text(p.read_text().replace("'zetslay.ai-reviews':'ultra'","'zetslay.ai-reviews':'legendary'"))
   before={str(p.relative_to(site)):p.read_bytes() for p in site.rglob('*') if p.is_file()};r=install(env)
   self.assertNotEqual(r.returncode,0);self.assertEqual({str(p.relative_to(site)):p.read_bytes() for p in site.rglob('*') if p.is_file()},before);self.assertFalse(list(backup.iterdir()));self.assertFalse((site/'.zetslay-tariff-catalog-update.lock').exists())
   log=list(logs.glob('*.log'));self.assertEqual(len(log),1);self.assertIn('not ok',log[0].read_text());tail=r.stdout.split('Установка остановлена до публикации.')[-1];self.assertIn('current subscription catalogue',tail);self.assertIn('Полный лог сохранён',tail)
 def test_invalid_script_stops_before_running_tests_or_publishing(self):
  with installation() as (site,backup,logs,env):
   before={str(p.relative_to(site)):p.read_bytes() for p in site.rglob('*') if p.is_file()};r=install({**env,'TARIFF_FIXTURE_BAD_SCRIPT':'true'})
   self.assertNotEqual(r.returncode,0);self.assertEqual({str(p.relative_to(site)):p.read_bytes() for p in site.rglob('*') if p.is_file()},before);self.assertFalse(list(backup.iterdir()));log=next(logs.glob('*.log')).read_text();self.assertIn('SyntaxError',log);self.assertNotIn('TAP version',log);self.assertIn('SyntaxError',r.stdout.split('Установка остановлена до публикации.')[-1])
if __name__=='__main__':unittest.main()
