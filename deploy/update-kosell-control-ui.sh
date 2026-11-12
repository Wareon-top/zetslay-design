#!/usr/bin/env bash
set -euo pipefail
umask 077
revision=${1:?Укажите ревизию интерфейса Kosell}
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
exec 9>>.zetslay-site-update.owner
flock -n 9 || { echo 'Другое обновление сайта ещё выполняется'; exit 1; }
script=$(mktemp /root/zetslay-kosell-ui.XXXXXX)
trap 'rm -f -- "$script"' EXIT
git show "$revision:deploy/update-kosell-control-ui.py" > "$script"
python3 -I "$script" "$revision" --preflight
python3 -I "$script" "$revision"
