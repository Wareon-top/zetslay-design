#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-proxy-replacement-update.lock
mkdir "$lock" || { echo 'Обновление замены прокси уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_PROXY_REPLACEMENT_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/original" "$work/incoming" "$work/tests"
for file in index.html app.js; do cp -p "app/$file" "$work/original/$file"; done
git show "$revision:app/app.js" > "$work/incoming/app.js"
git show "$revision:deploy/stage-proxy-replacement.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
cp "$work/out/app.js" "$work/tests/app.js"
git show "$revision:app/app.test.mjs" > "$work/tests/app.test.mjs"
if command -v node >/dev/null 2>&1; then
 node --check "$work/out/app.js"
 node --test "$work/tests/app.test.mjs"
else
 docker run --rm --network none -v "$work/tests:/work:ro" -w /work node:22-alpine sh -c 'node --check app.js && node --test app.test.mjs'
fi
for file in index.html app.js; do cmp -s "app/$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }; done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-proxy-replacement-ui.XXXXXX")
chmod 700 "$backup"
for file in index.html app.js; do cp -p "app/$file" "$backup/$file"; done
for file in app.js index.html; do
 if ! cp "$work/out/$file" "app/$file"; then
  for saved in index.html app.js; do cp -p "$backup/$saved" "app/$saved"; done
  echo "Файлы восстановлены. Backup: $backup"; exit 1
 fi
done
echo "Замена прокси в профиле установлена. Backup: $backup"
echo 'Нажмите Ctrl+F5. Профиль → Управлять подключением → Изменить прокси.'
