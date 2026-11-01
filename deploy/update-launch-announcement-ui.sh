#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-launch-announcement-update.lock
mkdir "$lock" || { echo 'Уведомление о запуске уже устанавливается.'; exit 1; }
work=$(mktemp -d)
backup=''
installed=false
complete=false
cleanup(){
 if [ "$installed" = true ] && [ "$complete" != true ]; then
  while IFS= read -r file; do if [ -f "$backup/original/$file" ]; then cp -p "$backup/original/$file" "$file"; else rm -f -- "$file"; fi; done < "$backup/manifest"
  echo "Файлы восстановлены. Backup: $backup"
 fi
 rm -rf "$work"
 rmdir "$lock"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
git fetch origin "${ZETSLAY_LAUNCH_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/assets" "$work/site/app" "$work/before/assets"
files=(launch-announcement.js launch-announcement.css launch-announcement.test.mjs assets/launch-cover.jpg assets/launch-brand.webp index.html)
for name in "${files[@]}"; do if [ -f "app/$name" ]; then cp -p "app/$name" "$work/before/$name"; fi; done
cp app/app.js app/learning.js "$work/site/app/"
for name in launch-announcement.js launch-announcement.css launch-announcement.test.mjs assets/launch-cover.jpg assets/launch-brand.webp; do git show "$revision:app/$name" > "$work/incoming/$name"; done
git show "$revision:deploy/stage-launch-announcement.py" > "$work/stage.py"
python3 "$work/stage.py" app "$work/incoming" "$work/site/app"
verify(){ node --check "$1/app/launch-announcement.js"; node --test "$1/app/launch-announcement.test.mjs"; }
if command -v node >/dev/null && [ "$(node -p 'Number(process.versions.node.split(".")[0])>=22')" = true ]; then verify "$work/site"; else
 docker run --rm --network none -v "$work/site:/work:ro" -w /work node:22-alpine sh -c 'node --check app/launch-announcement.js && node --test app/launch-announcement.test.mjs'
fi
for name in "${files[@]}"; do if [ -e "$work/before/$name" ]; then cmp -s "app/$name" "$work/before/$name" || { echo "app/$name изменён во время проверки."; exit 1; }; else test ! -e "app/$name" || exit 1; fi; done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-launch-notice.XXXXXX")
mkdir -p "$backup/original/app/assets" app/assets
for name in "${files[@]}"; do printf '%s\n' "app/$name" >> "$backup/manifest"; if [ -f "app/$name" ]; then cp -p "app/$name" "$backup/original/app/$name"; fi; done
installed=true
for name in "${files[@]}"; do candidate=$(mktemp "app/$name.XXXXXX"); cp "$work/site/app/$name" "$candidate"; chmod 644 "$candidate"; mv -f "$candidate" "app/$name"; done
complete=true
echo "Уведомление о запуске установлено из $revision. Backup: $backup"
echo 'Показ на главной кабинета — не чаще раза в 7 дней для аккаунта в этом браузере. Обучение и открытые окна имеют приоритет.'
