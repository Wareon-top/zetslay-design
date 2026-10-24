#!/usr/bin/env python3
"""Stage the header and first screen, preserving the live brand and other sections."""
from pathlib import Path
import re
import sys
from xml.etree import ElementTree

FILES = ['landing-hero.css', 'landing-hero.js', 'landing-orderflow.css', 'assets/zetslay-orderflow.webp'] + [f'assets/platforms/{name}.svg' for name in ['funpay', 'ggsel', 'plati-market', 'starvell']]
VERSION = '20261024-ascii'

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
        if name.endswith('.webp'):
            require(data[:4] == b'RIFF' and data[8:12] == b'WEBP', 'Неверный файл иллюстрации')
    # Replace only the public menu; preserve the exact live brand/logo anchor.
    header_pattern = r'<header\b(?=[^>]*\bclass=["\'][^"\']*\bsite-header\b)[^>]*>.*?</header>'
    old_headers = list(re.finditer(header_pattern, text, re.S))
    new_headers = list(re.finditer(header_pattern, desired, re.S))
    require(len(old_headers) == len(new_headers) == 1, 'Не найдена единственная шапка главной')
    brand_pattern = r'<a\b(?=[^>]*\bclass=["\'][^"\']*\bbrand\b)[^>]*>.*?</a>'
    brand = re.search(brand_pattern, old_headers[0].group(), re.S)
    require(brand is not None, 'Не найден текущий логотип')
    header, brand_count = re.subn(brand_pattern, lambda _: brand.group(), new_headers[0].group(), count=1, flags=re.S)
    require(brand_count == 1, 'Не найден логотип в новой шапке')
    # Resolve section offsets again after replacing a header of different length.
    text = text[:old_headers[0].start()] + header + text[old_headers[0].end():]
    old_hero, old_ribbon = hero_parts(text)
    text = text[:old_hero.start()] + desired[new_hero.start():new_ribbon.end()] + text[(old_ribbon or old_hero).end():]
    for pattern in [r'[ \t]*<link\b[^>]*href=["\']landing-hero\.css(?:\?[^"\']*)?["\'][^>]*>\n?', r'[ \t]*<script\b[^>]*src=["\']landing-hero\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>\n?']:
        text, count = re.subn(pattern, '', text)
        require(count <= 1, 'Дублируется загрузка главного блока')
    styles = list(re.finditer(r'<link\b[^>]*href=["\']landing\.css(?:\?[^"\']*)?["\'][^>]*>', text))
    require(len(styles) == 1, 'Не найдена единственная исходная landing.css')
    point = styles[0].end()
    text = text[:point] + f'\n  <link rel="stylesheet" href="landing-hero.css?v={VERSION}">' + text[point:]
    text, css_count = re.subn(r'[ \t]*<link\b[^>]*href=["\']landing-orderflow\.css(?:\?[^"\']*)?["\'][^>]*>\n?', '', text)
    require(css_count <= 1, 'Дублируется оформление первого экрана')
    text, preload_count = re.subn(r'[ \t]*<link\b[^>]*href=["\']assets/zetslay-orderflow\.webp(?:\?[^"\']*)?["\'][^>]*>\n?', '', text)
    require(preload_count <= 1, 'Дублируется предзагрузка иллюстрации')
    require(text.count('</head>') == 1, 'Не найден конец заголовка страницы')
    text = text.replace('</head>', f'  <link rel="preload" as="image" href="assets/zetslay-orderflow.webp?v={VERSION}">\n  <link rel="stylesheet" href="landing-orderflow.css?v={VERSION}">\n</head>', 1)
    def theme(match):
        tag = re.sub(r'\sdata-landing-theme=["\'][^"\']*["\']', '', match.group())
        return tag[:-1] + ' data-landing-theme="orderflow">'
    text, body_count = re.subn(r'<body\b[^>]*>', theme, text)
    require(body_count == 1, 'Не найден единственный body')
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
