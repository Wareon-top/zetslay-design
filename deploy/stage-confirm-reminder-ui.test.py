import importlib.util
from pathlib import Path
import tempfile
import unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('stage',HERE/'stage-confirm-reminder-ui.py')
stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)
INCOMING=HERE.parent/'app'

class StageTests(unittest.TestCase):
    def fixture(self,path):
        local=path/'local';local.mkdir()
        for name in ['app.js','index.html','plugin-page.js','plugin-page.test.mjs','plugin-cover.js','plugin-cover.test.mjs']:
            (local/name).write_bytes((INCOMING/name).read_bytes())
        page=(local/'plugin-page.js').read_text().replace(stage.HOOK,'').replace(stage.NEW_PERMISSION,stage.OLD_PERMISSION).replace(stage.NEW_CONTEXT,stage.OLD_CONTEXT).replace(stage.REMINDER_BUTTON,'').replace(stage.REMINDER_JUMP,'')
        (local/'plugin-page.js').write_text(page)
        html=(local/'index.html').read_text().replace('https://api.zetslay.pro','https://custom-api.test')
        (local/'index.html').write_text(html)
        return local
    def test_preserves_local_app_api_and_other_views_and_is_idempotent(self):
        with tempfile.TemporaryDirectory(dir=HERE.parent.parent) as tmp:
            path=Path(tmp);local=self.fixture(path);output=path/'out'
            original=(local/'app.js').read_bytes()
            stage.stage(local,INCOMING,output)
            self.assertEqual((output/'app.js').read_bytes(),original)
            self.assertIn('https://custom-api.test',(output/'index.html').read_text())
            self.assertEqual((output/'index.html').read_text().count('data-view="messages"'),1)
            self.assertEqual((output/'plugin-page.js').read_text().count(stage.HOOK),1)
            self.assertEqual((output/'plugin-page.js').read_text().count(stage.REMINDER_BUTTON),1)
            self.assertEqual((output/'plugin-page.js').read_text().count(stage.REMINDER_JUMP),1)
            stage.stage(output,INCOMING,path/'again')
            for name in ['app.js','index.html','plugin-page.js']: self.assertEqual((output/name).read_bytes(),(path/'again'/name).read_bytes())
    def test_updates_previous_reminder_release_without_replacing_other_views(self):
        with tempfile.TemporaryDirectory(dir=HERE.parent.parent) as tmp:
            path=Path(tmp);local=self.fixture(path);output=path/'out'
            page=(INCOMING/'plugin-page.js').read_text().replace(stage.REMINDER_BUTTON,'').replace(stage.REMINDER_JUMP,'')
            (local/'plugin-page.js').write_text(page)
            original=(local/'app.js').read_bytes()
            stage.stage(local,INCOMING,output)
            self.assertEqual((output/'app.js').read_bytes(),original)
            self.assertIn(stage.REMINDER_BUTTON,(output/'plugin-page.js').read_text())
            self.assertIn('20261003-reminder-settings',(output/'index.html').read_text())
    def test_unknown_changes_stop_without_touching_site(self):
        with tempfile.TemporaryDirectory(dir=HERE.parent.parent) as tmp:
            path=Path(tmp);local=self.fixture(path)
            page=(local/'plugin-page.js').read_text().replace(stage.OLD_CONTEXT,'CUSTOM_CONTEXT')
            (local/'plugin-page.js').write_text(page)
            with self.assertRaises(ValueError): stage.stage(local,INCOMING,path/'out')
            self.assertEqual((local/'plugin-page.js').read_text(),page)
            self.assertFalse((path/'out').exists())

if __name__=='__main__':unittest.main()
