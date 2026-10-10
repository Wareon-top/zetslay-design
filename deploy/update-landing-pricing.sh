#!/usr/bin/env bash
set -euo pipefail
# Keep subprocesses from consuming a caller's remaining pasted commands.
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
requested=${ZETSLAY_PRICING_DESIGN_REVISION:-codex/landing-light-dark-redesign}
git fetch origin "$requested"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
# Share the hero installer's lock: both updates publish index.html.
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
assets=(landing-pricing.css landing-pricing.js)
for file in index.html "${assets[@]}"; do
  mkdir -p "$work/incoming/$(dirname "$file")"
  git show "$revision:$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-landing-pricing.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD" "$work/incoming" "$work/site"
files=("${assets[@]}" index.html)
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-pricing.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback=true
# Publish the HTML last, after the stylesheet and all marks are present.
for file in "${files[@]}"; do
  mkdir -p "$(dirname "$file")"
  candidate=$(mktemp "$(dirname "$file")/.zetslay-pricing.XXXXXX")
  cp "$work/site/$file" "$candidate"
  chmod 644 "$candidate"
  mv -f "$candidate" "$file"
done
complete=true
echo "Блок тарифов обновлён: Старт, Рост, Профи и Максимум. Резервная копия: $backup"
echo 'Нажмите Ctrl+F5 на главной странице. Перезапуск API не требуется.'
