#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-learning-update.lock
mkdir "$lock" || { echo 'Обновление обучения уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_LEARNING_UI_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/assets" "$work/original"
assets=(learning.js learning.css learning.test.mjs assets/learning-welcome.svg)
for file in "${assets[@]}"; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-learning-ui.py" > "$work/stage.py"
cp -p app/index.html "$work/original/index.html"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1; then
  node --check "$work/out/learning.js"
  node --test "$work/out/learning.test.mjs"
else
  docker run --rm --network none -v "$work/out:/work:ro" -w /work node:22-alpine \
    sh -c 'node --check learning.js && node --test learning.test.mjs'
fi
cmp -s app/index.html "$work/original/index.html" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
files=(app/index.html); created=()
for file in "${assets[@]}"; do
  if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-learning-ui.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" "${files[@]}"
mkdir -p app/assets
for file in "${assets[@]}" index.html; do
  if ! cp "$work/out/$file" "app/$file"; then
    tar -xzf "$backup"
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Файлы восстановлены. Backup: $backup";exit 1
  fi
done
echo "Приветствие, экскурсия и первые шаги добавлены. Backup: $backup"
echo 'Для существующих пользователей: База знаний → Знакомство с кабинетом. Обновите страницу через Ctrl+F5.'
