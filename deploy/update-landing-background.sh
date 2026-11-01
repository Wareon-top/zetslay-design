#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_BACKGROUND_REVISION:?Укажите ревизию фона}^{commit}")
exec 9>.zetslay-landing-background.lock
flock -n 9 || { echo 'Фон уже обновляется.';exit 1; }
work=$(mktemp -d)
backup='';publishing=false;candidate=''
cleanup() {
 status=$?
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  echo "Прежний фон восстановлен. Резервная копия: $backup"
 fi
 if [ -n "$candidate" ];then rm -f -- "$candidate";fi
 rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work/local" "$work/incoming"
cp -p index.html "$work/local/index.html"
for file in landing-hero.js landing-orderflow.css;do
 [ -f "$file" ] || { echo "Не найден текущий файл $file. Сайт не изменён.";exit 1; }
 git show "$revision:$file" > "$work/incoming/$file"
 [ "$(git hash-object "$work/incoming/$file")" = "$(git rev-parse "$revision:$file")" ] || exit 1
done
git show "$revision:deploy/stage-landing-background.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1;then
 timeout 15 node --check "$work/out/landing-hero.js"
else
 echo 'JS соответствует проверенной Git-ревизии. Node.js и Docker для установки не требуются.'
fi
cmp -s index.html "$work/local/index.html" || { echo 'Главная страница изменилась во время подготовки. Обновление остановлено.';exit 1; }
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-ascii-background.XXXXXX.tar.gz")
chmod 600 "$backup"
tar -czf "$backup" index.html landing-hero.js landing-orderflow.css
publishing=true
for file in landing-hero.js landing-orderflow.css index.html;do
 candidate=$(mktemp .zetslay-background.XXXXXX)
 install -m 644 "$work/out/$file" "$candidate"
 mv -f "$candidate" "$file"
 candidate=''
done
publishing=false
echo 'Готово: тёмный ASCII-фон установлен, свечение за монетами усилено.'
echo "Прежний вариант: $backup"
echo "Откат: cd '$PWD' && tar -xzf '$backup'"
echo 'Обновите главную страницу через Ctrl+F5. Перезапуск сервисов не требуется.'
