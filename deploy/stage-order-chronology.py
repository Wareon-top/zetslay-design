#!/usr/bin/env python3
"""Stage only Orders; preserve installed auth, shared reads, messages and settings."""
from pathlib import Path
import re,sys
VERSION='20261015-orders-periods'
def require(value,message):
 if not value:raise ValueError(message+' Файлы не изменены.')
def region(html):
 starts=list(re.finditer(r'^[ \t]*<section\b[^>\n]*\bdata-view="orders"[^>\n]*>',html,re.M))
 ends=list(re.finditer(r'^[ \t]*<section\b[^>\n]*\bdata-view="messages"[^>\n]*>',html,re.M))
 require(len(starts)==len(ends)==1 and starts[0].start()<ends[0].start(),'Не подтверждены границы раздела Заказы.')
 return starts[0].start(),ends[0].start()
def stage(local,incoming,out):
 local,incoming,out=map(Path,[local,incoming,out])
 app=(local/'app.js').read_text();overview=(local/'overview.js').read_text();html=(local/'index.html').read_text();new=(incoming/'index.html').read_text()
 for text in [app,overview,html,new]:require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M),'Обнаружен конфликт файлов.')
 require("typeof renderOrderWorkspace === 'function' && renderOrderWorkspace()" in app and 'function syncStoreContent(' in app,'Сначала нужен установленный раздел Заказы.')
 require('function buildOverview(' in overview,'Не подтверждён источник заказов.')
 a,b=region(html);c,d=region(new)
 require('data-orders-workspace' in html[a:b] and 'data-orders-period="today"' in new[c:d],'Не подтверждена версия раздела Заказы.')
 html=html[:a]+new[c:d]+html[b:]
 for asset,attr in [('orders.js','src'),('orders.css','href')]:
  html,count=re.subn(rf'({attr}=["\']){re.escape(asset)}(?:\?[^"\']*)?(["\'])',lambda m:m[1]+asset+'?v='+VERSION+m[2],html)
  require(count==1,'Не найден единственный ресурс '+asset+'.')
 require(html.index('src="overview.js')<html.index('src="orders.js')<html.index('src="app.js'),'Не подтверждён порядок загрузки.')
 files={'index.html':html,'app.js':app,'overview.js':overview}
 for name in ['orders.js','orders.css','orders.test.mjs']:files[name]=(incoming/name).read_text()
 # All validation and reads complete before output is written.
 out.mkdir(parents=True,exist_ok=True)
 for name,text in files.items():(out/name).write_text(text)
if __name__=='__main__':
 try:
  require(len(sys.argv)==4,'Нужны local, incoming и output.')
  stage(*sys.argv[1:])
 except (OSError,ValueError) as error:raise SystemExit(str(error))
