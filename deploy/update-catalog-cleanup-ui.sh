#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin codex/landing-light-dark-redesign
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-catalog-cleanup-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/app" "$work/incoming"
git show "$revision:deploy/stage-catalog-cleanup-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
for file in app.js plugin-page.js; do
  docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check "$file" </dev/null
done
backup=$(mktemp /root/zetslay-site-before-catalog-cleanup.XXXXXX.tar.gz)
tar -czf "$backup" app/app.js app/index.html app/plugin-page.js
for file in app.js index.html plugin-page.js; do
  candidate=$(mktemp "app/.zetslay-catalog-cleanup.XXXXXX")
  if ! cp "$work/app/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "app/$file"; then
    rm -f "$candidate"
    tar -xzf "$backup"
    echo "Кабинет восстановлен. Резервная копия: $backup"
    exit 1
  fi
done
echo "Каталог очищен. Резервная копия: $backup"
echo 'Обновите кабинет с Ctrl+F5. Перезапуск Docker Compose не требуется.'
