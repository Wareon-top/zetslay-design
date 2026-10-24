#!/usr/bin/env bash
set -euo pipefail
umask 077
exec </dev/null
cd "${ZETSLAY_SITE_DIR:-/opt/zetslay-site}"
revision=$(git rev-parse "${ZETSLAY_PAYMENT_INTENTS_REVISION:?Укажите ревизию оплаты}^{commit}")
exec 9>.zetslay-payment-intents-ui.lock
flock -n 9 || { echo 'Оплата уже обновляется.';exit 1; }
work=$(mktemp -d);backup='';publishing=false;candidate='';created=()
cleanup(){
 status=$?
 if [ "$status" -ne 0 ] && [ "$publishing" = true ];then
  tar -xzf "$backup"
  if [ "${#created[@]}" -gt 0 ];then rm -f -- "${created[@]}";fi
  echo "Прежний вариант восстановлен. Backup: $backup"
 fi
 if [ -n "$candidate" ];then rm -f -- "$candidate";fi
 rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work/local" "$work/incoming"
cp -p app/index.html "$work/local/index.html"
for file in payments.js payments.css;do
 git show "$revision:app/$file" > "$work/incoming/$file"
 [ "$(git hash-object "$work/incoming/$file")" = "$(git rev-parse "$revision:app/$file")" ] || exit 1
done
git show "$revision:deploy/stage-payment-intents-ui.py" > "$work/stage.py"
python3 "$work/stage.py" "$work/local" "$work/incoming" "$work/out"
if command -v node >/dev/null 2>&1;then timeout 15 node --check "$work/out/payments.js";else echo 'JS соответствует проверенной Git-ревизии; Node.js и Docker для установки не требуются.';fi
cmp -s app/index.html "$work/local/index.html" || { echo 'Кабинет изменился во время подготовки. Обновление остановлено.';exit 1; }
existing=(app/index.html)
for file in payments.js payments.css;do
 if [ -f "app/$file" ];then existing+=("app/$file");else created+=("app/$file");fi
done
backup=$(mktemp "${ZETSLAY_BACKUP_DIR:-/root}/zetslay-before-payment-intents-ui.XXXXXX.tar.gz")
chmod 600 "$backup";tar -czf "$backup" "${existing[@]}"
publishing=true
for file in payments.js payments.css index.html;do
 candidate=$(mktemp app/.zetslay-payment-intents.XXXXXX)
 install -m 644 "$work/out/$file" "$candidate"
 mv -f "$candidate" "app/$file";candidate=''
done
publishing=false
echo 'Готово: можно закрыть неоплаченное пополнение и создать новое.'
echo "Резервная копия: $backup"
echo 'Обновите кабинет через Ctrl+F5. Перезапуск API не требуется.'
