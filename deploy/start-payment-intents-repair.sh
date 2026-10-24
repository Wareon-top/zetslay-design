#!/usr/bin/env bash
# Prepare a fixed pair of revisions, then apply them in one SSH-independent job.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_PAYMENT_INTENTS_REVISION:?Укажите ревизию исправления}^{commit}")
core_revision=e55ae4de18aa0ffd1460d0a54044d99e36b3edae
git -C "$core" fetch origin "$core_revision"
job=$(mktemp -d /root/zetslay-payment-intents-job.XXXXXX)
mkdir "$job/core"
for file in update-payment-intents.py payment-intents-probe.mjs switch-steelproxy-direct.py check-steelproxy-readiness.py;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
for file in payment-service.mjs http-server.mjs;do git -C "$core" show "$core_revision:services/control-plane/src/$file" > "$job/core/$file";done
git show "$design_revision:deploy/update-payment-intents-ui.sh" > "$job/update-ui.sh"
printf '%s\n' "$core_revision" "$design_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1;core=$2;site=$3;design_revision=$4
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-payment-intents.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_PAYMENT_INTENTS_REVISION="$design_revision" bash "$job/update-ui.sh"
echo 'Готово: незавершённую оплату можно закрыть. Откройте кабинет и нажмите Ctrl+F5.'
APPLY
systemctl reset-failed zetslay-payment-intents-repair.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-payment-intents-repair --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Обновление пополнения баланса запущено. Файлы: $job"
echo 'Дождитесь «Готово: незавершённую оплату можно закрыть». Ctrl+C закрывает только просмотр журнала.'
journalctl -u zetslay-payment-intents-repair --since '-1 min' -n 60 -f --no-pager
