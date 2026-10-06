from pathlib import Path
import re
import sys

VERSION = '20261006-plugin-details'
ASSETS = ('plugin-detail-ui.js', 'plugin-detail-ui.css', 'plugin-detail-ui.test.mjs')
INPUTS = ('app.js', 'plugin-page.js', 'plugin-cover.js', 'plugin-rarity.js')


def stage(local: Path, incoming: Path, out: Path):
    html = (local / 'index.html').read_text()
    if 'data-plugin-page' not in html or html.count('</head>') != 1:
        raise ValueError('Неизвестная разметка страницы плагина. Кабинет не изменён.')
    original = {name: (local / name).read_bytes() for name in INPUTS}
    page = original['plugin-page.js'].decode()
    for marker in ('function pluginPageMarkup', 'plugin-page-description', 'plugin-page-layout', 'plugin-page-action', 'plugin-page-context'):
        if marker not in page:
            raise ValueError('Неизвестная версия страницы плагина: ' + marker + '. Кабинет не изменён.')
    assets = {name: (incoming / name).read_bytes() for name in ASSETS}
    html = re.sub(r'^[ \t]*<link\b[^\n]*href="plugin-detail-ui\.css(?:\?[^"\n]*)?"[^\n]*>\n?', '', html, flags=re.M)
    html = re.sub(r'^[ \t]*<script\b[^\n]*src="plugin-detail-ui\.js(?:\?[^"\n]*)?"[^\n]*></script>\n?', '', html, flags=re.M)
    script = re.compile(r'(<script\b[^>]*src="app\.js(?:\?[^"\n]*)?"[^>]*\bdefer[^>]*></script>)')
    if len(script.findall(html)) != 1 or 'src="plugin-page.js' not in html:
        raise ValueError('Не найден порядок загрузки модулей кабинета. Кабинет не изменён.')
    html = html.replace('</head>', '  <link rel="stylesheet" href="plugin-detail-ui.css?v=' + VERSION + '">\n  </head>', 1)
    html = script.sub(lambda match: match.group(1) + '\n    <script src="plugin-detail-ui.js?v=' + VERSION + '" defer></script>', html, count=1)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.html').write_text(html)
    for name, content in {**original, **assets}.items():
        (out / name).write_bytes(content)


if __name__ == '__main__':
    try:
        stage(*(Path(value) for value in sys.argv[1:]))
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
