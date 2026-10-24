#!/usr/bin/env bash
set -euo pipefail
umask 022
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
lock=.zetslay-trial-design-update.lock
mkdir "$lock" || { echo 'Дизайн пробного периода уже обновляется.'; exit 1; }
work=$(mktemp -d)
backup=''
candidate=''
rollback=false
complete=false
cleanup() {
  status=$?
  if [ "$rollback" = true ] && [ "$complete" = false ]; then
    tar -xzf "$backup"
    echo "Файлы восстановлены. Backup: $backup"
  fi
  if [ -n "$candidate" ]; then rm -f -- "$candidate"; fi
  rm -rf "$work"
  rmdir "$lock"
  return "$status"
}
trap cleanup EXIT
git fetch origin "${ZETSLAY_TRIAL_DESIGN_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/original" "$work/incoming"
cp -p app/index.html "$work/original/index.html"
git show "$revision:app/sidebar-trial.css" > "$work/incoming/sidebar-trial.css"
git show "$revision:deploy/stage-trial-design.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/original" "$work/incoming" "$work/out"
cmp -s app/index.html "$work/original/index.html" || { echo 'Кабинет изменился во время проверки. Обновление остановлено.'; exit 1; }
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-trial-design.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" app/index.html app/sidebar-trial.css
rollback=true
cp "$work/out/sidebar-trial.css" app/sidebar-trial.css
chmod 644 app/sidebar-trial.css
candidate=$(mktemp app/.zetslay-trial-design.XXXXXX)
cp "$work/out/index.html" "$candidate"
chmod --reference=app/index.html "$candidate"
mv -f "$candidate" app/index.html
candidate=''
complete=true
echo "Прежний дизайн плашки пробного периода восстановлен. Backup: $backup"
echo 'Кнопка выхода и логика пробного периода сохранены. Обновите кабинет через Ctrl+F5.'
