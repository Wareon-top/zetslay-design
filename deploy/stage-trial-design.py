"""Restore only trial presentation; preserve the current cabinet and trial logic."""
from pathlib import Path
import re
import sys

VERSION = '20261023-trial-restored'


def stage(local, incoming, out):
    local, incoming, out = map(Path, (local, incoming, out))
    html = (local / 'index.html').read_text()
    if html.count('</head>') != 1 or html.count('data-sidebar-trial') != 1 or \
            html.count('class="sidebar-trial__ribbon"') != 1:
        raise ValueError('Плашка пробного доступа не распознана. Кабинет не изменён.')
    pattern = r'(<link\b[^>]*\bhref=["\'])sidebar-trial\.css(?:\?[^"\']*)?(["\'][^>]*>)'
    if len(re.findall(pattern, html)) != 1:
        raise ValueError('Не подтверждено подключение стилей плашки.')
    html = re.sub(pattern, lambda m: m[1] + 'sidebar-trial.css?v=' + VERSION + m[2], html)
    if re.search(r'^(<<<<<<<|=======|>>>>>>>)', html, re.M):
        raise ValueError('В разметке обнаружен конфликт.')
    css = (incoming / 'sidebar-trial.css').read_bytes()
    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.html').write_text(html)
    (out / 'sidebar-trial.css').write_bytes(css)


if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (ValueError, OSError) as error:
        raise SystemExit(str(error))
