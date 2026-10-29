from pathlib import Path
import re
import shutil
import sys

def stage(local, incoming, output):
    local, incoming, output = map(Path, (local, incoming, output))
    html = (local / 'index.html').read_text()
    assert len(re.findall(r'<script\b[^>]*src="lots\.js\?', html)) == 1, 'Не подтверждён раздел лотов'
    assert len(re.findall(r'<script\b[^>]*src="lot-management\.js\?', html)) == 1, 'Не подтверждено управление лотами'
    assert 'data-lots-workspace' in html, 'Не найден контейнер лотов'
    html = re.sub(r'\s*<script\b[^>]*src="lot-raise\.js[^\"]*"[^>]*></script>', '', html)
    html = re.sub(r'\s*<link\b[^>]*href="lot-raise\.css[^\"]*"[^>]*>', '', html)
    html, n = re.subn(r'\s*(<script\b[^>]*src="lot-management\.js[^\"]*"[^>]*></script>)', '\n    <script src="lot-raise.js?v=20261020-lot-raise" defer></script>\n    '+r'\1', html)
    assert n == 1
    html = re.sub(r'\s*</head>', '\n<link rel="stylesheet" href="lot-raise.css?v=20261020-lot-raise">\n</head>', html)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'index.html').write_text(html)
    for name in ['lot-raise.js', 'lot-raise.css', 'lot-raise.test.mjs']:
        shutil.copy2(incoming / name, output / name)

if __name__ == '__main__':
    stage(*sys.argv[1:])
