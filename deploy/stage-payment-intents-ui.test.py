from pathlib import Path
import importlib.util
import os
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_payments', Path(__file__).with_name('stage-payment-intents-ui.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class PaymentStageTests(unittest.TestCase):
    def test_only_payment_versions_and_assets_change(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            html = (ROOT / 'app/index.html').read_text().replace('20261024-payment-intents', 'live-payment-version') + '\n<!-- VPS CUSTOM -->'
            (root / 'index.html').write_text(html)
            m.stage(root, ROOT / 'app', root / 'out')
            expected = html.replace('live-payment-version', m.VERSION)
            self.assertEqual((root / 'out/index.html').read_text(), expected)
            self.assertFalse((root / 'out/app.js').exists())
            m.stage(root / 'out', ROOT / 'app', root / 'again')
            self.assertEqual((root / 'again/index.html').read_text(), expected)

    def test_unrecognized_or_duplicate_resources_fail_before_writing(self):
        for html in ('<html>unknown</html>', (ROOT / 'app/index.html').read_text().replace('payments.js?v=', 'other.js?v='),
                     (ROOT / 'app/index.html').read_text().replace('</head>', '<script src="payments.js"></script></head>')):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / 'index.html').write_text(html)
                with self.assertRaises(ValueError):
                    m.stage(root, ROOT / 'app', root / 'out')
                self.assertFalse((root / 'out').exists())

    def test_partial_failure_restores_live_files_and_success_preserves_app_logic(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'app').mkdir()
            (root / 'deploy').mkdir()
            for name in m.ASSETS:
                shutil.copyfile(ROOT / 'app' / name, root / 'app' / name)
            shutil.copyfile(ROOT / 'deploy/stage-payment-intents-ui.py', root / 'deploy/stage-payment-intents-ui.py')
            (root / 'app/index.html').write_text((ROOT / 'app/index.html').read_text())
            def git(*args):
                return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()
            git('init', '-q');git('add', '.')
            git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture')
            revision = git('rev-parse', 'HEAD')
            original = (root / 'app/index.html').read_text().replace(m.VERSION, 'current-live-version')
            (root / 'app/index.html').write_text(original)
            (root / 'app/payments.js').write_text('// PREVIOUS PAYMENT UI')
            (root / 'app/app.js').write_text('// LIVE BOT CONNECTION FIXES')
            tools = root / 'bin'
            tools.mkdir()
            (tools / 'mv').write_text('#!/bin/bash\nif [[ "${@: -1}" == app/index.html ]];then exit 71;fi\nexec /bin/mv "$@"\n')
            (tools / 'mv').chmod(0o755)
            env = dict(os.environ, ZETSLAY_SITE_DIR=str(root), ZETSLAY_BACKUP_DIR=str(root),
                       ZETSLAY_PAYMENT_INTENTS_REVISION=revision, PATH=str(tools) + ':' + os.environ['PATH'])
            result = subprocess.run(['bash', str(ROOT / 'deploy/update-payment-intents-ui.sh')], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 71, result.stderr)
            self.assertEqual((root / 'app/index.html').read_text(), original)
            self.assertEqual((root / 'app/payments.js').read_text(), '// PREVIOUS PAYMENT UI')
            env['PATH'] = os.environ['PATH']
            subprocess.run(['bash', str(ROOT / 'deploy/update-payment-intents-ui.sh')], env=env, check=True, capture_output=True)
            self.assertEqual((root / 'app/index.html').read_text(), original.replace('current-live-version', m.VERSION))
            self.assertEqual((root / 'app/app.js').read_text(), '// LIVE BOT CONNECTION FIXES')
            self.assertTrue(all((root / 'app' / name).stat().st_mode & 0o777 == 0o644 for name in m.ASSETS))
            self.assertTrue(all(p.stat().st_mode & 0o777 == 0o600 for p in root.glob('*.tar.gz')))


if __name__ == '__main__':
    unittest.main()
