#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-compact-footer-update.lock
mkdir "$lock" || { echo 'Обновление подвала уже выполняется.'; exit 1; }
work=$(mktemp -d)
backup=''
complete=false
cleanup(){
 local result=$?
 if [ -n "$backup" ] && [ "$complete" = false ]; then tar -xzf "$backup"; echo "Подвал восстановлен. Backup: $backup"; fi
 rm -rf "$work"
 rmdir "$lock"
 return "$result"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_COMPACT_FOOTER_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/deploy"
for file in deploy/build-legal-pages.py deploy/stage-compact-operator-footer.py; do git show "$revision:$file" > "$work/incoming/$file"; done
python3 "$work/incoming/deploy/stage-compact-operator-footer.py" "$PWD" "$work/incoming" "$work/staged"
files=(index.html legal/index.html)
if [ -f "$work/staged/landing-footer.html" ]; then files+=(landing-footer.html); fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-compact-footer.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" "${files[@]}"
for file in "${files[@]}"; do
 candidate=$(mktemp "$(dirname "$file")/.compact-footer.XXXXXX")
 if ! cp "$work/staged/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then rm -f "$candidate"; exit 1; fi
done
complete=true
echo "ФИО убрано из подвала главной. Backup: $backup"
echo 'В подвале — ИНН, НПД и ссылка на реквизиты. Полные реквизиты остаются в юридических документах.'
