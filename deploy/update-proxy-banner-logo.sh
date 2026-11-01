#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_PROXY_BANNER_LOGO_REVISION:?Укажите ревизию логотипа баннера}^{commit}")
exec 9>.zetslay-proxy-banner-logo.lock
flock -n 9 || { echo 'Баннер уже обновляется.';exit 1; }
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
mkdir -p "$work/local/app" "$work/incoming/assets"
for file in app/index.html app/proxy-shop.js app/proxy-shop.css;do
 [ ! -L "$file" ] || { echo "Символическая ссылка вместо файла: $file";exit 1; }
 cp -p "$file" "$work/local/$file"
done
[ ! -L assets/zetslay-logo.webp ] || exit 1
git show "$revision:deploy/stage-proxy-banner-logo.py" > "$work/stage.py"
git show "$revision:assets/zetslay-logo.webp" > "$work/incoming/assets/zetslay-logo.webp"
[ "$(git hash-object "$work/incoming/assets/zetslay-logo.webp")" = "$(git rev-parse "$revision:assets/zetslay-logo.webp")" ] || exit 1
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1;then timeout 15 node --check "$work/out/app/proxy-shop.js";fi
existing=(app/index.html app/proxy-shop.js app/proxy-shop.css)
for file in "${existing[@]}";do
 cmp -s "$file" "$work/local/$file" || { echo 'Кабинет изменился во время подготовки. Обновление остановлено.';exit 1; }
done
if [ -f assets/zetslay-logo.webp ];then existing+=(assets/zetslay-logo.webp);else created+=(assets/zetslay-logo.webp);fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-proxy-banner-logo.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" "${existing[@]}"
publishing=true
for file in assets/zetslay-logo.webp app/proxy-shop.css app/proxy-shop.js app/index.html;do
 mkdir -p "$(dirname "$file")"
 candidate=$(mktemp "$(dirname "$file")/.zetslay-proxy-banner-logo.XXXXXX")
 install -m 644 "$work/out/$file" "$candidate"
 mv -f "$candidate" "$file";candidate=''
done
publishing=false
echo 'Готово: в баннере покупки прокси установлен логотип ZetSlay.'
echo "Резервная копия: $backup"
echo 'Обновите кабинет через Ctrl+F5. Перезапуск API не требуется.'
