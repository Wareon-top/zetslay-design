import importlib.util
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('stage',Path(__file__).with_name('stage-admin-panel-ui.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StageTest(unittest.TestCase):
    def fixture(self,root):
        local=root/'local';incoming=root/'incoming';out=root/'out';local.mkdir();incoming.mkdir()
        (local/'app.js').write_text("const viewTitles = {\n  guide: 'База знаний',\nfunction resetAccountData() {\n}\nfunction renderAuthState() {\n}\n  if (typeof renderPluginPage === 'function') renderPluginPage();\n  window.scrollTo({});\n// LOCAL CUSTOMIZATION\n")
        (local/'index.html').write_text('<head></head><nav><button data-view-target="guide">Guide</button></nav><section class="view billing-page"></section><script src="app.js?v=old" defer></script><!-- LOCAL DESIGN -->')
        for name in ['admin-panel.js','admin-panel.css']:(incoming/name).write_text('new '+name)
        return local,incoming,out
    def test_customizations_and_idempotence(self):
        with tempfile.TemporaryDirectory() as d:
            local,inc,out=self.fixture(Path(d));m.stage(local,inc,out)
            self.assertIn('LOCAL CUSTOMIZATION',(out/'app.js').read_text());self.assertIn('LOCAL DESIGN',(out/'index.html').read_text())
            out2=Path(d)/'second';m.stage(out,inc,out2)
            for file in ['app.js','index.html','admin-panel.js','admin-panel.css']:self.assertEqual((out/file).read_bytes(),(out2/file).read_bytes())
    def test_unknown_structure_leaves_cabinet_untouched(self):
        with tempfile.TemporaryDirectory() as d:
            local,inc,out=self.fixture(Path(d));(local/'app.js').write_text('unknown');before=(local/'index.html').read_bytes()
            with self.assertRaises(ValueError):m.stage(local,inc,out)
            self.assertFalse(out.exists());self.assertEqual(before,(local/'index.html').read_bytes())
if __name__=='__main__':unittest.main()
