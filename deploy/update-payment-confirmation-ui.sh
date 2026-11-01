#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-confirmation-update.lock
mkdir "$lock" || { echo 'Подтверждения операций уже обновляются.'; exit 1; }
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
git fetch origin "${ZETSLAY_CONFIRMATION_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/site/app" "$work/before"
files=(payment-confirmation.js payment-confirmation.css payment-confirmation.test.mjs payments.js payments.test.mjs index.html)
for name in "${files[@]}"; do if [ -f "app/$name" ]; then cp -p "app/$name" "$work/before/$name"; fi; done
cp app/*.js app/*.css "$work/site/app/"
for name in payment-confirmation.js payment-confirmation.css payment-confirmation.test.mjs payments.js payments.test.mjs; do git show "$revision:app/$name" > "$work/incoming/$name"; done
git show "$revision:deploy/stage-payment-confirmation.py" > "$work/stage.py"
python3 "$work/stage.py" app "$work/incoming" "$work/site/app"
verify(){ node --check "$1/app/payment-confirmation.js"; node --check "$1/app/payments.js"; node --test "$1/app/payment-confirmation.test.mjs" "$1/app/payments.test.mjs"; }
if command -v node >/dev/null && [ "$(node -p 'Number(process.versions.node.split(".")[0])>=22')" = true ]; then verify "$work/site"; else
 docker run --rm --network none -v "$work/site:/work:ro" -w /work node:22-alpine sh -c 'node --check app/payment-confirmation.js && node --check app/payments.js && node --test app/payment-confirmation.test.mjs app/payments.test.mjs'
fi
for name in "${files[@]}"; do if [ -e "$work/before/$name" ]; then cmp -s "app/$name" "$work/before/$name" || { echo "app/$name изменён во время проверки."; exit 1; }; else test ! -e "app/$name" || exit 1; fi; done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-confirmation.XXXXXX")
mkdir -p "$backup/original/app"
for name in "${files[@]}"; do printf '%s\n' "app/$name" >> "$backup/manifest"; if [ -f "app/$name" ]; then cp -p "app/$name" "$backup/original/app/$name"; fi; done
installed=true
for name in "${files[@]}"; do candidate=$(mktemp app/.zetslay-confirmation.XXXXXX);cp "$work/site/app/$name" "$candidate";chmod 644 "$candidate";mv -f "$candidate" "app/$name";done
complete=true
echo "Подтверждения пополнений, подписок и плагинов установлены из $revision. Backup: $backup"
echo 'Ключи Platega повторно вводить не нужно. Для полных данных билета нужен соответствующий серверный модуль.'
