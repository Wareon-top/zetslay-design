"""Install the introduction as an isolated add-on, preserving local HTML and app JS."""
from pathlib import Path
import re
import sys

ASSETS = ['learning.js','learning.css','learning.test.mjs','assets/learning-welcome.svg']
VERSION = '20261011-welcome-tour'


def stage(local, incoming, out):
    local, incoming, out = Path(local), Path(incoming), Path(out)
    html = (local/'index.html').read_text()
    for marker in ['data-overview','overview-context','data-kb-library','data-sidebar-trial']:
        if marker not in html:
            raise ValueError('Не подтверждена разметка кабинета. Файлы не изменены.')
    if html.lower().count('</head>') != 1 or html.lower().count('</body>') != 1:
        raise ValueError('Не подтверждена структура HTML. Файлы не изменены.')
    if len(re.findall(r'<script\b[^>]*\bsrc=["\']app\.js(?:\?[^"\']*)?["\']',html,re.I)) != 1:
        raise ValueError('Не подтверждено подключение кабинета. Файлы не изменены.')
    outputs = {name:(incoming/name).read_text() for name in ASSETS}
    for kind, name, pattern, closing in [
        ('style','learning.css',r'<link\b[^>]*\bhref=["\']learning\.css(?:\?[^"\']*)?["\'][^>]*>', '</head>'),
        ('script','learning.js',r'<script\b[^>]*\bsrc=["\']learning\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>', '</body>')
    ]:
        matches = list(re.finditer(pattern, html, re.I))
        if len(matches)>1:
            raise ValueError('Обучение подключено несколько раз. Файлы не изменены.')
        # Put it last, after all existing wrappers, even when updating an earlier version.
        if matches:
            m=matches[0];begin=m.start();end=m.end()
            while begin>0 and html[begin-1] in ' \t': begin-=1
            if html[end:end+2]=='\r\n': end+=2
            elif html[end:end+1]=='\n': end+=1
            html=html[:begin]+html[end:]
        fresh = f'<link rel="stylesheet" href="{name}?v={VERSION}">' if kind=='style' else f'<script src="{name}?v={VERSION}" defer></script>'
        html = re.sub(r'[ \t]*'+re.escape(closing),lambda _:fresh+'\n'+closing,html,count=1,flags=re.I)
    outputs['index.html']=html
    for name, text in outputs.items():
        path=out/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)


if __name__=='__main__':
    try:
        stage(*sys.argv[1:])
    except (OSError,ValueError) as error:
        raise SystemExit(str(error))
