#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_SUPPORT_ALERTS_REVISION:?Укажите ревизию обновления}^{commit}")
exec 9>.zetslay-trust-ui.lock
flock -n 9 || { echo 'Другое обновление защиты сайта ещё выполняется.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate=''
files=(app/admin-panel.js app/index.html)
cleanup(){
 status=$?
 [ -z "$candidate" ] || rm -f -- "$candidate"
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then tar -xzf "$backup";echo "Прежняя админ-панель восстановлена. Backup: $backup";fi
 rm -rf "$work"
}
trap cleanup EXIT
[ ! -L app ] || { echo 'Вместо каталога app обнаружена символическая ссылка.';exit 1; }
mkdir -p "$work/local/app"
for file in "${files[@]}";do [ -f "$file" ] && [ ! -L "$file" ] || { echo "Не подтверждён файл: $file";exit 1; };cp -p -- "$file" "$work/local/$file";done
git show "$revision:deploy/support-alerts-ui-patches.json" > "$work/patches.json"
git show "$revision:deploy/stage-support-alerts-ui.py" > "$work/stage.py"
python3 -I "$work/stage.py" "$work/local" "$work/patches.json" "$work/out"
if command -v node >/dev/null 2>&1;then node --check "$work/out/app/admin-panel.js";fi
for file in "${files[@]}";do cmp -s "$file" "$work/local/$file" || { echo 'Файлы сайта изменились во время подготовки.';exit 1; };done
if [ "${ZETSLAY_SUPPORT_ALERTS_PREFLIGHT_ONLY:-false}" = true ];then echo 'Совместимость ссылки поддержки проверена. Файлы не изменены.';exit 0;fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-support-alerts-ui.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" "${files[@]}"
python3 - "$backup" "$work/local" "${files[@]}" <<'VERIFY'
import sys,tarfile
from pathlib import Path
with tarfile.open(sys.argv[1],'r:gz') as archive:
 for name in sys.argv[3:]:
  entry=archive.getmember(name)
  if not entry.isfile() or archive.extractfile(entry).read()!=(Path(sys.argv[2])/name).read_bytes():raise SystemExit('Не подтверждена точная резервная копия сайта.')
VERIFY
publishing=true
for file in "${files[@]}";do candidate=$(mktemp "$(dirname "$file")/.zetslay-support-alerts-ui.XXXXXX");install -m 644 "$work/out/$file" "$candidate";mv -f -- "$candidate" "$file";candidate='';done
publishing=false
echo 'Готово: ссылки из уведомлений открывают нужное обращение поддержки.'
echo 'Обновите кабинет один раз, чтобы загрузить обработку ссылок на обращения.'
echo "Резервная копия сайта: $backup"
