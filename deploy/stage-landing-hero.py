#!/usr/bin/env python3
"""Replace only the landing hero/ribbon and their own asset tags."""
from pathlib import Path
import re
import sys
from xml.etree import ElementTree

FILES = ['landing-hero.css', 'landing-hero.js'] + [f'assets/platforms/{name}.svg' for name in ['funpay', 'ggsel', 'plati-market', 'starvell']]
VERSION = '20261003-platform-ribbon'

def require(condition, message):
    if not condition:
        raise ValueError(message + '. Сайт не изменён.')

def hero_parts(text):
    heroes = list(re.finditer(r'<section\b(?=[^>]*\bid=["\']landing["\'])[^>]*>.*?</section>', text, re.S))
    require(len(heroes) == 1, 'Не найден единственный главный баннер id=landing')
    hero = heroes[0]
    require(re.search(r'\bclass=["\'][^"\']*\bhero\b', hero.group()), 'Неизвестная структура главного баннера')
    require(hero.group().count('<section') == 1, 'Внутри баннера обнаружена другая секция')
    ribbons = list(re.finditer(r'<section\b(?=[^>]*\bdata-platform-ribbon(?:\s|>))[^>]*>.*?</section>', text, re.S))
    require(len(ribbons) <= 1, 'Найдены несколько строк платформ')
    if ribbons:
        require(not text[hero.end():ribbons[0].start()].strip(), 'Строка платформ находится вне главного блока')
    return hero, ribbons[0] if ribbons else None

def stage(local, incoming, output):
    local, incoming, output = map(Path, [local, incoming, output])
    text = (local / 'index.html').read_text()
    desired = (incoming / 'index.html').read_text()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M), 'Найдены маркеры конфликта')
    old_hero, old_ribbon = hero_parts(text)
    new_hero, new_ribbon = hero_parts(desired)
    require(new_ribbon is not None, 'В обновлении нет строки платформ')
    # Read and validate every asset before creating the candidate directory.
    assets = {name: (incoming / name).read_bytes() for name in FILES}
    for name, data in assets.items():
        if name.endswith('.svg'):
            require(ElementTree.fromstring(data).tag.endswith('svg'), 'Неверный SVG платформы')
    text = text[:old_hero.start()] + desired[new_hero.start():new_ribbon.end()] + text[(old_ribbon or old_hero).end():]
    for pattern in [r'[ \t]*<link\b[^>]*href=["\']landing-hero\.css(?:\?[^"\']*)?["\'][^>]*>\n?', r'[ \t]*<script\b[^>]*src=["\']landing-hero\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>\n?']:
        text, count = re.subn(pattern, '', text)
        require(count <= 1, 'Дублируется загрузка главного блока')
    styles = list(re.finditer(r'<link\b[^>]*href=["\']landing\.css(?:\?[^"\']*)?["\'][^>]*>', text))
    require(len(styles) == 1, 'Не найдена единственная исходная landing.css')
    point = styles[0].end()
    text = text[:point] + f'\n  <link rel="stylesheet" href="landing-hero.css?v={VERSION}">' + text[point:]
    require(text.count('</body>') == 1, 'Не найден конец страницы')
    text = text.replace('</body>', f'  <script src="landing-hero.js?v={VERSION}" defer></script>\n</body>', 1)
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
