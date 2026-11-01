/* Settings use the authenticated plugin API; there are no FunPay credentials here. */
const reminderUi = {busy:false,error:'',report:null,generation:null};
const REMINDER_DEFAULTS = Object.freeze({mode:'approval_required',firstDelayMinutes:15,firstText:'$username, если товар получен и всё в порядке, пожалуйста, подтвердите выполнение заказа #$order_id на FunPay. Спасибо!',secondEnabled:false,secondDelayMinutes:60,secondText:'$username, напоминаю: заказ #$order_id ещё ожидает подтверждения. Если товар получен и всё в порядке, подтвердите выполнение. Спасибо и приятной игры!'});
const REMINDER_STATUS = Object.freeze({waiting:'Ожидает срока',awaiting_payment:'Ожидает оплаты',sending:'Отправляется',sent:'Отправлено',queued:'В очереди',cancelled:'Отменено',uncertain:'Результат неизвестен — повтор заблокирован',skipped:'Пропущено: недостаточно данных'});
const REMINDER_REASON = Object.freeze({ORDER_NOT_PAID:'Заказ закрыт или возвращён',DELIVERY_REVOKED:'Разрешение отправки отменено',TEMPLATE_DATA_MISSING:'Для шаблона не хватает данных',DELIVERY_UNKNOWN:'Проверьте чат покупателя вручную',ORDER_CHECK_FAILED:'Не удалось проверить заказ; повторим чтение',REMINDER_EXPIRED:'Напоминание устарело',DELIVERY_DISABLED:'Отправка выключена на сервере',PLUGIN_PAUSED:'Плагин остановлен'});

function reminderSettingsMarkup(plugin) {
  if(reminderUi.generation!==sessionGeneration){reminderUi.generation=sessionGeneration;reminderUi.error='';reminderUi.report=null;reminderUi.busy=false;}
  const c={...REMINDER_DEFAULTS,...plugin.config};
  const report=reminderUi.report;
  const time=value=>{const date=new Date(value);return value && Number.isFinite(date.getTime())?date.toLocaleString('ru-RU'):'—';};
  return `<section class="plugin-page-panel reminder-panel" data-reminder-panel aria-labelledby="reminder-settings-title"><div class="plugin-page-section-heading"><span class="plugin-page-section-icon">${icon('clock')}</span><div><span class="plugin-page-eyebrow">Confirm Reminder</span><h2 id="reminder-settings-title">Настройки напоминаний</h2></div></div>
    <p class="reminder-note">Оплата обнаруживается при опросе FunPay. При включении старые оплаченные заказы пропускаются. Перед каждым сообщением проверяется конкретный заказ; после подтверждения или возврата отправки прекращаются.</p>
    ${plugin.installed?`<form data-confirm-reminder-settings><label>Режим<select name="mode"><option value="approval_required" ${c.mode==='approval_required'?'selected':''}>Очередь без отправки</option><option value="automatic" ${c.mode==='automatic'?'selected':''}>Автоматическая отправка на FunPay</option></select></label>
      <label class="reminder-consent"><input type="checkbox" name="allowAutomatic" ${c.mode==='automatic'?'checked':''}>Разрешаю этому плагину отправлять напоминания покупателям на FunPay</label>
      <div class="reminder-stages"><fieldset><legend>01 · Первое напоминание</legend><label>Минут после обнаружения оплаты<input name="firstDelayMinutes" type="number" min="1" max="10080" value="${Number(c.firstDelayMinutes)||15}" required></label><label>Текст<textarea name="firstText" rows="5" maxlength="800" required>${escapeHtml(c.firstText)}</textarea></label></fieldset>
      <fieldset><legend>02 · Повторное напоминание</legend><label class="reminder-consent"><input type="checkbox" name="secondEnabled" ${c.secondEnabled?'checked':''}>Включить второе напоминание</label><label>Минут после фактической отправки первого<input name="secondDelayMinutes" type="number" min="1" max="10080" value="${Number(c.secondDelayMinutes)||60}" required></label><label>Текст<textarea name="secondText" rows="5" maxlength="800" required>${escapeHtml(c.secondText)}</textarea></label></fieldset></div>
      <p class="reminder-variables"><code>$username</code> покупатель · <code>$order_id</code> номер без # · <code>$game</code> категория · <code>$order_title</code> лот · <code>$date</code> исходная дата FunPay. Если переменная недоступна, сообщение пропускается.</p>
      <button class="button button--primary" type="submit" ${reminderUi.busy?'disabled':''}>${reminderUi.busy?'Сохраняем…':'Сохранить настройки'}</button></form>`:'<p class="reminder-note">Установите плагин, чтобы выбрать режим и настроить тексты.</p>'}
    <p class="reminder-error" data-reminder-error role="alert" ${reminderUi.error?'':'hidden'}>${escapeHtml(reminderUi.error)}</p>
    <div class="reminder-journal-heading"><h3>Расписание и результаты</h3><button type="button" class="button button--ghost" data-reminder-refresh ${reminderUi.busy?'disabled':''}>Обновить статус</button></div>
    <div data-reminder-report>${report?`<p class="reminder-note">Фоновый опрос: ${report.workerEnabled?'включён':'выключен на сервере'} · отправка: ${report.deliveryEnabled?'разрешена на сервере':'выключена на сервере'}. ${report.busy?'Сейчас выполняется проверка.':report.baselineReady?'Исходная очередь заказов сохранена.':'Ожидается первый опрос для пропуска старых заказов.'}</p>
      <div class="reminder-task-list">${(report.tasks||[]).map(task=>`<article><strong>#${escapeHtml(task.orderId)}</strong><span>Этап ${task.stage===2?'2':'1'}</span><span>${escapeHtml(REMINDER_STATUS[task.status]||'Статус неизвестен')}</span><time>${escapeHtml(time(task.dueAt))}</time>${task.code?`<small>${escapeHtml(REMINDER_REASON[task.code]||'Проверка остановлена')}</small>`:''}</article>`).join('')||'<p class="reminder-note">Запланированных напоминаний пока нет.</p>'}</div>`:'<p class="reminder-note">Нажмите «Обновить статус», чтобы проверить исполнитель и таймеры. Настройки также доступны через /confirm_reminder в вашем рабочем Telegram-боте.</p>'}</div>
    <p class="reminder-note">Если после отправки ответ FunPay потерян, результат отмечается как неизвестный. Автоматического повтора нет, второе напоминание не запускается. Проверьте чат покупателя вручную.</p>
  </section>`;
}

