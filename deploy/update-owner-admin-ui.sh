#!/usr/bin/env bash
set -euo pipefail
site_dir=${ZETSLAY_SITE_DIR:-/opt/zetslay-site}
backup_dir=${ZETSLAY_BACKUP_DIR:-/root}
cd "$site_dir"
if [ -n "${ZETSLAY_ADMIN_DESIGN_REVISION:-}" ]; then
  git fetch origin "$ZETSLAY_ADMIN_DESIGN_REVISION"
else
  git fetch origin codex/landing-light-dark-redesign
fi
revision=$(git rev-parse FETCH_HEAD)
work=$(mktemp -d)
lock="$site_dir/.zetslay-owner-admin-update.lock"
mkdir "$lock" || { echo 'Другое обновление прав уже запущено.'; rm -rf "$work"; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
mkdir -p "$work/incoming" "$work/app"
for name in app.js admin-access.css admin-access.test.mjs; do
  git show "$revision:app/$name" > "$work/incoming/$name"
done
git show "$revision:deploy/stage-owner-admin-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$site_dir/app" "$work/incoming" "$work/app"
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --check app.js </dev/null
docker run --rm -v "$work/app:/work:ro" -w /work node:22-alpine node --test admin-access.test.mjs </dev/null
files=(app/admin-access.css app/admin-access.test.mjs app/app.js app/index.html)
existing=()
created=()
for file in "${files[@]}"; do
  if [ -e "$file" ]; then existing+=("$file"); else created+=("$file"); fi
done
backup=$(mktemp "$backup_dir/zetslay-site-before-owner-admin.XXXXXX.tar.gz")
tar -czf "$backup" "${existing[@]}"
rollback() {
  tar -xzf "$backup"
  for file in "${created[@]}"; do rm -f -- "$file"; done
  echo "Интерфейс восстановлен. Резервная копия: $backup"
}
# Publish HTML last, after the guarded script and default-deny stylesheet exist.
for file in "${files[@]}"; do
  if ! candidate=$(mktemp "$(dirname "$file")/.zetslay-owner-admin.XXXXXX"); then rollback; exit 1; fi
  if ! cp "$work/$file" "$candidate" || ! chmod 644 "$candidate" || ! mv -f "$candidate" "$file"; then
    rm -f "$candidate"; rollback; exit 1
  fi
done
echo "Права интерфейса обновлены из $revision. Резервная копия: $backup"
echo 'Обновите кабинет через Ctrl+F5. Войдите в существующий аккаунт, если сессия истекла.'
