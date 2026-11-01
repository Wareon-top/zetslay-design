"""Add one local stylesheet without replacing customized cabinet/landing HTML."""
from pathlib import Path
import re
import sys

VERSION = '20261011-rarity-beam'


def stylesheet(html, asset, anchor):
    if html.lower().count('</head>') != 1:
        raise ValueError('Не найден единственный head. Файлы не изменены.')
    if not re.search(r'<link\b[^>]*\bhref=[\"\']' + re.escape(anchor) + r'(?:\?[^\"\']*)?[\"\']', html, re.I):
        raise ValueError('Не найдены стили каталога. Файлы не изменены.')
    pattern = r'<link\b[^>]*\bhref=[\"\']' + re.escape(asset) + r'(?:\?[^\"\']*)?[\"\'][^>]*>'
    matches = list(re.finditer(pattern, html, re.I))
    if len(matches) > 1:
        raise ValueError('Подключение анимации дублируется. Файлы не изменены.')
    link = f'<link rel="stylesheet" href="{asset}?v={VERSION}">'
    if matches:
        match = matches[0]
        return html[:match.start()] + link + html[match.end():]
    return re.sub(r'</head>', lambda _: '  ' + link + '\n</head>', html, count=1, flags=re.I)


def stage(local, incoming, out):
    local, incoming, out = Path(local), Path(incoming), Path(out)
    outputs = {
        'app/index.html': stylesheet((local / 'app/index.html').read_text(), 'plugin-shine.css', 'plugin-catalog.css'),
        'index.html': stylesheet((local / 'index.html').read_text(), 'app/plugin-shine.css', 'landing-plugins.css'),
        'app/plugin-shine.css': (incoming / 'app/plugin-shine.css').read_text(),
    }
    # Validate all inputs before creating any output; no JS or existing CSS is patched.
    if '@keyframes plugin-meteor-orbit' not in outputs['app/plugin-shine.css']:
        raise ValueError('Файл анимации не подтверждён. Файлы не изменены.')
    for name, content in outputs.items():
        path = out / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)


if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (ValueError, OSError) as error:
        raise SystemExit(str(error))
