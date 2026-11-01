"""Add Kosell's isolated settings without replacing VPS app.js or user artwork."""
from pathlib import Path
import re
import sys

def stage(local, incoming, out):
    page = (local / 'plugin-page.js').read_text()
    rarity = (local / 'plugin-rarity.js').read_text()
    html = (local / 'index.html').read_text()
    if re.search(r'^(<<<<<<<|=======|>>>>>>>)', page+'\n'+rarity+'\n'+html, re.M):
        raise ValueError('Маркеры конфликта. Кабинет не изменён.')
    marker = '    </div><aside class="plugin-page-sidebar"'
    hook = "      ${plugin.id === 'zetslay.kosell-rent' && typeof kosellRentMarkup === 'function' ? kosellRentMarkup(plugin) : ''}\n"
    if hook not in page:
        if page.count(marker) != 1:
            raise ValueError('Неизвестная структура страницы плагина. Кабинет не изменён.')
        page = page.replace(marker, hook+marker, 1)
    old = "plugin.id === 'zetslay.mass-price-editor' ? 'Переоценка"
    new = "plugin.id === 'zetslay.kosell-rent' ? 'Автопокупка включается отдельно. Цена и покупатель проверяются перед выдачей. Неизвестный результат списания запрещает автоматический повтор; операции с арендой требуют подтверждения.' : " + old
    if "plugin.id === 'zetslay.kosell-rent' ? 'Автопокупка" not in page:
        if page.count(old) != 1:
            raise ValueError('Неизвестная поясняющая панель. Кабинет не изменён.')
        page = page.replace(old, new, 1)
    entry = re.compile(r"('zetslay\.kosell-rent'\s*:\s*)'(?:ultra|legendary)'")
    if entry.search(rarity):
        rarity,count = entry.subn(lambda m:m[1]+"'legendary'", rarity)
        if count != 1:raise ValueError('Неоднозначная редкость Kosell')
    else:
        markers = list(re.finditer(r"  'zetslay\.auto-review-bonus':'(?:advanced|legendary)'", rarity))
        if len(markers) != 1:raise ValueError('Неизвестный каталог уровней. Кабинет не изменён.')
        marker = markers[0].group()
        rarity = rarity.replace(marker,"  'zetslay.kosell-rent':'legendary',\n"+marker,1)
    for asset,tag,attr in [('kosell-rent.js','script','src'),('kosell-rent.css','link','href')]:
        html = re.sub(r'^[ \t]*<'+tag+r'[^\n]*'+attr+r'="'+re.escape(asset)+r'(?:\?v=[\w-]+)?"[^\n]*>\n?', '', html, flags=re.M)
    for asset in ['plugin-page.js','plugin-rarity.js']:
        html,count = re.subn(r'(<script src="'+re.escape(asset)+r')(?:\?v=[\w-]+)?(" defer></script>)',r'\1?v=20261005-kosell-1-2\2',html)
        if count != 1:
            raise ValueError('Не найден '+asset+'. Кабинет не изменён.')
    html,count = re.subn(r'^([ \t]*)(<script src="app\.js(?:\?v=[\w-]+)?" defer></script>)',lambda m:m[1]+'<script src="kosell-rent.js?v=20261005-kosell-1-2" defer></script>\n'+m[1]+m[2],html,flags=re.M)
    if count != 1 or html.count('</head>') != 1:
        raise ValueError('Не найдена точка подключения. Кабинет не изменён.')
    html = html.replace('  </head>','    <link rel="stylesheet" href="kosell-rent.css?v=20261005-kosell-1-2">\n  </head>',1)
    out.mkdir(parents=True,exist_ok=True)
    for name,text in [('plugin-page.js',page),('plugin-rarity.js',rarity),('index.html',html)]:
        (out/name).write_text(text)
    for name in ['kosell-rent.js','kosell-rent.css','kosell-rent.test.mjs']:
        (out/name).write_bytes((incoming/name).read_bytes())

if __name__ == '__main__':
    try:
        stage(*(Path(v) for v in sys.argv[1:]))
    except (OSError,ValueError) as error:
        print(str(error),file=sys.stderr)
        sys.exit(1)
