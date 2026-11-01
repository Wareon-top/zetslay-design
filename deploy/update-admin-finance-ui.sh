#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-admin-finance-ui-update.lock
mkdir "$lock" || { echo 'Обновление статистики уже выполняется.'; exit 1; }
work=$(mktemp -d); backup=''; complete=false
files=(index.html admin-panel.js admin-finance.js admin-finance.css)
cleanup(){
 local result=$?
 if [ -n "$backup" ] && [ "$complete" = false ]; then
  for file in "${files[@]}"; do if [ -f "$backup/$file" ]; then cp -p "$backup/$file" "app/$file"; else rm -f "app/$file"; fi; done
  echo "Интерфейс восстановлен. Backup: $backup"
 fi
 rm -rf "$work"; rmdir "$lock"
 return "$result"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_ADMIN_FINANCE_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/incoming/deploy"
for file in app/admin-finance.js app/admin-finance.css app/admin-finance.test.mjs app/admin-panel.js app/admin-panel.test.mjs deploy/stage-admin-finance.py deploy/stage-admin-finance.test.py; do git show "$revision:$file" > "$work/incoming/$file"; done
python3 "$work/incoming/deploy/stage-admin-finance.test.py"
python3 "$work/incoming/deploy/stage-admin-finance.py" "$PWD/app" "$work/incoming/app" "$work/staged"
cp "$work/incoming/app/"*.test.mjs "$work/staged/"
cp app/admin-panel.css app/app.js "$work/staged/"
if command -v node >/dev/null 2>&1; then
 node --check "$work/staged/admin-finance.js"
 node --check "$work/staged/admin-panel.js"
 node --test "$work/staged/admin-finance.test.mjs" "$work/staged/admin-panel.test.mjs"
else
 docker run --rm --network none -v "$work/staged:/work:ro" -w /work node:22-alpine sh -c 'node --check admin-finance.js && node --check admin-panel.js && node --test admin-finance.test.mjs admin-panel.test.mjs'
fi
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-admin-finance-ui.XXXXXX")
chmod 700 "$backup"
for file in "${files[@]}"; do if [ -f "app/$file" ]; then cp -p "app/$file" "$backup/$file"; fi; done
for file in "${files[@]}"; do candidate=$(mktemp app/.admin-finance.XXXXXX); if ! cp "$work/staged/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "app/$file"; then rm -f "$candidate"; exit 1; fi; done
complete=true
echo "Статистика доходов добавлена в админ-панель. Backup: $backup"
echo 'Ctrl+F5 → Админ-панель → Доходы проекта.'
