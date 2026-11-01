#!/usr/bin/env bash
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_SUPPORT_ALERTS_REVISION:?Укажите ревизию обновления}^{commit}")
core_revision=e969b61116bd32f0ace32de842ff5ee1574346be
state=$(systemctl show zetslay-support-alerts-update.service -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление уведомлений поддержки уже выполняется.';exit 1;; esac
git -C "$core" fetch origin "$core_revision"
job=$(mktemp -d /root/zetslay-support-alerts-job.XXXXXX)
mkdir "$job/core"
for file in update-support-alerts.py support-alerts-patches.json support-alerts-probe.mjs support-alert-db-probe.mjs update-trust-foundation.py trust-foundation-patches.json trust-foundation-probe.mjs switch-steelproxy-direct.py check-steelproxy-readiness.py;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
for file in 20261017_service_bot.sql 20261017_support.sql 20261101_support_owner_notifications.sql;do git -C "$core" show "$core_revision:services/control-plane/migrations/$file" > "$job/core/$file";done
git show "$design_revision:deploy/update-support-alerts-ui.sh" > "$job/update-ui.sh"
printf '%s\n' "$core_revision" "$design_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1;core=$2;site=$3;design_revision=$4
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_SUPPORT_ALERTS_REVISION="$design_revision" ZETSLAY_SUPPORT_ALERTS_PREFLIGHT_ONLY=true bash "$job/update-ui.sh"
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-support-alerts.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_SUPPORT_ALERTS_REVISION="$design_revision" bash "$job/update-ui.sh"
echo 'Готово: уведомления поддержки в Telegram и переход к обращению установлены.'
echo 'Откройте главного бота ZetSlay → /start → /notifications. Для владельца появится настройка «Поддержка».'
APPLY
systemctl reset-failed zetslay-support-alerts-update.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-support-alerts-update --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Обновление уведомлений поддержки запущено. Файлы: $job"
echo 'Дождитесь «Готово: уведомления поддержки в Telegram и переход к обращению установлены». Ctrl+C закрывает только журнал.'
journalctl -u zetslay-support-alerts-update --since '-1 min' -n 60 -f --no-pager
