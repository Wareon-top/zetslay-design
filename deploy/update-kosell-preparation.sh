#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_KOSELL_PREPARATION_REVISION:?Укажите ревизию обновления}^{commit}")
mkdir .zetslay-kosell-preparation-update.lock || { echo 'Другое обновление витрины ещё выполняется.';exit 1; }
work='';backup='';candidate='';publishing=false
cleanup(){
 status=$?
 [ -z "$candidate" ] || rm -f -- "$candidate"
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then tar -xzf "$backup";echo "Прежний раздел восстановлен. Backup: $backup";fi
 [ -z "$work" ] || rm -rf "$work"
 rmdir .zetslay-kosell-preparation-update.lock
}
trap cleanup EXIT
work=$(mktemp -d)
mkdir "$work/local" "$work/incoming"
[ ! -L app ] || { echo 'Символическая ссылка вместо каталога кабинета.';exit 1; }
for file in kosell-storefront.js index.html;do
 [ -f "app/$file" ] && [ ! -L "app/$file" ] || { echo "Не найден обычный файл app/$file";exit 1; }
 cp -p "app/$file" "$work/local/$file"
done
for spec in 'app/kosell-storefront.js:kosell-storefront.js' 'deploy/kosell-preparation-manifest.json:manifest.json' 'deploy/stage-kosell-preparation.py:stage.py';do
 source=${spec%:*};target=${spec#*:}
 git show "$revision:$source" > "$work/incoming/$target"
 [ "$(git hash-object "$work/incoming/$target")" = "$(git rev-parse "$revision:$source")" ] || exit 1
done
python3 "$work/incoming/stage.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1;then timeout 15 node --check "$work/out/kosell-storefront.js";fi
for file in kosell-storefront.js index.html;do cmp -s "app/$file" "$work/local/$file" || { echo 'Кабинет изменился во время подготовки.';exit 1; };done
if [ "${ZETSLAY_KOSELL_PREPARATION_PREFLIGHT_ONLY:-false}" = true ];then echo 'Совместимость массовой витрины проверена. Файлы не изменены.';exit 0;fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-kosell-preparation.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" app/kosell-storefront.js app/index.html
python3 - "$backup" "$work/local" <<'VERIFY'
import sys,tarfile
from pathlib import Path
with tarfile.open(sys.argv[1],'r:gz') as archive:
 for name in ['kosell-storefront.js','index.html']:
  member=archive.getmember('app/'+name)
  if not member.isfile() or archive.extractfile(member).read()!=(Path(sys.argv[2])/name).read_bytes():raise SystemExit('Точная резервная копия не подтверждена. Файлы не изменены.')
VERIFY
for file in kosell-storefront.js index.html;do cmp -s "app/$file" "$work/local/$file" || { echo 'Кабинет изменился во время подготовки.';exit 1; };done
publishing=true
for file in kosell-storefront.js index.html;do
 candidate=$(mktemp app/.zetslay-kosell-preparation.XXXXXX)
 install -m 644 "$work/out/$file" "$candidate"
 mv -f -- "$candidate" "app/$file";candidate=''
done
publishing=false
echo 'Готово: подготовка массовой витрины Kosell обновлена. Обновите страницу кабинета.'
echo "Резервная копия: $backup"
