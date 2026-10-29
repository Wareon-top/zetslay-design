from pathlib import Path
import re,sys
VERSION='20261014-priority-orders'
HOOK="      ${plugin.id === 'zetslay.priority-orders' && typeof prioritySettingsMarkup === 'function' ? prioritySettingsMarkup(plugin) : ''}\n"
CONTEXT="plugin.id === 'zetslay.priority-orders' ? 'Уведомляет только владельца магазина. Старые заказы пропускаются; отправка и закрепление учитываются отдельно. При неизвестной доставке повтор заблокирован.' : "
def require(ok,message):
 if not ok:raise ValueError(message+' Файлы кабинета не изменены.')
def stage(local,incoming,out):
 local,incoming,out=map(Path,[local,incoming,out]);page=(local/'plugin-page.js').read_text();rarity=(local/'plugin-rarity.js').read_text();html=(local/'index.html').read_text()
 for s in [page,rarity,html]:require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',s,re.M),'Маркеры конфликта.')
 marker='    </div><aside class="plugin-page-sidebar"';require(page.count(marker)==1,'Не найдена точка настроек плагина.')
 if HOOK not in page:require('prioritySettingsMarkup' not in page,'Неизвестная интеграция плагина.');page=page.replace(marker,HOOK+marker,1)
 require(page.count(HOOK)==1,'Дублируются настройки.')
 marker="${['zetslay.robux-relay'"
 if CONTEXT not in page:require(page.count(marker)==1,'Не найдена точка описания.');page=page.replace(marker,'${'+CONTEXT+"['zetslay.robux-relay'",1)
 marker="  'zetslay.confirm-reminder':'common',"
 if "'zetslay.priority-orders':'common'" not in rarity:require(rarity.count(marker)==1,'Не найдена таблица редкостей.');rarity=rarity.replace(marker,"  'zetslay.priority-orders':'common',\n"+marker,1)
 for asset in ['priority-orders.js','priority-orders.css']:
  tag='script' if asset.endswith('.js') else 'link';attr='src' if tag=='script' else 'href';pattern=rf'<{tag}\b[^>]*{attr}=["\']{re.escape(asset)}(?:\?[^"\']*)?["\'][^>]*(?:></script>|>)';require(len(re.findall(pattern,html))<=1,'Дубли загрузки.');html=re.sub(pattern,'',html)
 marker=re.compile(r'<script\b[^>]*src=["\']plugin-page\.js(?:\?[^"\']*)?["\'][^>]*></script>');require(len(marker.findall(html))==1,'Не подтверждён plugin-page.js.');html=marker.sub(lambda m:f'<script src="priority-orders.js?v={VERSION}" defer></script>\n'+m[0],html)
 html=re.sub(r'(plugin-page\.js|plugin-rarity\.js)\?v=[\w-]+',lambda m:m[1]+'?v='+VERSION,html)
 require(html.count('</head>')==1,'Не подтверждён head.');html=html.replace('</head>',f'<link rel="stylesheet" href="priority-orders.css?v={VERSION}">\n</head>',1)
 out.mkdir(parents=True,exist_ok=True)
 for name,s in [('index.html',html),('plugin-page.js',page),('plugin-rarity.js',rarity)]:(out/name).write_text(s)
 for name in ['priority-orders.js','priority-orders.css']:(out/name).write_bytes((incoming/name).read_bytes())
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as e:raise SystemExit(str(e))
