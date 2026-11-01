from pathlib import Path
import importlib.util
import os
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('brand', Path(__file__).with_name('stage-site-brand.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
PAGE = '<!doctype html><html><head><title>Live page</title></head><body>LIVE</body></html>'
CABINET = PAGE.replace('LIVE', '<header><div class="topbar-context"><strong>LIVE</strong></div></header><div class="auth-content"><span class="auth-content__eyebrow">LOGIN</span></div><script src="app.js?v=live-bot-fix"></script>')


class SiteBrandTests(unittest.TestCase):
    def test_existing_body_scripts_and_page_identity_survive_repeated_install(self):
        for source, cabinet in [(PAGE, False), (CABINET, True)]:
            result = m.inject(source, cabinet)
            self.assertEqual(result, m.inject(result, cabinet))
            self.assertIn('<title>Live page</title>', result)
            self.assertEqual(result.count('rel="icon"'), 2)
            if cabinet:
                self.assertIn('app.js?v=live-bot-fix', result)
                self.assertEqual(result.count('class="site-workspace-brand"'), 1)
                self.assertEqual(result.count('class="site-auth-brand"'), 1)
            else:
                self.assertEqual(result.split('<body>')[1], source.split('<body>')[1])
        with self.assertRaises(ValueError):
            m.inject(PAGE, True)

    def setup_site(self, root):
        (root / 'app').mkdir();(root / 'legal/archive/2026-10-15-v1').mkdir(parents=True)
        (root / 'assets').mkdir();(root / 'deploy').mkdir()
        (root / 'index.html').write_text(PAGE)
        (root / 'app/index.html').write_text(CABINET)
        (root / 'app/billing-section.html').write_text('<section>LIVE FRAGMENT</section>')
        (root / 'legal/index.html').write_text(PAGE)
        (root / 'legal/archive/2026-10-15-v1/index.html').write_text(PAGE)
        for name in m.ASSETS:
            shutil.copyfile(ROOT / name, root / name)
        shutil.copyfile(ROOT / 'deploy/stage-site-brand.py', root / 'deploy/stage-site-brand.py')

    def test_archived_documents_and_fragments_are_not_staged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);self.setup_site(root)
            m.stage(root, root, root / 'out')
            self.assertFalse((root / 'out/legal/archive').exists())
            self.assertFalse((root / 'out/app/billing-section.html').exists())
            self.assertEqual((root / 'legal/archive/2026-10-15-v1/index.html').read_text(), PAGE)

    def test_partial_installation_rolls_back_all_pages_and_existing_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);self.setup_site(root)
            def git(*args):
                return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()
            git('init', '-q');git('add', '.')
            git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture')
            revision = git('rev-parse', 'HEAD')
            (root / 'favicon.ico').write_bytes(b'PREVIOUS ICON')
            (root / 'site-brand.css').unlink()
            tools = root / 'bin';tools.mkdir()
            (tools / 'mv').write_text('#!/bin/bash\nif [[ "${@: -1}" == legal/index.html ]];then exit 71;fi\nexec /bin/mv "$@"\n')
            (tools / 'mv').chmod(0o755)
            env = dict(os.environ, ZETSLAY_SITE_DIR=str(root), ZETSLAY_BACKUP_DIR=str(root),
                       ZETSLAY_SITE_BRAND_REVISION=revision, PATH=str(tools) + ':' + os.environ['PATH'])
            result = subprocess.run(['bash', str(ROOT / 'deploy/update-site-brand.sh')], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 71, result.stdout + result.stderr)
            self.assertEqual((root / 'index.html').read_text(), PAGE)
            self.assertEqual((root / 'app/index.html').read_text(), CABINET)
            self.assertEqual((root / 'favicon.ico').read_bytes(), b'PREVIOUS ICON')
            self.assertFalse((root / 'site-brand.css').exists())
            env['PATH'] = os.environ['PATH']
            subprocess.run(['bash', str(ROOT / 'deploy/update-site-brand.sh')], env=env, capture_output=True, check=True)
            self.assertIn('site-auth-brand', (root / 'app/index.html').read_text())
            self.assertEqual((root / 'legal/archive/2026-10-15-v1/index.html').read_text(), PAGE)
            self.assertTrue(all(p.stat().st_mode & 0o777 == 0o600 for p in root.glob('*.tar.gz')))


if __name__ == '__main__':
    unittest.main()
