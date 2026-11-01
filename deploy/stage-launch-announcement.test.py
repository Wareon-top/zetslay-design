import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

REPO = Path(__file__).parents[1].resolve()
spec = importlib.util.spec_from_file_location('stage', REPO / 'deploy/stage-launch-announcement.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class StageTest(unittest.TestCase):
    def test_idempotent_and_preserves_cabinet_modules(self):
        with tempfile.TemporaryDirectory() as directory:
            out, again = Path(directory) / 'out', Path(directory) / 'again'
            shutil.copytree(REPO / 'app', out)
            m.stage(REPO / 'app', REPO / 'app', out)
            m.stage(out, REPO / 'app', again)
            for name in m.ASSETS + ['index.html']:
                self.assertEqual((out / name).read_bytes(), (again / name).read_bytes())
            html = (out / 'index.html').read_text()
            self.assertEqual(html.count('src="launch-announcement.js?'), 1)
            self.assertEqual(html.count('href="launch-announcement.css?'), 1)
            for name in ['app.js', 'learning.js', 'payments.js', 'payment-confirmation.js', 'auto-refresh.js', 'tariff-summary.js']:
                self.assertIn('src="' + name + '?', html)
                self.assertLess(html.index('src="' + name + '?'), html.index('src="launch-announcement.js?'))

    def test_unknown_or_duplicate_layout_does_not_write(self):
        for html in ['unknown', (REPO / 'app/index.html').read_text().replace('</body>', '<script src="launch-announcement.js"></script></body>')]:
            with tempfile.TemporaryDirectory() as directory:
                local, out = Path(directory) / 'local', Path(directory) / 'out'
                local.mkdir()
                (local / 'index.html').write_text(html)
                for name in ['app.js', 'learning.js']:
                    shutil.copyfile(REPO / 'app' / name, local / name)
                with self.assertRaises(ValueError):
                    m.stage(local, REPO / 'app', out)
                self.assertFalse(out.exists())

    def test_actual_installer_on_current_cabinet(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            site, backup, bin = root / 'site', root / 'backup', root / 'bin'
            shutil.copytree(REPO / 'app', site / 'app')
            # Exercise first installation, including an asset that does not exist yet.
            for name in m.ASSETS:
                (site / 'app' / name).unlink(missing_ok=True)
            backup.mkdir()
            bin.mkdir()
            preserved = ['app.js', 'learning.js', 'payments.js', 'payment-confirmation.js', 'subscription-access.js', 'auto-refresh.js']
            before = {name: (site / 'app' / name).read_bytes() for name in preserved}
            git = bin / 'git'
            git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$LAUNCH_FIXTURE_SOURCE/$file";;\n*) exit 2;;\nesac\n')
            git.chmod(0o755)
            env = {**os.environ, 'PATH': str(bin) + os.pathsep + os.environ['PATH'], 'LAUNCH_FIXTURE_SOURCE': str(REPO), 'ZETSLAY_SITE_DIR': str(site), 'ZETSLAY_BACKUP_DIR': str(backup)}
            result = subprocess.run(['bash', str(REPO / 'deploy/update-launch-announcement-ui.sh')], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout[-3000:] + result.stderr[-3000:])
            self.assertEqual({name: (site / 'app' / name).read_bytes() for name in preserved}, before)
            self.assertEqual(len(list(backup.iterdir())), 1)
            for name in m.ASSETS:
                self.assertEqual((site / 'app' / name).read_bytes(), (REPO / 'app' / name).read_bytes())

if __name__ == '__main__':
    unittest.main()
