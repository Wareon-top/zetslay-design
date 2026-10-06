"""Stage Kosell settings only; keep cabinet customization and every other module."""
from pathlib import Path
import hashlib
import re
import sys

BASE_BLOB = '775459788ccd75857354c6a880d80e0eba116363'
VERSION = '20261006-kosell-save-fix'

def blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()

def stage(local, incoming, out):
    current = (local/'kosell-rent.js').read_bytes()
    replacement = (incoming/'kosell-rent.js').read_bytes()
    html = (local/'index.html').read_text()
    if blob(current) not in (BASE_BLOB, blob(replacement)):
        raise ValueError('kosell-rent.js содержит другую версию или локальные правки. Кабинет не изменён. SHA: '+blob(current))
    if re.search(r'^(<<<<<<<|=======|>>>>>>>)', html, re.M):
        raise ValueError('Конфликт в index.html. Кабинет не изменён.')
    pattern = r'(<script\b[^>]*\bsrc=["\'])kosell-rent\.js(?:\?[^"\']*)?(["\'][^>]*>)'
    matches = list(re.finditer(pattern, html))
    app = re.search(r'<script\b[^>]*\bsrc=["\']app\.js(?:\?[^"\']*)?["\'][^>]*>', html)
    if len(matches) != 1 or not app or matches[0].start() > app.start() or not re.search(r'\bdefer\b', matches[0].group()):
        raise ValueError('Не подтверждён порядок подключения Kosell. Кабинет не изменён.')
    html = re.sub(pattern, lambda m: m[1]+'kosell-rent.js?v='+VERSION+m[2], html)
    out.mkdir(parents=True, exist_ok=True)
    (out/'kosell-rent.js').write_bytes(replacement)
    (out/'index.html').write_text(html)

if __name__ == '__main__':
    try:
        stage(*(Path(v) for v in sys.argv[1:]))
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
