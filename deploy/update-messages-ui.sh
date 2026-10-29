#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-messages-workspace-update.lock
mkdir "$lock" || { echo 'Обновление сообщений уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_MESSAGES_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/original" "$work/incoming" "$work/tests"
cp -p app/index.html "$work/original/index.html"
cp -p app/app.js "$work/original/app.js"
for file in index.html messages.js messages.css messages-actions.js; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-messages-workspace.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
for file in messages.js messages-actions.js; do cp "$work/out/$file" "$work/tests/$file"; done
cp "$work/out/index.html" "$work/tests/index.html"
cp "$work/original/app.js" "$work/tests/app.js"
for file in messages.test.mjs messages-actions.test.mjs; do git show "$revision:app/$file" > "$work/tests/$file"; done
if command -v node >/dev/null 2>&1; then
 node --check "$work/tests/messages.js"
 node --check "$work/tests/messages-actions.js"
 node --test "$work/tests/messages.test.mjs" "$work/tests/messages-actions.test.mjs"
else
 docker run --rm --network none -v "$work/tests:/work:ro" -w /work node:22-alpine sh -c 'node --check messages.js && node --check messages-actions.js && node --test messages.test.mjs messages-actions.test.mjs'
fi
for file in index.html app.js; do cmp -s "app/$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }; done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-messages-workspace-ui.XXXXXX")
chmod 700 "$backup"
for file in index.html messages.js messages.css messages-actions.js; do
 if [ -f "app/$file" ]; then cp -p "app/$file" "$backup/$file"; else touch "$backup/$file.absent"; fi
done
restore(){ for file in index.html messages.js messages.css messages-actions.js; do if [ -f "$backup/$file.absent" ]; then rm -f "app/$file"; else cp -p "$backup/$file" "app/$file"; fi; done; }
for file in messages.js messages.css messages-actions.js index.html; do
 if ! cp "$work/out/$file" "app/$file"; then restore; echo "Файлы восстановлены. Backup: $backup"; exit 1; fi
done
echo "Раздел Сообщения обновлён. Backup: $backup"
echo 'Нажмите Ctrl+F5. Отправка требует активного тарифа и проверенного магазина. Неопределённые сообщения автоматически не повторяются.'
