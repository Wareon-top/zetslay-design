function supportsPasskeys(){return typeof PublicKeyCredential!=='undefined'&&typeof navigator!=='undefined'&&Boolean(navigator.credentials)&&window.isSecureContext===true;}
function passkeyBytes(value){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
function passkeyBase64(value){return btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function passkeyOptions(json,create){
 const options={...json,challenge:passkeyBytes(json.challenge)};
 if(create)options.user={...json.user,id:passkeyBytes(json.user.id),displayName:typeof json.user.displayName==='string'&&json.user.displayName.trim()?json.user.displayName:json.user.name||'ZetSlay'};
 for(const field of ['allowCredentials','excludeCredentials'])if(json[field])options[field]=json[field].map(k=>({...k,id:passkeyBytes(k.id)}));
 return options;
}
function passkeyFromFreshClick(start,signal){
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');dialog.className='account-mfa-dialog';
  dialog.innerHTML='<h2>Подтверждение на устройстве</h2><p>Запрос готов. Нажмите «Продолжить на устройстве», затем подтвердите Face ID, отпечатком или кодом блокировки.</p><div class="profile-actions"><button type="button" class="button button--primary" data-passkey-continue>Продолжить на устройстве</button><button type="button" class="button button--ghost" data-passkey-cancel>Отмена</button></div>';
  let done=false;
  const close=()=>{signal?.removeEventListener('abort',cancel);dialog.close();dialog.remove();};
  const cancel=()=>{if(done)return;done=true;close();const error=Error('Подтверждение отменено.');error.name='AbortError';reject(error);};
  dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
  dialog.querySelector('[data-passkey-cancel]').addEventListener('click',cancel);
  dialog.querySelector('[data-passkey-continue]').addEventListener('click',()=>{
   if(done)return;done=true;
   // Start synchronously inside the native click, before awaiting anything.
   try{const pending=start();close();Promise.resolve(pending).then(resolve,reject);}catch(error){close();reject(error);}
  });
  document.body.append(dialog);dialog.showModal();
  if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 });
}
async function passkeyCeremony(json,create,signal){
 if(!supportsPasskeys())throw Error('Для ключа доступа откройте ZetSlay в современном браузере по HTTPS. Устройство предложит отпечаток, Face ID или PIN.');
 const controller=new AbortController(),cancel=()=>controller.abort();
 if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(cancel,120000);let credential;
 try{
  const publicKey=passkeyOptions(json,create),start=()=>navigator.credentials[create?'create':'get']({publicKey,signal:controller.signal});
  credential=await (navigator.userActivation?.isActive===true?start():passkeyFromFreshClick(start,controller.signal));
 }
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 if(!credential)throw Error('Подтверждение на устройстве отменено.');
 const response={clientDataJSON:passkeyBase64(credential.response.clientDataJSON)};
 if(create){response.attestationObject=passkeyBase64(credential.response.attestationObject);response.transports=credential.response.getTransports?.()||[];}
 else{response.authenticatorData=passkeyBase64(credential.response.authenticatorData);response.signature=passkeyBase64(credential.response.signature);response.userHandle=credential.response.userHandle?passkeyBase64(credential.response.userHandle):null;}
 return {id:credential.id,rawId:passkeyBase64(credential.rawId),type:credential.type,response,clientExtensionResults:credential.getClientExtensionResults?.()||{},authenticatorAttachment:credential.authenticatorAttachment};
}
function passkeyError(error,enrolling=false){return ['NotAllowedError','AbortError'].includes(error.name)?enrolling?'Устройство не завершило подключение. Повторите и подтвердите системное окно. На iPhone проверьте «Пароли и связка ключей iCloud» и код блокировки; открывайте сайт напрямую в Safari. Резервные коды появятся после успешного подключения.':'Подтверждение не завершено. Повторите на устройстве, где сохранён ключ доступа, или используйте резервный код.':error.name==='InvalidStateError'?'Этот ключ доступа уже подключён. Используйте кнопку подтверждения.':humanError(error);}
function accountProofHint(model){return model?.adminMfaRequired&&model.adminProofMaxAgeSeconds===3600?'Доступ к админке подтверждается на 1 час. Для изменения защиты аккаунта подтверждение действует 5 минут.':'Подтверждение защищённых действий действует 5 минут.';}
function passkeyMarkup(model){
 if(!model.passkeySupported)return '';
 const keys=model.passkeys||[];
 return `<div class="account-passkey"><h3>Вход без приложения с кодами</h3><p>Подтверждайте вход отпечатком, Face ID или PIN устройства. Биометрические данные остаются на устройстве.</p><div class="profile-actions">${keys.length?'<button type="button" class="button button--primary" data-security-action="passkey-step-up">Подтвердить отпечатком / Face ID</button>':''}<button type="button" class="button ${keys.length?'button--ghost':'button--primary'}" data-security-action="passkey-register">${keys.length?'Добавить другое устройство':'Подключить отпечаток / Face ID'}</button></div><p>${keys.length?'Ключ доступа подключён. '+accountProofHint(model):'Нажмите кнопку и следуйте подсказкам браузера. Windows может предложить Windows Hello или PIN; телефон — отпечаток или Face ID.'}</p>${keys.map((key,i)=>`<div class="profile-actions"><span>Ключ доступа ${i+1}</span><button type="button" class="button button--ghost" data-security-action="passkey-remove" data-security-credential="${escapeHtml(key.id)}">Удалить</button></div>`).join('')}</div>`;
}

