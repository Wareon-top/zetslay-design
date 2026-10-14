#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-managed-proxy-update.lock
mkdir "$lock" || { echo 'Обновление прокси уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_MANAGED_PROXY_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/original" "$work/incoming" "$work/tests"
cp -p app/index.html "$work/original/index.html"
for file in managed-proxy-ui.js managed-proxy-ui.css; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-managed-proxy.py" > "$work/stage.py"
git show "$revision:deploy/stage-managed-proxy.test.py" > "$work/stage-managed-proxy.test.py"
cp "$work/stage.py" "$work/stage-managed-proxy.py"
python3 "$work/stage-managed-proxy.test.py"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
cp "$work/incoming/managed-proxy-ui.js" "$work/tests/managed-proxy-ui.js"
git show "$revision:app/managed-proxy-ui.test.mjs" > "$work/tests/managed-proxy-ui.test.mjs"
if command -v node >/dev/null 2>&1; then
 node --check "$work/tests/managed-proxy-ui.js"
 node --test "$work/tests/managed-proxy-ui.test.mjs"
else
 docker run --rm --network none -v "$work/tests:/work:ro" -w /work node:22-alpine sh -c 'node --check managed-proxy-ui.js && node --test managed-proxy-ui.test.mjs'
fi
cmp -s app/index.html "$work/original/index.html" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-managed-proxy-ui.XXXXXX")
chmod 700 "$backup"
for file in index.html managed-proxy-ui.js managed-proxy-ui.css; do
 if [ -f "app/$file" ]; then cp -p "app/$file" "$backup/$file"; else touch "$backup/$file.absent"; fi
done
restore(){ for file in index.html managed-proxy-ui.js managed-proxy-ui.css; do if [ -f "$backup/$file.absent" ]; then rm -f "app/$file"; else cp -p "$backup/$file" "app/$file"; fi; done; }
for file in managed-proxy-ui.js managed-proxy-ui.css index.html; do
 if ! cp "$work/out/$file" "app/$file"; then restore; echo "Файлы восстановлены. Backup: $backup"; exit 1; fi
done
echo "Управляемый прокси в кабинете и админ-панели установлен. Backup: $backup"
echo 'Нажмите Ctrl+F5. Профиль → Управлять подключением → Управляемый прокси. Админ-панель → Прокси и сроки.'
