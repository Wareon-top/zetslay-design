"""Installation checks: preserve live logic, fail safely, restore partial writes."""
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
import os
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = spec_from_file_location('video_guide', ROOT / 'deploy/stage-video-guide.py')
module = module_from_spec(spec)
spec.loader.exec_module(module)
TEMPLATE = (ROOT / 'deploy/video-guide-banner.html').read_text()
HTML = '''<!doctype html><html><head><script src="app.js?v=live-password-fix" defer></script></head><body>
<section class="view overview" data-view="dashboard"><header class="overview-heading"><div><h1>Live title</h1></div></header><aside data-live-dashboard>LIVE</aside></section>
<section class="view" data-view="guide"><header class="kb-heading"><div>Live guide</div></header><div data-live-article>LIVE</div></section>
</body></html>'''


class StageTests(unittest.TestCase):
    def test_live_sections_and_version_tags_survive_and_rerun_is_identical(self):
        result = module.inject(HTML, TEMPLATE)
        self.assertEqual(result.count('data-video-guide='), 2)
        self.assertIn('app.js?v=live-password-fix', result)
        self.assertIn('<aside data-live-dashboard>LIVE</aside>', result)
        self.assertIn('<div data-live-article>LIVE</div>', result)
        self.assertEqual(result, module.inject(result, TEMPLATE))
        for place in module.PLACES:
            self.assertIn(f'aria-labelledby="video-guide-{place}-title"', result)
        self.assertNotIn('<iframe', result)

    def test_ambiguous_missing_or_broken_anchor_rejected(self):
        for html in (HTML.replace('kb-heading', 'unknown-heading'), HTML + HTML,
                     HTML.replace('</body>', '<!-- zetslay-video-guide:guide:start --></body>')):
            with self.assertRaises(ValueError):
                module.inject(html, TEMPLATE)

    def test_installer_publishes_html_last_and_rolls_back_on_interruption(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'app/assets').mkdir(parents=True)
            (root / 'deploy').mkdir()
            for name in module.ASSETS:
                (root / 'app' / name).write_bytes((ROOT / 'app' / name).read_bytes())
            for name in ('stage-video-guide.py', 'video-guide-banner.html', 'update-video-guide.sh'):
                (root / 'deploy' / name).write_bytes((ROOT / 'deploy' / name).read_bytes())
            (root / 'app/index.html').write_text(HTML)
            (root / 'app/app.js').write_text('// live API and password fixes')
            def git(*args):
                return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()
            git('init', '-q')
            git('add', '.')
            git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture')
            revision = git('rev-parse', 'HEAD')
            # The incoming assets differ from the files currently served.
            (root / 'app/video-guide-banner.css').write_text('/* existing live CSS */')
            (root / 'app/assets/video-guide-play.svg').unlink()
            bin_dir = root / 'bin'
            bin_dir.mkdir()
            # Fail only on HTML publication, after both assets were written.
            (bin_dir / 'mv').write_text('#!/bin/bash\nif [[ "${@: -1}" == app/index.html ]]; then exit 71; fi\nexec /bin/mv "$@"\n')
            (bin_dir / 'mv').chmod(0o755)
            env = dict(os.environ, ZETSLAY_SITE_DIR=str(root), ZETSLAY_BACKUP_DIR=str(root),
                       ZETSLAY_VIDEO_GUIDE_REVISION=revision, PATH=str(bin_dir) + ':' + os.environ['PATH'])
            run = subprocess.run(['bash', str(root / 'deploy/update-video-guide.sh')], env=env, capture_output=True, text=True)
            self.assertEqual(run.returncode, 71, run.stderr)
            self.assertEqual((root / 'app/index.html').read_text(), HTML)
            self.assertEqual((root / 'app/video-guide-banner.css').read_text(), '/* existing live CSS */')
            self.assertFalse((root / 'app/assets/video-guide-play.svg').exists())
            env['PATH'] = os.environ['PATH']
            for _ in range(2):
                subprocess.run(['bash', str(root / 'deploy/update-video-guide.sh')], env=env, check=True, capture_output=True)
            self.assertEqual((root / 'app/index.html').read_text().count('data-video-guide='), 2)
            self.assertEqual((root / 'app/app.js').read_text(), '// live API and password fixes')
            self.assertEqual((next(root.glob('zetslay-before-video-guide.*.tar.gz')).stat().st_mode & 0o777), 0o600)


if __name__ == '__main__':
    unittest.main()
