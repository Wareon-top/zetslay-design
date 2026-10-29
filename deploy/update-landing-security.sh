#!/usr/bin/env bash
# Presentation only: no API switch, account settings, credentials or migrations.
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_SECURITY_DESIGN_REVISION:?Укажите ревизию оформления}^{commit}")
exec 9>.zetslay-trust-ui.lock
flock -n 9 || { echo 'Раздел безопасности уже обновляется.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate=''
css=landing-security.20261028.css
files=("$css" index.html)
cleanup(){
 status=$?
 [ -z "$candidate" ] || rm -f -- "$candidate"
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  [ -e "$work/local/$css" ] || rm -f -- "$css"
  echo "Прежнее оформление восстановлено. Backup: $backup"
 fi
 rm -rf -- "$work"
}
trap cleanup EXIT
mkdir "$work/local" "$work/incoming"
for file in "${files[@]}";do
 [ ! -L "$file" ] || { echo "Символическая ссылка вместо файла: $file";exit 1; }
 [ ! -e "$file" ] || { [ -f "$file" ] && cp -p -- "$file" "$work/local/$file"; }
done
for file in landing-security.html landing-security.css deploy/landing-security-manifest.json deploy/stage-landing-security.py;do
 target="$work/incoming/$(basename "$file")"
 git show "$revision:$file" > "$target"
 [ "$(git hash-object "$target")" = "$(git rev-parse "$revision:$file")" ] || exit 1
done
python3 "$work/incoming/stage-landing-security.py" "$work/local" "$work/incoming" "$work/out"
for file in "${files[@]}";do
 if [ -f "$work/local/$file" ];then cmp -s "$file" "$work/local/$file" || { echo 'Главная страница изменилась во время подготовки.';exit 1; }
 else [ ! -e "$file" ] || exit 1;fi
done
if [ "${ZETSLAY_SECURITY_DESIGN_PREFLIGHT_ONLY:-false}" = true ];then echo 'Оформление подготовлено. Файлы не изменены.';exit 0;fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-security-design.XXXXXX.tar.gz")
existing=(index.html);[ ! -e "$css" ] || existing+=("$css")
chmod 600 "$backup"
tar -czf "$backup" "${existing[@]}"
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
 candidate=$(mktemp .zetslay-security-design.XXXXXX)
 install -m 644 "$work/out/$file" "$candidate"
 mv -f -- "$candidate" "$file";candidate=''
done
publishing=false
echo 'Готово: дизайн блока безопасности обновлён. Обновите главную страницу через Ctrl+F5.'
echo "Резервная копия оформления: $backup"
