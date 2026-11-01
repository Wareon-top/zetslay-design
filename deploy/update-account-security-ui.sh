#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-security-ui-update.lock
mkdir "$lock" || { echo 'Обновление уже выполняется'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_SECURITY_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir "$work/incoming"
for file in account-security.js account-security.css account-security.test.mjs; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-account-security-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check account-security.js
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test account-security.test.mjs
files=(app/index.html)
created=()
for file in account-security.js account-security.css account-security.test.mjs; do
 if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp /root/zetslay-before-security-ui.XXXXXX.tar.gz)
tar -czf "$backup" "${files[@]}"
for file in account-security.js account-security.css account-security.test.mjs index.html; do
 if ! cp "$work/app/$file" "app/$file"; then
  tar -xzf "$backup"
  for path in "${created[@]}"; do rm -f "$path"; done
  echo "Копирование не удалось. Сайт восстановлен: $backup"; exit 1
 fi
done
echo "Защита аккаунта добавлена в Профиль. Резервная копия: $backup"
