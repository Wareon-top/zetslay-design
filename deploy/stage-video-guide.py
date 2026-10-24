"""Insert video cards and their stylesheet into the current cabinet HTML only."""
from pathlib import Path
import re
import sys

VERSION = '20261024-video-guide'
ASSETS = ('video-guide-banner.css', 'video-guide-banner.js', 'assets/video-guide-play.svg')
PLACES = {'dashboard': 'overview-heading', 'guide': 'kb-heading'}


def inject(html, template):
    if html.count('</head>') != 1 or html.count('</body>') != 1:
        raise ValueError('Не подтверждена структура страницы кабинета. Файлы не изменены.')
    for place, heading in PLACES.items():
        start = f'<!-- zetslay-video-guide:{place}:start -->'
        end = f'<!-- zetslay-video-guide:{place}:end -->'
        if html.count(start) != html.count(end) or html.count(start) > 1:
            raise ValueError('Не подтверждены границы баннера. Файлы не изменены.')
        html = re.sub(r'\n[ \t]*' + re.escape(start) + r'.*?' + re.escape(end), '', html, flags=re.S)
        # Only attach to the known heading in the matching top-level view.
        pattern = (r'(<section\b[^>]*\bdata-view=["\']' + place
                   + r'["\'][^>]*>\s*<header\b[^>]*\bclass=["\'][^"\']*\b'
                   + heading + r'\b[^"\']*["\'][^>]*>.*?</header>)')
        matches = list(re.finditer(pattern, html, re.S))
        if len(matches) != 1:
            raise ValueError(f'Не найден единственный заголовок раздела {place}. Файлы не изменены.')
        banner = template.replace('__PLACE__', place).strip()
        if banner.count(f'data-video-guide="{place}"') != 1:
            raise ValueError('Не подтверждён шаблон видео-инструкции.')
        match = matches[0]
        html = html[:match.end()] + '\n            ' + banner + html[match.end():]
    html = re.sub(r'[ \t]*<link\b[^>]*href=["\']video-guide-banner\.css(?:\?[^"\']*)?["\'][^>]*>\n?', '', html)
    html = re.sub(r'[ \t]*<script\b[^>]*src=["\']video-guide-banner\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>\n?', '', html)
    html = html.replace('</head>', f'  <link rel="stylesheet" href="video-guide-banner.css?v={VERSION}">\n</head>', 1)
    return html.replace('</body>', f'<script src="video-guide-banner.js?v={VERSION}" defer></script>\n</body>', 1)


def stage(local, incoming, out):
    local, incoming, out = map(Path, (local, incoming, out))
    html = inject((local / 'index.html').read_text(), (incoming / 'video-guide-banner.html').read_text())
    data = {name: (incoming / name).read_bytes() for name in ASSETS}
    out.mkdir(parents=True, exist_ok=True)
    for name, content in data.items():
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    (out / 'index.html').write_text(html)


if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (OSError, ValueError) as error:
        raise SystemExit(str(error))
