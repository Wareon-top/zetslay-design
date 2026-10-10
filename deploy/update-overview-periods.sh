#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-overview-periods-update.lock
mkdir "$lock" || { echo 'Обновление статистики уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_OVERVIEW_PERIODS_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/original"
assets=(index.html overview.js overview.css overview.test.mjs)
for file in "${assets[@]}"; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-overview-periods.py" > "$work/stage.py"
for file in index.html overview.js overview.css app.js; do cp -p "app/$file" "$work/original/$file"; done
python3 "$work/stage.py" "$PWD/app" "$work/incoming" "$work/app"
if command -v node >/dev/null 2>&1; then
  node --check "$work/app/overview.js"
  node --test "$work/app/overview.test.mjs"
else
  docker run --rm --network none -v "$work/app:/work:ro" -w /work node:22-alpine \
    sh -c 'node --check overview.js && node --test overview.test.mjs'
fi
for file in index.html overview.js overview.css app.js; do
  cmp -s "app/$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
done
files=(); created=()
for file in "${assets[@]}"; do
  if [ -f "app/$file" ]; then files+=("app/$file"); else created+=("app/$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-overview-periods.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" "${files[@]}"
for file in "${assets[@]}"; do
  if ! cp "$work/app/$file" "app/$file"; then
    tar -xzf "$backup"
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Файлы восстановлены. Backup: $backup"
    exit 1
  fi
done
echo "Периоды статистики добавлены: сегодня, 7 дней, 30 дней и все загруженные данные. Backup: $backup"
echo 'Расчёт по датам заказов, МСК. История ограничена данными FunPay. Нажмите Ctrl+F5.'
