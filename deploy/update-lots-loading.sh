#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_LOTS_REVISION:?Укажите ревизию обновления}^{commit}")
mkdir .zetslay-lots-update.lock || { echo 'Другое обновление лотов ещё выполняется.';exit 1; }
work='';backup='';candidate='';publishing=false
cleanup(){
 status=$?
 [ -z "$candidate" ] || rm -f -- "$candidate"
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then tar -xzf "$backup";echo "Прежний раздел восстановлен. Backup: $backup";fi
 [ -z "$work" ] || rm -rf "$work"
 rmdir .zetslay-lots-update.lock
}
trap cleanup EXIT
work=$(mktemp -d)
mkdir "$work/local" "$work/incoming"
[ ! -L app ] || { echo 'Символическая ссылка вместо каталога кабинета.';exit 1; }
for file in lots.js index.html;do
 [ -f "app/$file" ] && [ ! -L "app/$file" ] || { echo "Не найден обычный файл app/$file";exit 1; }
 cp -p "app/$file" "$work/local/$file"
done
for spec in 'app/lots.js:lots.js' 'deploy/lots-loading-manifest.json:manifest.json' 'deploy/stage-lots-loading.py:stage.py';do
 source=${spec%:*};target=${spec#*:}
 git show "$revision:$source" > "$work/incoming/$target"
 [ "$(git hash-object "$work/incoming/$target")" = "$(git rev-parse "$revision:$source")" ] || exit 1
done
python3 "$work/incoming/stage.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1;then timeout 15 node --check "$work/out/lots.js";fi
for file in lots.js index.html;do cmp -s "app/$file" "$work/local/$file" || { echo 'Кабинет изменился во время подготовки.';exit 1; };done
if [ "${ZETSLAY_LOTS_PREFLIGHT_ONLY:-false}" = true ];then echo 'Совместимость раздела лотов проверена. Файлы не изменены.';exit 0;fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-lots-loading.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" app/lots.js app/index.html
python3 - "$backup" "$work/local" <<'VERIFY'
import sys,tarfile
from pathlib import Path
with tarfile.open(sys.argv[1],'r:gz') as archive:
 for name in ['lots.js','index.html']:
  member=archive.getmember('app/'+name)
  if not member.isfile() or archive.extractfile(member).read()!=(Path(sys.argv[2])/name).read_bytes():raise SystemExit('Точная резервная копия не подтверждена. Файлы не изменены.')
VERIFY
for file in lots.js index.html;do cmp -s "app/$file" "$work/local/$file" || { echo 'Кабинет изменился во время подготовки.';exit 1; };done
publishing=true
for file in lots.js index.html;do
 candidate=$(mktemp app/.zetslay-lots.XXXXXX)
 install -m 644 "$work/out/$file" "$candidate"
 mv -f -- "$candidate" "app/$file";candidate=''
done
publishing=false
echo 'Готово: загрузка раздела «Лоты и товары» обновлена. Обновите страницу кабинета.'
echo "Резервная копия: $backup"
