import importlib.util,shutil,tempfile,unittest,re
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
if __name__=='__main__':unittest.main()
