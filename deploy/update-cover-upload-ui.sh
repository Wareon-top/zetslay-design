#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_COVER_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-cover-upload-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
base=d6170b1eba7e68827db1ebf96d714eb89ad24839
for file in app.js plugin-page.js plugin-cover.js plugin-cover.css plugin-cover.test.mjs; do
  git show "$revision:app/$file" > "$work/incoming/$file"
done
git show "$base:app/app.js" > "$work/incoming/base-app.js"
git show "$base:app/plugin-page.js" > "$work/incoming/base-plugin-page.js"
git show "$revision:deploy/stage-cover-upload-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
for file in app.js plugin-page.js plugin-cover.js; do
  docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check "$file" </dev/null
done
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test plugin-cover.test.mjs </dev/null
files=(app.js plugin-page.js index.html plugin-cover.js plugin-cover.css plugin-cover.test.mjs)
existing=(); created=()
for file in "${files[@]}"; do
  if [ -f "app/$file" ]; then existing+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp /root/zetslay-site-before-cover-upload.XXXXXX.tar.gz)
tar -czf "$backup" "${existing[@]}"
rollback() {
  tar -xzf "$backup"
  for file in "${created[@]}"; do rm -f -- "$file"; done
  echo "Восстановлена резервная копия: $backup"
}
# New helper first; the versioned index is switched last.
for file in plugin-cover.js plugin-cover.css plugin-cover.test.mjs plugin-page.js app.js index.html; do
  if ! candidate=$(mktemp "app/.zetslay-cover-upload.XXXXXX"); then rollback; exit 1; fi
  if ! cp "$work/app/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "app/$file"; then
    rm -f "$candidate"; rollback; exit 1
  fi
done
echo "Обложки обновлены: исходная рамка 4:2,9, загрузка владельцем, старые карточки скрыты. Backup: $backup"
echo 'Ctrl+F5. Если исходная обложка была сжата раньше, загрузите её оригинал повторно.'
