"""Install the read deadline without replacing the cabinet or its local changes."""
from pathlib import Path
import re
import sys

def stage(local, incoming, out):
    local, incoming, out = Path(local), Path(incoming), Path(out)
    html=(local/'index.html').read_text()
    if html.lower().count('</body>')!=1 or any(m not in html for m in ['data-overview','data-sidebar-trial','data-billing']):
        raise ValueError('Не подтверждена структура кабинета. Файлы не изменены.')
    if len(re.findall(r'<script\b[^>]*\bsrc=["\']app\.js(?:\?[^"\']*)?["\'][^>]*\bdefer\b',html,re.I))!=1:
        raise ValueError('Не подтверждён запуск кабинета. Файлы не изменены.')
    if re.search(r'^(<<<<<<<|=======|>>>>>>>)',html,re.M):
        raise ValueError('В кабинете конфликт. Файлы не изменены.')
    pattern=r'<script\b[^>]*\bsrc=["\']store-sync-deadline\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
    if len(re.findall(pattern,html,re.I))>1:
        raise ValueError('Найдено несколько модулей обновления. Файлы не изменены.')
    html=re.sub(pattern,'',html,flags=re.I)
    html=re.sub(r'[ \t]*</body>', '<script src="store-sync-deadline.js?v=20261011-sync-deadline" defer></script>\n</body>',html,count=1,flags=re.I)
    outputs={'index.html':html,'store-sync-deadline.js':(incoming/'store-sync-deadline.js').read_text()}
    out.mkdir(parents=True,exist_ok=True)
    for name,text in outputs.items(): (out/name).write_text(text)

if __name__=='__main__':
    try: stage(*sys.argv[1:])
    except (OSError,ValueError) as e: raise SystemExit(str(e))
