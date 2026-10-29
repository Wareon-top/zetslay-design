#!/usr/bin/env bash
# Prepare a fixed pair of revisions, then apply them in one SSH-independent job.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_EVENTS_REVISION:?Укажите ревизию исправления}^{commit}")
core_revision=ca95575ee11d539a2c83a1631358438180adac72
git -C "$core" fetch origin "$core_revision"
state=$(systemctl show zetslay-event-center-update.service -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление центра событий уже выполняется.';exit 1;; esac
job=$(mktemp -d /root/zetslay-event-center-job.XXXXXX)
mkdir "$job/core"
for file in update-workspace-upgrade.py workspace-upgrade-probe.mjs workspace-upgrade-patches.json switch-steelproxy-direct.py check-steelproxy-readiness.py;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
for file in http-server.mjs server.mjs event-center.mjs event-center-postgres.mjs;do git -C "$core" show "$core_revision:services/control-plane/src/$file" > "$job/core/$file";done
git -C "$core" show "$core_revision:services/control-plane/migrations/20261025_event_center.sql" > "$job/core/20261025_event_center.sql"
git show "$design_revision:deploy/update-event-center-ui.sh" > "$job/update-ui.sh"
printf '%s\n' "$core_revision" "$design_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1;core=$2;site=$3;design_revision=$4
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_EVENTS_REVISION="$design_revision" ZETSLAY_EVENTS_PREFLIGHT_ONLY=true bash "$job/update-ui.sh"
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-workspace-upgrade.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_EVENTS_REVISION="$design_revision" bash "$job/update-ui.sh"
echo 'Готово: центр событий обновлён. Откройте кабинет и нажмите Ctrl+F5.'
APPLY
systemctl reset-failed zetslay-event-center-update.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-event-center-update --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Обновление центра событий запущено. Файлы: $job"
echo 'Дождитесь «Готово: центр событий обновлён». Ctrl+C закрывает только просмотр журнала.'
journalctl -u zetslay-event-center-update --since '-1 min' -n 60 -f --no-pager
