"""Exercise the installer without Docker, a database, or network writes."""
from pathlib import Path
import json
import os
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class InstallerTest(unittest.TestCase):
    def run_fixture(self, containers='abcdef123456\n', export_ok=True):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        work = Path(temp.name)
        site, binaries, backups = [work / name for name in ('site', 'bin', 'backups')]
        for directory in (site, binaries, backups):
            directory.mkdir()
        # The fixture preserves the actual current landing around its showcase.
        (site / 'index.html').write_bytes((ROOT / 'index.html').read_bytes())
        (site / 'index.html').chmod(0o644)
        (site / 'landing-plugins.css').write_text('ORIGINAL CSS')
        (site / 'app').mkdir()
        (site / 'app/index.html').write_text('CABINET MUST STAY')
        (binaries / 'git').write_text('''#!/usr/bin/env python3
import os,sys
from pathlib import Path
if sys.argv[1]=='fetch': pass
elif sys.argv[1]=='rev-parse': print('a'*40)
elif sys.argv[1]=='show': sys.stdout.buffer.write((Path(os.environ['FIXTURE_SOURCE'])/sys.argv[2].split(':',1)[1]).read_bytes())
else: sys.exit(2)
''')
        (binaries / 'sudo').write_text('#!/bin/sh\nexec "$@"\n')
        (binaries / 'docker').write_text('''#!/usr/bin/env python3
import os,sys,json
from pathlib import Path
with open(os.environ['FIXTURE_CALLS'],'a') as log: log.write(json.dumps(sys.argv[1:])+'\\n')
if sys.argv[1]=='ps': print(os.environ['FIXTURE_CONTAINERS'],end='')
elif sys.argv[1:3]==['exec','-i']:
 source=sys.stdin.read()
 if 'BEGIN READ ONLY' not in source or os.environ['FIXTURE_EXPORT_OK']!='yes': sys.exit(1)
 print(json.dumps({'entries':[{'id':'zetslay.steam-rent','name':'Catalog Steam','published':True,'cover':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5k8AAAAASUVORK5CYII='}]}))
else: sys.exit(3)
''')
        for binary in binaries.iterdir():
            binary.chmod(0o755)
        env = dict(os.environ, PATH=str(binaries)+':'+os.environ['PATH'],
                   ZETSLAY_SITE_DIR=str(site), ZETSLAY_BACKUP_DIR=str(backups),
                   FIXTURE_SOURCE=str(ROOT), FIXTURE_CONTAINERS=containers,
                   FIXTURE_EXPORT_OK='yes' if export_ok else 'no',
                   FIXTURE_CALLS=str(work / 'calls'))
        result = subprocess.run(['bash', str(ROOT / 'deploy/update-landing-plugins.sh')],
                                env=env, capture_output=True, text=True, timeout=15)
        calls = [json.loads(line) for line in (work / 'calls').read_text().splitlines()]
        return result, site, backups, calls

    def test_direct_running_api_export_and_static_only_install(self):
        result, site, backups, calls = self.run_fixture()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([call[0] for call in calls], ['ps', 'exec'])
        self.assertEqual(calls[1][1:4], ['-i', 'abcdef123456', 'node'])
        self.assertIn('label=com.docker.compose.service=api', calls[0])
        text = (site / 'index.html').read_text()
        self.assertEqual(text.count('data-public-plugin="'), 15)
        self.assertIn('Catalog Steam', text)
        self.assertEqual((site / 'app/index.html').read_text(), 'CABINET MUST STAY')
        cover = next((site / 'assets/landing-plugin-covers').iterdir())
        self.assertEqual(cover.stat().st_mode & 0o777, 0o644)
        self.assertEqual(cover.parent.stat().st_mode & 0o777, 0o755)
        self.assertEqual(next(backups.iterdir()).stat().st_mode & 0o777, 0o600)
        self.assertFalse((site / '.zetslay-landing-hero-update.lock').exists())

    def test_missing_or_ambiguous_api_keeps_site_unchanged(self):
        for containers in ('', 'abcdef123456\n123456abcdef\n'):
            with self.subTest(containers=containers):
                result, site, backups, calls = self.run_fixture(containers=containers)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual((site / 'index.html').read_bytes(), (ROOT / 'index.html').read_bytes())
                self.assertEqual((site / 'landing-plugins.css').read_text(), 'ORIGINAL CSS')
                self.assertEqual(list(backups.iterdir()), [])
                self.assertEqual([call[0] for call in calls], ['ps'])

    def test_catalog_export_failure_keeps_site_unchanged(self):
        result, site, backups, _ = self.run_fixture(export_ok=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((site / 'index.html').read_bytes(), (ROOT / 'index.html').read_bytes())
        self.assertEqual((site / 'landing-plugins.css').read_text(), 'ORIGINAL CSS')
        self.assertEqual(list(backups.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
