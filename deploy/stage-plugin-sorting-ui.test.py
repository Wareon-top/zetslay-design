from pathlib import Path
import importlib.util
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sorting_stage', ROOT / 'deploy/stage-plugin-sorting-ui.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StageTest(unittest.TestCase):
    def local(self, root):
        local = root / 'local'
        local.mkdir()
        for name in ['app.js', 'index.html', 'plugin-rarity.js']:
            (local / name).write_bytes((ROOT / 'app' / name).read_bytes())
        return local

    def test_patches_old_sorting_and_preserves_vps_customizations(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = self.local(root)
            source = (local / 'app.js').read_text()
            start, end = module.sorting_block(source)
            source = source[:start] + 'function filterPluginCatalog(plugins, filter) { return plugins; }\n' + source[end:]
            source = source.replace("\n  const sortSelect = document.querySelector('[data-plugin-sort]');\n  if (sortSelect) sortSelect.value = state.pluginFilter.sort;", '')
            source += '\n// VPS CUSTOM CONNECTION LOGIC\n'
            (local / 'app.js').write_text(source)
            html = (local / 'index.html').read_text().replace('https://api.zetslay.pro', 'https://custom-api.test')
            html = html.replace('data-plugin-sort>', 'data-plugin-sort aria-label="Custom label">')
            html = html.replace('</head>', '<style>.plugin-card__cover { aspect-ratio: 4 / 2.9; }</style></head>')
            (local / 'index.html').write_text(html)
            (local / 'plugin-cover.css').write_text('CUSTOM COVER SETTINGS')
            original = {name: (local / name).read_bytes() for name in ['app.js', 'index.html', 'plugin-rarity.js', 'plugin-cover.css']}
            module.stage(local, ROOT / 'app', root / 'out')
            updated = (root / 'out/app.js').read_text()
            self.assertIn('VPS CUSTOM CONNECTION LOGIC', updated)
            self.assertIn('function pluginCatalogPrice(', updated)
            self.assertEqual(updated.count('const sortSelect ='), 1)
            self.assertEqual(updated[:updated.index('function renderPlugins()')], source[:source.index('function renderPlugins()')])
            output_html = (root / 'out/index.html').read_text()
            for marker in ['https://custom-api.test', 'Custom label', 'aspect-ratio: 4 / 2.9', 'connection-wizard-ui.js', 'plugin-cover.js']:
                self.assertIn(marker, output_html)
            self.assertEqual((root / 'out/plugin-rarity.js').read_bytes(), original['plugin-rarity.js'])
            self.assertFalse((root / 'out/plugin-cover.css').exists())
            for name, content in original.items():
                self.assertEqual((local / name).read_bytes(), content)

    def test_repeated_installation_has_identical_output(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            local = self.local(root)
            module.stage(local, ROOT / 'app', root / 'out')
            module.stage(root / 'out', ROOT / 'app', root / 'again')
            for name in ['app.js', 'index.html', 'plugin-rarity.js']:
                self.assertEqual((root / 'out' / name).read_bytes(), (root / 'again' / name).read_bytes())

    def test_unknown_or_duplicated_sections_stop_before_writing(self):
        cases = [
            ('app.js', 'function filterPluginCatalog(plugins, filter) { return plugins; }'),
            ('index.html', '<head></head><select data-plugin-sort></select><select data-plugin-sort></select><script src="app.js"></script>'),
            ('index.html', '<head></head><select data-plugin-sort></select>'),
            ('plugin-rarity.js', '// No rarity resolver'),
        ]
        for filename, content in cases:
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                local = self.local(root)
                (local / filename).write_text(content)
                with self.assertRaises(ValueError):
                    module.stage(local, ROOT / 'app', root / 'out')
                self.assertFalse((root / 'out').exists())


if __name__ == '__main__':
    unittest.main()
