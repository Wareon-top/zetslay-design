from pathlib import Path
import re
import sys

VERSION = '20261006-compact-catalog'


def stage(local: Path, incoming: Path, out: Path):
    html = (local / 'index.html').read_text()
    for marker in ('plugin-catalog', 'id="plugin-grid"', 'data-plugin-search', 'data-plugin-category', 'data-plugin-sort'):
        if marker not in html:
            raise ValueError('Неизвестная разметка каталога: ' + marker + '. Кабинет не изменён.')
    if html.count('</head>') != 1:
        raise ValueError('Не найдена единственная секция head. Кабинет не изменён.')
    css = (incoming / 'plugin-catalog.css').read_bytes()
    html = re.sub(r'^[ \t]*<link\b[^\n]*href="plugin-catalog\.css(?:\?[^"\n]*)?"[^\n]*>\n?', '', html, flags=re.M)
    html = html.replace('</head>', '  <link rel="stylesheet" href="plugin-catalog.css?v=' + VERSION + '">\n  </head>', 1)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.html').write_text(html)
    (out / 'plugin-catalog.css').write_bytes(css)


if __name__ == '__main__':
    try:
        stage(*(Path(value) for value in sys.argv[1:]))
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
