from pathlib import Path
import re,sys
local,incoming,out=map(Path,sys.argv[1:])
html=(local/'index.html').read_text();app=(local/'app.js').read_text()
if re.search(r'^(<<<<<<<|=======|>>>>>>>)',html+'\n'+app,re.M):raise SystemExit('Маркеры конфликта; кабинет не изменён.')
header=re.search(r'<header class="topbar">[\s\S]*?</header>',html)
if not header:raise SystemExit('Неизвестная верхняя панель; кабинет не изменён.')
text=header.group()
text=re.sub(r'\s*<span\b[^>]*\bdata-system-health[^>]*>[\s\S]*?</span>','',text)
# Remove only the topbar sun/theme/settings icon; sidebar Security is preserved.
text=re.sub(r'\s*<button\b[^>]*>[\s\S]*?</button>',lambda m:'' if re.search(r'data-theme|#i-sun|#i-gear|aria-label="(?:Безопасность|[^"\n]*[Тт]ем[^"\n]*)"',m.group()) else m.group(),text)
html=html[:header.start()]+text+html[header.end():]
hook="  if (typeof renderCabinetTopbar === 'function') renderCabinetTopbar();\n"
marker="  document.querySelectorAll('[data-auth-avatar]').forEach((node) => { node.textContent = accountInitials(accountName); });\n"
if hook not in app:
 if app.count(marker)!=1:raise SystemExit('Неизвестная авторизация; кабинет не изменён.')
 app=app.replace(marker,marker+hook,1)
for file in ['app.js','store-identity.js']:
 html,n=re.subn(r'(<script src="'+re.escape(file)+r')(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)',r'\1?v=20261004-topbar\2',html)
 if n!=1:raise SystemExit('Не найдена загрузка '+file+'; кабинет не изменён.')
html,n=re.subn(r'(<link rel="stylesheet" href="store-identity\.css)(?:\?v=[A-Za-z0-9_-]+)?(">)',r'\1?v=20261004-topbar\2',html)
if n!=1:raise SystemExit('Сначала установите карточку магазина.')
out.mkdir(parents=True,exist_ok=True)
(out/'app.js').write_text(app);(out/'index.html').write_text(html)
for file in ['store-identity.js','store-identity.css','store-identity.test.mjs','app.test.mjs']:(out/file).write_bytes((incoming/file).read_bytes())
