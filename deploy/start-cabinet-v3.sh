#!/usr/bin/env bash
set -euo pipefail
umask 077
revision=${1:?Укажите полный commit SHA}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'Нужен полный commit SHA'; exit 1; }
cd /opt/zetslay-site
exec 9>>.zetslay-design-release.lock
flock -n 9 || { echo 'Уже выполняется обновление сайта'; exit 1; }
git fetch origin "$revision"
release=$(mktemp -d /root/zetslay-cabinet-v3.XXXXXX)
git archive "$revision" app/cabinet-v3 deploy/update-cabinet-v3.py deploy/cabinet-v3-manifest.json | tar -x -C "$release"
python3 "$release/deploy/update-cabinet-v3.py" --preflight --site /opt/zetslay-site
python3 "$release/deploy/update-cabinet-v3.py" --site /opt/zetslay-site --verify-url https://zetslay.pro
echo "Файлы установщика: $release"
echo 'Кабинет обновлён. Обновите открытую страницу браузера.'
