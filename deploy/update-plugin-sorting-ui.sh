#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-plugin-sorting-ui.lock
mkdir "$lock" || { echo 'Обновление сортировки уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_PLUGIN_SORTING_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/local"
for file in app.js index.html plugin-sorting.test.mjs; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-plugin-sorting-ui.py" > "$work/stage.py"
for file in app.js index.html plugin-rarity.js; do cp -p "app/$file" "$work/local/$file"; done
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1; then
  node --check "$work/out/app.js"
  node --test "$work/out/plugin-sorting.test.mjs"
else
  docker run --rm --network none -v "$work/out:/work:ro" -w /work node:22-alpine \
    sh -c 'node --check app.js && node --test plugin-sorting.test.mjs'
fi
# A local edit during validation must not be silently overwritten.
for file in app.js index.html plugin-rarity.js; do
  cmp -s "app/$file" "$work/local/$file" || { echo 'Файлы кабинета изменились во время проверки. Обновление остановлено.'; exit 1; }
done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-plugin-sorting.XXXXXX")
chmod 700 "$backup"
for file in app.js index.html; do cp -p "app/$file" "$backup/$file"; done
rollback() {
  for file in app.js index.html; do cp -p "$backup/$file" "app/$file"; done
  echo "Прежний каталог восстановлен. Backup: $backup"
}
for file in app.js index.html; do
  if ! cp "$work/out/$file" "app/$file"; then rollback; exit 1; fi
done
echo "Сортировка каталога плагинов обновлена. Backup: $backup"
echo 'Редкость и цена в обе стороны, названия А–Я/Я–А, сначала установленные и включённые.'
echo 'Обновите кабинет через Ctrl+F5.'
