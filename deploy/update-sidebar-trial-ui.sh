#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-sidebar-trial-update.lock
mkdir "$lock" || { echo 'Обновление карточки пробного доступа уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_SIDEBAR_TRIAL_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/original"
# billing and admin labels are patched locally, preserving their current implementation.
assets=(sidebar-trial.js sidebar-trial.css sidebar-trial.test.mjs)
for file in index.html "${assets[@]}"; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-sidebar-trial-ui.py" > "$work/stage.py"
for file in index.html app.js billing.js admin-panel.js; do cp -p "app/$file" "$work/original/$file"; done
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
if command -v node >/dev/null 2>&1; then
  node --check "$work/app/sidebar-trial.js"
  node --check "$work/app/billing.js"
  node --check "$work/app/admin-panel.js"
  node --test "$work/app/sidebar-trial.test.mjs"
else
  docker run --rm --network none -v "$work/app:/work:ro" -w /work node:22-alpine \
    sh -c 'node --check sidebar-trial.js && node --check billing.js && node --check admin-panel.js && node --test sidebar-trial.test.mjs'
fi
for file in index.html app.js billing.js admin-panel.js; do
  cmp -s "app/$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
done
files=(app/index.html app/billing.js app/admin-panel.js); created=()
for file in "${assets[@]}"; do
  if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-sidebar-trial.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" "${files[@]}"
for file in index.html billing.js admin-panel.js "${assets[@]}"; do
  if ! cp "$work/app/$file" "app/$file"; then
    tar -xzf "$backup"
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Файлы восстановлены. Backup: $backup"
    exit 1
  fi
done
echo "Боковая панель обновлена: карточка пробного доступа на 3 дня. Backup: $backup"
echo 'Остальные разделы и настройки не изменены. Нажмите Ctrl+F5.'
