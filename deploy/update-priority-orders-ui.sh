#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-priority-orders-update.lock
mkdir "$lock" || { echo 'Обновление приоритетных заказов уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_PRIORITY_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/original" "$work/incoming" "$work/tests"
cp -p app/index.html "$work/original/index.html"
cp -p app/app.js "$work/original/app.js"
cp -p app/plugin-page.js "$work/original/plugin-page.js"
cp -p app/plugin-rarity.js "$work/original/plugin-rarity.js"
for file in index.html priority-orders.js priority-orders.css; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-priority-orders.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
for file in priority-orders.js plugin-page.js plugin-rarity.js; do cp "$work/out/$file" "$work/tests/$file"; done
cp "$work/out/index.html" "$work/tests/index.html"
cp "$work/original/app.js" "$work/tests/app.js"
for file in priority-orders.test.mjs; do git show "$revision:app/$file" > "$work/tests/$file"; done
if command -v node >/dev/null 2>&1; then
 node --check "$work/tests/priority-orders.js"
 node --check "$work/tests/plugin-page.js"
 node --check "$work/tests/plugin-rarity.js"
 node --test "$work/tests/priority-orders.test.mjs"
else
 docker run --rm --network none -v "$work/tests:/work:ro" -w /work node:22-alpine sh -c 'node --check priority-orders.js && node --check plugin-page.js && node --check plugin-rarity.js && node --test priority-orders.test.mjs'
fi
for file in index.html app.js plugin-page.js plugin-rarity.js; do cmp -s "app/$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }; done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-priority-orders-ui.XXXXXX")
chmod 700 "$backup"
for file in index.html priority-orders.js priority-orders.css plugin-page.js plugin-rarity.js; do
 if [ -f "app/$file" ]; then cp -p "app/$file" "$backup/$file"; else touch "$backup/$file.absent"; fi
done
restore(){ for file in index.html priority-orders.js priority-orders.css plugin-page.js plugin-rarity.js; do if [ -f "$backup/$file.absent" ]; then rm -f "app/$file"; else cp -p "$backup/$file" "app/$file"; fi; done; }
for file in priority-orders.js priority-orders.css plugin-page.js plugin-rarity.js index.html; do
 if ! cp "$work/out/$file" "app/$file"; then restore; echo "Файлы восстановлены. Backup: $backup"; exit 1; fi
done
echo "Приоритетные заказы добавлены в кабинет. Backup: $backup"
echo 'Ctrl+F5 → Плагины → Приоритетные заказы. Установите модуль, настройте пороги и включите мониторинг. Старые заказы пропускаются.'
