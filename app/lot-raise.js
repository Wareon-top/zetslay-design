/* Per-store server schedule. Browser polling reads saved status only. */
const lotRaiseUi={scope:null,epoch:0,data:null,categories:[],draft:null,open:false,busy:false,loading:false,error:'',lastRead:0};
const lotRaiseLabels={waiting:'Ожидает запуска',raised:'Поднято',cooldown:'Ожидаем разрешения FunPay',failed:'Не выполнено',unknown:'Результат не подтверждён',blocked:'Нужно проверить на FunPay',rejected:'FunPay отклонил запрос'};
const lotRaiseErrors={AUTH_REJECTED:'Обновите Golden Key в подключении магазина.',PROXY_TIMEOUT:'Прокси не ответил. Проверьте его срок действия и соединение.',PROXY_AUTH_REJECTED:'Проверьте логин и пароль прокси.',RAISE_CATEGORIES_CHANGED:'Состав категорий изменился. Обновите выбор.',RAISE_RATE_LIMIT:'FunPay ограничил частоту запросов. Следующая проверка отложена.',RAISE_ACTION_REQUIRED:'FunPay требует действие на сайте. Проверьте поднятие вручную на FunPay, затем сохраните настройки снова.',RAISE_REJECTED:'FunPay отклонил поднятие. Проверьте доступность этой категории на площадке.',RAISE_RESULT_UNKNOWN:'Ответ площадки не подтверждён. Следующая попытка отложена минимум на 6 часов.',RAISE_HTTP_FAILED:'Не удалось получить ответ площадки. Сервис повторит проверку позже.',RAISE_ACCESS_CHANGED:'Подключение изменилось во время проверки.'};
const lotRaiseScope=()=>authState.user&&authState.token&&selectedStore()?.id?`${authState.token}:${sessionGeneration}:${selectedStore().id}`:null;
const lotRaiseEscape=v=>escapeHtml(String(v??''));
function lotRaiseTime(v){return v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Пока нет';}
function resetLotRaise(){lotRaiseUi.epoch++;Object.assign(lotRaiseUi,{scope:null,data:null,categories:[],draft:null,open:false,busy:false,loading:false,error:'',lastRead:0});document.querySelector('[data-lot-raise]')?.remove();}
function lotRaiseDraft(data){return {enabled:data.enabled,intervalMinutes:data.intervalMinutes,nodeIds:data.categories.map(c=>c.nodeId)};}
function renderLotRaise(){
 const root=document.querySelector('[data-lots-workspace]');if(!root)return;
 const scope=lotRaiseScope();if(scope!==lotRaiseUi.scope){resetLotRaise();lotRaiseUi.scope=scope;}
 if(!scope)return;
 let host=document.querySelector('[data-lot-raise]');if(!host){host=document.createElement('section');host.dataset.lotRaise='';host.className='lot-raise';const anchor=root.querySelector('.inventory-heading');if(anchor)anchor.after(host);else root.prepend(host);}
 const ui=lotRaiseUi,d=ui.data,esc=lotRaiseEscape;
 const groups=d?.groups?.filter(g=>d.categories.some(c=>c.gameId===g.gameId))||[];
 const attention=groups.find(g=>['unknown','blocked','rejected','failed'].includes(g.status));
 const tone=!d?.enabled?'off':!d.planActive||!d.connectionReady||!d.workerEnabled?'paused':attention?'attention':'on';
 const label=!d?'Загрузка':!d.enabled?'Выключено':!d.workerEnabled?'На паузе':!d.planActive?'Нужен тариф':!d.connectionReady?'Нет подключения':attention?'Требует внимания':'По расписанию';
 const successes=groups.map(g=>g.lastSuccessAt).filter(Boolean).sort(),next=groups.filter(g=>g.status!=='blocked').map(g=>g.nextAttemptAt).filter(Boolean).sort()[0];
 host.innerHTML=`<header class="lot-raise-head"><div class="lot-raise-symbol" aria-hidden="true">↑</div><div class="lot-raise-title"><h2>Автоподнятие лотов</h2><p>Выбранные категории — выше в списке предложений FunPay.</p></div><span class="lot-raise-status is-${tone}"><i></i>${label}</span><button type="button" class="button button--ghost" data-raise-toggle aria-expanded="${ui.open}">${ui.open?'Свернуть':'Настроить'}</button></header>${ui.error?`<p class="lot-raise-notice is-error" role="alert">${esc(ui.error)} <button type="button" data-raise-refresh>Обновить статус</button></p>`:''}${d?`<div class="lot-raise-summary"><div><span>Категории</span><strong>${d.categories.length?d.categories.length+' выбрано':'Выберите категории'}</strong></div><div><span>Последнее подтверждённое поднятие</span><strong>${lotRaiseTime(successes.at(-1))}</strong></div><div><span>Следующая попытка</span><strong>${d.enabled&&d.workerEnabled&&d.planActive&&d.connectionReady?next?Date.parse(next)<=Date.now()?'В очереди':lotRaiseTime(next):'Ожидает настройки':'На паузе'}</strong></div></div>${attention?`<p class="lot-raise-notice"><strong>${esc(attention.game)}</strong> · ${esc(lotRaiseErrors[attention.code]||lotRaiseLabels[attention.status])}</p>`:''}${!d.workerEnabled?'<p class="lot-raise-notice">Возможность пока выключена на сервере.</p>':''}`:'<p class="lot-raise-loading" role="status">Читаем сохранённое расписание…</p>'}${ui.open&&d?lotRaiseFormMarkup():''}`;
 if(!d&&!ui.loading&&!ui.error)loadLotRaise();
}
function lotRaiseFormMarkup(){
 const ui=lotRaiseUi,d=ui.data,f=ui.draft||(ui.draft=lotRaiseDraft(d)),esc=lotRaiseEscape;
 return `<form data-raise-form><div class="lot-raise-settings"><div class="lot-raise-setting-copy"><h3>Пусть витрина остаётся заметной</h3><p>Поднятие выполняется на сервере, даже если кабинет закрыт. FunPay задаёт минимальное время ожидания; сервис всегда учитывает его.</p><label class="lot-raise-enabled"><input type="checkbox" name="enabled" ${f.enabled?'checked':''} ${ui.busy?'disabled':''}>Включить автоподнятие</label><label class="lot-raise-interval">Интервал между попытками<select name="intervalMinutes" ${ui.busy?'disabled':''}>${[[60,'1 час'],[120,'2 часа'],[180,'3 часа'],[240,'4 часа'],[360,'6 часов'],[720,'12 часов'],[1440,'24 часа']].map(([n,s])=>`<option value="${n}" ${n===f.intervalMinutes?'selected':''}>${s}</option>`).join('')}</select></label><small>Активная подписка или пробный период обязательны. Поднятие не включает скрытые лоты и не гарантирует первую позицию.</small></div><div class="lot-raise-categories"><div class="lot-raise-category-head"><div><h3>Категории магазина</h3><span>Выбрано: ${f.nodeIds.length}</span></div><button type="button" data-raise-categories ${ui.busy?'disabled':''}>${ui.busy?'Проверяем…':ui.categories.length?'Обновить список':'Загрузить категории'}</button></div>${ui.categories.length?`<div class="lot-raise-select-actions"><button type="button" data-raise-select="all" ${ui.busy?'disabled':''}>Выбрать все</button><button type="button" data-raise-select="none" ${ui.busy?'disabled':''}>Снять выбор</button></div><div class="lot-raise-category-list">${ui.categories.map(c=>`<label><input type="checkbox" name="nodeId" value="${esc(c.nodeId)}" ${f.nodeIds.includes(c.nodeId)?'checked':''} ${ui.busy?'disabled':''}><span><strong>${esc(c.game)}</strong><small>${esc(c.name)}</small></span></label>`).join('')}</div>`:'<div class="lot-raise-empty">Загрузите актуальные категории подключённого магазина. Это только чтение: лоты не поднимутся.</div>'}</div></div><footer class="lot-raise-footer"><span>Сохранение включает расписание для выбранных категорий.</span><button type="submit" class="button button--primary" ${ui.busy?'disabled':''}>${ui.busy?'Сохраняем…':'Сохранить настройки'}</button></footer></form>${d.groups.some(g=>d.categories.some(c=>c.gameId===g.gameId))?`<details class="lot-raise-details"><summary>Расписание по играм</summary><div class="lot-raise-schedule">${d.groups.filter(g=>d.categories.some(c=>c.gameId===g.gameId)).map(g=>`<article><strong>${esc(g.game)}</strong><span>${esc(lotRaiseLabels[g.status]||'Ожидает')}</span><time>${g.status==='blocked'?'Нужна проверка':lotRaiseTime(g.nextAttemptAt)}</time></article>`).join('')}</div></details>`:''}`;
}
function lotRaiseValid(d,id){return d&&d.storeId===id&&typeof d.enabled==='boolean'&&Array.isArray(d.categories)&&d.categories.length<=300&&Array.isArray(d.groups)&&d.groups.length<=300;}
async function loadLotRaise(force=false){
 const ui=lotRaiseUi,scope=lotRaiseScope();if(!scope||ui.loading||ui.busy||!force&&Date.now()-ui.lastRead<30000)return;
 ui.loading=true;const epoch=ui.epoch,id=String(selectedStore().id);
 try{const d=await apiRequest('/api/v1/funpay/lot-raise?storeId='+encodeURIComponent(id),{authenticated:true,signal:AbortSignal.timeout(12000)});if(scope!==lotRaiseScope()||epoch!==ui.epoch)return;if(!lotRaiseValid(d,id))throw Error('Не удалось подтвердить расписание этого магазина.');ui.data=d;if(!ui.draft){ui.draft=lotRaiseDraft(d);ui.categories=d.categories;}ui.lastRead=Date.now();ui.error='';}
 catch(e){if(scope===lotRaiseScope()&&epoch===ui.epoch)ui.error=e.code==='NOT_FOUND'?'Обновите сервер для настройки автоподнятия.':humanError(e);}
 finally{if(scope===lotRaiseScope()&&epoch===ui.epoch){ui.loading=false;renderLotRaise();}}
}
async function lotRaiseAction(action){
 const ui=lotRaiseUi,scope=lotRaiseScope();if(!scope||ui.busy||!ui.data)return;
 const id=String(selectedStore().id),epoch=ui.epoch;
 const body=action==='categories'?{storeId:id}:{storeId:id,revision:ui.data.revision,...ui.draft};
 if(action==='save'&&body.enabled&&!body.nodeIds.length){ui.error='Выберите хотя бы одну категорию.';renderLotRaise();return;}
 ui.busy=true;ui.error='';renderLotRaise();
 try{const d=await apiRequest('/api/v1/funpay/lot-raise'+(action==='categories'?'/categories':''),{method:'POST',authenticated:true,body,signal:AbortSignal.timeout(65000)});if(scope!==lotRaiseScope()||epoch!==ui.epoch)return;
  if(d.storeId!==id||!Array.isArray(d.categories)||d.categories.length>300||d.categories.some(c=>!c||!(/^[1-9][0-9]{0,19}$/.test(c.nodeId))||!(/^[1-9][0-9]{0,19}$/.test(c.gameId))))throw Error('Категории магазина не подтверждены.');
  if(action==='categories'){ui.categories=d.categories;ui.draft.nodeIds=ui.draft.nodeIds.filter(n=>d.categories.some(c=>c.nodeId===n));}
  else{if(!lotRaiseValid(d,id))throw Error('Настройки не подтверждены.');ui.data=d;ui.draft=lotRaiseDraft(d);showToast(d.enabled?'Расписание сохранено. Результат первой попытки появится здесь.':'Автоподнятие выключено.','success');}
 }catch(e){if(scope===lotRaiseScope()&&epoch===ui.epoch)ui.error=e.code==='RAISE_STALE'?'Настройки изменились в другой вкладке. Обновите статус и сохраните выбор снова.':humanError(e);}
 finally{if(scope===lotRaiseScope()&&epoch===ui.epoch){ui.busy=false;renderLotRaise();}}
}
(function installLotRaise(){
 const reset=resetLotsWorkspace;resetLotsWorkspace=function(...args){resetLotRaise();return reset.apply(this,args);};
 const render=renderLotWorkspace;renderLotWorkspace=function(...args){const result=render.apply(this,args);renderLotRaise();return result;};
 document.addEventListener('click',e=>{if(!e.target.closest?.('[data-lot-raise]'))return;
  if(e.target.closest('[data-raise-toggle]')){lotRaiseUi.open=!lotRaiseUi.open;renderLotRaise();return;}
  if(e.target.closest('[data-raise-refresh]')){loadLotRaise(true);return;}
  if(e.target.closest('[data-raise-categories]')){lotRaiseAction('categories');return;}
  const select=e.target.closest('[data-raise-select]');if(select&&!lotRaiseUi.busy){lotRaiseUi.draft.nodeIds=select.dataset.raiseSelect==='all'?lotRaiseUi.categories.map(c=>c.nodeId):[];renderLotRaise();}
 });
 document.addEventListener('change',e=>{if(!e.target.closest?.('[data-raise-form]')||lotRaiseUi.busy)return;const f=lotRaiseUi.draft,t=e.target;if(t.name==='enabled')f.enabled=t.checked;if(t.name==='intervalMinutes')f.intervalMinutes=Number(t.value);if(t.name==='nodeId'){f.nodeIds=t.checked?[...new Set([...f.nodeIds,t.value])]:f.nodeIds.filter(n=>n!==t.value);const count=document.querySelector('.lot-raise-category-head span');if(count)count.textContent='Выбрано: '+f.nodeIds.length;}});
 document.addEventListener('submit',e=>{if(!e.target.matches?.('[data-raise-form]'))return;e.preventDefault();lotRaiseAction('save');});
 setInterval(()=>{if(!document.hidden&&document.querySelector('[data-lots-workspace]')?.hidden===false&&!lotRaiseUi.open)loadLotRaise();},30000);
})();
