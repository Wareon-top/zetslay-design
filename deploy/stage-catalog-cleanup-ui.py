from pathlib import Path
import re,sys
local,incoming,out=map(Path,sys.argv[1:])
app=(local/'app.js').read_text();html=(local/'index.html').read_text();page=(local/'plugin-page.js').read_text()
if re.search(r'^(<<<<<<<|=======|>>>>>>>)',app+'\n'+html+'\n'+page,re.M):raise SystemExit('Маркеры конфликта; кабинет не изменён.')
old="  const visible = state.plugins.filter(plugin => plugin.published !== false || canManagePluginCatalog());"
new="  const visible = state.plugins.filter(plugin => !plugin.planned && !String(plugin.id).startsWith('planned.') && (plugin.published !== false || canManagePluginCatalog()));"
if new not in app:
    if app.count(old)!=1:raise SystemExit('Неизвестная фильтрация каталога; кабинет не изменён.')
    app=app.replace(old,new,1)
app=re.sub(r"^\s*\{ id: 'planned\.[^\n]+\n",'',app,flags=re.M)
audit="async function loadPluginAudit() {\n"
if audit not in app:raise SystemExit('Не найдена загрузка журнала.')
guard="  if (!byId('plugin-audit-list')) return;\n"
if audit+guard not in app:app=app.replace(audit,audit+guard,1)
reset=re.search(r'function resetPluginCatalog\(\) \{[\s\S]*?\n\}',app)
if not reset:raise SystemExit('Не найден сброс каталога.')
close="  document.querySelector('[data-plugin-settings-dialog]')?.close();\n"
if close not in reset[0]:app=app[:reset.start()]+reset[0].replace('  closePluginDialog();\n','  closePluginDialog();\n'+close,1)+app[reset.end():]
lab=re.search(r'\s*<section class="plugin-lab panel"[^>]*>[\s\S]*?(?=\s*<section class="plugin-audit)',html)
if lab:
    forms=[]
    for selector in ['data-plugin-settings','data-telegram-settings']:
        matches=re.findall(r'<form\b[^>]*\b'+selector+r'(?:\s|>)[\s\S]*?</form>',lab[0])
        if len(matches)!=1:raise SystemExit('Не удалось сохранить форму '+selector)
        forms.append(matches[0])
    if 'data-plugin-settings-dialog' in html:raise SystemExit('Настройки продублированы; кабинет не изменён.')
    dialog='''    <dialog class="plugin-dialog plugin-settings-dialog" data-plugin-settings-dialog aria-labelledby="plugin-settings-title">
      <header class="plugin-dialog__header"><h2 id="plugin-settings-title" data-plugin-settings-title>Настройки плагина</h2><button class="icon-button" type="button" data-plugin-settings-close aria-label="Закрыть настройки"><svg><use href="#i-close"/></svg></button></header>
      '''+'\n      '.join(forms)+'''
    </dialog>
'''
    html=html[:lab.start()]+html[lab.end():]
    anchor='    <dialog class="plugin-dialog" data-plugin-dialog'
    if html.count(anchor)!=1:raise SystemExit('Не найдено место для окна настроек.')
    html=html.replace(anchor,dialog+anchor,1)
elif 'data-plugin-settings-dialog' not in html:raise SystemExit('Неизвестная структура песочницы; кабинет не изменён.')
html=re.sub(r'\s*<section class="plugin-audit panel"[^>]*>[\s\S]*?</section>','',html)
html=html.replace('Расширения с явными разрешениями, безопасным отключением и журналом действий.','Рабочие модули для автоматизации вашего магазина.')
html=html.replace('Каталог расширений с прозрачными разрешениями и безопасной песочницей.','Выберите плагин, откройте описание и настройте его под свой магазин.')
if 'data-plugin-simulator' in html or 'plugin-audit-list' in html or 'Безопасная песочница' in html:raise SystemExit('Не удалось полностью удалить старые блоки.')
route="  const plugin = state.plugins.find(item => item.id === route.id && (item.published !== false || canManagePluginCatalog()));"
route_new="  const plugin = state.plugins.find(item => item.id === route.id && !item.planned && !String(item.id).startsWith('planned.') && (item.published !== false || canManagePluginCatalog()));"
if route_new not in page:
    if page.count(route)!=1:raise SystemExit('Неизвестный поиск страницы плагина.')
    page=page.replace(route,route_new,1)
page=page.replace('Настройки и журнал ${icon(\'chevron-right\')}','Каталог плагинов ${icon(\'chevron-right\')}')
settings="""  // CATALOG_CLEANUP_SETTINGS
  const closeSettings = event.target.closest('[data-plugin-settings-close]');
  if (closeSettings) {
    document.querySelector('[data-plugin-settings-dialog]')?.close();
    return;
  }
  const settings = event.target.closest('[data-plugin-open-settings]');
  if (settings) {
    const selector = settings.dataset.pluginOpenSettings;
    if (!['[data-plugin-settings]', '[data-telegram-settings]'].includes(selector)) return;
    const dialog = document.querySelector('[data-plugin-settings-dialog]');
    const form = dialog?.querySelector(selector);
    if (!form || !authState.user) return;
    dialog.querySelectorAll('form').forEach(item => { item.hidden = item !== form; });
    dialog.querySelector('[data-plugin-settings-title]').textContent = selector === '[data-plugin-settings]' ? 'Настройки автоответчика' : 'Настройки Telegram-уведомлений';
    if (!dialog.open) dialog.showModal();
    form.querySelector('textarea, input, select')?.focus({ preventScroll: true });
  }
});"""
pattern=r"(?:  // CATALOG_CLEANUP_SETTINGS[\s\S]*?)?  const settings = event.target.closest\('\[data-plugin-open-settings\]'\);[\s\S]*?\n  \}\n\}\);"
page,count=re.subn(pattern,lambda _:settings,page,count=1)
if count!=1:raise SystemExit('Неизвестный переход в настройки плагина.')
for file in ['app.js','plugin-page.js']:
    html,count=re.subn(r'(<script src="'+re.escape(file)+r')(?:\?v=[A-Za-z0-9_-]+)?(" defer></script>)',r'\1?v=20261004-catalog-cleanup\2',html)
    if count!=1:raise SystemExit('Не найден скрипт '+file)
out.mkdir(parents=True,exist_ok=True)
for file,content in [('app.js',app),('index.html',html),('plugin-page.js',page)]:(out/file).write_text(content)
