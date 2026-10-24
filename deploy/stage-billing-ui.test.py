from pathlib import Path
import importlib.util
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('stage_billing', Path(__file__).with_name('stage-billing-ui.py'))
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)

PAGE = '''<!doctype html><html><head><meta name="zetslay-api-base-url" content="https://local-api.test"><link rel="stylesheet" href="cabinet-ui.css"></head><body><div class="app-shell" hidden><aside class="sidebar"><button data-view-target="billing">Finance</button></aside><section data-view="dashboard"><p data-vps-custom>Custom dashboard</p></section><section data-view="billing"><h1>Old finance</h1><section><p>Nested finance</p></section></section><section data-view="profile"><form data-profile-form>Custom profile</form></section></div><script src="app.js?local=1" defer></script><script src="custom-local.js" defer></script></body></html>'''
NEW = '<section data-view="billing" data-billing><header>New finance</header><section data-landing-pricing="plans-v1">' + ''.join(f'<article data-pricing-plan="{plan}" data-monthly-rub="{price}"></article>' for plan, price in zip(('start','growth','pro','maximum'),('149','299','499','799'))) + '</section></section>'


class StagingTest(unittest.TestCase):
    def setup_files(self, root, text=PAGE):
        local, incoming = root / 'local', root / 'incoming'
        local.mkdir(); incoming.mkdir()
        (local / 'index.html').write_text(text)
        (local / 'app.js').write_text('// custom store and auth logic')
        (local / 'plugin-cover.css').write_text('LOCAL COVER SIZE')
        (incoming / 'billing-section.html').write_text(NEW)
        for name in stage.ASSETS:
            (incoming / name).write_text('/* new asset */')
        return local, incoming

    def test_replaces_only_finance_and_asset_links_preserving_other_sections_and_modules(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); local, incoming = self.setup_files(root)
            original = {p.name:p.read_bytes() for p in local.iterdir()}
            stage.stage(local, incoming, root / 'out')
            updated = (root / 'out/index.html').read_text()
            old_span, _ = stage.section(PAGE)
            expected = PAGE[:old_span[0]] + NEW + PAGE[old_span[1]:]
            for name in stage.ASSETS:
                if name.endswith('.css'):
                    inserted = f'<link rel="stylesheet" href="{name}?v={stage.VERSION}">\n  '
                else:
                    inserted = f'<script src="{name}?v={stage.VERSION}" defer></script>\n  '
                updated = updated.replace(inserted, '')
            self.assertEqual(updated, expected)
            self.assertEqual(original, {p.name:p.read_bytes() for p in local.iterdir()})
            self.assertNotIn('app.js', [p.name for p in (root / 'out').iterdir()])

    def test_repeated_installation_is_identical_and_script_order_is_kept(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);local,incoming=self.setup_files(root)
            stage.stage(local,incoming,root / 'out')
            stage.stage(root / 'out',incoming,root / 'again')
            self.assertEqual((root / 'out/index.html').read_bytes(),(root / 'again/index.html').read_bytes())

    def test_duplicate_view_conflicts_and_missing_deferred_application_are_rejected_before_writes(self):
        for text in (PAGE.replace('data-view="profile"','data-view="billing"'),PAGE.replace('src="app.js?local=1" defer','src="app.js?local=1"'),PAGE.replace('</body>','\n<<<<<<< VPS\n</body>')):
            with self.subTest(text=text),tempfile.TemporaryDirectory() as temp:
                root=Path(temp);local,incoming=self.setup_files(root,text)
                with self.assertRaises(ValueError):stage.stage(local,incoming,root / 'out')
                self.assertFalse((root / 'out').exists())
                self.assertEqual((local / 'index.html').read_text(),text)

    def test_empty_resources_and_registration_cta_are_rejected(self):
        for registration in (False,True):
            with tempfile.TemporaryDirectory() as temp:
                root=Path(temp);local,incoming=self.setup_files(root)
                if registration:(incoming / 'billing-section.html').write_text(NEW.replace('New finance','<a href="app/?auth=register">Create account</a>'))
                else:(incoming / stage.ASSETS[0]).write_text('')
                with self.assertRaises(ValueError):stage.stage(local,incoming,root / 'out')
                self.assertFalse((root / 'out').exists())


if __name__ == '__main__':
    unittest.main()
