"""Add the isolated Roblox module without replacing live cabinet customization."""
from pathlib import Path
import re
import sys

VERSION = '20261007-roblox-lzt'
HOOK = "      ${plugin.id === 'zetslay.roblox-lzt-market' && typeof robloxSettingsMarkup === 'function' ? robloxSettingsMarkup(plugin) : ''}"

def stage(local, incoming, out):
    files = {name:(local/name).read_text() for name in ('index.html','plugin-page.js','plugin-rarity.js')}
    for name, text in files.items():
        if re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M):
            raise ValueError('Конфликт в '+name+'. Кабинет не изменён.')
    page = files['plugin-page.js']
    if 'robloxSettingsMarkup' not in page:
        anchor = re.compile(r"^.*\$\{plugin\.id === 'zetslay\.kosell-rent' && typeof kosellRentMarkup === 'function' \? kosellRentMarkup\(plugin\) : ''\}.*$", re.M)
        matches = list(anchor.finditer(page))
        if len(matches) != 1:
            raise ValueError('Не подтверждено место настроек плагина. Кабинет не изменён.')
        page = anchor.sub(lambda m:m.group()+'\n'+HOOK, page)
    elif page.count(HOOK.strip()) != 1:
        raise ValueError('Неизвестная интеграция Roblox. Кабинет не изменён.')
    page=page.replace("${plugin.id === 'zetslay.tiktok-lzt-market' ? 'Новая покупка","${['zetslay.tiktok-lzt-market','zetslay.roblox-lzt-market'].includes(plugin.id) ? 'Новая покупка")
    files['plugin-page.js'] = page
    rarity = files['plugin-rarity.js']
    if 'zetslay.roblox-lzt-market' not in rarity:
        anchor = "  'zetslay.tiktok-lzt-market':'ultra',"
        if rarity.count(anchor) != 1:
            raise ValueError('Не подтверждён каталог редкостей. Кабинет не изменён.')
        rarity = rarity.replace(anchor, anchor+"\n  'zetslay.roblox-lzt-market':'ultra',")
    elif rarity.count("'zetslay.roblox-lzt-market':'ultra'") != 1:
        raise ValueError('Roblox имеет другую редкость. Кабинет не изменён.')
    files['plugin-rarity.js'] = rarity
    html = files['index.html']
    app_pattern = r'<script\b[^>]*\bsrc=["\']app\.js(?:\?[^"\']*)?["\'][^>]*>'
    app_matches = list(re.finditer(app_pattern, html))
    if len(app_matches) != 1 or not re.search(r'\bdefer\b',app_matches[0].group()):
        raise ValueError('Не подтверждён запуск app.js. Кабинет не изменён.')
    module_pattern = r'<script\b[^>]*\bsrc=["\']roblox-lzt-market\.js(?:\?[^"\']*)?["\'][^>]*>'
    if not re.search(module_pattern,html):
        html = re.sub(app_pattern, lambda m:'<script src="roblox-lzt-market.js?v='+VERSION+'" defer></script>\n    '+m.group(), html)
    for module in ('roblox-lzt-market','plugin-page','plugin-rarity'):
        pattern = r'(<script\b[^>]*\bsrc=["\'])'+re.escape(module)+r'\.js(?:\?[^"\']*)?(["\'][^>]*>)'
        matches = list(re.finditer(pattern,html))
        app = re.search(app_pattern,html)
        if len(matches) != 1 or matches[0].start() > app.start() or not re.search(r'\bdefer\b',matches[0].group()):
            raise ValueError('Не подтверждён порядок '+module+'. Кабинет не изменён.')
        html = re.sub(pattern, lambda m:m[1]+module+'.js?v='+VERSION+m[2],html)
    style_pattern = r'<link\b[^>]*\bhref=["\']roblox-lzt-market\.css(?:\?[^"\']*)?["\'][^>]*>'
    styles = list(re.finditer(style_pattern,html))
    style = '<link rel="stylesheet" href="roblox-lzt-market.css?v='+VERSION+'">'
    if len(styles)>1 or html.count('</head>')!=1:
        raise ValueError('Не подтверждена структура index.html. Кабинет не изменён.')
    html = re.sub(style_pattern,style,html) if styles else html.replace('</head>', '    '+style+'\n  </head>')
    files['index.html'] = html
    out.mkdir(parents=True,exist_ok=True)
    for name,text in files.items():
        (out/name).write_text(text)
    for name in ('roblox-lzt-market.js','roblox-lzt-market.css'):
        (out/name).write_bytes((incoming/name).read_bytes())

if __name__ == '__main__':
    try:
        stage(*(Path(v) for v in sys.argv[1:]))
    except (OSError,ValueError) as error:
        print(str(error),file=sys.stderr)
        sys.exit(1)
