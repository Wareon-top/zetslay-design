#!/usr/bin/env python3
"""Change only catalog authorization; preserve the existing cabinet and API URL."""
from pathlib import Path
import re
import sys

HELPERS = ['isPluginCatalogOwner', 'canManagePluginCatalog', 'renderPluginAdminAccess']


def require(condition, message):
    if not condition:
        raise ValueError(message + '. Кабинет не изменён.')


def function(source, name):
    matches = list(re.finditer(r'^(?:async )?function ' + re.escape(name) + r'\([^\n]*\) \{.*?\n\}\n', source, re.M | re.S))
    require(len(matches) == 1, f'Не найдена единственная функция {name}')
    return matches[0]


def stage(local, incoming, output):
    source = (local / 'app.js').read_text()
    html = (local / 'index.html').read_text()
    new_source = (incoming / 'app.js').read_text()
    for content in [source, html, new_source]:
        require(not re.search(r'^(?:<<<<<<<|=======|>>>>>>>)', content, re.M), 'Найдены маркеры слияния')
    require("telegramUserId === '5062414502'" in function(new_source, HELPERS[0]).group(), 'Не найдено ограничение владельца')
    # Explicitly replace the authorization policy, never the connector/auth flows.
    for name in HELPERS:
        new = function(new_source, name).group()
        if re.search(r'^function ' + name + r'\(', source, re.M):
            current = function(source, name)
            source = source[:current.start()] + new + source[current.end():]
        else:
            position = function(source, 'resetPluginCatalog').start()
            source = source[:position] + new + '\n' + source[position:]
    match = function(source, 'loadPluginCatalog')
    fragment = match.group()
    old = '  state.pluginCanManage = catalog.canManage === true;'
    new = '  state.pluginCanManage = catalog.canManage === true && isPluginCatalogOwner();'
    if old in fragment:
        require(fragment.count(old) == 1, 'Неизвестное назначение прав каталога')
        fragment = fragment.replace(old, new, 1)
    else:
        require(fragment.count(new) == 1, 'Неизвестная проверка прав ответа API')
    source = source[:match.start()] + fragment + source[match.end():]
    match = function(source, 'renderPlugins')
    fragment = match.group()
    if '  renderPluginAdminAccess();' not in fragment:
        fragment = fragment.replace('function renderPlugins() {\n', 'function renderPlugins() {\n  renderPluginAdminAccess();\n', 1)
    require(fragment.count('  renderPluginAdminAccess();') == 1, 'Неизвестное отображение прав каталога')
    source = source[:match.start()] + fragment + source[match.end():]
    html = re.sub(r'^[ \t]*<link rel="stylesheet" href="admin-access\.css(?:\?v=[A-Za-z0-9_-]+)?">\n?', '', html, flags=re.M)
    html, styles = re.subn(r'^([ \t]*)</head>', lambda m: f'{m[1]}  <link rel="stylesheet" href="admin-access.css?v=20261004-owner-admin">\n{m[0]}', html, flags=re.M)
    html, scripts = re.subn(r'(<script src="app\.js)(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)', r'\1?v=20261004-owner-admin\2', html)
    require(styles == scripts == 1, 'Не найдены подключения ассетов')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'app.js').write_text(source)
    (output / 'index.html').write_text(html)
    for name in ['admin-access.css', 'admin-access.test.mjs']:
        (output / name).write_bytes((incoming / name).read_bytes())


if __name__ == '__main__':
    try:
        stage(*(Path(value) for value in sys.argv[1:4]))
    except ValueError as error:
        raise SystemExit(str(error))
