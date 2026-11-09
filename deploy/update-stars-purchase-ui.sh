#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=${1:?Укажите SHA исправления интерфейса}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
git cat-file -e "$revision^{commit}"

lock=.zetslay-stars-purchase-ui.lock
mkdir "$lock" || { echo 'Обновление уже выполняется.'; exit 1; }
work=''
backup=''
publishing=false
files=(plugin-purchase-options.js payment-confirmation.js index.html)
cleanup() {
  local status=$?
  if [[ "$status" != 0 && "$publishing" == true ]]; then
    if tar -xzf "$backup"; then
      echo "Прежние файлы восстановлены. Резервная копия: $backup"
    else
      echo "Не удалось автоматически восстановить файлы. Резервная копия: $backup" >&2
    fi
  fi
  if [[ -n "$work" ]]; then
    for file in "${files[@]}"; do rm -f -- "$work/$file" "$work/old-$file"; done
    rmdir -- "$work"
  fi
  rmdir -- "$lock"
}
trap cleanup EXIT
work=$(mktemp -d app/.zetslay-stars-purchase-ui.XXXXXX)

for file in "${files[@]}"; do
  [[ -f "app/$file" && ! -L "app/$file" ]] || exit 1
  cp -p -- "app/$file" "$work/old-$file"
done

for file in "${files[@]:0:2}"; do
  git show "$revision:app/$file" > "$work/$file"
  case "$file" in
    plugin-purchase-options.js) expected=5deca50d3311f70c1c48aad46199362199023b9771b3ce144b47dabdeb891eae ;;
    payment-confirmation.js) expected=e63a9d7575a70afef38817b96fae9954a0844c9cecfe854dc55db57167fb71b1 ;;
  esac
  actual=$(sha256sum "$work/old-$file")
  if [[ "${actual%% *}" != "$expected" ]] && ! cmp -s "$work/$file" "$work/old-$file"; then
    echo "Версия app/$file отличается от проверенной. Файлы не изменены." >&2
    exit 1
  fi
  if command -v node >/dev/null 2>&1; then node --check "$work/$file"; fi
done

python3 - "$work" <<'PY'
from pathlib import Path
import re
import sys

work = Path(sys.argv[1])
html = (work / "old-index.html").read_bytes()
for name in (b"plugin-purchase-options.js", b"payment-confirmation.js"):
    pattern = rb'(<script\s+src=")' + re.escape(name) + rb'(?:\?v=[a-zA-Z0-9-]+)?(")'
    html, count = re.subn(pattern, rb'\g<1>' + name + rb'?v=20261109-stars-relay-purchase\g<2>', html)
    if count != 1:
        raise SystemExit(f"Ожидался один тег для {name.decode()}. Файлы не изменены.")
(work / "index.html").write_bytes(html)
PY

changed=false
for file in "${files[@]}"; do
  cmp -s "app/$file" "$work/old-$file" || { echo 'Файлы изменились во время подготовки.'; exit 1; }
  if ! cmp -s "$work/$file" "$work/old-$file"; then changed=true; fi
done
if [[ "$changed" == false ]]; then echo 'Исправление уже установлено.'; exit 0; fi
if [[ "${ZETSLAY_STARS_PURCHASE_PREFLIGHT_ONLY:-false}" == true ]]; then
  echo 'Совместимость подтверждена. Файлы не изменены.'
  exit 0
fi

backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-stars-purchase-ui.XXXXXX.tar.gz")
tar -czf "$backup" app/plugin-purchase-options.js app/payment-confirmation.js app/index.html
publishing=true
for file in "${files[@]}"; do
  chmod 644 "$work/$file"
  mv -f -- "$work/$file" "app/$file"
done
publishing=false
echo "Интерфейс покупки обновлён. Резервная копия: $backup"
