#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_SALES_PAUSE_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-sales-pause-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in sales-pause.js sales-pause.css sales-pause.test.mjs; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-sales-pause-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
for file in sales-pause.js plugin-page.js plugin-rarity.js; do
  docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check "$file" </dev/null
done
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test sales-pause.test.mjs </dev/null
files=(app/plugin-page.js app/plugin-rarity.js app/index.html)
created=()
for file in sales-pause.js sales-pause.css sales-pause.test.mjs; do
  if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp /root/zetslay-site-before-sales-pause.XXXXXX.tar.gz)
tar -czf "$backup" "${files[@]}"
for file in sales-pause.js sales-pause.css sales-pause.test.mjs plugin-page.js plugin-rarity.js index.html; do
  if ! cp "$work/app/$file" "app/$file"; then
    tar -xzf "$backup"
    for name in "${created[@]}"; do rm -f -- "$name"; done
    echo 'Восстановлена резервная копия.'; exit 1
  fi
done
echo "Страница Пауза продаж обновлена. Обложки сохранены. Backup: $backup"
