"""Replace only the proxy offer artwork, retaining current purchase logic."""
from pathlib import Path
import re
import sys

VERSION = '20261024-proxy-logo'
OLD = '<img src="assets/proxy-offer.jpg" alt="" width="480" height="320" decoding="async">'
NEW = '<img src="/assets/zetslay-logo.webp?v=20261024-proxy-logo" alt="" width="160" height="160" decoding="async">'


def artwork(text, count):
    if text.count(OLD) == count:
        return text.replace(OLD, NEW)
    if text.count(NEW) == count and OLD not in text:
        return text
    raise ValueError('Не подтверждена текущая иллюстрация баннера. Файлы не изменены.')


def stage(local, incoming, out):
    local, incoming, out = map(Path, (local, incoming, out))
    html = artwork((local / 'app/index.html').read_text(), 2)
    for name in ['proxy-shop.css', 'proxy-shop.js']:
        pattern = r'((?:href|src)="' + re.escape(name) + r')(?:\?[^"<>]*)?("[^>]*>)'
        html, count = re.subn(pattern, lambda m: m[1] + '?v=' + VERSION + m[2], html)
        if count != 1:
            raise ValueError('Не подтверждено подключение баннера. Файлы не изменены.')
    js = artwork((local / 'app/proxy-shop.js').read_text(), 1)
    css = (local / 'app/proxy-shop.css').read_text()
    pattern = r'(\.ps-invite-visual img\s*\{[^}]*object-fit:)cover(?=;)'
    css, count = re.subn(pattern, r'\1contain', css)
    if count != 1 and not re.search(pattern.replace('cover', 'contain'), css):
        raise ValueError('Не подтверждены размеры иллюстрации. Файлы не изменены.')
    files = {'app/index.html': html.encode(), 'app/proxy-shop.js': js.encode(),
             'app/proxy-shop.css': css.encode(),
             'assets/zetslay-logo.webp': (incoming / 'assets/zetslay-logo.webp').read_bytes()}
    for name, content in files.items():
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (OSError, ValueError) as error:
        raise SystemExit(str(error))
