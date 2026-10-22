#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-proxy-sales-ui-update.lock
mkdir "$lock" || { echo 'Обновление продажи прокси уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_PROXY_SALES_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/original" "$work/incoming"
for file in index.html payments.js; do cp -p "app/$file" "$work/original/$file"; done
assets=(proxy-shop.js proxy-shop.css proxy-shop.test.mjs managed-proxy-ui.js managed-proxy-ui.css managed-proxy-ui.test.mjs)
for file in "${assets[@]}"; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-proxy-sales-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1; then
 node --check "$work/out/proxy-shop.js";node --check "$work/out/managed-proxy-ui.js";node --check "$work/out/payments.js"
 node --test "$work/out/proxy-shop.test.mjs" "$work/out/managed-proxy-ui.test.mjs"
else
 docker run --rm --network none -v "$work/out:/work:ro" -w /work node:22.23.4-alpine3.23@sha256:6abbcf5dd6b231da109bcde1181db1d92bf78015ae1a9514d9807c1f857869db sh -c 'node --check proxy-shop.js && node --check managed-proxy-ui.js && node --check payments.js && node --test proxy-shop.test.mjs managed-proxy-ui.test.mjs'
fi
for file in index.html payments.js; do cmp -s "app/$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.';exit 1; }; done
files=(app/index.html app/payments.js);created=()
for file in "${assets[@]}"; do if [ -f "app/$file" ]; then files+=("app/$file");else created+=("app/$file");fi;done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-proxy-sales-ui.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" "${files[@]}"
for file in "${assets[@]}" payments.js index.html; do
 if ! cp "$work/out/$file" "app/$file"; then
  tar -xzf "$backup";if [ "${#created[@]}" -gt 0 ];then rm -f -- "${created[@]}";fi
  echo "Файлы восстановлены. Backup: $backup";exit 1
 fi
done
echo "Продажа прокси в мастере подключения и профиле установлена. Backup: $backup"
echo 'Нажмите Ctrl+F5. После настройки API-ключа будут доступны расчёт, покупка с баланса и продление.'
