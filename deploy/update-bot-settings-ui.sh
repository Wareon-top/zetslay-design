#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-bot-settings-ui-update.lock
mkdir "$lock" || { echo 'Обновление настроек бота уже выполняется.'; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_BOT_SETTINGS_UI_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/original" "$work/incoming"
for file in index.html profile.js; do cp -p "app/$file" "$work/original/$file"; done
assets=(bot-settings.js bot-settings.css bot-settings.test.mjs)
for file in "${assets[@]}"; do git show "$revision:app/$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-bot-settings-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
# Validate staged files without creating, stopping or recreating containers.
python3 - "$work/out" > "$work/bundle.json" <<'PYBUNDLE'
import json,sys
from pathlib import Path
root=Path(sys.argv[1]);names=['profile.js','bot-settings.js','bot-settings.test.mjs']
print(json.dumps({name:(root/name).read_text() for name in names}))
PYBUNDLE
validator=$(cat <<'NODE'
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const files=JSON.parse(fs.readFileSync(0,'utf8')),dir=fs.mkdtempSync(path.join(os.tmpdir(),'zetslay-ui-check-'));
let status=0;
try {
 for(const [name,content] of Object.entries(files))fs.writeFileSync(path.join(dir,name),content);
 for(const name of ['profile.js','bot-settings.js']) {
  const result=cp.spawnSync(process.execPath,['--check',path.join(dir,name)],{stdio:'inherit',timeout:15000});
  if(result.error||result.status!==0){status=1;break;}
 }
 if(!status){const result=cp.spawnSync(process.execPath,['--test',path.join(dir,'bot-settings.test.mjs')],{stdio:'inherit',timeout:60000});status=result.error?1:result.status??1;}
} finally {fs.rmSync(dir,{recursive:true,force:true});}
process.exitCode=status;
NODE
)
if command -v node >/dev/null 2>&1; then
 node -e "$validator" < "$work/bundle.json"
else
 mapfile -t api_ids < <(docker ps --filter status=running --filter label=com.docker.compose.project=zetslay-staging --filter label=com.docker.compose.service=api --format '{{.ID}}')
 if [ "${#api_ids[@]}" -ne 1 ]; then echo 'Для проверки JavaScript нужен Node.js или один работающий контейнер API. Файлы не изменены.';exit 1;fi
 timeout 90 docker exec -i "${api_ids[0]}" node -e "$validator" < "$work/bundle.json"
fi
for file in index.html profile.js; do cmp -s "app/$file" "$work/original/$file" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.';exit 1; }; done
files=(app/index.html app/profile.js);created=()
for file in "${assets[@]}"; do if [ -f "app/$file" ]; then files+=("app/$file");else created+=("app/$file");fi;done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-bot-settings-ui.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" "${files[@]}"
for file in "${assets[@]}" profile.js index.html; do
 if ! cp "$work/out/$file" "app/$file"; then
  tar -xzf "$backup";if [ "${#created[@]}" -gt 0 ];then rm -f -- "${created[@]}";fi
  echo "Файлы восстановлены. Backup: $backup";exit 1
 fi
done
echo "Настройки рабочего бота установлены: Профиль → Рабочий Telegram-бот → Настроить. Backup: $backup"
echo 'Откройте https://zetslay.pro/app/#profile и нажмите Ctrl+F5. API и контейнеры не перезапускались.'
