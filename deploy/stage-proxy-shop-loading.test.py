from pathlib import Path
import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('loading', Path(__file__).with_name('stage-proxy-shop-loading.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
HTML = '<html><head></head><body>LIVE HERO<img src="/assets/zetslay-logo.webp"><script src="payments.js?v=payment-fix"></script><script src="managed-proxy-ui.js?v=old"></script><script src="proxy-shop.js?v=logo-fix"></script></body></html>'


class LoadingInstallerTests(unittest.TestCase):
    def fixture(self, root):
        (root / 'app').mkdir();(root / 'deploy').mkdir()
        patches = json.loads((ROOT / 'deploy/proxy-shop-loading-patches.json').read_text())
        files = {name: (ROOT / 'app' / name).read_text() for name in m.FILES}
        # Reconstruct the prior release so this legacy installer keeps testing
        # its own supported input after the new checkout changes.
        newer = ROOT / 'deploy/proxy-checkout-ui-patches.json'
        if newer.exists():
            for patch in reversed(json.loads(newer.read_text())):
                files[patch['file']] = files[patch['file']].replace(patch['after'], patch['before'], 1)
        for patch in reversed(patches):
            self.assertEqual(files[patch['file']].count(patch['after']), 1, patch['name'])
            files[patch['file']] = files[patch['file']].replace(patch['after'], patch['before'], 1)
        for name, text in files.items():
            (root / 'app' / name).write_text(text + '\n/* Keep custom runtime code. */\n')
        (root / 'app/index.html').write_text(HTML)
        for name in ['stage-proxy-shop-loading.py', 'proxy-shop-loading-patches.json']:
            shutil.copyfile(ROOT / 'deploy' / name, root / 'deploy' / name)

    def test_preserves_custom_runtime_logo_payment_fix_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);self.fixture(root)
            m.stage(root / 'app', root / 'deploy', root / 'out')
            m.stage(root / 'out', root / 'deploy', root / 'again')
            for name in [*m.FILES, 'index.html']:
                self.assertEqual((root / 'out' / name).read_bytes(), (root / 'again' / name).read_bytes())
            self.assertIn('payments.js?v=payment-fix', (root / 'out/index.html').read_text())
            self.assertIn('/assets/zetslay-logo.webp', (root / 'out/index.html').read_text())
            for name in m.FILES:
                self.assertIn('Keep custom runtime code.', (root / 'out' / name).read_text())

    def test_unknown_runtime_is_rejected_before_any_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);self.fixture(root)
            p = root / 'app/proxy-shop.js';p.write_text(p.read_text().replace("await Promise.all([managedProxyLoad(),proxyShopLoad({catalog:true})]);", 'CUSTOM_UNRECOGNIZED_LOADER();'))
            with self.assertRaises(ValueError):
                m.stage(root / 'app', root / 'deploy', root / 'out')
            self.assertFalse((root / 'out').exists())

    def test_failed_publish_restores_all_files_then_success_uses_private_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);self.fixture(root)
            def git(*args):
                return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()
            git('init', '-q');git('add', '.');git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture')
            revision = git('rev-parse', 'HEAD')
            before = {p: p.read_bytes() for p in (root / 'app').iterdir()}
            tools = root / 'bin';tools.mkdir()
            (tools / 'mv').write_text('#!/bin/bash\nif [[ "${@: -1}" == app/index.html ]];then exit 71;fi\nexec /bin/mv "$@"\n');(tools / 'mv').chmod(0o755)
            env = dict(os.environ, ZETSLAY_SITE_DIR=str(root), ZETSLAY_BACKUP_DIR=str(root), ZETSLAY_PROXY_SHOP_LOADING_REVISION=revision, PATH=str(tools) + ':' + os.environ['PATH'])
            command = ['bash', str(ROOT / 'deploy/update-proxy-shop-loading.sh')]
            result = subprocess.run(command, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 71, result.stdout + result.stderr)
            self.assertTrue(all(p.read_bytes() == content for p, content in before.items()))
            env['PATH'] = os.environ['PATH']
            subprocess.run(command, env=env, capture_output=True, check=True)
            self.assertIn(m.VERSION, (root / 'app/index.html').read_text())
            self.assertTrue(all(p.stat().st_mode & 0o777 == 0o600 for p in root.glob('*.tar.gz')))


if __name__ == '__main__':
    unittest.main()
