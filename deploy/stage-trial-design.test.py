from pathlib import Path
import importlib.util
import os
import re
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('trial_design', ROOT / 'deploy/stage-trial-design.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TrialDesignTest(unittest.TestCase):
    def test_only_style_reference_changes_and_logout_is_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            local = Path(tmp)
            before = (ROOT / 'app/index.html').read_text().replace('20261023-trial-restored', 'old-version') + '<!-- LOCAL EDIT -->'
            (local / 'index.html').write_text(before)
            module.stage(local, ROOT / 'app', local / 'out')
            after = (local / 'out/index.html').read_text()
            normalize = lambda text: re.sub(r'sidebar-trial\.css\?[^"\']+', 'sidebar-trial.css', text)
            self.assertEqual(normalize(before), normalize(after))
            self.assertIn('data-account-signout', after)
            self.assertEqual({p.name for p in (local / 'out').iterdir()}, {'index.html', 'sidebar-trial.css'})
            module.stage(local / 'out', ROOT / 'app', local / 'again')
            self.assertEqual(after, (local / 'again/index.html').read_text())

    def test_unknown_card_stops_before_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            local = Path(tmp)
            (local / 'index.html').write_text('<html><head></head><body>Custom cabinet</body></html>')
            with self.assertRaises(ValueError):
                module.stage(local, ROOT / 'app', local / 'out')
            self.assertFalse((local / 'out').exists())

    def test_installer_keeps_trial_logic_and_exit_and_backs_up_styles(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            app, backups, binaries = [root / name for name in ('app', 'backups', 'bin')]
            for folder in (app, backups, binaries):
                folder.mkdir()
            (app / 'index.html').write_bytes((ROOT / 'app/index.html').read_bytes())
            (app / 'sidebar-trial.css').write_text('PREVIOUS TRIAL DESIGN')
            (app / 'sidebar-trial.js').write_text('LOCAL TRIAL LOGIC')
            (app / 'app.js').write_text('LOCAL SESSION LOGIC')
            git = binaries / 'git'
            git.write_text('''#!/bin/sh
case "$1" in
fetch) exit 0;;
rev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;
show) file=${2#*:}; exec cat "$TRIAL_TEST_SOURCE/$file";;
*) exit 2;;
esac
''')
            git.chmod(0o755)
            env = dict(os.environ, PATH=str(binaries)+':'+os.environ['PATH'],
                       ZETSLAY_SITE_DIR=str(root), ZETSLAY_BACKUP_DIR=str(backups),
                       TRIAL_TEST_SOURCE=str(ROOT))
            result = subprocess.run(['bash', str(ROOT / 'deploy/update-trial-design.sh')],
                                    env=env, capture_output=True, text=True, timeout=15)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual((app / 'sidebar-trial.js').read_text(), 'LOCAL TRIAL LOGIC')
            self.assertEqual((app / 'app.js').read_text(), 'LOCAL SESSION LOGIC')
            self.assertIn('data-account-signout', (app / 'index.html').read_text())
            self.assertIn('radial-gradient', (app / 'sidebar-trial.css').read_text())
            self.assertEqual(next(backups.iterdir()).stat().st_mode & 0o777, 0o600)


if __name__ == '__main__':
    unittest.main()
