#!/usr/bin/env python3
"""Remove only the retired closing CTA, preserving VPS edits elsewhere."""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


class Sections(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.offsets = [0]
        for line in text.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.stack = []
        self.found = []

    def absolute_offset(self):
        line, column = self.getpos()
        return self.offsets[line - 1] + column

    def handle_starttag(self, tag, attrs):
        if tag == 'section':
            self.stack.append((self.absolute_offset(), dict(attrs)))

    def handle_endtag(self, tag):
        if tag == 'section' and self.stack:
            start, attrs = self.stack.pop()
            if attrs.get('id') == 'cta':
                self.found.append((start, self.absolute_offset() + len('</section>'), attrs))


def remove(text):
    parser = Sections(text)
    parser.feed(text)
    if not parser.found:
        if re.search(r'\bid\s*=\s*[\"\']cta[\"\']', text):
            raise ValueError('Блок CTA повреждён; файл не изменён.')
        return text
    if len(parser.found) != 1:
        raise ValueError('Найдено несколько блоков CTA; файл не изменён.')
    start, end, attrs = parser.found[0]
    block = text[start:end]
    plain = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', block))
    if ('closing' not in attrs.get('class', '').split()
            or 'Магазин под вашим' not in plain
            or 'Создайте кабинет и начните с проверки подключения.' not in plain):
        raise ValueError('Неизвестный блок CTA; файл не изменён.')
    line_start = text.rfind('\n', 0, start) + 1
    if not text[line_start:start].strip():
        start = line_start
    if text[end:end + 1] == '\n':
        end += 1
    return text[:start] + text[end:]


if __name__ == '__main__':
    source, output = map(Path, sys.argv[1:])
    output.write_text(remove(source.read_text(encoding='utf-8')), encoding='utf-8')
