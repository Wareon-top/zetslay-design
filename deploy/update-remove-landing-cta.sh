#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock='.zetslay-landing-hero-update.lock'
mkdir "$lock" || { echo 'Главная страница уже обновляется.'; exit 1; }
work=''
candidate=''
cleanup() {
  if [ -n "$candidate" ]; then rm -f -- "$candidate"; fi
  if [ -n "$work" ]; then rm -rf -- "$work"; fi
  rmdir "$lock"
}
trap cleanup EXIT
work=$(mktemp -d)
git fetch origin "${ZETSLAY_REMOVE_CTA_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
git show "$revision:deploy/remove-landing-cta.py" > "$work/remove.py"
python3 "$work/remove.py" index.html "$work/index.html"
if cmp -s index.html "$work/index.html"; then
  echo 'Блок уже удалён. Дополнительных изменений нет.'
  exit 0
fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-remove-cta.XXXXXX.html")
cp -p index.html "$backup"
candidate=$(mktemp .zetslay-remove-cta.XXXXXX)
cp -p index.html "$candidate"
cat "$work/index.html" > "$candidate"
mv -f -- "$candidate" index.html
candidate=''
echo "Блок удалён. Резервная копия: $backup"
echo 'Нажмите Ctrl+F5 на главной странице. Перезапуск API не требуется.'
