#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-support-ui-update.lock
mkdir "$lock" || { echo 'Обновление поддержки уже выполняется.'; exit 1; }
work=$(mktemp -d); backup=''; complete=false
files=(index.html app.js admin-panel.js admin-finance.js admin-finance.css support.js support.css)
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
git fetch origin "${ZETSLAY_SUPPORT_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/incoming/deploy"
for file in app/support.js app/support.css app/support.test.mjs app/admin-finance.js app/admin-finance.css app/admin-finance.test.mjs app/admin-panel.js app/admin-panel.test.mjs deploy/stage-support.py deploy/stage-support.test.py; do git show "$revision:$file" > "$work/incoming/$file"; done
python3 "$work/incoming/deploy/stage-support.test.py"
python3 "$work/incoming/deploy/stage-support.py" "$PWD/app" "$work/incoming/app" "$work/staged"
cp "$work/incoming/app/"*.test.mjs "$work/staged/"
cp app/admin-panel.css "$work/staged/"
if command -v node >/dev/null 2>&1; then
 node --check "$work/staged/support.js"
 node --check "$work/staged/app.js"
 node --check "$work/staged/admin-finance.js"
 node --check "$work/staged/admin-panel.js"
 node --test "$work/staged/support.test.mjs" "$work/staged/admin-finance.test.mjs" "$work/staged/admin-panel.test.mjs"
else
 docker run --rm --network none -v "$work/staged:/work:ro" -w /work node:22-alpine sh -c 'node --check support.js && node --check app.js && node --check admin-finance.js && node --check admin-panel.js && node --test support.test.mjs admin-finance.test.mjs admin-panel.test.mjs'
fi
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-support-ui.XXXXXX")
chmod 700 "$backup"
for file in "${files[@]}"; do if [ -f "app/$file" ]; then cp -p "app/$file" "$backup/$file"; fi; done
for file in "${files[@]}"; do candidate=$(mktemp app/.admin-finance.XXXXXX); if ! cp "$work/staged/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "app/$file"; then rm -f "$candidate"; exit 1; fi; done
complete=true
echo "Раздел поддержки и очередь обращений установлены. Backup: $backup"
echo 'Ctrl+F5 → Поддержка. Ответы пользователям: Админ-панель → Поддержка.'
