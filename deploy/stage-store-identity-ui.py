from pathlib import Path
import re,sys
local,incoming,out=map(Path,sys.argv[1:])
html=(local/'index.html').read_text();overview=(local/'overview.js').read_text()
if re.search(r'^(<<<<<<<|=======|>>>>>>>)',html+'\n'+overview,re.M):raise SystemExit('Маркеры конфликта; кабинет не изменён.')
hook="  if (typeof renderStoreIdentity === 'function') renderStoreIdentity();\n"
marker='  const model = buildOverview(state.storeContent, overviewState.currency);'
if overview.count(marker)!=1:raise SystemExit('Неизвестная структура обзора; кабинет не изменён.')
if hook not in overview:overview=overview.replace(marker,hook+marker,1)
html=re.sub(r'^[ \t]*<script src="store-identity\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>\n?','',html,flags=re.M)
html,count=re.subn(r'(<script src="overview\.js)(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)',r'<script src="store-identity.js?v=20261004-avatar-cdn" defer></script>\n    \1?v=20261004-avatar-cdn\2',html)
if count!=1:raise SystemExit('Не найдена загрузка обзора; кабинет не изменён.')
html=re.sub(r'^[ \t]*<link rel="stylesheet" href="store-identity\.css(?:\?v=[A-Za-z0-9_-]+)?">\n?','',html,flags=re.M)
html,count=re.subn(r'</head>', '<link rel="stylesheet" href="store-identity.css?v=20261004-avatar-cdn">\n</head>',html)
if count!=1:raise SystemExit('Не найден head; кабинет не изменён.')
out.mkdir(parents=True,exist_ok=True)
(out/'index.html').write_text(html);(out/'overview.js').write_text(overview)
for name in ['store-identity.js','store-identity.css','store-identity.test.mjs']:(out/name).write_bytes((incoming/name).read_bytes())
