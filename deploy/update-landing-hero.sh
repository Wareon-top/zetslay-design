#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
echo '[1/5] Получаем проверенную ревизию…'
git fetch origin "${ZETSLAY_HERO_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock='.zetslay-landing-hero-update.lock'
mkdir "$lock" || { rm -rf "$work"; echo 'Главный блок уже обновляется.'; exit 1; }
printf '%s\n' "$$" > "$lock/pid"
backup=''
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
  rm -rf "$work"
  rm -f "$lock/pid"
  rmdir "$lock"
  return "$status"
}
trap cleanup EXIT
echo '[2/5] Подготавливаем меню и первый экран…'
mkdir -p "$work/incoming" "$work/site"
assets=(landing-hero.css landing-hero.js landing-orderflow.css assets/zetslay-orderflow.webp assets/platforms/funpay.svg assets/platforms/ggsel.svg assets/platforms/plati-market.svg assets/platforms/starvell.svg)
for file in index.html "${assets[@]}"; do
  mkdir -p "$work/incoming/$(dirname "$file")"
  git show "$revision:$file" > "$work/incoming/$file"
done
git show "$revision:deploy/stage-landing-hero.py" > "$work/stage.py"
timeout 30s python3 "$work/stage.py" "$PWD" "$work/incoming" "$work/site"
echo '[3/5] Проверяем целостность файлов…'
for file in "${assets[@]}"; do
  expected=$(git rev-parse "$revision:$file")
  actual=$(git hash-object "$work/site/$file")
  if [ "$expected" != "$actual" ]; then
    echo "Проверка файла не прошла: $file. Сайт не изменён." >&2
    exit 1
  fi
done
if command -v node >/dev/null; then
  timeout 15s node --check "$work/site/landing-hero.js"
else
  echo 'Локального Node.js нет. JS совпадает с Git-ревизией, проверенной в CI; Docker не требуется.'
fi
# Publish the HTML last, after all assets are present.
files=("${assets[@]}" index.html)
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-site-before-hero.XXXXXX.tar.gz")
echo '[4/5] Сохраняем прежний вариант…'
tar -czf "$backup" "${existing[@]}"
rollback=true
echo '[5/5] Публикуем файлы, HTML — последним…'
for file in "${files[@]}"; do
  mkdir -p "$(dirname "$file")"
  candidate=$(mktemp "$(dirname "$file")/.zetslay-hero.XXXXXX")
  cp "$work/site/$file" "$candidate"
  chmod 644 "$candidate"
  mv -f "$candidate" "$file"
done
complete=true
echo "Меню и первый экран обновлены. Резервная копия: $backup"
echo "Откат: cd '$PWD' && tar -xzf '$backup'"
echo 'Нажмите Ctrl+F5 на главной странице. Кабинет, API и исходная landing.css сохранены.'