/* Client MFA is optional; the server requires MFA and recent proof for administrator access. */
const accountSecurityUi={token:'',data:null,health:null,setup:null,codes:[],loading:false,busy:false,error:'',request:0,revision:0,passkeyAbort:null};
function accountSecurityMarkup(model,health){
 const esc=escapeHtml;
 const dates=value=>value?new Date(value).toLocaleString('ru-RU'):'Ещё не зафиксирована';
 const status={ok:'Последний опрос успешен',partial:'Магазин обновлён; одному из плагинов нужна проверка',retrying:'Повтор после ошибки',blocked:'Подключение остановлено',not_observed:'Фоновый опрос ещё не зафиксирован',disabled:'Фоновые модули выключены'};
 return `<section class="profile-panel account-security-panel" data-account-security-panel><div class="profile-panel-heading"><span class="profile-panel-icon">${icon('shield')}</span><div><h2>Защита аккаунта</h2><p>2FA и активные сессии · <a href="/security/" target="_blank" rel="noopener">Как защищены данные</a></p></div></div>${accountSecurityUi.error?`<p role="alert" class="account-security-error">${esc(accountSecurityUi.error)}</p>`:''}${!model?'<p>Загрузите состояние защиты.</p>':`<div class="account-security-heading"><strong>Двухфакторная защита ${model.enabled?'включена':'не включена'}</strong><span>${model.enabled?`Резервных кодов: ${model.recoveryRemaining}`:'Выберите ключ доступа или приложение с кодами'}</span></div>${model.adminMfaRequired?'<p class="kosell-hint">Для административного доступа нужна 2FA. '+esc(accountProofHint(model))+'</p>':''}${passkeyMarkup(model)}${model.enabled?`<label class="account-security-label">${model.totpEnabled===false?'Резервный код':'Код 2FA или резервный код'}<input data-security-proof autocomplete="one-time-code" maxlength="32" type="password"></label><div class="profile-actions"><button type="button" class="button button--ghost" data-security-action="step-up">Подтвердить кодом</button><button type="button" class="button button--ghost" data-security-action="recovery">Новые резервные коды</button>${model.adminMfaRequired?'':'<button type="button" class="button button--ghost" data-security-action="disable">Выключить 2FA</button>'}</div><p>${esc(accountProofHint(model))} Для изменения защиты с кодом используйте новый код.</p>`:`<p>Защищает вход через Telegram и почту. Существующий магазин останется в вашем кабинете.</p><button type="button" class="button button--primary" data-security-action="setup">Использовать приложение с кодами</button>`}${accountSecurityUi.setup?`<form data-security-enroll><h3>Добавьте ZetSlay в приложение-аутентификатор</h3><p>Выберите ручное добавление ключа, тип «По времени». Этот ключ показывается только сейчас.</p><label class="account-security-label">Ключ настройки<input readonly value="${esc(accountSecurityUi.setup.secret)}" autocomplete="off"></label><label class="account-security-label">Первый код из приложения<input name="code" required pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label><p>Настройка действует 10 минут. При включении все остальные входы будут завершены.</p><div class="profile-actions"><button type="submit" class="button button--primary">Включить 2FA</button><button type="button" class="button button--ghost" data-security-cancel-setup>Отмена</button></div></form>`:''}${accountSecurityUi.codes.length?`<div class="account-security-recovery" role="status"><h3>Сохраните резервные коды</h3><p>Каждый код работает один раз. После закрытия они больше не отображаются. Храните отдельно от устройства, которым подтверждаете вход.</p><code>${accountSecurityUi.codes.map(esc).join('<br>')}</code><div class="profile-actions"><button class="button button--primary" type="button" data-security-download>Скачать коды</button><button class="button button--ghost" type="button" data-security-hide-codes>Я сохранил</button></div></div>`:''}<h3>Активные сессии</h3><p>Названия определяются браузером и могут быть неточными.</p><div class="account-security-sessions">${model.sessions.map(item=>`<article><div><strong>${esc(item.device)}${item.current?' · Этот вход':''}</strong><small>Вход: ${esc(dates(item.createdAt))}<br>Активность: ${esc(dates(item.lastSeenAt))}</small></div>${!item.current?`<button type="button" class="button button--ghost" data-security-action="revoke" data-security-session="${esc(item.id)}">Завершить</button>`:''}</article>`).join('')}</div><button type="button" class="button button--ghost" data-security-action="revoke-others">Завершить остальные входы</button>`}<button type="button" class="text-action" data-security-refresh>${accountSecurityUi.loading?'Загружаем…':'Обновить состояние'}</button><div class="account-sync-health"><h3>Синхронизация магазина</h3><strong>${esc(status[health?.status]||status.not_observed)}</strong><p>Последний успешный фоновый опрос: ${esc(dates(health?.lastSuccessAt))}${health?.nextAttemptAt?`<br>Следующая попытка: ${esc(dates(health.nextAttemptAt))}`:''}${health?.code?`<br>Код: ${esc(health.code)}`:''}</p><small>Это состояние фонового опроса. Оно не гарантирует получение всей истории площадки.</small></div></section>`;
}
function renderAccountSecurity(){
 const root=document.querySelector('[data-profile] .profile-grid');if(!root||!authState.user)return;
 if(accountSecurityUi.token&&accountSecurityUi.token!==authState.token){accountSecurityUi.passkeyAbort?.abort();accountSecurityUi.passkeyAbort=null;accountSecurityUi.request++;accountSecurityUi.revision++;Object.assign(accountSecurityUi,{token:'',data:null,health:null,setup:null,codes:[],loading:false,busy:false,error:''});}
 root.querySelector('[data-account-security-panel]')?.remove();root.insertAdjacentHTML('beforeend',accountSecurityMarkup(accountSecurityUi.data,accountSecurityUi.health));
 root.querySelectorAll('[data-account-security-panel] button').forEach(button=>button.disabled=accountSecurityUi.loading||accountSecurityUi.busy);
}
async function loadAccountSecurity(){
 if(!authState.token||accountSecurityUi.loading||accountSecurityUi.busy)return;
 const token=authState.token,request=++accountSecurityUi.request,revision=accountSecurityUi.revision;accountSecurityUi.token=token;accountSecurityUi.loading=true;accountSecurityUi.error='';renderAccountSecurity();
 try{const [data,health]=await Promise.all([apiRequest('/api/v1/account/security',{authenticated:true,signal:AbortSignal.timeout(15000)}),apiRequest('/api/v1/account/sync-health',{authenticated:true,signal:AbortSignal.timeout(15000)})]);if(token!==authState.token||request!==accountSecurityUi.request||revision!==accountSecurityUi.revision)return;Object.assign(accountSecurityUi,{data,health});}
 catch(error){if(token===authState.token&&request===accountSecurityUi.request&&revision===accountSecurityUi.revision)accountSecurityUi.error=humanError(error);}
 finally{if(token===authState.token&&request===accountSecurityUi.request&&revision===accountSecurityUi.revision){accountSecurityUi.loading=false;renderAccountSecurity();}}
}
async function changeAccountSecurity(operation,extra={}){
 if(accountSecurityUi.busy||!authState.token)return;
 if(['disable','revoke-others','recovery','passkey-remove'].includes(operation)&&!window.confirm({disable:'Отключить защиту 2FA?', 'revoke-others':'Завершить все остальные входы?',recovery:'Заменить резервные коды? Старые перестанут работать.', 'passkey-remove':'Удалить этот ключ доступа?'}[operation]))return;
 const code=extra.code||document.querySelector('[data-security-proof]')?.value||'',token=authState.token,revision=++accountSecurityUi.revision;
 const current=()=>token===authState.token&&revision===accountSecurityUi.revision;
 accountSecurityUi.request++;accountSecurityUi.loading=false;accountSecurityUi.busy=true;accountSecurityUi.error='';renderAccountSecurity();
 let accepted=false,posting=false;const controller=new AbortController();accountSecurityUi.passkeyAbort=controller;
 try{
  if(['passkey-register','passkey-step-up'].includes(operation)){
   const options=await apiRequest('/api/v1/account/security',{method:'POST',authenticated:true,signal:AbortSignal.timeout(15000),body:{operation:operation+'-options'}});
   if(!current())return;
   extra={...extra,response:await passkeyCeremony(options,operation==='passkey-register',controller.signal)};
   if(!current())return;
  }
  posting=true;const result=await apiRequest('/api/v1/account/security',{method:'POST',authenticated:true,signal:AbortSignal.timeout(15000),body:{operation,code,...extra}});
  if(!current())return;accepted=true;
  if(operation==='setup')accountSecurityUi.setup=result;
  if(operation==='enable'||operation==='passkey-register'){accountSecurityUi.setup=null;if(result.recoveryCodes)accountSecurityUi.codes=result.recoveryCodes;}
  if(operation==='recovery')accountSecurityUi.codes=result.recoveryCodes;
  if(operation==='disable'){accountSecurityUi.codes=[];accountSecurityUi.setup=null;}
  const data=await apiRequest('/api/v1/account/security',{authenticated:true,signal:AbortSignal.timeout(15000)});
  if(current()){accountSecurityUi.data=data;if(operation==='step-up'||operation==='passkey-step-up')showToast(data.adminMfaRequired&&data.adminProofMaxAgeSeconds===3600?'Доступ к админке подтверждён на 1 час':'Защищённые действия подтверждены на 5 минут','success');}
 }catch(error){
  if(current())accountSecurityUi.error=!posting?passkeyError(error,operation==='passkey-register'):accepted?'Действие принято, но обновить состояние не удалось. Обновите состояние перед повтором.':(['TimeoutError','AbortError','REQUEST_RESULT_UNKNOWN'].includes(error.name)||error.code==='REQUEST_RESULT_UNKNOWN')?'Ответ не получен вовремя. Обновите состояние перед повтором: действие могло завершиться.':passkeyError(error,operation==='passkey-register');
 }finally{if(current()){accountSecurityUi.passkeyAbort=null;accountSecurityUi.busy=false;renderAccountSecurity();}}
}

