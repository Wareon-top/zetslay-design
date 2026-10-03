#!/usr/bin/env python3
"""Stage only the Messages view and two render hooks; preserve VPS customizations."""
from pathlib import Path
import re
import sys

GUARD = "  if (typeof renderMessagesWorkspace === 'function' && renderMessagesWorkspace()) return;\n"
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


def region(html):
    starts = list(re.finditer(r'^\s*<section\b[^>\n]*\bdata-view="messages"[^>\n]*>', html, re.M))
    ends = list(re.finditer(r'^\s*<section\b[^>\n]*\bdata-view="lots"[^>\n]*>', html, re.M))
    require(len(starts) == len(ends) == 1 and starts[0].start() < ends[0].start(), 'Не найдены границы раздела Сообщения')
    return starts[0].start(), ends[0].start()


def stage(local: Path, incoming: Path, output: Path):
    source = (local / 'app.js').read_text()
    html = (local / 'index.html').read_text()
    new_source = (incoming / 'app.js').read_text()
    new_html = (incoming / 'index.html').read_text()
    for value in [source, html, new_source, new_html, (incoming / 'messages.js').read_text()]:
        require(not re.search(r'^(?:<<<<<<<|=======|>>>>>>>)', value, re.M), 'Найдены маркеры слияния')
    for name, legacy in [('renderConversations', "  const target = byId('conversation-items');"), ('renderActiveConversation', '  const chat = state.conversations.find')]:
        header = f'function {name}() {{\n'
        require(source.count(header) == 1 and new_source.count(header + GUARD) == 1, f'Не найдена единственная {name}')
        start = source.index(header) + len(header)
        if not source[start:].startswith(GUARD):
            require(source[start:].startswith(legacy), f'Неизвестное начало {name}')
            source = source[:start] + GUARD + source[start:]
    require(new_source.count(SYNC_WRAPPER + '\n\n' + READ_HEADER) == 1, 'Неизвестная обёртка запроса в GitHub')
    if source.count(SYNC_HEADER) == 1:
        require('storeContentSyncFlight' not in source and READ_HEADER not in source, 'Неизвестная локальная обёртка запроса')
        source = source.replace(SYNC_HEADER, SYNC_WRAPPER + '\n\n' + READ_HEADER, 1)
    else:
        require(source.count(SYNC_WRAPPER + '\n\n' + READ_HEADER) == 1 and source.count(READ_HEADER) == 1, 'Неизвестная версия совместного запроса')
    start, end = region(html)
    new_start, new_end = region(new_html)
    require('data-messages-workspace' in new_html[new_start:new_end], 'В GitHub нет нового раздела')
    html = html[:start] + new_html[new_start:new_end] + html[end:]
    for kind, name in [('script', 'messages.js'), ('link', 'messages.css')]:
        attr = 'src' if kind == 'script' else 'href'
        require(len(re.findall(fr'<{kind}[^>]+{attr}="{re.escape(name)}', html)) <= 1, f'Дублируется {name}')
    html = re.sub(r'^[ \t]*<script src="messages\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>\n?', '', html, flags=re.M)
    html = re.sub(r'^[ \t]*<link rel="stylesheet" href="messages\.css(?:\?v=[A-Za-z0-9_-]+)?">\n?', '', html, flags=re.M)
    version = '20261003-messages'
    html, scripts = re.subn(r'^([ \t]*)<script src="app\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>', lambda m: f'{m[1]}<script src="messages.js?v={version}" defer></script>\n{m[1]}<script src="app.js?v={version}" defer></script>', html, flags=re.M)
    html, styles = re.subn(r'^([ \t]*)</head>', lambda m: f'{m[1]}  <link rel="stylesheet" href="messages.css?v={version}">\n{m[0]}', html, flags=re.M)
    require(scripts == styles == 1, 'Не найдены подключения JS и CSS')
    require(html.index('src="messages.js') < html.index('src="app.js'), 'Неизвестный порядок загрузки скриптов')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'app.js').write_text(source)
    (output / 'index.html').write_text(html)
    for file in ['messages.js', 'messages.css', 'messages.test.mjs']:
        (output / file).write_bytes((incoming / file).read_bytes())
    (output / 'cabinet-regression.test.mjs').write_bytes((incoming / 'app.test.mjs').read_bytes())
    for module in ['overview', 'orders', 'plugin-page', 'plugin-cover']:
        for suffix in ['.js', '.test.mjs', '.css']:
            file = module + suffix
            if (local / file).is_file():
                (output / file).write_bytes((local / file).read_bytes())


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 4, 'Нужны пути local, incoming и output')
        stage(*(Path(value) for value in sys.argv[1:]))
        print('Подготовлен раздел Сообщения; другие разделы и адрес API сохранены.')
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
