"""Add admin navigation/hooks without replacing the customized cabinet."""
from pathlib import Path
import re
import sys
VERSION='20261008-admin-panel'

def once(text, anchor, replacement, label):
    if replacement in text:
        if text.count(replacement)!=1: raise ValueError('Неизвестная интеграция: '+label)
        return text
    if text.count(anchor)!=1: raise ValueError('Не подтверждена структура: '+label+'. Кабинет не изменён.')
    return text.replace(anchor,replacement,1)

def stage(local,incoming,out):
    app=(local/'app.js').read_text()
    html=(local/'index.html').read_text()
    for name,text in [('app.js',app),('index.html',html)]:
        if re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M):raise ValueError('Конфликт в '+name+'. Кабинет не изменён.')
    app=once(app,"const viewTitles = {","const viewTitles = {\n  admin: 'Админ-панель',",'названия разделов')
    for function,hook in [('resetAccountData','adminReset'),('renderAuthState','adminAccess')]:
        anchor='function '+function+'() {'
        replacement=anchor+"\n  if (typeof "+hook+" === 'function') "+hook+'();'
        app=once(app,anchor,replacement,function)
    anchor="  if (typeof renderPluginPage === 'function') renderPluginPage();\n  window.scrollTo"
    app=once(app,anchor,"  if (typeof adminRoute === 'function') adminRoute(resolvedView);\n"+anchor,'маршрут')
    nav='<button class="nav-item" type="button" data-admin-nav data-view-target="admin" hidden><svg><use href="#i-shield"/></svg><span>Админ-панель</span></button>'
    if 'data-admin-nav' not in html:
        # A verified guide button identifies the main sidebar navigation, not other navs.
        m=list(re.finditer(r'<button\b[^>]*data-view-target="guide"[^>]*>.*?</button>',html,re.S))
        if len(m)!=1:raise ValueError('Не подтверждена боковая панель. Кабинет не изменён.')
        html=html[:m[0].end()]+'\n          '+nav+html[m[0].end():]
    elif html.count(nav)!=1:raise ValueError('Неизвестная кнопка админ-панели. Кабинет не изменён.')
    section='<section class="view admin-page" data-view="admin" hidden><div data-admin-root></div></section>'
    if 'data-admin-root' not in html:
        anchor='<section class="view billing-page"'
        html=once(html,anchor,section+'\n          '+anchor,'контент кабинета')
    elif html.count(section)!=1:raise ValueError('Неизвестная разметка админ-панели. Кабинет не изменён.')
    pattern=r'<script\b[^>]*src=["\']app\.js(?:\?[^"\']*)?["\'][^>]*>'
    matches=list(re.finditer(pattern,html))
    if len(matches)!=1 or 'defer' not in matches[0].group():raise ValueError('Не подтверждён запуск app.js. Кабинет не изменён.')
    module=r'<script\b[^>]*src=["\']admin-panel\.js(?:\?[^"\']*)?["\'][^>]*>'
    if not re.search(module,html):html=re.sub(pattern,lambda m:'<script src="admin-panel.js?v='+VERSION+'" defer></script>\n    '+m.group(),html)
    matches=list(re.finditer(module,html))
    if len(matches)!=1 or matches[0].start()>re.search(pattern,html).start() or 'defer' not in matches[0].group():raise ValueError('Не подтверждён порядок admin-panel.js. Кабинет не изменён.')
    html=re.sub(module,'<script src="admin-panel.js?v='+VERSION+'" defer>',html)
    html=re.sub(pattern,'<script src="app.js?v='+VERSION+'" defer>',html)
    style=r'<link\b[^>]*href=["\']admin-panel\.css(?:\?[^"\']*)?["\'][^>]*>'
    styles=list(re.finditer(style,html))
    if len(styles)>1 or html.count('</head>')!=1:raise ValueError('Не подтверждена структура index.html. Кабинет не изменён.')
    tag='<link rel="stylesheet" href="admin-panel.css?v='+VERSION+'">'
    html=re.sub(style,tag,html) if styles else html.replace('</head>','    '+tag+'\n  </head>')
    out.mkdir(parents=True,exist_ok=True)
    (out/'app.js').write_text(app)
    (out/'index.html').write_text(html)
    for name in ['admin-panel.js','admin-panel.css']:(out/name).write_bytes((incoming/name).read_bytes())

if __name__=='__main__':
    try:stage(*(Path(v) for v in sys.argv[1:]))
    except (ValueError,OSError) as e:print(str(e),file=sys.stderr);sys.exit(1)
