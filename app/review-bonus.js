const bonusUi={loaded:false,loading:false,busy:false,status:null,error:'',session:null};
function resetBonusUi(){Object.assign(bonusUi,{loaded:false,loading:false,busy:false,status:null,error:'',session:authState.token});}
function bonusSettingsMarkup(plugin){
  if(plugin.id!=='zetslay.auto-review-bonus'||!plugin.installed)return '';
  if(bonusUi.session!==authState.token)resetBonusUi();
  if(!bonusUi.loaded&&!bonusUi.loading&&!bonusUi.error)queueMicrotask(()=>loadBonusStatus());
  if(!bonusUi.loaded)return `<section class="plugin-page-panel" data-bonus-panel><h2>Настройки подарка</h2><p>${bonusUi.loading?'Загружаем…':escapeHtml(bonusUi.error||'Ожидаем загрузку')}</p><button class="button button--ghost" data-bonus-refresh>Повторить загрузку</button></section>`;
  const s=bonusUi.status,c=s.installation?.config||{};
  const tasks=s.tasks||[];
  return `<section class="plugin-page-panel reminder-panel" data-bonus-panel><header class="reminder-panel-heading"><div><h2>Auto Review Bonus</h2><p>Общий подарок за новый отзыв. Только закрытые заказы; старые отзывы при первом чтении пропускаются.</p></div><button type="button" class="button button--ghost" data-bonus-refresh ${bonusUi.busy?'disabled':''}>Обновить статус</button></header>
    <p>Исполнитель: ${s.workerEnabled?'включён':'выключен'} · Доставка: ${s.deliveryEnabled?'разрешена на сервере':'запрещена на сервере'}</p>
    <form data-bonus-settings><fieldset ${bonusUi.busy?'disabled':''} class="reminder-settings"><label>Шаблон благодарности<textarea name="template" maxlength="700" required>${escapeHtml(c.template||'')}</textarea></label><small>Переменные: $username, $order_id, $gift, $rating. $gift обязателен. При отсутствии данных выдача пропускается.</small>
    <label>Общий подарок<input type="password" name="gift" autocomplete="new-password" minlength="4" maxlength="250" placeholder="${s.giftConfigured?'Сохранён в vault. Оставьте пустым, чтобы сохранить':'Укажите текст или ссылку подарка'}"></label><small>От 4 до 250 символов. Сохраняется зашифрованно и не показывается повторно. Подарок отправляется покупателю в чате FunPay.</small>
    <label class="bonus-consent"><input type="checkbox" name="onePerBuyer" ${c.onePerBuyer?'checked':''}>Не более одного подарка на покупателя</label>
    <label class="bonus-consent"><input type="checkbox" name="automatic" ${c.mode==='automatic'?'checked':''}>Разрешаю автоматически отправлять подарок покупателю на FunPay</label>
    <label>Внутренний список запрета подарков<textarea name="blacklist" placeholder="Числовые FunPay ID — по одному в строке">${escapeHtml((s.blacklist||[]).join('\n'))}</textarea></label>
    <label>ЧС FunPay — ручной импорт ID<textarea name="funpayBlacklist" placeholder="Скопируйте ID из своего списка FunPay">${escapeHtml((s.funpayBlacklist||[]).join('\n'))}</textarea></label><small>До 500 ID в каждом списке. Автоматической синхронизации ЧС и блокировки пользователей на FunPay нет.</small>
    <p>После выдачи снижение оценки или удаление отзыва помечается для вашей проверки. Подарок не выдаётся повторно и не отзывается автоматически.</p>
    <p role="status" data-bonus-message>${escapeHtml(bonusUi.error)}</p><button type="submit" class="button button--primary">${bonusUi.busy?'Сохраняем…':'Сохранить настройки'}</button></fieldset></form>
    <h3>Последние задачи (${tasks.length})</h3><div class="connection-checks">${tasks.map(t=>`<span><b>#${escapeHtml(t.orderId)}</b> ${escapeHtml(({watching:'Ждём отзыв',queued:'Ждёт разрешения',sent:'Подарок отправлен',ignored:'Старый отзыв пропущен',uncertain:'Доставка не подтверждена — повтор запрещён',cancelled:'Выдача отменена'})[t.status]||t.status)}${t.needsReview?' · Требуется ваша проверка':''}${t.code?` · ${escapeHtml(t.code)}`:''}${t.status==='queued'&&s.deliveryEnabled?` <button type="button" class="button button--ghost" data-bonus-approve="${escapeHtml(t.orderId)}" ${bonusUi.busy?'disabled':''}>Разрешить эту выдачу</button>`:''}</span>`).join('')||'<span>Пока нет задач. Установите и включите плагин.</span>'}</div></section>`;
}
async function loadBonusStatus(){
  if(!authState.token||bonusUi.loading)return;const token=authState.token;
  if(bonusUi.session!==token)resetBonusUi();bonusUi.loading=true;
  try{const status=await apiRequest('/api/v1/plugins/review-bonus/status',{authenticated:true});if(token!==authState.token)return;bonusUi.status=status;bonusUi.loaded=true;bonusUi.error='';}
  catch(error){if(token!==authState.token)return;bonusUi.error=humanError(error);}
  finally{if(token===authState.token){bonusUi.loading=false;renderPluginPage();}}
}
document.addEventListener('submit',async event=>{
  if(!event.target.matches('[data-bonus-settings]'))return;event.preventDefault();if(bonusUi.busy)return;
  const values=new FormData(event.target),token=authState.token;
  const parse=name=>String(values.get(name)||'').split(/[\s,;]+/).filter(Boolean);
  const body={config:{template:String(values.get('template')||''),onePerBuyer:values.has('onePerBuyer'),mode:values.has('automatic')?'automatic':'approval_required'},blacklist:parse('blacklist'),funpayBlacklist:parse('funpayBlacklist')};
  const gift=String(values.get('gift')||'');if(gift)body.gift=gift;
  bonusUi.busy=true;event.target.querySelector('fieldset').disabled=true;
  try{const status=await apiRequest('/api/v1/plugins/review-bonus/settings',{method:'POST',authenticated:true,body});if(token!==authState.token)return;bonusUi.status=status;bonusUi.error='Настройки сохранены.';}
  catch(error){if(token===authState.token)bonusUi.error=humanError(error);}
  finally{if(token===authState.token){bonusUi.busy=false;renderPluginPage();}}
});
document.addEventListener('click',async event=>{
  if(event.target.closest('[data-bonus-refresh]')){await loadBonusStatus();return;}
  const approve=event.target.closest('[data-bonus-approve]');if(!approve||bonusUi.busy)return;
  const token=authState.token;bonusUi.busy=true;approve.disabled=true;
  try{await apiRequest('/api/v1/plugins/review-bonus/approve',{method:'POST',authenticated:true,body:{orderId:approve.dataset.bonusApprove}});if(token===authState.token)await loadBonusStatus();}
  catch(error){if(token===authState.token)bonusUi.error=humanError(error);}
  finally{if(token===authState.token){bonusUi.busy=false;renderPluginPage();}}
});
