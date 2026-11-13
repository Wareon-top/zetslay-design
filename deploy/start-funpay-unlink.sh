#!/usr/bin/env bash
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
cd "$site"
revision=$(git rev-parse "${ZETSLAY_FUNPAY_UNLINK_REVISION:?Укажите ревизию отвязки}^{commit}")
core_revision=8e8aec051481602f14a5a71d457e0b2e883b211f
job=$(mktemp -d /root/zetslay-funpay-unlink-release.XXXXXX)
git show "$revision:deploy/update-funpay-unlink-ui.py" > "$job/ui.py"
git show "$revision:deploy/update-funpay-unlink-ui.sh" > "$job/ui.sh"
python3 -I "$job/ui.py" "$revision" --preflight
git -C "$core" fetch origin "$core_revision"
git -C "$core" show "$core_revision:deploy/start-funpay-disconnect.sh" > "$job/api.sh"
(cd "$core"; ZETSLAY_CORE_DIR="$core" ZETSLAY_FUNPAY_DISCONNECT_REVISION="$core_revision" bash "$job/api.sh")
ZETSLAY_SITE_DIR="$site" bash "$job/ui.sh" "$revision"
echo 'Готово: отвязка FunPay установлена. Обновите кабинет через Ctrl+F5.'
echo 'Профиль → Управлять подключением → Отвязать аккаунт FunPay.'
echo "Файлы установки: $job"
