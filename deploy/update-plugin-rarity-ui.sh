#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_RARITY_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-plugin-rarity-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in plugin-rarity.js plugin-rarity.css; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-plugin-rarity-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
for file in app.js plugin-page.js plugin-rarity.js; do
  docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check "$file" </dev/null
done
files=(app/app.js app/plugin-page.js app/index.html)
for file in plugin-rarity.js plugin-rarity.css; do if [ -f "app/$file" ]; then files+=("app/$file"); fi; done
backup=$(mktemp /root/zetslay-site-before-plugin-rarity.XXXXXX.tar.gz)
tar -czf "$backup" "${files[@]}"
# Install new assets first, then their references and the page changes.
for file in plugin-rarity.js plugin-rarity.css app.js plugin-page.js index.html; do
  if ! cp "$work/app/$file" "app/$file"; then tar -xzf "$backup"; echo 'Файлы восстановлены из резервной копии.'; exit 1; fi
done
echo "Редкости добавлены, баннер Подробнее удалён. Резервная копия: $backup"
