/* Settings use the authenticated plugin API; there are no FunPay credentials here. */
const reviewUi = {busy:false,error:'',report:null,generation:null};
const REVIEW_UI_DEFAULTS=Object.freeze({mode:'approval_required',triggerPaid:false,triggerClosed:true,firstDelayMinutes:30,firstText:'$username, спасибо за покупку! Если всё в порядке, буду благодарен за отзыв о заказе #$order_id на FunPay. Если нужна помощь, напишите в этот чат.',secondEnabled:false,secondDelayMinutes:1440,secondText:'$username, небольшое напоминание об отзыве на заказ #$order_id. Если найдётся минутка, поделитесь впечатлениями. Спасибо!'});
const REVIEW_STATUS = Object.freeze({waiting:'Ожидает срока',awaiting_trigger:'Ожидает события',sending:'Отправляется',sent:'Отправлено',queued:'В очереди',cancelled:'Отменено',uncertain:'Результат неизвестен — повтор заблокирован',skipped:'Пропущено: недостаточно данных'});
const REVIEW_REASON = Object.freeze({ORDER_REVIEWED:'Покупатель уже оставил отзыв',ORDER_INELIGIBLE:'Заказ возвращён или не оплачен',TRIGGER_DISABLED:'Триггер выключен',DELIVERY_REVOKED:'Разрешение отправки отменено',TEMPLATE_DATA_MISSING:'Для шаблона не хватает данных',DELIVERY_UNKNOWN:'Проверьте чат покупателя вручную',REVIEW_CHECK_FAILED:'Не удалось проверить отзыв; сообщение не отправляется',REMINDER_EXPIRED:'Напоминание устарело',DELIVERY_DISABLED:'Отправка выключена на сервере',PLUGIN_PAUSED:'Плагин остановлен'});

function reviewSettingsMarkup(plugin) {
  if(reviewUi.generation!==sessionGeneration){reviewUi.generation=sessionGeneration;reviewUi.error='';reviewUi.report=null;reviewUi.busy=false;}
  const c={...REVIEW_UI_DEFAULTS,...plugin.config};
  const report=reviewUi.report;
  const time=value=>{const date=new Date(value);return value && Number.isFinite(date.getTime())?date.toLocaleString('ru-RU'):'—';};
  return `<section class="plugin-page-panel reminder-panel review-panel" data-review-panel aria-labelledby="review-settings-title"><div class="plugin-page-section-heading"><span class="plugin-page-section-icon">${icon('clock')}</span><div><span class="plugin-page-eyebrow">Review Reminder</span><h2 id="review-settings-title">Настройки напоминаний</h2></div></div>
    <p class="reminder-note">Выбранное событие обнаруживается при опросе FunPay. Старые заказы при включении пропускаются. Перед каждым сообщением проверяется отзыв и статус заказа; отзыв или возврат отменяет оставшиеся напоминания. Если оба триггера включены, срабатывает первый обнаруженный — максимум два сообщения на заказ.</p>
    ${plugin.installed?`<form data-review-reminder-settings><fieldset class="review-triggers"><legend>Когда запускать таймер</legend><label class="reminder-consent"><input type="checkbox" name="triggerPaid" ${c.triggerPaid?'checked':''}>После оплаты</label><label class="reminder-consent"><input type="checkbox" name="triggerClosed" ${c.triggerClosed?'checked':''}>После подтверждения заказа</label></fieldset><label>Режим<select name="mode"><option value="approval_required" ${c.mode==='approval_required'?'selected':''}>Очередь без отправки</option><option value="automatic" ${c.mode==='automatic'?'selected':''}>Автоматическая отправка на FunPay</option></select></label>
      <label class="reminder-consent"><input type="checkbox" name="allowAutomatic" ${c.mode==='automatic'?'checked':''}>Разрешаю этому плагину отправлять напоминания покупателям на FunPay</label>
      <div class="reminder-stages"><fieldset><legend>01 · Первое напоминание</legend><label>Минут после обнаружения выбранного события<input name="firstDelayMinutes" type="number" min="1" max="10080" value="${Number(c.firstDelayMinutes)||30}" required></label><label>Текст<textarea name="firstText" rows="5" maxlength="800" required>${escapeHtml(c.firstText)}</textarea></label></fieldset>
      <fieldset><legend>02 · Повторное напоминание</legend><label class="reminder-consent"><input type="checkbox" name="secondEnabled" ${c.secondEnabled?'checked':''}>Включить второе напоминание</label><label>Минут после фактической отправки первого<input name="secondDelayMinutes" type="number" min="1" max="10080" value="${Number(c.secondDelayMinutes)||1440}" required></label><label>Текст<textarea name="secondText" rows="5" maxlength="800" required>${escapeHtml(c.secondText)}</textarea></label></fieldset></div>
      <p class="reminder-variables"><code>$username</code> покупатель · <code>$order_id</code> номер без # · <code>$game</code> категория · <code>$order_title</code> лот · <code>$date</code> исходная дата FunPay. Если переменная недоступна, сообщение пропускается.</p>
      <button class="button button--primary" type="submit" ${reviewUi.busy?'disabled':''}>${reviewUi.busy?'Сохраняем…':'Сохранить настройки'}</button></form>`:'<p class="reminder-note">Установите плагин, чтобы выбрать режим и настроить тексты.</p>'}
    <p class="reminder-error" data-review-error role="alert" ${reviewUi.error?'':'hidden'}>${escapeHtml(reviewUi.error)}</p>
    <div class="reminder-journal-heading"><h3>Расписание и результаты</h3><button type="button" class="button button--ghost" data-review-refresh ${reviewUi.busy?'disabled':''}>Обновить статус</button></div>
    <div data-review-report>${report?`<p class="reminder-note">Фоновый опрос: ${report.workerEnabled?'включён':'выключен на сервере'} · отправка: ${report.deliveryEnabled?'разрешена на сервере':'выключена на сервере'}. ${report.busy?'Сейчас выполняется проверка.':report.baselineReady?'Исходная очередь заказов сохранена.':'Ожидается первый опрос для пропуска старых заказов.'}</p>
      <div class="reminder-task-list">${(report.tasks||[]).map(task=>`<article><strong>#${escapeHtml(task.orderId)}</strong><span>${task.trigger==='paid'?'Оплата':'Подтверждение'} · этап ${task.stage===2?'2':'1'}</span><span>${escapeHtml(REVIEW_STATUS[task.status]||'Статус неизвестен')}</span><time>${escapeHtml(time(task.dueAt))}</time>${task.code?`<small>${escapeHtml(REVIEW_REASON[task.code]||'Проверка остановлена')}</small>`:''}</article>`).join('')||'<p class="reminder-note">Запланированных напоминаний пока нет.</p>'}</div>`:'<p class="reminder-note">Нажмите «Обновить статус», чтобы проверить исполнитель и таймеры. Настройки также доступны через /reminder в вашем рабочем Telegram-боте.</p>'}</div>
    <p class="reminder-note">Если после отправки ответ FunPay потерян, результат отмечается как неизвестный. Автоматического повтора нет, второе напоминание не запускается. Проверьте чат покупателя вручную.</p>
  </section>`;
}

