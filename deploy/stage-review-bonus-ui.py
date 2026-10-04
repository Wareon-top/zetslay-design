from pathlib import Path
import re,sys
local,incoming,out=map(Path,sys.argv[1:])
page=(local/'plugin-page.js').read_text();html=(local/'index.html').read_text()
hook="      ${plugin.id === 'zetslay.auto-review-bonus' && typeof bonusSettingsMarkup === 'function' ? bonusSettingsMarkup(plugin) : ''}\n"
marker='    </div><aside class="plugin-page-sidebar"'
if re.search(r'^(<<<<<<<|=======|>>>>>>>)',page+'\n'+html,re.M):raise SystemExit('Маркеры слияния; кабинет не изменён.')
if page.count(marker)!=1:raise SystemExit('Неизвестная структура страницы плагина; кабинет не изменён.')
if hook not in page:
    if 'bonusSettingsMarkup' in page:raise SystemExit('Неизвестная локальная интеграция подарков; кабинет не изменён.')
    page=page.replace(marker,hook+marker,1)
html=re.sub(r'^[ \t]*<script src="review-bonus\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>\n?','',html,flags=re.M)
html,count=re.subn(r'(<script src="plugin-page\.js)(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)',r'<script src="review-bonus.js?v=20261004-review-bonus" defer></script>\n    \1?v=20261004-review-bonus\2',html)
if count!=1:raise SystemExit('Не найдена загрузка страницы плагина; кабинет не изменён.')
html=re.sub(r'^[ \t]*<link rel="stylesheet" href="review-bonus\.css(?:\?v=[A-Za-z0-9_-]+)?">\n?','',html,flags=re.M)
html,count=re.subn(r'^[ \t]*</head>', '    <link rel="stylesheet" href="review-bonus.css?v=20261004-review-bonus">\n    </head>',html,flags=re.M)
if count!=1:raise SystemExit('Не найден head; кабинет не изменён.')
out.mkdir(parents=True,exist_ok=True)
(out/'plugin-page.js').write_text(page);(out/'index.html').write_text(html)
(out/'review-bonus.js').write_bytes((incoming/'review-bonus.js').read_bytes())

(out/'review-bonus.css').write_bytes((incoming/'review-bonus.css').read_bytes())
