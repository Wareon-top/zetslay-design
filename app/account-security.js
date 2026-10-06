/* Security is optional until enrolled. All authorization remains on the server. */
const accountSecurityUi={token:'',data:null,health:null,setup:null,codes:[],loading:false,busy:false,error:'',request:0};
function accountSecurityMarkup(model,health){
 const esc=escapeHtml;
 const dates=value=>value?new Date(value).toLocaleString('ru-RU'):'Ещё не зафиксирована';
 const status={ok:'Последний опрос успешен',retrying:'Повтор после ошибки',blocked:'Подключение остановлено',not_observed:'Фоновый опрос ещё не зафиксирован',disabled:'Фоновые модули выключены'};
 return `<section class="profile-panel account-security-panel" data-account-security-panel><div class="profile-panel-heading"><span class="profile-panel-icon">${icon('shield')}</span><div><h2>Защита аккаунта</h2><p>2FA и активные сессии</p></div></div>${accountSecurityUi.error?`<p role="alert" class="account-security-error">${esc(accountSecurityUi.error)}</p>`:''}${!model?'<p>Загрузите состояние защиты.</p>':`<div class="account-security-heading"><strong>Двухфакторная защита ${model.enabled?'включена':'не включена'}</strong><span>${model.enabled?`Резервных кодов: ${model.recoveryRemaining}`:'Через приложение-аутентификатор'}</span></div>${model.enabled?`<label class="account-security-label">Код 2FA или резервный код<input data-security-proof autocomplete="one-time-code" maxlength="32" type="password"></label><div class="profile-actions"><button type="button" class="button button--ghost" data-security-action="step-up">Подтвердить изменения подключения</button><button type="button" class="button button--ghost" data-security-action="recovery">Новые резервные коды</button><button type="button" class="button button--ghost" data-security-action="disable">Выключить 2FA</button></div><p>Для изменений подключения подтверждение действует 5 минут. Для каждого действия используйте новый код.</p>`:`<p>Защищает вход через Telegram и почту. Существующий магазин останется в вашем кабинете.</p><button type="button" class="button button--primary" data-security-action="setup">Настроить 2FA</button>`}${accountSecurityUi.setup?`<form data-security-enroll><h3>Добавьте ZetSlay в приложение-аутентификатор</h3><p>Выберите ручное добавление ключа, тип «По времени». Этот ключ показывается только сейчас.</p><label class="account-security-label">Ключ настройки<input readonly value="${esc(accountSecurityUi.setup.secret)}" autocomplete="off"></label><label class="account-security-label">Первый код из приложения<input name="code" required pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label><p>Настройка действует 10 минут. При включении все остальные входы будут завершены.</p><div class="profile-actions"><button type="submit" class="button button--primary">Включить 2FA</button><button type="button" class="button button--ghost" data-security-cancel-setup>Отмена</button></div></form>`:''}${accountSecurityUi.codes.length?`<div class="account-security-recovery" role="status"><h3>Сохраните резервные коды</h3><p>Каждый код работает один раз. После закрытия они больше не отображаются. Храните отдельно от устройства с аутентификатором.</p><code>${accountSecurityUi.codes.map(esc).join('<br>')}</code><div class="profile-actions"><button class="button button--primary" type="button" data-security-download>Скачать коды</button><button class="button button--ghost" type="button" data-security-hide-codes>Я сохранил</button></div></div>`:''}<h3>Активные сессии</h3><p>Названия определяются браузером и могут быть неточными.</p><div class="account-security-sessions">${model.sessions.map(item=>`<article><div><strong>${esc(item.device)}${item.current?' · Этот вход':''}</strong><small>Вход: ${esc(dates(item.createdAt))}<br>Активность: ${esc(dates(item.lastSeenAt))}</small></div>${!item.current?`<button type="button" class="button button--ghost" data-security-action="revoke" data-security-session="${esc(item.id)}">Завершить</button>`:''}</article>`).join('')}</div><button type="button" class="button button--ghost" data-security-action="revoke-others">Завершить остальные входы</button>`}<button type="button" class="text-action" data-security-refresh>${accountSecurityUi.loading?'Загружаем…':'Обновить состояние'}</button><div class="account-sync-health"><h3>Синхронизация магазина</h3><strong>${esc(status[health?.status]||status.not_observed)}</strong><p>Последний успешный фоновый опрос: ${esc(dates(health?.lastSuccessAt))}${health?.nextAttemptAt?`<br>Следующая попытка: ${esc(dates(health.nextAttemptAt))}`:''}${health?.code?`<br>Код: ${esc(health.code)}`:''}</p><small>Это состояние фонового опроса. Оно не гарантирует получение всей истории площадки.</small></div></section>`;
}
function renderAccountSecurity(){
 const root=document.querySelector('[data-profile] .profile-grid');if(!root||!authState.user)return;
 if(accountSecurityUi.token&&accountSecurityUi.token!==authState.token){accountSecurityUi.request++;Object.assign(accountSecurityUi,{token:'',data:null,health:null,setup:null,codes:[],loading:false,busy:false,error:''});}
 root.querySelector('[data-account-security-panel]')?.remove();root.insertAdjacentHTML('beforeend',accountSecurityMarkup(accountSecurityUi.data,accountSecurityUi.health));
 root.querySelectorAll('[data-account-security-panel] button').forEach(button=>button.disabled=accountSecurityUi.loading||accountSecurityUi.busy);
}
async function loadAccountSecurity(){
 if(!authState.token||accountSecurityUi.loading)return;
 const token=authState.token,request=++accountSecurityUi.request;accountSecurityUi.token=token;accountSecurityUi.loading=true;accountSecurityUi.error='';renderAccountSecurity();
 try{const [data,health]=await Promise.all([apiRequest('/api/v1/account/security',{authenticated:true}),apiRequest('/api/v1/account/sync-health',{authenticated:true})]);if(token!==authState.token||request!==accountSecurityUi.request)return;Object.assign(accountSecurityUi,{data,health});}
 catch(error){if(token===authState.token&&request===accountSecurityUi.request)accountSecurityUi.error=humanError(error);}
 finally{if(token===authState.token&&request===accountSecurityUi.request){accountSecurityUi.loading=false;renderAccountSecurity();}}
}
async function changeAccountSecurity(operation,extra={}){
 if(accountSecurityUi.busy||!authState.token)return;
 if(['disable','revoke-others','recovery'].includes(operation)&&!window.confirm({disable:'Отключить защиту 2FA?', 'revoke-others':'Завершить все остальные входы?',recovery:'Заменить резервные коды? Старые перестанут работать.'}[operation]))return;
 const code=extra.code||document.querySelector('[data-security-proof]')?.value||'',token=authState.token;
 accountSecurityUi.busy=true;accountSecurityUi.error='';renderAccountSecurity();
 try{const result=await apiRequest('/api/v1/account/security',{method:'POST',authenticated:true,body:{operation,code,...extra}});if(token!==authState.token)return;
  if(operation==='setup')accountSecurityUi.setup=result;
  if(operation==='enable'){accountSecurityUi.setup=null;accountSecurityUi.codes=result.recoveryCodes;}
  if(operation==='recovery')accountSecurityUi.codes=result.recoveryCodes;
  if(operation==='disable'){accountSecurityUi.codes=[];accountSecurityUi.setup=null;}
  if(operation==='step-up')showToast('Изменения подключения подтверждены на 5 минут','success');
  await loadAccountSecurity();
 }catch(error){if(token===authState.token)accountSecurityUi.error=humanError(error);}
 finally{if(token===authState.token){accountSecurityUi.busy=false;renderAccountSecurity();}}
}
function challengeMfa(session){
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');dialog.className='account-mfa-dialog';
  dialog.innerHTML='<form><h2>Подтвердите вход</h2><p>Введите код из приложения-аутентификатора или один резервный код.</p><label class="account-security-label">Код<input name="code" type="password" required maxlength="32" autocomplete="one-time-code" autofocus></label><p role="alert" data-mfa-error></p><div class="profile-actions"><button class="button button--primary" type="submit">Войти</button><button class="button button--ghost" type="button" data-mfa-cancel>Отмена</button></div></form>';
  const close=()=>{dialog.close();dialog.remove();};let busy=false,done=false;
  const cancel=()=>{if(done)return;done=true;close();reject(Error('Вход отменён.'));};
  dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});dialog.querySelector('[data-mfa-cancel]').addEventListener('click',cancel);
  dialog.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();if(busy||done)return;busy=true;dialog.querySelector('[type="submit"]').disabled=true;
   const field=dialog.querySelector('[name="code"]'),code=field.value;field.value='';
   try{const result=await apiRequest('/api/v1/auth/mfa',{method:'POST',body:{challengeToken:session.challengeToken,code}});if(done){if(result.token)await fetch(`${API_BASE_URL}/api/v1/auth/logout`,{method:'POST',headers:{authorization:`Bearer ${result.token}`}}).catch(()=>{});return;}done=true;close();resolve(result);}
   catch(error){if(!done){dialog.querySelector('[data-mfa-error]').textContent=humanError(error);field.focus();}}
   finally{busy=false;if(!done)dialog.querySelector('[type="submit"]').disabled=false;}
  });document.body.append(dialog);dialog.showModal();
 });
}
(function installAccountSecurity(){
 if(typeof acceptSession!=='function'||typeof renderProfile!=='function')return;
 const originalReset=resetAccountData;resetAccountData=function(...args){accountSecurityUi.request++;Object.assign(accountSecurityUi,{token:'',data:null,health:null,setup:null,codes:[],loading:false,busy:false,error:''});return originalReset(...args);};
 const originalAccept=acceptSession;acceptSession=async session=>originalAccept(session?.mfaRequired?await challengeMfa(session):session);
 const originalRender=renderProfile;renderProfile=function(...args){const result=originalRender(...args);renderAccountSecurity();return result;};
 const originalLoad=loadProfile;loadProfile=async function(...args){return Promise.all([originalLoad(...args),loadAccountSecurity()]);};
 document.addEventListener('click',event=>{
  const action=event.target.closest?.('[data-security-action]');if(action){changeAccountSecurity(action.dataset.securityAction,{sessionId:action.dataset.securitySession});return;}
  if(event.target.closest?.('[data-security-refresh]'))loadAccountSecurity();
  if(event.target.closest?.('[data-security-cancel-setup]')){accountSecurityUi.setup=null;renderAccountSecurity();}
  if(event.target.closest?.('[data-security-hide-codes]')){accountSecurityUi.codes=[];renderAccountSecurity();}
  if(event.target.closest?.('[data-security-download]')){const blob=new Blob(['ZetSlay — одноразовые резервные коды\n'+accountSecurityUi.codes.join('\n')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='zetslay-recovery-codes.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 });
 document.addEventListener('submit',event=>{if(event.target.matches?.('[data-security-enroll]')){event.preventDefault();changeAccountSecurity('enable',{code:String(new FormData(event.target).get('code')||'')});}});
 renderAccountSecurity();
})();