function reviewFormConfig(form) {
  const value=name=>form.elements[name].value;
  const config={triggerPaid:form.elements.triggerPaid.checked,triggerClosed:form.elements.triggerClosed.checked,mode:value('mode'),firstDelayMinutes:Number(value('firstDelayMinutes')),firstText:value('firstText').trim(),secondEnabled:form.elements.secondEnabled.checked,secondDelayMinutes:Number(value('secondDelayMinutes')),secondText:value('secondText').trim()};
  if(!config.triggerPaid&&!config.triggerClosed)throw Error('Выберите хотя бы один триггер.');
  if(!['automatic','approval_required'].includes(config.mode))throw Error('Выберите режим.');
  if(config.mode==='automatic'&&!form.elements.allowAutomatic.checked)throw Error('Подтвердите разрешение отправлять напоминания на FunPay.');
  for(const key of ['firstDelayMinutes','secondDelayMinutes'])if(!Number.isInteger(config[key])||config[key]<1||config[key]>10080)throw Error('Задержка: от 1 до 10080 минут.');
  for(const key of ['firstText','secondText'])if(!config[key]||config[key].length>800)throw Error('Текст: от 1 до 800 символов.');
  return config;
}
async function reviewUiAction(form=null) {
  if(reviewUi.busy||!authState.token)return;
  const token=authState.token,generation=sessionGeneration;
  const current=()=>token===authState.token&&generation===sessionGeneration;
  reviewUi.generation=generation;reviewUi.error='';
  let config;
  try {if(form)config=reviewFormConfig(form);}catch(error){reviewUi.error=error.message;const target=document.querySelector('[data-review-error]');if(target){target.textContent=error.message;target.hidden=false;}return;}
  reviewUi.busy=true;
  const controls=form?Array.from(form.querySelectorAll('input,select,textarea,button')):[];
  controls.forEach(control=>control.disabled=true);
  try {
    if(config){await apiRequest('/api/v1/plugins/zetslay.review-reminder/config',{method:'POST',authenticated:true,body:{config}});if(!current())return;
      const plugin=state.plugins.find(item=>item.id==='zetslay.review-reminder');if(plugin)plugin.config=config;showToast('Настройки напоминаний сохранены','success');}
    const report=await apiRequest('/api/v1/plugins/review-reminder/status',{authenticated:true});if(!current())return;reviewUi.report=report;
  }catch(error){if(current()){reviewUi.error=humanError(error);showToast(reviewUi.error,'error');}}
  finally{if(current()){reviewUi.busy=false;controls.forEach(control=>control.disabled=false);
    if(config&&!reviewUi.error)renderPluginPage();else{const error=document.querySelector('[data-review-error]');if(error){error.textContent=reviewUi.error;error.hidden=!reviewUi.error;}if(!form)renderPluginPage();}}}
}
document.addEventListener('submit',event=>{if(event.target.matches?.('[data-review-reminder-settings]')){event.preventDefault();reviewUiAction(event.target);}});
document.addEventListener('click',event=>{if(event.target.closest?.('[data-review-refresh]'))reviewUiAction();});
