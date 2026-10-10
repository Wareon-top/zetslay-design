#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_DESIGN_DIR:-/opt/zetslay-site}"
lock=.zetslay-plugin-audit-ui.lock
mkdir "$lock" || { echo 'Обновление интерфейса аудита уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_PLUGIN_AUDIT_UI_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/app"
files=(app/kosell-rent.js app/account-security.js app/admin-panel.js)
for file in "${files[@]}" app/kosell-rent.test.mjs app/account-security.test.mjs app/admin-panel.test.mjs app/index.html app/admin-panel.css app/app.js app/plugin-rarity.js app/plugin-page.js; do
  git show "$revision:$file" > "$work/$file"
done
python3 - <<'PY'
from pathlib import Path
index=Path('app/index.html').read_text()
for name in ['kosell-rent.js','account-security.js','admin-panel.js']:
    if f'src="{name}?' not in index or not Path('app',name).is_file():
        raise SystemExit('Не найдены текущие модули кабинета. Интерфейс не изменён.')
PY
docker run --rm --network none -v "$work:/work:ro" -w /work node:22-alpine \
  node --test app/kosell-rent.test.mjs app/account-security.test.mjs app/admin-panel.test.mjs
backup=$(mktemp -d "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-plugin-audit-ui.XXXXXX")
chmod 700 "$backup"
mkdir -p "$backup/app"
for file in "${files[@]}" app/index.html; do cp -p "$file" "$backup/$file"; done
rollback(){
  for file in "${files[@]}" app/index.html; do cp -p "$backup/$file" "$file"; done
  echo "Прежний интерфейс восстановлен. Backup: $backup"
}
for file in "${files[@]}"; do
  if ! cp "$work/$file" "$file"; then rollback; exit 1; fi
done
if ! AUDIT_UI_REVISION="$revision" python3 - <<'PY'
import os,re
from pathlib import Path
p=Path('app/index.html');s=p.read_text()
for name in ['kosell-rent.js','account-security.js','admin-panel.js']:
    s,n=re.subn(r'(src="'+re.escape(name)+r'\?v=)[^"]*',lambda m:m[1]+os.environ['AUDIT_UI_REVISION'][:12],s)
    if n!=1: raise SystemExit('Не удалось обновить версию модуля')
p.write_text(s)
PY
then rollback; exit 1; fi
echo "Готовность Kosell и ошибки отдельных плагинов отображаются в кабинете. Backup: $backup"
