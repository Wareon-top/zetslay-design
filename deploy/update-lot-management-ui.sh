#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-lot-management-update.lock
mkdir "$lock" || { echo 'Обновление управления лотами уже выполняется.'; exit 1; }
work=$(mktemp -d)
backup=''
complete=false
created=()
cleanup() {
  status=$?
  if [ -n "$backup" ] && [ "$complete" = false ]; then
    tar -xzf "$backup"
    for file in "${created[@]}"; do rm -f -- "$file"; done
    echo "Файлы восстановлены. Backup: $backup"
  fi
  rm -rf "$work"; rmdir "$lock"; return "$status"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_LOT_MANAGEMENT_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/incoming/deploy"
for file in app/index.html app/lots.js app/lot-management.js app/lot-management.css app/lot-management.test.mjs app/lots.test.mjs app/app.js deploy/stage-lot-management.py deploy/stage-lot-management.test.py; do
  git show "$revision:$file" > "$work/incoming/$file"
done
python3 "$work/incoming/deploy/stage-lot-management.test.py"
python3 "$work/incoming/deploy/stage-lot-management.py" "$PWD" "$work/incoming" "$work/staged"
cp "$work/incoming/app/lot-management.test.mjs" "$work/staged/app/"
cp "$work/incoming/app/lots.test.mjs" "$work/staged/app/"
# Existing app is copied only into the test fixture, never installed over live edits.
cp "$PWD/app/app.js" "$work/staged/app/app.js"
if command -v node >/dev/null 2>&1; then
  node --check "$work/staged/app/lot-management.js"
  node --check "$work/staged/app/lots.js"
  node --test "$work/staged/app/lot-management.test.mjs" "$work/staged/app/lots.test.mjs"
else
  docker run --rm --network none -v "$work/staged:/work:ro" -w /work node:22-alpine sh -c 'node --check app/lot-management.js && node --check app/lots.js && node --test app/lot-management.test.mjs app/lots.test.mjs'
fi
rm "$work/staged/app/app.js"
find "$work/staged" -type f -name '*.test.mjs' -delete
mapfile -t files < <(cd "$work/staged" && find . -type f -printf '%P\n' | sort)
existing=()
for file in "${files[@]}"; do if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi; done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-lot-management-ui.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
for file in "${files[@]}"; do
  mkdir -p "$(dirname "$file")"
  candidate=$(mktemp "$(dirname "$file")/.lot-management.XXXXXX")
  if ! cp "$work/staged/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then rm -f "$candidate"; exit 1; fi
done
complete=true
echo "Управление лотами в кабинете обновлено. Backup: $backup"
echo 'Ctrl+F5 → Лоты и товары → Изменить или удалить выбранный лот.'
