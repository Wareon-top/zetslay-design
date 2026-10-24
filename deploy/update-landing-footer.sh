#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin "${ZETSLAY_FOOTER_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-landing-hero-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Главная страница уже обновляется.'; exit 1; }
backup=''
candidate=''
rollback=false
complete=false
existing=()
created=()
cleanup() {
  status=$?
  if [ "$rollback" = true ] && [ "$complete" = false ]; then
    tar -xzf "$backup"
    for file in "${created[@]}"; do rm -f -- "$file"; done
    echo "Обновление отменено. Резервная копия: $backup"
  fi
  if [ -n "$candidate" ]; then rm -f -- "$candidate"; fi
  rm -rf "$work"
  rmdir "$lock"
  return "$status"
}
trap cleanup EXIT
mkdir -p "$work/incoming" "$work/site"
for file in landing-footer.html landing-footer.css landing-footer.js; do
  git show "$revision:$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-landing-footer.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD" "$work/incoming" "$work/site"
docker run --rm -v "$work/site:/work:ro" -w /work node:22-alpine node --check landing-footer.js </dev/null
files=(landing-footer.css landing-footer.js index.html)
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-footer.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback=true
for file in "${files[@]}"; do
  candidate=$(mktemp "$(dirname "$file")/.zetslay-footer.XXXXXX")
  cp "$work/site/$file" "$candidate"
  chmod 644 "$candidate"
  mv -f "$candidate" "$file"
done
complete=true
echo "Footer обновлён. Резервная копия: $backup"
echo 'Нажмите Ctrl+F5 на главной странице. Перезапуск API не требуется.'
