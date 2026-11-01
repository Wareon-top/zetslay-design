#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-sync-deadline-update.lock
mkdir "$lock" || { echo 'Обновление синхронизации уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_SYNC_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/original" "$work/tests"
git show "$revision:app/store-sync-deadline.js" > "$work/incoming/store-sync-deadline.js"
git show "$revision:deploy/stage-store-sync-deadline.py" > "$work/stage.py"
for file in index.html app.js overview.js; do
  cp -p "app/$file" "$work/original/$file"
  if [ "$file" != index.html ]; then git show "$revision:app/$file" > "$work/incoming/$file"; fi
done
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
# Test dependencies only; none of these existing cabinet files are overwritten.
cp "$work/out/"*.js "$work/tests/"
git show "$revision:app/store-sync-deadline.test.mjs" > "$work/tests/store-sync-deadline.test.mjs"
if command -v node >/dev/null 2>&1; then
  for file in app.js overview.js store-sync-deadline.js; do node --check "$work/out/$file"; done
  node --test "$work/tests/store-sync-deadline.test.mjs"
else
  docker run --rm --network none -v "$work/tests:/work:ro" -w /work node:22-alpine \
    sh -c 'node --check app.js && node --check overview.js && node --check store-sync-deadline.js && node --test store-sync-deadline.test.mjs'
fi
for file in index.html app.js overview.js; do
  cmp -s "app/$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-sync-deadline-ui.XXXXXX")
chmod 700 "$backup"
for file in index.html app.js overview.js; do cp -p "app/$file" "$backup/$file"; done
if [ -f app/store-sync-deadline.js ]; then cp -p app/store-sync-deadline.js "$backup/store-sync-deadline.js"; fi
for file in app.js overview.js store-sync-deadline.js index.html; do
  if ! cp "$work/out/$file" "app/$file"; then
    for saved in index.html app.js overview.js; do cp -p "$backup/$saved" "app/$saved"; done
    if [ -f "$backup/store-sync-deadline.js" ]; then cp -p "$backup/store-sync-deadline.js" app/store-sync-deadline.js; else rm -f app/store-sync-deadline.js; fi
    echo "Файлы восстановлены. Backup: $backup"; exit 1
  fi
done
echo "Синхронизация кабинета v2 установлена. Backup: $backup"
echo "Frontend revision: $revision"
sha256sum app/store-sync-deadline.js
echo 'Нажмите Ctrl+F5. Ключи и очередь плагинов не изменены.'

# Verify what the public origin serves; do not equate copied files with a deployed page.
if command -v curl >/dev/null 2>&1; then
  if curl -fsS --connect-timeout 10 --max-time 15 \
    'https://zetslay.pro/app/store-sync-deadline.js?v=20261011-sync-pipeline-v2' > "$work/served.js" && cmp -s app/store-sync-deadline.js "$work/served.js"; then
    echo 'Публичный сайт отдаёт установленный модуль v2.'
  else
    echo 'ВНИМАНИЕ: файлы обновлены, но публичный ответ не подтверждён. Проверьте каталог веб-сервера/CDN.'
  fi
fi
