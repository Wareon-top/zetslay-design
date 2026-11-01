#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-cabinet-polish-update.lock
mkdir "$lock" || { echo 'Обновление оформления уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_CABINET_POLISH_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/original"
assets=(learning.js learning.css learning.test.mjs cabinet-demo.js cabinet-demo.css cabinet-demo.test.mjs subscription-access.js subscription-access.css subscription-access.test.mjs sidebar-trial.css sidebar-trial.test.mjs)
for file in "${assets[@]}"; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-cabinet-polish-ui.py" > "$work/stage.py"
cp -p app/index.html "$work/original/index.html"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
# Required by integration tests; keep the installed sidebar behaviour intact.
git show "$revision:app/sidebar-trial.js" > "$work/out/sidebar-trial.js"
if command -v node >/dev/null 2>&1; then
  for file in learning.js cabinet-demo.js subscription-access.js; do node --check "$work/out/$file"; done
  node --test "$work/out/learning.test.mjs" "$work/out/cabinet-demo.test.mjs" "$work/out/subscription-access.test.mjs" "$work/out/sidebar-trial.test.mjs"
else
  docker run --rm --network none -v "$work/out:/work:ro" -w /work node:22-alpine \
    sh -c 'node --check learning.js && node --check cabinet-demo.js && node --check subscription-access.js && node --test learning.test.mjs cabinet-demo.test.mjs subscription-access.test.mjs sidebar-trial.test.mjs'
fi
cmp -s app/index.html "$work/original/index.html" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
files=(app/index.html); created=()
for file in "${assets[@]}"; do
  if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-cabinet-polish.XXXXXX.tar.gz")
chmod 600 "$backup"; tar -czf "$backup" "${files[@]}"
# Publish the HTML references last, after every asset and its checks pass.
for file in "${assets[@]}" index.html; do
  if ! cp "$work/out/$file" "app/$file"; then
    tar -xzf "$backup"
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Файлы восстановлены. Backup: $backup"; exit 1
  fi
done
echo "Оформление обучения и демонстрации кабинета обновлено. Backup: $backup"
echo 'Обновите страницу через Ctrl+F5. Обучение можно повторить из базы знаний.'
