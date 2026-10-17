#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-platega-update.lock
mkdir "$lock" || { echo 'Интеграция Platega уже обновляется.'; exit 1; }
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
git fetch origin "${ZETSLAY_PLATEGA_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming" "$work/site" "$work/before"
# Read only tracked text assets, never secrets or unrelated build directories.
git ls-tree -r --name-only "$revision" -- app legal deploy subscription-plans.json | while IFS= read -r file; do
 case "$file" in *.js|*.mjs|*.css|*.html|*.json|*.py) mkdir -p "$work/incoming/$(dirname "$file")"; git show "$revision:$file" > "$work/incoming/$file";; esac
done
for file in app/index.html app/billing-section.html app/subscription-access.js index.html; do mkdir -p "$work/before/$(dirname "$file")"; cp -p "$file" "$work/before/$file"; done
git show "$revision:deploy/stage-platega.py" > "$work/stage.py"
python3 "$work/stage.py" . "$work/incoming" "$work/site"
mkdir -p "$work/verify/app"
cp app/*.js app/*.css "$work/verify/app/"
cp -R "$work/site/." "$work/verify/"
cp landing-pricing.js landing-pricing.css "$work/verify/"
for name in billing.test.mjs subscription-access.test.mjs; do cp "$work/incoming/app/$name" "$work/verify/app/$name"; done
verify(){ node --check "$1/app/payments.js"; node --check "$1/app/payments-admin.js"; node --test "$1/app/payments.test.mjs" "$1/app/billing.test.mjs" "$1/app/subscription-access.test.mjs" "$1/app/plugin-purchase-options.test.mjs" "$1/app/service-access-policy.test.mjs"; }
if command -v node >/dev/null && [ "$(node -p 'Number(process.versions.node.split(".")[0])>=22')" = true ]; then verify "$work/verify"; else
 docker run --rm --network none -v "$work/verify:/work:ro" -w /work node:22-alpine sh -c 'node --check app/payments.js && node --check app/payments-admin.js && node --test app/payments.test.mjs app/billing.test.mjs app/subscription-access.test.mjs app/plugin-purchase-options.test.mjs app/service-access-policy.test.mjs'
fi
for file in app/index.html app/billing-section.html app/subscription-access.js index.html; do cmp -s "$file" "$work/before/$file" || { echo "$file изменён во время проверки."; exit 1; }; done
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-platega.XXXXXX")
mkdir -p "$backup/original"
# All assets and legal documents before entry HTML, with a recoverable manifest.
python3 - "$work/site" <<'PY' > "$work/manifest"
import sys
from pathlib import Path
root=Path(sys.argv[1]);files=[p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()];print('\n'.join(sorted(files,key=lambda s:(s in ['index.html','app/index.html'],s))))
PY
while IFS= read -r file; do
 printf '%s\n' "$file" >> "$backup/manifest"
 if [ -f "$file" ]; then mkdir -p "$backup/original/$(dirname "$file")"; cp -p "$file" "$backup/original/$file"; fi
done < "$work/manifest"
installed=true
while IFS= read -r file; do mkdir -p "$(dirname "$file")"; candidate=$(mktemp "$(dirname "$file")/.zetslay-platega.XXXXXX"); cp "$work/site/$file" "$candidate"; chmod 644 "$candidate"; mv -f "$candidate" "$file"; done < "$work/manifest"
complete=true
echo "Подписка: пополнение через Platega, внутренний баланс и покупки установлены из $revision."
echo "Backup: $backup"
echo 'Юридическая редакция должна совпасть с API. Ключи задаются только на VPS; установка сайта их не включает.'
