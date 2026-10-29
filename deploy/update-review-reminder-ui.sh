#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
if [ -n "${ZETSLAY_REVIEW_DESIGN_REVISION:-}" ]; then git fetch origin "$ZETSLAY_REVIEW_DESIGN_REVISION"; else git fetch origin codex/landing-light-dark-redesign; fi
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-review-reminder-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление Review Reminder уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in review-reminder.js review-reminder.css review-reminder.test.mjs plugin-page.test.mjs; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-review-reminder-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
# Legacy cabinets may keep cover rendering inside app.js; this is a test-only dependency.
if [ ! -f "$work/app/plugin-cover.js" ]; then
  git show "$revision:app/plugin-cover.js" > "$work/app/plugin-cover.js"
fi
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check plugin-page.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check review-reminder.js </dev/null
tests=(review-reminder.test.mjs plugin-page.test.mjs)
for module in confirm-reminder overview orders messages; do
  if [ -f "$work/app/$module.test.mjs" ]; then tests+=("$module.test.mjs"); fi
done
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test "${tests[@]}" </dev/null
files=(app/review-reminder.js app/review-reminder.css app/review-reminder.test.mjs app/plugin-page.js app/index.html)
existing=(); created=()
for file in "${files[@]}"; do if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi; done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-review-reminder.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback() {
  tar -xzf "$backup"
  for file in "${created[@]}"; do rm -f -- "$file"; done
  echo "Интерфейс восстановлен. Резервная копия: $backup"
}
for file in "${files[@]}"; do
  candidate=$(mktemp "$(dirname "$file")/.zetslay-review-reminder.XXXXXX") || { rollback; exit 1; }
  if ! cp "$work/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then rm -f "$candidate"; rollback; exit 1; fi
done
echo "Review Reminder добавлен в интерфейс. Резервная копия: $backup"
echo 'Ctrl+F5 → Плагины → Review Reminder → Подробнее → Настройки отзывов.'
