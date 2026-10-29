#!/usr/bin/env bash
# Prepare a fixed pair of revisions, then apply them in one SSH-independent job.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_BASIC_AUTOMATION_REVISION:?Укажите ревизию исправления}^{commit}")
core_revision=5c46aa7d907208f2f67dd1beffe8c2fb83cc4f4b
git -C "$core" fetch origin "$core_revision"
state=$(systemctl show zetslay-basic-automation-update.service -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление меню бота уже выполняется.';exit 1;; esac
job=$(mktemp -d /root/zetslay-basic-automation-job.XXXXXX)
mkdir "$job/core"
for file in update-basic-automation.py basic-automation-probe.mjs basic-automation-patches.json basic-automation-schema.sql update-trust-foundation.py trust-foundation-patches.json trust-foundation-probe.mjs switch-steelproxy-direct.py check-steelproxy-readiness.py trust-runtime-inventory.mjs;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
for file in basic-automation.mjs basic-team.mjs basic-bot-console.mjs account-security.mjs admin-access-policy.mjs safe-log.mjs passkey-security.mjs passkey-verifier.mjs;do git -C "$core" show "$core_revision:services/control-plane/src/$file" > "$job/core/$file";done
git show "$design_revision:deploy/update-basic-automation-ui.sh" > "$job/update-ui.sh"
printf '%s\n' "$core_revision" "$design_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1;core=$2;site=$3;design_revision=$4
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_BASIC_AUTOMATION_REVISION="$design_revision" ZETSLAY_BASIC_AUTOMATION_PREFLIGHT_ONLY=true bash "$job/update-ui.sh"
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-basic-automation.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_BASIC_AUTOMATION_REVISION="$design_revision" bash "$job/update-ui.sh"
echo 'Готово: базовая автоматизация и меню бота обновлены. В боте отправьте /menu; кабинет обновите через Ctrl+F5.'
APPLY
systemctl reset-failed zetslay-basic-automation-update.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-basic-automation-update --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Обновление меню бота запущено. Файлы: $job"
echo 'Дождитесь «Готово: базовая автоматизация и меню бота обновлены». Ctrl+C закрывает только просмотр журнала.'
journalctl -u zetslay-basic-automation-update --since '-1 min' -n 60 -f --no-pager
