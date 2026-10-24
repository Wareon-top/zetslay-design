#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
python3 - <<'PY'
import os
from pathlib import Path
import re
import shutil
import stat
import tempfile

page = Path(os.environ.get('ZETSLAY_SITE_DIR', '/opt/zetslay-site')) / 'app/index.html'
html = page.read_text(encoding='utf-8')
navs = list(re.finditer(r'<nav class="sidebar-nav">(.*?)</nav>', html, re.S))
if len(navs) != 1:
    raise SystemExit('Боковое меню не определено однозначно. Файл не изменён.')
nav = navs[0]
link = '          <a class="nav-item" href="https://t.me/zetslay" target="_blank" rel="noopener noreferrer" data-blog-link aria-label="Мой блог — Telegram, откроется в новой вкладке"><svg aria-hidden="true"><use href="#i-send"/></svg><span>Мой блог</span><svg aria-hidden="true"><use href="#i-external"/></svg></a>'
if nav.group(1).count('data-blog-link') == 1 and link in nav.group(1):
    print('«Мой блог» уже добавлен: https://t.me/zetslay')
    raise SystemExit(0)
if 'data-blog-link' in nav.group(1):
    raise SystemExit('В меню уже есть другой пункт блога. Файл не изменён.')
guides = list(re.finditer(r'^[ \t]*<button\b[^\n]*data-view-target="guide"[^\n]*</button>[ \t]*$', nav.group(1), re.M))
if len(guides) != 1 or any(f'id="{icon}"' not in html for icon in ('i-send', 'i-external')):
    raise SystemExit('Структура меню отличается от ожидаемой. Файл не изменён.')
guide = guides[0]
body = nav.group(1)[:guide.end()] + '\n' + link + nav.group(1)[guide.end():]
updated = html[:nav.start(1)] + body + html[nav.end(1):]
metadata = page.stat()
backup_fd, backup_name = tempfile.mkstemp(prefix='zetslay-before-blog-link.', suffix='.html', dir=os.environ.get('ZETSLAY_BACKUP_DIR', '/root'))
os.close(backup_fd)
shutil.copy2(page, backup_name)
fd, staged = tempfile.mkstemp(prefix='.blog-link.', dir=page.parent)
try:
    with os.fdopen(fd, 'w', encoding='utf-8') as output:
        output.write(updated)
        output.flush()
        os.fsync(output.fileno())
    os.chown(staged, metadata.st_uid, metadata.st_gid)
    os.chmod(staged, stat.S_IMODE(metadata.st_mode))
    os.replace(staged, page)
finally:
    if os.path.exists(staged):
        os.unlink(staged)
print(f'«Мой блог» добавлен в боковое меню. Backup: {backup_name}')
print('Канал: https://t.me/zetslay. Обновите страницу кабинета: Ctrl+F5.')
PY
