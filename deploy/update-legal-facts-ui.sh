#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
python3 - <<'PY'
from pathlib import Path
import os
import re
import tempfile
import time

path = Path('legal/index.html')
original = path.read_bytes()
text = original.decode('utf-8')
sections = list(re.finditer(r'<section class="legal-operator"><h2>Оператор проекта</h2><dl>.*?</dl></section>', text, re.S))
if len(sections) != 1:
    raise SystemExit('Не найдена единственная таблица оператора. Страница не изменена.')
section = sections[0]
updated = section.group()
removed = 0
for label in ('Размещение данных', 'Сроки хранения'):
    pattern = r'<dt>' + re.escape(label) + r'</dt>\s*<dd>[^<]*</dd>'
    matches = list(re.finditer(pattern, updated))
    if len(matches) > 1 or (label in updated and not matches):
        raise SystemExit('Неизвестная разметка строки. Страница не изменена.')
    updated, count = re.subn(pattern, '', updated)
    removed += count
if not removed:
    print('Строки уже удалены.')
    raise SystemExit(0)
result = (text[:section.start()] + updated + text[section.end():]).encode('utf-8')
backup_dir = Path(os.environ.get('ZETSLAY_BACKUP_DIR', '/root'))
fd, backup = tempfile.mkstemp(prefix='zetslay-legal-facts-' + str(int(time.time())) + '.', suffix='.html', dir=backup_dir)
with os.fdopen(fd, 'wb') as output:
    output.write(original)
fd, candidate = tempfile.mkstemp(prefix='.legal-facts.', dir=path.parent)
try:
    with os.fdopen(fd, 'wb') as output:
        output.write(result)
    os.chmod(candidate, path.stat().st_mode & 0o777)
    if path.read_bytes() != original:
        raise SystemExit('Страница изменилась во время обновления. Повторите команду.')
    os.replace(candidate, path)
finally:
    if os.path.exists(candidate):
        os.unlink(candidate)
print(f'Удалено строк: {removed}. Резервная копия: {backup}')
print('https://zetslay.pro/legal/ — обновите страницу Ctrl+F5.')
PY
