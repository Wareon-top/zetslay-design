#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin codex/landing-light-dark-redesign
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-confirm-reminder-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление плагина уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in confirm-reminder.js confirm-reminder.css confirm-reminder.test.mjs; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-confirm-reminder-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check plugin-page.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check confirm-reminder.js </dev/null
tests=(confirm-reminder.test.mjs)
for module in plugin-page plugin-cover overview orders messages; do
  if [ -f "$work/app/$module.test.mjs" ]; then tests+=("$module.test.mjs"); fi
done
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test "${tests[@]}" </dev/null
files=(app/plugin-page.js app/index.html app/confirm-reminder.js app/confirm-reminder.css app/confirm-reminder.test.mjs)
existing=(); created=()
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-confirm-reminder.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback() {
  tar -xzf "$backup"
  for file in "${created[@]}"; do rm -f -- "$file"; done
  echo "Обновление отменено. Резервная копия: $backup"
}
for file in "${files[@]}"; do
  candidate=$(mktemp "$(dirname "$file")/.zetslay-reminder.XXXXXX") || { rollback; exit 1; }
  if ! cp "$work/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then
    rm -f "$candidate"; rollback; exit 1
  fi
done
echo "Настройки Confirm Reminder добавлены. Резервная копия: $backup"
echo 'Нажмите Ctrl+F5. Каталог → Confirm Reminder → Подробнее → Настройки напоминаний.'
