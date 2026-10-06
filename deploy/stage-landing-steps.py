#!/usr/bin/env python3
"""Replace only the public #steps section and add its scoped stylesheet."""
from pathlib import Path
import re
import sys

VERSION = '20261006-guided-steps'
FILES = ['landing-steps.css']


def require(ok, message):
    if not ok:
        raise ValueError(message + '. Сайт не изменён.')


def steps_section(text):
    found = list(re.finditer(r'<section\b(?=[^>]*\bid=["\']steps["\'])[^>]*>.*?</section>', text, re.S))
    require(len(found) == 1, 'Не найден единственный блок id=steps')
    require(found[0].group().count('<section') == 1, 'Неизвестная вложенная структура этапов')
    return found[0]


def stage(local, incoming, output):
    local, incoming, output = map(Path, [local, incoming, output])
    text = (local / 'index.html').read_text()
    desired = (incoming / 'index.html').read_text()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M), 'Найдены маркеры конфликта')
    old, new = steps_section(text), steps_section(desired)
    require('data-landing-steps="guided"' in new.group(), 'Нет нового блока этапов')
    require(len(re.findall(r'<li\b[^>]*class="setup-step"', new.group())) == 4, 'Нужны четыре этапа подключения')
    require('href="app/?auth=register"' in new.group(), 'Нет ссылки регистрации')
    assets = {name: (incoming / name).read_bytes() for name in FILES}
    require(all(data.strip() for data in assets.values()), 'Пустые стили этапов')
    text = text[:old.start()] + new.group() + text[old.end():]
    require(text.count('</head>') == 1, 'Не найден единственный head')
    pattern = r'(<link\b[^>]*\bhref=["\'])landing-steps\.css(?:\?[^"\']*)?(["\'])'
    text, count = re.subn(pattern, lambda m: m[1] + 'landing-steps.css?v=' + VERSION + m[2], text)
    require(count <= 1, 'Дублируется загрузка стилей этапов')
    if not count:
        text = text.replace('</head>', f'  <link rel="stylesheet" href="landing-steps.css?v={VERSION}">\n</head>', 1)
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
