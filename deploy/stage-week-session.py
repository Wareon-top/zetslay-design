"""Update only authentication and landing entry points, preserving the live UI."""
from pathlib import Path
import re
import sys
VERSION='20261012-week-session'

def require(ok,message):
    if not ok: raise ValueError(message+'. Сайт не изменён.')

def span(text,start,end):
    require(text.count(start)==1 and text.count(end)==1,'Не подтверждён участок '+start)
    a=text.index(start); b=text.index(end,a);return a,b

def replace_span(text,desired,start,end):
    a,b=span(text,start,end);c,d=span(desired,start,end)
    return text[:a]+desired[c:d]+text[b:]

def script(text,path,before=None):
    pattern=r'\s*<script\b[^>]*\bsrc=["\']'+re.escape(path)+r'(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
    text,count=re.subn(pattern,'',text);require(count<=1,'Дубли скрипта '+path)
    line=f'\n    <script src="{path}?v={VERSION}" defer></script>\n'
    if before:
        match=re.search(r'<script\b[^>]*\bsrc=["\']'+re.escape(before)+r'(?:\?[^"\']*)?["\'][^>]*>',text)
        require(match is not None,'Не найден основной скрипт '+before)
        return text[:match.start()]+line+text[match.start():]
    require(text.count('</body>')==1,'Не найден body');return text.replace('</body>',line+'</body>',1)

def cache(text,path):
    text,count=re.subn(r'(?<=src=")'+re.escape(path)+r'(?:\?[^"\']*)?(?=")',path+'?v='+VERSION,text)
    require(count==1,'Не найден скрипт '+path);return text

def stage(local,incoming,output):
    local,incoming,output=map(Path,(local,incoming,output))
    root=(local/'index.html').read_text();html=(local/'app/index.html').read_text();app=(local/'app/app.js').read_text();desired=(incoming/'app/app.js').read_text()
    for text in (root,html,app):require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M),'Конфликт')
    app=replace_span(app,desired,'const localCabinet =','let sessionGeneration = 0;')
    app=replace_span(app,desired,'async function apiRequest(','\nfunction accountInitials(')
    app=replace_span(app,desired,'async function acceptSession(','\nasync function submitAuth(')
    app=replace_span(app,desired,'async function restoreSession()','\nasync function initializeAuthFlow(')
    a,b=span(app,'function clearSession()','\nasync function loadAccountData(')
    block=app[a:b]
    if "sessionStorage.removeItem('zetslay_session');" in block:block=block.replace("sessionStorage.removeItem('zetslay_session');","window.ZetSlaySession?.clearLegacy();")
    require('window.ZetSlaySession?.clearLegacy();' in block,'Не подтверждено завершение сессии')
    app=app[:a]+block+app[b:]
    old="      apiRequest('/api/v1/auth/logout', { method: 'POST', authenticated: true }).catch(() => {});\n      clearSession();\n      setView('dashboard');"
    new="      logoutSession(event.target.closest('[data-auth-logout]'));"
    require(app.count(old)==1 or app.count(new)==1,'Не подтверждена кнопка выхода')
    app=app.replace(old,new,1)
    security=(local/'app/account-security.js').read_text()
    security=security.replace("method:'POST',headers:{authorization:`Bearer ${result.token}`}" , "method:'POST',credentials:'include',headers:{authorization:`Bearer ${result.token}`}")
    require("credentials:'include',headers:{authorization:`Bearer ${result.token}`}" in security,'Не подтверждено завершение отменённого входа 2FA')
    html=script(html,'../session-client.js','app.js');html=cache(cache(html,'app.js'),'account-security.js')
    meta=re.search(r'<meta\b[^>]*name="zetslay-api-base-url"[^>]*content="([^"]+)"[^>]*>',html)
    require(meta is not None,'Не найден адрес API кабинета')
    root=re.sub(r'\s*<meta\b[^>]*name="zetslay-api-base-url"[^>]*>','',root)
    require(root.count('</head>')==1,'Не найден head');root=root.replace('</head>',f'  <meta name="zetslay-api-base-url" content="{meta[1]}">\n</head>',1)
    if 'data-session-cabinet' not in root:
        root,count=re.subn(r'<a class="header-login"', '<a data-session-guest class="header-login"',root,count=1);require(count==1,'Не найдена кнопка Войти')
        old='<a class="button button--black button--header" href="app/?auth=register">Регистрация</a>'
        require(root.count(old)==1,'Не найдена регистрация')
        root=root.replace(old,old.replace('<a ','<a data-session-guest ',1)+'<a data-session-cabinet class="button button--black button--header" href="app/" hidden>В кабинет</a>')
        old='<a href="app/?auth=login">Войти</a><a href="app/?auth=register">Регистрация</a>'
        require(root.count(old)==1,'Не подтверждено мобильное меню')
        root=root.replace(old,'<a data-session-guest href="app/?auth=login">Войти</a><a data-session-guest href="app/?auth=register">Регистрация</a><a data-session-cabinet href="app/" hidden>В кабинет</a>')
        old='<a class="button hero-start" href="app/?auth=register">Начать работу '
        require(root.count(old)==1,'Не найден главный CTA')
        root=root.replace(old,'<a data-session-start class="button hero-start" href="app/?auth=register"><span data-session-start-label>Начать работу</span> ')
        root,count=re.subn(r'<a class="hero-login"','<a data-session-guest class="hero-login"',root,count=1);require(count==1,'Не найден вход под CTA')
    require(root.count('data-session-cabinet')==2,'Неверное число кнопок кабинета')
    root=script(root,'session-client.js','landing-hero.js');root=script(root,'landing-session.js')
    root=re.sub(r'\s*<link\b[^>]*href="session-ui.css(?:\?[^"]*)?"[^>]*>','',root)
    root=root.replace('</head>',f'  <link rel="stylesheet" href="session-ui.css?v={VERSION}">\n</head>',1)
    files={'index.html':root,'app/index.html':html,'app/app.js':app,'app/account-security.js':security}
    for name in ['session-client.js','landing-session.js','session-ui.css']:files[name]=(incoming/name).read_text()
    output.mkdir(parents=True,exist_ok=False)
    for name,text in files.items():
        p=output/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)

if __name__=='__main__':
    try:stage(*sys.argv[1:])
    except (ValueError,OSError) as error:print(error,file=sys.stderr);sys.exit(1)
