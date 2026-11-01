#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_KB_ESSENTIAL_REVISION:?Укажите ревизию базы знаний}^{commit}")
exec 9>.zetslay-kb-essential.lock
flock -n 9 || { echo 'База знаний уже обновляется.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate='';created=()
cleanup(){
 status=$?
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  if [ "${#created[@]}" -gt 0 ];then rm -f -- "${created[@]}";fi
  echo "Прежний вариант восстановлен. Backup: $backup"
 fi
 if [ -n "$candidate" ];then rm -f -- "$candidate";fi
 rm -rf "$work"
}
trap cleanup EXIT
for file in app/index.html app/knowledge-base.css app/knowledge-base.js;do
 [ ! -L "$file" ] || { echo "Символическая ссылка вместо файла: $file. Обновление остановлено.";exit 1; }
done
mkdir -p "$work/local" "$work/incoming/assets"
cp -p app/index.html "$work/local/index.html"
for file in knowledge-base.css knowledge-base.js;do
 git show "$revision:app/$file" > "$work/incoming/$file"
 [ "$(git hash-object "$work/incoming/$file")" = "$(git rev-parse "$revision:app/$file")" ] || exit 1
done
git show "$revision:deploy/knowledge-base-essential.html" > "$work/incoming/knowledge-base-essential.html"
git show "$revision:deploy/stage-knowledge-base-essential.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1;then timeout 15 node --check "$work/out/knowledge-base.js";fi
cmp -s app/index.html "$work/local/index.html" || { echo 'Кабинет изменился во время подготовки. Обновление остановлено.';exit 1; }
existing=(app/index.html)
for file in knowledge-base.css knowledge-base.js;do
 if [ -f "app/$file" ];then existing+=("app/$file");else created+=("app/$file");fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-kb-essential.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" "${existing[@]}"
publishing=true
for file in knowledge-base.css knowledge-base.js index.html;do
 mkdir -p "app/$(dirname "$file")"
 candidate=$(mktemp "app/$(dirname "$file")/.zetslay-kb-essential.XXXXXX")
 install -m 644 "$work/out/$file" "$candidate"
 mv -f "$candidate" "app/$file";candidate=''
done
publishing=false
echo 'Готово: база знаний упрощена до пяти инструкций. Баннеры видео и прокси сохранены.'
echo "Резервная копия: $backup"
echo 'Обновите кабинет через Ctrl+F5. Перезапуск API не требуется.'
