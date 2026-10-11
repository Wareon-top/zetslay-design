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
cp -p app/index.html "$work/original/index.html"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
# Test dependencies only; none of these existing cabinet files are overwritten.
for file in app.js overview.js store-sync-deadline.js store-sync-deadline.test.mjs; do git show "$revision:app/$file" > "$work/tests/$file"; done
if command -v node >/dev/null 2>&1; then
  node --check "$work/out/store-sync-deadline.js"
  node --test "$work/tests/store-sync-deadline.test.mjs"
else
  docker run --rm --network none -v "$work/tests:/work:ro" -w /work node:22-alpine \
    sh -c 'node --check store-sync-deadline.js && node --test store-sync-deadline.test.mjs'
fi
cmp -s app/index.html "$work/original/index.html" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-sync-deadline-ui.XXXXXX")
chmod 700 "$backup"
cp -p app/index.html "$backup/index.html"
if [ -f app/store-sync-deadline.js ]; then cp -p app/store-sync-deadline.js "$backup/store-sync-deadline.js"; fi
for file in store-sync-deadline.js index.html; do
  if ! cp "$work/out/$file" "app/$file"; then
    cp -p "$backup/index.html" app/index.html
    if [ -f "$backup/store-sync-deadline.js" ]; then cp -p "$backup/store-sync-deadline.js" app/store-sync-deadline.js; else rm -f app/store-sync-deadline.js; fi
    echo "Файлы восстановлены. Backup: $backup"; exit 1
  fi
done
echo "Ограничение ожидания обновления установлено. Backup: $backup"
echo 'Нажмите Ctrl+F5. Ключи и очередь плагинов не изменены.'
