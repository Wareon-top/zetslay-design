#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_BONUS_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-review-bonus-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in review-bonus.js review-bonus.css; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-review-bonus-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
for file in plugin-page.js review-bonus.js; do
  docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check "$file" </dev/null
done
backup=$(mktemp /root/zetslay-site-before-review-bonus.XXXXXX.tar.gz)
files=(app/plugin-page.js app/index.html)
created=()
for file in review-bonus.js review-bonus.css; do if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi; done
tar -czf "$backup" "${files[@]}"
for file in review-bonus.js review-bonus.css plugin-page.js index.html; do
  if ! cp "$work/app/$file" "app/$file"; then tar -xzf "$backup"; for fresh in "${created[@]}"; do rm -f "$fresh"; done; echo 'Кабинет восстановлен из резервной копии.'; exit 1; fi
done
echo "Настройки Auto Review Bonus установлены. Резервная копия: $backup"
