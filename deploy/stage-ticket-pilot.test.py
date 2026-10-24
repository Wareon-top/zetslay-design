import importlib.util,shutil,tempfile,unittest,re,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('ticket_stage',ROOT/'deploy/stage-ticket-pilot.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTest(unittest.TestCase):
 def fixture(self,path):
  names=['index.html','app/index.html','app/app.js','app/plugin-page.js','app/plugin-rarity.js','app/subscription-access.js','landing-pricing.css','app/billing-pricing.css','app/billing-section.html']
  for name in names:
   p=path/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((ROOT/name).read_bytes())
  p=path/'app/app.js';p.write_text(p.read_text().replace("  if(typeof resetTicketPilotUi==='function')resetTicketPilotUi();\n",'')+'\n// PRIVATE_SYNC_CUSTOMIZATION\n')
  p=path/'app/index.html';s=re.sub(r'<script src="ticket-pilot\.js[^>]*></script>','',p.read_text());s=re.sub(r'<link rel="stylesheet" href="ticket-pilot\.css[^>]*>','',s);p.write_text(s.replace('</body>','<aside data-private-banner></aside>\n</body>'))
 def test_preserve_and_repeat(self):
  with tempfile.TemporaryDirectory() as d:
   d=Path(d);local=d/'local';self.fixture(local);out=d/'out';module.stage(local,ROOT,out);second=d/'second';module.stage(out,ROOT,second)
   app=(out/'app/app.js').read_text();html=(out/'app/index.html').read_text();self.assertIn('PRIVATE_SYNC_CUSTOMIZATION',app);self.assertIn('data-private-banner',html);self.assertIn('data-support-root="user"',html);self.assertEqual(app.count("if(typeof resetTicketPilotUi==='function')resetTicketPilotUi();"),1);self.assertEqual(html.count('src="ticket-pilot.js?'),1)
   for name in ['app/app.js','app/plugin-page.js','app/plugin-rarity.js','app/subscription-access.js','app/index.html','subscription-plans.json']:self.assertEqual((out/name).read_bytes(),(second/name).read_bytes(),name)
 def test_unknown_cabinet_stops(self):
  with tempfile.TemporaryDirectory() as d:
   d=Path(d);local=d/'local';self.fixture(local);p=local/'app/app.js';p.write_text('unknown cabinet');before=p.read_text()
   with self.assertRaises(ValueError):module.stage(local,ROOT,d/'out')
   self.assertEqual(p.read_text(),before)
 def test_real_pre_ai_catalog_installs_without_other_optional_plugins(self):
  with tempfile.TemporaryDirectory() as d:
   d=Path(d);local=d/'local';self.fixture(local)
   legacy=json.loads((ROOT/'deploy/fixtures/ticket-pilot-pre-ai.json').read_text())
   for name,text in legacy['files'].items():(local/name).write_text(text)
   access=local/'app/subscription-access.js'
   access.write_text(re.sub(r"'zetslay\.(?:ticket-pilot|ai-reviews)'\s*:\s*2\s*,\s*",'',access.read_text()))
   before={name:(local/name).read_text() for name in legacy['files']}
   out=d/'out';module.stage(local,ROOT,out)
   page=(out/'app/plugin-page.js').read_text();rarity=(out/'app/plugin-rarity.js').read_text();tier=(out/'app/subscription-access.js').read_text()
   self.assertNotIn('zetslay.ai-reviews',page)
   for group in json.loads((ROOT/'subscription-plans.json').read_text())['pluginGroups']:
    for plugin in group['plugins']:self.assertIn("'"+plugin['id']+"':",rarity);self.assertIn("'"+plugin['id']+"':",tier)
   self.assertIn(module.CONTROL_COPY,page);self.assertIn("'zetslay.ticket-pilot':'ultra'",rarity);self.assertIn("'zetslay.ticket-pilot':2",tier)
   self.assertIn('data-support-root="user"',(out/'app/index.html').read_text());self.assertIn('PRIVATE_SYNC_CUSTOMIZATION',(out/'app/app.js').read_text())
   for name,text in before.items():self.assertEqual((local/name).read_text(),text)
   for name in ['app/app.js','app/plugin-page.js','app/plugin-rarity.js','app/subscription-access.js']:subprocess.run(['node','--check',str(out/name)],check=True,capture_output=True)
   second=d/'second';module.stage(out,ROOT,second)
   for name in ['app/plugin-page.js','app/plugin-rarity.js','app/subscription-access.js','app/index.html']:self.assertEqual((out/name).read_bytes(),(second/name).read_bytes(),name)
 def test_existing_ticket_copy_does_not_require_an_ai_branch_and_preserves_customizations(self):
  with tempfile.TemporaryDirectory() as d:
   d=Path(d);local=d/'local';self.fixture(local)
   page=local/'app/plugin-page.js';text=page.read_text()
   text=re.sub(r" : plugin\.id === 'zetslay\.ai-reviews' \? '[^']*'",'',text);page.write_text(text+'\n// PRIVATE_PLUGIN_CUSTOMIZATION\n')
   module.stage(local,ROOT,d/'out');result=(d/'out/app/plugin-page.js').read_text()
   self.assertEqual(result.count(module.CONTROL_COPY),1);self.assertIn('PRIVATE_PLUGIN_CUSTOMIZATION',result)
 def test_conflicting_ticket_tier_fails_without_touching_installed_files(self):
  with tempfile.TemporaryDirectory() as d:
   d=Path(d);local=d/'local';self.fixture(local)
   access=local/'app/subscription-access.js';access.write_text(access.read_text().replace("'zetslay.ticket-pilot':2","'zetslay.ticket-pilot':0"));before=access.read_text()
   with self.assertRaises(ValueError):module.stage(local,ROOT,d/'out')
   self.assertEqual(access.read_text(),before)
if __name__=='__main__':unittest.main()
