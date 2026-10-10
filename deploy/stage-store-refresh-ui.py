from pathlib import Path
import re
import sys

def stage(local, incoming, out):
    html = (local / 'index.html').read_text()
    if re.search(r'^(<<<<<<<|=======|>>>>>>>)', html, re.M):
        raise ValueError('В index.html есть конфликт. Кабинет не изменён.')
    anchor = r'<script\b[^>]*\bsrc=["\']app\.js(?:\?[^"\']*)?["\'][^>]*>'
    modules = r'<script\b[^>]*\bsrc=["\']store-refresh\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
    matches = list(re.finditer(anchor, html))
    if len(matches) != 1 or not re.search(r'\bdefer\b', matches[0].group()):
        raise ValueError('Не подтверждён запуск кабинета. Файлы не изменены.')
    existing = list(re.finditer(modules, html))
    tag = '<script src="store-refresh.js?v=20261007-sync" defer></script>'
    if len(existing) > 1:
        raise ValueError('Дубли модуля обновления. Файлы не изменены.')
    if existing:
        html = re.sub(modules, tag, html)
    else:
        html = re.sub(anchor, lambda m: tag + '\n    ' + m.group(), html)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.html').write_text(html)
    (out / 'store-refresh.js').write_bytes((incoming / 'store-refresh.js').read_bytes())

if __name__ == '__main__':
    try:
        stage(*(Path(v) for v in sys.argv[1:]))
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
