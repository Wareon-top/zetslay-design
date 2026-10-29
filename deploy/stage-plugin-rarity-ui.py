from pathlib import Path
import re,sys
local,incoming,out=map(Path,sys.argv[1:])
app=(local/'app.js').read_text();page=(local/'plugin-page.js').read_text();html=(local/'index.html').read_text()
if re.search(r'^(<<<<<<<|=======|>>>>>>>)',app+'\n'+page+'\n'+html,re.M):raise SystemExit('Маркеры конфликтов; кабинет не изменён.')
old='''</a></div><div class="plugin-card__cover-meta">${adminMark}<span class="plugin-card__badge ${tone === 'green' ? 'plugin-card__badge--work' : tone === 'blue' ? 'plugin-card__badge--pause' : 'plugin-card__badge--soon'}">${status}</span></div>'''
inline='''</a>${adminMark}<span class="plugin-card__badge ${tone === 'green' ? 'plugin-card__badge--work' : tone === 'blue' ? 'plugin-card__badge--pause' : 'plugin-card__badge--soon'}">${status}</span></div>'''
new='''</a>${typeof pluginRarityMarkup === 'function' ? pluginRarityMarkup(plugin) : ''}</div>${adminMark ? `<div class="plugin-card__cover-meta">${adminMark}</div>` : ''}'''
# Recognize both shipped cover layouts. Do not overwrite the catalog function.
if new not in app:
    if app.count(old)+app.count(inline)!=1:raise SystemExit('Неизвестная разметка карточки; кабинет не изменён.')
    app=app.replace(old if old in app else inline,new,1)
if 'plugin-card__badge' in app:raise SystemExit('Старая плашка осталась в разметке; кабинет не изменён.')
page,n=re.subn(r'^\s*<figure class="plugin-page-cover">.*?</figure>\n','',page,flags=re.M|re.S)
if n>1 or '<figure class="plugin-page-cover"' in page:raise SystemExit('Неизвестная разметка баннера.')
old='<span>Управление карточкой</span><button class="button button--ghost button--wide" type="button" data-plugin-edit='
new='''<span>Управление карточкой</span><button class="button button--ghost button--wide" type="button" data-cover-plugin="${escapeHtml(plugin.id)}">${icon('external')} Изменить обложку в каталоге</button><button class="button button--ghost button--wide" type="button" data-plugin-edit='''
if new not in page:
    if page.count(old)!=1:raise SystemExit('Неизвестный блок администратора; кабинет не изменён.')
    page=page.replace(old,new,1)
# Remove only our own asset references and reinsert exactly once, in order.
html=re.sub(r'<link rel="stylesheet" href="plugin-rarity\.css(?:\?v=[A-Za-z0-9_-]+)?">\s*','',html)
html=re.sub(r'<script src="plugin-rarity\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>\s*','',html)
if html.count('</head>')!=1:raise SystemExit('Не найден head.')
html=html.replace('</head>','<link rel="stylesheet" href="plugin-rarity.css?v=20261004-plugin-rarity">\n</head>')
for name in ['app','plugin-page']:
    html,n=re.subn(r'(<script src="'+name+r'\.js)(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)',r'\1?v=20261004-plugin-rarity\2',html)
    if n!=1:raise SystemExit('Не найден скрипт '+name)
html=html.replace('<script src="plugin-page.js','<script src="plugin-rarity.js?v=20261004-plugin-rarity" defer></script>\n<script src="plugin-page.js',1)
out.mkdir(parents=True,exist_ok=True)
for name,value in [('app.js',app),('plugin-page.js',page),('index.html',html)]: (out/name).write_text(value)
for name in ['plugin-rarity.js','plugin-rarity.css']: (out/name).write_bytes((incoming/name).read_bytes())
