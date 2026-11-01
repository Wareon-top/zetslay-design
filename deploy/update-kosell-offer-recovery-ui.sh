#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-kosell-offer-recovery-update.lock
mkdir "$lock" || { echo 'Обновление витрины Kosell уже выполняется.'; exit 1; }
work=$(mktemp -d)
backup=''
complete=false
cleanup() {
  status=$?
  if [ -n "$backup" ] && [ "$complete" = false ]; then
    tar -xzf "$backup"
    echo "Файлы восстановлены. Backup: $backup"
  fi
  rm -rf "$work"; rmdir "$lock"; return "$status"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_KOSELL_OFFER_RECOVERY_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/incoming/deploy"
for file in app/index.html app/kosell-rent.js app/kosell-rent.test.mjs app/plugin-page.js app/plugin-rarity.js deploy/stage-kosell-offer-recovery.py deploy/stage-kosell-offer-recovery.test.py; do
  git show "$revision:$file" > "$work/incoming/$file"
done
python3 "$work/incoming/deploy/stage-kosell-offer-recovery.test.py"
python3 "$work/incoming/deploy/stage-kosell-offer-recovery.py" "$PWD/app" "$work/incoming/app" "$work/staged"
mkdir -p "$work/tests/app"
cp "$work/incoming/app/"* "$work/tests/app/"
cp "$work/staged/"* "$work/tests/app/"
if command -v node >/dev/null 2>&1; then
  node --check "$work/tests/app/kosell-rent.js"
  node --test "$work/tests/app/kosell-rent.test.mjs"
else
  docker run --rm --network none -v "$work/tests:/work:ro" -w /work node:22-alpine sh -c 'node --check app/kosell-rent.js && node --test app/kosell-rent.test.mjs'
fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-kosell-offer-ui.XXXXXX.tar.gz")
tar -czf "$backup" app/kosell-rent.js app/index.html
for file in kosell-rent.js index.html; do
  candidate=$(mktemp "app/.kosell-offer.XXXXXX")
  if ! cp "$work/staged/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "app/$file"; then rm -f "$candidate"; exit 1; fi
done
complete=true
echo "Состояние заданий массовой витрины Kosell обновлено. Backup: $backup"
echo 'Ctrl+F5. Теперь видны этап, причина отказа и время следующей попытки подготовки.'
