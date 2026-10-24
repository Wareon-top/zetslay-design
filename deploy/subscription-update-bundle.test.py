"""Exercise the updater's actual isolated file bundle, without Docker or publication."""
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent


class UpdateBundleTests(unittest.TestCase):
    def test_isolated_bundle_passes_every_prepublication_check(self):
        script = (ROOT / 'deploy/update-subscription-pricing.sh').read_text()
        manifest = re.search(r'for file in (.*?)\; do\n  git show', script, re.S)
        self.assertIsNotNone(manifest)
        files = shlex.split(manifest.group(1).replace('\\\n', ' '))
        with tempfile.TemporaryDirectory() as tmp:
            incoming = Path(tmp) / 'incoming'
            staged = Path(tmp) / 'staged'
            for name in files:
                target = incoming / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, target)

            def run(*args):
                result = subprocess.run(args, cwd=incoming, text=True,
                                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                self.assertEqual(result.returncode, 0, result.stdout)
                return result.stdout

            run('python3', 'deploy/build-subscription-pricing.py', str(incoming), '--check')
            run('python3', 'deploy/stage-subscription-pricing.test.py')
            run('python3', 'deploy/stage-subscription-pricing.py', str(ROOT), str(incoming), str(staged))
            output = run('node', '--test', '--test-reporter=tap', 'app/billing.test.mjs', 'deploy/landing-pricing.test.mjs')
            self.assertIn('# fail 0', output)
            for name in ('landing-pricing.js', 'app/billing-pricing.js', 'app/billing.js'):
                run('node', '--check', str(staged / name))
            self.assertEqual({str(p.relative_to(staged)) for p in staged.rglob('*') if p.is_file()},
                             {'index.html', 'app/index.html', 'landing-pricing.js',
                              'app/billing-pricing.js', 'app/billing.js'})


if __name__ == '__main__':
    unittest.main()
