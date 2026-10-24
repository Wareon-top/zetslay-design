import importlib.util
from pathlib import Path
import tempfile
import unittest
import os
import shutil
import subprocess
import tarfile

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
spec = importlib.util.spec_from_file_location('stage_hero', HERE / 'stage-landing-hero.py')
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)

class LandingStageTests(unittest.TestCase):
    def fixture(self, path):
        local = path / 'local'
        local.mkdir()
        text = (REPO / 'index.html').read_text()
        hero, ribbon = stage.hero_parts(text)
        text = text[:hero.start()] + '<section class="hero" id="landing"><h1 id="hero-title">Старый заголовок</h1></section>' + text[ribbon.end():]
        text = text.replace('ZetSlay — на главную', 'VPS CUSTOM BRAND')
        text = text.replace('</body>', '<script>/* VPS AUTH SCRIPT */</script>\n</body>')
        (local / 'index.html').write_text(text)
        (local / 'landing.css').write_text('CUSTOM ORANGE BACKGROUND AND FONT')
        (local / 'app.js').write_text('DO NOT REPLACE THE CABINET')
        return local

    def test_replaces_only_hero_and_keeps_local_brand_auth_css_and_cabinet(self):
        with tempfile.TemporaryDirectory(dir=REPO.parent) as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            before = (local / 'index.html').read_text()
            stage.stage(local, REPO, root / 'out')
            result = (root / 'out/index.html').read_text()
            self.assertIn('VPS CUSTOM BRAND', result)
            self.assertIn('VPS AUTH SCRIPT', result)
            self.assertEqual(result.count('id="hero-title"'), 1)
            self.assertIn('data-platform-ribbon', result)
            self.assertEqual(before[before.index('<section class="section'):before.index('</main>')], result[result.index('<section class="section'):result.index('</main>')])
            self.assertEqual((local / 'landing.css').read_text(), 'CUSTOM ORANGE BACKGROUND AND FONT')
            self.assertEqual((local / 'app.js').read_text(), 'DO NOT REPLACE THE CABINET')
            self.assertFalse((root / 'out/landing.css').exists())

    def test_repeat_updates_are_idempotent(self):
        with tempfile.TemporaryDirectory(dir=REPO.parent) as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            stage.stage(local, REPO, root / 'out')
            # The installed site retains the original base stylesheet.
            (root / 'out/landing.css').write_text('RETAINED')
            stage.stage(root / 'out', REPO, root / 'again')
            self.assertEqual((root / 'out/index.html').read_bytes(), (root / 'again/index.html').read_bytes())

    def test_unknown_structure_stops_without_changing_local_files(self):
        with tempfile.TemporaryDirectory(dir=REPO.parent) as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            text = (local / 'index.html').read_text().replace('id="landing"', 'id="unexpected"')
            (local / 'index.html').write_text(text)
            with self.assertRaises(ValueError):
                stage.stage(local, REPO, root / 'out')
            self.assertEqual((local / 'index.html').read_text(), text)
            self.assertFalse((root / 'out').exists())

    def test_missing_artwork_stops_before_mutating_live_html(self):
        with tempfile.TemporaryDirectory(dir=REPO.parent) as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            before = (local / 'index.html').read_bytes()
            incoming = root / 'incoming'
            incoming.mkdir()
            for name in ['index.html'] + stage.FILES:
                if name.endswith('.webp'):
                    continue
                target = incoming / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(REPO / name, target)
            with self.assertRaises(OSError):
                stage.stage(local, incoming, root / 'out')
            self.assertEqual((local / 'index.html').read_bytes(), before)
            self.assertFalse((root / 'out').exists())

    def test_real_installer_backs_up_live_version_and_archive_restores_it(self):
        with tempfile.TemporaryDirectory(dir=REPO.parent) as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            (local / 'landing-hero.css').write_text('LIVE ORIGINAL HERO')
            before = (local / 'index.html').read_bytes()
            incoming = root / 'incoming'
            incoming.mkdir()
            for name in ['index.html', 'deploy/stage-landing-hero.py'] + stage.FILES:
                target = incoming / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(REPO / name, target)
            def git(directory, *args):
                subprocess.run(['git', '-C', str(directory), *args], check=True, capture_output=True)
            git(incoming, 'init', '-b', 'codex/landing-light-dark-redesign')
            git(incoming, 'config', 'user.name', 'Installer test')
            git(incoming, 'config', 'user.email', 'test@example.invalid')
            git(incoming, 'add', '.')
            git(incoming, 'commit', '-m', 'Test candidate')
            git(local, 'init')
            git(local, 'remote', 'add', 'origin', str(incoming))
            backup_dir = root / 'backups'
            backup_dir.mkdir()
            env = dict(os.environ, ZETSLAY_SITE_DIR=str(local), ZETSLAY_BACKUP_DIR=str(backup_dir))
            result = subprocess.run(['bash', str(HERE / 'update-landing-hero.sh')], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            self.assertIn('data-landing-hero="orderflow"', (local / 'index.html').read_text())
            self.assertIn('VPS CUSTOM BRAND', (local / 'index.html').read_text())
            self.assertEqual((local / 'app.js').read_text(), 'DO NOT REPLACE THE CABINET')
            backups = list(backup_dir.glob('*.tar.gz'))
            self.assertEqual(len(backups), 1)
            with tarfile.open(backups[0]) as archive:
                self.assertEqual(archive.extractfile('index.html').read(), before)
                archive.extractall(local, filter='data')
            self.assertEqual((local / 'index.html').read_bytes(), before)
            self.assertEqual((local / 'landing-hero.css').read_text(), 'LIVE ORIGINAL HERO')
            self.assertEqual((local / 'landing.css').read_text(), 'CUSTOM ORANGE BACKGROUND AND FONT')

if __name__ == '__main__':
    unittest.main()
