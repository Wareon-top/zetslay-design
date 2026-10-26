#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_TRUST_REVISION:?Укажите ревизию обновления}^{commit}")
exec 9>.zetslay-trust-ui.lock
flock -n 9 || { echo 'Обновление безопасности сайта уже выполняется.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate='';created_directory=false
files=(app/account-security.js security/index.html security/security.css security/security.js security/brand.webp app/app.js index.html app/index.html)
read_files=("${files[@]}" app/profile.js)
cleanup(){
 status=$?
 [ -z "$candidate" ] || rm -f -- "$candidate"
 candidate=''
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  for file in "${files[@]}";do [ -f "$work/local/$file" ] || rm -f -- "$file";done
  if [ "$created_directory" = true ];then rmdir security 2>/dev/null || true;fi
  echo "Прежний сайт восстановлен. Backup: $backup"
 fi
 [ -z "$candidate" ] || rm -f -- "$candidate"
 rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work/local/app" "$work/local/security" "$work/incoming/app" "$work/incoming/security"
for dir in app security;do [ ! -L "$dir" ] || { echo "Символическая ссылка вместо каталога: $dir";exit 1; };done
for file in "${read_files[@]}";do
 [ ! -L "$file" ] || { echo "Символическая ссылка вместо файла: $file";exit 1; }
 [ ! -e "$file" ] || cp -p -- "$file" "$work/local/$file"
done
for file in app/account-security.js security/index.html security/security.css security/security.js security/brand.webp;do
 git show "$revision:$file" > "$work/incoming/$file"
 [ "$(git hash-object "$work/incoming/$file")" = "$(git rev-parse "$revision:$file")" ] || exit 1
done
git show "$revision:deploy/stage-trust-foundation.py" > "$work/stage.py"
git show "$revision:deploy/trust-ui-manifest.json" > "$work/incoming/trust-ui-manifest.json"
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1;then for file in app/app.js app/account-security.js security/security.js;do timeout 15 node --check "$work/out/$file";done;fi
for file in "${read_files[@]}";do
 if [ -f "$work/local/$file" ];then cmp -s "$file" "$work/local/$file" || { echo 'Сайт изменился во время подготовки.';exit 1; }
 else [ ! -e "$file" ] || { echo 'Новый файл появился во время подготовки.';exit 1; };fi
done
if [ "${ZETSLAY_TRUST_PREFLIGHT_ONLY:-false}" = true ];then echo 'Совместимость сайта проверена. Файлы не изменены.';exit 0;fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-trust-ui.XXXXXX.tar.gz")
existing=();for file in "${files[@]}";do [ ! -f "$file" ] || existing+=("$file");done
chmod 600 "$backup";tar -czf "$backup" "${existing[@]}"
python3 - "$backup" "$work/local" "${existing[@]}" <<'VERIFY_BACKUP'
import sys,tarfile
from pathlib import Path
with tarfile.open(sys.argv[1],'r:gz') as archive:
 for name in sys.argv[3:]:
  entry=archive.getmember(name)
  if not entry.isfile() or archive.extractfile(entry).read()!=(Path(sys.argv[2])/name).read_bytes():
   raise SystemExit('Точная резервная копия сайта не подтверждена. Установка остановлена до записи.')
VERIFY_BACKUP
publishing=true
if [ ! -d security ];then mkdir -m 755 security;created_directory=true;fi
for file in "${files[@]}";do
 candidate=$(mktemp "$(dirname "$file")/.zetslay-trust.XXXXXX")
 install -m 644 "$work/out/$file" "$candidate"
 mv -f -- "$candidate" "$file";candidate=''
done
publishing=false
echo 'Готово: раздел данных и безопасности и настройки 2FA установлены.'
echo "Резервная копия сайта: $backup"
