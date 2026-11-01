#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_IDENTITY_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-store-identity-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in store-identity.js store-identity.css store-identity.test.mjs; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-store-identity-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check overview.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test store-identity.test.mjs </dev/null
backup=$(mktemp /root/zetslay-site-before-store-identity.XXXXXX.tar.gz)
files=(app/overview.js app/index.html)
created=()
for file in store-identity.js store-identity.css store-identity.test.mjs; do if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi; done
tar -czf "$backup" "${files[@]}"
for file in store-identity.js store-identity.css store-identity.test.mjs overview.js index.html; do
  if ! cp "$work/app/$file" "app/$file"; then tar -xzf "$backup"; for fresh in "${created[@]}"; do rm -f "$fresh"; done; echo 'Кабинет восстановлен из резервной копии.'; exit 1; fi
done
echo "Карточки магазина установлены. Резервная копия: $backup"
