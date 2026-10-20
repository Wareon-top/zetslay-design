#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-store-tools-update.lock
mkdir "$lock" || { echo 'Обновление автоматизации уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_STORE_TOOLS_UI_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming"
assets=(store-tools.js store-tools.css store-tools.test.mjs)
for file in "${assets[@]}"; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-store-tools-ui.py" > "$work/stage.py"
git show "$revision:deploy/store-tools-app-patches.json" > "$work/incoming/store-tools-app-patches.json"
cp -p app/index.html "$work/original-index.html"
cp -p app/app.js "$work/original-app.js"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
if command -v node >/dev/null 2>&1; then
 node --check "$work/app/app.js"
 node --check "$work/app/store-tools.js"
 node --test "$work/app/store-tools.test.mjs"
else
 docker run --rm --network none -v "$work/app:/work:ro" -w /work node:22-alpine sh -c 'node --check app.js && node --check store-tools.js && node --test store-tools.test.mjs'
fi
cmp -s app/index.html "$work/original-index.html" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
cmp -s app/app.js "$work/original-app.js" || { echo 'Кабинет изменился во время проверки.'; exit 1; }
files=(app/index.html app/app.js); created=()
for file in "${assets[@]}"; do if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi; done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-store-tools.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" "${files[@]}"
for file in index.html app.js "${assets[@]}"; do
 if ! cp "$work/app/$file" "app/$file"; then
  tar -xzf "$backup"
  if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
  echo "Файлы восстановлены. Backup: $backup"
  exit 1
 fi
done
echo "Раздел «Автоматизация» и пароль рабочего бота добавлены. Backup: $backup"
echo 'Обновите страницу. Настройки находятся в «Автоматизация»; собственные шаблоны также доступны в «Сообщения».'
