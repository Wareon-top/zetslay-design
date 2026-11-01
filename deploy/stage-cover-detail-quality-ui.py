from pathlib import Path
import re,sys
local,incoming,out=map(Path,sys.argv[1:])
app=(local/'app.js').read_text();html=(local/'index.html').read_text();page=(local/'plugin-page.js').read_text()
if re.search(r'^(<<<<<<<|=======|>>>>>>>)',app+'\n'+page+'\n'+html,re.M):raise SystemExit('Маркеры конфликта; кабинет не изменён.')
# Replace only the cover preparation function, keeping local catalog/auth/connector fixes.
app,count=re.subn(r'^async function compressPluginCover\([^\n]*\) \{[\s\S]*?^\}\n', 'async function compressPluginCover(file) {\n  return preparePluginCover(file);\n}\n',app,flags=re.M)
if count!=1:raise SystemExit('Не найдена единственная функция подготовки обложки.')
if 'plugin-page-cover__frame' not in page:
    if page.count('<figure class="plugin-page-cover"><img')!=1 or page.count('decoding="async"><figcaption>')!=1:raise SystemExit('Неизвестная рамка обложки.')
    page=page.replace('<figure class="plugin-page-cover"><img','<figure class="plugin-page-cover"><div class="plugin-page-cover__frame"><img',1).replace('decoding="async"><figcaption>','decoding="async"></div><figcaption>',1)
if '<img data-plugin-cover data-plugin-cover-detail ' not in page:
    if page.count('<img data-plugin-cover ')!=1:raise SystemExit('Не найдено изображение подробной страницы.')
    page=page.replace('<img data-plugin-cover ', '<img data-plugin-cover data-plugin-cover-detail ',1)
marker='  root.innerHTML = pluginPageMarkup(plugin);\n'
hook="  if (typeof fitPluginDetailCover === 'function') root.querySelectorAll?.('img[data-plugin-cover-detail]')?.forEach(fitPluginDetailCover);\n"
if hook not in page:
    if page.count(marker)!=1:raise SystemExit('Не найдено отображение подробной страницы.')
    page=page.replace(marker,marker+hook,1)
for asset,tag,attribute in [('plugin-cover.js','script','src'),('plugin-cover.css','link','href')]:
    if len(re.findall(r'<'+tag+'[^>]+'+attribute+'="'+re.escape(asset),html))>1:raise SystemExit('Ассет загружен несколько раз: '+asset)
html=re.sub(r'^[ \t]*<script src="plugin-cover\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>\n?','',html,flags=re.M)
html=re.sub(r'^[ \t]*<link rel="stylesheet" href="plugin-cover\.css(?:\?v=[A-Za-z0-9_-]+)?">\n?','',html,flags=re.M)
version='20261004-detail-cover-quality'
html,count=re.subn(r'(^[ \t]*)(<script src="plugin-page\.js)(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)',lambda m:m[1]+'<script src="plugin-cover.js?v='+version+'" defer></script>\n'+m[1]+m[2]+'?v='+version+m[3],html,flags=re.M)
if count!=1:raise SystemExit('Не найден скрипт страницы плагина.')
html,count=re.subn(r'(<script src="app\.js)(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)',r'\1?v='+version+r'\2',html)
if count!=1:raise SystemExit('Не найден скрипт кабинета.')
html,count=re.subn(r'^([ \t]*)</head>',lambda m:m[1]+'  <link rel="stylesheet" href="plugin-cover.css?v='+version+'">\n'+m[0],html,flags=re.M)
if count!=1:raise SystemExit('Не найден head.')
if not(html.index('src="plugin-cover.js')<html.index('src="plugin-page.js')<html.index('src="app.js')):raise SystemExit('Неизвестный порядок загрузки скриптов.')
if not('href="plugin-page.css' in html and html.index('href="plugin-page.css')<html.index('href="plugin-cover.css')):raise SystemExit('Неизвестный порядок стилей.')
out.mkdir(parents=True,exist_ok=True)
for name,content in [('app.js',app),('plugin-page.js',page),('index.html',html)]:(out/name).write_text(content)
for name in ['plugin-cover.js','plugin-cover.css']:(out/name).write_bytes((incoming/name).read_bytes())
