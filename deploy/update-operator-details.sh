#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-operator-update.lock
mkdir "$lock" || { echo 'Обновление реквизитов уже выполняется.'; exit 1; }
work=$(mktemp -d)
backup=''
rollback=false
complete=false
created=()
cleanup() {
  status=$?
  if [ "$rollback" = true ] && [ "$complete" = false ]; then
    tar -xzf "$backup"
    for file in "${created[@]}"; do rm -f -- "$file"; done
    echo "Обновление отменено. Backup: $backup"
  fi
  rm -rf "$work"
  rmdir "$lock"
  return "$status"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_OPERATOR_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/legal" "$work/incoming/deploy"
for file in legal/site-config.json legal/documents.json deploy/build-legal-pages.py deploy/stage-operator-details.py deploy/stage-operator-details.test.py; do
  git show "$revision:$file" > "$work/incoming/$file"
done
python3 "$work/incoming/deploy/stage-operator-details.test.py"
python3 "$work/incoming/deploy/stage-operator-details.py" "$PWD" "$work/incoming" "$work/staged"
mapfile -t files < <(cd "$work/staged" && find . -type f -printf '%P\n' | sort)
existing=()
for file in "${files[@]}"; do if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi; done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-operator.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" "${existing[@]}"
rollback=true
for file in "${files[@]}"; do
  mkdir -p "$(dirname "$file")"
  candidate=$(mktemp "$(dirname "$file")/.zetslay-operator.XXXXXX")
  if ! cp "$work/staged/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then rm -f "$candidate"; exit 1; fi
done
complete=true
echo "ФИО, ИНН и НПД добавлены. Backup: $backup"
echo 'Документы: https://zetslay.pro/legal/ · обновите страницу Ctrl+F5.'
echo 'Внешний контакт не указан. Статус документов этим обновлением не утверждается.'
