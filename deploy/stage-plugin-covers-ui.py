#!/usr/bin/env python3
"""Prepare cover-only changes without replacing local auth, connector or other views."""
from pathlib import Path
import difflib
import re
import sys


def require(condition, message):
    if not condition:
        raise ValueError(message + '. Кабинет не изменён.')


def function(source, name):
    matches = list(re.finditer(r'^(?:async )?function ' + name + r'\([^\n]*\) \{.*?\n\}\n', source, re.M | re.S))
    require(len(matches) == 1, f'Не найдена единственная функция {name}')
    return matches[0]


def patch_functions(source, base, incoming, names):
    for name in names:
        current, old, new = (function(value, name) for value in [source, base, incoming])
        merged = current.group()
        if merged != new.group():
            before, after = old.group().splitlines(keepends=True), new.group().splitlines(keepends=True)
            for group in difflib.SequenceMatcher(None, before, after, autojunk=False).get_grouped_opcodes(3):
                previous = ''.join(before[group[0][1]:group[-1][2]])
                replacement = ''.join(after[group[0][3]:group[-1][4]])
                if merged.count(replacement) == 1:
                    continue
                require(merged.count(previous) == 1, f'Неизвестная локальная правка в {name}')
                merged = merged.replace(previous, replacement, 1)
        source = source[:current.start()] + merged + source[current.end():]
    return source


def stage(local, incoming, output):
    require((local / 'plugin-page.js').is_file(), 'Сначала установите страницы плагинов через deploy/update-plugin-ui.sh')
    app, page, html = [(local / file).read_text() for file in ['app.js', 'plugin-page.js', 'index.html']]
    base_app, base_page = [(incoming / file).read_text() for file in ['base-app.js', 'base-plugin-page.js']]
    new_app, new_page = [(incoming / file).read_text() for file in ['app.js', 'plugin-page.js']]
    for value in [app, page, html, base_app, base_page, new_app, new_page]:
        require(not re.search(r'^(?:<<<<<<<|=======|>>>>>>>)', value, re.M), 'Найдены маркеры слияния')
    app = patch_functions(app, base_app, new_app, ['renderPlugins', 'compressPluginCover'])
    page = patch_functions(page, base_page, new_page, ['pluginCoverSource', 'renderPluginAdminControls', 'pluginPageMarkup'])
    for asset, tag, attr in [('plugin-cover.js', 'script', 'src'), ('plugin-cover.css', 'link', 'href')]:
        require(len(re.findall(fr'<{tag}[^>]+{attr}="{re.escape(asset)}', html)) <= 1, f'Дублируется {asset}')
    html = re.sub(r'^[ \t]*<script src="plugin-cover\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>\n?', '', html, flags=re.M)
    html = re.sub(r'^[ \t]*<link rel="stylesheet" href="plugin-cover\.css(?:\?v=[A-Za-z0-9_-]+)?">\n?', '', html, flags=re.M)
    version = '20261003-cover-quality'
    html, scripts = re.subn(r'^([ \t]*)<script src="plugin-page\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>', lambda m: f'{m[1]}<script src="plugin-cover.js?v={version}" defer></script>\n{m[1]}<script src="plugin-page.js?v={version}" defer></script>', html, flags=re.M)
    html, main = re.subn(r'^([ \t]*)<script src="app\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>', lambda m: f'{m[1]}<script src="app.js?v={version}" defer></script>', html, flags=re.M)
    html, styles = re.subn(r'^([ \t]*)</head>', lambda m: f'{m[1]}  <link rel="stylesheet" href="plugin-cover.css?v={version}">\n{m[0]}', html, flags=re.M)
    require(scripts == main == styles == 1, 'Не найдены подключения ассетов')
    require(html.index('src="plugin-cover.js') < html.index('src="plugin-page.js') < html.index('src="app.js'), 'Неизвестный порядок загрузки скриптов')
    require('href="plugin-page.css' in html and html.index('href="plugin-page.css') < html.index('href="plugin-cover.css'), 'Неизвестный порядок стилей')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'app.js').write_text(app)
    (output / 'plugin-page.js').write_text(page)
    (output / 'index.html').write_text(html)
    for file in ['plugin-cover.js', 'plugin-cover.css', 'plugin-cover.test.mjs', 'plugin-page.test.mjs']:
        (output / file).write_bytes((incoming / file).read_bytes())
    (output / 'catalog-regression.test.mjs').write_bytes((incoming / 'app.test.mjs').read_bytes())
    for module in ['overview', 'orders', 'messages']:
        for suffix in ['.js', '.css', '.test.mjs']:
            file = module + suffix
            if (local / file).is_file():
                (output / file).write_bytes((local / file).read_bytes())


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 4, 'Нужны пути local, incoming и output')
        stage(*(Path(value) for value in sys.argv[1:]))
        print('Подготовлены обложки; локальные настройки и остальные разделы сохранены.')
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
