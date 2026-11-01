#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_BOT_CONNECTION_REVISION:?Укажите ревизию исправления}^{commit}")
exec 9>.zetslay-bot-connection-update.lock
flock -n 9 || { echo 'Обновление подключения уже выполняется.';exit 1; }
work=$(mktemp -d)
backup='';publishing=false;created=()
cleanup() {
 status=$?
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  if [ "${#created[@]}" -gt 0 ];then rm -f -- "${created[@]}";fi
  echo "Файлы кабинета восстановлены. Backup: $backup"
 fi
 rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work/local" "$work/incoming"
for file in index.html app.js;do cp -p "app/$file" "$work/local/$file";done
assets=(app.js connection-wizard-ui.js connection-wizard-ui.css connection-wizard-ui.test.mjs)
for file in "${assets[@]}";do git show "$revision:app/$file" > "$work/incoming/$file";done
git show "$revision:deploy/stage-bot-connection.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
for file in app.js connection-wizard-ui.js;do
 if command -v node >/dev/null 2>&1;then
  timeout 20 node --check < "$work/out/$file"
 else
  mapfile -t ids < <(docker ps --filter status=running --filter label=com.docker.compose.project=zetslay-staging --filter label=com.docker.compose.service=api --format '{{.ID}}')
  [ "${#ids[@]}" -eq 1 ] || { echo 'Не найден единственный API для проверки JavaScript. Файлы не изменены.';exit 1; }
  timeout 20 docker exec -i "${ids[0]}" node --check < "$work/out/$file"
 fi
done
for file in index.html app.js;do cmp -s "app/$file" "$work/local/$file" || { echo 'Кабинет изменился во время подготовки. Файлы не изменены.';exit 1; };done
files=(app/index.html app/app.js)
for file in "${assets[@]:1}";do if [ -f "app/$file" ];then files+=("app/$file");else created+=("app/$file");fi;done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-bot-connection.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" "${files[@]}"
publishing=true
for file in "${assets[@]}" index.html;do
 target=$(mktemp "app/.bot-connection.XXXXXX")
 install -m 644 "$work/out/$file" "$target"
 mv -f "$target" "app/$file"
done
publishing=false
echo "Мастер подключения обновлён. Backup: $backup"
