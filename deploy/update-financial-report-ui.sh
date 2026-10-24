#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-financial-report.lock
mkdir "$lock" || { echo 'Финансовый раздел уже обновляется.'; exit 1; }
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
git fetch origin "${ZETSLAY_FINANCIAL_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/site/app" "$work/before"
files=(app.js billing-section.html learning.js knowledge-base.js plugin-purchase-options.js profile.js subscription-access.js finance-model.js finance-workspace.js finance-workspace.css finance-workspace.test.mjs finance-section.html index.html)
for name in "${files[@]}"; do if [ -f "app/$name" ]; then cp -p "app/$name" "$work/before/$name"; fi; done
cp app/*.js app/*.css "$work/site/app/"
cp index.html landing-pricing.js landing-pricing.css subscription-plans.json "$work/site/"
for name in finance-model.js finance-workspace.js finance-workspace.css finance-workspace.test.mjs finance-section.html subscription-access.js; do git show "$revision:app/$name" > "$work/incoming/$name"; done
git show "$revision:deploy/stage-subscription-navigation.py" > "$work/incoming/stage-subscription-navigation.py"
git show "$revision:deploy/stage-financial-report.py" > "$work/stage.py"
python3 "$work/stage.py" app "$work/incoming" "$work/site/app"
for name in app.test.mjs billing.test.mjs subscription-access.test.mjs; do git show "$revision:app/$name" > "$work/site/app/$name"; done
verify(){
 node --check "$1/app/app.js"
 node --check "$1/app/finance-model.js"
 node --check "$1/app/finance-workspace.js"
 node --test "$1/app/app.test.mjs" "$1/app/billing.test.mjs" "$1/app/subscription-access.test.mjs" "$1/app/finance-workspace.test.mjs"
}
if command -v node >/dev/null && [ "$(node -p 'Number(process.versions.node.split(".")[0])>=22')" = true ]; then verify "$work/site"; else
 docker run --rm --network none -v "$work/site:/work:ro" -w /work node:22-alpine sh -c 'node --check app/app.js && node --check app/finance-workspace.js && node --test app/app.test.mjs app/billing.test.mjs app/subscription-access.test.mjs app/finance-workspace.test.mjs'
fi
for name in "${files[@]}"; do
 if [ -e "$work/before/$name" ]; then cmp -s "app/$name" "$work/before/$name" || { echo "app/$name изменён во время проверки."; exit 1; }; else test ! -e "app/$name" || exit 1; fi
done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-financial-report.XXXXXX")
mkdir -p "$backup/original/app"
for name in "${files[@]}"; do echo "app/$name" >> "$backup/manifest"; if [ -f "app/$name" ]; then cp -p "app/$name" "$backup/original/app/$name"; fi; done
installed=true
for name in "${files[@]}"; do
 candidate=$(mktemp app/.zetslay-financial-report.XXXXXX)
 cp "$work/site/app/$name" "$candidate"
 chmod 644 "$candidate"
 mv -f "$candidate" "app/$name"
done
complete=true
echo "Финансы: доход, расходы, чистая прибыль, периоды и список заказов установлены из $revision."
echo "Backup: $backup"
echo 'Сначала должен быть установлен серверный финансовый модуль. Обновите страницу кабинета.'
