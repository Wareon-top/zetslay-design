#!/usr/bin/env bash
set -euo pipefail
umask 077
revision=${1:?Укажите ревизию отключения объявления}
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
exec 9>>.zetslay-site-update.owner
flock -n 9 || { echo 'Другое обновление сайта ещё выполняется'; exit 1; }
script=$(mktemp /root/zetslay-remove-launch.XXXXXX)
trap 'rm -f -- "$script"' EXIT
git show "$revision:deploy/update-remove-launch.py" > "$script"
python3 -I "$script" "$revision" --preflight
python3 -I "$script" "$revision"
