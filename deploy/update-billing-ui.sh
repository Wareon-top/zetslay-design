#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock="$PWD/.zetslay-billing-ui-update.lock"
mkdir "$lock" || { echo 'Обновление раздела «Финансы» уже выполняется.'; exit 1; }
work=''
cleanup() { if [ -n "$work" ]; then rm -rf -- "$work"; fi; rmdir "$lock"; }
trap cleanup EXIT
work=$(mktemp -d)
git fetch origin "${ZETSLAY_BILLING_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming"
assets=(billing-pricing.css billing.css billing-pricing.js billing.js)
for name in "${assets[@]}" billing-section.html billing.test.mjs; do
  git show "$revision:app/$name" > "$work/incoming/$name"
done
for name in stage-billing-ui.py stage-billing-ui.test.py; do
  git show "$revision:deploy/$name" > "$work/$name"
done
python3 "$work/stage-billing-ui.test.py"
python3 "$work/stage-billing-ui.py" "$PWD/app" "$work/incoming" "$work/app"
# These files are test fixtures only; the landing page is never overwritten.
git show "$revision:index.html" > "$work/index.html"
git show "$revision:landing-pricing.js" > "$work/landing-pricing.js"
git show "$revision:landing-pricing.css" > "$work/landing-pricing.css"
cp "$work/incoming/billing-section.html" "$work/incoming/billing.test.mjs" "$work/app/"
sudo docker run --rm -v "$work:/work:ro" -w /work/app node:22-alpine node --check billing.js
sudo docker run --rm -v "$work:/work:ro" -w /work/app node:22-alpine node --check billing-pricing.js
sudo docker run --rm -v "$work:/work:ro" -w /work/app node:22-alpine node --test billing.test.mjs
files=(app/index.html)
created=()
for name in "${assets[@]}"; do
  if [ -f "app/$name" ]; then files+=("app/$name"); else created+=("app/$name"); fi
done
backup=$(mktemp /root/zetslay-site-before-finances.XXXXXX.tar.gz)
tar -czf "$backup" "${files[@]}"
for name in "${assets[@]}" index.html; do
  if ! cp "$work/app/$name" "app/$name"; then
    tar -xzf "$backup"
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Ошибка применения. Сайт восстановлен. Резервная копия: $backup"
    exit 1
  fi
done
echo "Раздел «Финансы» обновлён. Резервная копия: $backup"
echo 'Нажмите Ctrl+F5. Оплата и промокоды ожидают подключения платёжного API.'
