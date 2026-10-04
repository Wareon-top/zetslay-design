#!/usr/bin/env bash
set -euo pipefail
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
git fetch origin codex/landing-light-dark-redesign
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
assets=(landing-features.css assets/platforms/funpay.svg assets/platforms/ggsel.svg assets/platforms/plati-market.svg assets/platforms/starvell.svg)
for file in index.html "${assets[@]}"; do
  mkdir -p "$work/incoming/$(dirname "$file")"
  git show "$revision:$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-landing-features.py" > "$work/stage.py"
python3 "$work/stage.py" "$PWD" "$work/incoming" "$work/site"
files=("${assets[@]}" index.html)
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-features.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback=true
# Publish the HTML last, after the stylesheet and all marks are present.
for file in "${files[@]}"; do
  mkdir -p "$(dirname "$file")"
  candidate=$(mktemp "$(dirname "$file")/.zetslay-features.XXXXXX")
  cp "$work/site/$file" "$candidate"
  chmod 644 "$candidate"
  mv -f "$candidate" "$file"
done
complete=true
echo "Второй блок обновлён: пять карточек возможностей. Резервная копия: $backup"
echo 'Нажмите Ctrl+F5 на главной странице. Перезапуск API не требуется.'
