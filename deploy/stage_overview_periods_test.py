import importlib.util
from pathlib import Path
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('period_stage', ROOT / 'deploy/stage-overview-periods.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.current = Path(self.temp.name) / 'current'
        self.output = Path(self.temp.name) / 'output'
        self.current.mkdir()
        html = (ROOT / 'app/index.html').read_text()
        html = re.sub(r'            <div class="overview-period-toolbar".*?data-overview-period-note.*?</p>\n', '', html, flags=re.S)
        html = html.replace('<p data-overview-dialogs-note>Диалоги с сообщениями за период</p>', '<p>В синхронизированных сообщениях</p>')
        html = html.replace('<div class="overview-grid">', '<!-- local store avatar --><div class="custom-identity">Store</div>\n            <div class="overview-grid">')
        (self.current / 'index.html').write_text(html + '\n<!-- local billing and api configuration -->')
        css = re.sub(r'/\* OVERVIEW_PERIODS_START \*/.*?/\* OVERVIEW_PERIODS_END \*/','',(ROOT / 'app/overview.css').read_text(),flags=re.S)
        (self.current / 'overview.css').write_text(css + '\n.local-theme{color:magenta}')
        for name in ('overview.js','app.js'):
            (self.current / name).write_text((ROOT / 'app' / name).read_text())

    def test_update_preserves_local_markup_controller_styles_and_is_idempotent(self):
        module.stage(self.current,ROOT / 'app',self.output)
        html = (self.output / 'index.html').read_text()
        self.assertIn('local store avatar',html)
        self.assertIn('local billing and api configuration',html)
        self.assertIn('plugin-purchase-options.js',html)
        self.assertIn('.local-theme{color:magenta}',(self.output / 'overview.css').read_text())
        self.assertEqual((self.output / 'app.js').read_bytes(),(self.current / 'app.js').read_bytes())
        again = self.output.parent / 'again'
        module.stage(self.output,ROOT / 'app',again)
        for name in ('index.html','overview.css','overview.js'):
            self.assertEqual((again / name).read_bytes(),(self.output / name).read_bytes())

    def test_unknown_layout_stops_before_any_output(self):
        (self.current / 'index.html').write_text('<main>custom</main>')
        with self.assertRaises(ValueError):
            module.stage(self.current,ROOT / 'app',self.output)
        self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
