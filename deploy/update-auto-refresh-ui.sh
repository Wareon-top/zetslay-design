#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-auto-refresh-update.lock
mkdir "$lock" || { echo 'Автообновление уже устанавливается.'; exit 1; }
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
git fetch origin "${ZETSLAY_AUTO_REFRESH_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/site/app" "$work/before"
files=(auto-refresh.js auto-refresh.test.mjs overview.js index.html)
for name in "${files[@]}"; do if [ -f "app/$name" ]; then cp -p "app/$name" "$work/before/$name"; fi; done
cp app/*.js app/*.css "$work/site/app/"
for name in auto-refresh.js auto-refresh.test.mjs; do git show "$revision:app/$name" > "$work/incoming/$name"; done
git show "$revision:deploy/stage-auto-refresh.py" > "$work/stage.py"
python3 "$work/stage.py" app "$work/incoming" "$work/site/app"
verify(){ node --check "$1/app/auto-refresh.js"; node --check "$1/app/overview.js"; node --test "$1/app/auto-refresh.test.mjs"; }
if command -v node >/dev/null && [ "$(node -p 'Number(process.versions.node.split(".")[0])>=22')" = true ]; then verify "$work/site"; else
 docker run --rm --network none -v "$work/site:/work:ro" -w /work node:22-alpine sh -c 'node --check app/auto-refresh.js && node --check app/overview.js && node --test app/auto-refresh.test.mjs'
fi
for name in "${files[@]}"; do if [ -e "$work/before/$name" ]; then cmp -s "app/$name" "$work/before/$name" || { echo "app/$name изменён во время проверки."; exit 1; }; else test ! -e "app/$name" || exit 1; fi; done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-auto-refresh.XXXXXX")
mkdir -p "$backup/original/app"
for name in "${files[@]}"; do printf '%s\n' "app/$name" >> "$backup/manifest"; if [ -f "app/$name" ]; then cp -p "app/$name" "$backup/original/app/$name"; fi; done
installed=true
for name in "${files[@]}"; do candidate=$(mktemp app/.zetslay-auto-refresh.XXXXXX);cp "$work/site/app/$name" "$candidate";chmod 644 "$candidate";mv -f "$candidate" "app/$name";done
complete=true
echo "Автообновление кабинета установлено из $revision. Backup: $backup"
echo 'Данные проверяются каждые 15 секунд в открытой вкладке. Нужен серверный модуль снимков; ключи повторно вводить не нужно.'
