#!/usr/bin/env python3
"""Stage the dashboard region and one render hook; preserve unrelated VPS edits."""
from pathlib import Path
import re
import sys


def require(condition, message):
    if not condition:
        raise ValueError(message + '. Файлы кабинета не изменены.')


def stage(local: Path, incoming: Path, output: Path):
    source = (local / 'app.js').read_text()
    html = (local / 'index.html').read_text()
    new_html = (incoming / 'index.html').read_text()
    for value in [source, html, new_html]:
        require(not re.search(r'^(?:<<<<<<<|=======|>>>>>>>)', value, re.M), 'Найдены маркеры конфликта')
    function_pattern = r'^function renderDashboard\(\) \{.*?^\}'
    functions = list(re.finditer(function_pattern, source, re.M | re.S))
    require(len(functions) == 1, 'Не найдена единственная функция renderDashboard')
    old_hook = '  renderDashChart();\n  renderDashDonut();\n}'
    new_hook = "  if (typeof renderOverview === 'function') renderOverview();\n  else { renderDashChart(); renderDashDonut(); }\n}"
    function = functions[0]
    require(function.group().endswith(old_hook) or function.group().endswith(new_hook), 'Неизвестное окончание renderDashboard')
    if function.group().endswith(old_hook):
        position = function.end() - len(old_hook)
        source = source[:position] + new_hook + source[function.end():]

    def dashboard_region(value):
        starts = list(re.finditer(r'^\s*<section\b[^>\n]*\bdata-view="dashboard"[^>\n]*>', value, re.M))
        ends = list(re.finditer(r'^\s*<section\b[^>\n]*\bdata-view="orders"[^>\n]*>', value, re.M))
        require(len(starts) == len(ends) == 1 and starts[0].start() < ends[0].start(), 'Не найдены границы Главной')
        return starts[0].start(), ends[0].start()

    start, end = dashboard_region(html)
    new_start, new_end = dashboard_region(new_html)
    require('data-overview' in new_html[new_start:new_end], 'В GitHub нет новой Главной')
    html = html[:start] + new_html[new_start:new_end] + html[end:]
    version = '20261003-overview'
    main_script = list(re.finditer(r'^([ \t]*)<script src="app\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>', html, re.M))
    main_style = list(re.finditer(r'^([ \t]*)<link rel="stylesheet" href="styles\.css(?:\?v=[A-Za-z0-9_-]+)?">', html, re.M))
    require(len(main_script) == len(main_style) == 1, 'Не найдены подключения основных JS и CSS')
    require(len(re.findall(r'<script[^>]+src="overview\.js', html)) <= 1, 'Дублируется overview.js')
    require(len(re.findall(r'<link[^>]+href="overview\.css', html)) <= 1, 'Дублируется overview.css')
    # Keep all existing styles and the deployed API domain; add a scoped stylesheet.
    html = re.sub(r'^[ \t]*<script src="overview\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>\n?', '', html, flags=re.M)
    html = re.sub(r'^[ \t]*<link rel="stylesheet" href="overview\.css(?:\?v=[A-Za-z0-9_-]+)?">\n?', '', html, flags=re.M)
    html, scripts = re.subn(r'^([ \t]*)<script src="app\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>',
        lambda m: f'{m[1]}<script src="overview.js?v={version}" defer></script>\n{m[1]}<script src="app.js?v={version}" defer></script>', html, flags=re.M)
    html, styles = re.subn(r'^([ \t]*)(<link rel="stylesheet" href="styles\.css(?:\?v=[A-Za-z0-9_-]+)?">)',
        lambda m: f'{m[1]}{m[2]}\n{m[1]}<link rel="stylesheet" href="overview.css?v={version}">', html, flags=re.M)
    require(scripts == styles == 1, 'Не удалось добавить ассеты')
    require(len(re.findall(r'<script[^>]+src="overview\.js', html)) == 1 and len(re.findall(r'<link[^>]+href="overview\.css', html)) == 1, 'Неизвестная разметка ассетов')
    require(html.index('src="overview.js') < html.index('src="app.js'), 'Неверный порядок загрузки JS')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'app.js').write_text(source)
    (output / 'index.html').write_text(html)
    for file in ['overview.js', 'overview.css', 'overview.test.mjs']:
        (output / file).write_bytes((incoming / file).read_bytes())


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 4, 'Нужны пути local, incoming и output')
        stage(*(Path(path) for path in sys.argv[1:]))
        print('Подготовлена Главная; адрес API и остальные разделы сохранены.')
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
