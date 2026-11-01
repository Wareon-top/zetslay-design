#!/usr/bin/env bash
# Only the public /security/ page. No API, account settings or migrations.
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_SECURITY_PAGE_REVISION:?Укажите ревизию страницы}^{commit}")
exec 9>.zetslay-trust-ui.lock
flock -n 9 || { echo 'Раздел безопасности уже обновляется.';exit 1; }
[ -d security ] && [ ! -L security ] || { echo 'Не подтверждён каталог страницы безопасности.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate=''
files=(security/security.css security/security.js security/index.html)
cleanup(){
 status=$?
 [ -z "$candidate" ] || rm -f -- "$candidate"
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  for file in "${files[@]}";do [ -e "$work/local/$file" ] || rm -f -- "$file";done
  echo "Прежняя страница восстановлена. Backup: $backup"
 fi
 rm -rf -- "$work"
}
trap cleanup EXIT
mkdir -p "$work/local/security" "$work/incoming/security"
for file in "${files[@]}";do
 [ ! -L "$file" ] || { echo "Символическая ссылка вместо файла: $file";exit 1; }
 [ ! -e "$file" ] || { [ -f "$file" ] && cp -p -- "$file" "$work/local/$file"; }
 git show "$revision:$file" > "$work/incoming/$file"
 [ "$(git hash-object "$work/incoming/$file")" = "$(git rev-parse "$revision:$file")" ] || exit 1
done
for file in security-page-manifest.json stage-security-page.py;do
 git show "$revision:deploy/$file" > "$work/incoming/$file"
 [ "$(git hash-object "$work/incoming/$file")" = "$(git rev-parse "$revision:deploy/$file")" ] || exit 1
done
python3 "$work/incoming/stage-security-page.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1;then timeout 15 node --check "$work/out/security/security.js";fi
for file in "${files[@]}";do
 if [ -f "$work/local/$file" ];then cmp -s "$file" "$work/local/$file" || { echo 'Страница изменилась во время подготовки.';exit 1; }
 else [ ! -e "$file" ] || exit 1;fi
done
if [ "${ZETSLAY_SECURITY_PAGE_PREFLIGHT_ONLY:-false}" = true ];then echo 'Страница подготовлена. Файлы не изменены.';exit 0;fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-security-page.XXXXXX.tar.gz")
existing=();for file in "${files[@]}";do [ ! -e "$file" ] || existing+=("$file");done
chmod 600 "$backup";tar -czf "$backup" "${existing[@]}"
python3 - "$backup" "$work/local" "${existing[@]}" <<'VERIFY'
import sys,tarfile
from pathlib import Path
with tarfile.open(sys.argv[1]) as archive:
 for name in sys.argv[3:]:
  entry=archive.getmember(name)
  if not entry.isfile() or archive.extractfile(entry).read()!=(Path(sys.argv[2])/name).read_bytes():raise SystemExit('Резервная копия не подтверждена. Сайт не изменён.')
VERIFY
publishing=true
for file in "${files[@]}";do
 candidate=$(mktemp security/.zetslay-security-page.XXXXXX)
 install -m 644 "$work/out/$file" "$candidate"
 mv -f -- "$candidate" "$file";candidate=''
done
publishing=false
echo 'Готово: страница /security/ обновлена. Откройте её и нажмите Ctrl+F5.'
echo "Резервная копия страницы: $backup"
