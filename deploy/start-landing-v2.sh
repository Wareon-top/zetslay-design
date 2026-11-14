#!/usr/bin/env bash
set -euo pipefail
umask 077
revision=${1:?Укажите полный commit SHA}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'Нужен полный commit SHA'; exit 1; }
cd /opt/zetslay-site
exec 9>>.zetslay-design-release.lock
flock -n 9 || { echo 'Уже выполняется обновление сайта'; exit 1; }
git fetch origin "$revision"
release=$(mktemp -d /root/zetslay-landing-v2.XXXXXX)
git archive "$revision" index.html landing-v2.css landing-v2.js assets/landing-v2 \
  legal/legal-controls-20261109.css legal/privacy-controls-20261109.js \
  deploy/update-landing-v2.py deploy/landing-v2-manifest.json | tar -x -C "$release"
python3 "$release/deploy/update-landing-v2.py" --preflight --site /opt/zetslay-site
python3 "$release/deploy/update-landing-v2.py" --site /opt/zetslay-site --verify-url https://zetslay.pro
echo "Главная обновлена. Файлы установки: $release"
