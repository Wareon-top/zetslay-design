from pathlib import Path
import re, sys
local,incoming,out=map(Path,sys.argv[1:])
page=(local/'plugin-page.js').read_text();html=(local/'index.html').read_text()
if re.search(r'^(<<<<<<<|=======|>>>>>>>)',page+'\n'+html,re.M):raise SystemExit('Маркеры конфликтов; кабинет не изменён.')
marker='    </div><aside class="plugin-page-sidebar"'
hook="      ${plugin.id === 'zetslay.lot-cloner' ? lotClonerGuideMarkup(plugin) : ''}\n"
if page.count(marker)!=1:raise SystemExit('Неизвестная структура страницы плагина.')
if hook not in page:page=page.replace(marker,hook+marker,1)
pattern=r'// LOT_CLONER_GUIDE_START\n.*?// LOT_CLONER_GUIDE_END\n'
section=re.search(pattern,(incoming/'plugin-page.js').read_text(),re.S)
if not section:raise SystemExit('Не найдена инструкция Lot Cloner.')
page=re.sub(pattern,'',page,flags=re.S)+'\n'+section[0]
page=page.replace('Разрешения появятся после регистрации модуля.','Модуль не запрашивает событийных разрешений.')
page=page.replace('${events.length ?',"${plugin.id !== 'zetslay.lot-cloner' && events.length ?")
start="${plugin.id === 'zetslay.review-reminder' ? 'Перед каждым"
new="${plugin.id === 'zetslay.lot-cloner' ? 'Создание запускается вручную в вашем боте после подтверждения. Копия выключена; исходный лот не меняется. При неизвестном результате автоматический повтор запрещён.' : plugin.id === 'zetslay.review-reminder' ? 'Перед каждым"
if new not in page:
    if page.count(start)!=1:raise SystemExit('Неизвестный блок разрешений. Кабинет не изменён.')
    page=page.replace(start,new,1)
html,count=re.subn(r'(<script src="plugin-page\.js)(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)',r'\1?v=20261004-lot-cloner\2',html)
if count!=1:raise SystemExit('Не найден скрипт страницы плагина.')
out.mkdir(parents=True,exist_ok=True);(out/'plugin-page.js').write_text(page);(out/'index.html').write_text(html)
