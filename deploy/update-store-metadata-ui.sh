#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_METADATA_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-store-metadata-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in orders.js store-identity.js store-identity.css store-identity.test.mjs orders.test.mjs overview.test.mjs; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-store-metadata-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test orders.test.mjs overview.test.mjs store-identity.test.mjs </dev/null
backup=$(mktemp /root/zetslay-site-before-store-metadata.XXXXXX.tar.gz)
files=(app/overview.js app/orders.js app/index.html app/store-identity.js app/store-identity.css app/store-identity.test.mjs)
tar -czf "$backup" "${files[@]}"
for file in "${files[@]}"; do
 if ! cp "$work/$file" "$file"; then tar -xzf "$backup"; echo 'Кабинет восстановлен из резервной копии.'; exit 1; fi
done
echo "Даты и баланс обновлены. Резервная копия: $backup"
