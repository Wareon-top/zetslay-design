#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock="$PWD/.zetslay-store-refresh-update.lock"
mkdir "$lock" || { echo 'Обновление уже выполняется.'; exit 1; }
work=''
cleanup() { if [ -n "$work" ]; then rm -rf -- "$work"; fi; rmdir "$lock"; }
trap cleanup EXIT
work=$(mktemp -d)
git fetch origin "${ZETSLAY_STORE_REFRESH_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/deploy"
for file in store-refresh.js store-refresh.test.mjs; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
for file in stage-store-refresh-ui.py stage-store-refresh-ui.test.py; do
  git show "$revision:deploy/$file" > "$work/deploy/$file"
done
python3 "$work/deploy/stage-store-refresh-ui.test.py"
python3 "$work/deploy/stage-store-refresh-ui.py" "$PWD/app" "$work/incoming" "$work/staged"
docker run --rm -v "$work/incoming:/work:ro" -w /work node:22-alpine node --test store-refresh.test.mjs
docker run --rm -v "$work/staged:/work:ro" -w /work node:22-alpine node --check store-refresh.js
backup=$(mktemp -d /root/zetslay-site-before-store-refresh.XXXXXX)
chmod 700 "$backup"
cp -p app/index.html "$backup/index.html"
if [ -f app/store-refresh.js ]; then cp -p app/store-refresh.js "$backup/store-refresh.js"; fi
restore() {
  cp -p "$backup/index.html" app/index.html
  if [ -f "$backup/store-refresh.js" ]; then cp -p "$backup/store-refresh.js" app/store-refresh.js; else rm -f app/store-refresh.js; fi
}
for file in index.html store-refresh.js; do
  if ! cp "$work/staged/$file" "app/$file"; then
    restore
    echo "Файлы восстановлены. Backup: $backup"
    exit 1
  fi
done
echo "Обновление данных кабинета установлено. Backup: $backup"
echo 'Нажмите Ctrl+F5. Подключать магазин заново не нужно.'
