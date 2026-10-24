from pathlib import Path
import hashlib
import importlib.util
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('recover_hero', Path(__file__).with_name('recover-landing-hero.py'))
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

ARGS = ('docker', 'run', '--rm', '-v', '/tmp/test/site:/work:ro', '-w', '/work', 'node:22-alpine', 'node', '--check', 'landing-hero.js')
LEGACY = b'known installer fixture'
DIGEST = hashlib.sha256(LEGACY).hexdigest()

def processes(digest=DIGEST):
    parent = module.Process(200, 100, '1', ('bash', '/tmp/installer'), True, digest)
    client = module.Process(201, 200, '2', ARGS)
    return {200: parent, 201: client}, client

class RecoveryTests(unittest.TestCase):
    def test_identifies_only_the_exact_old_read_only_syntax_command(self):
        self.assertTrue(module.is_syntax_client(ARGS))
        for args in [('dockerd',), ('docker', 'compose', 'restart'), ARGS[:-1] + ('app.js',), ARGS[:8] + ('node', 'server.js', 'landing-hero.js')]:
            self.assertFalse(module.is_syntax_client(args))
        values, client = processes()
        self.assertEqual(module.select_clients(values, DIGEST), [client])

    def test_unknown_or_modified_live_installer_blocks_recovery(self):
        values, _ = processes('different script')
        with self.assertRaises(RuntimeError):
            module.select_clients(values, DIGEST)

    def test_real_proc_metadata_can_be_read(self):
        process = module.read_process(Path('/proc', str(os.getpid())))
        self.assertEqual(process.pid, os.getpid())
        self.assertTrue(process.start.isdigit())

    def test_only_the_old_client_receives_term_and_site_files_are_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / module.LOCK).mkdir()
            (root / 'index.html').write_text('ORIGINAL SITE')
            (root / 'backup.tar.gz').write_bytes(b'EXISTING BACKUP')
            values, client = processes()
            with patch.object(module.subprocess, 'check_output', return_value=LEGACY), patch.object(module, 'scan', side_effect=[values, {}]), patch.object(module, 'read_process', return_value=client), patch.object(module.os, 'kill') as kill:
                module.recover(root)
                kill.assert_called_once_with(client.pid, module.signal.SIGTERM)
            self.assertFalse((root / module.LOCK).exists())
            self.assertEqual((root / 'index.html').read_text(), 'ORIGINAL SITE')
            self.assertEqual((root / 'backup.tar.gz').read_bytes(), b'EXISTING BACKUP')

    def test_live_pid_or_unknown_lock_content_is_never_removed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            lock = root / module.LOCK
            lock.mkdir()
            (lock / 'pid').write_text(str(os.getpid()))
            with self.assertRaises(RuntimeError):
                module.clear_lock(root)
            self.assertTrue((lock / 'pid').exists())
            (lock / 'pid').unlink()
            (lock / 'unexpected').write_text('keep')
            with self.assertRaises(RuntimeError):
                module.clear_lock(root)
            self.assertEqual((lock / 'unexpected').read_text(), 'keep')

    def test_empty_and_dead_pid_locks_can_be_cleared(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            lock = root / module.LOCK
            lock.mkdir()
            module.clear_lock(root)
            lock.mkdir()
            (lock / 'pid').write_text('999999999')
            module.clear_lock(root)
            self.assertFalse(lock.exists())

if __name__ == '__main__':
    unittest.main()