function reminderFormConfig(form) {
  const value=name=>form.elements[name].value;
  const config={mode:value('mode'),firstDelayMinutes:Number(value('firstDelayMinutes')),firstText:value('firstText').trim(),secondEnabled:form.elements.secondEnabled.checked,secondDelayMinutes:Number(value('secondDelayMinutes')),secondText:value('secondText').trim()};
  if(!['automatic','approval_required'].includes(config.mode))throw Error('Выберите режим.');
  if(config.mode==='automatic'&&!form.elements.allowAutomatic.checked)throw Error('Подтвердите разрешение отправлять напоминания на FunPay.');
  for(const key of ['firstDelayMinutes','secondDelayMinutes'])if(!Number.isInteger(config[key])||config[key]<1||config[key]>10080)throw Error('Задержка: от 1 до 10080 минут.');
  for(const key of ['firstText','secondText'])if(!config[key]||config[key].length>800)throw Error('Текст: от 1 до 800 символов.');
  return config;
}
async function reminderUiAction(form=null) {
  if(reminderUi.busy||!authState.token)return;
  const token=authState.token,generation=sessionGeneration;
  const current=()=>token===authState.token&&generation===sessionGeneration;
  reminderUi.generation=generation;reminderUi.error='';
  let config;
  try {if(form)config=reminderFormConfig(form);}catch(error){reminderUi.error=error.message;const target=document.querySelector('[data-reminder-error]');if(target){target.textContent=error.message;target.hidden=false;}return;}
  reminderUi.busy=true;
  const controls=form?Array.from(form.querySelectorAll('input,select,textarea,button')):[];
  controls.forEach(control=>control.disabled=true);
  try {
    if(config){await apiRequest('/api/v1/plugins/zetslay.confirm-reminder/config',{method:'POST',authenticated:true,body:{config}});if(!current())return;
      const plugin=state.plugins.find(item=>item.id==='zetslay.confirm-reminder');if(plugin)plugin.config=config;showToast('Настройки напоминаний сохранены','success');}
    const report=await apiRequest('/api/v1/plugins/confirm-reminder/status',{authenticated:true});if(!current())return;reminderUi.report=report;
  }catch(error){if(current()){reminderUi.error=humanError(error);showToast(reminderUi.error,'error');}}
  finally{if(current()){reminderUi.busy=false;controls.forEach(control=>control.disabled=false);
    if(config&&!reminderUi.error)renderPluginPage();else{const error=document.querySelector('[data-reminder-error]');if(error){error.textContent=reminderUi.error;error.hidden=!reminderUi.error;}if(!form)renderPluginPage();}}}
}
document.addEventListener('submit',event=>{if(event.target.matches?.('[data-confirm-reminder-settings]')){event.preventDefault();reminderUiAction(event.target);}});
document.addEventListener('click',event=>{if(event.target.closest?.('[data-reminder-refresh]'))reminderUiAction();});
