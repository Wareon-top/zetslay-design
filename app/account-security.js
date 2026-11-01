function supportsPasskeys(){return typeof PublicKeyCredential!=='undefined'&&typeof navigator!=='undefined'&&Boolean(navigator.credentials)&&window.isSecureContext===true;}
function passkeyBytes(value){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
function passkeyBase64(value){return btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function passkeyOptions(json,create){
 const options={...json,challenge:passkeyBytes(json.challenge)};
 if(create)options.user={...json.user,id:passkeyBytes(json.user.id),displayName:typeof json.user.displayName==='string'&&json.user.displayName.trim()?json.user.displayName:json.user.name||'ZetSlay'};
 for(const field of ['allowCredentials','excludeCredentials'])if(json[field])options[field]=json[field].map(k=>{const value={...k,id:passkeyBytes(k.id)};if(!create)delete value.transports;return value;});
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
async function passkeyCeremony(json,create,signal,fromUserClick=false){
 if(!supportsPasskeys())throw Error('Для ключа доступа откройте ZetSlay в современном браузере по HTTPS. Устройство предложит отпечаток, Face ID или PIN.');
 const controller=new AbortController(),cancel=()=>controller.abort();
 if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(cancel,120000);let credential;
 try{
  const publicKey=passkeyOptions(json,create),start=()=>navigator.credentials[create?'create':'get']({publicKey,signal:controller.signal});
  credential=await (fromUserClick||navigator.userActivation?.isActive===true?start():passkeyFromFreshClick(start,controller.signal));
 }
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 if(!credential)throw Error('Подтверждение на устройстве отменено.');
 const response={clientDataJSON:passkeyBase64(credential.response.clientDataJSON)};
 if(create){response.attestationObject=passkeyBase64(credential.response.attestationObject);response.transports=credential.response.getTransports?.()||[];}
 else{response.authenticatorData=passkeyBase64(credential.response.authenticatorData);response.signature=passkeyBase64(credential.response.signature);response.userHandle=credential.response.userHandle?passkeyBase64(credential.response.userHandle):null;}
 return {id:credential.id,rawId:passkeyBase64(credential.rawId),type:credential.type,response,clientExtensionResults:credential.getClientExtensionResults?.()||{},authenticatorAttachment:credential.authenticatorAttachment};
}
function passkeyError(error,enrolling=false){return ['NotAllowedError','AbortError'].includes(error.name)?enrolling?'Устройство не завершило подключение. Повторите и подтвердите системное окно. На iPhone проверьте «Пароли и связка ключей iCloud» и код блокировки; открывайте сайт напрямую в Safari. Резервные коды появятся после успешного подключения.':'Браузер не завершил подтверждение ключом. Повторите запрос. На iPhone откройте zetslay.pro/app/ напрямую в Safari. Если ключ недоступен, используйте резервный код.':error.name==='InvalidStateError'?'Этот ключ доступа уже подключён. Используйте кнопку подтверждения.':humanError(error);}
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
  const hasPasskey=Boolean(session.passkeyAvailable),supported=hasPasskey&&supportsPasskeys();
  dialog.innerHTML=`<form><h2>Подтвердите вход</h2><p>${hasPasskey?'Используйте сохранённый ключ доступа. Устройство предложит Face ID, отпечаток или код блокировки.':'Введите код из приложения или одноразовый резервный код.'}</p>${hasPasskey?'<button class="button button--primary" type="button" data-mfa-passkey disabled>Подготовка подтверждения…</button><p role="status" aria-live="polite" data-mfa-status></p>':''}<p role="alert" data-mfa-error></p><details class="mfa-code-method" data-mfa-code${hasPasskey?'':' open'}><summary>${session.totpAvailable===false?'Войти по резервному коду':'Войти с помощью кода'}</summary><label class="account-security-label">${session.totpAvailable===false?'Одноразовый резервный код':'Код из приложения или резервный код'}<input name="code" type="password" required maxlength="32" autocomplete="one-time-code"></label><button class="button button--primary" type="submit">Подтвердить код</button></details>${hasPasskey?'<details class="mfa-device-help"><summary>Не появляется окно подтверждения?</summary><p>Откройте <a href="https://zetslay.pro/app/" target="_blank" rel="noopener noreferrer">zetslay.pro/app/</a> напрямую в Safari на iPhone или в другом браузере с поддержкой ключей доступа.</p><p>Ключ должен быть доступен на устройстве или через способ, предложенный браузером. Если ключ недоступен, войдите по резервному коду. Его можно вставить из сохранённых кодов.</p></details>':''}<div class="profile-actions"><button class="button button--ghost" type="button" data-mfa-cancel>Отмена</button></div></form>`;
  const field=dialog.querySelector('[name="code"]'),button=dialog.querySelector('[data-mfa-passkey]'),status=dialog.querySelector('[data-mfa-status]'),errorBox=dialog.querySelector('[data-mfa-error]');
  let busy=false,done=false,preparing=false,options=null,optionsAt=0,expiryTimer;
  const controller=new AbortController();
  const close=()=>{clearTimeout(expiryTimer);options=null;controller.abort();dialog.close();dialog.remove();};
  const cancel=()=>{if(done)return;done=true;close();reject(Error('Вход отменён.'));};
  const controls=()=>{
   dialog.querySelectorAll('button').forEach(b=>{if(!b.hasAttribute('data-mfa-cancel'))b.disabled=busy;});
   if(button){button.disabled=busy||preparing||!supported;button.textContent=busy?'Ожидаем подтверждение…':preparing?'Подготовка подтверждения…':options?'Подтвердить ключом доступа':'Повторить подготовку ключа';}
  };
  const request=async(path,body)=>{
   const abort=new AbortController(),cancelRequest=()=>abort.abort();
   controller.signal.addEventListener('abort',cancelRequest,{once:true});
   if(controller.signal.aborted)abort.abort();
   const timer=setTimeout(cancelRequest,15000);
   try{return await apiRequest(path,{method:'POST',signal:abort.signal,body});}
   catch(error){if(abort.signal.aborted){const failure=Error('Не удалось дождаться ответа сервера. Повторите запрос.');failure.code='REQUEST_TIMEOUT';throw failure;}throw error;}
   finally{clearTimeout(timer);controller.signal.removeEventListener('abort',cancelRequest);}
  };
  const prepare=async(preserveError=false)=>{
   if(done||preparing||!supported)return;preparing=true;options=null;clearTimeout(expiryTimer);controls();
   status.textContent='Готовим безопасное подтверждение входа…';if(!preserveError)errorBox.textContent='';
   try{
    const next=await request('/api/v1/auth/passkey/options',{challengeToken:session.challengeToken});
    if(done)return;options=next;optionsAt=Date.now();status.textContent='Нажмите кнопку выше, затем подтвердите вход в системном окне.';
    // Server options expire in two minutes. Refresh only on another explicit tap.
    expiryTimer=setTimeout(()=>{options=null;if(!done&&!busy){status.textContent='Запрос устарел. Обновите его кнопкой выше.';controls();}},90000);
   }catch(error){if(!done){status.textContent='';errorBox.textContent=passkeyError(error);}}
   finally{preparing=false;if(!done)controls();}
  };
  const login=async(usePasskey=false)=>{
   if(busy||done)return;
   if(usePasskey&&(!options||Date.now()-optionsAt>=90000)){await prepare();return;}
   // The options are already loaded. No fetch or await before invoking WebAuthn
   // from this click, including on Safari versions without userActivation.
   const ready=options;options=null;clearTimeout(expiryTimer);busy=true;controls();errorBox.textContent='';
   const code=field.value;field.value='';
   if(status)status.textContent=usePasskey?'Подтвердите вход в окне устройства.':'Проверяем код…';
   let failed=false;
   try{
    let passkeyResponse;
    if(usePasskey){passkeyResponse=await passkeyCeremony(ready,false,controller.signal,true);if(done)return;}
    const result=await request('/api/v1/auth/mfa',{challengeToken:session.challengeToken,...(usePasskey?{passkeyResponse}:{code})});
    if(done){if(result.token){const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);try{await fetch(`${API_BASE_URL}/api/v1/auth/logout`,{method:'POST',credentials:'include',headers:{authorization:`Bearer ${result.token}`},signal:abort.signal}).catch(()=>{});}finally{clearTimeout(timer);}}return;}
    done=true;close();resolve(result);
   }catch(error){if(!done){failed=true;errorBox.textContent=passkeyError(error);if(!usePasskey){dialog.querySelector('[data-mfa-code]').open=true;field.focus();}}}
   finally{
    busy=false;if(!done){if(status)status.textContent='';controls();if(failed&&supported)void prepare(true);}
   }
  };
  dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});dialog.querySelector('[data-mfa-cancel]').addEventListener('click',cancel);
  button?.addEventListener('click',()=>login(true));
  dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();void login(false);});
  document.body.append(dialog);dialog.showModal();
  if(supported)void prepare();
  else if(hasPasskey){button.textContent='Ключ доступа недоступен в этом браузере';status.textContent='Откройте сайт напрямую в Safari или используйте резервный код.';}
  else field.focus();
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