function challengeMfa(session){
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');dialog.className='account-mfa-dialog';
  dialog.innerHTML=`<form><h2>Подтвердите вход</h2><p>Подтвердите вход на своём устройстве или введите резервный код${session.totpAvailable===false?'':' / код из приложения'}.</p>${session.passkeyAvailable?'<button class="button button--primary" type="button" data-mfa-passkey>Войти с отпечатком / Face ID</button>':''}<label class="account-security-label">Код<input name="code" type="password" required maxlength="32" autocomplete="one-time-code" autofocus></label><p role="alert" data-mfa-error></p><div class="profile-actions"><button class="button button--primary" type="submit">Войти</button><button class="button button--ghost" type="button" data-mfa-cancel>Отмена</button></div></form>`;
  const close=()=>{dialog.close();dialog.remove();};let busy=false,done=false;const controller=new AbortController();
  const cancel=()=>{if(done)return;done=true;controller.abort();close();reject(Error('Вход отменён.'));};
  dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});dialog.querySelector('[data-mfa-cancel]').addEventListener('click',cancel);
  const login=async(usePasskey=false)=>{if(busy||done)return;busy=true;dialog.querySelectorAll('button').forEach(b=>{if(!b.hasAttribute('data-mfa-cancel'))b.disabled=true;});
   const field=dialog.querySelector('[name="code"]'),code=field.value;field.value='';
   try{
    let passkeyResponse;
    if(usePasskey){const options=await apiRequest('/api/v1/auth/passkey/options',{method:'POST',signal:AbortSignal.timeout(15000),body:{challengeToken:session.challengeToken}});if(done)return;passkeyResponse=await passkeyCeremony(options,false,controller.signal);if(done)return;}
    const result=await apiRequest('/api/v1/auth/mfa',{method:'POST',signal:AbortSignal.timeout(15000),body:{challengeToken:session.challengeToken,...(usePasskey?{passkeyResponse}:{code})}});
    if(done){if(result.token)await fetch(`${API_BASE_URL}/api/v1/auth/logout`,{method:'POST',credentials:'include',headers:{authorization:`Bearer ${result.token}`},signal:AbortSignal.timeout(12000)}).catch(()=>{});return;}done=true;close();resolve(result);
   }
   catch(error){if(!done){dialog.querySelector('[data-mfa-error]').textContent=passkeyError(error);field.focus();}}
   finally{busy=false;if(!done)dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
  dialog.querySelector('[data-mfa-passkey]')?.addEventListener('click',()=>login(true));
  dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();login(false);
  });document.body.append(dialog);dialog.showModal();
 });
}
(function installAccountSecurity(){
 if(typeof acceptSession!=='function'||typeof renderProfile!=='function')return;
 const originalReset=resetAccountData;resetAccountData=function(...args){accountSecurityUi.passkeyAbort?.abort();accountSecurityUi.passkeyAbort=null;accountSecurityUi.request++;accountSecurityUi.revision++;Object.assign(accountSecurityUi,{token:'',data:null,health:null,setup:null,codes:[],loading:false,busy:false,error:''});return originalReset(...args);};
 const originalAccept=acceptSession;acceptSession=async session=>{
  const generation=typeof sessionGeneration==='number'?sessionGeneration:0,attempt=typeof authAttemptRevision==='number'?authAttemptRevision:0,token=authState.token;
  const verified=session?.mfaRequired?await challengeMfa(session):session;
  if(token!==authState.token||generation!==(typeof sessionGeneration==='number'?sessionGeneration:0)||attempt!==(typeof authAttemptRevision==='number'?authAttemptRevision:0)){
   if(verified?.token)await fetch(`${API_BASE_URL}/api/v1/auth/logout`,{method:'POST',credentials:'include',headers:{authorization:`Bearer ${verified.token}`},signal:AbortSignal.timeout(12000)}).catch(()=>{});
   throw Error('Вход отменён: аккаунт или способ входа уже изменился.');
  }
  return originalAccept(verified);
 };
 const originalRender=renderProfile;renderProfile=function(...args){const result=originalRender(...args);renderAccountSecurity();return result;};
 const originalLoad=loadProfile;loadProfile=async function(...args){return Promise.all([originalLoad(...args),loadAccountSecurity()]);};
 document.addEventListener('click',event=>{
  const action=event.target.closest?.('[data-security-action]');if(action){changeAccountSecurity(action.dataset.securityAction,{sessionId:action.dataset.securitySession,credentialId:action.dataset.securityCredential});return;}
  if(event.target.closest?.('[data-security-refresh]'))loadAccountSecurity();
  if(event.target.closest?.('[data-security-cancel-setup]')){accountSecurityUi.setup=null;renderAccountSecurity();}
  if(event.target.closest?.('[data-security-hide-codes]')){accountSecurityUi.codes=[];renderAccountSecurity();}
  if(event.target.closest?.('[data-security-download]')){const blob=new Blob(['ZetSlay — одноразовые резервные коды\n'+accountSecurityUi.codes.join('\n')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='zetslay-recovery-codes.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 });
 document.addEventListener('submit',event=>{if(event.target.matches?.('[data-security-enroll]')){event.preventDefault();changeAccountSecurity('enable',{code:String(new FormData(event.target).get('code')||'')});}});
 renderAccountSecurity();
})();
