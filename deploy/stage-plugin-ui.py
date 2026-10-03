#!/usr/bin/env python3
"""Apply only catalog/page edits while keeping unrelated VPS customizations."""
from pathlib import Path
import difflib
import re
import sys

FUNCTIONS = ['resetPluginCatalog', 'loadPluginCatalog', 'renderPlugins', 'changePluginState', 'setView', 'openPluginDetails', 'openPluginEditor', 'saveCatalogEntry', 'savePluginEditor', 'bindInteractions']


def require(condition, message):
    if not condition:
        raise ValueError(message + '. Кабинет не изменён.')


def function(source, name):
    matches = list(re.finditer(r'^(?:async )?function ' + name + r'\([^\n]*\) \{.*?\n\}\n', source, re.M | re.S))
    require(len(matches) == 1, f'Не найдена единственная функция {name}')
    return matches[0]


def merge_fragments(local, base, incoming, label):
    if local == incoming or base == incoming:
        return local
    before, after = base.splitlines(keepends=True), incoming.splitlines(keepends=True)
    for group in difflib.SequenceMatcher(None, before, after, autojunk=False).get_grouped_opcodes(3):
        old = ''.join(before[group[0][1]:group[-1][2]])
        new = ''.join(after[group[0][3]:group[-1][4]])
        if local.count(new) == 1:
            continue
        require(local.count(old) == 1, f'Неизвестная локальная правка в {label}')
        local = local.replace(old, new, 1)
    return local


def catalog_region(html):
    starts = list(re.finditer(r'^\s*<section\b[^>\n]*\bdata-view="plugins"[^>\n]*>', html, re.M))
    ends = list(re.finditer(r'^\s*<section\b[^>\n]*\bdata-view="telegram"[^>\n]*>', html, re.M))
    require(len(starts) == len(ends) == 1 and starts[0].start() < ends[0].start(), 'Не найдены границы каталога')
    return starts[0].start(), ends[0].start()


def stage(local, incoming, output):
    source = (local / 'app.js').read_text()
    html = (local / 'index.html').read_text()
    base = (incoming / 'base-app.js').read_text()
    new_source = (incoming / 'app.js').read_text()
    new_html = (incoming / 'index.html').read_text()
    for content in [source, html, base, new_source, new_html]:
        require(not re.search(r'^(?:<<<<<<<|=======|>>>>>>>)', content, re.M), 'Найдены маркеры слияния')
    for name in FUNCTIONS:
        current, old, new = function(source, name), function(base, name), function(new_source, name)
        merged = merge_fragments(current.group(), old.group(), new.group(), name)
        source = source[:current.start()] + merged + source[current.end():]
    helper = function(new_source, 'canManagePluginCatalog').group()
    if 'function canManagePluginCatalog(' in source:
        require(function(source, 'canManagePluginCatalog').group() == helper, 'Неизвестная локальная проверка прав')
    else:
        position = function(source, 'resetPluginCatalog').start()
        source = source[:position] + helper + '\n' + source[position:]
    old_title = "  plugins: 'Плагины', telegram:"
    new_title = "  plugins: 'Плагины', plugin: 'Плагин', telegram:"
    if old_title in source:
        require(source.count(old_title) == 1, 'Неизвестные названия разделов')
        source = source.replace(old_title, new_title, 1)
    else:
        require(source.count(new_title) == 1, 'Не найдена метка страницы плагина')

    start, end = catalog_region(html)
    new_start, new_end = catalog_region(new_html)
    require('data-plugin-page' in new_html[new_start:new_end] and 'data-plugin-admin-controls' in new_html[new_start:new_end], 'В GitHub нет новой страницы')
    html = html[:start] + new_html[new_start:new_end] + html[end:]
    html = re.sub(r'^[ \t]*<script src="plugin-page\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>\n?', '', html, flags=re.M)
    html = re.sub(r'^[ \t]*<link rel="stylesheet" href="plugin-page\.css(?:\?v=[A-Za-z0-9_-]+)?">\n?', '', html, flags=re.M)
    version = '20261003-plugin-page'
    html, scripts = re.subn(r'^([ \t]*)<script src="app\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>', lambda m: f'{m[1]}<script src="plugin-page.js?v={version}" defer></script>\n{m[1]}<script src="app.js?v={version}" defer></script>', html, flags=re.M)
    html, styles = re.subn(r'^([ \t]*)</head>', lambda m: f'{m[1]}  <link rel="stylesheet" href="plugin-page.css?v={version}">\n{m[0]}', html, flags=re.M)
    require(scripts == styles == 1, 'Не найдены подключения ассетов')
    require(len(re.findall(r'<script[^>]+src="plugin-page\.js', html)) == len(re.findall(r'<link[^>]+href="plugin-page\.css', html)) == 1, 'Дублируются ассеты страницы')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'app.js').write_text(source)
    (output / 'index.html').write_text(html)
    for file in ['plugin-page.js', 'plugin-page.css', 'plugin-page.test.mjs']:
        (output / file).write_bytes((incoming / file).read_bytes())
    (output / 'catalog-regression.test.mjs').write_bytes((incoming / 'app.test.mjs').read_bytes())
    if (local / 'app.test.mjs').exists():
        tests = (local / 'app.test.mjs').read_text()
        old = "app.run('state.pluginCanManage = true; renderPlugins()');"
        new = 'app.run("authState.token=\'admin-session\'; authState.user={}; state.pluginCanManage = true; renderPlugins()");'
        tests = tests.replace(old, new)
        (output / 'app.test.mjs').write_text(tests)
    for category in ['chat', 'sales', 'analytics', 'control']:
        file = f'assets/plugin-covers/{category}.svg'
        (output / file).parent.mkdir(parents=True, exist_ok=True)
        (output / file).write_bytes((incoming / file).read_bytes())


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 4, 'Нужны пути local, incoming и output')
        stage(*(Path(value) for value in sys.argv[1:]))
        print('Подготовлена страница плагина; остальные разделы и адрес API сохранены.')
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
