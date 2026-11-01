#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_WORKSPACE_REVISION:?Укажите ревизию обновления}^{commit}")
exec 9>.zetslay-workspace-ui.lock
flock -n 9 || { echo 'Кабинет уже обновляется.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate=''
cleanup(){
 status=$?
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  for file in workspace-upgrade.css workspace-upgrade.js;do [ -f "$work/local/$file" ] || rm -f "app/$file";done
  echo "Прежний интерфейс восстановлен. Backup: $backup"
 fi
 [ -z "$candidate" ] || rm -f -- "$candidate"
 rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work/local" "$work/incoming"
for file in index.html workspace-upgrade.css workspace-upgrade.js;do
 [ ! -L "app/$file" ] || { echo "Символическая ссылка вместо файла: app/$file";exit 1; }
 [ ! -e "app/$file" ] || cp -p "app/$file" "$work/local/$file"
done
for file in workspace-upgrade.css workspace-upgrade.js;do
 git show "$revision:app/$file" > "$work/incoming/$file"
 [ "$(git hash-object "$work/incoming/$file")" = "$(git rev-parse "$revision:app/$file")" ] || exit 1
done
git show "$revision:deploy/stage-workspace-upgrade.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1;then timeout 15 node --check "$work/out/workspace-upgrade.js";fi
cmp -s app/index.html "$work/local/index.html" || { echo 'Кабинет изменился во время подготовки.';exit 1; }
if [ "${ZETSLAY_WORKSPACE_PREFLIGHT_ONLY:-false}" = true ];then echo 'Совместимость кабинета проверена. Файлы не изменены.';exit 0;fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-workspace-ui.XXXXXX.tar.gz")
files=(app/index.html)
for file in workspace-upgrade.css workspace-upgrade.js;do [ ! -e "app/$file" ] || files+=("app/$file");done
chmod 600 "$backup";tar -czf "$backup" "${files[@]}"
publishing=true
for file in workspace-upgrade.css workspace-upgrade.js index.html;do
 candidate=$(mktemp app/.zetslay-workspace.XXXXXX)
 install -m 644 "$work/out/$file" "$candidate"
 mv -f "$candidate" "app/$file";candidate=''
done
publishing=false
echo 'Готово: новый дизайн кабинета, карточки показателей, аналитика и центр событий установлены.'
echo "Резервная копия интерфейса: $backup"
