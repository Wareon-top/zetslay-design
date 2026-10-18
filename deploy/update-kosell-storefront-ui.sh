#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-kosell-storefront-update.lock
mkdir "$lock" || { echo 'Обновление витрины уже выполняется.'; exit 1; }
work=$(mktemp -d)
backup=''
complete=false
cleanup(){ local status=$?; if [ -n "$backup" ] && [ "$complete" = false ]; then tar -xzf "$backup"; for name in kosell-storefront.js kosell-storefront.css; do if [ ! -f "$work/existed-$name" ]; then rm -f "app/$name"; fi; done; echo "Интерфейс восстановлен. Backup: $backup"; fi; rm -rf "$work"; rmdir "$lock"; return "$status"; }
trap cleanup EXIT
git fetch origin "${ZETSLAY_KOSELL_STOREFRONT_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/incoming/deploy"
for file in app/kosell-storefront.js app/kosell-storefront.css app/kosell-storefront.test.mjs deploy/stage-kosell-storefront.py deploy/stage-kosell-storefront.test.py; do git show "$revision:$file" > "$work/incoming/$file"; done
python3 "$work/incoming/deploy/stage-kosell-storefront.test.py"
python3 "$work/incoming/deploy/stage-kosell-storefront.py" "$PWD/app" "$work/incoming/app" "$work/staged"
if command -v node >/dev/null 2>&1; then node --check "$work/staged/kosell-storefront.js"; node --test "$work/incoming/app/kosell-storefront.test.mjs";
else docker run --rm --network none -v "$work/incoming:/work:ro" -w /work node:22-alpine sh -c 'node --check app/kosell-storefront.js && node --test app/kosell-storefront.test.mjs'; fi
files=(app/index.html)
for name in kosell-storefront.js kosell-storefront.css; do if [ -f "app/$name" ]; then files+=("app/$name"); touch "$work/existed-$name"; fi; done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-kosell-storefront-ui.XXXXXX.tar.gz")
tar -czf "$backup" "${files[@]}"
for name in kosell-storefront.js kosell-storefront.css index.html; do candidate=$(mktemp "app/.storefront.XXXXXX"); if ! cp "$work/staged/$name" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "app/$name"; then rm -f "$candidate"; exit 1; fi; done
complete=true
echo "Массовая витрина без обязательных лотов-образцов установлена. Backup: $backup"
echo 'Ctrl+F5 → Kosell Rent → Массовая витрина. Для сохранённого плана: «Обновить подтверждение без пересчёта».'
