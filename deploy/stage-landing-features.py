#!/usr/bin/env python3
"""Stage only #features and its two self-contained reference Bento assets."""
from pathlib import Path
import re
import sys

FILES = ['landing-features.css', 'landing-features.js']
VERSION = '20261006-reference-bento'


def require(condition, message):
    if not condition:
        raise ValueError(message + '. Сайт не изменён.')


def features_section(text):
    sections = list(re.finditer(r'<section\b(?=[^>]*\bid=["\']features["\'])[^>]*>.*?</section>', text, re.S))
    require(len(sections) == 1, 'Не найден единственный блок id=features')
    section = sections[0]
    require(section.group().count('<section') == 1, 'Неизвестная вложенная структура блока возможностей')
    return section


def stage(local, incoming, output):
    local, incoming, output = map(Path, [local, incoming, output])
    text = (local / 'index.html').read_text()
    desired = (incoming / 'index.html').read_text()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M), 'Найдены маркеры конфликта')
    old, new = features_section(text), features_section(desired)
    require('data-landing-features="reference-bento"' in new.group(), 'В обновлении нет блока Bento по образцу')
    cards = re.findall(r'<article\b[^>]*\bdata-feature-card=["\']([^"\']+)["\'][^>]*>', new.group())
    require(len(cards) == len(set(cards)) == 9, 'В обновлении должны быть девять различных карточек')
    require(new.group().count('bento-card--wide') == 3, 'В обновлении должны быть три широкие карточки')
    require('<img ' not in new.group(), 'Bento не должен содержать старые иллюстрации')
    assets = {name: (incoming / name).read_bytes() for name in FILES}
    require(all(data.strip() for data in assets.values()), 'Пустые ресурсы Bento')
    text = text[:old.start()] + new.group() + text[old.end():]
    require(text.count('</head>') == 1 and text.count('</body>') == 1, 'Не найдены единственные head/body')
    # Update just the asset URL in place; preserve every other local tag and section.
    for name, attr, tag, end in [('landing-features.css', 'href', 'link', '</head>'),
                                  ('landing-features.js', 'src', 'script', '</body>')]:
        pattern = rf'(<{tag}\b[^>]*\b{attr}=["\']){re.escape(name)}(?:\?[^"\']*)?(["\'])'
        text, count = re.subn(pattern, lambda m: m[1] + name + '?v=' + VERSION + m[2], text)
        require(count <= 1, 'Дублируются ресурсы блока возможностей')
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
