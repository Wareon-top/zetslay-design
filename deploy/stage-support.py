"""Preserve the live cabinet while adding support routes and owner queue."""
from pathlib import Path
import re
import sys
VERSION='20261020-support-bubbles'
ASSETS=['support.js','support.css','admin-panel.js','admin-finance.js','admin-finance.css']
NAV='<button class="nav-item" type="button" data-view-target="support"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H3v6h4v-6H4Zm16 0h1v6h-4v-6h3Zm0 6c0 3-3 3-6 3"/></svg><span>Поддержка</span><b class="sup-nav-unread" data-support-unread hidden></b></button>'
SECTION='<section class="view support-page" data-view="support" hidden><div data-support-root="user"></div></section>'
def patch_app(app):
    edits=[("  admin: 'Админ-панель',", "  admin: 'Админ-панель', support: 'Поддержка',"),
      ("  if (typeof adminAccess === 'function') adminAccess();", "  if (typeof adminAccess === 'function') adminAccess();\n  if (typeof supportAuth === 'function') supportAuth();"),
      ('function resetAccountData() {',"function resetAccountData() {\n  if (typeof supportReset === 'function') supportReset();"),
      ("  if (typeof adminRoute === 'function') adminRoute(resolvedView);", "  if (typeof adminRoute === 'function') adminRoute(resolvedView);\n  if (typeof supportRoute === 'function') supportRoute(resolvedView);")]
    for old,new in edits:
        if new in app:
            if app.count(new)!=1: raise ValueError('Дубли интеграции поддержки')
        elif app.count(old)==1: app=app.replace(old,new,1)
        else: raise ValueError('Не подтверждена интеграция поддержки. Файлы не изменены.')
    return app
def stage(local,incoming,out):
    local,incoming,out=map(Path,(local,incoming,out));html=(local/'index.html').read_text();app=patch_app((local/'app.js').read_text())
    if html.count('</head>')!=1 or 'data-admin-root' not in html or re.search(r'^(<<<<<<<|=======|>>>>>>>)',html,re.M): raise ValueError('Не подтверждена структура кабинета')
    if 'data-view-target="support"' not in html:
        matches=list(re.finditer(r'<button\b[^>]*data-view-target="guide"[^>]*>.*?</button>',html,re.S))
        if len(matches)!=1: raise ValueError('Не найдена навигация кабинета')
        html=html[:matches[0].end()]+'\n          '+NAV+html[matches[0].end():]
    elif html.count(NAV)!=1: raise ValueError('Неизвестная навигация поддержки')
    if 'data-support-root="user"' not in html:
        anchor='<section class="view admin-page"'
        if html.count(anchor)!=1: raise ValueError('Не найдена админ-панель')
        html=html.replace(anchor,SECTION+'\n          '+anchor,1)
    elif html.count(SECTION)!=1: raise ValueError('Неизвестная разметка поддержки')
    panel=r'<script\b[^>]*src=["\']admin-panel\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
    if len(re.findall(panel,html))!=1: raise ValueError('Не подтверждён модуль админ-панели')
    for asset in ['support.js','admin-finance.js']:
        pattern=r'<script\b[^>]*src=["\']'+re.escape(asset)+r'(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
        if len(re.findall(pattern,html))>1: raise ValueError('Дублируется '+asset)
        html=re.sub(pattern,'',html)
    html=re.sub(panel,f'<script src="admin-finance.js?v={VERSION}" defer></script>\n    <script src="support.js?v={VERSION}" defer></script>\n    <script src="admin-panel.js?v={VERSION}" defer></script>',html)
    for asset in ['support.css','admin-finance.css']:
        pattern=r'<link\b[^>]*href=["\']'+re.escape(asset)+r'(?:\?[^"\']*)?["\'][^>]*>'
        if len(re.findall(pattern,html))>1: raise ValueError('Дублируется '+asset)
        html=re.sub(pattern,'',html).replace('</head>',f'<link rel="stylesheet" href="{asset}?v={VERSION}">\n</head>',1)
    html,count=re.subn(r'(src=["\'])app\.js(?:\?[^"\']*)?(["\'])',lambda m:m[1]+'app.js?v='+VERSION+m[2],html)
    if count!=1 or html.index('src="support.js')>html.index('src="app.js'): raise ValueError('Не подтверждён порядок запуска кабинета')
    for name in ASSETS:
        if not (incoming/name).is_file():raise ValueError('Нет ресурса '+name)
    out.mkdir(parents=True,exist_ok=True);(out/'index.html').write_text(html);(out/'app.js').write_text(app)
    for name in ASSETS:(out/name).write_bytes((incoming/name).read_bytes())
if __name__=='__main__':
    try:stage(*sys.argv[1:])
    except (OSError,ValueError) as error:raise SystemExit(str(error))
