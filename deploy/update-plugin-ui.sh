#!/usr/bin/env bash
set -euo pipefail
site_dir=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
backup_dir=${ZETSLAY_BACKUP_DIR:-/root}
cd "$site_dir"
git fetch origin codex/landing-light-dark-redesign
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock="$site_dir/.zetslay-plugin-update.lock"
mkdir "$lock" || { echo 'Другое обновление плагинов уже запущено.'; rm -rf "$work"; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming/assets/plugin-covers" "$work/app"
files=(app/plugin-page.js app/plugin-page.css app/plugin-page.test.mjs app/plugin-cover.js app/plugin-cover.css app/plugin-cover.test.mjs)
for category in chat sales analytics control; do files+=("app/assets/plugin-covers/$category.svg"); done
for file in "${files[@]}" app/app.js app/index.html app/app.test.mjs; do git show "$revision:$file" > "$work/incoming/${file#app/}"; done
git show 'e27fb9dff8cfe323789ebce08b43878f060cbc67:app/app.js' > "$work/incoming/base-app.js"
git show "$revision:deploy/stage-plugin-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$site_dir/app" "$work/incoming" "$work/app"
test_files=(plugin-page.test.mjs plugin-cover.test.mjs)
for module in overview orders messages; do
  if [ -f "$site_dir/app/$module.js" ]; then
    cp "$site_dir/app/$module.js" "$work/app/$module.js"
    git show "$revision:app/$module.test.mjs" > "$work/app/$module.test.mjs"
    if [ -f "$site_dir/app/$module.css" ]; then cp "$site_dir/app/$module.css" "$work/app/$module.css"; fi
    test_files+=("$module.test.mjs")
  fi
done
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check app.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check plugin-page.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test "${test_files[@]}" </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test \
  --test-name-pattern='plugin|catalog|admin|existing session|expired session|registration link|demo activation' \
  catalog-regression.test.mjs </dev/null

if [ -f "$site_dir/app/app.test.mjs" ]; then files+=(app/app.test.mjs); fi
files+=(app/app.js app/index.html)
existing=()
created=()
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "$backup_dir/zetslay-site-before-plugin-page.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback() {
  tar -xzf "$backup"
  for file in "${created[@]}"; do rm -f -- "$file"; done
  echo "Обновление отменено. Резервная копия: $backup"
}
for file in "${files[@]}"; do
  if ! mkdir -p "$(dirname "$file")" || ! candidate=$(mktemp "$(dirname "$file")/.zetslay-plugin.XXXXXX"); then rollback; exit 1; fi
  if ! cp "$work/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then
    rm -f "$candidate"
    rollback
    exit 1
  fi
done
echo "Страницы плагинов обновлены из $revision. Резервная копия: $backup"
echo 'Откройте кабинет с Ctrl+F5. Перезапуск Docker Compose не требуется.'
