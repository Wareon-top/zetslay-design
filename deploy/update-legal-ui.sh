#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-legal-ui-update.lock
mkdir "$lock" || { echo 'Юридический раздел уже обновляется.'; exit 1; }
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
git fetch origin "${ZETSLAY_LEGAL_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/incoming/deploy" "$work/incoming/legal" "$work/incoming/assets/fonts"
for file in $(git ls-tree -r --name-only "$revision" legal assets/fonts); do
  case "$file" in legal/*|assets/fonts/*) git show "$revision:$file" > "$work/incoming/$file";; *) exit 1;; esac
done
for file in stage-legal-ui.py stage-legal-ui.test.py build-legal-pages.py; do git show "$revision:deploy/$file" > "$work/incoming/deploy/$file"; done
for file in legal-cabinet.js legal.test.mjs; do git show "$revision:app/$file" > "$work/incoming/app/$file"; done
git show "$revision:index.html" > "$work/incoming/index.html"
git show "$revision:app/index.html" > "$work/incoming/app/index.html"
git show "$revision:landing-footer.html" > "$work/incoming/landing-footer.html"
python3 "$work/incoming/deploy/stage-legal-ui.test.py"
python3 "$work/incoming/deploy/stage-legal-ui.py" "$PWD" "$work/incoming" "$work/staged"
docker run --rm -v "$work/incoming:/work:ro" -w /work node:22-alpine node --test app/legal.test.mjs
for file in app/legal-cabinet.js legal/privacy-controls.js legal/legal-page.js; do
  docker run --rm -v "$work/staged:/work:ro" -w /work node:22-alpine node --check "$file"
done
mapfile -t files < <(cd "$work/staged" && find . -type f -printf '%P\n' | sort)
existing=()
for file in "${files[@]}"; do if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi; done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-legal.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback=true
for file in "${files[@]}"; do
  mkdir -p "$(dirname "$file")"
  candidate=$(mktemp "$(dirname "$file")/.zetslay-legal.XXXXXX")
  if ! cp "$work/staged/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then rm -f "$candidate"; exit 1; fi
done
complete=true
echo "Юридический раздел установлен. Backup: $backup"
echo 'Нажмите Ctrl+F5. Документы: https://zetslay.pro/legal/ · обращения: Профиль.'
echo 'Документы имеют статус Проект. Реквизиты и фактическое размещение данных нужно уточнить до окончательного утверждения.'
