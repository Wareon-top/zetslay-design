#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock='.zetslay-catalog-ui-update.lock'
mkdir "$lock" || { echo 'Обновление каталога уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_CATALOG_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming"
git show "$revision:app/plugin-catalog.css" > "$work/incoming/plugin-catalog.css"
git show "$revision:deploy/stage-plugin-catalog-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
files=(app/index.html)
created=false
if [ -f app/plugin-catalog.css ]; then files+=(app/plugin-catalog.css); else created=true; fi
backup=$(mktemp /root/zetslay-site-before-catalog-ui.XXXXXX.tar.gz)
tar -czf "$backup" "${files[@]}"
for file in plugin-catalog.css index.html; do
  if ! cp "$work/app/$file" "app/$file"; then
    tar -xzf "$backup"
    if [ "$created" = true ]; then rm -f app/plugin-catalog.css; fi
    echo "Ошибка копирования. Сайт восстановлен. Backup: $backup"
    exit 1
  fi
done
echo "Компактный каталог плагинов установлен. Backup: $backup"
echo 'Обложки, app.js и API-адрес сохранены. Обновите кабинет через Ctrl+F5.'
