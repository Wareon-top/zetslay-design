#!/usr/bin/env python3
"""Update only Orders and its hooks; retain the installed overview and VPS edits."""
from pathlib import Path
import re
import sys

ORDERS_GUARD = "  if (typeof renderOrderWorkspace === 'function' && renderOrderWorkspace()) { renderDashboard(); return; }\n"
SYNC_HEADER = 'async function syncStoreContent({ silent = false } = {}) {'
READ_HEADER = 'async function readStoreContent({ silent = false } = {}) {'
SYNC_WRAPPER = """// Share one read request between cabinet views within the same account session.
let storeContentSyncFlight = null;
function syncStoreContent(options = {}) {
  const generation = sessionGeneration;
  if (storeContentSyncFlight?.generation === generation) return storeContentSyncFlight.promise;
  const promise = readStoreContent(options);
  const flight = { generation, promise };
  storeContentSyncFlight = flight;
  const release = () => { if (storeContentSyncFlight === flight) storeContentSyncFlight = null; };
  promise.then(release, release);
  return promise;
}"""


def require(condition, message):
    if not condition:
        raise ValueError(message + '. Кабинет не изменён.')


def stage(local: Path, incoming: Path, output: Path):
    source = (local / 'app.js').read_text()
    html = (local / 'index.html').read_text()
    new_html = (incoming / 'index.html').read_text()
    new_source = (incoming / 'app.js').read_text()
    overview = (local / 'overview.js').read_text()
    require('function buildOverview(' in overview and 'const OVERVIEW_STATUSES' in overview, 'Нужна установленная новая Главная')
    for text in [source, html, new_html]:
        require(not re.search(r'^(?:<<<<<<<|=======|>>>>>>>)', text, re.M), 'Найдены маркеры слияния')
    header = 'function renderOrders() {\n'
    require(source.count(header) == 1 and new_source.count(header + ORDERS_GUARD) == 1, 'Не найдена единственная функция заказов')
    start = source.index(header) + len(header)
    if not source[start:].startswith(ORDERS_GUARD):
        require(source[start:].startswith("  const target = byId('orders-table-body');"), 'Неизвестное начало renderOrders')
        source = source[:start] + ORDERS_GUARD + source[start:]
    require(new_source.count(SYNC_WRAPPER + '\n\n' + READ_HEADER) == 1, 'Неизвестная обёртка запроса в GitHub')
    if source.count(SYNC_HEADER) == 1:
        require('storeContentSyncFlight' not in source and READ_HEADER not in source, 'Неизвестная локальная обёртка запроса')
        source = source.replace(SYNC_HEADER, SYNC_WRAPPER + '\n\n' + READ_HEADER, 1)
    else:
        require(source.count(SYNC_WRAPPER + '\n\n' + READ_HEADER) == 1 and source.count(READ_HEADER) == 1, 'Неизвестная версия совместного запроса')

    def region(value):
        starts = list(re.finditer(r'^\s*<section\b[^>\n]*\bdata-view="orders"[^>\n]*>', value, re.M))
        ends = list(re.finditer(r'^\s*<section\b[^>\n]*\bdata-view="messages"[^>\n]*>', value, re.M))
        require(len(starts) == len(ends) == 1 and starts[0].start() < ends[0].start(), 'Не найдены границы раздела Заказы')
        return starts[0].start(), ends[0].start()

    start, end = region(html)
    new_start, new_end = region(new_html)
    require('data-orders-workspace' in new_html[new_start:new_end], 'В GitHub нет новой таблицы заказов')
    html = html[:start] + new_html[new_start:new_end] + html[end:]
    require(len(re.findall(r'<script[^>]+src="orders\.js', html)) <= 1, 'Дублируется orders.js')
    require(len(re.findall(r'<link[^>]+href="orders\.css', html)) <= 1, 'Дублируется orders.css')
    html = re.sub(r'^[ \t]*<script src="orders\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>\n?', '', html, flags=re.M)
    html = re.sub(r'^[ \t]*<link rel="stylesheet" href="orders\.css(?:\?v=[A-Za-z0-9_-]+)?">\n?', '', html, flags=re.M)
    version = '20261003-orders'
    html, scripts = re.subn(r'^([ \t]*)<script src="app\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>',
        lambda m: f'{m[1]}<script src="orders.js?v={version}" defer></script>\n{m[1]}<script src="app.js?v={version}" defer></script>', html, flags=re.M)
    html, styles = re.subn(r'^([ \t]*)(<link rel="stylesheet" href="overview\.css(?:\?v=[A-Za-z0-9_-]+)?">)',
        lambda m: f'{m[1]}{m[2]}\n{m[1]}<link rel="stylesheet" href="orders.css?v={version}">', html, flags=re.M)
    require(scripts == styles == 1, 'Не найдены подключения JS и CSS')
    require(len(re.findall(r'<script[^>]+src="overview\.js', html)) == 1, 'Не найден единственный скрипт Главной')
    require(len(re.findall(r'<script[^>]+src="orders\.js', html)) == 1 and len(re.findall(r'<link[^>]+href="orders\.css', html)) == 1, 'Неизвестная разметка ассетов')
    require(html.index('src="overview.js') < html.index('src="orders.js') < html.index('src="app.js'), 'Неизвестный порядок загрузки скриптов')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'app.js').write_text(source)
    (output / 'index.html').write_text(html)
    (output / 'overview.js').write_bytes((local / 'overview.js').read_bytes())
    for file in ['orders.js', 'orders.css', 'orders.test.mjs']:
        (output / file).write_bytes((incoming / file).read_bytes())


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 4, 'Нужны пути local, incoming и output')
        stage(*(Path(path) for path in sys.argv[1:]))
        print('Подготовлен раздел Заказы. Главная и локальные настройки сохранены.')
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
