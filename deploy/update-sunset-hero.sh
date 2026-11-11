#!/usr/bin/env bash
set -euo pipefail
umask 077
revision=${1:?Укажите SHA обновления баннера}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
site=$PWD
git cat-file -e "$revision^{commit}"
exec 9>>.zetslay-sunset-hero.lock
flock -n 9 || { echo 'Установка баннера уже выполняется.' >&2; exit 1; }
python=${ZETSLAY_PYTHON:-python3}
work=$(mktemp -d)
backup=''
publishing=false
created=()
payload=(landing-sunset-20261111.css assets/hero-sunset-20261111/main-z.webp assets/hero-sunset-20261111/sky.webp assets/hero-sunset-20261111/inter-variable.woff assets/hero-sunset-20261111/Inter-OFL.txt)
files=("${payload[@]}" index.html)
cleanup() {
  status=$?
  trap - EXIT
  if [[ "$status" != 0 && "$publishing" == true ]]; then
    if tar -xzf "$backup" -C "$site"; then
      for file in "${created[@]}"; do rm -f -- "$site/$file"; done
      echo "Установка отменена, прежние файлы восстановлены. Backup: $backup" >&2
    else
      echo "Автовосстановление не удалось. Backup: $backup" >&2
    fi
  fi
  rm -rf -- "$work"
  exit "$status"
}
trap cleanup EXIT
mkdir -p "$work/incoming/deploy" "$work/staged"
for file in "${payload[@]}" deploy/stage-sunset-hero.py deploy/sunset-hero-section.html; do
  mkdir -p "$work/incoming/$(dirname "$file")"
  git show "$revision:$file" > "$work/incoming/$file"
done
"$python" - "$site" "${files[@]}" <<'PY'
import sys
from pathlib import Path
root = Path(sys.argv[1]).resolve()
for name in sys.argv[2:]:
    target = root / name
    for part in (target, *target.parents):
        if part == root:
            break
        if part.is_symlink():
            raise SystemExit(f'Отказ от записи через symlink: {name}')
    if not target.resolve().is_relative_to(root):
        raise SystemExit('Путь вышел за каталог сайта.')
    if target.exists() and not target.is_file():
        raise SystemExit(f'Ожидался обычный файл: {name}')
PY
cp -p index.html "$work/index.before"
"$python" "$work/incoming/deploy/stage-sunset-hero.py" "$site" "$work/incoming" "$work/staged"
for file in "${payload[@]}"; do
  mkdir -p "$work/staged/$(dirname "$file")"
  cp -- "$work/incoming/$file" "$work/staged/$file"
  if [[ -e "$file" ]] && ! cmp -s "$file" "$work/staged/$file"; then
    # Permit the exact previously published CSS; reject custom or unknown edits.
    previous_css=6ec8eeb93ca16c6b093b594eb7554b24b769173b479a30cb768bfa9fe8ed6e7f
    actual=$(sha256sum "$file"); actual=${actual%% *}
    if [[ "$file" != landing-sunset-20261111.css || "$actual" != "$previous_css" ]]; then
      echo "Файл $file уже существует и отличается от проверенных версий. Ничего не установлено." >&2
      exit 1
    fi
  fi
done
if [[ "${ZETSLAY_SUNSET_PREFLIGHT_ONLY:-false}" == true ]]; then
  echo 'Совместимость подтверждена. Шапка и остальные разделы сохраняются. Файлы сайта не изменены.'
  exit 0
fi
changed=false
existing=()
for file in "${files[@]}"; do
  if [[ -e "$file" ]]; then existing+=("$file"); else created+=("$file"); fi
  if [[ ! -f "$file" ]] || ! cmp -s "$file" "$work/staged/$file"; then changed=true; fi
done
if [[ "$changed" == false ]]; then echo 'Согласованный баннер уже установлен.'; exit 0; fi
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-sunset-hero.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
cmp -s index.html "$work/index.before" || { echo 'Главная изменилась во время подготовки. Установка отменена.' >&2; exit 1; }
publishing=true
# Assets first; the new HTML is published last. Static hosting needs no restart.
for file in "${files[@]}"; do
  directory=$(dirname "$file")
  if [[ "$directory" != . && ! -d "$directory" ]]; then mkdir -p -m 755 "$directory"; fi
  candidate=$(mktemp "$directory/.zetslay-sunset.XXXXXX")
  cp -- "$work/staged/$file" "$candidate"
  chmod 644 "$candidate"
  mv -f -- "$candidate" "$file"
done
for file in "${files[@]}"; do cmp -s "$file" "$work/staged/$file"; done
url=${ZETSLAY_SUNSET_VERIFY_URL:-https://zetslay.pro/}
separator='?'; [[ "$url" != *'?'* ]] || separator='&'
curl -fsS --max-time 20 "${url}${separator}sunset-release=${revision}" -o "$work/published.html"
"$python" - "$work/published.html" <<'PY'
import sys
from pathlib import Path
html = Path(sys.argv[1]).read_bytes()
if html.count(b'data-landing-hero="sunset-v4"') != 1 or b'landing-sunset-20261111.css?v=sunset-v4-fit1"' not in html:
    raise SystemExit('Публичная страница не подтвердила обновление. Выполняется откат.')
PY
base=${url%%\?*}; base=${base%/}
for file in "${payload[@]}"; do
  curl -fsS --max-time 20 "$base/$file?sunset-release=$revision" -o "$work/http-check"
  cmp -s "$work/http-check" "$work/staged/$file" || { echo "Публичный файл $file не совпал с пакетом. Выполняется откат." >&2; exit 1; }
done
publishing=false
echo "Баннер установлен. Публичная главная подтверждена. Backup: $backup"
echo 'https://zetslay.pro/ — обновите страницу Ctrl+F5.'
