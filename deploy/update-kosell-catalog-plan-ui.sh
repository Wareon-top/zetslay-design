#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock="$PWD/.zetslay-kosell-settings-update.lock"
mkdir "$lock" || { echo 'Обновление Kosell уже выполняется.'; exit 1; }
work=''
cleanup() { if [ -n "$work" ]; then rm -rf -- "$work"; fi; rmdir "$lock"; }
trap cleanup EXIT
work=$(mktemp -d)
git fetch origin "${ZETSLAY_KOSELL_CATALOG_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/deploy"
for file in kosell-rent.js kosell-rent.test.mjs plugin-page.js plugin-rarity.js index.html; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
for file in stage-kosell-settings-fix.py stage-kosell-settings-fix.test.py; do
  git show "$revision:deploy/$file" > "$work/deploy/$file"
done
# Run staging checks against the downloaded module without touching the live site.
mkdir -p "$work/app"
cp "$work/incoming/kosell-rent.js" "$work/app/kosell-rent.js"
python3 "$work/deploy/stage-kosell-settings-fix.test.py"
python3 "$work/deploy/stage-kosell-settings-fix.py" "$PWD/app" "$work/incoming" "$work/staged"
cp "$work/staged/kosell-rent.js" "$work/incoming/kosell-rent.js"
sudo docker run --rm -v "$work/incoming:/work:ro" -w /work node:22-alpine node --check kosell-rent.js
sudo docker run --rm -v "$work/incoming:/work:ro" -w /work node:22-alpine node --test kosell-rent.test.mjs
backup=$(mktemp /root/zetslay-site-before-kosell-catalog.XXXXXX.tar.gz)
tar -czf "$backup" app/kosell-rent.js app/index.html
for file in kosell-rent.js index.html; do
  if ! cp "$work/staged/$file" "app/$file"; then
    tar -xzf "$backup"
    echo "Сайт восстановлен. Резервная копия: $backup"
    exit 1
  fi
done
echo "Массовая витрина Kosell обновлена. Резервная копия: $backup"
echo 'Нажмите Ctrl+F5. План и ошибки теперь отображаются под кнопкой массовой витрины.'
