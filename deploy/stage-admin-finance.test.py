from pathlib import Path
import importlib.util
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('finance_stage', Path(__file__).with_name('stage-admin-finance.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class StageTest(unittest.TestCase):
    def test_keeps_existing_customizations_and_can_repeat(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); local=root/'local'; incoming=root/'incoming'; out=root/'out'
            local.mkdir(); incoming.mkdir()
            original='<html><head></head><body><nav><a href="https://t.me/zetslay">Мой блог</a></nav><div data-admin-root></div><script src="admin-panel.js?v=old" defer></script><script src="app.js?v=keep-me" defer></script><script src="payments.js?v=keep-me" defer></script></body></html>'
            (local/'index.html').write_text(original)
            for name in module.ASSETS: (incoming/name).write_text(name)
            module.stage(local,incoming,out)
            first=(out/'index.html').read_text()
            self.assertIn('Мой блог',first); self.assertIn('payments.js?v=keep-me',first); self.assertIn('app.js?v=keep-me',first)
            module.stage(out,incoming,root/'again')
            second=(root/'again/index.html').read_text()
            self.assertEqual(second.count('src="admin-finance.js'),1); self.assertEqual(second.count('href="admin-finance.css'),1)
            self.assertLess(second.index('src="admin-finance.js'),second.index('src="admin-panel.js'))
            self.assertEqual((local/'index.html').read_text(),original)

    def test_rejects_missing_or_duplicate_panel(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); local=root/'local'; local.mkdir()
            for html in ['<head></head><div data-admin-root></div>', '<head></head><div data-admin-root></div>'+'<script src="admin-panel.js" defer></script>'*2]:
                (local/'index.html').write_text(html)
                with self.assertRaises(ValueError): module.stage(local,root,root/'out')
                self.assertFalse((root/'out').exists())

if __name__ == '__main__': unittest.main()
