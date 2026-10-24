#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-ai-reviews-update.lock
mkdir "$lock" || { echo 'Обновление AI Reviews уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_AI_REVIEWS_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/original" "$work/incoming" "$work/tests/app" "$work/tests/deploy"
existing=(index.html plugin-page.js plugin-rarity.js subscription-access.js)
new=(ai-reviews.js ai-reviews.css)
for file in "${existing[@]}"; do cp -p "app/$file" "$work/original/$file"; done
for file in "${new[@]}"; do
  if [ -e "app/$file" ]; then cp -p "app/$file" "$work/original/$file"; fi
  git show "$revision:app/$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-ai-reviews.py" > "$work/tests/deploy/stage-ai-reviews.py"
git show "$revision:deploy/stage-ai-reviews.test.py" > "$work/tests/deploy/stage-ai-reviews.test.py"
python3 "$work/tests/deploy/stage-ai-reviews.py" "$work/original" "$work/incoming" "$work/out"
for file in "${existing[@]}" "${new[@]}"; do cp "$work/out/$file" "$work/tests/app/$file"; done
git show "$revision:app/ai-reviews.test.mjs" > "$work/tests/app/ai-reviews.test.mjs"
python3 "$work/tests/deploy/stage-ai-reviews.test.py"
if command -v node >/dev/null 2>&1; then
  node --check "$work/out/ai-reviews.js"
  node --check "$work/out/plugin-page.js"
  node --test "$work/tests/app/ai-reviews.test.mjs"
else
  docker run --rm --network none -v "$work/tests:/work:ro" -w /work node:22-alpine sh -c 'node --check app/ai-reviews.js && node --check app/plugin-page.js && node --test app/ai-reviews.test.mjs'
fi
for file in "${existing[@]}"; do cmp -s "app/$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки.'; exit 1; }; done
for file in "${new[@]}"; do
  if [ -f "$work/original/$file" ]; then cmp -s "app/$file" "$work/original/$file" || exit 1
  else [ ! -e "app/$file" ] || exit 1; fi
done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-ai-reviews-ui.XXXXXX")
chmod 700 "$backup"
for file in "${existing[@]}" "${new[@]}"; do if [ -e "app/$file" ]; then cp -p "app/$file" "$backup/$file"; else touch "$backup/$file.absent"; fi; done
for file in "${new[@]}" "${existing[@]}"; do
  if ! cp "$work/out/$file" "app/$file"; then
    for saved in "${existing[@]}" "${new[@]}"; do if [ -f "$backup/$saved.absent" ]; then rm -f "app/$saved"; else cp -p "$backup/$saved" "app/$saved"; fi; done
    echo "Файлы восстановлены. Backup: $backup"; exit 1
  fi
done
echo "Кабинет AI Reviews установлен. Backup: $backup"
echo 'Ctrl+F5 → Плагины → AI Reviews → Подробнее. Ключи вводятся только в кабинете.'
