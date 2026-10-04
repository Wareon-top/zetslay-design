#!/usr/bin/env python3
"""Stage only the features section and its stylesheet/platform marks."""
from pathlib import Path
import re
import sys
from xml.etree import ElementTree

FILES = ['landing-features.css'] + [f'assets/platforms/{name}.svg' for name in ['funpay', 'ggsel', 'plati-market', 'starvell']]
VERSION = '20261004-feature-cards'

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
    require('data-landing-features="bento"' in new.group(), 'В обновлении нет нового блока возможностей')
    require(len(re.findall(r'<article\b[^>]*\bdata-feature-card=', new.group())) == 5, 'В обновлении должны быть пять карточек')
    # Validate all inputs before creating a candidate, leaving the served site intact.
    assets = {name: (incoming / name).read_bytes() for name in FILES}
    for name, data in assets.items():
        if name.endswith('.svg'):
            require(ElementTree.fromstring(data).tag.endswith('svg'), 'Неверный SVG платформы')
    text = text[:old.start()] + new.group() + text[old.end():]
    text, count = re.subn(r'[ \t]*<link\b[^>]*href=["\']landing-features\.css(?:\?[^"\']*)?["\'][^>]*>\n?', '', text)
    require(count <= 1, 'Дублируется загрузка блока возможностей')
    require(text.count('</head>') == 1, 'Не найден единственный конец head')
    text = text.replace('</head>', f'  <link rel="stylesheet" href="landing-features.css?v={VERSION}">\n</head>', 1)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'index.html').write_text(text)
    for name, data in assets.items():
        path = output / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

if __name__ == '__main__':
    try:
        require(len(sys.argv) == 4, 'Нужны local, incoming, output')
        stage(*sys.argv[1:])
    except (ValueError, OSError, ElementTree.ParseError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
