from pathlib import Path
import importlib.util
import shutil
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('cover_stage', ROOT / 'deploy/stage-cover-upload-ui.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class StageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.local, self.incoming, self.out = [self.root / p for p in ['local', 'incoming', 'out']]
        self.local.mkdir(); self.incoming.mkdir()
        for name in ['app.js', 'plugin-page.js', 'index.html']:
            old = (ROOT / 'app' / name).read_text()
            if name == 'app.js':
                old = old.replace('event => uploadPluginCover(event.target)', 'event => legacyPluginCoverUpload(event.target)')
            if name == 'plugin-page.js':
                old = old.replace('Исходная рамка 4:2,9', 'Рамка 16:9')
            if name == 'app.js':
                old += '\n// LOCAL_CONNECTOR_AND_AUTH\n'
                old = old.replace('Protected single-account connection', 'LOCAL_MODE')
            if name == 'plugin-page.js':
                old += '\n// LOCAL_GUIDE\n'
            if name == 'index.html':
                old = old.replace('https://api.zetslay.pro', 'https://api.local.test')
            (self.local / name).write_text(old)
        for name in ['app.js', 'plugin-page.js', 'plugin-cover.js', 'plugin-cover.css', 'plugin-cover.test.mjs']:
            shutil.copyfile(ROOT / 'app' / name, self.incoming / name)
        for name in ['app.js', 'plugin-page.js']:
            original = (self.local / name).read_text().replace('// LOCAL_CONNECTOR_AND_AUTH','// BASE').replace('// LOCAL_GUIDE','// BASE')
            (self.incoming / ('base-' + name)).write_text(original)

    def tearDown(self): self.tmp.cleanup()

    def test_preserves_local_views_auth_guides_and_is_idempotent(self):
        module.stage(self.local, self.incoming, self.out)
        app = (self.out / 'app.js').read_text()
        self.assertIn('LOCAL_CONNECTOR_AND_AUTH', app)
        self.assertIn('uploadPluginCover(event.target)', app)
        self.assertIn('LOCAL_GUIDE', (self.out / 'plugin-page.js').read_text())
        self.assertIn('https://api.local.test', (self.out / 'index.html').read_text())
        self.assertIn('aspect-ratio: 4 / 2.9', (self.out / 'plugin-cover.css').read_text())
        second=self.root / 'second'; module.stage(self.out, self.incoming, second)
        for name in ['app.js','plugin-page.js','index.html','plugin-cover.js','plugin-cover.css']:
            self.assertEqual((self.out / name).read_bytes(),(second / name).read_bytes())
        # Substituting the four touched functions restores the exact original app.
        original=(self.local / 'app.js').read_text()
        for name in ['renderPluginAdminAccess','renderPlugins','bindInteractions','compressPluginCover']:
            app=app.replace(module.function(app,name).group(),module.function(original,name).group())
        self.assertEqual(app,original)

    def test_unknown_upload_handler_or_conflicts_leave_live_files_unchanged(self):
        original=(self.local / 'app.js').read_text()
        for bad in [original.replace('legacyPluginCoverUpload(event.target)','customUpload(event.target)'),'<<<<<<< VPS\n'+original]:
            (self.local / 'app.js').write_text(bad)
            with self.assertRaises(ValueError):module.stage(self.local,self.incoming,self.out)
            self.assertFalse(self.out.exists())
            self.assertEqual((self.local / 'app.js').read_text(),bad)

    def test_historical_admin_toolbar_labels_and_missing_guidance_preserve_access_checks_and_buttons(self):
        original=(self.local / 'plugin-page.js').read_text()
        for omit in [False,True]:
            with self.subTest(omit=omit):
                changed=original.replace(' Обложки</button>',' Загрузить свои изображения</button>')
                changed=changed.replace('const allowed = canManagePluginCatalog();','const allowed = canManagePluginCatalog(); // LOCAL_OWNER_CHECK')
                changed=re.sub(r'<p class="plugin-cover-guidance">.*?</p>','' if omit else '<p class="plugin-cover-guidance">Старая инструкция 16:9</p>',changed)
                (self.local / 'plugin-page.js').write_text(changed)
                out=self.root / ('missing' if omit else 'historical')
                module.stage(self.local,self.incoming,out)
                actual=(out / 'plugin-page.js').read_text()
                self.assertIn('LOCAL_OWNER_CHECK',actual)
                self.assertIn('Загрузить свои изображения',actual)
                self.assertIn('Исходная рамка 4:2,9',actual)
                self.assertEqual(actual.count('<p class="plugin-cover-guidance">'),1)
                strip=lambda s:re.sub(r'<p class="plugin-cover-guidance">.*?</p>','',s)
                self.assertEqual(strip(actual),strip(changed))
                module.stage(out,self.incoming,out)
                self.assertEqual((out / 'plugin-page.js').read_text(),actual)

    def test_duplicate_guidance_stops_without_mutating_live_files(self):
        original=(self.local / 'plugin-page.js').read_text()
        bad=original.replace('<p class="plugin-cover-guidance">','<p class="plugin-cover-guidance">Duplicate</p><p class="plugin-cover-guidance">')
        (self.local / 'plugin-page.js').write_text(bad)
        with self.assertRaisesRegex(ValueError,'Дублируются'):module.stage(self.local,self.incoming,self.out)
        self.assertFalse(self.out.exists())
        self.assertEqual((self.local / 'plugin-page.js').read_text(),bad)

if __name__ == '__main__': unittest.main()
