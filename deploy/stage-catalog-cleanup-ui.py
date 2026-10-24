from pathlib import Path
import re,sys
local,incoming,out=map(Path,sys.argv[1:])
app=(local/'app.js').read_text();html=(local/'index.html').read_text();page=(local/'plugin-page.js').read_text()
if re.search(r'^(<<<<<<<|=======|>>>>>>>)',app+'\n'+html+'\n'+page,re.M):raise SystemExit('Маркеры конфликта; кабинет не изменён.')
blocked="!['zetslay.auto-reply', 'zetslay.telegram-notifications'].includes(plugin.id)"
old=["  const visible = state.plugins.filter(plugin => plugin.published !== false || canManagePluginCatalog());", "  const visible = state.plugins.filter(plugin => !plugin.planned && !String(plugin.id).startsWith('planned.') && (plugin.published !== false || canManagePluginCatalog()));"]
new="  const visible = state.plugins.filter(plugin => !plugin.planned && !String(plugin.id).startsWith('planned.') && "+blocked+" && (plugin.published !== false || canManagePluginCatalog()));"
if new not in app:
    matches=[text for text in old if app.count(text)==1]
    if len(matches)!=1:raise SystemExit('Неизвестная фильтрация каталога; кабинет не изменён.')
    app=app.replace(matches[0],new,1)
app=re.sub(r"^\s*\{ id: '(?:planned\.[^']+|zetslay\.auto-reply|zetslay\.telegram-notifications)'[^\n]+\n",'',app,flags=re.M)
old_action="  if (!plugin || plugin.planned || plugin.published === false) return;"
new_action="  if (!plugin || plugin.planned || ['zetslay.auto-reply', 'zetslay.telegram-notifications'].includes(plugin.id) || plugin.published === false) return;"
if new_action not in app:
    if app.count(old_action)!=1:raise SystemExit('Неизвестный обработчик установки.')
    app=app.replace(old_action,new_action,1)
audit="async function loadPluginAudit() {\n"
if audit not in app:raise SystemExit('Не найдена загрузка журнала.')
guard="  if (!byId('plugin-audit-list')) return;\n"
if audit+guard not in app:app=app.replace(audit,audit+guard,1)
app=app.replace("  document.querySelector('[data-plugin-settings-dialog]')?.close();\n",'')
# Delete the former sandbox and its simulator/settings. Supports pre-cleanup VPS files.
html=re.sub(r'\s*<section class="plugin-lab panel"[^>]*>[\s\S]*?(?=\s*<section class="plugin-audit)', '', html)
html=re.sub(r'\s*<section class="plugin-audit panel"[^>]*>[\s\S]*?</section>','',html)
# Delete the settings dialog introduced by the first cleanup, if already installed.
html=re.sub(r'\s*<dialog\b[^>]*\bdata-plugin-settings-dialog\b[^>]*>[\s\S]*?</dialog>', '',html)
html=html.replace('Расширения с явными разрешениями, безопасным отключением и журналом действий.','Рабочие модули для автоматизации вашего магазина.')
html=html.replace('Каталог расширений с прозрачными разрешениями и безопасной песочницей.','Выберите плагин, откройте описание и настройте его под свой магазин.')
html=re.sub(r'(<span id="plugin-total">)[^<]*(</span>)',r'\g<1>0 доступно\2',html)
if any(marker in html for marker in ['data-plugin-simulator','plugin-audit-list','Безопасная песочница','data-plugin-settings','data-telegram-settings']):raise SystemExit('Не удалось полностью удалить старые блоки.')
routes=["  const plugin = state.plugins.find(item => item.id === route.id && (item.published !== false || canManagePluginCatalog()));", "  const plugin = state.plugins.find(item => item.id === route.id && !item.planned && !String(item.id).startsWith('planned.') && (item.published !== false || canManagePluginCatalog()));"]
route_new="  const plugin = state.plugins.find(item => item.id === route.id && !item.planned && !String(item.id).startsWith('planned.') && !['zetslay.auto-reply', 'zetslay.telegram-notifications'].includes(item.id) && (item.published !== false || canManagePluginCatalog()));"
if route_new not in page:
    matches=[text for text in routes if page.count(text)==1]
    if len(matches)!=1:raise SystemExit('Неизвестный поиск страницы плагина.')
    page=page.replace(matches[0],route_new,1)
page=page.replace('Настройки и журнал ${icon(\'chevron-right\')}','Каталог плагинов ${icon(\'chevron-right\')}')
page=re.sub(r"  const configuration = plugin.id === 'zetslay.auto-reply'[^\n]+\n", "  const configuration = '';\n",page)
# Remove the obsolete settings click handler, retaining reminder controls and other addons.
if '// CATALOG_CLEANUP_SETTINGS' in page:
    page,count=re.subn(r'  // CATALOG_CLEANUP_SETTINGS[\s\S]*?\n\}\);', '});',page,count=1)
    if count!=1:raise SystemExit('Неизвестный обработчик окна настроек.')
else:
    page=re.sub(r"  const settings = event.target.closest\('\[data-plugin-open-settings\]'\);[\s\S]*?\n  \}\n\}\);",'});',page,count=1)
for file in ['app.js','plugin-page.js']:
    html,count=re.subn(r'(<script src="'+re.escape(file)+r')(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)',r'\1?v=20261004-catalog-cleanup-v2\2',html)
    if count!=1:raise SystemExit('Не найден скрипт '+file)
out.mkdir(parents=True,exist_ok=True)
for file,content in [('app.js',app),('index.html',html),('plugin-page.js',page)]:(out/file).write_text(content)
