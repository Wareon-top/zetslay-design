#!/usr/bin/env bash
# Prepare a fixed pair of revisions, then apply them in one SSH-independent job.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_BOT_CONNECTION_REVISION:?Укажите ревизию исправления}^{commit}")
core_revision=aa9ff1b48b54e2a3f739ed41eecd7b4617cdb287
git -C "$core" fetch origin "$core_revision"
job=$(mktemp -d /root/zetslay-bot-connection-job.XXXXXX)
mkdir "$job/core"
for file in update-bot-onboarding.py switch-steelproxy-direct.py check-steelproxy-readiness.py;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
for file in onboarding-service.mjs bot-access-service.mjs;do git -C "$core" show "$core_revision:services/control-plane/src/$file" > "$job/core/$file";done
git show "$design_revision:deploy/update-bot-connection-ui.sh" > "$job/update-ui.sh"
printf '%s\n' "$core_revision" "$design_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1;core=$2;site=$3;design_revision=$4
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-bot-onboarding.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_BOT_CONNECTION_REVISION="$design_revision" bash "$job/update-ui.sh"
echo 'Готово: подключение бота исправлено. Откройте кабинет и нажмите Ctrl+F5.'
APPLY
systemctl reset-failed zetslay-bot-connection-repair.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-bot-connection-repair --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Обновление API и мастера запущено. Файлы: $job"
echo 'Дождитесь «Готово: подключение бота исправлено». Ctrl+C закрывает только просмотр журнала.'
journalctl -u zetslay-bot-connection-repair --since '-1 min' -n 60 -f --no-pager
