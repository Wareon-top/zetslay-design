"""Patch only cover handling and catalog filters; preserve local cabinet changes."""
from pathlib import Path
import difflib
import re
import sys

def require(ok, message):
    if not ok:
        raise ValueError(message + '. Кабинет не изменён.')

def function(source, name):
    matches = list(re.finditer(r'^(?:async )?function ' + name + r'\([^\n]*\) \{.*?\n\}\n', source, re.M | re.S))
    require(len(matches) == 1, 'Не найдена единственная функция ' + name)
    return matches[0]

def patch_functions(source, base, incoming, names):
    for name in names:
        current, old, new = (function(value, name) for value in [source, base, incoming])
        merged = current.group()
        if merged != new.group():
            before, after = old.group().splitlines(keepends=True), new.group().splitlines(keepends=True)
            for group in difflib.SequenceMatcher(None, before, after, autojunk=False).get_grouped_opcodes(2):
                previous = ''.join(before[group[0][1]:group[-1][2]])
                replacement = ''.join(after[group[0][3]:group[-1][4]])
                if merged.count(replacement) == 1:
                    continue
                require(merged.count(previous) == 1, 'Неизвестная локальная правка в ' + name)
                merged = merged.replace(previous, replacement, 1)
        source = source[:current.start()] + merged + source[current.end():]
    return source

def stage(local, incoming, output):
    app, page, html = [(local / file).read_text() for file in ['app.js', 'plugin-page.js', 'index.html']]
    for source in [app, page, html]:
        require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)', source, re.M), 'Маркеры конфликта')
    app = patch_functions(app, (incoming / 'base-app.js').read_text(), (incoming / 'app.js').read_text(), ['renderPluginAdminAccess', 'renderPlugins', 'bindInteractions'])
    page = patch_functions(page, (incoming / 'base-plugin-page.js').read_text(), (incoming / 'plugin-page.js').read_text(), ['renderPluginAdminControls'])
    # Older templates may still expose the retired modules. Restrict their cards and routes.
    blocked = "!['zetslay.auto-reply', 'zetslay.telegram-notifications'].includes(plugin.id)"
    if blocked not in function(app, 'renderPlugins').group():
        pattern = r'(const visible = state\.plugins\.filter\(plugin => )'
        app, count = re.subn(pattern, lambda m: m[1] + blocked + ' && ', app)
        require(count == 1, 'Неизвестная фильтрация каталога')
    guard = "!['zetslay.auto-reply', 'zetslay.telegram-notifications'].includes(item.id)"
    if guard not in function(page, 'renderPluginPage').group():
        page, count = re.subn(r'(const plugin = state\.plugins\.find\(item => item\.id === route\.id && )', lambda m: m[1] + guard + ' && ', page)
        require(count == 1, 'Неизвестный маршрут плагина')
    app = patch_functions(app, (incoming / 'base-app.js').read_text(), (incoming / 'app.js').read_text(), ['compressPluginCover'])
    require('preparePluginCover(file)' in function(app, 'compressPluginCover').group(), 'Сначала установите обработку качественных обложек')
    require('uploadPluginCover(event.target)' in app, 'Не найден новый обработчик обложки')
    for asset in ['app.js', 'plugin-page.js', 'plugin-cover.js', 'plugin-cover.css']:
        html, count = re.subn(r'((?:src|href)="' + re.escape(asset) + r')(?:\?v=[A-Za-z0-9_-]+)?(")', r'\1?v=20261005-cover-upload\2', html)
        require(count == 1, 'Не найден ассет ' + asset)
    require(html.index('src="plugin-cover.js') < html.index('src="app.js'), 'Порядок загрузки скриптов')
    output.mkdir(parents=True, exist_ok=True)
    for file in local.iterdir():
        if file.is_file() and file.suffix in ['.js', '.css', '.mjs', '.html']:
            (output / file.name).write_bytes(file.read_bytes())
    for name, value in [('app.js', app), ('plugin-page.js', page), ('index.html', html)]:
        (output / name).write_text(value)
    for name in ['plugin-cover.js', 'plugin-cover.css', 'plugin-cover.test.mjs']:
        (output / name).write_bytes((incoming / name).read_bytes())

if __name__ == '__main__':
    try:
        require(len(sys.argv) == 4, 'Нужны пути local, incoming и output')
        stage(*(Path(value) for value in sys.argv[1:]))
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
