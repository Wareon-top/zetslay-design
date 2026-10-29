#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock="$PWD/.zetslay-robux-relay-ui-update.lock"
mkdir "$lock" || { echo 'Обновление Robux Relay уже выполняется.'; exit 1; }
work=''
cleanup() { if [ -n "$work" ]; then rm -rf -- "$work"; fi; rmdir "$lock"; }
trap cleanup EXIT
work=$(mktemp -d)
git fetch origin "${ZETSLAY_ROBUX_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/deploy"
for file in robux-relay.js robux-relay.css robux-relay.test.mjs; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
for file in stage-robux-relay-ui.py stage-robux-relay-ui.test.py; do
  git show "$revision:deploy/$file" > "$work/deploy/$file"
done
python3 "$work/deploy/stage-robux-relay-ui.test.py"
python3 "$work/deploy/stage-robux-relay-ui.py" "$PWD/app" "$work/incoming" "$work/staged"
docker run --rm -v "$work/incoming:/work:ro" -w /work node:22-alpine node --test robux-relay.test.mjs
for file in robux-relay.js plugin-page.js plugin-rarity.js app.js; do
  docker run --rm -v "$work/staged:/work:ro" -w /work node:22-alpine node --check "$file"
done
backup=$(mktemp -d /root/zetslay-site-before-robux-relay.XXXXXX)
chmod 700 "$backup"
files=(index.html plugin-page.js plugin-rarity.js app.js robux-relay.js robux-relay.css)
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
echo "Robux Relay добавлен в кабинет. Backup: $backup"
echo 'Нажмите Ctrl+F5. Плагины → Robux Relay → Подробнее → Установить.'
