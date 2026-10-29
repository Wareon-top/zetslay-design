#!/usr/bin/env bash
# Prepare a fixed pair of revisions, then apply them in one SSH-independent job.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_KOSELL_WORKSPACE_REVISION:?Укажите ревизию исправления}^{commit}")
core_revision=12f2b763cec134b7ed5071dbffc1efb5629c82dc
git -C "$core" fetch origin "$core_revision"
state=$(systemctl show zetslay-kosell-workspace-update.service -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление KOSELL уже выполняется.';exit 1;; esac
job=$(mktemp -d /root/zetslay-kosell-workspace-job.XXXXXX)
mkdir "$job/core"
for file in update-kosell-workspace.py kosell-workspace-probe.mjs kosell-workspace-patches.json bot-reliability-probe.mjs update-trust-foundation.py trust-foundation-patches.json trust-foundation-probe.mjs switch-steelproxy-direct.py check-steelproxy-readiness.py;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
for file in bot-reliability.mjs kosell-storefront-console.mjs;do git -C "$core" show "$core_revision:services/control-plane/src/$file" > "$job/core/$file";done
git show "$design_revision:deploy/update-kosell-workspace-ui.sh" > "$job/update-ui.sh"
printf '%s\n' "$core_revision" "$design_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1;core=$2;site=$3;design_revision=$4
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_KOSELL_WORKSPACE_REVISION="$design_revision" ZETSLAY_KOSELL_WORKSPACE_PREFLIGHT_ONLY=true bash "$job/update-ui.sh"
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-kosell-workspace.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_KOSELL_WORKSPACE_REVISION="$design_revision" bash "$job/update-ui.sh"
echo 'Готово: KOSELL, массовая витрина и меню бота обновлены. Версия 2026.10.29.3. В боте отправьте /kosell; кабинет обновите через Ctrl+F5.'
APPLY
systemctl reset-failed zetslay-kosell-workspace-update.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-kosell-workspace-update --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Обновление KOSELL запущено. Файлы: $job"
echo 'Дождитесь «Готово: KOSELL, массовая витрина и меню бота обновлены». Ctrl+C закрывает только просмотр журнала.'
journalctl -u zetslay-kosell-workspace-update --since '-1 min' -n 60 -f --no-pager
