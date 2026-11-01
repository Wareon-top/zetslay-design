#!/usr/bin/env bash
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
cd "$site"
revision=$(git rev-parse "${ZETSLAY_MOBILE_LOGIN_REVISION:?Укажите ревизию обновления}^{commit}")
state=$(systemctl show zetslay-mobile-login-update.service -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление мобильного входа уже выполняется.';exit 1;; esac
job=$(mktemp -d /root/zetslay-mobile-login-job.XXXXXX)
git show "$revision:deploy/update-mobile-login.sh" > "$job/update.sh"
printf '%s\n' "$revision" > "$job/revision"
systemctl reset-failed zetslay-mobile-login-update.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-mobile-login-update --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=180 --property=UMask=0077 --setenv="ZETSLAY_SITE_DIR=$site" --setenv="ZETSLAY_MOBILE_LOGIN_REVISION=$revision" /bin/bash "$job/update.sh"
echo "Обновление мобильного входа запущено. Файлы: $job"
echo 'Дождитесь «Готово: мобильная форма входа обновлена». Ctrl+C закрывает только журнал.'
journalctl -u zetslay-mobile-login-update --since '-1 min' -n 60 -f --no-pager
