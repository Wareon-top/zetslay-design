#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_PROXY_CHECKOUT_REVISION:?Укажите ревизию исправления загрузки}^{commit}")
exec 9>.zetslay-proxy-checkout-ui.lock
flock -n 9 || { echo 'Окно покупки прокси уже обновляется.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate=''
cleanup(){
 status=$?
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  echo "Прежний вариант восстановлен. Backup: $backup"
 fi
 if [ -n "$candidate" ];then rm -f -- "$candidate";fi
 rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work/local" "$work/incoming"
for file in index.html managed-proxy-ui.js proxy-shop.js;do
 [ ! -L "app/$file" ] || { echo "Символическая ссылка вместо файла: app/$file";exit 1; }
 cp -p "app/$file" "$work/local/$file"
done
git show "$revision:deploy/stage-proxy-checkout-ui.py" > "$work/stage.py"
git show "$revision:deploy/proxy-checkout-ui-patches.json" > "$work/incoming/proxy-checkout-ui-patches.json"
[ "$(git hash-object "$work/incoming/proxy-checkout-ui-patches.json")" = "$(git rev-parse "$revision:deploy/proxy-checkout-ui-patches.json")" ] || exit 1
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
for file in managed-proxy-ui.js proxy-shop.js;do
 if command -v node >/dev/null 2>&1;then timeout 15 node --check "$work/out/$file";fi
done
for file in index.html managed-proxy-ui.js proxy-shop.js;do
 cmp -s "app/$file" "$work/local/$file" || { echo 'Кабинет изменился во время подготовки. Обновление остановлено.';exit 1; }
done
if [ "${ZETSLAY_PROXY_CHECKOUT_PREFLIGHT_ONLY:-false}" = true ];then
 echo 'Совместимость окна покупки проверена. Файлы не изменены.';exit 0
fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-proxy-checkout-ui.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" app/index.html app/managed-proxy-ui.js app/proxy-shop.js
publishing=true
for file in managed-proxy-ui.js proxy-shop.js index.html;do
 candidate=$(mktemp "app/.zetslay-proxy-checkout-ui.XXXXXX")
 install -m 644 "$work/out/$file" "$candidate"
 mv -f "$candidate" "app/$file";candidate=''
done
publishing=false
echo 'Готово: окно покупки отслеживает сохранённый заказ; зависшее ожидание ограничено.'
echo "Резервная копия: $backup"
echo 'Обновите кабинет через Ctrl+F5. Если сервер вернёт ошибку, окно покажет её вместо бесконечной загрузки.'
