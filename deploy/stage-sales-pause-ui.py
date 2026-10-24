"""Add one manual plugin guide; do not change user covers or cabinet sections."""
from pathlib import Path
import re
import sys

def require(ok, message):
    if not ok:
        raise ValueError(message + '. Кабинет не изменён.')

def replace_once(text, old, new, label):
    if new in text:
        return text
    require(text.count(old) == 1, 'Неизвестная разметка: ' + label)
    return text.replace(old, new, 1)

def stage(local, incoming, out):
    page = (local / 'plugin-page.js').read_text()
    rarity = (local / 'plugin-rarity.js').read_text()
    html = (local / 'index.html').read_text()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)', page + '\n' + rarity + '\n' + html, re.M), 'Маркеры конфликта')
    hook = "      ${plugin.id === 'zetslay.sales-pause' && typeof salesPauseGuideMarkup === 'function' ? salesPauseGuideMarkup(plugin) : ''}\n"
    marker = '    </div><aside class="plugin-page-sidebar"'
    require(page.count(marker) == 1, 'Не найдена структура страницы плагина')
    if hook not in page:
        page = page.replace(marker, hook + marker, 1)
    page = replace_once(page, "!['zetslay.lot-cloner','zetslay.mass-price-editor'].includes(plugin.id)", "!['zetslay.lot-cloner','zetslay.mass-price-editor','zetslay.sales-pause'].includes(plugin.id)", 'события модуля')
    old = "plugin.id === 'zetslay.mass-price-editor' ? 'Переоценка"
    new = "plugin.id === 'zetslay.sales-pause' ? 'Отключение и восстановление лотов запускаются вручную после сводки и подтверждения. Список сохраняется в базе. Неизвестный результат останавливает задачу; проверка статусов не выполняет повторную запись.' : plugin.id === 'zetslay.mass-price-editor' ? 'Переоценка"
    page = replace_once(page, old, new, 'ручное управление')
    entries = list(re.finditer(r"('zetslay\.sales-pause'\s*:\s*)'(?:advanced|ultra)'", rarity))
    require(len(entries) <= 1, 'Неоднозначная редкость паузы продаж')
    if entries:
        rarity = re.sub(r"('zetslay\.sales-pause'\s*:\s*)'(?:advanced|ultra)'", lambda m:m[1]+"'advanced'", rarity)
    else:
        markers = list(re.finditer(r"  'zetslay\.mass-price-editor':'(?:advanced|ultra)',", rarity))
        require(len(markers) == 1, 'Неизвестный каталог уровней')
        marker = markers[0].group()
        rarity = rarity.replace(marker, marker+"\n  'zetslay.sales-pause':'advanced',", 1)
    for asset, tag, attr in [('sales-pause.js','script','src'),('sales-pause.css','link','href')]:
        html = re.sub(r'^[ \t]*<'+tag+r'[^\n]*'+attr+r'="'+re.escape(asset)+r'(?:\?v=[A-Za-z0-9_-]+)?"[^\n]*>\n?', '', html, flags=re.M)
    for asset in ['plugin-page.js','plugin-rarity.js']:
        html, count = re.subn(r'(<script src="'+re.escape(asset)+r')(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)', r'\1?v=20261005-sales-pause\2', html)
        require(count == 1, 'Не найден ' + asset)
    html, count = re.subn(r'^([ \t]*)(<script src="app\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>)', lambda m: m[1]+'<script src="sales-pause.js?v=20261005-sales-pause" defer></script>\n'+m[1]+m[2], html, flags=re.M)
    require(count == 1 and html.count('</head>') == 1, 'Не найдены подключения ассетов')
    html = re.sub(r'^[ \t]*</head>', '    <link rel="stylesheet" href="sales-pause.css?v=20261005-sales-pause">\n  </head>', html, flags=re.M)
    out.mkdir(parents=True, exist_ok=True)
    for name, text in [('plugin-page.js',page),('plugin-rarity.js',rarity),('index.html',html)]:
        (out / name).write_text(text)
    for name in ['sales-pause.js','sales-pause.css','sales-pause.test.mjs']:
        (out / name).write_bytes((incoming / name).read_bytes())

if __name__ == '__main__':
    try:
        stage(*(Path(value) for value in sys.argv[1:]))
    except (OSError,ValueError) as error:
        print(str(error),file=sys.stderr)
        sys.exit(1)
