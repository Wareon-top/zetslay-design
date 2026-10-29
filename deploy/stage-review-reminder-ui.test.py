import importlib.util
from pathlib import Path
import tempfile
import unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('review_stage',HERE/'stage-review-reminder-ui.py')
stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)
INCOMING=HERE.parent/'app'

class StageTests(unittest.TestCase):
    def fixture(self,path):
        local=path/'local';local.mkdir()
        for name in ['app.js','index.html','plugin-page.js','confirm-reminder.js','confirm-reminder.css','confirm-reminder.test.mjs','plugin-cover.js']:
            (local/name).write_bytes((INCOMING/name).read_bytes())
        page=(local/'plugin-page.js').read_text().replace(stage.HOOK,'').replace(stage.BUTTON,'').replace(stage.JUMP,'').replace(stage.NEW_PERMISSION,stage.OLD_PERMISSION).replace(stage.NEW_CONTEXT,stage.OLD_CONTEXT)
        page=page.replace('Контроль остаётся у вас','Локальная подпись VPS')
        (local/'plugin-page.js').write_text(page)
        html=(local/'index.html').read_text().replace('https://api.zetslay.pro','https://custom-api.test')
        (local/'index.html').write_text(html)
        return local
    def test_preserves_local_auth_connector_other_views_and_confirm_settings(self):
        with tempfile.TemporaryDirectory(dir=HERE.parent.parent) as tmp:
            path=Path(tmp);local=self.fixture(path);output=path/'out'
            original=(local/'app.js').read_bytes();confirm=(local/'confirm-reminder.js').read_bytes()
            stage.stage(local,INCOMING,output)
            self.assertEqual((output/'app.js').read_bytes(),original)
            self.assertEqual((output/'confirm-reminder.js').read_bytes(),confirm)
            html=(output/'index.html').read_text();page=(output/'plugin-page.js').read_text()
            self.assertIn('https://custom-api.test',html)
            self.assertIn('admin-access.css',html)
            self.assertIn('data-view="messages"',html)
            self.assertIn('Локальная подпись VPS',page)
            self.assertIn('data-reminder-open-settings',page)
            self.assertIn(stage.HOOK,page)
    def test_idempotent_update_never_duplicates_assets_or_controls(self):
        with tempfile.TemporaryDirectory(dir=HERE.parent.parent) as tmp:
            path=Path(tmp);local=self.fixture(path);output=path/'out'
            stage.stage(local,INCOMING,output);stage.stage(output,INCOMING,path/'again')
            for name in ['app.js','plugin-page.js','index.html']:
                self.assertEqual((output/name).read_bytes(),(path/'again'/name).read_bytes())
            self.assertEqual((output/'index.html').read_text().count('src="review-reminder.js'),1)
    def test_unknown_context_stops_before_output_without_editing_live_files(self):
        with tempfile.TemporaryDirectory(dir=HERE.parent.parent) as tmp:
            path=Path(tmp);local=self.fixture(path)
            page=(local/'plugin-page.js').read_text().replace(stage.OLD_CONTEXT,'UNKNOWN_LOCAL_CONTEXT')
            (local/'plugin-page.js').write_text(page)
            with self.assertRaises(ValueError):stage.stage(local,INCOMING,path/'out')
            self.assertEqual((local/'plugin-page.js').read_text(),page)
            self.assertFalse((path/'out').exists())
    def test_missing_confirm_module_fails_before_creating_staged_files(self):
        with tempfile.TemporaryDirectory(dir=HERE.parent.parent) as tmp:
            path=Path(tmp);local=self.fixture(path)
            (local/'index.html').write_text((local/'index.html').read_text().replace('confirm-reminder.css','removed.css'))
            with self.assertRaises(ValueError):stage.stage(local,INCOMING,path/'out')
            self.assertFalse((path/'out').exists())

if __name__=='__main__':unittest.main()
