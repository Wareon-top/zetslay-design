#!/usr/bin/env bash
# Prepare the reviewed immutable pair of API and UI revisions.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_ADMIN_SESSION_REVISION:?Укажите ревизию сайта}^{commit}")
core_revision=ca95575ee11d539a2c83a1631358438180adac72
[[ "$core_revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'Нужен полный SHA проверенного обновления API.';exit 1; }
git -C "$core" fetch origin "$core_revision"
[ "$(git -C "$core" rev-parse "$core_revision^{commit}")" = "$core_revision" ] || exit 1
state=$(systemctl show zetslay-admin-session-update.service -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление допуска админки уже выполняется.';exit 1;; esac
job=$(mktemp -d /root/zetslay-admin-session-job.XXXXXX)
mkdir "$job/core"
for file in update-admin-session.py admin-session-patches.json admin-session-probe.mjs update-trust-foundation.py trust-foundation-patches.json trust-foundation-probe.mjs switch-steelproxy-direct.py check-steelproxy-readiness.py;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
git show "$design_revision:deploy/update-trust-ui.sh" > "$job/update-ui.sh"
printf '%s\n' "$core_revision" "$design_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1;core=$2;site=$3;design_revision=$4
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_TRUST_REVISION="$design_revision" ZETSLAY_TRUST_PREFLIGHT_ONLY=true bash "$job/update-ui.sh"
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-admin-session.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_TRUST_REVISION="$design_revision" bash "$job/update-ui.sh"
echo 'Готово: допуск к админке на 1 час установлен. Обновите кабинет через Ctrl+F5 и подтвердите доступ один раз.'
echo 'Для изменения защиты аккаунта подтверждение по-прежнему действует 5 минут.'
APPLY
systemctl reset-failed zetslay-admin-session-update.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-admin-session-update --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Обновление допуска админки запущено. Файлы: $job"
echo 'Дождитесь «Готово: допуск к админке на 1 час установлен». Ctrl+C закрывает только просмотр журнала.'
journalctl -u zetslay-admin-session-update --since '-1 min' -n 60 -f --no-pager
