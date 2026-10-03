#!/usr/bin/env bash
set -euo pipefail
site_dir=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
backup_dir=${ZETSLAY_BACKUP_DIR:-/root}
cd "$site_dir"
git fetch origin codex/landing-light-dark-redesign
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock="$site_dir/.zetslay-messages-update.lock"
mkdir "$lock" || { echo 'Другое обновление сообщений уже запущено.'; rm -rf "$work"; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in index.html app.js app.test.mjs messages.js messages.css messages.test.mjs; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-messages-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$site_dir/app" "$work/incoming" "$work/app"

# Validate the actual staged VPS code before changing any served file.
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check app.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check messages.js </dev/null
tests=(messages.test.mjs)
for module in overview orders plugin-page plugin-cover; do
  if [ -f "$work/app/$module.js" ] && [ -f "$work/app/$module.test.mjs" ]; then tests+=("$module.test.mjs"); fi
done
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test "${tests[@]}" </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test \
  --test-name-pattern='existing session|expired session|demo activation' cabinet-regression.test.mjs </dev/null

files=(app/messages.js app/messages.css app/messages.test.mjs app/app.js app/index.html)
existing=()
created=()
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "$backup_dir/zetslay-site-before-messages.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback() {
  tar -xzf "$backup"
  for file in "${created[@]}"; do rm -f -- "$file"; done
  echo "Обновление отменено. Резервная копия: $backup"
}
for file in "${files[@]}"; do
  if ! candidate=$(mktemp "$(dirname "$file")/.zetslay-messages.XXXXXX"); then
    rollback
    exit 1
  fi
  if ! cp "$work/${file}" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then
    rm -f "$candidate"
    rollback
    exit 1
  fi
done
echo "Сообщения обновлены из $revision. Резервная копия: $backup"
echo 'Откройте кабинет с Ctrl+F5. Перезапуск Docker Compose не требуется.'
