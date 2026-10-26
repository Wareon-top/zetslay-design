#!/usr/bin/env bash
# Prepare a fixed pair of revisions, then apply them in one SSH-independent job.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_ULTRA_AUDIT_REVISION:?Укажите ревизию исправления}^{commit}")
core_revision=14606ce8e2583a8fd4904ade6ec3f51426c5fa1c
git -C "$core" fetch origin "$core_revision"
state=$(systemctl show zetslay-ultra-audit-repair.service -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Исправление Ультра-плагинов уже выполняется.';exit 1;; esac
job=$(mktemp -d /root/zetslay-ultra-audit-job.XXXXXX)
mkdir "$job/core"
for file in update-ultra-audit.py ultra-audit-probe.mjs ultra-audit-manifest.json switch-steelproxy-direct.py check-steelproxy-readiness.py;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
for file in robux-service.mjs ticket-pilot-service.mjs ai-reviews-service.mjs robux-console.mjs robux-catalog-description.mjs;do git -C "$core" show "$core_revision:services/control-plane/src/$file" > "$job/core/$file";done
git show "$design_revision:deploy/update-ultra-ui.sh" > "$job/update-ui.sh"
printf '%s\n' "$core_revision" "$design_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1;core=$2;site=$3;design_revision=$4
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_ULTRA_AUDIT_REVISION="$design_revision" ZETSLAY_ULTRA_AUDIT_PREFLIGHT_ONLY=true bash "$job/update-ui.sh"
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-ultra-audit.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_ULTRA_AUDIT_REVISION="$design_revision" bash "$job/update-ui.sh"
echo 'Готово: исправления Ультра-плагинов установлены. Откройте кабинет и нажмите Ctrl+F5.'
APPLY
systemctl reset-failed zetslay-ultra-audit-repair.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-ultra-audit-repair --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Исправление Ультра-плагинов запущено. Файлы: $job"
echo 'Дождитесь «Готово: исправления Ультра-плагинов установлены». Ctrl+C закрывает только просмотр журнала.'
journalctl -u zetslay-ultra-audit-repair --since '-1 min' -n 60 -f --no-pager
