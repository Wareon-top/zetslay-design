#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-ticket-pilot-ui-update.lock
mkdir "$lock" || { echo 'Обновление Ticket Pilot уже выполняется.'; exit 1; }
work=$(mktemp -d); backup=''; installed=false; complete=false
files=(index.html app/index.html app/app.js app/plugin-page.js app/plugin-rarity.js app/subscription-access.js app/ticket-pilot.js app/ticket-pilot.css app/assets/plugin-covers/ticket-pilot.svg subscription-plans.json landing-pricing.js app/billing-pricing.js landing-pricing.css app/billing-pricing.css app/billing-section.html app/tariff-summary.js)
cleanup(){
 local result=$?
 if [ "$installed" = true ] && [ "$complete" = false ]; then
  for file in "${files[@]}"; do if [ -f "$backup/$file" ]; then cp -p "$backup/$file" "$file"; else rm -f "$file"; fi; done
  echo "Интерфейс восстановлен. Backup: $backup"
 fi
 rm -rf "$work"; rmdir "$lock"
 return "$result"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_TICKET_PILOT_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app/assets/plugin-covers" "$work/incoming/deploy" "$work/staged/app" "$work/before"
for file in app/ticket-pilot.js app/ticket-pilot.css app/assets/plugin-covers/ticket-pilot.svg app/ticket-pilot.test.mjs app/tariff-catalog.test.mjs app/tariff-summary.js app/tariff-summary.test.mjs app/billing.test.mjs app/billing-section.html app/billing-pricing.css landing-pricing.css subscription-plans.json deploy/landing-pricing.test.mjs deploy/subscription-pricing-runtime.js deploy/build-subscription-pricing.py deploy/stage-tariff-catalog.py deploy/stage-ticket-pilot.py; do git show "$revision:$file" > "$work/incoming/$file"; done
for file in "${files[@]}"; do if [ -f "$file" ]; then mkdir -p "$work/before/$(dirname "$file")"; cp -p "$file" "$work/before/$file"; fi; done
cp app/*.js app/*.css "$work/staged/app/"
python3 "$work/incoming/deploy/stage-ticket-pilot.py" "$PWD" "$work/incoming" "$work/staged"
cp "$work/incoming/app/"*.test.mjs "$work/staged/app/"
verify(){
 node --check app/ticket-pilot.js && node --check app/app.js && node --check app/plugin-page.js && node --check app/subscription-access.js && node --test app/ticket-pilot.test.mjs app/tariff-catalog.test.mjs app/tariff-summary.test.mjs app/billing.test.mjs deploy/landing-pricing.test.mjs
}
if command -v node >/dev/null && [ "$(node -p 'Number(process.versions.node.split(".")[0])>=22')" = true ]; then
 (cd "$work/staged";verify)
else
 docker run --rm --network none -v "$work/staged:/work:ro" -w /work node:22-alpine sh -c 'node --check app/ticket-pilot.js && node --check app/app.js && node --check app/plugin-page.js && node --check app/subscription-access.js && node --test app/ticket-pilot.test.mjs app/tariff-catalog.test.mjs app/tariff-summary.test.mjs app/billing.test.mjs deploy/landing-pricing.test.mjs'
fi
for file in "${files[@]}"; do if [ -f "$work/before/$file" ]; then cmp -s "$file" "$work/before/$file" || { echo "$file изменился во время проверки."; exit 1; };else test ! -e "$file" || exit 1;fi;done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-ticket-pilot-ui.XXXXXX");chmod 700 "$backup"
for file in "${files[@]}"; do if [ -f "$file" ]; then mkdir -p "$backup/$(dirname "$file")"; cp -p "$file" "$backup/$file"; fi; done
installed=true
for file in "${files[@]}"; do mkdir -p "$(dirname "$file")";candidate=$(mktemp "$(dirname "$file")/.ticket-pilot.XXXXXX");cp "$work/staged/$file" "$candidate";chmod 644 "$candidate";mv -f "$candidate" "$file";done
complete=true
echo "Ticket Pilot · Ультра и состав тарифов обновлены. Backup: $backup"
echo 'Цены и оплаченные сроки тарифов сохранены. Ctrl+F5 → Плагины → Ticket Pilot.'
