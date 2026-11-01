#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_PROFILE_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-profile-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for file in profile.js profile.css; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-profile-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
for file in app.js profile.js; do
  docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check "$file" </dev/null
done
files=(app/app.js app/index.html)
for file in profile.js profile.css; do if [ -f "app/$file" ]; then files+=("app/$file"); fi; done
backup=$(mktemp /root/zetslay-site-before-profile.XXXXXX.tar.gz)
tar -czf "$backup" "${files[@]}"
for file in profile.js profile.css app.js index.html; do
  if ! cp "$work/app/$file" "app/$file"; then tar -xzf "$backup"; echo 'Восстановлена резервная копия.'; exit 1; fi
done
echo "Раздел Профиль установлен. Резервная копия: $backup"
