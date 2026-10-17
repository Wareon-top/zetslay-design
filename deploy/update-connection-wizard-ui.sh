#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock='.zetslay-connection-ui-update.lock'
mkdir "$lock" || { echo 'Обновление мастера уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_CONNECTION_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming"
for file in connection-wizard-ui.js connection-wizard-ui.css connection-wizard-ui.test.mjs; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-connection-wizard-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check connection-wizard-ui.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test connection-wizard-ui.test.mjs </dev/null
files=(app/index.html)
created=()
for file in connection-wizard-ui.js connection-wizard-ui.css connection-wizard-ui.test.mjs; do
  if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp /root/zetslay-site-before-connection-ui.XXXXXX.tar.gz)
tar -czf "$backup" "${files[@]}"
for file in connection-wizard-ui.js connection-wizard-ui.css connection-wizard-ui.test.mjs index.html; do
  if ! cp "$work/app/$file" "app/$file"; then
    tar -xzf "$backup"
    for name in "${created[@]}"; do rm -f -- "$name"; done
    echo "Ошибка копирования. Сайт восстановлен. Backup: $backup"
    exit 1
  fi
done
echo "Мастер подключения обновлён. Backup: $backup"
echo 'app.js, обложки, API-адрес и данные подключённого магазина сохранены. Обновите кабинет через Ctrl+F5.'
