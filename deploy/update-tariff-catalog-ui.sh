#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-tariff-catalog-update.lock
mkdir "$lock" || { echo 'Тарифы уже обновляются.'; exit 1; }
work=$(mktemp -d);backup='';installed=false;complete=false
cleanup(){
 if [ "$installed" = true ] && [ "$complete" != true ]; then
  while IFS= read -r file; do if [ -f "$backup/original/$file" ]; then cp -p "$backup/original/$file" "$file"; else rm -f -- "$file"; fi; done < "$backup/manifest"
  echo "Файлы восстановлены. Backup: $backup"
 fi
 rm -rf "$work";rmdir "$lock"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
git fetch origin "${ZETSLAY_TARIFF_CATALOG_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/deploy" "$work/incoming/app" "$work/site/app" "$work/site/deploy" "$work/before/app"
files=(landing-pricing.js app/billing-pricing.js landing-pricing.css app/billing-pricing.css subscription-plans.json app/billing-section.html app/tariff-catalog.test.mjs app/tariff-summary.js app/tariff-summary.test.mjs app/billing.test.mjs deploy/landing-pricing.test.mjs app/index.html index.html)
for name in "${files[@]}"; do if [ -f "$name" ]; then mkdir -p "$work/before/$(dirname "$name")";cp -p "$name" "$work/before/$name";fi;done
cp app/*.js app/*.css "$work/site/app/"
for name in subscription-plans.json landing-pricing.css app/billing-pricing.css app/billing-section.html app/tariff-catalog.test.mjs app/tariff-summary.js app/tariff-summary.test.mjs app/billing.test.mjs deploy/landing-pricing.test.mjs deploy/build-subscription-pricing.py deploy/subscription-pricing-runtime.js deploy/stage-tariff-catalog.py; do git show "$revision:$name" > "$work/incoming/$name";done
python3 "$work/incoming/deploy/stage-tariff-catalog.py" "$PWD" "$work/incoming" "$work/site"
verify(){ node --check "$1/landing-pricing.js";node --check "$1/app/billing-pricing.js";node --test "$1/app/tariff-catalog.test.mjs" "$1/app/tariff-summary.test.mjs" "$1/app/billing.test.mjs" "$1/deploy/landing-pricing.test.mjs"; }
if command -v node >/dev/null && [ "$(node -p 'Number(process.versions.node.split(".")[0])>=22')" = true ]; then verify "$work/site";else
 docker run --rm --network none -v "$work/site:/work:ro" -w /work node:22-alpine sh -c 'node --check landing-pricing.js && node --check app/billing-pricing.js && node --test app/tariff-catalog.test.mjs app/tariff-summary.test.mjs app/billing.test.mjs deploy/landing-pricing.test.mjs'
fi
for name in "${files[@]}"; do if [ -e "$work/before/$name" ]; then cmp -s "$name" "$work/before/$name" || { echo "$name изменён во время проверки.";exit 1; };else test ! -e "$name" || exit 1;fi;done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-tariff-catalog.XXXXXX")
mkdir -p "$backup/original"
for name in "${files[@]}";do printf '%s\n' "$name" >> "$backup/manifest";if [ -f "$name" ];then mkdir -p "$backup/original/$(dirname "$name")";cp -p "$name" "$backup/original/$name";fi;done
installed=true
for name in "${files[@]}";do
 if [ ! -f "$work/site/$name" ];then continue;fi
 mkdir -p "$(dirname "$name")";candidate=$(mktemp "$(dirname "$name")/.zetslay-tariff.XXXXXX");cp "$work/site/$name" "$candidate";chmod 644 "$candidate";mv -f "$candidate" "$name"
done
complete=true
echo "Тарифы и сравнение плагинов установлены из $revision. Backup: $backup"
echo 'Старт 149 ₽ · Рост 299 ₽ · Профи 499 ₽ · Максимум 799 ₽. Пробный период — 3 дня без легендарных плагинов.'
echo 'Цены, действующие подписки, лицензии, настройки платежей и секреты сохранены.'
