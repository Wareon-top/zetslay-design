#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-legal-publication-update.lock
mkdir "$lock" || { echo 'Обновление документов уже выполняется.'; exit 1; }
work=$(mktemp -d)
backup=''
complete=false
created=()
cleanup() {
  status=$?
  if [ -n "$backup" ] && [ "$complete" = false ]; then
    tar -xzf "$backup"
    for file in "${created[@]}"; do rm -f -- "$file"; done
    echo "Файлы восстановлены. Backup: $backup"
  fi
  rm -rf "$work"; rmdir "$lock"; return "$status"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_LEGAL_PUBLICATION_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/incoming/deploy" "$work/incoming/legal" "$work/incoming/assets/fonts"
while IFS= read -r file; do
  mkdir -p "$work/incoming/$(dirname "$file")"
  git show "$revision:$file" > "$work/incoming/$file"
done < <(git ls-tree -r --name-only "$revision" legal assets/fonts)
for file in stage-legal-ui.py stage-legal-ui.test.py build-legal-pages.py; do git show "$revision:deploy/$file" > "$work/incoming/deploy/$file"; done
for file in legal-cabinet.js legal.test.mjs legal-acceptance.js legal-acceptance.test.mjs; do git show "$revision:app/$file" > "$work/incoming/app/$file"; done
for file in index.html app/index.html landing-footer.html; do git show "$revision:$file" > "$work/incoming/$file"; done
python3 "$work/incoming/deploy/stage-legal-ui.test.py"
python3 "$work/incoming/deploy/stage-legal-ui.py" "$PWD" "$work/incoming" "$work/staged"
cp "$work/incoming/app/"*.test.mjs "$work/staged/app/"
if command -v node >/dev/null 2>&1; then
  node --check "$work/staged/app/legal-cabinet.js"
  node --check "$work/staged/app/legal-acceptance.js"
  node --test "$work/staged/app/legal.test.mjs" "$work/staged/app/legal-acceptance.test.mjs"
else
  docker run --rm --network none -v "$work/staged:/work:ro" -w /work node:22-alpine sh -c 'node --check app/legal-cabinet.js && node --check app/legal-acceptance.js && node --test app/legal.test.mjs app/legal-acceptance.test.mjs'
fi
find "$work/staged" -type f \( -name '*.test.mjs' -o -name '*.pyc' \) -delete
mapfile -t files < <(cd "$work/staged" && find . -type f -printf '%P\n' | sort)
existing=()
for file in "${files[@]}"; do if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi; done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-legal-publication-ui.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
for file in "${files[@]}"; do
  mkdir -p "$(dirname "$file")"
  candidate=$(mktemp "$(dirname "$file")/.legal-publication.XXXXXX")
  if ! cp "$work/staged/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then rm -f "$candidate"; exit 1; fi
done
complete=true
echo "Действующая редакция документов размещена. Backup: $backup"
echo 'https://zetslay.pro/legal/ · Ctrl+F5. Принятие условий: Профиль → Документы и обращения.'
