/* Server owns allocation, expiry and authorization. This module never receives proxy credentials. */
const managedProxyUi = {token:'',generation:0,revision:0,loadRevision:0,data:null,admin:null,busy:false,loading:false,error:'',adminError:'',source:'managed',poll:null};
const managedProxyEscape = value => escapeHtml(String(value ?? ''));
const managedProxyDate = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : 'Не указан';
const managedProxyLabel = value => ({issue:'Получение',renew:'Продление',replace:'Замена',pending:'Ждёт администратора',assigned:'Прокси назначен',completed:'Выполнен',cancelled:'Отменён',expired:'Срок истёк',retired:'Отозван',available:'Проверен',needs_check:'Нужна проверка',complete:'Проверка завершена',failed:'Требуется внимание',checking:'Проверяем с сервера'})[value] || value || '—';
function managedProxyReset(){
  managedProxyUi.revision++;clearInterval(managedProxyUi.poll);
  Object.assign(managedProxyUi,{token:'',generation:0,data:null,admin:null,busy:false,loading:false,error:'',adminError:'',source:'managed',poll:null});
  document.querySelectorAll('[data-managed-proxy],[data-managed-proxy-admin]').forEach(n=>n.remove());
}
function managedProxyChecks(checks){
  return `<div class="mp-checks">${[['availability','Доступность FunPay','Публичная страница через прокси'],['authorization','Авторизация магазина','Golden Key и принадлежность магазина'],['readAccess','Заказы и чаты','Чтение данных без изменений']].map(([key,title,note])=>{
    const c=checks?.[key],passed=c?.status==='passed',failed=c?.status==='failed';
    const detail=passed?(key==='availability'?`HTTP ${c.httpStatus} · ${c.latencyMs ?? '—'} мс`:key==='authorization'?`Магазин #${c.storeId}`:'Чтение подтверждено'):failed?c.code||'Ошибка проверки':'Ещё не проверено';
    return `<div class="mp-check ${passed?'is-passed':failed?'is-failed':''}"><span aria-hidden="true">${passed?'✓':failed?'!':'○'}</span><div><strong>${title}</strong><small>${note}</small></div><b>${managedProxyEscape(detail)}</b></div>`;
  }).join('')}</div>`;
}
function managedProxyMarkup(data,{busy=false,error=''}={}){
  if(!data)return `<section class="mp-card"><h3>Управляемый прокси</h3><p>Получите адрес, проверенный из серверной среды ZetSlay.</p>${error?`<p class="mp-error" role="alert">${managedProxyEscape(error)}</p>`:'<p>Загружаем состояние…</p>'}<button type="button" class="button button--ghost" data-mp-action="refresh" ${busy?'disabled':''}>Обновить статус</button></section>`;
  const r=data.current,op=data.operation,pending=data.requests?.find(x=>['pending','assigned'].includes(x.status)),locked=busy||op?.status==='checking';
  const shopEnabled=typeof proxyShopUi!=='undefined'&&proxyShopUi.data?.enabled===true;
  const shop=typeof proxyShopMarkup==='function'?proxyShopMarkup(data):'';
  const candidates=data.candidates?.filter(x=>!x.expired&&x.state!=='retired')||[];
  const checks=op?.checks||{availability:r?.availability},showChecks=Boolean(data.configured||r||candidates.length||op);
  return `<section class="mp-card${shopEnabled&&!showChecks?' mp-card--shop':''}"><header><div><span class="mp-eyebrow">МАРШРУТ МАГАЗИНА</span><h3>Управляемый прокси</h3></div><span class="mp-chip ${r?.expired||r?.state==='retired'?'is-warning':''}">${r?managedProxyEscape(managedProxyLabel(r.state)):data.source==='external'?'Свой прокси':'Не назначен'}</span></header>
  <p>${r?'Адрес закреплён за вашим кабинетом. Срок подтверждён поставщиком.':shopEnabled?'Выберите локацию и срок. После оплаты адрес проверится с сервера ZetSlay; авторизация магазина — при подключении.':data.source==='external'?'Свой прокси сохранён. Для перехода запросите управляемый адрес.':'Запросите адрес у администратора. Доступ к магазину проверяется перед подключением.'}</p>
  ${r?`<div class="mp-lease"><div><small>Прокси</small><strong>${managedProxyEscape(r.label)}</strong></div><div><small>Действует до</small><strong>${managedProxyDate(r.expiresAt)}</strong></div><div><small>Осталось</small><strong>${r.expired?'Истёк':managedProxyEscape(r.remainingDays)+' дн.'}</strong></div></div>`:''}
  ${r?.expired?'<p class="mp-warning">Срок истёк: новые обращения к магазину приостановлены. Запросите продление или замену.</p>':r&&r.remainingDays<=3?'<p class="mp-warning">Срок скоро закончится. Запросите продление заранее.</p>':''}
  ${pending?`<div class="mp-request"><strong>${managedProxyEscape(managedProxyLabel(pending.kind))} · ${managedProxyEscape(managedProxyLabel(pending.status))}</strong><small>Запрошено: ${managedProxyEscape(pending.days)} дн. Фактический срок появится после назначения.</small><button type="button" class="button button--ghost" data-mp-action="cancel" data-request-id="${managedProxyEscape(pending.id)}" ${locked?'disabled':''}>Отменить запрос</button></div>`:''}
  ${candidates.map(c=>`<div class="mp-candidate"><div><strong>${managedProxyEscape(c.label)}</strong><small>До ${managedProxyDate(c.expiresAt)} · ${managedProxyEscape(c.remainingDays)} дн.</small></div><button type="button" class="button button--primary" data-mp-action="activate" data-resource-id="${managedProxyEscape(c.id)}" ${locked||!data.canActivate?'disabled':''}>Проверить и подключить</button></div>`).join('')}
  ${!showChecks?shop:''}
  ${showChecks?managedProxyChecks(checks):''}${op?`<p class="mp-observed" role="status">${managedProxyEscape(managedProxyLabel(op.status))}${op.installed?' · Новый прокси подключён':''}${op.code?' · '+managedProxyEscape(op.code):''} · ${managedProxyDate(op.updatedAt)}</p>`:''}
  ${error?`<p class="mp-error" role="alert">${managedProxyEscape(error)}</p>`:''}
  <div class="mp-actions"><button type="button" class="button button--ghost" data-mp-action="refresh" ${busy?'disabled':''}>Обновить статус</button>${data.configured?`<button type="button" class="button button--ghost" data-mp-action="check" ${locked||!data.activePlan||r?.expired||r?.state==='retired'?'disabled':''}>Проверить соединение</button>`:''}</div>
  ${!shopEnabled&&!pending?`<form data-mp-request><label>Нужный срок<select name="days"><option value="30">30 дней</option><option value="7">7 дней</option><option value="90">90 дней</option></select></label><div class="mp-actions">${!r?`<button class="button button--primary" name="kind" value="${data.configured?'replace':'issue'}" ${locked||!data.activePlan?'disabled':''}>${data.configured?'Запросить замену':'Получить прокси'}</button>`:`<button class="button button--primary" name="kind" value="renew" ${locked?'disabled':''}>Продлить</button><button class="button button--ghost" name="kind" value="replace" ${locked?'disabled':''}>Заменить</button>`}</div></form>`:''}
  ${showChecks?shop:''}
  ${shopEnabled?'<p class="mp-note">Покупка прокси не заменяет подписку ZetSlay. Доступность FunPay и авторизация магазина проверяются отдельно. Новый адрес подключается только после трёх успешных проверок.</p>':`<p class="mp-note">Выдачу и продление выполняет администратор. Онлайн-оплата прокси пока не подключена. Новый адрес заменит текущий после трёх успешных проверок. Проверка не меняет товары и не покупает аренды.</p>`}</section>`;
}
function managedProxyAdminMarkup(data,{busy=false,error=''}={}){
  const resources=data?.resources||[],requests=data?.requests?.filter(r=>r.status==='pending')||[],available=resources.filter(r=>r.state==='available'&&!r.everAssigned&&!r.ownerWorkspaceId);
  return `<section class="mp-card mp-admin"><header><div><span class="mp-eyebrow">АДМИНИСТРАТОР</span><h2>Прокси и сроки</h2></div><button type="button" class="button button--ghost" data-mp-admin="refresh" ${busy?'disabled':''}>Обновить</button></header><p>Добавьте выделенный адрес и реальную дату окончания из кабинета поставщика. Перед выдачей проверьте FunPay с нашего сервера. Каждый прокси закрепляется за одним кабинетом. У API-поставщика адрес сервера может быть общим, а данные подключения — отдельными.</p>${error?`<p class="mp-error" role="alert">${managedProxyEscape(error)}</p>`:''}
  <details><summary>Добавить прокси в пул</summary><form data-mp-admin-create><div class="mp-fields"><label>Название<input name="label" required maxlength="100" placeholder="Поставщик · номер адреса"></label><label>Прокси<input type="password" name="proxyUrl" required maxlength="2048" autocomplete="off" placeholder="host:port:login:password"></label><label>Выделенный IPv4 поставщика<input name="dedicatedIp" required placeholder="Публичный IPv4"></label><label>Подтверждённая дата окончания<input type="datetime-local" name="expiresAt" required></label></div><button class="button button--primary" ${busy?'disabled':''}>Сохранить в vault</button></form></details>
  <h3>Запросы · ${requests.length}</h3>${requests.map(q=>`<article class="mp-request"><strong>${managedProxyEscape(q.workspaceName)} · ${managedProxyEscape(managedProxyLabel(q.kind))}</strong><small>${managedProxyEscape(q.days)} дней · ${managedProxyDate(q.createdAt)}</small>${q.kind==='renew'?`<form data-mp-admin-renew><input type="hidden" name="requestId" value="${managedProxyEscape(q.id)}"><label>Прокси<select name="resourceId" required>${resources.filter(r=>r.ownerWorkspaceId===q.workspaceId&&(!q.resourceId||r.id===q.resourceId)&&r.state!=='retired').map(r=>`<option value="${managedProxyEscape(r.id)}">${managedProxyEscape(r.label)}</option>`).join('')}</select></label>${managedProxyRenewFields(busy)}</form>`:`<form data-mp-admin-assign><input type="hidden" name="requestId" value="${managedProxyEscape(q.id)}"><label>Проверенный свободный адрес<select name="resourceId" required><option value="">Выберите адрес</option>${available.map(r=>`<option value="${managedProxyEscape(r.id)}">${managedProxyEscape(r.label)} · до ${managedProxyDate(r.expiresAt)}</option>`).join('')}</select></label><button class="button button--primary" ${busy||!available.length?'disabled':''}>Назначить</button></form>`}</article>`).join('')||'<p class="mp-note">Нет ожидающих запросов.</p>'}
  <h3>Пул · ${resources.length}</h3><div class="mp-inventory">${resources.map(r=>`<article class="mp-inventory-item"><header><div><strong>${managedProxyEscape(r.label)}</strong><small>${managedProxyEscape(r.dedicatedIp||'Шлюз поставщика')} · ${managedProxyEscape(r.protocol)}</small></div><span class="mp-chip">${managedProxyEscape(managedProxyLabel(r.state))}</span></header><p>До ${managedProxyDate(r.expiresAt)}${r.ownerWorkspaceId?` · Кабинет ${managedProxyEscape(r.ownerWorkspaceId)}`:''}</p>${managedProxyChecks({availability:r.availability})}<div class="mp-actions"><button type="button" class="button button--ghost" data-mp-admin="check" data-resource-id="${managedProxyEscape(r.id)}" ${busy||['retired','expired'].includes(r.state)?'disabled':''}>Проверить FunPay</button>${r.state!=='retired'?`<button type="button" class="button button--ghost" data-mp-admin="retire" data-resource-id="${managedProxyEscape(r.id)}" ${busy?'disabled':''}>Отозвать адрес</button>`:''}</div>${r.state!=='retired'&&r.supplier!=='steelproxy'?`<details><summary>Подтвердить продление</summary><form data-mp-admin-renew><input type="hidden" name="resourceId" value="${managedProxyEscape(r.id)}">${managedProxyRenewFields(busy)}</form></details>`:''}</article>`).join('')||'<p class="mp-note">Пул пуст. Добавьте приобретённые прокси.</p>'}</div><p class="mp-note">Здесь проверяется публичный FunPay. Авторизация конкретного магазина проверяется в кабинете клиента при подключении. Покупка и продление у поставщика выполняются отдельно.</p></section>`;
}
function managedProxyRenewFields(busy){return `<label>Новый срок у поставщика<input type="datetime-local" name="expiresAt" required></label><label class="mp-confirm"><input name="confirmed" type="checkbox" required>Прокси уже продлён у поставщика</label><button class="button button--primary" ${busy?'disabled':''}>Подтвердить срок</button>`;}
function managedProxyCurrent(token,generation,revision){return Boolean(authState.user&&authState.token===token&&sessionGeneration===generation&&managedProxyUi.revision===revision);}
async function managedProxyRead(path,options={}, {timeoutMs=25000,uncertain=false}={}){
  const controller=new AbortController();let timer;
  try{
    return await Promise.race([
      new Promise((resolve,reject)=>{timer=setTimeout(()=>{const error=new Error(uncertain?'Ответ операции не получен. Проверьте сохранённый результат перед повтором.':'Сервер не ответил за 25 секунд. Повторите загрузку прокси.');error.code=uncertain?'REQUEST_RESULT_UNKNOWN':'REQUEST_TIMEOUT';reject(error);controller.abort();},timeoutMs);}),
      Promise.resolve(apiRequest(path,{...options,authenticated:true,signal:controller.signal})),
    ]);
  }finally{clearTimeout(timer);}
}
async function managedProxyLoad(admin=false){
  if(!authState.user||!authState.token||managedProxyUi.loading||admin&&!adminAllowed())return;
  if(managedProxyUi.token&&managedProxyUi.token!==authState.token)managedProxyReset();
  const token=authState.token,generation=sessionGeneration,revision=managedProxyUi.revision,loadRevision=++managedProxyUi.loadRevision;
  const current=()=>managedProxyCurrent(token,generation,revision)&&loadRevision===managedProxyUi.loadRevision;
  managedProxyUi.token=token;managedProxyUi.generation=generation;managedProxyUi.loading=true;managedProxyUi[admin?'adminError':'error']='';
  try{const data=await managedProxyRead(admin?'/api/v1/admin/managed-proxies':'/api/v1/managed-proxy');if(current()){if(!data||typeof data.activePlan!=='boolean'&&!admin)throw Error('Не удалось подтвердить состояние прокси');managedProxyUi[admin?'admin':'data']=data;managedProxyUi[admin?'adminError':'error']='';}}
  catch(e){if(current())managedProxyUi[admin?'adminError':'error']=e.code==='HTTP_404'?'Серверный модуль ещё не обновлён. Сначала установите обновление API.':e.message||'Не удалось получить состояние';}
  finally{if(current()){managedProxyUi.loading=false;managedProxyRender();}}
}
function managedProxyRender(){
  if(!authState.user)return;
  if(managedProxyUi.token&&managedProxyUi.token!==authState.token){managedProxyUi.revision++;clearInterval(managedProxyUi.poll);Object.assign(managedProxyUi,{token:'',data:null,admin:null,busy:false,loading:false,error:'',adminError:'',poll:null});}
  document.querySelectorAll('[data-managed-proxy]').forEach(root=>{root.innerHTML=managedProxyMarkup(managedProxyUi.data,{busy:managedProxyUi.busy,error:managedProxyUi.error});});
  document.querySelectorAll('[data-managed-proxy-admin]').forEach(root=>{root.innerHTML=managedProxyAdminMarkup(managedProxyUi.admin,{busy:managedProxyUi.busy,error:managedProxyUi.adminError});});
}
async function managedProxyRun(path,body,admin=false){
  if(!authState.user||managedProxyUi.busy||admin&&!adminAllowed())return;
  const token=authState.token,generation=sessionGeneration,revision=managedProxyUi.revision;
  managedProxyUi.loadRevision++;managedProxyUi.loading=false;
  managedProxyUi.busy=true;managedProxyUi[admin?'adminError':'error']='';managedProxyRender();
  if(!admin)managedProxyUi.poll=setInterval(()=>managedProxyLoad(false),3000);
  try{
    const data=await apiRequest(path,{method:'POST',body,authenticated:true,signal:AbortSignal.timeout(200000)});
    if(!managedProxyCurrent(token,generation,revision))return;
    if(data.operation)managedProxyUi.data={...managedProxyUi.data,operation:data.operation};
    if(data.operation?.installed){await loadOnboarding();if(!managedProxyCurrent(token,generation,revision))return;renderConnectionWizard();if(typeof renderProfile==='function')renderProfile();}
  }catch(e){if(managedProxyCurrent(token,generation,revision))managedProxyUi[admin?'adminError':'error']=['TimeoutError','AbortError'].includes(e.name)?'Ответ не получен вовремя. Обновите статус: сервер мог завершить действие.':e.code==='MFA_STEP_UP'?'Подтвердите изменение кодом 2FA в профиле → «Защита аккаунта», затем повторите действие.':e.message||'Действие не выполнено';}
  finally{if(managedProxyCurrent(token,generation,revision)){clearInterval(managedProxyUi.poll);managedProxyUi.poll=null;managedProxyUi.busy=false;managedProxyUi.loadRevision++;managedProxyUi.loading=false;await managedProxyLoad(admin);managedProxyRender();}}
}
(function installManagedProxy(){
 if(typeof document==='undefined'||typeof renderConnectionWizard!=='function')return;
 const render=renderConnectionWizard;
 renderConnectionWizard=function(...args){const result=render(...args);if(!authState.user||!liveConnectionMode()||connectionStep<3||connectionResetTarget||connectionLoading||connectionLoadFailed)return result;
  const body=document.querySelector('.connect-modal__body');if(!body)return result;
  const panel=document.createElement('div');panel.dataset.managedProxy='';body.prepend(panel);
  const source=document.createElement('div');source.className='mp-source';source.innerHTML=`<button type="button" data-mp-source="managed" aria-pressed="${managedProxyUi.source==='managed'}">Управляемый прокси</button><button type="button" data-mp-source="external" aria-pressed="${managedProxyUi.source==='external'}">Свой прокси</button>`;panel.before(source);
  const shortcut=document.createElement('div');shortcut.className='ps-wizard-link';shortcut.innerHTML='<button type="button" data-proxy-open>Купить прокси у ZetSlay →</button>';source.after(shortcut);
  panel.hidden=managedProxyUi.source==='external';
  if(connectionStep===3)for(const child of Array.from(body.children))if(child!==source&&child!==panel&&(child.matches('h3,p,.connect-illustration')))child.hidden=managedProxyUi.source==='managed';
  const own=body.querySelector('input[name="proxyUrl"]')?.closest('.connection-form');if(own)own.hidden=managedProxyUi.source!=='external';
  const next=document.querySelector('[data-connect-next]');if(next&&connectionStep===3&&managedProxyUi.source==='managed'&&!state.onboarding?.funPay?.proxyConfigured){next.disabled=true;next.textContent=managedProxyUi.data?.requests?.some(r=>['pending','assigned'].includes(r.status))?'Ожидаем подключения прокси':'Сначала выберите прокси';}
  managedProxyRender();if(!managedProxyUi.data&&!managedProxyUi.loading)managedProxyLoad();return result;
 };
 if(typeof renderProfile==='function'){const profile=renderProfile;renderProfile=function(...args){const result=profile(...args),root=document.querySelector('[data-profile]');if(root&&authState.user&&!root.querySelector('[data-managed-proxy]')){const panel=document.createElement('div');panel.dataset.managedProxy='';root.append(panel);managedProxyRender();if(!managedProxyUi.data&&!managedProxyUi.loading)managedProxyLoad();}return result;};}
 if(typeof renderAdminPanel==='function'){const admin=renderAdminPanel;renderAdminPanel=function(...args){const result=admin(...args),root=document.querySelector('[data-admin-root]');if(root&&adminAllowed()){const panel=document.createElement('div');panel.dataset.managedProxyAdmin='';root.append(panel);managedProxyRender();if(!managedProxyUi.admin&&!managedProxyUi.loading)managedProxyLoad(true);}return result;};}
 if(typeof resetAccountData==='function'){const reset=resetAccountData;resetAccountData=function(...args){managedProxyReset();return reset(...args);};}
 document.addEventListener('click',event=>{
  const b=event.target.closest?.('[data-mp-action],[data-mp-admin],[data-mp-source]');if(!b||b.disabled||!authState.user)return;
  if(b.dataset.mpSource){managedProxyUi.source=b.dataset.mpSource;renderConnectionWizard();return;}
  const admin=Boolean(b.dataset.mpAdmin),action=b.dataset.mpAdmin||b.dataset.mpAction;if(admin&&!adminAllowed())return;
  if(action==='refresh'){managedProxyLoad(admin);return;}
  if(action==='retire'&&!window.confirm('Отозвать прокси? Новые обращения закреплённого магазина остановятся.'))return;
  const body=action==='cancel'?{requestId:b.dataset.requestId}:{actionId:crypto.randomUUID(),...(b.dataset.resourceId?{resourceId:b.dataset.resourceId}:{})};
  if(action==='retire'){delete body.actionId;body.confirmed=true;}
  managedProxyRun((admin?'/api/v1/admin/managed-proxies/':'/api/v1/managed-proxy/')+action,body,admin);
 });
 document.addEventListener('submit',event=>{
  const form=event.target.closest?.('[data-mp-request],[data-mp-admin-create],[data-mp-admin-assign],[data-mp-admin-renew]');if(!form)return;event.preventDefault();if(!authState.user||managedProxyUi.busy)return;
  const body=Object.fromEntries(new FormData(form));
  if(form.hasAttribute('data-mp-request')){body.id=crypto.randomUUID();body.kind=event.submitter?.value;if(!['issue','renew','replace'].includes(body.kind))return;body.days=Number(body.days);managedProxyRun('/api/v1/managed-proxy/request',body);return;}
  if(!adminAllowed())return;
  const create=form.hasAttribute('data-mp-admin-create'),renew=form.hasAttribute('data-mp-admin-renew');
  if(create||renew){const at=new Date(body.expiresAt);if(!Number.isFinite(at.getTime()))return;body.expiresAt=at.toISOString();}
  if(renew)body.confirmed=body.confirmed==='on';
  if(create){const input=form.querySelector('[name="proxyUrl"]');if(input)input.value='';}
  managedProxyRun('/api/v1/admin/managed-proxies'+(create?'':renew?'/renew':'/assign'),body,true);
 });
})();
