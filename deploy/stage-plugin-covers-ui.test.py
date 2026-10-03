import importlib.util
from pathlib import Path
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stage_covers', ROOT / 'deploy/stage-plugin-covers-ui.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CoversStageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.local, self.incoming, self.out = [self.path / name for name in ['local', 'incoming', 'out']]
        self.local.mkdir(); self.incoming.mkdir()
        for file in ['app.js', 'index.html', 'app.test.mjs', 'plugin-page.js', 'plugin-page.test.mjs', 'plugin-cover.js', 'plugin-cover.css', 'plugin-cover.test.mjs']:
            (self.incoming / file).write_bytes((ROOT / 'app' / file).read_bytes())
        # Reverse only this update to obtain the supported installed version.
        app = (ROOT / 'app/app.js').read_text().replace('</a></div><div class="plugin-card__cover-meta">${adminMark}', '</a>${adminMark}')
        old_compression = '''async function compressPluginCover(file) {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
    throw new Error('Выберите PNG, JPEG или WebP до 2 МБ');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    let width = Math.min(640, bitmap.width);
    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(width * bitmap.height / bitmap.width));
      const context = canvas.getContext('2d');
      context.fillStyle = '#12141a'; context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const encoded = canvas.toDataURL('image/jpeg',0.65);
      if (encoded.length <= 18000) return encoded;
      width *= 0.7;
    }
    throw new Error('Изображение слишком сложное. Выберите другую обложку.');
  } finally { bitmap.close(); }
}
'''
        app = app.replace(module.function(app, 'compressPluginCover').group(), old_compression)
        page = (ROOT / 'app/plugin-page.js').read_text().replace("if (typeof isPluginCoverDataUrl === 'function' && isPluginCoverDataUrl(cover)) return cover;", 'if (cover.length <= 18000 && /^data:image\\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(cover)) return cover;')
        page = page.replace('<div class="plugin-page-cover__frame"><img', '<img').replace('decoding="async"></div><figcaption>', 'decoding="async"><figcaption>')
        page = re.sub(r'<p class="plugin-cover-guidance">.*?</p>', '', page)
        (self.incoming / 'base-app.js').write_text(app)
        (self.incoming / 'base-plugin-page.js').write_text(page)
        (self.local / 'app.js').write_text(app + '\n// Local auth and connector repair preserved.\n')
        (self.local / 'plugin-page.js').write_text(page + '\n// Local page customization outside updated functions.\n')
        html = (ROOT / 'app/index.html').read_text().replace('https://api.zetslay.pro', 'https://api.custom.test')
        html = re.sub(r'^.*plugin-cover\.(?:css|js).*\n', '', html, flags=re.M)
        (self.local / 'index.html').write_text(html)
        (self.local / 'messages.js').write_text('local inbox module')

    def tearDown(self):
        self.temp.cleanup()

    def stage(self):
        module.stage(self.local, self.incoming, self.out)

    def test_changes_only_selected_functions(self):
        original = (self.local / 'app.js').read_text()
        self.stage()
        staged = (self.out / 'app.js').read_text()
        for name in ['renderPlugins', 'compressPluginCover']:
            staged = staged.replace(module.function(staged, name).group(), module.function(original, name).group())
        self.assertEqual(staged, original)
        self.assertEqual((self.local / 'app.js').read_text(), original)
        original_page = (self.local / 'plugin-page.js').read_text()
        staged_page = (self.out / 'plugin-page.js').read_text()
        for name in ['pluginCoverSource', 'renderPluginAdminControls', 'pluginPageMarkup']:
            staged_page = staged_page.replace(module.function(staged_page, name).group(), module.function(original_page, name).group())
        self.assertEqual(staged_page, original_page)

    def test_retains_all_views_api_and_existing_inbox_module(self):
        self.stage()
        html = (self.out / 'index.html').read_text()
        strip = lambda value: re.sub(r'^.*plugin-cover\.(?:css|js).*\n', '', value, flags=re.M)
        self.assertEqual(strip(html), (self.local / 'index.html').read_text())
        self.assertIn('https://api.custom.test', html)
        self.assertEqual((self.out / 'messages.js').read_text(), 'local inbox module')

    def test_repeat_update_is_idempotent(self):
        self.stage()
        second = self.path / 'second'
        module.stage(self.out, self.incoming, second)
        for file in ['app.js', 'index.html', 'plugin-page.js', 'plugin-cover.js', 'plugin-cover.css']:
            self.assertEqual((self.out / file).read_bytes(), (second / file).read_bytes())
        html = (second / 'index.html').read_text()
        self.assertEqual(html.count('src="plugin-cover.js'), 1)
        self.assertEqual(html.count('href="plugin-cover.css'), 1)

    def test_unknown_compression_or_conflicts_stop_before_output(self):
        original = (self.local / 'app.js').read_text()
        for candidate in [original.replace('let width = Math.min(640, bitmap.width);', 'let width = customImageWidth();'), '<<<<<<< VPS\n' + original]:
            (self.local / 'app.js').write_text(candidate)
            with self.assertRaises(ValueError): self.stage()
            self.assertFalse(self.out.exists())
            self.assertEqual((self.local / 'app.js').read_text(), candidate)

    def test_missing_plugin_page_requires_its_installation_without_any_live_changes(self):
        (self.local / 'plugin-page.js').unlink()
        with self.assertRaisesRegex(ValueError, 'Сначала установите страницы плагинов'): self.stage()
        self.assertFalse(self.out.exists())


if __name__ == '__main__':
    unittest.main()
