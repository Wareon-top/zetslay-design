#!/usr/bin/env bash
set -euo pipefail
# Staged assets are public and must remain readable by the static web server.
# mktemp creates the backup archive privately regardless of this mask.
umask 022
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock='.zetslay-landing-hero-update.lock'
mkdir "$lock" || { echo 'Главная страница уже обновляется.'; exit 1; }
work=$(mktemp -d)
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
    if [ "${#created[@]}" -gt 0 ]; then rm -f -- "${created[@]}"; fi
    echo "Главная страница восстановлена. Резервная копия: $backup"
  fi
  if [ -n "$candidate" ]; then rm -f -- "$candidate"; fi
  rm -rf "$work"
  rmdir "$lock"
  return "$status"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_LANDING_PLUGINS_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming"
for file in index.html landing-plugins.css; do git show "$revision:$file" > "$work/incoming/$file"; done
git show "$revision:deploy/stage-landing-plugins.py" > "$work/stage.py"
git show "$revision:deploy/export-landing-plugins.mjs" > "$work/export.mjs"
# No login/session, FunPay connection or workspace settings are accessed.
timeout 15s sudo docker ps --filter label=com.docker.compose.project=zetslay-staging \
  --filter label=com.docker.compose.service=api --format '{{.ID}}' > "$work/api-containers"
mapfile -t api_containers < "$work/api-containers"
if [ "${#api_containers[@]}" -ne 1 ] || ! [[ "${api_containers[0]}" =~ ^[a-f0-9]{12,64}$ ]]; then
  echo 'Не найден единственный работающий API. Главная страница не изменена.' >&2
  exit 1
fi
timeout 60s sudo docker exec -i "${api_containers[0]}" node --input-type=module \
  < "$work/export.mjs" > "$work/public-cards.json"
python3 "$work/stage.py" "$PWD" "$work/incoming" "$work/site" "$work/public-cards.json"
mapfile -t files < <(find "$work/site" -type f -printf '%P\n' | sort)
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-landing-plugins.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback=true
for file in "${files[@]}"; do
  if [ "$file" = index.html ]; then continue; fi
  mkdir -p "$(dirname "$file")"
  cp "$work/site/$file" "$file"
done
candidate=$(mktemp .zetslay-landing-plugins.XXXXXX)
cp "$work/site/index.html" "$candidate"
chmod --reference=index.html "$candidate"
mv -f "$candidate" index.html
candidate=''
complete=true
echo "Витрина плагинов установлена. Резервная копия: $backup"
echo 'Использованы опубликованные названия и исходные обложки. Кабинет и настройки плагинов не изменены. Нажмите Ctrl+F5.'
