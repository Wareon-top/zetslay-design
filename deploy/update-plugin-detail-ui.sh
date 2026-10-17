#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock='.zetslay-plugin-detail-ui-update.lock'
mkdir "$lock" || { echo 'Обновление страницы плагина уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_PLUGIN_DETAIL_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming"
assets=(plugin-detail-ui.js plugin-detail-ui.css plugin-detail-ui.test.mjs)
for file in "${assets[@]}"; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-plugin-detail-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
sudo docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check plugin-detail-ui.js
sudo docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test plugin-detail-ui.test.mjs
files=(app/index.html)
created=()
for file in "${assets[@]}"; do
  if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp /root/zetslay-site-before-plugin-details.XXXXXX.tar.gz)
tar -czf "$backup" "${files[@]}"
for file in "${assets[@]}" index.html; do
  if ! cp "$work/app/$file" "app/$file"; then
    tar -xzf "$backup"
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Ошибка копирования. Сайт восстановлен. Резервная копия: $backup"
    exit 1
  fi
done
echo "Новая страница «Подробнее» установлена. Резервная копия: $backup"
echo 'Исходные модули, настройки, обложки и API-адрес сохранены. Обновите кабинет через Ctrl+F5.'
