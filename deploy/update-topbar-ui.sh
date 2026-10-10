#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_TOPBAR_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-topbar-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in store-identity.js store-identity.css store-identity.test.mjs app.test.mjs; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-topbar-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check app.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test app.test.mjs store-identity.test.mjs </dev/null
backup=$(mktemp /root/zetslay-site-before-topbar.XXXXXX.tar.gz)
files=(app/app.js app/index.html app/store-identity.js app/store-identity.css app/store-identity.test.mjs)
tar -czf "$backup" "${files[@]}"
for file in "${files[@]}"; do if ! cp "$work/$file" "$file"; then tar -xzf "$backup"; echo 'Кабинет восстановлен.'; exit 1; fi; done
echo "Верхняя панель обновлена. Резервная копия: $backup"
