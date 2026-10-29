"""Install the announcement alongside the current cabinet without replacing other UI modules."""
from pathlib import Path
import re
import sys

VERSION = '20261017-launch-reference'
ASSETS = ['launch-announcement.js', 'launch-announcement.css', 'launch-announcement.test.mjs', 'assets/launch-cover.jpg', 'assets/launch-brand.webp']

def require(value, message):
    if not value:
        raise ValueError(message + ' Файлы не изменены.')

def stage(local, incoming, out):
    local, incoming, out = map(Path, [local, incoming, out])
    html = (local / 'index.html').read_text()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)', html, re.M), 'Конфликт разметки.')
    for name in ['app.js', 'learning.js']:
        require((local / name).is_file() and re.search(r'<script\b[^>]*src=["\']' + re.escape(name) + r'(?:\?[^"\']*)?["\']', html), 'Не подтверждён кабинет: ' + name)
    require(html.count('</head>') == 1 and html.count('</body>') == 1, 'Не подтверждена разметка кабинета.')
    files = {name: (incoming / name).read_bytes() for name in ASSETS}
    patterns = [r'<link\b[^>]*href=["\']launch-announcement\.css(?:\?[^"\']*)?["\'][^>]*>', r'<script\b[^>]*src=["\']launch-announcement\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>']
    for pattern in patterns:
        require(len(re.findall(pattern, html)) <= 1, 'Уведомление подключено несколько раз.')
        html = re.sub(pattern + r'[ \t]*\r?\n?', '', html)
    html = html.replace('</head>', f'<link rel="stylesheet" href="launch-announcement.css?v={VERSION}">\n</head>')
    html = html.replace('</body>', f'<script src="launch-announcement.js?v={VERSION}" defer></script>\n</body>')
    files['index.html'] = html.encode('utf-8')
    for name, text in files.items():
        path = out / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text)

if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (OSError, ValueError) as error:
        raise SystemExit(str(error))
