#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-subscription-access-update.lock
mkdir "$lock" || { echo 'Обновление тарифов уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_SUBSCRIPTION_UI_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/assets" "$work/original"
assets=(subscription-access.js subscription-access.css subscription-access.test.mjs)
for file in "${assets[@]}"; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-subscription-access-ui.py" > "$work/stage.py"
cp -p app/index.html "$work/original/index.html"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
# Integration-test dependency only; the existing sidebar file is not replaced.
git show "$revision:app/sidebar-trial.js" > "$work/out/sidebar-trial.js"
if command -v node >/dev/null 2>&1; then
  node --check "$work/out/subscription-access.js"
  node --test "$work/out/subscription-access.test.mjs"
else
  docker run --rm --network none -v "$work/out:/work:ro" -w /work node:22-alpine \
    sh -c 'node --check subscription-access.js && node --test subscription-access.test.mjs'
fi
cmp -s app/index.html "$work/original/index.html" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
files=(app/index.html); created=()
for file in "${assets[@]}"; do
  if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-subscription-access-ui.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" "${files[@]}"
mkdir -p app/assets
for file in "${assets[@]}" index.html; do
  if ! cp "$work/out/$file" "app/$file"; then
    tar -xzf "$backup"
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Файлы восстановлены. Backup: $backup";exit 1
  fi
done
echo "Дизайн закрытых разделов, тарифы и промокоды обновлены. Backup: $backup"
echo 'Обновите страницу через Ctrl+F5. Серверные ограничения доступа сохранены.'
