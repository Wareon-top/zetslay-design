#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_ORDERS_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
lock=.zetslay-order-chronology.lock
mkdir "$lock" || { echo 'Обновление заказов уже выполняется.'; exit 1; }
work=$(mktemp -d)
backup=''
installed=false
committed=false
cleanup() {
 if [ "$installed" = true ] && [ "$committed" != true ]; then
  tar -xzf "$backup"
  echo "Обновление отменено. Backup: $backup"
 fi
 rm -rf "$work"
 rmdir "$lock"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
mkdir -p "$work/incoming" "$work/app" "$work/before"
for name in index.html orders.js orders.css orders.test.mjs; do
 git show "$revision:app/$name" > "$work/incoming/$name"
 test -f "app/$name" || { echo "Не найден установленный app/$name"; exit 1; }
 cp "app/$name" "$work/before/$name"
done
cp app/app.js "$work/before/app.js"
cp app/overview.js "$work/before/overview.js"
git show "$revision:deploy/stage-order-chronology.py" > "$work/stage.py"
python3 "$work/stage.py" app "$work/incoming" "$work/app"
git show "$revision:app/overview.test.mjs" > "$work/app/overview.test.mjs"
verify() {
 node --check "$1/app.js"
 node --check "$1/orders.js"
 node --test --test-concurrency=2 "$1/orders.test.mjs" "$1/overview.test.mjs"
}
if command -v node >/dev/null && [ "$(node -p 'Number(process.versions.node.split(".")[0])>=22')" = true ]; then
 verify "$work/app"
else
 docker run --rm --network none -v "$work/app:/work:ro" -w /work node:22-alpine sh -c 'node --check app.js && node --check orders.js && node --test --test-concurrency=2 orders.test.mjs overview.test.mjs'
fi
for name in index.html orders.js orders.css orders.test.mjs app.js overview.js; do
 cmp -s "app/$name" "$work/before/$name" || { echo "app/$name изменён во время проверки. Обновление остановлено."; exit 1; }
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-order-chronology.XXXXXX.tar.gz")
tar -czf "$backup" app/orders.js app/orders.css app/orders.test.mjs app/index.html
installed=true
# HTML is committed last so it never references absent resources.
for name in orders.js orders.css orders.test.mjs index.html; do
 candidate=$(mktemp "app/.zetslay-orders.XXXXXX")
 cp "$work/app/$name" "$candidate"
 chmod 644 "$candidate"
 mv -f "$candidate" "app/$name"
done
committed=true
echo "Заказы: новые первыми, периоды и календарь установлены из $revision."
echo "Backup: $backup"
echo 'Обновите страницу кабинета. Главная, авторизация и общая синхронизация сохранены.'
