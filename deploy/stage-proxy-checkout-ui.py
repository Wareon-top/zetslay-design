"""Repair the current proxy modal while retaining unrelated runtime and HTML."""
from pathlib import Path
import json
import re
import sys

VERSION = '20261025-proxy-checkout'
FILES = ('managed-proxy-ui.js', 'proxy-shop.js')


def stage(local, incoming, out):
    local, incoming, out = map(Path, (local, incoming, out))
    files = {name: (local / name).read_text() for name in FILES}
    for patch in json.loads((incoming / 'proxy-checkout-ui-patches.json').read_text()):
        name, before, after = patch['file'], patch['before'], patch['after']
        if name not in files:
            raise ValueError('Неизвестный модуль. Файлы не изменены.')
        if files[name].count(before) == 1:
            files[name] = files[name].replace(before, after, 1)
        elif files[name].count(after) != 1:
            raise ValueError('Модуль отличается в блоке ' + patch['name'] + '. Файлы не изменены.')
    html = (local / 'index.html').read_text()
    positions = []
    for name in FILES:
        pattern = r'(<script\b[^>]*src=["\'])' + re.escape(name) + r'(?:\?[^"\']*)?(["\'])'
        matches = list(re.finditer(pattern, html))
        if len(matches) != 1:
            raise ValueError('Не подтверждено подключение модуля. Файлы не изменены.')
        positions.append(matches[0].start())
        html = re.sub(pattern, lambda m: m[1] + name + '?v=' + VERSION + m[2], html)
    if positions[0] >= positions[1]:
        raise ValueError('Не подтверждён порядок модулей. Файлы не изменены.')
    files['index.html'] = html
    out.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        (out / name).write_text(content)


if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (OSError, ValueError) as error:
        raise SystemExit(str(error))
