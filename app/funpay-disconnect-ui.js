/* Explicit, authenticated unlink. No credential or proxy value is read here. */
const funpayDisconnectUi={storeId:null,confirm:false,ack:false,busy:false,error:'',token:'',generation:0};
function funpayDisconnectModel(){
 const store=state.onboarding?.funPay?.store;
 if(!authState.user||!authState.token||!store?.id)return null;
 if(typeof liveConnectionMode==='function'&&!liveConnectionMode())return null;
 const id=String(store.id);
 if(!/^[1-9][0-9]{0,19}$/.test(id))return null;
 if(funpayDisconnectUi.storeId!==id||funpayDisconnectUi.token!==authState.token||funpayDisconnectUi.generation!==sessionGeneration){
  Object.assign(funpayDisconnectUi,{storeId:id,confirm:false,ack:false,busy:false,error:'',token:authState.token,generation:sessionGeneration});
 }
 return store;
}
function funpayDisconnectMarkup(){
 const store=funpayDisconnectModel();if(!store)return '';
 const u=funpayDisconnectUi,escape=value=>escapeHtml(String(value??''));
 if(!u.confirm)return `<p class="fd-entry"><button type="button" class="button button--ghost" data-funpay-disconnect="open" ${connectionBusy?'disabled':''}>Отвязать аккаунт FunPay</button></p>`;
 return `<section class="fd-confirm" aria-label="Подтверждение отвязки"><h3 tabindex="-1" data-funpay-disconnect-title>Отвязать аккаунт FunPay?</h3><p><strong>${escape(store.displayName||'Аккаунт FunPay')} · #${escape(store.id)}</strong></p><p>Обработка заказов и автоматизации остановятся. Golden Key и выбранный прокси будут отключены. Лоты на FunPay останутся опубликованными — при необходимости снимите их с продажи.</p><p>Баланс, подписка, купленные плагины, Telegram-бот и оплаченный срок прокси сохранятся. История останется в этом кабинете; привязки лотов и склад не перенесутся на другой магазин.</p><label class="fd-ack"><input type="checkbox" data-funpay-disconnect-ack ${u.ack?'checked':''} ${u.busy?'disabled':''}>Я понимаю, что обработка заказов этого магазина остановится</label>${u.error?`<p class="fd-error" role="alert">${escape(u.error)}</p>`:''}<div class="fd-actions"><button type="button" class="button button--primary" data-funpay-disconnect="confirm" ${u.busy||!u.ack||connectionBusy?'disabled':''}>${u.busy?'Отвязываем…':'Да, отвязать аккаунт'}</button><button type="button" class="button button--ghost" data-funpay-disconnect="cancel" ${u.busy?'disabled':''}>Оставить подключённым</button></div></section>`;
}
function funpayDisconnectRender(){
 if(typeof document==='undefined')return;
 const body=document.querySelector('.connect-modal__body');if(!body)return;
 let root=body.querySelector('[data-funpay-disconnect-root]');
 if(!funpayDisconnectModel()||connectionLoading||connectionLoadFailed||connectionResetTarget){root?.remove();return;}
 if(!root){root=document.createElement('div');root.dataset.funpayDisconnectRoot='';body.append(root);}
 root.innerHTML=funpayDisconnectMarkup();
}
function funpayDisconnectError(e){
 if(e?.code==='MFA_STEP_UP')return 'Подтвердите действие кодом 2FA в профиле → «Защита аккаунта», затем повторите отвязку.';
 if(e?.code==='STORE_DISCONNECT_UNRESOLVED')return 'Есть незавершённая операция или активная аренда. Откройте соответствующий плагин, завершите операцию или проверьте её результат, затем повторите отвязку.';
 if(e?.code==='STORE_DISCONNECT_BUSY')return 'Магазин или плагин выполняет операцию. Дождитесь завершения и повторите отвязку.';
 if(e?.code==='STORE_DISCONNECT_CHANGED')return 'Подключённый аккаунт изменился. Обновите страницу перед отвязкой.';
 if(e?.code==='STORE_DISCONNECT_SCOPE'||e?.code==='STORE_DISCONNECT_REVIEW')return 'Для безопасной отвязки нужна проверка поддержки ZetSlay. Данные подключения сохранены.';
 if(['HTTP_404','NOT_FOUND','STORE_DISCONNECT_UNAVAILABLE'].includes(e?.code))return 'Отвязка пока недоступна на сервере. Обратитесь в поддержку ZetSlay.';
 if(e?.code==='INVALID_SESSION')return 'Войдите в кабинет заново, затем повторите отвязку.';
 return 'Не удалось подтвердить отвязку. Обновите страницу и проверьте состояние подключения перед повтором.';
}
async function funpayDisconnectConfirm(){
 const store=funpayDisconnectModel(),u=funpayDisconnectUi;
 if(!store||!u.confirm||!u.ack||u.busy||connectionBusy)return;
 const token=authState.token,generation=sessionGeneration,id=u.storeId;
 const ownsBusy=()=>authState.user&&authState.token===token&&sessionGeneration===generation;
 const current=()=>ownsBusy()&&u.storeId===id&&String(state.onboarding?.funPay?.store?.id)===id;
 u.busy=true;u.error='';connectionBusy=true;funpayDisconnectRender();
 try{
  const result=await apiRequest('/api/v1/onboarding/disconnect-store',{method:'POST',authenticated:true,body:{storeId:id,confirmed:true},signal:AbortSignal.timeout(25000)});
  if(!current())return;
  if(!result||result.funPay?.store||result.funPay?.credentialConfigured!==false||result.funPay?.proxyConfigured!==false)throw Error('UNCONFIRMED');
  state.onboarding=result;
  // Reload clears all old-store UI caches and outstanding reads together.
  window.location.reload();
 }catch(error){if(current())u.error=funpayDisconnectError(error);}
 finally{if(ownsBusy())connectionBusy=false;if(current()){u.busy=false;funpayDisconnectRender();}}
}
(function installFunpayDisconnectUi(){
 if(typeof document==='undefined'||typeof renderConnectionWizard!=='function')return;
 const render=renderConnectionWizard;
 renderConnectionWizard=function(...args){const result=render.apply(this,args);funpayDisconnectRender();return result;};
 document.addEventListener('change',event=>{
  if(!event.target.matches('[data-funpay-disconnect-ack]'))return;
  funpayDisconnectUi.ack=event.target.checked;
  // Keep keyboard focus on the checkbox while enabling the confirmation.
  const button=document.querySelector('[data-funpay-disconnect="confirm"]');
  if(button)button.disabled=!funpayDisconnectUi.ack||funpayDisconnectUi.busy;
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-funpay-disconnect]');if(!button)return;
  event.preventDefault();if(!funpayDisconnectModel()||funpayDisconnectUi.busy||connectionBusy)return;
  const action=button.dataset.funpayDisconnect;
  if(action==='confirm'){void funpayDisconnectConfirm();return;}
  funpayDisconnectUi.confirm=action==='open';funpayDisconnectUi.ack=false;funpayDisconnectUi.error='';funpayDisconnectRender();
  if(action==='open')document.querySelector('[data-funpay-disconnect-title]')?.focus();
  if(action==='cancel')document.querySelector('[data-funpay-disconnect="open"]')?.focus();
 });
})();
