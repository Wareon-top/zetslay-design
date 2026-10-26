#!/usr/bin/env bash
# Prepare the reviewed immutable pair of API and UI revisions.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
design_revision=$(git rev-parse "${ZETSLAY_TRUST_REVISION:?Укажите ревизию сайта}^{commit}")
core_revision=7c42e2e6d056dd506ea465706d665996d40a16e4
[[ "$core_revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'Нужен полный SHA проверенного обновления API.';exit 1; }
git -C "$core" fetch origin "$core_revision"
[ "$(git -C "$core" rev-parse "$core_revision^{commit}")" = "$core_revision" ] || exit 1
state=$(systemctl show zetslay-trust-foundation-repair.service -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление защиты уже выполняется.';exit 1;; esac
job=$(mktemp -d /root/zetslay-trust-foundation-job.XXXXXX)
mkdir "$job/core"
for file in update-trust-foundation.py trust-foundation-patches.json trust-foundation-probe.mjs trust-runtime-inventory.mjs switch-steelproxy-direct.py check-steelproxy-readiness.py;do git -C "$core" show "$core_revision:deploy/$file" > "$job/core/$file";done
for file in admin-access-policy.mjs safe-log.mjs account-security.mjs passkey-security.mjs passkey-verifier.mjs;do git -C "$core" show "$core_revision:services/control-plane/src/$file" > "$job/core/$file";done
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
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/update-trust-foundation.py" --source-dir "$job/core"
cd "$site"
ZETSLAY_SITE_DIR="$site" ZETSLAY_TRUST_REVISION="$design_revision" bash "$job/update-ui.sh"
echo 'Готово: первый этап защиты установлен. Обновите кабинет через Ctrl+F5.'
echo 'Владельцу: Профиль → Защита аккаунта → Подключить отпечаток / Face ID → сохранить резервные коды → Подтвердить отпечатком / Face ID.'
echo 'До этого административные разделы будут закрыты. Обычный вход и настройка защиты доступны.'
APPLY
systemctl reset-failed zetslay-trust-foundation-repair.service >/dev/null 2>&1 || true
systemd-run --unit=zetslay-trust-foundation-repair --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=720 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$core" "$site" "$design_revision"
echo "Обновление защиты запущено. Файлы: $job"
echo 'Дождитесь «Готово: первый этап защиты установлен». Ctrl+C закрывает только просмотр журнала.'
journalctl -u zetslay-trust-foundation-repair --since '-1 min' -n 60 -f --no-pager
