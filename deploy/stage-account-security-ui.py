from pathlib import Path
import re, sys

def stage(local,incoming,out):
    html=(local/'index.html').read_text()
    code=(local/'app.js').read_text()
    profile=(local/'profile.js').read_text()
    if any(marker not in code for marker in ['async function acceptSession(', 'async function apiRequest(']) or 'function renderProfile(' not in profile or 'data-profile' not in html:
        raise ValueError('Сначала требуется установленный модуль профиля. Сайт не изменён.')
    if html.count('</head>')!=1 or html.count('</body>')!=1:
        raise ValueError('Неизвестная разметка кабинета.')
    html=re.sub(r'<link\b[^>]*href="account-security\.css(?:\?[^"]*)?"[^>]*>|<script\b[^>]*src="account-security\.js(?:\?[^"]*)?"[^>]*></script>', '',html,flags=re.M)
    app=re.compile(r'<script\b[^>]*src="app\.js(?:\?[^"\n]*)?"[^>]*defer[^>]*></script>')
    if len(app.findall(html))!=1:raise ValueError('Не найден основной модуль кабинета.')
    html=html.replace('</head>','<link rel="stylesheet" href="account-security.css?v=20261006-security"></head>')
    html=html.replace('</body>','<script src="account-security.js?v=20261006-security" defer></script></body>')
    out.mkdir(parents=True,exist_ok=True)
    (out/'index.html').write_text(html)
    for name in ['account-security.js','account-security.css','account-security.test.mjs']:(out/name).write_bytes((incoming/name).read_bytes())
if __name__=='__main__':
    try:stage(*(Path(x) for x in sys.argv[1:]))
    except (ValueError,OSError) as error:print(error,file=sys.stderr);sys.exit(1)
