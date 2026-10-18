"""Install subscription access as an isolated add-on, preserving local HTML and app JS."""
from pathlib import Path
import re
import sys

ASSETS = ['subscription-access.js','subscription-access.css','subscription-access.test.mjs']
VERSION = '20261018-promo-upgrades'


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
        ('style','subscription-access.css',r'<link\b[^>]*\bhref=["\']subscription-access\.css(?:\?[^"\']*)?["\'][^>]*>', '</head>'),
        ('script','subscription-access.js',r'<script\b[^>]*\bsrc=["\']subscription-access\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>', '</body>')
    ]:
        matches = list(re.finditer(pattern, html, re.I))
        if len(matches)>1:
            raise ValueError('Тарифы подключено несколько раз. Файлы не изменены.')
        fresh = f'<link rel="stylesheet" href="{name}?v={VERSION}">' if kind=='style' else f'<script src="{name}?v={VERSION}" defer></script>'
        if matches:
            # Preserve wrapper order: payments.js must keep ownership of checkout.
            match=matches[0]
            html=html[:match.start()]+fresh+html[match.end():]
        else:
            payment = re.search(r'<script\b[^>]*\bsrc=["\']payments\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>',html,re.I) if kind=='script' else None
            if payment:
                html=html[:payment.start()]+fresh+'\n'+html[payment.start():]
            else:
                html = re.sub(r'[ \t]*'+re.escape(closing),lambda _:fresh+'\n'+closing,html,count=1,flags=re.I)
    outputs['index.html']=html
    for name, text in outputs.items():
        path=out/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)


if __name__=='__main__':
    try:
        stage(*sys.argv[1:])
    except (OSError,ValueError) as error:
        raise SystemExit(str(error))
