#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_VIDEO_GUIDE_REVISION:?Укажите ревизию видео-инструкции}^{commit}")
exec 9>.zetslay-video-guide.lock
flock -n 9 || { echo 'Баннер видео-инструкции уже обновляется.';exit 1; }
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
for file in app/index.html app/video-guide-banner.css app/video-guide-banner.js app/assets/video-guide-play.svg;do
 [ ! -L "$file" ] || { echo "Символическая ссылка вместо файла: $file. Обновление остановлено.";exit 1; }
done
mkdir -p "$work/local" "$work/incoming/assets"
cp -p app/index.html "$work/local/index.html"
for file in video-guide-banner.css video-guide-banner.js assets/video-guide-play.svg;do
 git show "$revision:app/$file" > "$work/incoming/$file"
 [ "$(git hash-object "$work/incoming/$file")" = "$(git rev-parse "$revision:app/$file")" ] || exit 1
done
git show "$revision:deploy/video-guide-banner.html" > "$work/incoming/video-guide-banner.html"
git show "$revision:deploy/stage-video-guide.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1;then timeout 15 node --check "$work/out/video-guide-banner.js";fi
cmp -s app/index.html "$work/local/index.html" || { echo 'Кабинет изменился во время подготовки. Обновление остановлено.';exit 1; }
existing=(app/index.html)
for file in video-guide-banner.css video-guide-banner.js assets/video-guide-play.svg;do
 if [ -f "app/$file" ];then existing+=("app/$file");else created+=("app/$file");fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-video-guide.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" "${existing[@]}"
publishing=true
for file in video-guide-banner.css video-guide-banner.js assets/video-guide-play.svg index.html;do
 mkdir -p "app/$(dirname "$file")"
 candidate=$(mktemp "app/$(dirname "$file")/.zetslay-video-guide.XXXXXX")
 install -m 644 "$work/out/$file" "$candidate"
 mv -f "$candidate" "app/$file";candidate=''
done
publishing=false
echo 'Готово: видео-инструкция добавлена на главную кабинета и в базу знаний.'
echo "Резервная копия: $backup"
echo 'Обновите кабинет через Ctrl+F5. Перезапуск API не требуется.'
