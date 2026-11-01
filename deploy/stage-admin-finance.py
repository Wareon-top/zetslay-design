"""Add project finance assets without replacing auth, payments, sync, sidebar or app.js."""
from pathlib import Path
import re
import sys

VERSION = '20261017-admin-finance'
ASSETS = ['admin-finance.js', 'admin-finance.css', 'admin-panel.js']

def stage(local, incoming, out):
    local, incoming, out = map(Path, (local, incoming, out))
    html = (local / 'index.html').read_text()
    if html.count('</head>') != 1 or 'data-admin-root' not in html or re.search(r'^(<<<<<<<|=======|>>>>>>>)', html, re.M):
        raise ValueError('Не подтверждена структура админ-панели. Файлы не изменены.')
    panel = r'<script\b[^>]*src=["\']admin-panel\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
    matches = list(re.finditer(panel, html))
    if len(matches) != 1 or 'defer' not in matches[0].group() or 'async' in matches[0].group():
        raise ValueError('Не подтверждён порядок загрузки админ-панели. Файлы не изменены.')
    for asset in ['admin-finance.js', 'admin-finance.css']:
        pattern = r'<(?:script|link)\b[^>]*(?:src|href)=["\']' + re.escape(asset) + r'(?:\?[^"\']*)?["\'][^>]*(?:>\s*</script>|>)'
        if len(re.findall(pattern, html)) > 1:
            raise ValueError('Дублируется ресурс ' + asset)
        html = re.sub(pattern, '', html)
    html = html.replace('</head>', f'<link rel="stylesheet" href="admin-finance.css?v={VERSION}">\n</head>', 1)
    html = re.sub(panel, f'<script src="admin-finance.js?v={VERSION}" defer></script>\n    <script src="admin-panel.js?v={VERSION}" defer></script>', html)
    if html.index('src="admin-finance.js') > html.index('src="admin-panel.js') or html.index('src="admin-panel.js') > html.index('src="app.js'):
        raise ValueError('Не подтверждён порядок модулей. Файлы не изменены.')
    for asset in ASSETS:
        if not (incoming / asset).is_file():
            raise ValueError('Не найден ресурс ' + asset)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.html').write_text(html)
    for asset in ASSETS:
        (out / asset).write_bytes((incoming / asset).read_bytes())

if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (OSError, ValueError) as error:
        raise SystemExit(str(error))
