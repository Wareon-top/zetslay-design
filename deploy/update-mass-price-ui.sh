#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_MASS_PRICE_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-mass-price-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming/assets/plugin-covers" "$work/app"
for file in plugin-page.js mass-price-editor.css assets/plugin-covers/mass-price-editor.svg; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-mass-price-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check plugin-page.js </dev/null
backup=$(mktemp /root/zetslay-site-before-mass-price.XXXXXX.tar.gz)
tar -czf "$backup" app/plugin-page.js app/index.html
for file in plugin-page.js index.html mass-price-editor.css assets/plugin-covers/mass-price-editor.svg; do
  if ! cp "$work/app/$file" "app/$file"; then tar -xzf "$backup"; echo 'Страница восстановлена из резервной копии.'; exit 1; fi
done
echo "Карточка Mass Price Editor обновлена. Резервная копия: $backup"
