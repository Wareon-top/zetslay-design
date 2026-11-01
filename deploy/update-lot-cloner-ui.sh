#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_LOT_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-lot-cloner-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
git show "$revision:app/plugin-page.js" > "$work/incoming/plugin-page.js"
git show "$revision:deploy/stage-lot-cloner-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check plugin-page.js </dev/null
backup=$(mktemp /root/zetslay-site-before-lot-cloner.XXXXXX.tar.gz)
tar -czf "$backup" app/plugin-page.js app/index.html
for file in plugin-page.js index.html; do
  if ! cp "$work/app/$file" "app/$file"; then tar -xzf "$backup"; echo 'Кабинет восстановлен из резервной копии.'; exit 1; fi
done
echo "Инструкция Lot Cloner добавлена в кабинет. Резервная копия: $backup"
