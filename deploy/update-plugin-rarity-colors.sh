#!/usr/bin/env bash
set -euo pipefail
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
work=$(mktemp -d)
lock=.zetslay-rarity-colors.lock
mkdir "$lock" || { rm -rf "$work"; echo 'Обновление цветов уже выполняется.'; exit 1; }
trap 'rm -rf "$work"; rmdir "$lock"' EXIT
git fetch origin "${ZETSLAY_RARITY_COLORS_REVISION:-codex/landing-light-dark-redesign}"
revision=$(git rev-parse FETCH_HEAD)
mkdir -p "$work/incoming/app" "$work/local/app" "$work/out/app"
for file in app/plugin-rarity.css landing-plugins.css; do
  git show "$revision:$file" > "$work/incoming/$file"
done
files=(app/plugin-rarity.css landing-plugins.css app/index.html index.html)
for file in "${files[@]}"; do cp -p "$file" "$work/local/$file"; done
python3 - "$work" <<'PY'
from pathlib import Path
import re
import sys
root = Path(sys.argv[1])
outputs = {}
for file, prefix in [('app/plugin-rarity.css', 'plugin-rarity'), ('landing-plugins.css', 'landing-plugin-rarity')]:
    local = (root / 'local' / file).read_text()
    incoming = (root / 'incoming' / file).read_text()
    for level in ['ultra', 'legendary']:
        pattern = r'\.' + re.escape(prefix + '--' + level) + r'\s*\{[^{}]*\}'
        fresh = re.findall(pattern, incoming)
        if len(fresh) != 1 or len(re.findall(pattern, local)) != 1:
            raise SystemExit('Не найдена единственная плашка редкости. Файлы не изменены.')
        local = re.sub(pattern, lambda match: fresh[0], local)
    outputs[file] = local
for file, asset in [('app/index.html', 'plugin-rarity.css'), ('index.html', 'landing-plugins.css')]:
    local = (root / 'local' / file).read_text()
    pattern = r'(href="' + re.escape(asset) + r')(?:\?[^"\n]*)?(")'
    # Keep all HTML and only renew the existing stylesheet URL.
    local, count = re.subn(pattern, lambda match: match[1] + '?v=20261010-rarity-colors' + match[2], local)
    if count != 1:
        raise SystemExit('Не найдено единственное подключение стилей. Файлы не изменены.')
    outputs[file] = local
for file, content in outputs.items():
    (root / 'out' / file).write_text(content)
PY
for file in "${files[@]}"; do
  cmp -s "$file" "$work/local/$file" || { echo 'Файлы изменились во время подготовки. Обновление остановлено.'; exit 1; }
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-rarity-colors.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" "${files[@]}"
for file in "${files[@]}"; do
  if ! cp "$work/out/$file" "$file"; then
    tar -xzf "$backup"
    echo "Файлы восстановлены. Backup: $backup"
    exit 1
  fi
done
echo "Цвета обновлены: ультра — жёлтый, легендарный — фиолетовый. Backup: $backup"
echo 'Обновите страницу через Ctrl+F5.'
