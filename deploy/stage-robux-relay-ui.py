"""Add the isolated Robux Relay module without replacing live cabinet customization."""
from pathlib import Path
import re
import sys

VERSION = '20261009-robux-relay'
HOOK = "      ${plugin.id === 'zetslay.robux-relay' && typeof robuxSettingsMarkup === 'function' ? robuxSettingsMarkup(plugin) : ''}"

def stage(local, incoming, out):
    files = {name:(local/name).read_text() for name in ('index.html','plugin-page.js','plugin-rarity.js','app.js')}
    for name, text in files.items():
        if re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M):
            raise ValueError('Конфликт в '+name+'. Кабинет не изменён.')
    page = files['plugin-page.js']
    if 'robuxSettingsMarkup' not in page:
        anchor = re.compile(r"^.*\$\{plugin\.id === 'zetslay\.kosell-rent' && typeof kosellRentMarkup === 'function' \? kosellRentMarkup\(plugin\) : ''\}.*$", re.M)
        matches = list(anchor.finditer(page))
        if len(matches) != 1:
            raise ValueError('Не подтверждено место настроек плагина. Кабинет не изменён.')
        page = anchor.sub(lambda m:m.group()+'\n'+HOOK, page)
    elif page.count(HOOK.strip()) != 1:
        raise ValueError('Неизвестная интеграция Robux Relay. Кабинет не изменён.')

    # Keep the live page, but include Robux in the existing purchase safety copy.
    purchase_group = "['zetslay.tiktok-lzt-market','zetslay.roblox-lzt-market'].includes(plugin.id)"
    if purchase_group in page:
        page = page.replace(purchase_group, "['zetslay.robux-relay','zetslay.tiktok-lzt-market','zetslay.roblox-lzt-market'].includes(plugin.id)")
    files['plugin-page.js'] = page
    rarity = files['plugin-rarity.js']
    if 'zetslay.robux-relay' not in rarity:
        anchor = "  'zetslay.tiktok-lzt-market':'ultra',"
        if rarity.count(anchor) != 1:
            raise ValueError('Не подтверждён каталог редкостей. Кабинет не изменён.')
        rarity = rarity.replace(anchor, anchor+"\n  'zetslay.robux-relay':'legendary',")
    elif rarity.count("'zetslay.robux-relay':'legendary'") != 1:
        raise ValueError('Robux Relay имеет другую редкость. Кабинет не изменён.')
    files['plugin-rarity.js'] = rarity
    html = files['index.html']
    app_pattern = r'<script\b[^>]*\bsrc=["\']app\.js(?:\?[^"\']*)?["\'][^>]*>'
    app_matches = list(re.finditer(app_pattern, html))
    if len(app_matches) != 1 or not re.search(r'\bdefer\b',app_matches[0].group()):
        raise ValueError('Не подтверждён запуск app.js. Кабинет не изменён.')
    module_pattern = r'<script\b[^>]*\bsrc=["\']robux-relay\.js(?:\?[^"\']*)?["\'][^>]*>'
    if not re.search(module_pattern,html):
        html = re.sub(app_pattern, lambda m:'<script src="robux-relay.js?v='+VERSION+'" defer></script>\n    '+m.group(), html)
    for module in ('robux-relay','plugin-page','plugin-rarity'):
        pattern = r'(<script\b[^>]*\bsrc=["\'])'+re.escape(module)+r'\.js(?:\?[^"\']*)?(["\'][^>]*>)'
        matches = list(re.finditer(pattern,html))
        app = re.search(app_pattern,html)
        if len(matches) != 1 or matches[0].start() > app.start() or not re.search(r'\bdefer\b',matches[0].group()):
            raise ValueError('Не подтверждён порядок '+module+'. Кабинет не изменён.')
        html = re.sub(pattern, lambda m:m[1]+module+'.js?v='+VERSION+m[2],html)
    html = re.sub(r'(<script\b[^>]*\bsrc=["\'])app\.js(?:\?[^"\']*)?(["\'][^>]*>)',
                  lambda m:m[1]+'app.js?v='+VERSION+m[2],html)
    style_pattern = r'<link\b[^>]*\bhref=["\']robux-relay\.css(?:\?[^"\']*)?["\'][^>]*>'
    styles = list(re.finditer(style_pattern,html))
    style = '<link rel="stylesheet" href="robux-relay.css?v='+VERSION+'">'
    if len(styles)>1 or html.count('</head>')!=1:
        raise ValueError('Не подтверждена структура index.html. Кабинет не изменён.')
    html = re.sub(style_pattern,style,html) if styles else html.replace('</head>', '    '+style+'\n  </head>')
    files['index.html'] = html
    app_js=files['app.js']
    hook="  if (typeof resetRobuxUi === 'function') resetRobuxUi();"
    if hook not in app_js:
        anchor='function resetAccountData() {'
        if app_js.count(anchor)!=1:
            raise ValueError('Не подтверждён сброс кабинета. Кабинет не изменён.')
        app_js=app_js.replace(anchor,anchor+'\n'+hook,1)
    files['app.js']=app_js
    out.mkdir(parents=True,exist_ok=True)
    for name,text in files.items():
        (out/name).write_text(text)
    for name in ('robux-relay.js','robux-relay.css'):
        (out/name).write_bytes((incoming/name).read_bytes())

if __name__ == '__main__':
    try:
        stage(*(Path(v) for v in sys.argv[1:]))
    except (OSError,ValueError) as error:
        print(str(error),file=sys.stderr)
        sys.exit(1)
