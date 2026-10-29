#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_LAUNCH_READINESS_REVISION:?Укажите ревизию}^{commit}")
exec 9>.zetslay-launch-readiness.lock
flock -n 9 || { echo 'Подготовка к продвижению уже выполняется.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate=''
files=(app/app.js app/account-security.js robots.txt sitemap.xml legal/terms.html app/launch-readiness.css app/index.html index.html)
cleanup(){
 status=$?
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  while IFS= read -r file;do rm -f -- "$file";done < "$work/absent"
  echo "Прежние файлы восстановлены. Backup: $backup"
 fi
 if [ -n "$candidate" ];then rm -f -- "$candidate";fi
 rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work/local/app" "$work/local/assets" "$work/incoming/legal" "$work/incoming/app"
: > "$work/present";: > "$work/absent"
for file in "${files[@]}";do
 [ ! -L "$file" ] || { echo "Символическая ссылка: $file";exit 1; }
 if [ -e "$file" ];then printf '%s\n' "$file" >> "$work/present";else printf '%s\n' "$file" >> "$work/absent";fi
done
for file in index.html app/index.html app/app.js app/account-security.js;do cp -p "$file" "$work/local/$file";done
cp assets/zetslay-orderflow.webp "$work/local/assets/"
for file in launch-readiness-patches.json launch-readiness-fragments.json;do git show "$revision:deploy/$file" > "$work/incoming/$file";done
for file in robots.txt sitemap.xml legal/terms.html app/launch-readiness.css;do git show "$revision:$file" > "$work/incoming/$file";done
git show "$revision:deploy/stage-launch-readiness.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
for file in app/app.js app/account-security.js;do
 if command -v node >/dev/null 2>&1;then timeout 15 node --check "$work/out/$file";fi
done
for file in index.html app/index.html app/app.js app/account-security.js;do cmp -s "$file" "$work/local/$file" || { echo 'Сайт изменился во время подготовки.';exit 1; };done
if [ "${ZETSLAY_LAUNCH_PREFLIGHT_ONLY:-false}" = true ];then
 echo 'Предварительная проверка сайта пройдена. Файлы не изменены.'
 exit 0
fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-launch-readiness.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" -T "$work/present"
cp "$work/absent" "$backup.absent";chmod 600 "$backup.absent"
publishing=true
for file in "${files[@]}";do
 candidate=$(mktemp "$(dirname "$file")/.zetslay-launch.XXXXXX")
 install -m 644 "$work/out/$file" "$candidate";mv -f "$candidate" "$file";candidate=''
done
publishing=false
echo "Готово: вход, публичные ссылки и превью обновлены. Backup: $backup"
