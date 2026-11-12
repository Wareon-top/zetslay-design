/* Server owns allocation, expiry and authorization. This module never receives proxy credentials. */
const managedProxyUi = {token:'',generation:0,revision:0,loadRevision:0,data:null,admin:null,busy:false,loading:false,error:'',adminError:'',source:'managed',poll:null};
const managedProxyEscape = value => escapeHtml(String(value ?? ''));
const managedProxyDate = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : 'Не указан';
const managedProxyLabel = value => ({issue:'Получение',renew:'Продление',replace:'Замена',pending:'Ждёт администратора',assigned:'Прокси назначен',completed:'Выполнен',cancelled:'Отменён',expired:'Срок истёк',retired:'Отозван',available:'Проверен',needs_check:'Нужна проверка',complete:'Проверка завершена',failed:'Требуется внимание',checking:'Проверяем с сервера'})[value] || value || '—';
const managedProxyFailureMessages = {
  STORE_CHANGED:['Аккаунт FunPay не совпадает с подключённым','FunPay вернул другой аккаунт. Проверьте, что Golden Key взят из нужного аккаунта FunPay. Если аккаунт не меняли — обратитесь в поддержку ZetSlay.'],
  AUTH_REJECTED:['Не удалось войти в аккаунт FunPay','FunPay не подтвердил вход по сохранённому Golden Key. Скопируйте актуальный ключ из нужного аккаунта, сохраните его в настройках подключения и повторите проверку.'],
  CAPTCHA_REQUIRED:['FunPay требует проверку в браузере','Откройте FunPay, войдите в нужный аккаунт и пройдите проверку, если она появится. Затем повторите проверку соединения в ZetSlay.'],
  PROXY_AUTH_REJECTED:['Прокси отклонил данные доступа','Для своего прокси проверьте логин, пароль и режим доступа у поставщика. Если прокси куплен в ZetSlay — обратитесь в поддержку ZetSlay.'],
  PROXY_EXPIRED:['Срок действия прокси закончился','Продлите прокси или подключите другой действующий адрес, затем повторите проверку.'],
  PROXY_REVOKED:['Прокси больше недоступен для подключения','Выберите другой действующий прокси или обратитесь в поддержку ZetSlay.'],
  PROXY_CHECK_BUSY:['Другая проверка ещё выполняется','Дождитесь её завершения, обновите статус и повторите проверку.'],
  PROXY_CHECK_TIMEOUT:['Проверка не завершилась вовремя','Обновите статус перед повтором: сервер мог продолжить проверку после закрытия ожидания.'],
  PROXY_TIMEOUT:['Прокси не ответил вовремя','Повторите проверку немного позже. Если ошибка повторяется, проверьте прокси у поставщика или обратитесь в поддержку ZetSlay.'],
  PROXY_CONNECTION_REFUSED:['Не удалось подключиться к прокси','Проверьте адрес, порт и срок действия прокси. Для прокси ZetSlay обратитесь в поддержку.'],
  PROXY_DNS_FAILED:['Не удалось найти адрес прокси','Проверьте, правильно ли указан адрес прокси. Если он верный, повторите проверку позже или обратитесь к поставщику.'],
  PROXY_TLS_REJECTED:['Не удалось установить защищённое соединение','Повторите проверку. Если ошибка сохраняется, обратитесь к поставщику прокси или в поддержку ZetSlay.'],
  PROXY_TUNNEL_REJECTED:['Прокси не разрешил соединение с FunPay','Проверьте, разрешён ли доступ к FunPay у поставщика прокси. Для прокси ZetSlay обратитесь в поддержку.'],
  PLATFORM_UNAVAILABLE:['Не удалось получить ответ FunPay','Повторите проверку позже. Если FunPay открывается в браузере, а ошибка сохраняется — обратитесь в поддержку ZetSlay.'],
  HTTP_STATUS:['FunPay ответил с ошибкой','Повторите проверку позже. Если ошибка повторяется, передайте код из подробностей в поддержку ZetSlay.'],
  RATE_LIMITED:['Слишком много запросов','Подождите немного и повторите проверку. Частые повторы могут продлить ограничение.'],
  PLAN_REQUIRED:['Для подключения нужна активная подписка','Проверьте срок подписки ZetSlay и продлите её, если он закончился.'],
  INVALID_SESSION:['Нужно снова войти в ZetSlay','Войдите в кабинет заново и повторите проверку.'],
  INVALID_STATE:['Подключение изменилось или ещё не настроено','Обновите состояние подключения. Убедитесь, что Telegram привязан, Golden Key сохранён и прокси выбран, затем повторите проверку.'],
};
const managedProxyFailureAliases={AUTH_REJECTED_PROXY:'PROXY_AUTH_REJECTED',TIMEOUT:'PROXY_TIMEOUT',ETIMEDOUT:'PROXY_TIMEOUT',SYNC_TIMEOUT:'PROXY_CHECK_TIMEOUT',ECONNREFUSED:'PROXY_CONNECTION_REFUSED',DNS_FAILED:'PROXY_DNS_FAILED',ENOTFOUND:'PROXY_DNS_FAILED',EAI_AGAIN:'PROXY_DNS_FAILED',TLS_REJECTED:'PROXY_TLS_REJECTED',TUNNEL_REJECTED:'PROXY_TUNNEL_REJECTED',METHOD_REJECTED:'PROXY_TUNNEL_REJECTED'};
function managedProxyFailure(code){
  const key=typeof code==='string'&&Object.hasOwn(managedProxyFailureAliases,code)?managedProxyFailureAliases[code]:code;
  const [title,action]=typeof key==='string'&&Object.hasOwn(managedProxyFailureMessages,key)?managedProxyFailureMessages[key]:['Не удалось завершить проверку','Обновите статус и повторите проверку. Если ошибка сохраняется, обратитесь в поддержку ZetSlay и передайте код из подробностей.'];
  return {title,action};
}
function managedProxyTechnical(code){
  const safe=typeof code==='string'&&/^[A-Z][A-Z0-9_]{1,63}$/.test(code)?code:'CHECK_FAILED';
  return `<details class="mp-check-technical"><summary>Код для поддержки</summary><code>${managedProxyEscape(safe)}</code></details>`;
}
function managedProxyReset(){
  managedProxyUi.revision++;clearInterval(managedProxyUi.poll);
  Object.assign(managedProxyUi,{token:'',generation:0,data:null,admin:null,busy:false,loading:false,error:'',adminError:'',source:'managed',poll:null});
  document.querySelectorAll('[data-managed-proxy],[data-managed-proxy-admin]').forEach(n=>n.remove());
}
function managedProxyChecks(checks){
  const stages=[['availability','Доступность FunPay','Публичная страница через прокси'],['authorization','Авторизация магазина','Golden Key и принадлежность магазина'],['readAccess','Заказы и чаты','Чтение данных без изменений']];
  return `<div class="mp-checks">${stages.map(([key,title,note],index)=>{
    const c=checks?.[key],passed=c?.status==='passed',failed=c?.status==='failed';
    const blocked=!passed&&!failed&&stages.slice(0,index).some(([previous])=>checks?.[previous]?.status==='failed');
    const explanation=failed?managedProxyFailure(c.code):null;
    const detail=passed?(key==='availability'?`HTTP ${c.httpStatus} · ${c.latencyMs ?? '—'} мс`:key==='authorization'?`Магазин #${c.storeId}`:'Чтение подтверждено'):failed?explanation.title:blocked?'Проверка остановлена':'Ещё не проверено';
    return `<div class="mp-check ${passed?'is-passed':failed?'is-failed':''}"><span aria-hidden="true">${passed?'✓':failed?'!':'○'}</span><div><strong>${title}</strong><small>${note}</small></div><b>${managedProxyEscape(detail)}</b>${failed?`<p class="mp-check-help">${managedProxyEscape(explanation.action)}</p>${managedProxyTechnical(c.code)}`:blocked?'<p class="mp-check-help">Сначала устраните ошибку на предыдущем этапе и повторите проверку.</p>':''}</div>`;
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
  ${showChecks?managedProxyChecks(checks):''}${op?`<p class="mp-observed" role="status">${managedProxyEscape(managedProxyLabel(op.status))}${op.installed?' · Новый прокси подключён':''} · ${managedProxyDate(op.updatedAt)}</p>${op.code&&!Object.values(checks||{}).some(c=>c?.status==='failed')?`<div class="mp-operation-help"><strong>${managedProxyEscape(managedProxyFailure(op.code).title)}</strong><p>${managedProxyEscape(managedProxyFailure(op.code).action)}</p>${managedProxyTechnical(op.code)}</div>`:''}`:''}
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
  if (!authState.user || !authState.token || admin && !adminAllowed()) return;
  const token = authState.token;
  const generation = sessionGeneration;
  if (managedProxyUi.token && managedProxyUi.token !== token) managedProxyReset();
  if (managedProxyUi.loading && managedProxyUi.generation === generation) return;

  const revision = managedProxyUi.revision;
  const loadRevision = ++managedProxyUi.loadRevision;
  const ownsLoading = () => revision === managedProxyUi.revision && loadRevision === managedProxyUi.loadRevision;
  const current = () => ownsLoading() && managedProxyCurrent(token,generation,revision);
  managedProxyUi.token=token;managedProxyUi.generation=generation;managedProxyUi.loading=true;managedProxyUi[admin?'adminError':'error']='';
  try{const data=await managedProxyRead(admin?'/api/v1/admin/managed-proxies':'/api/v1/managed-proxy');if(current()){if(!data||typeof data.activePlan!=='boolean'&&!admin)throw Error('Не удалось подтвердить состояние прокси');managedProxyUi[admin?'admin':'data']=data;managedProxyUi[admin?'adminError':'error']='';}}
  catch(e){if(current())managedProxyUi[admin?'adminError':'error']=e.code==='HTTP_404'?'Серверный модуль ещё не обновлён. Сначала установите обновление API.':e.message||'Не удалось получить состояние';}
  finally {
    // Session refresh invalidates the response, but the request still owns its loading flag.
    if (ownsLoading()) {
      managedProxyUi.loading = false;
      managedProxyRender();
    }
  }
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
  }catch(e){if(managedProxyCurrent(token,generation,revision))managedProxyUi[admin?'adminError':'error']=['TimeoutError','AbortError'].includes(e.name)?'Ответ не получен вовремя. Обновите статус: сервер мог завершить действие.':e.code==='MFA_STEP_UP'?'Подтвердите изменение кодом 2FA в профиле → «Защита аккаунта», затем повторите действие.':Object.hasOwn(managedProxyFailureMessages,e.code||'')||Object.hasOwn(managedProxyFailureAliases,e.code||'')?`${managedProxyFailure(e.code).title}. ${managedProxyFailure(e.code).action}`:e.message||'Действие не выполнено';}
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
