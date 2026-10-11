"""Patch only verified snapshot functions, preserving live configuration and UI."""
from pathlib import Path
import re
import sys
VERSION='20261011-sync-pipeline-v2'

def block(source, start, end):
    if source.count(start)!=1 or source.count(end)!=1:
        raise ValueError('Не подтверждён участок синхронизации. Файлы не изменены.')
    a=source.index(start); b=source.index(end,a)
    return a,b

def stage(local, incoming, out):
    local, incoming, out = Path(local), Path(incoming), Path(out)
    html=(local/'index.html').read_text()
    if html.lower().count('</body>')!=1 or any(m not in html for m in ['data-overview','data-sidebar-trial','data-billing']):
        raise ValueError('Не подтверждена структура кабинета. Файлы не изменены.')
    if len(re.findall(r'<script\b[^>]*\bsrc=["\']app\.js(?:\?[^"\']*)?["\'][^>]*\bdefer\b',html,re.I))!=1:
        raise ValueError('Не подтверждён запуск кабинета. Файлы не изменены.')
    pattern=r'<script\b[^>]*\bsrc=["\']store-sync-deadline\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
    if len(re.findall(pattern,html,re.I))>1:
        raise ValueError('Найдено несколько модулей обновления. Файлы не изменены.')
    html=re.sub(pattern,'',html,flags=re.I)
    html=re.sub(r'[ \t]*</body>', f'<script src="store-sync-deadline.js?v={VERSION}" defer></script>\n</body>',html,count=1,flags=re.I)
    app=(local/'app.js').read_text(); new_app=(incoming/'app.js').read_text()
    start='// Share one read request';end='function renderTelegramOnboarding'
    a,b=block(app,start,end); c,d=block(new_app,start,end)
    old=app[a:b]
    if old.count('function syncStoreContent(')!=1 or old.count('async function readStoreContent(')!=1:
        raise ValueError('Не подтверждены функции обновления. Файлы не изменены.')
    app=app[:a]+new_app[c:d]+app[b:]
    old_signature="async function apiRequest(path, { method = 'GET', body, authenticated = false } = {}) {"
    new_signature="async function apiRequest(path, { method = 'GET', body, authenticated = false, signal } = {}) {"
    old_fetch="{ method, headers, body: body ? JSON.stringify(body) : undefined }"
    new_fetch="{ method, headers, body: body ? JSON.stringify(body) : undefined, signal }"
    for old,new in [(old_signature,new_signature),(old_fetch,new_fetch)]:
        if app.count(old)+app.count(new)!=1:
            raise ValueError('Не подтверждён клиент API. Файлы не изменены.')
        app=app.replace(old,new,1)
    reset='function resetAccountData() {'
    if app.count(reset)!=1: raise ValueError('Не подтверждён сброс кабинета. Файлы не изменены.')
    addition="\n  storeContentSyncFlight?.cancel();\n  if (typeof overviewState !== 'undefined') Object.assign(overviewState, {busy:false, request:null, error:''});"
    app=app.replace(reset+addition,reset,1)
    app=app.replace(reset+'\n  storeContentSyncFlight?.cancel();',reset,1)
    app=app.replace(reset,reset+addition,1)
    overview=(local/'overview.js').read_text(); new_overview=(incoming/'overview.js').read_text()
    start='async function refreshOverview()';end="document.addEventListener('click'"
    a,b=block(overview,start,end);c,d=block(new_overview,start,end)
    overview=overview[:a]+new_overview[c:d]+overview[b:]
    outputs={'index.html':html,'app.js':app,'overview.js':overview,'store-sync-deadline.js':(incoming/'store-sync-deadline.js').read_text()}
    for name in ['app.js','overview.js']:
        pattern=r'(\bsrc=["\'])'+re.escape(name)+r'(?:\?[^"\']*)?(["\'])'
        if len(re.findall(pattern,html))!=1: raise ValueError('Не подтверждены подключения скриптов. Файлы не изменены.')
        html=re.sub(pattern,lambda m:m[1]+name+'?v='+VERSION+m[2],html)
    outputs['index.html']=html
    if any(re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M) for text in outputs.values()):
        raise ValueError('В кабинете конфликт. Файлы не изменены.')
    out.mkdir(parents=True,exist_ok=True)
    for name,text in outputs.items(): (out/name).write_text(text)

if __name__=='__main__':
    try: stage(*sys.argv[1:])
    except (OSError,ValueError) as e: raise SystemExit(str(e))
