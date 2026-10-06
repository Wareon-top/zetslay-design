from pathlib import Path
from html.parser import HTMLParser
import re
import sys

VERSION = '20261006-cabinet'
ASSET = 'cabinet-ui.css'


class CabinetPage(HTMLParser):
    def __init__(self):
        super().__init__()
        self.shells = 0
        self.sidebars = 0
        self.topbars = 0
        self.head_closes = 0
        self.head_open = False
        self.styles = []
        self.app_scripts = 0

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        classes = attrs.get('class', '').split()
        if tag == 'head':
            self.head_open = True
        self.shells += 'app-shell' in classes
        self.sidebars += 'sidebar' in classes
        self.topbars += 'topbar' in classes
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.styles.append((attrs.get('href', ''), self.head_open))
        if tag == 'script' and re.fullmatch(r'app\.js(?:\?[^\s]*)?', attrs.get('src', '')):
            self.app_scripts += 1

    def handle_endtag(self, tag):
        if tag == 'head':
            self.head_open = False
            self.head_closes += 1


def stage(local: Path, incoming: Path, output: Path):
    original = (local / 'index.html').read_bytes()
    text = original.decode('utf-8')
    page = CabinetPage()
    page.feed(text)
    if (page.shells, page.sidebars, page.topbars, page.app_scripts, page.head_closes) != (1, 1, 1, 1, 1):
        raise ValueError('Структура кабинета не подтверждена; сайт не изменён.')
    if not page.styles or any(not in_head for _, in_head in page.styles):
        raise ValueError('Неизвестный порядок стилей; сайт не изменён.')
    css = (incoming / ASSET).read_bytes()
    if not css.strip():
        raise ValueError('Файл оформления пуст; сайт не изменён.')
    # Remove only our link. No DOM reserialization: preserve all local markup byte for byte.
    own_link = re.compile(r'<link\b(?=[^>]*\brel=[\"\']stylesheet[\"\'])(?=[^>]*\bhref=[\"\']cabinet-ui\.css(?:\?[^\"\']*)?[\"\'])[^>]*>')
    link = f'<link rel="stylesheet" href="{ASSET}?v={VERSION}">'
    previous = list(own_link.finditer(text))
    if previous:
        if len(previous) != 1 or not page.styles[-1][0].startswith(ASSET):
            raise ValueError('Неизвестный порядок обновлённых стилей; сайт не изменён.')
        text = own_link.sub(lambda _: link, text, count=1)
    else:
        closing = re.search(r'</head\s*>', text, re.IGNORECASE)
        if not closing:
            raise ValueError('Не найден конец заголовка страницы; сайт не изменён.')
        text = text[:closing.start()] + f'{link}\n  ' + text[closing.start():]
    output.mkdir(parents=True, exist_ok=False)
    (output / ASSET).write_bytes(css)
    (output / 'index.html').write_bytes(text.encode('utf-8'))


if __name__ == '__main__':
    try:
        stage(*(Path(arg) for arg in sys.argv[1:]))
    except (ValueError, OSError, UnicodeError) as error:
        raise SystemExit(str(error))
