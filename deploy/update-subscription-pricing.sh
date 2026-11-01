#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock="$PWD/.zetslay-landing-hero-update.lock"
mkdir "$lock" || { echo 'Обновление сайта уже выполняется.'; exit 1; }
work=$(mktemp -d)
cleanup() { rm -rf -- "$work"; rmdir "$lock"; }
trap cleanup EXIT
git fetch origin "${ZETSLAY_SUBSCRIPTIONS_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/incoming/deploy"
# CSS files are test fixtures only; the publication list below excludes them.
for file in index.html landing-pricing.js landing-pricing.css subscription-plans.json \
  app/index.html app/billing.js app/billing-pricing.js app/billing-pricing.css app/billing.test.mjs app/billing-section.html \
  deploy/landing-pricing.test.mjs deploy/subscription-pricing-runtime.js \
  deploy/build-subscription-pricing.py deploy/stage-subscription-pricing.py deploy/stage-subscription-pricing.test.py; do
  git show "$revision:$file" > "$work/incoming/$file"
done
python3 "$work/incoming/deploy/build-subscription-pricing.py" "$work/incoming" --check
python3 "$work/incoming/deploy/stage-subscription-pricing.test.py"
python3 "$work/incoming/deploy/stage-subscription-pricing.py" "$PWD" "$work/incoming" "$work/staged"
docker run --rm -v "$work/incoming:/work:ro" -w /work node:22-alpine \
  node --test app/billing.test.mjs deploy/landing-pricing.test.mjs
for file in landing-pricing.js app/billing-pricing.js app/billing.js; do
  docker run --rm -v "$work/staged:/work:ro" -w /work node:22-alpine node --check "$file"
done
files=(index.html app/index.html landing-pricing.js app/billing-pricing.js app/billing.js)
backup=$(mktemp /root/zetslay-site-before-subscriptions.XXXXXX.tar.gz)
chmod 600 "$backup"
tar -czf "$backup" "${files[@]}"
restore() { tar -xzf "$backup"; }
# Publish quote modules before their consuming HTML. Existing live topup logic is preserved.
for file in landing-pricing.js app/billing-pricing.js app/billing.js app/index.html index.html; do
  candidate=$(mktemp "$(dirname "$file")/.zetslay-subscription.XXXXXX")
  if ! cp "$work/staged/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then
    rm -f -- "$candidate";restore
    echo "Обновление отменено. Резервная копия: $backup";exit 1
  fi
done
echo "Тарифы сайта и кабинета обновлены. Backup: $backup"
echo 'Старт 149 ₽ · Рост 299 ₽ · Профи 499 ₽ · Максимум 799 ₽. Нажмите Ctrl+F5.'
echo 'Действующий доступ и плагины сохранены. Платёжная интеграция не включалась.'
