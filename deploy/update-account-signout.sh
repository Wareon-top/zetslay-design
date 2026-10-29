#!/usr/bin/env bash
set -euo pipefail
umask 022
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-account-signout-update.lock
mkdir "$lock" || { echo 'Кнопка выхода уже обновляется.'; exit 1; }
work=$(mktemp -d)
candidate=''
backup=''
rollback=false
complete=false
created=false
cleanup() {
  status=$?
  if [ "$rollback" = true ] && [ "$complete" = false ]; then
    tar -xzf "$backup"
    if [ "$created" = true ]; then rm -f app/account-signout.css; fi
    echo "Файлы восстановлены. Backup: $backup"
  fi
  if [ -n "$candidate" ]; then rm -f -- "$candidate"; fi
  rm -rf "$work"
  rmdir "$lock"
  return "$status"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_ACCOUNT_SIGNOUT_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/original" "$work/incoming"
for file in index.html app.js; do cp -p "app/$file" "$work/original/$file"; done
git show "$revision:app/account-signout.css" > "$work/incoming/account-signout.css"
git show "$revision:deploy/stage-account-signout.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
for file in index.html app.js; do
  cmp -s "app/$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
done
files=(app/index.html)
if [ -f app/account-signout.css ]; then files+=(app/account-signout.css); else created=true; fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-account-signout.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" "${files[@]}"
rollback=true
cp "$work/out/account-signout.css" app/account-signout.css
chmod 644 app/account-signout.css
candidate=$(mktemp app/.zetslay-account-signout.XXXXXX)
cp "$work/out/index.html" "$candidate"
chmod --reference=app/index.html "$candidate"
mv -f "$candidate" app/index.html
candidate=''
complete=true
echo "Кнопка «Выйти из аккаунта» добавлена в боковое меню под профилем. Backup: $backup"
echo 'Обновите кабинет через Ctrl+F5. API и контейнеры не перезапускались.'
