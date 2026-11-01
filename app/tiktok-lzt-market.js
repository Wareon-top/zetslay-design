/* Secrets stay in the submitted form until a successful POST; never in UI state/storage. */
const tiktokUi={session:null,generation:0,status:null,loading:false,busy:false,error:'',search:null,editing:null,revision:0};
const tiktokTaskLabels={ignored:'Старый заказ пропущен',unmatched:'Лот не привязан',discovering:'Читаем заказ',queued:'В очереди',manual:'Решение продавца',purchasing:'Покупаем',purchase_unknown:'Покупка требует проверки',purchased:'Куплен · ожидает выдачи',sending:'Отправляем',delivered:'Выдан',delivery_unknown:'Отправка требует проверки',refunding:'Проверяем возврат',refunded:'Возвращён',refund_unknown:'Возврат требует проверки',cancelled:'Отменён'};
const tiktokMoney=n=>`${(Number(n||0)/100).toFixed(2)} ₽`;
function resetTiktokUi(){Object.assign(tiktokUi,{session:authState.token,generation:sessionGeneration,status:null,loading:false,busy:false,error:'',search:null,editing:null,revision:tiktokUi.revision+1});}
function tiktokCurrent(token,generation){return token===authState.token&&generation===sessionGeneration;}
function tiktokSettingsMarkup(plugin){
  if(plugin.id!=='zetslay.tiktok-lzt-market'||!plugin.installed)return '';
  if(tiktokUi.session!==authState.token||tiktokUi.generation!==sessionGeneration)resetTiktokUi();
  if(!tiktokUi.status&&!tiktokUi.loading&&!tiktokUi.error)queueMicrotask(loadTiktokStatus);
  const s=tiktokUi.status;
  if(!s)return `<section class="plugin-page-panel" data-tiktok-panel><h2>TikTok LZT Market</h2><p role="status">${escapeHtml(tiktokUi.error||'Загружаем настройки…')}</p><button class="button button--ghost" data-tiktok-refresh>Повторить загрузку</button></section>`;
  const c=s.config,a=s.analytics,p=s.profiles.find(p=>p.id===tiktokUi.editing),disabled=tiktokUi.busy?'disabled':'';
  const number=(key,label,min=0)=>`<label>${label}<input name="${key}" type="number" min="${min}" max="1000000" step="0.01" required value="${(c[key]/100).toFixed(2)}"></label>`;
  const check=(key,label)=>`<label class="tiktok-toggle"><input name="${key}" type="checkbox" ${c[key]?'checked':''}>${label}</label>`;
  return `<section class="tiktok-panel" data-tiktok-panel>
    <header class="tiktok-heading"><div><span class="tiktok-kicker">УЛЬТРА · АВТОМАТИЧЕСКАЯ ВЫДАЧА</span><h2>TikTok LZT Market</h2><p>Профиль → оплаченный заказ → покупка → подтверждённое сообщение.</p></div><button type="button" class="button button--ghost" data-tiktok-refresh ${disabled}>Обновить</button></header>
    <div class="tiktok-stats"><div><span>Выдано заказов</span><strong>${a.delivered}</strong></div><div><span>Расход LZT</span><strong>${tiktokMoney(a.spentMinor)}</strong></div><div><span>Разница до комиссий</span><strong>${tiktokMoney(a.marginBeforeFeesMinor)}</strong></div><div><span>Требуют проверки</span><strong>${a.uncertain}</strong></div></div>
    <p class="tiktok-runtime">Фоновая обработка: ${s.workerEnabled?'включена':'выключена на сервере'} · Покупка: ${s.purchaseEnabled?'разрешена':'выключена на сервере'} · Выдача: ${s.deliveryEnabled?'разрешена':'выключена на сервере'} · Автовозврат: ${s.refundEnabled?'доступен после разрешения':'выключен на сервере'}</p>
    <p class="tiktok-feedback" data-tiktok-feedback role="status">${escapeHtml(tiktokUi.error)}</p>
    <section class="plugin-page-panel"><header class="tiktok-section-heading"><div><span>01 / Настройки</span><h3>Доступ, бюджет и сообщения</h3></div><button class="button button--ghost" type="button" data-tiktok-balance ${disabled}>Проверить баланс</button></header>
      ${s.account?`<div class="tiktok-balances"><strong>${escapeHtml(s.account.username)}</strong>${s.account.balances.map(b=>`<span>${escapeHtml(b.title)} <b>${tiktokMoney(b.minor)}</b></span>`).join('')}<small>Проверено: ${escapeHtml(new Date(s.account.checkedAt).toLocaleString('ru-RU'))}. Одна покупка оплачивается с одного баланса.</small></div>`:'<p>Токен проверяется перед сохранением. При недоступности LZT баланс не подменяется нулём.</p>'}
      <form data-tiktok-form="settings"><fieldset ${disabled}>
        <label>API-токен LZT<input type="password" name="apiKey" minlength="8" maxlength="2048" autocomplete="new-password" placeholder="${s.keyConfigured?'Проверен и сохранён. Пустое поле сохраняет текущий':'Введите токен с доступом market'}"></label>
        <label>Отдельный HTTP/HTTPS IPv4 прокси LZT · необязательно<input type="password" name="proxyUrl" maxlength="2048" autocomplete="off" placeholder="${s.proxyConfigured?'Сохранён. Пустое поле сохраняет текущий':'Прямое HTTPS или http://login:password@IPv4:port'}"></label>
        <p class="tiktok-help">Аккаунт LZT: RUB. Этот маршрут отделён от прокси FunPay. Ключ и пароль не показываются повторно.</p>
        <div class="tiktok-fields">${number('maxSpendMinor','Лимит одной покупки, ₽',0.01)}${number('dailyLimitMinor','Дневной лимит, ₽ · сутки UTC',0.01)}${number('minMarginMinor','Минимальная разница до комиссий, ₽')}${number('lowBalanceMinor','Уведомлять о балансе ниже, ₽')}<label>Страниц поиска<input type="number" name="searchPages" min="1" max="5" required value="${c.searchPages}"></label></div>
        <div class="tiktok-checks">${check('automatic','Разрешить автоматически покупать и выдавать новые заказы')}${check('notifyOwner','Уведомлять продавца в личном Telegram-боте')}${check('autoRefund','Разрешить полный автовозврат при подтверждённо пустом поиске до покупки')}</div>
        <p class="tiktok-help">Ошибки API, недостаток баланса и неизвестное списание не запускают автовозврат. Старые заказы при включении пропускаются.</p>
        <label>Сообщение ожидания · пустое выключает<textarea name="waitTemplate" maxlength="700" rows="2">${escapeHtml(c.waitTemplate)}</textarea></label>
        <label>Шаблон выдачи<textarea name="deliveryTemplate" maxlength="700" required rows="6">${escapeHtml(c.deliveryTemplate)}</textarea></label>
        <p class="tiktok-variables">Обязательны <code>{login}</code> и <code>{password}</code>. Также: {username}, {order_id}, {email}, {email_password}, {email_login_url}, {followers}, {likes}, {videos}, {region}, {item_id}.</p>
        <details><summary>Списки запрета</summary><div class="tiktok-fields"><label>ID продавцов LZT<textarea name="sellerBlacklist" rows="3">${escapeHtml(c.sellerBlacklist.join('\n'))}</textarea></label><label>ID покупателей FunPay<textarea name="buyerBlacklist" rows="3">${escapeHtml(c.buyerBlacklist.join('\n'))}</textarea></label></div><small>По одному числовому ID в строке, до 500. Это списки данного плагина.</small></details>
        <p data-tiktok-form-feedback role="status"></p><div class="tiktok-form-actions"><button class="button button--primary" type="submit">Сохранить настройки</button><button class="button button--ghost" type="button" data-tiktok-template-preview>Пример сообщения</button>${s.proxyConfigured?'<button class="button button--ghost" type="button" data-tiktok-direct>Проверить прямой маршрут</button>':''}</div><pre class="tiktok-preview" data-tiktok-template-result hidden></pre>
      </fieldset></form>
    </section>
    <section class="plugin-page-panel"><header class="tiktok-section-heading"><div><span>02 / Поиск</span><h3>Профили выдачи <small>${s.profiles.length}/25</small></h3></div></header>
      <p>Один профиль — одни условия. Вход по cookies исключён; происхождение personal/autoreg. Поиск сам задаёт RUB, сортировку и предел цены.</p>
      <div class="tiktok-profile-list">${s.profiles.map(p=>`<article><div><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.tag)} · до ${tiktokMoney(p.maxPriceMinor)}</span></div><div><button type="button" class="button button--ghost" data-tiktok-search="${p.id}" ${disabled}>Проверить поиск</button><button type="button" class="button button--ghost" data-tiktok-edit="${p.id}" ${disabled}>Изменить</button><button type="button" class="button button--ghost" data-tiktok-profile-remove="${p.id}" ${disabled}>Удалить</button></div></article>`).join('')||'<p>Создайте первый профиль и проверьте поиск без покупки.</p>'}</div>
      <form data-tiktok-form="profile"><fieldset ${disabled}><h4>${p?'Изменить профиль':'Новый профиль'}</h4><input type="hidden" name="id" value="${p?.id||''}"><div class="tiktok-fields"><label>Название<input name="name" maxlength="80" required value="${escapeHtml(p?.name||'')}"></label><label>Тег<input name="tag" pattern="[A-Za-z0-9_-]{1,25}" maxlength="25" required value="${escapeHtml(p?.tag||'')}" placeholder="FOLLOWERS"></label><label>Предел цены, ₽<input name="maxPrice" type="number" min="0.01" max="1000000" step="0.01" required value="${p?(p.maxPriceMinor/100).toFixed(2):'500'}"></label></div><label>Ссылка поиска TikTok LZT<input name="searchUrl" type="url" maxlength="2000" required placeholder="https://lzt.market/tiktok/?followers_min=1000" value="${escapeHtml(p?.searchUrl||'')}"></label><p data-tiktok-form-feedback role="status"></p><button class="button button--primary" type="submit">${p?'Сохранить профиль':'Добавить профиль'}</button>${p?'<button class="button button--ghost" type="button" data-tiktok-edit="">Отменить редактирование</button>':''}</fieldset></form>
      ${tiktokUi.search?tiktokSearchMarkup(tiktokUi.search):''}
    </section>
    <section class="plugin-page-panel"><header class="tiktok-section-heading"><div><span>03 / Ассортимент</span><h3>Лот FunPay → профиль</h3></div></header><p>Проверяем принадлежность лота вашему магазину и разделу. Выдача идёт по явной привязке, без запасных тегов.</p>
      <div class="tiktok-mappings">${s.mappings.map(m=>`<div><a href="https://funpay.com/lots/offer?id=${m.lotId}" target="_blank" rel="noopener noreferrer">#${m.lotId} · ${escapeHtml(m.title)}</a><span>Раздел ${m.nodeId} → ${escapeHtml(s.profiles.find(p=>p.id===m.profileId)?.name||'Профиль не найден')}</span><button class="button button--ghost" data-tiktok-mapping-remove="${m.lotId}" ${disabled}>Убрать привязку</button></div>`).join('')||'<p>Привязок пока нет.</p>'}</div>
      <form data-tiktok-form="mapping"><fieldset ${disabled}><div class="tiktok-fields"><label>ID своего лота FunPay<input name="lotId" inputmode="numeric" pattern="[1-9][0-9]{0,14}" required></label><label>ID обычного раздела FunPay<input name="nodeId" inputmode="numeric" pattern="[1-9][0-9]{0,14}" required></label><label>Профиль<select name="profileId" required><option value="">Выберите профиль</option>${s.profiles.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} · ${escapeHtml(p.tag)}</option>`).join('')}</select></label></div><p data-tiktok-form-feedback role="status"></p><button type="submit" class="button button--primary" ${s.profiles.length?'':'disabled'}>Проверить лот и сохранить</button></fieldset></form>
    </section>
    <section class="plugin-page-panel"><header class="tiktok-section-heading"><div><span>04 / Обработка</span><h3>Заказы и покупки</h3></div></header><p>Покупка и выдача фиксируются отдельно. Повторная выдача не создаёт новую покупку.</p>
      <div class="tiktok-tasks">${s.tasks.filter(t=>!['ignored','unmatched'].includes(t.status)).map(t=>`<article><header><strong>#${escapeHtml(t.orderId)}</strong><span class="tiktok-task-state ${t.status.includes('unknown')?'is-uncertain':''}">${escapeHtml(tiktokTaskLabels[t.status]||t.status)}</span></header><p>${t.costMinor?`Расход: ${tiktokMoney(t.costMinor)} · `:''}${t.itemId?`Товар LZT: #${escapeHtml(t.itemId)}`:''}${t.code?` · ${escapeHtml(t.code)}`:''}</p><div class="tiktok-form-actions">${t.status==='purchase_unknown'?`<button class="button button--ghost" data-tiktok-task="${escapeHtml(t.orderId)}" data-action="reconcile" ${disabled}>Проверить покупку без списания</button>`:''}${['purchased','delivery_unknown'].includes(t.status)?`<button class="button button--ghost" data-tiktok-task="${escapeHtml(t.orderId)}" data-action="redeliver" ${disabled}>Повторно выдать купленный аккаунт</button>`:''}${t.status==='manual'&&!t.itemId?`<button class="button button--ghost" data-tiktok-task="${escapeHtml(t.orderId)}" data-action="retry" ${disabled}>Повторить поиск и обработку</button>`:''}${['manual','queued','discovering'].includes(t.status)?`<button class="button button--ghost" data-tiktok-task="${escapeHtml(t.orderId)}" data-action="cancel" ${disabled}>Отменить обработку</button>`:''}</div></article>`).join('')||'<p>Новые заказы появятся после фонового чтения. Автопокупка включается отдельно в настройках.</p>'}</div>
    </section><aside class="tiktok-note">Управление в Telegram: <code>/tiktok_lzt</code>. Автоматически обрабатывается одна единица в оплаченном заказе RUB. Дневной бюджет включает зарезервированные неопределённые списания. Комиссии FunPay не учтены в разнице.</aside>
  </section>`;
}
function tiktokSearchMarkup(report){return `<div class="tiktok-search-result" role="status"><h4>Поиск без покупки · ${report.candidates.length} кандидатов</h4><p>${report.exhausted?'Поиск дошёл до конца выдачи.':'Выборка ограничена числом страниц; это не весь рынок.'} Деньги не списывались.</p><div class="tiktok-table-wrap"><table><thead><tr><th>Товар LZT</th><th>Стоимость</th><th>Подписчики</th><th>Лайки</th><th>Видео</th><th>Регион</th></tr></thead><tbody>${report.candidates.map(c=>`<tr><td>#${escapeHtml(c.itemId)}</td><td>${tiktokMoney(c.costMinor)}</td><td>${c.followers}</td><td>${c.likes}</td><td>${c.videos}</td><td>${escapeHtml(c.region)}</td></tr>`).join('')||'<tr><td colspan="6">Подходящих кандидатов в прочитанной выдаче нет.</td></tr>'}</tbody></table></div></div>`;}
async function loadTiktokStatus(){
  if(!authState.token||tiktokUi.loading||tiktokUi.busy)return;if(tiktokUi.session!==authState.token||tiktokUi.generation!==sessionGeneration)resetTiktokUi();
  const token=authState.token,generation=sessionGeneration,revision=tiktokUi.revision;tiktokUi.loading=true;
  try{const s=await apiRequest('/api/v1/plugins/tiktok-lzt-market/status',{authenticated:true});if(tiktokCurrent(token,generation)&&revision===tiktokUi.revision){tiktokUi.status=s;tiktokUi.error='';}}
  catch(e){if(tiktokCurrent(token,generation)&&revision===tiktokUi.revision)tiktokUi.error=humanError(e);}
  finally{if(tiktokCurrent(token,generation)&&revision===tiktokUi.revision){tiktokUi.loading=false;renderPluginPage();}}
}
async function tiktokAction(path,body,form=null){
  if(tiktokUi.busy)return;const token=authState.token,generation=sessionGeneration;tiktokUi.busy=true;tiktokUi.revision++;
  const fieldset=form?.querySelector('fieldset');if(fieldset)fieldset.disabled=true;
  const feedback=form?.querySelector('[data-tiktok-form-feedback]')||document.querySelector('[data-tiktok-feedback]');if(feedback)feedback.textContent=path==='search'?'Читаем поиск без покупки…':'Выполняем…';
  let completed=false,accepted=false;
  try{
    const r=await apiRequest('/api/v1/plugins/tiktok-lzt-market/'+path,{method:'POST',authenticated:true,body});if(!tiktokCurrent(token,generation))return;accepted=true;
    if(form?.querySelector('[name="apiKey"]'))form.querySelector('[name="apiKey"]').value='';if(form?.querySelector('[name="proxyUrl"]'))form.querySelector('[name="proxyUrl"]').value='';
    if(path==='search')tiktokUi.search=r;else if(path==='profile'||path==='profile-remove')tiktokUi.editing=null;
    const s=await apiRequest('/api/v1/plugins/tiktok-lzt-market/status',{authenticated:true});if(!tiktokCurrent(token,generation))return;
    tiktokUi.status=s;tiktokUi.error=path==='search'?'Поиск завершён. Покупок не было.':'Действие подтверждено. Проверьте обновлённое состояние.';completed=true;
    if(form?.querySelector('[name="apiKey"]'))form.querySelector('[name="apiKey"]').value='';if(form?.querySelector('[name="proxyUrl"]'))form.querySelector('[name="proxyUrl"]').value='';
  }catch(e){if(tiktokCurrent(token,generation)){tiktokUi.error=accepted?'Действие подтверждено, но обновить состояние не удалось. Нажмите «Обновить», прежде чем повторять действие.':humanError(e);if(feedback){feedback.textContent=tiktokUi.error;feedback.setAttribute('role','alert');}}}
  finally{if(tiktokCurrent(token,generation)){tiktokUi.busy=false;if(fieldset)fieldset.disabled=false;if(completed)renderPluginPage();}}
}
function tiktokMinorInput(value){if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(String(value)))throw Error('Укажите сумму в рублях с точностью до копеек');return Math.round(Number(value)*100);}
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.matches('[data-tiktok-form]'))return;event.preventDefault();if(tiktokUi.busy)return;
  const f=new FormData(form),kind=form.dataset.tiktokForm;
  try{
    if(kind==='settings'){
      const c={...tiktokUi.status.config};for(const k of ['automatic','autoRefund','notifyOwner'])c[k]=f.has(k);for(const k of ['maxSpendMinor','dailyLimitMinor','minMarginMinor','lowBalanceMinor'])c[k]=tiktokMinorInput(f.get(k));c.searchPages=Number(f.get('searchPages'));
      c.waitTemplate=String(f.get('waitTemplate')||'');c.deliveryTemplate=String(f.get('deliveryTemplate')||'');for(const k of ['sellerBlacklist','buyerBlacklist'])c[k]=String(f.get(k)||'').split(/[\s,;]+/).filter(Boolean);
      const body={config:c};if(f.get('apiKey'))body.apiKey=String(f.get('apiKey'));if(f.get('proxyUrl'))body.proxyUrl=String(f.get('proxyUrl'));
      await tiktokAction('settings',body,form);
    }else if(kind==='profile')await tiktokAction('profile',{...(f.get('id')?{id:String(f.get('id'))}:{}),name:String(f.get('name')),tag:String(f.get('tag')),searchUrl:String(f.get('searchUrl')),maxPriceMinor:tiktokMinorInput(f.get('maxPrice'))},form);
    else if(kind==='mapping')await tiktokAction('mapping',{lotId:String(f.get('lotId')),nodeId:String(f.get('nodeId')),profileId:String(f.get('profileId'))},form);
  }catch(e){const feedback=form.querySelector('[data-tiktok-form-feedback]');if(feedback){feedback.textContent=humanError(e);feedback.setAttribute('role','alert');}}
});
document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-tiktok-refresh],[data-tiktok-balance],[data-tiktok-search],[data-tiktok-edit],[data-tiktok-profile-remove],[data-tiktok-mapping-remove],[data-tiktok-task],[data-tiktok-direct],[data-tiktok-template-preview]');if(!el||tiktokUi.busy)return;
  if(el.hasAttribute('data-tiktok-refresh'))return loadTiktokStatus();
  if(el.hasAttribute('data-tiktok-edit')){tiktokUi.editing=el.dataset.tiktokEdit||null;renderPluginPage();return;}
  if(el.hasAttribute('data-tiktok-template-preview')){
    const form=el.closest('form'),value=form.querySelector('[name="deliveryTemplate"]').value,example={username:'Покупатель',order_id:'DEMO123',login:'demo_login',password:'пример_пароля',email:'demo@example.com',email_password:'пример_пароля_почты',email_login_url:'https://example.com/',followers:'1000',likes:'5000',videos:'20',region:'Пример',item_id:'12345'},output=form.querySelector('[data-tiktok-template-result]');output.textContent=value.replace(/\{([a-z_]+)\}/g,(m,key)=>Object.hasOwn(example,key)?example[key]:m);output.hidden=false;return;
  }
  if(el.hasAttribute('data-tiktok-balance'))return tiktokAction('balance',{});
  if(el.hasAttribute('data-tiktok-search'))return tiktokAction('search',{profileId:el.dataset.tiktokSearch});
  if(el.hasAttribute('data-tiktok-direct')){if(window.confirm('Проверить прямое соединение LZT и сохранить его вместо отдельного прокси?'))return tiktokAction('provider-proxy',{clear:true});return;}
  if(el.hasAttribute('data-tiktok-profile-remove')){if(window.confirm('Удалить этот профиль? Привязки и незавершённые заказы блокируют удаление.'))return tiktokAction('profile-remove',{id:el.dataset.tiktokProfileRemove});return;}
  if(el.hasAttribute('data-tiktok-mapping-remove')){if(window.confirm('Убрать привязку? Сам лот FunPay останется.'))return tiktokAction('mapping-remove',{lotId:el.dataset.tiktokMappingRemove});return;}
  if(el.hasAttribute('data-tiktok-task')){
    const action=el.dataset.action;if(action==='redeliver'&&!window.confirm('Проверьте чат: предыдущая отправка могла дойти. Подтверждаете повторную выдачу уже купленного аккаунта без нового списания?'))return;
    if(action==='retry'&&!window.confirm('Вернуть заказ в очередь? При подходящем товаре и включённой автопокупке плагин сможет купить аккаунт в пределах ваших лимитов.'))return;
    if(action==='cancel'&&!window.confirm('Отменить обработку этого заказа? Возврат денег не производится.'))return;
    return tiktokAction('task',{orderId:el.dataset.tiktokTask,action,...(['redeliver','retry'].includes(action)?{confirm:true}:{})});
  }
});
