#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-reliability-ui-update.lock
mkdir "$lock" || { echo 'Обновление кабинета уже выполняется.'; exit 1; }
work=$(mktemp -d); backup=''; complete=false
cleanup() {
 status=$?
 if [ -n "$backup" ] && [ "$complete" = false ]; then tar -xzf "$backup"; echo "Файлы восстановлены. Backup: $backup"; fi
 rm -rf "$work"; rmdir "$lock"; return "$status"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_RELIABILITY_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/incoming/deploy"
for file in app/index.html app/app.js app/kosell-rent.js app/overview.js app/admin-panel.js app/admin-panel.css app/kosell-rent.test.mjs app/api-deadline.test.mjs app/overview.test.mjs app/admin-panel.test.mjs app/browser-session.test.mjs app/plugin-page.js app/plugin-rarity.js deploy/stage-reliability.py deploy/stage-reliability.test.py deploy/stage-kosell-offer-recovery.py; do
 git show "$revision:$file" > "$work/incoming/$file"
done
python3 "$work/incoming/deploy/stage-reliability.test.py"
python3 "$work/incoming/deploy/stage-reliability.py" "$PWD/app" "$work/incoming/app" "$work/staged"
mkdir -p "$work/tests/app"
cp "$work/incoming/app/"* "$work/tests/app/"
cp "$work/staged/"* "$work/tests/app/"
test_log=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-reliability-ui-tests.XXXXXX.tap")
echo "Полный лог проверки кабинета: $test_log"
if command -v node >/dev/null 2>&1; then
 for file in app.js kosell-rent.js overview.js admin-panel.js; do node --check "$work/tests/app/$file"; done
 if ! node --test --test-reporter=tap "$work/tests/app/"*.test.mjs 2>&1 | tee "$test_log"; then
  echo "Проверка кабинета не прошла. Файлы сайта не изменены. Причина: $test_log"; exit 1
 fi
else
 if ! docker run --rm --network none -v "$work/tests:/work:ro" -w /work node:22-alpine sh -c 'set -eu; for file in app.js kosell-rent.js overview.js admin-panel.js; do node --check "app/$file"; done; node --test --test-reporter=tap app/*.test.mjs' 2>&1 | tee "$test_log"; then
  echo "Проверка кабинета не прошла. Файлы сайта не изменены. Причина: $test_log"; exit 1
 fi
fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-reliability-ui.XXXXXX.tar.gz")
tar -czf "$backup" app/app.js app/kosell-rent.js app/overview.js app/admin-panel.js app/index.html
for file in app.js kosell-rent.js overview.js admin-panel.js index.html; do
 candidate=$(mktemp "app/.reliability.XXXXXX")
 if ! cp "$work/staged/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "app/$file"; then rm -f "$candidate"; exit 1; fi
done
complete=true
echo "Надёжность кабинета и диагностика обновлены. Backup: $backup"
echo 'Ctrl+F5. Сохранены оформление и остальные модули. Новые обложки не добавлялись.'
