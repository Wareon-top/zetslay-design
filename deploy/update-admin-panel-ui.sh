#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock="$PWD/.zetslay-admin-panel-ui-update.lock"
mkdir "$lock" || { echo 'Обновление админ-панели уже выполняется.'; exit 1; }
work=''
cleanup() { if [ -n "$work" ]; then rm -rf -- "$work"; fi; rmdir "$lock"; }
trap cleanup EXIT
work=$(mktemp -d)
git fetch origin "${ZETSLAY_ADMIN_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/deploy"
for file in admin-panel.js admin-panel.css admin-panel.test.mjs; do git show "$revision:app/$file" > "$work/incoming/$file"; done
for file in stage-admin-panel-ui.py stage-admin-panel-ui.test.py; do git show "$revision:deploy/$file" > "$work/deploy/$file"; done
python3 "$work/deploy/stage-admin-panel-ui.test.py"
python3 "$work/deploy/stage-admin-panel-ui.py" "$PWD/app" "$work/incoming" "$work/staged"
# Tests inspect the actual staged integration, including all retained customizations.
cp "$work/incoming/admin-panel.test.mjs" "$work/staged/admin-panel.test.mjs"
docker run --rm -v "$work/staged:/work:ro" -w /work node:22-alpine node --test admin-panel.test.mjs
for file in app.js admin-panel.js; do docker run --rm -v "$work/staged:/work:ro" -w /work node:22-alpine node --check "$file"; done
backup=$(mktemp -d /root/zetslay-site-before-admin-panel.XXXXXX)
chmod 700 "$backup"
files=(index.html app.js admin-panel.js admin-panel.css)
for file in "${files[@]}"; do if [ -f "app/$file" ]; then cp -p "app/$file" "$backup/$file"; fi; done
restore() { for file in "${files[@]}"; do if [ -f "$backup/$file" ]; then cp -p "$backup/$file" "app/$file"; else rm -f -- "app/$file"; fi; done; }
for file in "${files[@]}"; do if ! cp "$work/staged/$file" "app/$file"; then restore; echo "Кабинет восстановлен. Backup: $backup"; exit 1; fi; done
echo "Админ-панель добавлена в существующий кабинет. Backup: $backup"
echo 'Ctrl+F5 → Админ-панель. Войдите с существующим Telegram ID 5062414502.'
