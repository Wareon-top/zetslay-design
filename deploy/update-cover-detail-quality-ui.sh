#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin codex/landing-light-dark-redesign
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-detail-cover-quality-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/app" "$work/incoming"
for file in plugin-cover.js plugin-cover.css; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-cover-detail-quality-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
for file in app.js plugin-page.js plugin-cover.js; do docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check "$file" </dev/null; done
files=(app.js index.html plugin-page.js plugin-cover.js plugin-cover.css)
existing=()
created=()
for file in "${files[@]}"; do if [ -f "app/$file" ]; then existing+=("app/$file"); else created+=("app/$file"); fi; done
backup=$(mktemp /root/zetslay-site-before-detail-cover-quality.XXXXXX.tar.gz)
tar -czf "$backup" "${existing[@]}"
rollback() { tar -xzf "$backup"; for file in "${created[@]}"; do rm -f "$file"; done; echo "Кабинет восстановлен. Резервная копия: $backup"; }
for file in "${files[@]}"; do
  if ! candidate=$(mktemp "app/.zetslay-detail-cover.XXXXXX"); then rollback; exit 1; fi
  if ! cp "$work/app/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "app/$file"; then rm -f "$candidate"; rollback; exit 1; fi
done
echo "Обложки подробных страниц обновлены. Резервная копия: $backup"
echo 'Ctrl+F5. Если обложка была сжата раньше, повторно загрузите исходный файл.'
