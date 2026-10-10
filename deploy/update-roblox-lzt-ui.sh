#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock="$PWD/.zetslay-roblox-lzt-ui-update.lock"
mkdir "$lock" || { echo 'Обновление Roblox LZT Market уже выполняется.'; exit 1; }
work=''
cleanup() { if [ -n "$work" ]; then rm -rf -- "$work"; fi; rmdir "$lock"; }
trap cleanup EXIT
work=$(mktemp -d)
git fetch origin "${ZETSLAY_ROBLOX_LZT_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/deploy"
for file in roblox-lzt-market.js roblox-lzt-market.css roblox-lzt-market.test.mjs tiktok-lzt-market.js; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
for file in stage-roblox-lzt-ui.py stage-roblox-lzt-ui.test.py; do
  git show "$revision:deploy/$file" > "$work/deploy/$file"
done
python3 "$work/deploy/stage-roblox-lzt-ui.test.py"
python3 "$work/deploy/stage-roblox-lzt-ui.py" "$PWD/app" "$work/incoming" "$work/staged"
docker run --rm -v "$work/incoming:/work:ro" -w /work node:22-alpine node --test roblox-lzt-market.test.mjs
for file in roblox-lzt-market.js plugin-page.js plugin-rarity.js; do
  docker run --rm -v "$work/staged:/work:ro" -w /work node:22-alpine node --check "$file"
done
backup=$(mktemp -d /root/zetslay-site-before-roblox-lzt.XXXXXX)
chmod 700 "$backup"
files=(index.html plugin-page.js plugin-rarity.js roblox-lzt-market.js roblox-lzt-market.css)
for file in "${files[@]}"; do
  if [ -f "app/$file" ]; then cp -p "app/$file" "$backup/$file"; fi
done
restore() {
  for file in "${files[@]}"; do
    if [ -f "$backup/$file" ]; then cp -p "$backup/$file" "app/$file"; else rm -f -- "app/$file"; fi
  done
}
for file in "${files[@]}"; do
  if ! cp "$work/staged/$file" "app/$file"; then
    restore
    echo "Кабинет восстановлен. Backup: $backup"
    exit 1
  fi
done
echo "Roblox LZT Market добавлен в кабинет. Backup: $backup"
echo 'Нажмите Ctrl+F5. Плагины → Roblox LZT Market → Подробнее → Установить.'
