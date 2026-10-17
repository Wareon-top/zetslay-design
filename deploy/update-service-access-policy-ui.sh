#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-service-access-policy-update.lock
mkdir "$lock" || { echo 'Обновление условий доступа уже выполняется.'; exit 1; }
work=$(mktemp -d)
backup=''
complete=false
cleanup(){ status=$?; if [ -n "$backup" ] && [ "$complete" != true ]; then
 while IFS= read -r file; do if [ -f "$backup/original/$file" ]; then cp -p "$backup/original/$file" "$file"; else rm -f -- "$file"; fi; done < "$backup/manifest";
 echo "Файлы восстановлены. Backup: $backup"; fi; rm -rf "$work"; rmdir "$lock"; return "$status"; }
trap cleanup EXIT
git fetch origin "${ZETSLAY_ACCESS_POLICY_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/deploy" "$work/original/app"
# A source snapshot lets staging preserve local layouts and unrelated modules.
for file in index.html app/index.html app/app.js; do cp -p "$file" "$work/original/$file"; done
if [ -f app/billing-section.html ]; then cp -p app/billing-section.html "$work/original/app/billing-section.html"; fi
for file in subscription-plans.json landing-pricing.js app/billing-pricing.js app/billing-section.html app/plugin-purchase-options.js app/plugin-purchase-options.css app/subscription-access.js app/knowledge-base.js app/learning.js app/billing.js app/service-access-policy.test.mjs app/plugin-purchase-options.test.mjs app/knowledge-base.test.mjs app/legal.test.mjs app/legal-cabinet.js app/legal-acceptance.js app/legal-acceptance.test.mjs app/plugin-cover.js app/plugin-rarity.js app/plugin-page.js deploy/build-subscription-pricing.py deploy/build-legal-pages.py deploy/stage-service-access-policy.py; do
 mkdir -p "$work/incoming/$(dirname "$file")"; git show "$revision:$file" > "$work/incoming/$file";
done
while IFS= read -r file; do mkdir -p "$work/incoming/$(dirname "$file")"; git show "$revision:$file" > "$work/incoming/$file"; done < <(git ls-tree -r --name-only "$revision" legal)
python3 "$work/incoming/deploy/stage-service-access-policy.py" "$work/original" "$work/incoming" "$work/staged"
cp -R "$work/staged" "$work/tests"
for file in service-access-policy.test.mjs plugin-purchase-options.test.mjs knowledge-base.test.mjs legal.test.mjs legal-acceptance.test.mjs legal-cabinet.js legal-acceptance.js plugin-cover.js plugin-rarity.js plugin-page.js; do cp "$work/incoming/app/$file" "$work/tests/app/$file"; done
# Test against the cabinet's real page renderer and rarity table when present.
for file in plugin-cover.js plugin-rarity.js plugin-page.js legal-cabinet.js legal-acceptance.js; do if [ -f "app/$file" ]; then cp "app/$file" "$work/tests/app/$file"; fi; done
for file in "$work/incoming/legal/"*.js "$work/incoming/legal/"*.css; do cp "$file" "$work/tests/legal/"; done
mkdir -p "$work/tests/assets/fonts"
cp assets/fonts/fonts.css "$work/tests/assets/fonts/fonts.css"
if command -v node >/dev/null 2>&1; then
 for file in "$work/staged/app/"*.js; do node --check "$file"; done
 node --test "$work/tests/app/service-access-policy.test.mjs" "$work/tests/app/plugin-purchase-options.test.mjs" "$work/tests/app/knowledge-base.test.mjs" "$work/tests/app/legal.test.mjs" "$work/tests/app/legal-acceptance.test.mjs"
else
 docker run --rm --network none -v "$work/tests:/work:ro" -w /work node:22-alpine sh -c 'for file in app/*.js; do node --check "$file" || exit 1; done; node --test app/service-access-policy.test.mjs app/plugin-purchase-options.test.mjs app/knowledge-base.test.mjs app/legal.test.mjs app/legal-acceptance.test.mjs'
fi
for file in index.html app/index.html app/app.js; do cmp -s "$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }; done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-service-access-policy-ui.XXXXXX");chmod 700 "$backup"
(cd "$work/staged" && find . -type f -printf '%P\n' | sort) > "$backup/manifest"
while IFS= read -r file; do if [ -f "$file" ]; then mkdir -p "$backup/original/$(dirname "$file")";cp -p "$file" "$backup/original/$file"; fi; done < "$backup/manifest"
# Publish the JSON receipt last, after all pages and scripts.
while IFS= read -r file; do
 if [ "$file" = legal/publication.json ]; then continue; fi
 mkdir -p "$(dirname "$file")";cp "$work/staged/$file" "$file";chmod 644 "$file";
done < "$backup/manifest"
cp "$work/staged/legal/publication.json" legal/publication.json;chmod 644 legal/publication.json
complete=true
echo "Условия подписки и бессрочных лицензий обновлены. Backup: $backup"
echo 'Редакция 2026-10-15-v1. Ctrl+F5. Покупка лицензии не заменяет активный тариф; прежние подтверждения не переписываются.'
