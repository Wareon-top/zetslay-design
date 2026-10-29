#!/usr/bin/env bash
set -euo pipefail
site_dir=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
backup_dir=${ZETSLAY_BACKUP_DIR:-/root}
cd "$site_dir"
git fetch origin codex/landing-light-dark-redesign
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock="$site_dir/.zetslay-orders-update.lock"
mkdir "$lock" || { echo 'Другое обновление заказов уже запущено.'; rm -rf "$work"; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in index.html app.js app.test.mjs orders.js orders.css orders.test.mjs; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-orders-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$site_dir/app" "$work/incoming" "$work/app"
cp "$work/incoming/app.test.mjs" "$work/app/app.test.mjs"
git show "$revision:app/overview.test.mjs" > "$work/app/overview.test.mjs"

# Test the staged VPS code, including its existing overview model and auth fixes.
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check app.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check orders.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test orders.test.mjs overview.test.mjs </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test \
  --test-name-pattern='existing session|expired session|demo activation' app.test.mjs </dev/null

files=(app/orders.js app/orders.css app/orders.test.mjs app/app.js app/index.html)
existing=()
created=()
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "$backup_dir/zetslay-site-before-orders.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback() {
  tar -xzf "$backup"
  for file in "${created[@]}"; do rm -f -- "$file"; done
  echo "Обновление отменено. Резервная копия: $backup"
}
for file in "${files[@]}"; do
  if ! candidate=$(mktemp "$(dirname "$file")/.zetslay-orders.XXXXXX"); then
    rollback
    exit 1
  fi
  if ! cp "$work/${file}" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then
    rm -f "$candidate"
    rollback
    exit 1
  fi
done
echo "Заказы обновлены из $revision. Резервная копия: $backup"
echo 'Откройте кабинет с Ctrl+F5. Перезапуск Docker Compose не требуется.'
