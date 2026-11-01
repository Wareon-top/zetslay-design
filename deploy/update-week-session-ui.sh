#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-week-session-update.lock
mkdir "$lock" || { echo 'Обновление сессий уже выполняется.'; exit 1; }
work=$(mktemp -d)
backup=''
complete=false
created=()
cleanup() {
  status=$?
  if [ -n "$backup" ] && [ "$complete" = false ]; then
    tar -xzf "$backup"
    for file in "${created[@]}"; do rm -f -- "$file"; done
    echo "Файлы восстановлены. Backup: $backup"
  fi
  rm -rf "$work"; rmdir "$lock"; return "$status"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_WEEK_SESSION_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/incoming/deploy"
for file in index.html app/index.html app/app.js app/account-security.js session-client.js landing-session.js session-ui.css landing-session.test.mjs app/browser-session.test.mjs deploy/stage-week-session.py deploy/stage-week-session.test.py; do
  git show "$revision:$file" > "$work/incoming/$file"
done
python3 "$work/incoming/deploy/stage-week-session.test.py"
python3 "$work/incoming/deploy/stage-week-session.py" "$PWD" "$work/incoming" "$work/staged"
cp "$work/incoming/app/browser-session.test.mjs" "$work/staged/app/"
cp "$work/incoming/landing-session.test.mjs" "$work/staged/"
if command -v node >/dev/null 2>&1; then
  for file in app/app.js app/account-security.js session-client.js landing-session.js; do node --check "$work/staged/$file"; done
  node --test "$work/staged/app/browser-session.test.mjs" "$work/staged/landing-session.test.mjs"
else
  docker run --rm --network none -v "$work/staged:/work:ro" -w /work node:22-alpine sh -c 'node --check app/app.js && node --check app/account-security.js && node --check session-client.js && node --check landing-session.js && node --test app/browser-session.test.mjs landing-session.test.mjs'
fi
find "$work/staged" -type f -name '*.test.mjs' -delete
mapfile -t files < <(cd "$work/staged" && find . -type f -printf '%P\n' | sort)
existing=()
for file in "${files[@]}"; do if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi; done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-week-session-ui.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
for file in "${files[@]}"; do
  mkdir -p "$(dirname "$file")"
  candidate=$(mktemp "$(dirname "$file")/.week-session.XXXXXX")
  if ! cp "$work/staged/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then rm -f "$candidate"; exit 1; fi
done
complete=true
echo "Вход на неделю и кнопки кабинета обновлены. Backup: $backup"
echo 'Один раз обновите страницу (Ctrl+F5) и войдите заново для сессии на 7 дней.'
