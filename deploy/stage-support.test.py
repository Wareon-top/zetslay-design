from pathlib import Path
import importlib.util,tempfile,unittest
spec=importlib.util.spec_from_file_location('support_stage',Path(__file__).with_name('stage-support.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class StageTest(unittest.TestCase):
 def test_preserves_live_routes_blog_and_private_helpers(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);local=root/'local';incoming=root/'incoming';local.mkdir();incoming.mkdir()
   html='<html><head></head><body><nav><button class="nav-item" data-view-target="guide">База знаний</button><a href="https://t.me/zetslay">Мой блог</a></nav><section class="view admin-page" data-admin-root></section><script src="admin-panel.js?v=old" defer></script><script src="app.js?v=old" defer></script><script src="payments.js?v=keep" defer></script></body></html>'
   app="  admin: 'Админ-панель',\n  if (typeof adminAccess === 'function') adminAccess();\nfunction resetAccountData() {\n}\n  if (typeof adminRoute === 'function') adminRoute(resolvedView);\n// PRIVATE_AUTH_AND_SYNC_CUSTOMIZATION"
   (local/'index.html').write_text(html);(local/'app.js').write_text(app)
   for name in module.ASSETS:(incoming/name).write_text(name)
   module.stage(local,incoming,root/'out');module.stage(root/'out',incoming,root/'again')
   result=(root/'again/index.html').read_text();source=(root/'again/app.js').read_text()
   self.assertEqual(result.count('data-view-target="support"'),1);self.assertEqual(result.count('src="support.js'),1);self.assertEqual(result.count('data-support-root="user"'),1)
   self.assertIn('Мой блог',result);self.assertIn('payments.js?v=keep',result);self.assertIn('PRIVATE_AUTH_AND_SYNC_CUSTOMIZATION',source);self.assertEqual(source.count('supportReset()'),1)
 def test_does_not_write_unknown_cabinet(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);(root/'index.html').write_text('<head></head>');(root/'app.js').write_text('unknown')
   with self.assertRaises(ValueError):module.stage(root,root,root/'out')
   self.assertFalse((root/'out').exists())
if __name__=='__main__':unittest.main()
