#!/usr/bin/env python3
"""Stage only #faq and its two self-contained FAQ assets."""
from pathlib import Path
import re
import sys

FILES = ['landing-faq.css', 'landing-faq.js']
VERSION = '20261006-faq-knowledge'


def require(condition, message):
    if not condition:
        raise ValueError(message + '. Сайт не изменён.')


def faq_section(text):
    sections = list(re.finditer(r'<section\b(?=[^>]*\bid=["\']faq["\'])[^>]*>.*?</section>', text, re.S))
    require(len(sections) == 1, 'Не найден единственный блок id=faq')
    section = sections[0]
    require(section.group().count('<section') == 1, 'Неизвестная вложенная структура блока FAQ')
    return section


def stage(local, incoming, output):
    local, incoming, output = map(Path, [local, incoming, output])
    text = (local / 'index.html').read_text()
    desired = (incoming / 'index.html').read_text()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M), 'Найдены маркеры конфликта')
    old, new = faq_section(text), faq_section(desired)
    require('data-landing-faq="knowledge-v1"' in new.group(), 'В обновлении нет блока FAQ')
    cards = re.findall(r'<details\b[^>]*\bid=["\']([^"\']+)["\'][^>]*\bdata-faq-item|<details\b[^>]*\bdata-faq-item[^>]*\bid=["\']([^"\']+)["\']', new.group())
    ids = [a or b for a, b in cards]
    require(len(ids) == len(set(ids)) == 12, 'В обновлении должны быть двенадцать различных вопросов')
    require('data-faq-search' in new.group(), 'Нет поиска по вопросам')
    require('Текущий коннектор работает в режиме чтения и не отправляет' not in new.group(), 'Найден устаревший ответ об отправке сообщений')
    assets = {name: (incoming / name).read_bytes() for name in FILES}
    require(all(data.strip() for data in assets.values()), 'Пустые ресурсы FAQ')
    text = text[:old.start()] + new.group() + text[old.end():]
    require(text.count('</head>') == 1 and text.count('</body>') == 1, 'Не найдены единственные head/body')
    # Update just the asset URL in place; preserve every other local tag and section.
    for name, attr, tag, end in [('landing-faq.css', 'href', 'link', '</head>'),
                                  ('landing-faq.js', 'src', 'script', '</body>')]:
        pattern = rf'(<{tag}\b[^>]*\b{attr}=["\']){re.escape(name)}(?:\?[^"\']*)?(["\'])'
        text, count = re.subn(pattern, lambda m: m[1] + name + '?v=' + VERSION + m[2], text)
        require(count <= 1, 'Дублируются ресурсы блока FAQ')
        if not count:
            markup = f'  <link rel="stylesheet" href="{name}?v={VERSION}">\n' if tag == 'link' else f'  <script src="{name}?v={VERSION}" defer></script>\n'
            text = text.replace(end, markup + end, 1)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'index.html').write_text(text)
    for name, data in assets.items():
        (output / name).write_bytes(data)


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 4, 'Нужны local, incoming, output')
        stage(*sys.argv[1:])
    except (ValueError, OSError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
