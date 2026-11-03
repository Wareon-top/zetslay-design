/* Current problems are independent from the notification read state. Navigation only. */
(()=>{
 if(typeof authState==='undefined'||typeof apiRequest!=='function'||!document.querySelector('.view-stack'))return;
 const scope=()=>authState.user?.id&&authState.token?{userId:authState.user.id,workspaceId:authState.workspace?.id||'',session:sessionGeneration,storeId:String(selectedStore()?.id||'')}:null;
 let panel,timer;
 const feed=createDiagnosticsFeed({scope,request:apiRequest,changed(){panel?.render();renderSummary();}});
 function active(){return document.querySelector('[data-view="diagnostics"]')?.classList.contains('is-active');}
 function navigate(issue){
  if(issue.storeId&&selectedStore()?.id&&String(selectedStore().id)!==issue.storeId){showToast('Подключение изменилось. Обновите диагностику.','error');return;}
  const action=issue.action;
  if(action.view==='connect'){setModal(true);return;}
  if(action.view==='proxy-shop'){if(typeof proxyShopOpen==='function')void proxyShopOpen();return;}
  if(action.view==='store-tools'){if(typeof storeToolsRoute==='function')storeToolsRoute(action.tab);else setView('store-tools');return;}
  if(action.view==='plugins'){setView('plugins/'+action.pluginId);return;}
  if(action.view==='orders'){
   setView('orders');if(typeof ordersPageState==='undefined')return;renderOrderWorkspace();Object.assign(ordersPageState,{detailId:issue.orderId,query:'',status:'all',period:'all',currency:'all'});renderOrderWorkspace();const dialog=document.querySelector('[data-order-dialog]');if(dialog&&ordersPageState.detailId&&!dialog.open)dialog.showModal();else showToast('Заказ пока не найден в загруженной истории. Обновите список заказов.','error');return;
  }
  setView('billing');
 }
 function renderSummary(target){
  const host=target||document.querySelector('[data-diagnostics-summary]')||document.querySelector('[data-ws-tasks]');if(!host)return false;
  const s=feed.state,data=s.dataKey===feed.key()?s.data:null;
  host.classList.add('dc-summary');
  const count=data?.counts;host.innerHTML='<div><h2>Проблемы магазина</h2><p>'+diagnosticsEscape(!scope()?'Войдите, чтобы проверить состояние своего магазина.':s.error?'Диагностика не обновилась. Проверьте последнее состояние.':!data?'Текущая проверка ещё не получена.':!data.complete?'Часть источников не проверена.':count.total?'Сначала проверьте неизвестные исходы и остановленные операции.':'По проверенным состояниям проблем не обнаружено.')+'</p></div><button type="button" data-diagnostics-open>'+(!data?'Проверить состояние':count.critical?'Проверить исход: '+count.critical:'Открыть диагностику'+(count.total?' · '+count.total:''))+' →</button>';return true;
 }
 function ensureSummary(){const overview=document.querySelector('[data-overview]');if(!overview)return;if(!overview.querySelector('[data-ws-tasks],[data-diagnostics-summary]')){const host=document.createElement('section');host.dataset.diagnosticsSummary='';overview.querySelector('.overview-heading')?.after(host);}renderSummary();}
 function arm(){clearTimeout(timer);if(scope()&&(active()||document.querySelector('[data-view="dashboard"]')?.classList.contains('is-active'))&&!document.hidden)timer=setTimeout(()=>void feed.load().finally(arm),30000);}
 const root=document.createElement('section');root.className='view';root.dataset.view='diagnostics';root.hidden=true;root.setAttribute('aria-label','Проблемы магазина');document.querySelector('.view-stack').append(root);viewTitles.diagnostics='Проблемы магазина';panel=mountDiagnosticsCenter(root,{feed,navigate});
 const button=document.createElement('button');button.type='button';button.className='nav-item';button.dataset.viewTarget='diagnostics';button.innerHTML=icon('help')+'<span>Проблемы магазина</span>';const anchor=document.querySelector('[data-view-target="events"]')||document.querySelector('[data-view-target="dashboard"]');anchor?.after(button);
 window.ZetSlayDiagnostics=Object.freeze({renderSummary});
 const previousView=setView;setView=function(name,...args){const result=previousView.call(this,name,...args);if(JSON.stringify(feed.state.scope)!==JSON.stringify(scope()))feed.reset();if(name==='diagnostics'){panel.render();void feed.load();}if(name==='dashboard'){ensureSummary();void feed.load();}arm();return result;};
 const previousOverview=renderOverview;renderOverview=function(...args){const result=previousOverview.apply(this,args);if(JSON.stringify(feed.state.scope)!==JSON.stringify(scope())){feed.reset();if(scope())void feed.load();}ensureSummary();arm();return result;};
 const previousReset=resetAccountData;resetAccountData=function(...args){clearTimeout(timer);feed.reset();panel.render();return previousReset.apply(this,args);};
 document.addEventListener('click',event=>{if(event.target.closest('[data-diagnostics-open]'))setView('diagnostics');});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&scope()&&active())void feed.load();arm();});
 ensureSummary();if(location.hash.slice(1)==='diagnostics')setView('diagnostics',false);else if(scope())void feed.load();arm();
})();
