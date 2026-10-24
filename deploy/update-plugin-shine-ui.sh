#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-plugin-shine-update.lock
mkdir "$lock" || { echo 'Обновление рамок уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_PLUGIN_SHINE_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/original/app"
git show "$revision:app/plugin-shine.css" > "$work/incoming/app/plugin-shine.css"
git show "$revision:deploy/stage-plugin-shine-ui.py" > "$work/stage.py"
files=(app/index.html index.html)
created=()
if [ -f app/plugin-shine.css ]; then files+=(app/plugin-shine.css); else created+=(app/plugin-shine.css); fi
for file in "${files[@]}"; do cp -p "$file" "$work/original/$file"; done
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
for file in "${files[@]}"; do
  cmp -s "$file" "$work/original/$file" || { echo 'Файлы изменились во время подготовки. Обновление остановлено.'; exit 1; }
done
for file in "${created[@]}"; do
  [ ! -e "$file" ] || { echo 'Файл создан другим обновлением. Обновление остановлено.'; exit 1; }
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-plugin-shine.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" "${files[@]}"
for file in app/plugin-shine.css app/index.html index.html; do
  if ! cp "$work/out/$file" "$file"; then
    tar -xzf "$backup"
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Файлы восстановлены. Backup: $backup"
    exit 1
  fi
done
echo "Анимированные рамки добавлены в каталог и витрину. Backup: $backup"
echo 'Цвет зависит от редкости. Обновите страницу через Ctrl+F5.'
