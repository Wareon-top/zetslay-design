#!/usr/bin/env bash
# Prepare a fixed pair of revisions, then apply them in one SSH-independent job.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_PROXY_CHECKOUT_REVISION:?Укажите ревизию исправления}^{commit}")
core_revision=e0d9d933dd2f5762a60b755d1187e3b6d7cb639d
git -C "$core" fetch origin "$core_revision"
state=$(systemctl show zetslay-proxy-checkout-repair.service -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление покупки прокси уже выполняется.';exit 1;; esac
job=$(mktemp -d /root/zetslay-proxy-checkout-job.XXXXXX)
mkdir "$job/core"
for file in update-proxy-checkout.py proxy-checkout-probe.mjs proxy-checkout-readiness.mjs proxy-checkout-patches.json switch-steelproxy-direct.py check-steelproxy-readiness.py;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
for file in proxy-sales-service.mjs steelproxy-client.mjs http-server.mjs;do git -C "$core" show "$core_revision:services/control-plane/src/$file" > "$job/core/$file";done
git show "$design_revision:deploy/update-proxy-checkout-ui.sh" > "$job/update-ui.sh"
printf '%s\n' "$core_revision" "$design_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1;core=$2;site=$3;design_revision=$4
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_PROXY_CHECKOUT_REVISION="$design_revision" ZETSLAY_PROXY_CHECKOUT_PREFLIGHT_ONLY=true bash "$job/update-ui.sh"
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-proxy-checkout.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_PROXY_CHECKOUT_REVISION="$design_revision" bash "$job/update-ui.sh"
echo 'Готово: исправление покупки прокси установлено. Откройте кабинет и нажмите Ctrl+F5.'
APPLY
systemctl reset-failed zetslay-proxy-checkout-repair.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-proxy-checkout-repair --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Исправление покупки прокси запущено. Файлы: $job"
echo 'Дождитесь «Готово: исправление покупки прокси установлено». Ctrl+C закрывает только просмотр журнала.'
journalctl -u zetslay-proxy-checkout-repair --since '-1 min' -n 60 -f --no-pager
