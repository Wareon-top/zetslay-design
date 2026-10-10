#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-steam-rent-update.lock
mkdir "$lock" || { echo 'Обновление Steam Rent уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_STEAM_RENT_UI_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/original"
# Local cabinet customizations are retained by a narrow, validated patch.
assets=(steam-rent.js steam-rent.css steam-rent.test.mjs)
for file in index.html "${assets[@]}"; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-steam-rent-ui.py" > "$work/stage.py"
for file in index.html plugin-page.js plugin-rarity.js; do cp -p "app/$file" "$work/original/$file"; done
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
if command -v node >/dev/null 2>&1; then
  node --check "$work/app/steam-rent.js"
  node --check "$work/app/plugin-page.js"
  node --check "$work/app/plugin-rarity.js"
  node --test "$work/app/steam-rent.test.mjs"
else
  docker run --rm --network none -v "$work/app:/work:ro" -w /work node:22-alpine \
    sh -c 'node --check steam-rent.js && node --check plugin-page.js && node --check plugin-rarity.js && node --test steam-rent.test.mjs'
fi
for file in index.html plugin-page.js plugin-rarity.js; do
  cmp -s "app/$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
done
files=(app/index.html app/plugin-page.js app/plugin-rarity.js); created=()
for file in "${assets[@]}"; do
  if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-steam-rent.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" "${files[@]}"
for file in index.html plugin-page.js plugin-rarity.js "${assets[@]}"; do
  if ! cp "$work/app/$file" "app/$file"; then
    tar -xzf "$backup"
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Файлы восстановлены. Backup: $backup"
    exit 1
  fi
done
echo "Steam Rent добавлен в кабинет: настройки, парк аккаунтов, аренды и журнал. Backup: $backup"
echo 'Остальные разделы и настройки не изменены. Нажмите Ctrl+F5.'
