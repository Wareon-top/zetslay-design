#!/usr/bin/env python3
"""Patch plugin-page hooks only. Retain API URL, brand, views and local app.js."""
from pathlib import Path
import re
import sys

HOOK="      ${plugin.id === 'zetslay.confirm-reminder' && typeof reminderSettingsMarkup === 'function' ? reminderSettingsMarkup(plugin) : ''}\n"
OLD_PERMISSION='Предлагать текст ответа; отправка на FunPay сейчас отключена.'
NEW_PERMISSION='Предлагать ответы. Confirm Reminder может отправлять свои напоминания после отдельного разрешения.'
OLD_CONTEXT='Предложенные ответы поступают в очередь; отправка на FunPay сейчас отключена.'
NEW_CONTEXT="${plugin.id === 'zetslay.confirm-reminder' ? 'Отправка включается отдельно. Перед каждым напоминанием проверяется заказ; после подтверждения или возврата сообщения прекращаются.' : 'Предложенные ответы этого модуля поступают в очередь. Автоматическая доставка доступна только для Confirm Reminder после отдельного разрешения.'}"
REMINDER_BUTTON="${plugin.id === 'zetslay.confirm-reminder' && plugin.installed && typeof reminderSettingsMarkup === 'function' ? `<button class=\"plugin-page-settings\" type=\"button\" data-reminder-open-settings>${icon('gear')} Настройки напоминаний</button>` : ''}"
REMINDER_JUMP="""  const reminderSettings = event.target.closest('[data-reminder-open-settings]');
  if (reminderSettings) {
    const panel = document.querySelector('[data-reminder-panel]');
    panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel?.querySelector('select, input, textarea')?.focus({ preventScroll: true });
    return;
  }
"""

def require(condition,message):
    if not condition: raise ValueError(message+'. Кабинет не изменён.')

def stage(local,incoming,output):
    local,incoming,output=map(Path,[local,incoming,output])
    page=(local/'plugin-page.js').read_text()
    html=(local/'index.html').read_text()
    for text in [page,html]: require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M),'Найдены маркеры конфликта')
    require('function pluginPageMarkup(plugin)' in page,'Сначала нужен модуль подробных страниц плагинов')
    boundary='    </div><aside class="plugin-page-sidebar"'
    require(page.count(boundary)==1,'Не найдена граница страницы плагина')
    if HOOK not in page:
        require('reminderSettingsMarkup' not in page,'Неизвестная локальная интеграция напоминаний')
        page=page.replace(boundary,HOOK+boundary,1)
    for old,new in [(OLD_PERMISSION,NEW_PERMISSION),(OLD_CONTEXT,NEW_CONTEXT)]:
        if old in page:
            require(page.count(old)==1,'Неоднозначный текст страницы плагина')
            page=page.replace(old,new,1)
        else: require(new in page,'Неизвестный локальный текст разрешений')
    require(page.count(HOOK)==1,'Дублируется модуль напоминаний')
    action="${configuration && plugin.installed ?"
    listener="  const settings = event.target.closest('[data-plugin-open-settings]');"
    require(page.count(action)==1 and page.count(listener)==1,'Не найдены кнопки настроек плагина')
    if REMINDER_BUTTON not in page:
        require('data-reminder-open-settings' not in page,'Неизвестная локальная кнопка настроек напоминаний')
        page=page.replace(action,REMINDER_BUTTON+action,1)
    if REMINDER_JUMP not in page:
        require("const reminderSettings =" not in page,'Неизвестный переход к настройкам напоминаний')
        page=page.replace(listener,REMINDER_JUMP+listener,1)
    require(page.count(REMINDER_BUTTON)==1 and page.count(REMINDER_JUMP)==1,'Дублируется переход к настройкам')
    html=re.sub(r'^[ \t]*<script src="confirm-reminder\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>\n?','',html,flags=re.M)
    html=re.sub(r'^[ \t]*<link rel="stylesheet" href="confirm-reminder\.css(?:\?v=[A-Za-z0-9_-]+)?">\n?','',html,flags=re.M)
    version='20261003-reminder-settings'
    html,count=re.subn(r'^([ \t]*)<script src="plugin-page\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>',lambda m:f'{m[1]}<script src="confirm-reminder.js?v={version}" defer></script>\n{m[1]}<script src="plugin-page.js?v={version}" defer></script>',html,flags=re.M)
    require(count==1,'Не найдена единственная загрузка plugin-page.js')
    html,count=re.subn(r'^([ \t]*)</head>',lambda m:f'{m[1]}  <link rel="stylesheet" href="confirm-reminder.css?v={version}">\n{m[0]}',html,flags=re.M)
    require(count==1,'Не найден конец head')
    output.mkdir(parents=True,exist_ok=True)
    (output/'plugin-page.js').write_text(page)
    (output/'index.html').write_text(html)
    for name in ['confirm-reminder.js','confirm-reminder.css','confirm-reminder.test.mjs']:
        (output/name).write_bytes((incoming/name).read_bytes())
    (output/'app.js').write_bytes((local/'app.js').read_bytes())
    for module in ['plugin-cover','plugin-page','overview','orders','messages']:
        for suffix in ['.js','.test.mjs','.css']:
            name=module+suffix
            if name!='plugin-page.js' and (local/name).is_file():
                if suffix=='.test.mjs':
                    # Existing harnesses suppress init only at EOF. Local VPS
                    # comments can follow it; suppress that exact call line in
                    # the staged harness only, never edit served app.js/tests.
                    text=(local/name).read_text().replace(r'/\ninit\(\);\s*$/',r'/^init\(\);[ \t]*$/m')
                    (output/name).write_text(text)
                else: (output/name).write_bytes((local/name).read_bytes())

if __name__=='__main__':
    try:
        require(len(sys.argv)==4,'Нужны local, incoming, output')
        stage(*sys.argv[1:])
    except (ValueError,OSError) as error:
        print(error,file=sys.stderr);sys.exit(1)
