from html.parser import HTMLParser
from pathlib import Path
import re
import sys

VERSION = '20261006-finances'
ASSETS = ('billing-pricing.css', 'billing.css', 'billing-pricing.js', 'billing.js')


class BillingSection(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.text = text
        self.offsets = [0]
        for line in text.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.stack = []
        self.sections = []
        self.app_scripts = []

    def absolute_index(self):
        row, col = self.getpos()
        return self.offsets[row - 1] + col

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'section':
            self.stack.append((self.absolute_index(), attrs.get('data-view') == 'billing'))
        if tag == 'script' and re.fullmatch(r'app\.js(?:\?[^\s]*)?', attrs.get('src', '')):
            self.app_scripts.append(('defer' in attrs, self.absolute_index()))

    def handle_endtag(self, tag):
        if tag == 'section' and self.stack:
            start, billing = self.stack.pop()
            if billing:
                finish = self.text.index('>', self.absolute_index()) + 1
                self.sections.append((start, finish))


def section(text):
    parser = BillingSection(text)
    parser.feed(text)
    if len(parser.sections) != 1 or parser.stack:
        raise ValueError('Не найден единственный корректный раздел «Финансы»; кабинет не изменён.')
    return parser.sections[0], parser


def stage(local, incoming, output):
    local, incoming, output = map(Path, (local, incoming, output))
    text = (local / 'index.html').read_text()
    replacement = (incoming / 'billing-section.html').read_text().rstrip('\n')
    if re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M):
        raise ValueError('Найдены маркеры конфликта; кабинет не изменён.')
    (start, finish), page = section(text)
    (new_start, new_finish), _ = section(replacement)
    if new_start != 0 or new_finish != len(replacement) or 'data-billing' not in replacement:
        raise ValueError('Структура обновления не подтверждена; кабинет не изменён.')
    if len(page.app_scripts) != 1 or not page.app_scripts[0][0]:
        raise ValueError('Не найден единственный отложенный модуль кабинета; кабинет не изменён.')
    if text.count('</head>') != 1 or text.count('</body>') != 1:
        raise ValueError('Неизвестная структура страницы; кабинет не изменён.')
    if re.findall(r'data-monthly-rub="(\d+)"', replacement) != ['149', '299', '499', '799'] or 'auth=register' in replacement:
        raise ValueError('Тарифы или действия обновления не подтверждены; кабинет не изменён.')
    assets = {name:(incoming / name).read_bytes() for name in ASSETS}
    if not all(data.strip() for data in assets.values()):
        raise ValueError('Ресурсы оформления пусты; кабинет не изменён.')
    text = text[:start] + replacement + text[finish:]
    for name in ASSETS:
        css = name.endswith('.css')
        tag, attr = ('link', 'href') if css else ('script', 'src')
        pattern = rf'(<{tag}\b[^>]*\b{attr}=["\']){re.escape(name)}(?:\?[^"\']*)?(["\'])'
        text, count = re.subn(pattern, lambda m: m[1] + name + '?v=' + VERSION + m[2], text)
        if count > 1:
            raise ValueError('Ресурсы финансов дублируются; кабинет не изменён.')
        if not count:
            end = '</head>' if css else '</body>'
            markup = f'<link rel="stylesheet" href="{name}?v={VERSION}">\n  ' if css else f'<script src="{name}?v={VERSION}" defer></script>\n  '
            text = text.replace(end, markup + end, 1)
    matches = [list(re.finditer(rf'<script\b[^>]*\bsrc=["\']{re.escape(name)}(?:\?[^"\']*)?["\'][^>]*>', text)) for name in ('app.js', 'billing-pricing.js', 'billing.js')]
    if any(len(items) != 1 or not re.search(r'\bdefer(?:\s|>|=)', items[0][0]) for items in matches) or not matches[0][0].start() < matches[1][0].start() < matches[2][0].start():
        raise ValueError('Неизвестный порядок модулей финансов; кабинет не изменён.')
    output.mkdir(parents=True, exist_ok=False)
    (output / 'index.html').write_text(text)
    for name, data in assets.items():
        (output / name).write_bytes(data)


if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (ValueError, OSError, UnicodeError) as error:
        raise SystemExit(str(error))
