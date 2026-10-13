import importlib.util
from pathlib import Path
import shutil
import re
import tempfile
import unittest
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('stage_reliability',root/'deploy/stage-reliability.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTest(unittest.TestCase):
 def test_surgical_and_repeatable(self):
  with tempfile.TemporaryDirectory() as tmp:
   tmp=Path(tmp);local=tmp/'local';shutil.copytree(root/'app',local)
   app=local/'app.js';app.write_text(app.read_text()+'\n// OWNER_CUSTOMIZATION\n')
   kosell=local/'kosell-rent.js';s=kosell.read_text();a=s.index('function kosellOfferDiagnosticsMarkup(');b=s.index('function kosellAutomationFields(',a);s=s[:a]+s[b:];s=s.replace('${kosellOfferDiagnosticsMarkup(j)}',"${j.code?`<p>${escapeHtml(j.code)}</p>`:''}");s=re.sub(r'<article><span>Автоматическая выдача</span>.*?</article>',lambda m:"<article><span>Автоматическая выдача</span><strong>${c.automatic?'Включена':'Выключена'}</strong></article>",s,flags=re.S);kosell.write_text(s)
   out=tmp/'out';module.stage(local,root/'app',out);self.assertIn('OWNER_CUSTOMIZATION',(out/'app.js').read_text());self.assertIn('AbortSignal.timeout',(out/'app.js').read_text());self.assertIn('BASELINE_PENDING',(out/'kosell-rent.js').read_text());self.assertIn('Накопленная история',(out/'overview.js').read_text());self.assertIn('Конфликты автовыдачи',(out/'admin-panel.js').read_text());self.assertEqual((local/'app.js').read_text(),app.read_text())
   repeat=tmp/'repeat';module.stage(out,root/'app',repeat)
   for name in ['app.js','kosell-rent.js','overview.js','admin-panel.js','index.html']:self.assertEqual((out/name).read_text(),(repeat/name).read_text())
 def test_unknown_shape_blocks_installation(self):
  with tempfile.TemporaryDirectory() as tmp:
   tmp=Path(tmp);local=tmp/'local';shutil.copytree(root/'app',local);(local/'app.js').write_text('unknown')
   with self.assertRaises(ValueError):module.stage(local,root/'app',tmp/'out')
   self.assertEqual((local/'app.js').read_text(),'unknown')
if __name__=='__main__':unittest.main()
