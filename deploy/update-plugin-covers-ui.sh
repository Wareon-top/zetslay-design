#!/usr/bin/env bash
set -euo pipefail
site_dir=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
backup_dir=${ZETSLAY_BACKUP_DIR:-/root}
cd "$site_dir"
git fetch origin codex/landing-light-dark-redesign
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock="$site_dir/.zetslay-plugin-cover-update.lock"
mkdir "$lock" || { echo 'Другое обновление обложек уже запущено.'; rm -rf "$work"; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in app.js index.html app.test.mjs plugin-page.js plugin-page.test.mjs plugin-cover.js plugin-cover.css plugin-cover.test.mjs; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show '18f3b413c32d51b75c67266c58fb262fc91e9918:app/app.js' > "$work/incoming/base-app.js"
git show '18f3b413c32d51b75c67266c58fb262fc91e9918:app/plugin-page.js' > "$work/incoming/base-plugin-page.js"
git show "$revision:deploy/stage-plugin-covers-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$site_dir/app" "$work/incoming" "$work/app"
for file in app.js plugin-page.js plugin-cover.js; do docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check "$file" </dev/null; done
tests=(plugin-cover.test.mjs plugin-page.test.mjs)
for module in overview orders messages; do
  if [ -f "$work/app/$module.js" ] && [ -f "$work/app/$module.test.mjs" ]; then tests+=("$module.test.mjs"); fi
done
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test "${tests[@]}" </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test \
  --test-name-pattern='plugin|catalog|admin|existing session|expired session|demo activation' catalog-regression.test.mjs </dev/null
files=(app/plugin-cover.js app/plugin-cover.css app/plugin-cover.test.mjs app/plugin-page.js app/plugin-page.test.mjs app/app.js app/index.html)
existing=()
created=()
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "$backup_dir/zetslay-site-before-plugin-covers.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback() {
  tar -xzf "$backup"
  for file in "${created[@]}"; do rm -f -- "$file"; done
  echo "Обновление отменено. Резервная копия: $backup"
}
for file in "${files[@]}"; do
  if ! candidate=$(mktemp "$(dirname "$file")/.zetslay-plugin-cover.XXXXXX"); then rollback; exit 1; fi
  if ! cp "$work/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then
    rm -f "$candidate"; rollback; exit 1
  fi
done
echo "Обложки обновлены из $revision. Резервная копия: $backup"
echo 'Для загрузки без сильного сжатия API также должен быть обновлён. Затем Ctrl+F5 и повторная загрузка исходной обложки.'
