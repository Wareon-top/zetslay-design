"""Insert Steam Rent while retaining local catalogue, artwork and connection settings."""
from pathlib import Path
import re
import sys
ASSETS=('steam-rent.js','steam-rent.css','steam-rent.test.mjs')
VERSION='20261010-steam-rent'
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));page=(local/'plugin-page.js').read_text();rarity=(local/'plugin-rarity.js').read_text();html=(local/'index.html').read_text()
 if re.search(r'^(<<<<<<<|=======|>>>>>>>)',page+'\n'+rarity+'\n'+html,re.M):raise ValueError('Маркеры конфликта; кабинет не изменён.')
 hook="      ${plugin.id === 'zetslay.steam-rent' && typeof steamRentMarkup === 'function' ? steamRentMarkup(plugin) : ''}\n"
 if hook not in page:
  marker='    </div><aside class="plugin-page-sidebar"'
  if page.count(marker)!=1:raise ValueError('Неизвестная разметка страницы плагина; кабинет не изменён.')
  page=page.replace(marker,hook+marker,1)
 context="plugin.id === 'zetslay.steam-rent' ? 'Приём оплаченных заказов включается отдельно. Неизвестный результат удерживает аккаунт; выдача и завершение сохраняются до внешнего запроса. При отключении модуля или окончании тарифа вручную закройте действующие доступы Steam.' : "
 if context not in page:
  marker="plugin.id === 'zetslay.kosell-rent' ? 'Автопокупка"
  if page.count(marker)!=1:raise ValueError('Поясняющая панель не распознана; кабинет не изменён.')
  page=page.replace(marker,context+marker,1)
 entry=re.compile(r"('zetslay\.steam-rent'\s*:\s*)'[^']*'")
 if entry.search(rarity):
  rarity,count=entry.subn(lambda m:m[1]+"'legendary'",rarity)
  if count!=1:raise ValueError('Неоднозначная редкость Steam Rent.')
 else:
  marker=re.search(r"  'zetslay\.kosell-rent'\s*:\s*'(?:legendary|ultra)'",rarity)
  if not marker:raise ValueError('Каталог редкостей не распознан.')
  rarity=rarity.replace(marker[0],"  'zetslay.steam-rent':'legendary',\n"+marker[0],1)
 if html.count('</head>')!=1 or html.count('</body>')!=1:raise ValueError('Точка подключения не распознана.')
 for asset,tag,attr in [('steam-rent.css','link','href'),('steam-rent.js','script','src')]:
  html=re.sub(r'^[ \t]*<'+tag+r'\b[^\n]*'+attr+r'="'+re.escape(asset)+r'(?:\?[^"\n]*)?"[^\n]*>(?:</script>)?\n?','',html,flags=re.M)
 html=html.replace('</head>','<link rel="stylesheet" href="steam-rent.css?v='+VERSION+'">\n</head>',1).replace('</body>','<script src="steam-rent.js?v='+VERSION+'" defer></script>\n</body>',1)
 for asset in ['plugin-page.js','plugin-rarity.js']:
  html,count=re.subn(r'('+re.escape(asset)+r')(?:\?[^"\s]+)?(?="[^>]*></script>)',r'\1?v='+VERSION,html)
  if count!=1:raise ValueError('Не найден '+asset)
 files={name:(incoming/name).read_bytes() for name in ASSETS};files.update({'index.html':html.encode(),'plugin-page.js':page.encode(),'plugin-rarity.js':rarity.encode()});out.mkdir(parents=True,exist_ok=True)
 for name,data in files.items():(out/name).write_bytes(data)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as error:raise SystemExit(str(error))
