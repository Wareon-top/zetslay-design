#!/usr/bin/env python3
"""Stage only Review Reminder hooks; preserve the cabinet, auth and connector."""
from pathlib import Path
import re
import sys

HOOK="      ${plugin.id === 'zetslay.review-reminder' && typeof reviewSettingsMarkup === 'function' ? reviewSettingsMarkup(plugin) : ''}\n"
BUTTON="${plugin.id === 'zetslay.review-reminder' && plugin.installed && typeof reviewSettingsMarkup === 'function' ? `<button class=\"plugin-page-settings\" type=\"button\" data-review-open-settings>${icon('gear')} Настройки отзывов</button>` : ''}"
JUMP="""  const reviewSettings = event.target.closest('[data-review-open-settings]');
  if (reviewSettings) {
    const panel = document.querySelector('[data-review-panel]');
    panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel?.querySelector('input, select, textarea')?.focus({ preventScroll: true });
    return;
  }
"""
OLD_PERMISSION='Предлагать ответы. Confirm Reminder может отправлять свои напоминания после отдельного разрешения.'
NEW_PERMISSION='Предлагать ответы. Confirm Reminder и Review Reminder отправляют свои напоминания после отдельного разрешения.'
OLD_CONTEXT="${plugin.id === 'zetslay.confirm-reminder' ? 'Отправка включается отдельно. Перед каждым напоминанием проверяется заказ; после подтверждения или возврата сообщения прекращаются.' : 'Предложенные ответы этого модуля поступают в очередь. Автоматическая доставка доступна только для Confirm Reminder после отдельного разрешения.'}"
NEW_CONTEXT="${plugin.id === 'zetslay.review-reminder' ? 'Перед каждым напоминанием проверяется отзыв и статус заказа. Отзыв или возврат отменяет оставшиеся отправки.' : plugin.id === 'zetslay.confirm-reminder' ? 'Отправка включается отдельно. Перед каждым напоминанием проверяется заказ; после подтверждения или возврата сообщения прекращаются.' : 'Предложенные ответы этого модуля поступают в очередь. Автоматическая доставка доступна для Confirm Reminder и Review Reminder после отдельного разрешения.'}"


def require(condition,message):
    if not condition: raise ValueError(message+'. Кабинет не изменён.')


def stage(local,incoming,output):
    local,incoming,output=map(Path,[local,incoming,output])
    page=(local/'plugin-page.js').read_text()
    html=(local/'index.html').read_text()
    for text in [page,html]:require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M),'Найдены маркеры слияния')
    require('reminderSettingsMarkup' in page,'Сначала установите настройки Confirm Reminder')
    for marker,hook in [('    </div><aside class="plugin-page-sidebar"',HOOK),('${configuration && plugin.installed ?',BUTTON),("  const settings = event.target.closest('[data-plugin-open-settings]');",JUMP)]:
        require(page.count(marker)==1,'Не найдена единственная точка вставки')
        if hook not in page:
            require('reviewSettingsMarkup' not in page if hook==HOOK else 'const reviewSettings =' not in page if hook==JUMP else 'data-review-open-settings' not in page,'Неизвестная локальная интеграция отзывов')
            page=page.replace(marker,hook+marker,1)
        require(page.count(hook)==1,'Дублируется модуль Review Reminder')
    for old,new in [(OLD_PERMISSION,NEW_PERMISSION),(OLD_CONTEXT,NEW_CONTEXT)]:
        if old in page:require(page.count(old)==1,'Неоднозначный текст разрешений');page=page.replace(old,new,1)
        else:require(new in page,'Неизвестный текст разрешений')
    version='20261004-review-reminder'
    for asset,tag in [('review-reminder.js','script'),('review-reminder.css','link')]:
        html=re.sub(r'^[ \t]*<(?:script|link)[^>]+(?:src|href)="'+re.escape(asset)+r'(?:\?v=[A-Za-z0-9_-]+)?"[^>]*>(?:</script>)?\n?','',html,flags=re.M)
    html,count=re.subn(r'^([ \t]*)<script src="plugin-page\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>',lambda m:f'{m[1]}<script src="review-reminder.js?v={version}" defer></script>\n{m[1]}<script src="plugin-page.js?v={version}" defer></script>',html,flags=re.M)
    require(count==1,'Не найдена загрузка plugin-page.js')
    html,count=re.subn(r'^([ \t]*)</head>',lambda m:f'{m[1]}  <link rel="stylesheet" href="review-reminder.css?v={version}">\n{m[0]}',html,flags=re.M)
    require(count==1,'Не найден конец head')
    require('confirm-reminder.js' in html and 'confirm-reminder.css' in html,'Не найдены общие стили и настройки напоминаний')
    output.mkdir(parents=True,exist_ok=True)
    (output/'plugin-page.js').write_text(page)
    (output/'index.html').write_text(html)
    (output/'app.js').write_bytes((local/'app.js').read_bytes())
    for name in ['review-reminder.js','review-reminder.css','review-reminder.test.mjs','plugin-page.test.mjs']:
        (output/name).write_bytes((incoming/name).read_bytes())
    for module in ['confirm-reminder','plugin-cover','overview','orders','messages']:
        for suffix in ['.js','.css','.test.mjs']:
            name=module+suffix
            if (local/name).is_file():
                if suffix=='.test.mjs':
                    (output/name).write_text((local/name).read_text().replace(r'/\ninit\(\);\s*$/',r'/^init\(\);[ \t]*$/m'))
                else:(output/name).write_bytes((local/name).read_bytes())
    p=output/'plugin-page.test.mjs'
    p.write_text(p.read_text().replace(r'/\ninit\(\);\s*$/',r'/^init\(\);[ \t]*$/m'))


if __name__=='__main__':
    try:stage(*sys.argv[1:])
    except (ValueError,OSError) as error:raise SystemExit(str(error))
