from pathlib import Path
import re,sys
local,incoming,out=map(Path,sys.argv[1:])
html=(local/'index.html').read_text();overview=(local/'overview.js').read_text();orders=(local/'orders.js').read_text()
if re.search(r'^(<<<<<<<|=======|>>>>>>>)',html+'\n'+overview+'\n'+orders,re.M):raise SystemExit('Маркеры конфликта; кабинет не изменён.')
needle='status, currency, amount, date: date != null'
field="sourceDateLabel: typeof order.sourceDateLabel === 'string' ? order.sourceDateLabel.slice(0,240) : '', "
if field not in overview:
 if overview.count(needle)!=1:raise SystemExit('Неизвестная модель статистики; кабинет не изменён.')
 overview=overview.replace(needle,field+needle,1)
start='function orderDateMarkup(';end='\nfunction orderRowsMarkup('
new=(incoming/'orders.js').read_text()
if orders.count(start)!=1 or orders.count(end)!=1:raise SystemExit('Неизвестная структура заказов; кабинет не изменён.')
a=orders.index(start);b=orders.index(end,a);c=new.index(start);d=new.index(end,c)
orders=orders[:a]+new[c:d]+orders[b:]
orders=orders.replace('orderDateMarkup(order.date)', 'orderDateMarkup(order.date, order.sourceDateLabel)')
orders=orders.replace("order.date == null ? 'FunPay не передал дату заказа'", "order.date == null ? overviewEscape(order.sourceDateLabel || 'FunPay не передал дату заказа')")
if 'orderDateMarkup(order.date, order.sourceDateLabel)' not in orders or "overviewEscape(order.sourceDateLabel || 'FunPay не передал дату заказа')" not in orders:raise SystemExit('Не найдены поля даты; кабинет не изменён.')
for file in ['overview.js','orders.js','store-identity.js']:
 pattern=r'(<script src="'+re.escape(file)+r')(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)'
 html,n=re.subn(pattern,r'\1?v=20261004-store-metadata\2',html)
 if n!=1:raise SystemExit('Не найдена загрузка '+file+'; кабинет не изменён.')
html,n=re.subn(r'(<link rel="stylesheet" href="store-identity\.css)(?:\?v=[A-Za-z0-9_-]+)?(">)',r'\1?v=20261004-store-metadata\2',html)
if n!=1:raise SystemExit('Не установлен блок магазина; сначала обновите Главную.')
out.mkdir(parents=True,exist_ok=True)
for name,text in [('index.html',html),('overview.js',overview),('orders.js',orders)]:(out/name).write_text(text)
for name in ['store-identity.js','store-identity.css','store-identity.test.mjs','orders.test.mjs','overview.test.mjs']:(out/name).write_bytes((incoming/name).read_bytes())
# Existing app is used for staged tests only and is never replaced.
(out/'app.js').write_bytes((local/'app.js').read_bytes())
