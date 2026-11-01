#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-lot-raise-update.lock
mkdir "$lock" || { echo 'Обновление автоподнятия уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_LOT_RAISE_UI_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming"
assets=(lot-raise.js lot-raise.css lot-raise.test.mjs)
for file in "${assets[@]}"; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-lot-raise-ui.py" > "$work/stage.py"
cp -p app/index.html "$work/original-index.html"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
if command -v node >/dev/null 2>&1; then
 node --check "$work/app/lot-raise.js"
 node --test "$work/app/lot-raise.test.mjs"
else
 docker run --rm --network none -v "$work/app:/work:ro" -w /work node:22-alpine sh -c 'node --check lot-raise.js && node --test lot-raise.test.mjs'
fi
cmp -s app/index.html "$work/original-index.html" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
files=(app/index.html); created=()
for file in "${assets[@]}"; do if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi; done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-lot-raise.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" "${files[@]}"
for file in index.html "${assets[@]}"; do
 if ! cp "$work/app/$file" "app/$file"; then
  tar -xzf "$backup"
  if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
  echo "Файлы восстановлены. Backup: $backup"
  exit 1
 fi
done
echo "Автоподнятие добавлено в «Лоты и товары». Backup: $backup"
echo 'Откройте настройки, загрузите категории и сохраните расписание. Обновление само не поднимает лоты.'
