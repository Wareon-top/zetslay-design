#!/usr/bin/env python3
"""Stage only #tariffs and its two self-contained pricing assets."""
from pathlib import Path
import re
import sys

FILES = ['landing-pricing.css', 'landing-pricing.js']
VERSION = '20261006-pricing-plans'


def require(condition, message):
    if not condition:
        raise ValueError(message + '. Сайт не изменён.')


def pricing_section(text):
    sections = list(re.finditer(r'<section\b(?=[^>]*\bid=["\']tariffs["\'])[^>]*>.*?</section>', text, re.S))
    require(len(sections) == 1, 'Не найден единственный блок id=tariffs')
    section = sections[0]
    require(section.group().count('<section') == 1, 'Неизвестная вложенная структура блока возможностей')
    return section


def stage(local, incoming, output):
    local, incoming, output = map(Path, [local, incoming, output])
    text = (local / 'index.html').read_text()
    desired = (incoming / 'index.html').read_text()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M), 'Найдены маркеры конфликта')
    old, new = pricing_section(text), pricing_section(desired)
    require('data-landing-pricing="plans-v1"' in new.group(), 'В обновлении нет блока тарифов')
    cards = re.findall(r'<article\b[^>]*\bdata-pricing-plan=["\']([^"\']+)["\'][^>]*>', new.group())
    require(len(cards) == len(set(cards)) == 4, 'В обновлении должны быть четыре различных тарифа')
    require(re.findall(r'data-monthly-rub="(\d+)"', new.group()) == ['149', '299', '499', '799'], 'Неверные базовые цены тарифов')
    require(new.group().count('href="app/?auth=register"') == 4, 'Кнопки должны открывать регистрацию')
    assets = {name: (incoming / name).read_bytes() for name in FILES}
    require(all(data.strip() for data in assets.values()), 'Пустые ресурсы тарифов')
    text = text[:old.start()] + new.group() + text[old.end():]
    require(text.count('</head>') == 1 and text.count('</body>') == 1, 'Не найдены единственные head/body')
    # Update just the asset URL in place; preserve every other local tag and section.
    for name, attr, tag, end in [('landing-pricing.css', 'href', 'link', '</head>'),
                                  ('landing-pricing.js', 'src', 'script', '</body>')]:
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
