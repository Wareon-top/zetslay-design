#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_SITE_BRAND_REVISION:?Укажите ревизию логотипа}^{commit}")
exec 9>.zetslay-site-brand.lock
flock -n 9 || { echo 'Логотип уже обновляется.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate='';created=()
cleanup(){
 status=$?
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  if [ "${#created[@]}" -gt 0 ];then rm -f -- "${created[@]}";fi
  echo "Прежний вариант восстановлен. Backup: $backup"
 fi
 if [ -n "$candidate" ];then rm -f -- "$candidate";fi
 rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work/local" "$work/incoming/assets"
git show "$revision:deploy/stage-site-brand.py" > "$work/stage.py"
mapfile -t html_files < <(python3 "$work/stage.py" --list .)
for file in "${html_files[@]}";do
 [ ! -L "$file" ] || { echo "Символическая ссылка вместо страницы: $file";exit 1; }
 mkdir -p "$work/local/$(dirname "$file")"
 cp -p "$file" "$work/local/$file"
done
assets=(favicon.ico apple-touch-icon.png assets/zetslay-logo.webp site-brand.css)
for file in "${assets[@]}";do
 [ ! -L "$file" ] || { echo "Символическая ссылка вместо ресурса: $file";exit 1; }
 git show "$revision:$file" > "$work/incoming/$file"
 [ "$(git hash-object "$work/incoming/$file")" = "$(git rev-parse "$revision:$file")" ] || exit 1
done
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
for file in "${html_files[@]}";do
 cmp -s "$file" "$work/local/$file" || { echo "Страница изменилась во время подготовки: $file. Обновление остановлено.";exit 1; }
done
existing=("${html_files[@]}")
for file in "${assets[@]}";do
 if [ -f "$file" ];then existing+=("$file");else created+=("$file");fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-site-brand.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" "${existing[@]}"
publishing=true
for file in "${assets[@]}" "${html_files[@]}";do
 mkdir -p "$(dirname "$file")"
 candidate=$(mktemp "$(dirname "$file")/.zetslay-site-brand.XXXXXX")
 install -m 644 "$work/out/$file" "$candidate"
 mv -f "$candidate" "$file";candidate=''
done
publishing=false
echo 'Готово: логотип и значок вкладки добавлены на страницы сайта, входа и кабинета.'
echo "Резервная копия: $backup"
echo 'Обновите страницу через Ctrl+F5. Перезапуск API не требуется.'
