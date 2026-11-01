#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_MOBILE_LOGIN_REVISION:?Укажите ревизию обновления}^{commit}")
exec 9>.zetslay-trust-ui.lock
flock -n 9 || { echo 'Другое обновление защиты сайта ещё выполняется.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate=''
files=(app/passkeys.css app/account-security.js app/index.html)
cleanup(){
 status=$?
 [ -z "$candidate" ] || rm -f -- "$candidate"
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then tar -xzf "$backup";echo "Прежняя форма входа восстановлена. Backup: $backup";fi
 rm -rf "$work"
}
trap cleanup EXIT
[ ! -L app ] || { echo 'Вместо каталога app обнаружена символическая ссылка.';exit 1; }
mkdir -p "$work/local/app"
for file in "${files[@]}";do [ -f "$file" ] && [ ! -L "$file" ] || { echo "Не подтверждён файл: $file";exit 1; };cp -p -- "$file" "$work/local/$file";done
git show "$revision:deploy/mobile-login-patches.json" > "$work/patches.json"
git show "$revision:deploy/stage-mobile-login.py" > "$work/stage.py"
python3 -I "$work/stage.py" "$work/local" "$work/patches.json" "$work/out"
if command -v node >/dev/null 2>&1;then node --check "$work/out/app/account-security.js";fi
for file in "${files[@]}";do cmp -s "$file" "$work/local/$file" || { echo 'Файлы сайта изменились во время подготовки.';exit 1; };done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-mobile-login.XXXXXX.tar.gz")
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
for file in "${files[@]}";do candidate=$(mktemp "$(dirname "$file")/.zetslay-mobile-login.XXXXXX");install -m 644 "$work/out/$file" "$candidate";mv -f -- "$candidate" "$file";candidate='';done
publishing=false
echo 'Готово: мобильная форма входа обновлена. Защита 2FA сохранена.'
echo 'На телефоне откройте в Safari: https://zetslay.pro/app/?v=20261101-mobile-login-1'
echo "Резервная копия сайта: $backup"
