#!/usr/bin/env bash
# Prepare a fixed pair of revisions, then apply them in one SSH-independent job.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_LAUNCH_READINESS_REVISION:?Укажите ревизию исправления}^{commit}")
core_revision=3eaad6f6b44b0fbf8e2512c17dc606db5c33941c
git -C "$core" fetch origin "$core_revision"
state=$(systemctl show zetslay-launch-readiness-repair.service -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление аудита уже выполняется.';exit 1;; esac
job=$(mktemp -d /root/zetslay-launch-readiness-job.XXXXXX)
mkdir -p "$job/core/security-packages"
for file in update-launch-security.py launch-security-probe.mjs launch-security-offline.py launch-security-patches.json launch-security-package-lock.json secure-fetch.mjs switch-steelproxy-direct.py check-steelproxy-readiness.py;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
for file in undici-6.29.1.tgz nodemailer-10.1.4.tgz.part01 nodemailer-10.1.4.tgz.part02;do
 git -C "$core" show "$core_revision:deploy/security-packages/$file" > "$job/core/security-packages/$file"
done
git show "$design_revision:deploy/update-launch-readiness-ui.sh" > "$job/update-ui.sh"
git show "$design_revision:deploy/check-launch-public.py" > "$job/check-public.py"
printf '%s\n' "$core_revision" "$design_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1;core=$2;site=$3;design_revision=$4
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_LAUNCH_READINESS_REVISION="$design_revision" ZETSLAY_LAUNCH_PREFLIGHT_ONLY=true bash "$job/update-ui.sh"
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-launch-security.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_LAUNCH_READINESS_REVISION="$design_revision" bash "$job/update-ui.sh"
python3 -I "$job/check-public.py"
echo 'Готово: исправления аудита установлены. Откройте кабинет и нажмите Ctrl+F5.'
APPLY
systemctl reset-failed zetslay-launch-readiness-repair.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-launch-readiness-repair --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Установка исправлений аудита запущена. Файлы: $job"
echo 'Дождитесь «Готово: исправления аудита установлены». Ctrl+C закрывает только просмотр журнала.'
journalctl -u zetslay-launch-readiness-repair --since '-1 min' -n 60 -f --no-pager
