#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_SUBSCRIPTION_NAV_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
lock=.zetslay-subscription-navigation.lock
mkdir "$lock" || { echo 'Обновление меню уже выполняется.'; exit 1; }
work=$(mktemp -d)
installed=false
committed=false
backup=''
cleanup() {
 if [ "$installed" = true ] && [ "$committed" != true ]; then tar -xzf "$backup"; echo "Восстановлены прежние файлы. Backup: $backup"; fi
 rm -rf "$work"
 rmdir "$lock"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
files=(app.js billing-section.html learning.js knowledge-base.js plugin-purchase-options.js profile.js index.html)
mkdir -p "$work/app" "$work/before"
for name in "${files[@]}"; do cp "app/$name" "$work/before/$name"; done
# Test with the actual installed app and its public frontend dependencies.
cp app/*.js app/*.css "$work/app/"
cp index.html landing-pricing.js landing-pricing.css subscription-plans.json "$work/"
git show "$revision:deploy/stage-subscription-navigation.py" > "$work/stage.py"
python3 "$work/stage.py" app "$work/app"
for name in app.test.mjs billing.test.mjs; do git show "$revision:app/$name" > "$work/app/$name"; done
if command -v node >/dev/null && [ "$(node -p 'Number(process.versions.node.split(".")[0])>=22')" = true ]; then
 node --check "$work/app/app.js"
 node --test "$work/app/app.test.mjs" "$work/app/billing.test.mjs"
else
 docker run --rm --network none -v "$work:/work:ro" -w /work node:22-alpine sh -c 'node --check app/app.js && node --test app/app.test.mjs app/billing.test.mjs'
fi
for name in "${files[@]}"; do
 cmp -s "app/$name" "$work/before/$name" || { echo "app/$name изменён во время проверки. Обновление остановлено."; exit 1; }
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-subscription-navigation.XXXXXX.tar.gz")
paths=(); for name in "${files[@]}"; do paths+=("app/$name"); done
tar -czf "$backup" "${paths[@]}"
installed=true
for name in "${files[@]}"; do
 candidate=$(mktemp app/.zetslay-subscription-navigation.XXXXXX)
 cp "$work/app/$name" "$candidate"
 chmod 644 "$candidate"
 mv -f "$candidate" "app/$name"
done
committed=true
echo "Раздел Подписка и отдельный пустой раздел Финансы установлены из $revision."
echo "Backup: $backup"
echo 'Обновите страницу кабинета. Перезапуск API не требуется.'
