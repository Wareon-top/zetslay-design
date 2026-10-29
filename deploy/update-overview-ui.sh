#!/usr/bin/env bash
set -euo pipefail
site_dir=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
backup_dir=${ZETSLAY_BACKUP_DIR:-/root}
cd "$site_dir"
git fetch origin codex/landing-light-dark-redesign
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock="$site_dir/.zetslay-overview-update.lock"
mkdir "$lock" || { echo 'Другое обновление уже запущено.'; rm -rf "$work"; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in index.html app.js app.test.mjs overview.js overview.css overview.test.mjs; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-overview-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$site_dir/app" "$work/incoming" "$work/app"
cp "$work/incoming/app.test.mjs" "$work/app/app.test.mjs"

# Execute tests against the staged VPS app.js, preserving its existing fixes.
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check app.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check overview.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test overview.test.mjs </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test \
  --test-name-pattern='existing session|expired session|demo activation' app.test.mjs </dev/null

files=(app/app.js app/overview.js app/overview.css app/overview.test.mjs app/index.html)
existing=()
created=()
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "$backup_dir/zetslay-site-before-overview.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback() {
  tar -xzf "$backup"
  for file in "${created[@]}"; do rm -f -- "$file"; done
  echo "Обновление отменено. Резервная копия: $backup"
}
# Install the assets first, HTML last; each replacement is atomic.
for file in "${files[@]}"; do
  if ! candidate=$(mktemp "$(dirname "$file")/.zetslay-overview.XXXXXX"); then
    rollback
    exit 1
  fi
  if ! cp "$work/${file}" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then
    rm -f "$candidate"
    rollback
    exit 1
  fi
done
echo "Главная обновлена из $revision. Резервная копия: $backup"
echo 'Docker Compose перезапускать не нужно. Откройте кабинет с Ctrl+F5.'
