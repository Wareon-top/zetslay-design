from pathlib import Path
import re, sys
local,incoming,out=map(Path,sys.argv[1:])
page=(local/'plugin-page.js').read_text();html=(local/'index.html').read_text()
if re.search(r'^(<<<<<<<|=======|>>>>>>>)',page+'\n'+html,re.M):raise SystemExit('Маркеры конфликтов; кабинет не изменён.')
marker='    </div><aside class="plugin-page-sidebar"'
hook="      ${plugin.id === 'zetslay.mass-price-editor' ? massPriceGuideMarkup(plugin) : ''}\n"
if page.count(marker)!=1:raise SystemExit('Неизвестная структура страницы плагина.')
if hook not in page:page=page.replace(marker,hook+marker,1)
pattern=r'// MASS_PRICE_GUIDE_START\n.*?// MASS_PRICE_GUIDE_END\n'
section=re.search(pattern,(incoming/'plugin-page.js').read_text(),re.S)
if not section:raise SystemExit('Не найдена инструкция Mass Price Editor.')
page=re.sub(pattern,'',page,flags=re.S).rstrip()+'\n\n'+section[0]
old="${plugin.id === 'zetslay.lot-cloner' ? 'Создание запускается"
new="${plugin.id === 'zetslay.mass-price-editor' ? 'Переоценка запускается вручную в вашем боте после расчёта и подтверждения. Стоп прекращает следующие изменения. При неизвестном результате записи выполнение останавливается.' : plugin.id === 'zetslay.lot-cloner' ? 'Создание запускается"
if new not in page and new.removeprefix("${") not in page:
    if page.count(old)!=1:raise SystemExit('Неизвестный блок доступа. Сначала обновите Lot Cloner.')
    page=page.replace(old,new,1)
page=page.replace("${plugin.id !== 'zetslay.lot-cloner' && events.length ?", "${!['zetslay.lot-cloner','zetslay.mass-price-editor'].includes(plugin.id) && events.length ?")
old='return `assets/plugin-covers/${category}.svg`;'
new="return plugin.id === 'zetslay.mass-price-editor' ? 'assets/plugin-covers/mass-price-editor.svg' : `assets/plugin-covers/${category}.svg`;"
if new not in page:
    if page.count(old)!=1:raise SystemExit('Неизвестный блок обложки.')
    page=page.replace(old,new,1)
html,count=re.subn(r'(<script src="plugin-page\.js)(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)',r'\1?v=20261004-mass-price\2',html)
if count!=1:raise SystemExit('Не найден скрипт страницы плагина.')
css='    <link rel="stylesheet" href="mass-price-editor.css?v=20261004-mass-price">\n'
html=re.sub(r'<link rel="stylesheet" href="mass-price-editor\.css[^\"]*">\s*','',html,flags=re.M)
if html.count('</head>')!=1:raise SystemExit('Не найден head кабинета.')
html=html.replace('</head>',css+'</head>')
out.mkdir(parents=True,exist_ok=True);(out/'plugin-page.js').write_text(page);(out/'index.html').write_text(html)
for file in ['mass-price-editor.css','assets/plugin-covers/mass-price-editor.svg']:
    target=out/file;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((incoming/file).read_bytes())
