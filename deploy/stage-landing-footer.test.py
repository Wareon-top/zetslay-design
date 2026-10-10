import importlib.util
from pathlib import Path
import tempfile
import re
import unittest

HERE=Path(__file__).resolve().parent
REPO=HERE.parent
spec=importlib.util.spec_from_file_location('stage',HERE/'stage-landing-footer.py')
stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)
class FooterStageTests(unittest.TestCase):
    def fixture(self,root):
        local=root/'local';local.mkdir()
        text=(REPO/'index.html').read_text()
        footer=stage.footer_section(text)
        text=text[:footer.start()]+'<footer class="site-footer">Старый footer</footer>'+text[footer.end():]
        text=re.sub(r'  <link rel="stylesheet" href="landing-footer.css[^"\n]*">\n','',text)
        text=re.sub(r'  <script src="landing-footer.js[^"\n]*" defer></script>\n','',text)
        text=text.replace('Магазин под вашим','Локальная правка: магазин под вашим')
        (local/'index.html').write_text(text)
        (local/'app').mkdir();(local/'app'/'app.js').write_text('Рабочий кабинет')
        return local
    def strip(self,text):
        footer=stage.footer_section(text)
        text=text[:footer.start()]+'<FOOTER>'+text[footer.end():]
        text=re.sub(r'  <link rel="stylesheet" href="landing-footer.css[^"\n]*">\n','',text)
        return re.sub(r'  <script src="landing-footer.js[^"\n]*" defer></script>\n','',text)
    def test_preserves_all_other_sections_and_does_not_touch_cabinet(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);local=self.fixture(root);before=(local/'index.html').read_text()
            stage.stage(local,REPO,root/'out');after=(root/'out'/'index.html').read_text()
            self.assertEqual(self.strip(before),self.strip(after))
            self.assertEqual((local/'index.html').read_text(),before)
            self.assertEqual((local/'app'/'app.js').read_text(),'Рабочий кабинет')
            self.assertEqual(sorted(p.name for p in (root/'out').iterdir()),['index.html','landing-footer.css','landing-footer.js'])
    def test_repeat_install_has_one_asset_and_same_markup(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);local=self.fixture(root)
            stage.stage(local,REPO,root/'out');stage.stage(root/'out',REPO,root/'again')
            self.assertEqual((root/'out'/'index.html').read_bytes(),(root/'again'/'index.html').read_bytes())
            text=(root/'again'/'index.html').read_text()
            self.assertEqual(text.count('landing-footer.css?v='),1);self.assertEqual(text.count('landing-footer.js?v='),1)
    def test_old_faq_without_question_ids_keeps_working_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);local=self.fixture(root);path=local/'index.html'
            path.write_text(re.sub(r' id="faq-[a-z-]+"','',path.read_text()))
            stage.stage(local,REPO,root/'out');text=stage.footer_section((root/'out'/'index.html').read_text()).group()
            self.assertNotRegex(text,r'href="#faq-[a-z-]+"');self.assertIn('href="#faq"',text)
    def test_unknown_structure_or_duplicate_stylesheet_stops_before_writes(self):
        changes=[lambda s:s+'<footer class="site-footer"></footer>',lambda s:s.replace('id="tariffs"','id="other"'),lambda s:s.replace('</head>','<link href="landing-footer.css"><link href="landing-footer.css"></head>')]
        for change in changes:
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory);local=self.fixture(root);path=local/'index.html';path.write_text(change(path.read_text()));before=path.read_bytes()
                with self.assertRaises(ValueError):stage.stage(local,REPO,root/'out')
                self.assertFalse((root/'out').exists());self.assertEqual(path.read_bytes(),before)
if __name__=='__main__':unittest.main()
