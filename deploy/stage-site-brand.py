"""Add shared icons and mobile logo anchors without replacing current pages."""
from pathlib import Path
import re
import sys

VERSION = '20261024-brand'
ASSETS = ('favicon.ico', 'apple-touch-icon.png', 'assets/zetslay-logo.webp', 'site-brand.css')
TAGS = '''  <link rel="icon" type="image/x-icon" href="/favicon.ico?v=20261024-brand">
  <link rel="icon" type="image/webp" href="/assets/zetslay-logo.webp?v=20261024-brand">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=20261024-brand">
  <link rel="stylesheet" href="/site-brand.css?v=20261024-brand">
'''
WORKSPACE = '<a class="site-workspace-brand" href="/" aria-label="ZetSlay — на главную"><img src="/assets/zetslay-logo.webp?v=20261024-brand" alt="" width="30" height="30" decoding="async"></a>'
AUTH = '<a class="site-auth-brand" href="/" aria-label="ZetSlay — на главную"><img src="/assets/zetslay-logo.webp?v=20261024-brand" alt="" width="32" height="32" decoding="async"><strong>ZetSlay</strong></a>'


def inject(html, cabinet=False):
    if html.count('</head>') != 1 or html.count('</body>') != 1:
        raise ValueError('Не подтверждена структура страницы. Файлы не изменены.')
    html = re.sub(r'[ \t]*<link\b[^>]*\brel=["\'](?:icon|shortcut icon|apple-touch-icon)["\'][^>]*>\n?', '', html, flags=re.I)
    html = re.sub(r'[ \t]*<link\b[^>]*\bhref=["\']/site-brand\.css(?:\?[^"\']*)?["\'][^>]*>\n?', '', html)
    html = html.replace('</head>', TAGS + '</head>', 1)
    if cabinet:
        for class_name, anchor, markup in [('site-workspace-brand', '<div class="topbar-context">', WORKSPACE),
                                           ('site-auth-brand', '<span class="auth-content__eyebrow">', AUTH)]:
            count = html.count('class="' + class_name + '"')
            if count > 1 or (not count and html.count(anchor) != 1):
                raise ValueError('Не подтверждён блок логотипа в кабинете. Файлы не изменены.')
            if not count:
                html = html.replace(anchor, markup + '\n          ' + anchor, 1)
    return html


def pages(root):
    # Full current entry points only; legal archives and fragment templates stay intact.
    paths = [root / 'index.html', root / 'app/index.html', *sorted((root / 'legal').glob('*.html'))]
    return [p for p in paths if p.is_file() and re.search(r'<head\b', p.read_text(), re.I)]


def stage(local, incoming, out):
    local, incoming, out = map(Path, (local, incoming, out))
    selected = pages(local)
    if not all(local / name in selected for name in ['index.html', 'app/index.html']):
        raise ValueError('Не найдены главная страница и кабинет. Файлы не изменены.')
    files = {str(p.relative_to(local)): inject(p.read_text(), p == local / 'app/index.html').encode() for p in selected}
    files.update({name: (incoming / name).read_bytes() for name in ASSETS})
    for name, content in files.items():
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    (out / 'brand-files.txt').write_text('\n'.join(files) + '\n')


if __name__ == '__main__':
    try:
        if len(sys.argv) == 3 and sys.argv[1] == '--list':
            root = Path(sys.argv[2])
            print('\n'.join(str(p.relative_to(root)) for p in pages(root)))
        else:
            stage(*sys.argv[1:])
    except (OSError, ValueError) as error:
        raise SystemExit(str(error))
