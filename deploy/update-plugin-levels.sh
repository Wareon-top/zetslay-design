#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-plugin-levels-update.lock
mkdir "$lock" || { echo 'Обновление редкостей уже выполняется.'; exit 1; }
trap 'rmdir "$lock"' EXIT
python3 - <<'PY'
from pathlib import Path
import os, re, tarfile, tempfile

levels = {'review-reminder': ('common', 'Обычный'), 'mass-price-editor': ('advanced', 'Продвинутый'), 'sales-pause': ('advanced', 'Продвинутый'), 'kosell-rent': ('legendary', 'Легендарный'), 'auto-review-bonus': ('advanced', 'Продвинутый'), 'robux-relay': ('ultra', 'Ультра'), 'stars-relay': ('legendary', 'Легендарный'), 'roblox-lzt-market': ('legendary', 'Легендарный'), 'tiktok-lzt-market': ('legendary', 'Легендарный')}
paths = ('app/plugin-rarity.js', 'app/index.html', 'index.html')
originals = {name: Path(name).read_bytes() for name in paths}
texts = {name: data.decode('utf-8') for name, data in originals.items()}
for text in texts.values():
    if re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M):
        raise SystemExit('Обнаружены маркеры конфликта. Файлы не изменены.')
for ident, (key, label) in levels.items():
    pattern = r"('zetslay\." + re.escape(ident) + r"'\s*:\s*)'(?:common|advanced|ultra|legendary)'"
    texts[paths[0]], count = re.subn(pattern, lambda m: m[1] + repr(key), texts[paths[0]])
    if count != 1:
        raise SystemExit('Неизвестная запись редкости: ' + ident + '. Файлы не изменены.')
    pattern = r'(<article\b[^>]*data-public-plugin="zetslay\.' + re.escape(ident) + r'"[^>]*>)(.*?)(</article>)'
    def patch_card(match):
        body, count = re.subn(r'<span class="landing-plugin-rarity landing-plugin-rarity--\w+">[^<]*</span>', f'<span class="landing-plugin-rarity landing-plugin-rarity--{key}">{label}</span>', match[2])
        if count != 1:
            raise SystemExit('Неизвестная плашка витрины. Файлы не изменены.')
        return match[1] + body + match[3]
    texts[paths[2]], count = re.subn(pattern, patch_card, texts[paths[2]], flags=re.S)
    if count > 1:
        raise SystemExit('Дублируется карточка витрины. Файлы не изменены.')
    # Unpublished cards may be absent from the public showcase.
texts[paths[1]], count = re.subn(r'(src="plugin-rarity\.js)(?:\?[^"\n]*)?("\s+defer)', r'\1?v=20261010-plugin-levels\2', texts[paths[1]])
if count != 1:
    raise SystemExit('Не найдена единственная загрузка редкостей. Файлы не изменены.')
changed = [name for name in paths if texts[name].encode('utf-8') != originals[name]]
if not changed:
    print('Редкости уже обновлены.')
    raise SystemExit(0)
backup_dir = Path(os.environ.get('ZETSLAY_BACKUP_DIR', '/root'))
fd, backup = tempfile.mkstemp(prefix='zetslay-before-plugin-levels.', suffix='.tar.gz', dir=backup_dir)
os.close(fd)
with tarfile.open(backup, 'w:gz') as archive:
    for name in changed:
        archive.add(name, arcname=name)
candidates = {}
written = []
try:
    for name in changed:
        fd, candidate = tempfile.mkstemp(prefix='.plugin-levels.', dir=Path(name).parent)
        candidates[name] = candidate
        with os.fdopen(fd, 'wb') as output:
            output.write(texts[name].encode('utf-8'))
        os.chmod(candidate, Path(name).stat().st_mode & 0o777)
    if any(Path(name).read_bytes() != originals[name] for name in paths):
        raise SystemExit('Файлы изменились во время обновления. Повторите команду.')
    for name in changed:
        os.replace(candidates[name], name)
        written.append(name)
except BaseException:
    for name in written:
        Path(name).write_bytes(originals[name])
    raise
finally:
    for candidate in candidates.values():
        if os.path.exists(candidate):
            os.unlink(candidate)
print('Редкости обновлены в кабинете и витрине. Backup: ' + backup)
print('Обновите страницу Ctrl+F5.')
PY
