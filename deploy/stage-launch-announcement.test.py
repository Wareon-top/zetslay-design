"""The launch announcement is retired (owner, 13.11.2026). Its installer must refuse and change nothing."""
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
    def test_stage_refuses_and_writes_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'out'
            with self.assertRaisesRegex(ValueError, 'снято по решению владельца'):
                m.stage(REPO / 'app', REPO / 'app', out)
            self.assertFalse(out.exists())

    def test_current_cabinet_does_not_load_the_announcement(self):
        html = (REPO / 'app/index.html').read_text(encoding='utf-8')
        self.assertNotIn('launch-announcement.js', html)
        self.assertNotIn('launch-announcement.css', html)

    def test_actual_installer_refuses_before_backup_and_keeps_the_site(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            site, backup, bin = root / 'site', root / 'backup', root / 'bin'
            shutil.copytree(REPO / 'app', site / 'app')
            backup.mkdir()
            bin.mkdir()
            before = {str(p.relative_to(site)): p.read_bytes() for p in site.rglob('*') if p.is_file()}
            git = bin / 'git'
            git.write_text('#!/bin/sh\ncase "$1" in\nfetch) exit 0;;\nrev-parse) echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;\nshow) file=${2#*:}; exec cat "$LAUNCH_FIXTURE_SOURCE/$file";;\n*) exit 2;;\nesac\n')
            git.chmod(0o755)
            env = {**os.environ, 'PATH': str(bin) + os.pathsep + os.environ['PATH'], 'LAUNCH_FIXTURE_SOURCE': str(REPO), 'ZETSLAY_SITE_DIR': str(site), 'ZETSLAY_BACKUP_DIR': str(backup)}
            result = subprocess.run(['bash', str(REPO / 'deploy/update-launch-announcement-ui.sh')], env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('снято по решению владельца', result.stdout + result.stderr)
            self.assertEqual({str(p.relative_to(site)): p.read_bytes() for p in site.rglob('*') if p.is_file()}, before)
            self.assertEqual(list(backup.iterdir()), [])

if __name__ == '__main__':
    unittest.main()
