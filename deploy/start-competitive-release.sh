#!/usr/bin/env bash
# Stage the pinned pair first; retain the current image and all unrelated site changes.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
design_revision=${1:?Укажите фиксированный SHA frontend}
core_revision=bc04a43978b8a9a5ea262ea2d3f5ce90ea7ced02
[[ "$design_revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'Нужен полный SHA frontend.'; exit 1; }
for command in git python3 systemd-run systemctl curl; do command -v "$command" >/dev/null || { echo "Не найден $command"; exit 1; }; done
for directory in "$site" "$core"; do git -C "$directory" rev-parse --git-dir >/dev/null; done
unit=zetslay-competitive-upgrade
state=$(systemctl show "$unit.service" -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление уже выполняется.'; exit 1;; esac
git -C "$site" fetch origin "$design_revision"
git -C "$core" fetch origin "$core_revision"
[[ $(git -C "$site" rev-parse "$design_revision^{commit}") == "$design_revision" ]]
[[ $(git -C "$core" rev-parse "$core_revision^{commit}") == "$core_revision" ]]
job=$(mktemp -d /root/zetslay-competitive-upgrade.XXXXXX)
mkdir "$job/design" "$job/core"
git -C "$site" archive "$design_revision" | tar -x -C "$job/design"
git -C "$core" archive "$core_revision" | tar -x -C "$job/core"
printf '%s\n%s\n' "$design_revision" "$core_revision" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1; site=$2; core=$3
echo 'Проверяем совместимость кабинета до изменения API.'
python3 "$job/design/deploy/apply-competitive-release.py" --site "$site" --source "$job/design"
echo 'Готовим производный API-образ и проверяем его до переключения.'
cd "$core"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core/deploy/update-reply-preview.py" --source-dir "$job/core/deploy"
echo 'Устанавливаем публичные страницы и точечное дополнение кабинета.'
python3 "$job/design/deploy/apply-competitive-release.py" --site "$site" --source "$job/design" --apply
for url in https://zetslay.pro/demo/ https://zetslay.pro/docs/ https://zetslay.pro/pricing/ https://api.zetslay.pro/health; do
  curl --fail --silent --show-error --max-time 20 "$url" >/dev/null
done
date -u +'%Y-%m-%dT%H:%M:%SZ' > "$job/completed-at"
echo 'Готово: первый пакет обновления ZetSlay установлен. Обновите кабинет через Ctrl+F5.'
echo "Ревизии и журнал запуска: $job"
APPLY
systemctl reset-failed "$unit.service" >/dev/null 2>&1 || true
systemd-run --unit="$unit" --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=900 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$site" "$core"
echo "Обновление запущено. Пакет: $job"
echo "Журнал: journalctl -u $unit --since '-5 min' -f --no-pager"
echo 'Завершение подтверждается строкой «Готово: первый пакет обновления ZetSlay установлен».'
