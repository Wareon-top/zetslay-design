#!/usr/bin/env bash
# Prepare a fixed pair of revisions, then apply them in one SSH-independent job.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_WORKSPACE_REVISION:?Укажите ревизию исправления}^{commit}")
core_revision=4e2a097f0d7c4c4d768d94ffa1119dbd80d77624
git -C "$core" fetch origin "$core_revision"
state=$(systemctl show zetslay-workspace-upgrade-repair.service -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление кабинета уже выполняется.';exit 1;; esac
job=$(mktemp -d /root/zetslay-workspace-upgrade-job.XXXXXX)
mkdir "$job/core"
for file in update-workspace-upgrade.py workspace-upgrade-probe.mjs workspace-upgrade-patches.json switch-steelproxy-direct.py check-steelproxy-readiness.py;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
for file in http-server.mjs server.mjs event-center.mjs event-center-postgres.mjs;do git -C "$core" show "$core_revision:services/control-plane/src/$file" > "$job/core/$file";done
git -C "$core" show "$core_revision:services/control-plane/migrations/20261025_event_center.sql" > "$job/core/20261025_event_center.sql"
git show "$design_revision:deploy/update-workspace-ui.sh" > "$job/update-ui.sh"
printf '%s\n' "$core_revision" "$design_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1;core=$2;site=$3;design_revision=$4
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_WORKSPACE_REVISION="$design_revision" ZETSLAY_WORKSPACE_PREFLIGHT_ONLY=true bash "$job/update-ui.sh"
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-workspace-upgrade.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_WORKSPACE_REVISION="$design_revision" bash "$job/update-ui.sh"
echo 'Готово: обновление кабинета установлено. Откройте кабинет и нажмите Ctrl+F5.'
APPLY
systemctl reset-failed zetslay-workspace-upgrade-repair.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-workspace-upgrade-repair --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Обновление кабинета запущено. Файлы: $job"
echo 'Дождитесь «Готово: обновление кабинета установлено». Ctrl+C закрывает только просмотр журнала.'
journalctl -u zetslay-workspace-upgrade-repair --since '-1 min' -n 60 -f --no-pager
