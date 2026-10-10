#!/usr/bin/env bash
set -euo pipefail
# Prevent Docker and other children from consuming the user's surrounding heredoc.
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock="$PWD/.zetslay-cabinet-ui-update.lock"
mkdir "$lock" || { echo 'Обновление оформления кабинета уже выполняется.'; exit 1; }
work=''
cleanup() { if [ -n "$work" ]; then rm -rf -- "$work"; fi; rmdir "$lock"; }
trap cleanup EXIT
work=$(mktemp -d)
git fetch origin "${ZETSLAY_CABINET_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming"
git show "$revision:app/cabinet-ui.css" > "$work/incoming/cabinet-ui.css"
git show "$revision:deploy/stage-cabinet-ui.py" > "$work/stage-cabinet-ui.py"
git show "$revision:deploy/stage-cabinet-ui.test.py" > "$work/stage-cabinet-ui.test.py"
python3 "$work/stage-cabinet-ui.test.py"
python3 "$work/stage-cabinet-ui.py" "$PWD/app" "$work/incoming" "$work/app"
files=(app/index.html)
created=()
if [ -f app/cabinet-ui.css ]; then files+=(app/cabinet-ui.css); else created+=(app/cabinet-ui.css); fi
backup=$(mktemp /root/zetslay-site-before-cabinet-ui.XXXXXX.tar.gz)
tar -czf "$backup" "${files[@]}"
# Install asset first, then the page referencing it. Neither app.js nor any module is replaced.
for file in cabinet-ui.css index.html; do
  if ! cp "$work/app/$file" "app/$file"; then
    tar -xzf "$backup"
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Ошибка применения. Сайт восстановлен. Резервная копия: $backup"
    exit 1
  fi
done
echo "Оформление кабинета обновлено. Резервная копия: $backup"
echo 'Обновите страницу через Ctrl+F5. Подключения, права, настройки и обложки сохранены.'
