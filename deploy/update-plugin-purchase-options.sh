#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-plugin-purchase-update.lock
mkdir "$lock" || { echo 'Обновление страницы плагина уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_PLUGIN_PURCHASE_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming"
assets=(plugin-purchase-options.js plugin-purchase-options.css plugin-purchase-options.test.mjs)
for file in "${assets[@]}"; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-plugin-purchase-options.py" > "$work/stage.py"
cp -p app/index.html "$work/original-index.html"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
if command -v node >/dev/null 2>&1; then
  node --check "$work/app/plugin-purchase-options.js"
  node --test "$work/app/plugin-purchase-options.test.mjs"
else
  docker run --rm --network none -v "$work/app:/work:ro" -w /work node:22-alpine \
    sh -c 'node --check plugin-purchase-options.js && node --test plugin-purchase-options.test.mjs'
fi
cmp -s app/index.html "$work/original-index.html" || { echo 'Разметка изменилась во время проверки. Обновление остановлено.'; exit 1; }
files=(app/index.html)
created=()
for file in "${assets[@]}"; do
  if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-plugin-purchase.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" "${files[@]}"
for file in "${assets[@]}" index.html; do
  if ! cp "$work/app/$file" "app/$file"; then
    tar -xzf "$backup"
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Файлы восстановлены. Backup: $backup"
    exit 1
  fi
done
echo "Варианты доступа добавлены: разовая покупка и подписка на месяц. Backup: $backup"
echo 'Оплата не включалась; настройки и действующий доступ сохранены. Нажмите Ctrl+F5.'
