#!/usr/bin/env bash
# Apply the reviewed visual release and any missing pinned prerequisites without resetting either checkout.
set -euo pipefail
umask 077
site=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
core=${ZETSLAY_CORE_DIR:-/opt/zetslay}
revision=${1:?Укажите полный SHA frontend}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'Нужен полный SHA frontend.'; exit 1; }
first=c5e383ee321fe3627c2490cb21e9d988ca97e34e
second=bf3f875f8ce03f5e6328ce2a1fb0a8820b62a2ab
core_first=68c0d428f3b025d982d07c886b4274adb20d1af0
core_second=68c0d428f3b025d982d07c886b4274adb20d1af0
for command in git python3 systemd-run systemctl curl tar; do command -v "$command" >/dev/null || { echo "Не найден $command"; exit 1; }; done
unit=zetslay-design-upgrade
state=$(systemctl show "$unit.service" -p ActiveState --value 2>/dev/null || true)
case "$state" in active|activating|deactivating) echo 'Обновление уже выполняется.'; exit 1;; esac
for sha in "$first" "$second" "$revision"; do git -C "$site" fetch origin "$sha"; done
for sha in "$core_first" "$core_second"; do git -C "$core" fetch origin "$sha"; done
job=$(mktemp -d /root/zetslay-design-upgrade.XXXXXX)
for folder in first second design core-first core-second; do mkdir "$job/$folder"; done
git -C "$site" archive "$first" | tar -x -C "$job/first"
git -C "$site" archive "$second" | tar -x -C "$job/second"
git -C "$site" archive "$revision" | tar -x -C "$job/design"
git -C "$core" archive "$core_first" | tar -x -C "$job/core-first"
git -C "$core" archive "$core_second" | tar -x -C "$job/core-second"
printf '%s\n%s\n%s\n%s\n%s\n' "$first" "$second" "$revision" "$core_first" "$core_second" > "$job/revisions"
cat > "$job/apply.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail
umask 077
job=$1; site=$2; core=$3
echo 'Проверяем совместимость всей цепочки frontend до изменения сервиса.'
python3 "$job/design/deploy/apply-workspace-design.py" --site "$site" --source "$job/design" --first "$job/first" --second "$job/second"
cd "$core"
echo 'Проверяем необходимые дополнения текущего API-образа.'
python3 -I -X "pycache_prefix=$job/pycache" "$job/core-first/deploy/update-reply-preview.py" --source-dir "$job/core-first/deploy"
python3 -I -X "pycache_prefix=$job/pycache" "$job/core-second/deploy/update-diagnostics.py" --source-dir "$job/core-second/services/control-plane/src"
echo 'Устанавливаем согласованный дизайн с резервной копией.'
python3 "$job/design/deploy/apply-workspace-design.py" --site "$site" --source "$job/design" --first "$job/first" --second "$job/second" --apply
for url in https://zetslay.pro/ https://zetslay.pro/demo/ https://zetslay.pro/app/workspace-design.css https://api.zetslay.pro/health; do curl --fail --silent --show-error --max-time 20 "$url" >/dev/null; done
date -u +'%Y-%m-%dT%H:%M:%SZ' > "$job/completed-at"
echo 'Готово: обновлённый дизайн ZetSlay установлен. Обновите страницы через Ctrl+F5.'
echo "Ревизии и служебные файлы: $job"
APPLY
systemctl reset-failed "$unit.service" >/dev/null 2>&1 || true
systemd-run --unit="$unit" --collect --no-block --property=Type=oneshot --property=TimeoutStartSec=1200 --property=KillMode=control-group --property=UMask=0077 /bin/bash "$job/apply.sh" "$job" "$site" "$core"
echo "Пакет: $job"
echo "Журнал: journalctl -u $unit --since '-5 min' -f --no-pager"
