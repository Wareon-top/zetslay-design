from pathlib import Path
import importlib.util
import os
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('signout', ROOT / 'deploy/stage-account-signout.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SignoutTest(unittest.TestCase):
    def fixture(self, root):
        local = root / 'app'
        local.mkdir()
        html = (ROOT / 'app/index.html').read_text()
        import re
        html = re.sub(r'<button\b[^>]*data-account-signout[^>]*>.*?</button>', '', html, flags=re.S)
        (local / 'index.html').write_text(html + '\n<!-- LOCAL CABINET -->\n')
        (local / 'app.js').write_text((ROOT / 'app/app.js').read_text() + '\n// LOCAL LOGIC\n')
        return local

    def test_exposes_existing_logout_without_changing_auth_or_local_cabinet(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            local = self.fixture(root)
            before = (local / 'app.js').read_bytes()
            module.stage(local, ROOT / 'app', root / 'out')
            html = (root / 'out/index.html').read_text()
            self.assertEqual(html.count('data-account-signout'), 1)
            self.assertIn('Выйти из аккаунта', html)
            self.assertIn('LOCAL CABINET', html)
            self.assertEqual((local / 'app.js').read_bytes(), before)
            self.assertEqual({file.name for file in (root / 'out').iterdir()}, {'index.html', 'account-signout.css'})
            # Existing profile, navigation and bot settings remain byte-for-byte intact.
            self.assertIn('data-view-target="profile"', html)
            self.assertEqual(html.count('src="bot-settings.js'), 1)
            self.assertNotIn('data-view-target="store-tools"', html)
            (root / 'out/app.js').write_bytes(before)
            module.stage(root / 'out', ROOT / 'app', root / 'twice')
            self.assertEqual(html, (root / 'twice/index.html').read_text())

    def test_missing_logout_handler_or_ambiguous_profile_stops_before_writes(self):
        for invalid in ('handler', 'profile', 'duplicate'):
            with self.subTest(invalid=invalid), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                local = self.fixture(root)
                if invalid == 'handler':
                    (local / 'app.js').write_text('CUSTOM UNKNOWN APPLICATION')
                else:
                    html = (local / 'index.html').read_text()
                    html = html.replace('class="user-card"', 'class="custom-profile"') if invalid == 'profile' else html + '<div class="user-card"></div>'
                    (local / 'index.html').write_text(html)
                before = (local / 'index.html').read_bytes()
                with self.assertRaises(ValueError):
                    module.stage(local, ROOT / 'app', root / 'out')
                self.assertFalse((root / 'out').exists())
                self.assertEqual((local / 'index.html').read_bytes(), before)

    def test_installer_preserves_app_and_root_landing_and_makes_private_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            (root / 'index.html').write_text('PUBLIC LANDING MUST STAY')
            backups = root / 'backups'
            binaries = root / 'bin'
            backups.mkdir()
            binaries.mkdir()
            git = binaries / 'git'
            git.write_text('''#!/bin/sh
case "$1" in
fetch) exit 0;;
rev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;
show) file=${2#*:}; exec cat "$SIGNOUT_TEST_SOURCE/$file";;
*) exit 2;;
esac
''')
            git.chmod(0o755)
            before = (root / 'app/app.js').read_bytes()
            env = dict(os.environ, PATH=str(binaries)+':'+os.environ['PATH'],
                       ZETSLAY_SITE_DIR=str(root), ZETSLAY_BACKUP_DIR=str(backups),
                       SIGNOUT_TEST_SOURCE=str(ROOT))
            result = subprocess.run(['bash', str(ROOT / 'deploy/update-account-signout.sh')],
                                    env=env, capture_output=True, text=True, timeout=15)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual((root / 'app/app.js').read_bytes(), before)
            self.assertEqual((root / 'index.html').read_text(), 'PUBLIC LANDING MUST STAY')
            self.assertEqual((root / 'app/account-signout.css').stat().st_mode & 0o777, 0o644)
            self.assertEqual(next(backups.iterdir()).stat().st_mode & 0o777, 0o600)
            self.assertFalse((root / '.zetslay-account-signout-update.lock').exists())


if __name__ == '__main__':
    unittest.main()
