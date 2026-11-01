/* Read server snapshots, never initiate marketplace reads from a timer. */
(() => {
 const INTERVAL=15000,DEADLINE=12000,MAX_BACKOFF=120000;
 const ui={scope:'',flight:null,timer:null,lastAttempt:0,failures:0,error:'',health:null,financeAt:0};
 const view=()=>document.querySelector('[data-view].is-active')?.dataset.view;
 const scope=()=>[authState.user?.id,authState.workspace?.id,sessionGeneration,authState.token,selectedStore()?.id].join(':');
 const allowed=()=>Boolean(authState.user&&authState.token&&subscriptionActive()&&selectedStore()?.status==='connected_read_only');
 const visible=()=>!document.hidden&&navigator.onLine!==false;
 const relevant=()=>['dashboard','orders','messages','lots','billing','finance'].includes(view());
 const editing=()=>Boolean(document.querySelector('dialog[open], .modal.is-open'));
 const loaded=()=>Number.isFinite(Date.parse(state.storeContent?.observedAt));
 function stop(){if(ui.timer!==null)window.clearTimeout(ui.timer);ui.timer=null;}
 function reset(){stop();const old=ui.flight;ui.flight=null;old?.cancel();Object.assign(ui,{scope:'',lastAttempt:0,failures:0,error:'',health:null,financeAt:0});}
 function status(){
  const node=document.querySelector('.topbar-context small');if(!node)return;
  node.dataset.autoRefreshStatus='';
  if(!authState.user||!relevant()){node.textContent='ZetSlay Control';node.removeAttribute('title');return;}
  let label=!subscriptionActive()?'Автообновление доступно с тарифом':selectedStore()?.status!=='connected_read_only'?'Подключите магазин':!visible()?'Автообновление на паузе':ui.error||['retrying','blocked','disabled'].includes(ui.health?.status)?'Обновление задерживается':!loaded()?'Ожидаем данные FunPay':'Автообновление включено';
  const stale=loaded()&&Date.now()-Date.parse(state.storeContent.observedAt)>180000;
  if(allowed()&&stale&&visible())label='Данные давно не обновлялись';
  node.textContent=label;
  node.title=[loaded()?'Данные FunPay от '+new Date(state.storeContent.observedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' МСК':'',allowed()?'Проверяем новые данные каждые 15 секунд. Синхронизация FunPay выполняется сервером в фоне.':'',ui.error].filter(Boolean).join('\n');
 }
 function schedule(){stop();status();if(!allowed()||!visible()||!relevant())return;
  const delay=ui.failures?Math.min(MAX_BACKOFF,INTERVAL*2**ui.failures):INTERVAL;
  ui.timer=window.setTimeout(()=>{ui.timer=null;void poll();},Math.max(1000,delay-(Date.now()-ui.lastAttempt)));
 }
 async function finance(){
  if(view()!=='finance'||typeof loadFinanceWorkspace!=='function'||financeUi.dialog||financeUi.saving||financeUi.busy||Date.now()-Math.max(ui.financeAt,financeUi.loadedAt)<60000)return;
  ui.financeAt=Date.now();await loadFinanceWorkspace({force:true});
 }
 function apply(data){
  const content=data.content;if(!content)return;
  if(content.workspaceId!==authState.workspace?.id||String(content.storeId)!==String(selectedStore()?.id)||content.observedAt!==data.observedAt||!Number.isFinite(Date.parse(content.observedAt))||!Array.isArray(content.orders)||!Array.isArray(content.messages))throw Error('Сервис не подтвердил данные этого магазина.');
  // A slower cache read must never replace a newer manual refresh.
  if(loaded()&&Date.parse(content.observedAt)<=Date.parse(state.storeContent.observedAt))return;
  normalizeStoreContent(content);
  const store=selectedStore();store.metrics={...store.metrics,balance:content.balance?.availableMinor!=null?formatMinor(content.balance.availableMinor,content.balance.currency||'RUB'):'—',lots:content.lots?.length??'—'};
  if(typeof overviewState!=='undefined')overviewState.error='';
  if(typeof messagesPageState!=='undefined')messagesPageState.error='';
  renderOrders();renderConversations();renderLots();
  if(typeof renderOverview==='function')renderOverview();
  if(typeof renderBilling==='function')renderBilling();
 }
 async function poll(){
  if(ui.scope!==scope()){reset();ui.scope=scope();}
  if(!allowed()||!visible()||!relevant()){schedule();return;}
  if(ui.flight)return ui.flight.promise;
  if(editing()||storeContentSyncFlight){schedule();return;}
  const delay=ui.failures?Math.min(MAX_BACKOFF,INTERVAL*2**ui.failures):INTERVAL;
  if(ui.lastAttempt&&Date.now()-ui.lastAttempt<delay){schedule();return;}
  const key=scope(),controller=new AbortController(),flight={promise:null,cancel:null};let timer,rejectDeadline;
  const deadline=new Promise((_,reject)=>{rejectDeadline=reject;});
  flight.cancel=()=>{controller.abort();rejectDeadline(Object.assign(Error('Загрузка отменена.'),{code:'AUTO_CANCELLED'}));};
  ui.flight=flight;ui.lastAttempt=Date.now();
  const current=()=>ui.flight===flight&&key===scope()&&allowed()&&!controller.signal.aborted;
  timer=window.setTimeout(()=>{rejectDeadline(Error('Сервер не ответил вовремя. Повторим автоматически.'));controller.abort();},DEADLINE);
  flight.promise=(async()=>{
   try{
    const since=loaded()&&String(state.storeContent.storeId)===String(selectedStore().id)?'&since='+encodeURIComponent(state.storeContent.observedAt):'';
    const data=await Promise.race([apiRequest('/api/v1/funpay/content/latest?storeId='+encodeURIComponent(selectedStore().id)+since,{authenticated:true,signal:controller.signal}),deadline]);
    if(!current())return;
    if(data?.schema!==1||data.workspaceId!==authState.workspace?.id||String(data.storeId)!==String(selectedStore()?.id))throw Error('Сервис не подтвердил данные этого магазина.');
    ui.health=data.sync||null;ui.error='';ui.failures=0;
    // Do not replace an editor opened while the request was in flight.
    if(visible()&&!editing()&&!storeContentSyncFlight)apply(data);
    await finance();
   }catch(error){
    if(key===scope()&&ui.flight===flight&&error.code!=='AUTO_CANCELLED'){
     ui.failures=Math.min(3,ui.failures+1);ui.error=error.code==='HTTP_404'?'Для автообновления обновите серверную часть.':error.code==='PLAN_REQUIRED'?'Подписка завершена. Выберите тариф.':'Не удалось получить новые данные. Повторим автоматически.';
     if(['PLAN_REQUIRED','INVALID_STATE','AUTH_REJECTED','CAPTCHA_REQUIRED'].includes(error.code))void Promise.allSettled([subscriptionLoad(),loadOnboarding(),loadStoreFleet()]);
    }
   }finally{window.clearTimeout(timer);controller.abort();if(ui.flight===flight){ui.flight=null;schedule();}}
  })();
  return flight.promise;
 }
 // Retire the older per-view live FunPay polling; manual refresh keeps its policy.
 if(typeof stopMessagesPolling==='function')stopMessagesPolling();
 if(typeof updateMessagesPolling==='function')updateMessagesPolling=()=>{stopMessagesPolling();};
 const oldReset=resetAccountData;resetAccountData=function(...args){reset();const result=oldReset.apply(this,args);status();return result;};
 const oldView=setView;setView=function(...args){const result=oldView.apply(this,args);void poll();return result;};
 const oldFleet=renderStoreFleet;renderStoreFleet=function(...args){const result=oldFleet.apply(this,args);schedule();return result;};
 window.ZetSlayAutoRefresh={refresh:poll,diagnostics:()=>({version:'20261016-background-snapshots',enabled:allowed(),visible:visible(),pending:!!ui.flight,failures:ui.failures,intervalSeconds:15,lastCheckAt:ui.lastAttempt||null,lastSnapshotAt:state.storeContent?.observedAt||null})};
 const diagnostics=window.zetslaySyncDiagnostics;if(diagnostics)window.zetslaySyncDiagnostics=()=>({...diagnostics(),automatic:window.ZetSlayAutoRefresh.diagnostics()});
 document.addEventListener('visibilitychange',()=>{if(visible())void poll();else{stop();status();}});
 window.addEventListener('online',()=>{ui.lastAttempt=0;void poll();});
 window.addEventListener('offline',()=>{stop();status();});
 // No requests on page close. The server worker continues independently.
 window.addEventListener('pagehide',reset);window.addEventListener('pageshow',()=>{void poll();});
 void poll();
})();
