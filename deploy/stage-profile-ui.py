"""Patch account UI only; preserve VPS catalog, connector and local configuration."""
from pathlib import Path
import re,sys

def require(ok,message):
    if not ok:raise ValueError(message+'. Кабинет не изменён.')

def edit_function(source,name,edit):
    matches=list(re.finditer(r'^(?:async )?function '+name+r'\([^\n]*\) \{.*?^\}\n',source,re.M|re.S))
    require(len(matches)==1,'Не найдена функция '+name)
    match=matches[0]
    return source[:match.start()]+edit(match.group())+source[match.end():]

def replace_once(value,old,new,label):
    if new in value:return value
    require(value.count(old)==1,'Неизвестная локальная правка: '+label)
    return value.replace(old,new,1)

def hook(value,code,first=False):
    if code in value:return value
    if first:return value.replace(' {\n',' {\n'+code+'\n',1)
    return value[:-2]+code+'\n}\n'

def stage(local,incoming,out):
    app=(local/'app.js').read_text();html=(local/'index.html').read_text()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',app+'\n'+html,re.M),'Маркеры конфликта')
    app=replace_once(app,"  guide: 'База знаний',","  guide: 'База знаний', profile: 'Профиль', author: 'Карточка автора',",'названия разделов')
    app=edit_function(app,'resetAccountData',lambda s:hook(s,"  if (typeof resetProfileState === 'function') resetProfileState();",True))
    for name in ['renderAuthState','renderStoreFleet','renderTelegramOnboarding']:
        app=edit_function(app,name,lambda s:hook(s,"  if (typeof renderProfile === 'function') renderProfile();"))
    app=edit_function(app,'loadAccountData',lambda s:replace_once(s,'  const results = await Promise.allSettled(tasks.map((task) => task()));',"  if (typeof loadProfile === 'function') tasks.push(loadProfile);\n  const results = await Promise.allSettled(tasks.map((task) => task()));",'загрузка данных аккаунта'))
    def navigation(s):
        s=hook(s,"  viewName = typeof normalizeProfileRoute === 'function' ? normalizeProfileRoute(viewName) : viewName;\n  const authorId = typeof parseAuthorRoute === 'function' ? parseAuthorRoute(viewName) : null;",True)
        s=replace_once(s,"const resolvedView = route ? 'plugin' : viewTitles[viewName] ? viewName : 'dashboard';","const resolvedView = authorId ? 'author' : route ? 'plugin' : viewTitles[viewName] ? viewName : 'dashboard';",'маршрут профиля')
        s=replace_once(s,'`#${route ? viewName : resolvedView}`','`#${route || authorId ? viewName : resolvedView}`','ссылка на автора')
        return hook(s,"  if (typeof renderProfileRoute === 'function') renderProfileRoute(authorId ? viewName : resolvedView);")
    app=edit_function(app,'setView',navigation)
    app=edit_function(app,'bindInteractions',lambda s:replace_once(s,"if (event.target.closest('[data-auth-open]')) { setAuthModal(true); return; }","if (event.target.closest('[data-auth-open]')) { if (authState.user) setView('profile'); else setAuthModal(true); return; }",'кнопка аккаунта'))
    # Remove just the two old views, not their existing wizard API handlers.
    for view in ['telegram','security']:
        pattern=r'^[ \t]*<section class="view" data-view="'+view+r'".*?(?=^[ \t]*<section class="view"|^[ \t]*</div>\n[ \t]*</main>)'
        html,n=re.subn(pattern,'',html,flags=re.M|re.S)
        require(n<=1,'Дублируется старый раздел '+view)
        require('data-view="'+view+'"' not in html,'Неизвестная разметка '+view)
        html,n=re.subn(r'^[ \t]*<button class="nav-item"[^\n]*data-view-target="'+view+r'"[^\n]*</button>\n?','',html,flags=re.M)
        require(n<=1,'Дублируется пункт меню '+view)
    if 'data-view-target="profile"' not in html:
        require(html.count('<button class="nav-item" type="button" data-view-target="guide">')==1,'Не найдена позиция меню')
        html=html.replace('<button class="nav-item" type="button" data-view-target="guide">','<button class="nav-item" type="button" data-view-target="profile"><svg><use href="#i-user"/></svg><span>Профиль</span></button>\n          <button class="nav-item" type="button" data-view-target="guide">',1)
    if 'data-view="profile"' not in html:
        require(html.count('<section class="view" data-view="guide"')==1,'Не найдена позиция страницы')
        html=html.replace('<section class="view" data-view="guide"','<section class="view" data-view="profile" aria-label="Профиль" hidden><div data-profile></div></section>\n          <section class="view" data-view="author" aria-label="Карточка автора" hidden><div data-author-page></div></section>\n          <section class="view" data-view="guide"',1)
    html=html.replace('<div class="user-card" data-auth-open>','<div class="user-card" data-auth-open role="button" tabindex="0">')
    for asset,tag,attr in [('profile.js','script','src'),('profile.css','link','href')]:
        html=re.sub(r'^[ \t]*<'+tag+r'[^\n]*'+attr+r'="'+re.escape(asset)+r'(?:\?v=[A-Za-z0-9_-]+)?"[^\n]*>\n?','',html,flags=re.M)
    version='20261005-profile'
    html,n=re.subn(r'^[ \t]*<script src="app\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>',lambda m:'    <script src="profile.js?v='+version+'" defer></script>\n    <script src="app.js?v='+version+'" defer></script>',html,flags=re.M)
    require(n==1,'Не найден скрипт кабинета')
    require(html.count('</head>')==1,'Не найден head')
    html=re.sub(r'^[ \t]*</head>',lambda m:'    <link rel="stylesheet" href="profile.css?v='+version+'">\n  </head>',html,flags=re.M)
    require(html.count('data-view="profile"')==html.count('data-view="author"')==1,'Неполные страницы профиля')
    require(html.index('src="profile.js')<html.index('src="app.js'),'Неверный порядок скриптов')
    out.mkdir(parents=True,exist_ok=True)
    (out/'app.js').write_text(app);(out/'index.html').write_text(html)
    for asset in ['profile.js','profile.css']:(out/asset).write_bytes((incoming/asset).read_bytes())

if __name__=='__main__':
    try:stage(*(Path(value) for value in sys.argv[1:]))
    except (OSError,ValueError) as error:print(str(error),file=sys.stderr);sys.exit(1)
