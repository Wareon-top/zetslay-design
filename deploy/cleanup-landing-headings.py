#!/usr/bin/env python3
"""Remove landing heading labels without replacing the VPS's other markup."""
from html.parser import HTMLParser
from pathlib import Path
import os
import re
import sys
import tarfile
import tempfile

STYLE = 'landing-headings.css'
VERSION = '20261004-clean-headings'

class Labels(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.offsets = [0]
        for line in text.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.in_main = False
        self.main_count = 0
        self.depth = 0
        self.start = 0
        self.ranges = []

    def position(self):
        row, column = self.getpos()
        return self.offsets[row - 1] + column

    def handle_starttag(self, tag, attrs):
        if tag == 'main':
            self.main_count += 1
            self.in_main = True
        if tag == 'span':
            classes = set(dict(attrs).get('class', '').split())
            if self.depth:
                self.depth += 1
            elif self.in_main and classes & {'section-kicker', 'access-eyebrow'}:
                self.start = self.position()
                self.depth = 1

    def handle_endtag(self, tag):
        if tag == 'span' and self.depth:
            self.depth -= 1
            if not self.depth:
                self.ranges.append((self.start, self.text.index('>', self.position()) + 1))
        if tag == 'main':
            self.in_main = False

def clean_html(text):
    if re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M):
        raise ValueError('В index.html есть маркеры конфликта')
    parser = Labels(text)
    parser.feed(text)
    parser.close()
    if parser.main_count != 1 or parser.depth or text.count('</head>') != 1:
        raise ValueError('Неизвестная структура главной страницы')
    for begin, end in reversed(parser.ranges):
        text = text[:begin] + text[end:]
    text, count = re.subn(r'[ \t]*<link\b[^>]*href=["\']landing-headings\.css(?:\?[^"\']*)?["\'][^>]*>\n?', '', text)
    if count > 1:
        raise ValueError('Дублируется загрузка стилей заголовков')
    text = text.replace('</head>', f'  <link rel="stylesheet" href="{STYLE}?v={VERSION}">\n</head>', 1)
    return text, len(parser.ranges)

def atomic_write(path, data):
    fd, name = tempfile.mkstemp(prefix='.zetslay-headings.', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
        os.chmod(name, path.stat().st_mode & 0o777 if path.exists() else 0o644)
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)

def install(site, stylesheet):
    site = Path(site).resolve()
    lock = site / '.zetslay-landing-hero-update.lock'
    lock.mkdir()
    try:
        index = site / 'index.html'
        css = site / STYLE
        previous = {index: index.read_bytes(), css: css.read_bytes() if css.exists() else None}
        updated, count = clean_html(previous[index].decode())
        new_css = Path(stylesheet).read_bytes()
        fd, backup = tempfile.mkstemp(prefix='zetslay-site-before-headings.', suffix='.tar.gz', dir=os.environ.get('ZETSLAY_BACKUP_DIR', '/root'))
        os.close(fd)
        with tarfile.open(backup, 'w:gz') as archive:
            for path, value in previous.items():
                if value is not None:
                    archive.add(path, arcname=path.name)
        try:
            atomic_write(css, new_css)
            atomic_write(index, updated.encode())
        except OSError:
            for path, value in previous.items():
                if value is None:
                    path.unlink(missing_ok=True)
                else:
                    atomic_write(path, value)
            raise
        print(f'Надписи над заголовками удалены: {count}. Резервная копия: {backup}')
    finally:
        lock.rmdir()

if __name__ == '__main__':
    try:
        if len(sys.argv) != 3:
            raise ValueError('Укажите каталог сайта и файл стилей')
        install(*sys.argv[1:])
    except (OSError, ValueError) as error:
        print(f'Обновление не завершено: {error}', file=sys.stderr)
        sys.exit(1)
