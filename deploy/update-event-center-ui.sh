#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_EVENTS_REVISION:?Укажите ревизию обновления}^{commit}")
exec 9>.zetslay-workspace-ui.lock
flock -n 9 || { echo 'Кабинет уже обновляется.';exit 1; }
[ ! -L app ] || { echo 'Каталог app является ссылкой. Установка остановлена.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate=''
cleanup(){
 status=$?
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  for file in workspace-upgrade.css event-center.css workspace-upgrade.js;do [ -f "$work/local/$file" ] || rm -f "app/$file";done
  echo "Прежний интерфейс восстановлен. Backup: $backup"
 fi
 [ -z "$candidate" ] || rm -f -- "$candidate"
 rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work/local" "$work/incoming"
for file in index.html workspace-upgrade.css event-center.css workspace-upgrade.js;do
 [ ! -L "app/$file" ] || { echo "Символическая ссылка вместо файла: app/$file";exit 1; }
 [ ! -e "app/$file" ] || cp -p "app/$file" "$work/local/$file"
done
for file in workspace-upgrade.css event-center.css workspace-upgrade.js;do
 git show "$revision:app/$file" > "$work/incoming/$file"
 [ "$(git hash-object "$work/incoming/$file")" = "$(git rev-parse "$revision:app/$file")" ] || exit 1
done
git show "$revision:deploy/stage-event-center.py" > "$work/stage.py"
git show "$revision:deploy/event-center-manifest.json" > "$work/incoming/event-center-manifest.json"
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1;then timeout 15 node --check "$work/out/workspace-upgrade.js";fi
for file in index.html workspace-upgrade.css event-center.css workspace-upgrade.js;do
 if [ -e "$work/local/$file" ];then cmp -s "app/$file" "$work/local/$file" || { echo 'Кабинет изменился во время подготовки.';exit 1; };else [ ! -e "app/$file" ] || exit 1;fi
done
if [ "${ZETSLAY_EVENTS_PREFLIGHT_ONLY:-false}" = true ];then echo 'Совместимость кабинета проверена. Файлы не изменены.';exit 0;fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-event-center-ui.XXXXXX.tar.gz")
files=(app/index.html)
for file in workspace-upgrade.css event-center.css workspace-upgrade.js;do [ ! -e "app/$file" ] || files+=("app/$file");done
chmod 600 "$backup";tar -czf "$backup" "${files[@]}"
python3 - "$backup" "$work/local" <<'VERIFY'
import sys,tarfile
from pathlib import Path
with tarfile.open(sys.argv[1]) as archive:
 for entry in archive.getmembers():
  if not entry.isfile() or archive.extractfile(entry).read()!=(Path(sys.argv[2])/Path(entry.name).name).read_bytes():raise SystemExit('Резервная копия не подтверждена. Сайт не изменён.')
VERIFY
publishing=true
for file in workspace-upgrade.css event-center.css workspace-upgrade.js index.html;do
 candidate=$(mktemp app/.zetslay-event-center.XXXXXX)
 install -m 644 "$work/out/$file" "$candidate"
 mv -f "$candidate" "app/$file";candidate=''
done
publishing=false
echo 'Готово: обновлённый центр событий установлен.'
echo "Резервная копия интерфейса: $backup"
