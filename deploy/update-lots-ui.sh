#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_LOTS_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-lots-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in lots.js lots.css lots.test.mjs lots-section.html; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-lots-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
for file in app.js lots.js; do
  docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check "$file" </dev/null
done
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test lots.test.mjs </dev/null
files=(app/app.js app/index.html)
created=()
for file in lots.js lots.css lots.test.mjs; do
  if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp /root/zetslay-site-before-lots.XXXXXX.tar.gz)
tar -czf "$backup" "${files[@]}"
for file in lots.js lots.css lots.test.mjs app.js index.html; do
  if ! cp "$work/app/$file" "app/$file"; then
    tar -xzf "$backup"
    for name in "${created[@]}"; do rm -f -- "$name"; done
    echo 'Восстановлена резервная копия.'; exit 1
  fi
done
echo "Лоты и товары обновлены. Резервная копия: $backup"
