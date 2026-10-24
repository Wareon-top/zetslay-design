/* Purchases use the ZetSlay wallet. Supplier credentials never enter this module. */
const proxyShopUi={scope:'',epoch:0,loadRevision:0,resetting:false,data:null,catalog:null,loading:false,busy:false,error:'',quote:null,request:null,unknown:false,kind:'issue',nodeId:'',resourceId:'',months:1,modalOpId:'',activeAction:'',poll:null};
const proxyShopScope=()=>authState.user?.id&&authState.token?`${authState.user.id}:${authState.token}:${typeof sessionGeneration==='number'?sessionGeneration:0}`:'';
const proxyShopMoney=n=>Number.isSafeInteger(n)?new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:0,maximumFractionDigits:2}).format(n/100):'—';
const proxyShopCountryName=code=>({DE:'Германия',NL:'Нидерланды',FI:'Финляндия',TR:'Турция',US:'США',KZ:'Казахстан'})[code]||'';
const proxyShopLocationName=location=>proxyShopCountryName(location?.country)||location?.title||'Локация';
const proxyShopSafe=v=>escapeHtml(String(v??''));
const proxyShopDate=v=>Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'Уточняется';
const proxyShopLabels={reserved:'Средства зарезервированы',ordering:'Получаем адрес',extending:'Продлеваем срок',supplier_received:'Прокси получен',checking:'Проверяем FunPay',review_required:'Уточняем результат',delivered:'Готово',refunded:'Средства возвращены'};
function proxyShopReset(){if(typeof document!=='undefined')proxyShopClose(false);clearTimeout(proxyShopUi.poll);proxyShopUi.epoch++;Object.assign(proxyShopUi,{scope:'',data:null,catalog:null,loading:false,busy:false,error:'',quote:null,request:null,unknown:false,kind:'issue',nodeId:'',resourceId:'',months:1,modalOpId:'',activeAction:'',poll:null});if(typeof document!=='undefined')document.querySelectorAll('[data-proxy-store]').forEach(root=>root.replaceChildren());if(typeof document!=='undefined')document.querySelectorAll('[data-proxy-invite]').forEach(root=>{root.hidden=false;});}
function proxyShopCurrent(scope,epoch){return scope===proxyShopScope()&&epoch===proxyShopUi.epoch;}
function proxyShopResources(data){return [data?.current,...(data?.candidates||[])].filter(r=>r?.supplier==='steelproxy'&&r.state!=='retired');}
function proxyShopRender(){if(typeof managedProxyRender==='function')managedProxyRender();}
const proxyShopDialog={node:null,opener:null};
const proxyShopGlobeIcon=()=>'<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="23"/><ellipse cx="32" cy="32" rx="10" ry="23"/><path d="M9 32h46M14 18h36M14 46h36"/></svg>';
function proxyShopInviteMarkup(place='dashboard'){
 const guide=place==='guide';
 return `<section class="ps-invite" data-proxy-invite="${guide?'guide':'dashboard'}" aria-label="Прокси от ZetSlay"><div class="ps-invite-visual"><img src="/assets/zetslay-logo.webp?v=20261024-proxy-logo" alt="" width="160" height="160" decoding="async"></div><div class="ps-invite-copy"><header class="ps-invite-header"><h2>Прокси для вашего магазина</h2><p>Купите прокси прямо в ZetSlay. Перед выдачей проверим доступность FunPay.</p></header><button class="ps-invite-close" type="button" data-proxy-invite-dismiss aria-label="Скрыть предложение прокси"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m4 4 8 8m0-8-8 8"/></svg></button><footer class="ps-invite-footer"><div><strong>Оплата с баланса</strong><span>Без автопродления</span></div><button class="ps-invite-buy" type="button" data-proxy-open>Купить прокси</button></footer></div></section>`;
}
function proxyShopMarkup(data){
 if(!proxyShopScope())return '';
 const pending=proxyShopUi.data?.operations?.some(o=>!['delivered','refunded'].includes(o.status));
 const owns=proxyShopResources(data).length>0;
 return `<section class="ps-inline-shop"><div><strong>${pending?'Заказ прокси оформляется':owns?'Прокси от ZetSlay':'Купите прокси у нас'}</strong><p>${pending?'Откройте окно покупки, чтобы увидеть этапы и результат.':owns?'Продление, история покупок и состояние подключения.':'Оплата с баланса сервиса. Перед выдачей проверим доступность FunPay.'}</p></div><button type="button" class="button button--primary" data-proxy-open>${pending?'Посмотреть заказ':owns?'Открыть прокси':'Купить прокси'}</button></section>`;
}
function proxyShopSelectedOperation(){const ui=proxyShopUi,rows=ui.data?.operations||[];return rows.find(o=>o.id===ui.modalOpId)||rows.find(o=>!['delivered','refunded'].includes(o.status))||null;}
function proxyShopProgressModel(operation,{sending=false,unknown=false}={}){
 const status=operation?.status||'',renew=operation?.kind==='renew';
 const stages=renew?['Резервируем оплату','Оформляем продление','Обновляем срок действия','Продление готово']:['Резервируем оплату','Оформляем заказ прокси','Проверяем доступность FunPay','Прокси готов к подключению'];
 const stage=({reserved:1,ordering:1,extending:1,supplier_received:2,checking:2,review_required:1,delivered:4})[status]??0;
 const uncertain=unknown||status==='review_required',refunded=status==='refunded',done=status==='delivered';
 const title=done?(renew?'Прокси продлён':'Прокси куплен'):refunded?'Покупка не завершена':uncertain?'Уточняем результат':stage===2?stages[2]:stage===1?stages[1]:'Оформляем покупку';
 const detail=done?(renew?'Новый срок подтверждён. Адрес прокси сохранён.':'Доступность FunPay проверена. Теперь можно проверить авторизацию и подключить магазин.'):refunded?'Средства возвращены на баланс ZetSlay.':uncertain?'Результат заказа пока не подтверждён. Проверим существующую операцию без новой покупки.':stage===2?(renew?'Сверяем новый срок с заказом.':operation?.checks?.availability?.attempts===1&&operation.checks.availability.status==='passed'?'Первая проверка пройдена. Выполняем повторную.':'Проверяем соединение с FunPay с сервера ZetSlay.'):stage===1?'Оплата зарезервирована. Ожидаем подтверждение заказа.':'Отправляем подтверждённый запрос. Результат оплаты ещё не подтверждён.';
 return {stages,stage,title,detail,done,refunded,uncertain,sending};
}
function proxyShopProgressMarkup(operation){
 const ui=proxyShopUi,m=proxyShopProgressModel(operation,{sending:ui.activeAction==='purchase',unknown:ui.unknown}),data=typeof managedProxyUi!=='undefined'?managedProxyUi.data:null;
 const candidate=data?.candidates?.find(r=>r.id===operation?.resourceId&&!r.expired&&r.state!=='retired');
 const installed=Boolean(operation?.resourceId&&data?.current?.id===operation.resourceId&&data?.operation?.installed&&data.operation.checks?.authorization?.status==='passed'&&data.operation.checks?.readAccess?.status==='passed');
 return `<section class="ps-progress ${m.done?'is-done':m.refunded?'is-refunded':m.uncertain?'is-uncertain':''}" aria-labelledby="ps-progress-title"><div class="ps-progress-hero"><div class="ps-progress-emblem" aria-hidden="true">${m.done?'<svg viewBox="0 0 32 32"><path d="m8 16 5 5L25 9"/></svg>':m.refunded||m.uncertain?'<span>!</span>':'<span class="ps-orbit"></span><svg class="ps-progress-core" viewBox="0 0 32 32"><path d="m16 5-9 4v7c0 6 9 11 9 11s9-5 9-11V9l-9-4Z"/><path d="m12 16 3 3 5-6"/></svg>'}</div><div class="ps-progress-intro" role="status" aria-live="polite" aria-atomic="true"><span class="ps-eyebrow">${m.done?'ГОТОВО':m.refunded?'ВОЗВРАТ НА БАЛАНС':m.uncertain?'ПРОВЕРКА РЕЗУЛЬТАТА':'ОФОРМЛЕНИЕ ПРОКСИ'}</span><h3 id="ps-progress-title">${m.title}</h3><p>${m.detail}</p></div><div class="ps-progress-position">${m.done?'Все этапы подтверждены':m.refunded?'Средства возвращены':m.uncertain?'Ожидаем подтверждение результата':'Этап '+Math.min(m.stage+1,4)+' из 4'}</div><div class="ps-progress-track" aria-hidden="true">${m.stages.map((_,i)=>`<span class="${!m.refunded&&i<m.stage?'is-complete':!m.done&&!m.refunded&&i===m.stage?'is-active':''}"></span>`).join('')}</div></div>
 <ol class="ps-progress-steps">${m.stages.map((title,index)=>{const complete=!m.refunded&&index<m.stage,active=!m.done&&!m.refunded&&index===m.stage;return `<li class="${complete?'is-complete':active?'is-active':''}" ${active?'aria-current="step"':''}><span class="ps-step-mark" aria-hidden="true">${complete?'✓':index+1}</span><div><strong>${title}</strong><small>${complete?'Подтверждено':active?m.uncertain?'Ожидаем подтверждение':'Выполняется':m.refunded?'Не завершено':'Следующий этап'}</small></div>${active&&!m.uncertain?'<i class="ps-step-spinner" aria-hidden="true"></i>':''}</li>`;}).join('')}</ol>
 ${operation?`<div class="ps-order-receipt"><span>${operation.kind==='renew'?'Продление':'Покупка'} · ${proxyShopSafe(proxyShopCountryName(operation.country)||operation.country)} · ${operation.months*30} дней</span><strong>${proxyShopMoney(operation.priceMinor)}</strong>${operation.expiresAt?`<small>Срок до ${proxyShopDate(operation.expiresAt)}</small>`:''}<small>Заказ № ${proxyShopSafe(operation.id.slice(0,8))}</small></div>`:''}
 ${m.done&&operation?.kind!=='renew'?`<div class="ps-activation"><h4>${installed?'Магазин подключён':'Подключение магазина'}</h4><p>${installed?'Авторизация и чтение данных подтверждены.':candidate?'Адрес готов. Проверим Golden Key и доступ к заказам и чатам перед подключением.':'Обновляем данные выданного прокси. Если настройка магазина ещё не завершена, продолжите мастер.'}</p>${candidate?`<button class="button button--primary" type="button" data-mp-action="activate" data-resource-id="${proxyShopSafe(candidate.id)}" ${managedProxyUi.busy||!data.canActivate?'disabled':''}>${managedProxyUi.busy?'Проверяем подключение…':'Проверить и подключить'}</button>`:''}${!installed?'<button class="ps-text-button" type="button" data-ps-wizard>Продолжить настройку магазина →</button>':''}${(managedProxyUi.busy||installed||managedProxyUi.error)&&typeof managedProxyChecks==='function'?managedProxyChecks(data?.operation?.checks):''}${managedProxyUi.error?`<p class="mp-error" role="alert">${proxyShopSafe(managedProxyUi.error)}</p>`:''}</div>`:''}
 ${m.uncertain||operation&&!m.done&&!m.refunded?`<button class="button button--ghost" type="button" ${operation?'data-ps-reconcile="'+proxyShopSafe(operation.id)+'"':'data-ps-refresh'} ${ui.busy?'disabled':''}>Проверить результат</button>`:''}
 ${ui.unknown&&!operation&&ui.request?'<button class="ps-text-button" type="button" data-ps-repeat>Повторить тот же запрос</button><p class="ps-progress-note">Будет использован тот же номер операции, без создания нового заказа.</p>':''}
 ${m.refunded?'<button class="button button--primary" type="button" data-ps-new>Вернуться к выбору</button>':''}
 ${ui.error?`<p class="mp-error" role="alert">${proxyShopSafe(ui.error)}</p>`:''}
 ${!m.done&&!m.refunded?'<p class="ps-progress-note">Закрытие окна не отменяет отправленный запрос. Результат можно проверить здесь.</p>':''}</section>`;
}
function proxyShopModalMarkup(data){
 const ui=proxyShopUi,op=proxyShopSelectedOperation();
 if(op||ui.activeAction==='purchase'||ui.unknown)return proxyShopProgressMarkup(op);
 const locations=ui.catalog?.locations||[],offer=locations.find(l=>String(l.nodeId)===ui.nodeId)||locations[0],ready=ui.data?.enabled&&offer;
 const candidate=data?.candidates?.find(r=>!r.expired&&r.state!=='retired');
 return `<div class="ps-modal-product"><span class="ps-product-globe" aria-hidden="true">${proxyShopGlobeIcon()}</span><div><span class="ps-eyebrow">ПРОКСИ ДЛЯ FUNPAY</span><h3>${proxyShopSafe(ready?proxyShopLocationName(offer):ui.data?.enabled===false?'Продажа недоступна':'Загружаем локации')}</h3><span class="ps-product-term">Без автопродления</span></div><div class="ps-product-price"><strong>${ready?proxyShopMoney(offer.monthlyPriceMinor):'—'}</strong><span>за 30 дней</span></div></div>
 <div class="ps-modal-benefits"><span><i aria-hidden="true">✓</i> Проверка FunPay перед выдачей</span><span><i aria-hidden="true">✓</i> Оплата с баланса сервиса</span></div><div class="ps-modal-balance"><span class="ps-balance-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/></svg></span><span>Баланс ZetSlay <strong>${proxyShopMoney(ui.data?.balanceMinor)}</strong></span><button type="button" class="ps-text-button" data-ps-topup ${ui.busy?'disabled':''}>Пополнить ↗</button></div>
 ${data?.current?`<div class="ps-current-note"><span>${data.current.expired?'Срок текущего прокси истёк':'Ваш текущий прокси'}</span><strong>До ${proxyShopDate(data.current.expiresAt)}</strong></div>`:''}
 ${candidate?`<div class="ps-activation"><h4>Прокси ожидает подключения</h4><p>Проверьте авторизацию магазина и завершите подключение.</p><button class="button button--primary" type="button" data-mp-action="activate" data-resource-id="${proxyShopSafe(candidate.id)}" ${managedProxyUi.busy||!data.canActivate?'disabled':''}>Проверить и подключить</button><button class="ps-text-button" type="button" data-ps-wizard>Продолжить настройку магазина →</button></div>`:''}
 ${data?proxyShopCheckoutMarkup(data):`<div class="ps-modal-loading" role="status"><span class="ps-step-spinner" aria-hidden="true"></span><p>${proxyShopSafe(managedProxyUi.error||'Проверяем доступность покупки…')}</p><button class="ps-text-button" type="button" data-ps-refresh>Повторить</button></div>`}
 ${ui.activeAction==='quote'?'<p class="ps-quote-loading" role="status"><i class="ps-step-spinner" aria-hidden="true"></i> Рассчитываем итоговую стоимость…</p>':''}
 ${data?.activePlan===false?'<button class="ps-text-button" type="button" data-ps-plan>Выбрать тариф для подключения →</button>':''}
 <p class="ps-modal-footnote">Прокси оплачивается отдельно от подписки. Авторизация магазина проверяется при подключении.</p>`;
}
function renderProxyShopModal(){
 const dialog=proxyShopDialog.node;if(!dialog?.open)return;
 if(!proxyShopScope()){proxyShopClose(false);return;}
 const body=dialog.querySelector('[data-ps-modal-body]'),active=document.activeElement;
 const field=body.contains(active)&&active?.name?active.name:null;
 body.innerHTML=proxyShopModalMarkup(managedProxyUi.data);
 dialog.dataset.busy=proxyShopUi.busy?'true':'false';
 if(field){const replacement=body.querySelector(`[name="${field}"]`);if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});}
}
function proxyShopClose(restore=true){
 const dialog=proxyShopDialog.node;proxyShopDialog.node=null;if(!dialog)return;
 if(dialog.open)dialog.close();dialog.remove();
 if(restore&&proxyShopScope()&&proxyShopDialog.opener?.isConnected)proxyShopDialog.opener.focus({preventScroll:true});
 proxyShopDialog.opener=null;
}
async function proxyShopPrepareQuote(){
 const ui=proxyShopUi,data=typeof managedProxyUi!=='undefined'?managedProxyUi.data:null;
 if(!proxyShopDialog.node?.open||ui.busy||ui.unknown||proxyShopSelectedOperation()||!ui.data?.enabled||!data)return;
 const renew=ui.kind==='renew'&&proxyShopResources(data).length>0;
 if(!renew&&(data.candidates?.some(r=>!r.expired&&r.state!=='retired')||!data.activePlan))return;
 const offer=ui.catalog?.locations?.find(l=>String(l.nodeId)===ui.nodeId)||ui.catalog?.locations?.[0],resource=proxyShopResources(data).find(r=>r.id===ui.resourceId)||proxyShopResources(data)[0];
 if(!renew&&!offer)return;
 await proxyShopAction('quote',{kind:renew?'renew':data.current||data.configured?'replace':'issue',months:ui.months,...(renew?{resourceId:resource.id}:{nodeId:offer.nodeId})});
}
async function proxyShopOpen(opener){
 if(!proxyShopScope())return;
 if(proxyShopDialog.node?.open)return;
 proxyShopDialog.opener=opener||document.activeElement;
 if(typeof setModal==='function')setModal(false);
 const ui=proxyShopUi,data=managedProxyUi.data;
 if(!ui.busy&&!ui.unknown){ui.modalOpId='';ui.kind=data?.current?.supplier==='steelproxy'?'renew':'issue';ui.quote=null;ui.request=null;}
 const dialog=document.createElement('dialog');dialog.className='ps-purchase-dialog';dialog.setAttribute('aria-labelledby','ps-modal-title');
 dialog.innerHTML='<div class="ps-dialog-shell"><header class="ps-dialog-header"><div><span class="ps-eyebrow">ZETSLAY / ПРОКСИ</span><h2 id="ps-modal-title">Прокси для вашего магазина</h2></div><button class="ps-dialog-close" type="button" data-ps-close aria-label="Закрыть окно покупки">×</button></header><div data-ps-modal-body class="ps-dialog-body"></div></div>';
 dialog.addEventListener('close',()=>{if(proxyShopDialog.node===dialog)proxyShopClose();});
 dialog.addEventListener('click',e=>{if(e.target===dialog)proxyShopClose();});
 proxyShopDialog.node=dialog;document.body.append(dialog);dialog.showModal();renderProxyShopModal();
 const scope=proxyShopScope(),epoch=ui.epoch;
 await Promise.all([managedProxyLoad(),proxyShopLoad({catalog:true})]);
 if(!proxyShopCurrent(scope,epoch)||proxyShopDialog.node!==dialog)return;
 if(!ui.busy&&!ui.unknown&&!proxyShopSelectedOperation()){
  const candidate=managedProxyUi.data?.candidates?.[0],delivered=ui.data?.operations?.find(o=>o.status==='delivered'&&candidate?.id===o.resourceId);
  if(delivered)ui.modalOpId=delivered.id;
  else if(managedProxyUi.data?.current?.supplier==='steelproxy')ui.kind='renew';
 }
 renderProxyShopModal();await proxyShopPrepareQuote();
}
function proxyShopInstallPage(){
 document.querySelectorAll('.sidebar-nav [data-view-target="proxy-shop"]').forEach(n=>n.remove());
 document.querySelectorAll('[data-proxy-store]').forEach(n=>n.remove());
 for(const [place,selector]of [['dashboard','[data-overview] .overview-heading'],['guide','[data-knowledge-base] .kb-heading']]){
  const anchor=document.querySelector(selector);if(anchor&&!document.querySelector(`[data-proxy-invite="${place}"]`))anchor.insertAdjacentHTML('afterend',proxyShopInviteMarkup(place));
 }
 if(typeof setView==='function'){const navigate=setView;setView=function(view,...args){if(view==='proxy-shop'){const result=navigate.call(this,'dashboard',...args);void proxyShopOpen();return result;}return navigate.call(this,view,...args);};}
 if(typeof renderProfile==='function'){const profile=renderProfile;renderProfile=function(...args){const result=profile.apply(this,args),root=document.querySelector('[data-profile]');if(root&&proxyShopScope()&&!root.querySelector('[data-proxy-entry]')){const entry=document.createElement('div');entry.className='ps-profile-entry';entry.dataset.proxyEntry='';entry.innerHTML='<div><strong>Прокси для вашего магазина</strong><p>Покупка, продление и проверка подключения</p></div><button class="button button--ghost" type="button" data-proxy-open>Открыть прокси →</button>';const hero=root.querySelector('.profile-hero');if(hero)hero.after(entry);else root.prepend(entry);}return result;};}
 if(location.hash==='#proxy-shop'){setView('dashboard');if(proxyShopScope())void proxyShopOpen();}
}
function proxyShopOperation(o){
 const pending=!['delivered','refunded'].includes(o.status),success=o.status==='delivered';
 return `<article class="ps-operation ${success?'is-complete':''}"><header><strong>${proxyShopSafe(proxyShopLabels[o.status]||'Уточняем результат')}</strong><span>${proxyShopMoney(o.priceMinor)}</span></header><p>${o.kind==='renew'?'Продление':o.kind==='replace'?'Новый адрес':'Покупка прокси'} · ${proxyShopSafe(proxyShopCountryName(o.country)||o.country)} · ${o.months*30} дней${o.expiresAt?' · до '+proxyShopDate(o.expiresAt):''}</p>${success?`<small>${o.kind==='renew'?'Срок продлён у поставщика. Дата в кабинете обновлена.':'FunPay доступен с сервера ZetSlay. Для подключения нажмите «Проверить и подключить» выше — авторизация магазина проверяется отдельно.'}</small>`:o.status==='refunded'?'<small>Сумма возвращена на внутренний баланс ZetSlay. Повторного списания нет.</small>':'<small>Повторная покупка не запускается. Сумма зарезервирована до подтверждения результата.</small>'}${pending?`<button type="button" class="ps-text-button" data-ps-reconcile="${proxyShopSafe(o.id)}" ${proxyShopUi.busy?'disabled':''}>Проверить результат</button>`:''}<span class="ps-operation-id">№ ${proxyShopSafe(o.id.slice(0,8))} · ${proxyShopDate(o.createdAt)}</span></article>`;
}
function proxyShopCheckoutMarkup(data){
 const ui=proxyShopUi,status=ui.data;if(!proxyShopScope()||proxyShopUi.resetting)return '';
 if(!status)return `<section class="proxy-shop"><header><h3>Купить прокси</h3></header><p>${proxyShopSafe(ui.error||'Проверяем доступность покупки…')}</p>${ui.error?'<button type="button" class="ps-text-button" data-ps-refresh>Повторить проверку</button>':''}</section>`;
 const pending=status.operations?.find(o=>!['delivered','refunded'].includes(o.status));
 const resources=proxyShopResources(data),locations=ui.catalog?.locations||[],canRenew=resources.length>0;
 const awaitingConnection=data.candidates?.some(r=>!r.expired&&r.state!=='retired');
 const kind=ui.kind==='renew'&&canRenew?'renew':data.current||data.configured?'replace':'issue';
 const latest=status.operations?.[0],recent=latest&&['delivered','refunded'].includes(latest.status)&&Date.now()-Date.parse(latest.createdAt)<10*60000?latest:null;
 const q=ui.quote,locked=ui.busy||!!pending||ui.unknown,price=locations.find(l=>String(l.nodeId)===ui.nodeId)?.monthlyPriceMinor??locations[0]?.monthlyPriceMinor;
 return `<section class="proxy-shop" aria-label="Покупка прокси"><header><div><h3>${kind==='renew'?'Продлить прокси':'Купить прокси'}</h3><p>Оплата с внутреннего баланса ZetSlay. Автопродления нет.</p></div><span class="ps-wallet">Баланс <strong>${proxyShopMoney(status.balanceMinor)}</strong><button type="button" class="ps-text-button" data-ps-topup ${ui.busy?'disabled':''}>Пополнить</button></span></header>
 ${recent&&!pending?proxyShopOperation(recent):''}
 ${!status.enabled?'<p class="ps-hint">Продажа временно недоступна. История покупок и срок уже выданного прокси сохраняются.</p>':pending?proxyShopOperation(pending):awaitingConnection&&ui.kind!=='renew'?`<p class="ps-hint">Прокси уже приобретён и ожидает подключения. Нажмите «Проверить и подключить» выше.</p>${canRenew?'<button class="ps-text-button" type="button" data-ps-kind="renew">Продлить этот прокси</button>':''}`:`<form data-ps-selection><fieldset ${locked?'disabled':''}>${canRenew?`<div class="ps-kind" role="group" aria-label="Действие с прокси"><button type="button" data-ps-kind="renew" aria-pressed="${kind==='renew'}">Продлить</button><button type="button" data-ps-kind="${data.current||data.configured?'replace':'issue'}" aria-pressed="${kind!=='renew'}">Купить ${data.current?'новый адрес':'прокси'}</button></div>`:''}<div class="ps-fields">${kind==='renew'?`<label>Ваш прокси<select name="resourceId">${resources.map(r=>`<option value="${proxyShopSafe(r.id)}" ${ui.resourceId===r.id?'selected':''}>${proxyShopSafe(r.label)} · до ${proxyShopDate(r.expiresAt)}</option>`).join('')}</select></label>`:`<label>Локация<select name="nodeId" ${!locations.length?'disabled':''}>${locations.map(l=>`<option value="${l.nodeId}" ${String(l.nodeId)===ui.nodeId?'selected':''}>${proxyShopSafe(proxyShopLocationName(l))}</option>`).join('')||'<option>Нет доступных адресов</option>'}</select></label>`}<label>Срок<select name="months">${[1,2,3,6].map(n=>`<option value="${n}" ${ui.months===n?'selected':''}>${n*30} дней${kind==='renew'?' к текущему сроку':''}</option>`).join('')}</select></label></div>
 ${kind==='renew'?'<p class="ps-hint">Продлевается тот же прокси. Дата окончания изменится после подтверждения поставщика.</p>':'<p class="ps-hint">Перед выдачей дважды проверим доступность FunPay с нашего сервера. Если проверка не пройдёт, сумма вернётся на ваш баланс.</p>'}
 ${kind==='replace'?'<p class="ps-hint">Новый адрес оплачивается отдельно. Текущее подключение сохранится до проверки и подключения нового.</p>':''}
 <div class="ps-selection-footer"><span>${Number.isSafeInteger(price)&&kind!=='renew'?proxyShopMoney(price)+' / 30 дней':'Сумма появится в расчёте'}</span><button class="button button--primary" type="submit" ${locked||kind!=='renew'&&!locations.length||kind!=='renew'&&!data.activePlan?'disabled':''}>${ui.busy?'Проверяем…':q?'Обновить расчёт':'Рассчитать стоимость'}</button></div>${!data.activePlan&&kind!=='renew'?'<p class="ps-hint">Для нового подключения активируйте пробный период или подписку.</p>':''}</fieldset></form>`}
 ${q&&!pending&&status.enabled?`<form class="ps-quote" data-ps-purchase><div><span>${q.kind==='renew'?'Продление':'Новый прокси'} · ${proxyShopSafe(proxyShopCountryName(q.country)||q.country)} · ${q.termDays} дней</span><strong>${proxyShopMoney(q.totalMinor)}</strong></div>${q.extendedExpiresAt?`<p>Новый срок: до ${proxyShopDate(q.extendedExpiresAt)}</p>`:''}<p>Расчёт действует до ${proxyShopDate(q.expiresAt)}. Оплата только с баланса ZetSlay.</p><label class="ps-consent"><input type="checkbox" name="confirmed" required ${ui.busy?'disabled':''}><span>Подтверждаю покупку и принимаю <a href="../legal/terms.html" target="_blank" rel="noopener">условия сервиса</a> и <a href="../legal/refunds.html" target="_blank" rel="noopener">правила оплаты и возвратов</a>.</span></label><button class="button button--primary" type="submit" ${locked||ui.unknown||status.balanceMinor<q.totalMinor?'disabled':''}>${ui.busy?'Выполняем покупку…':'Оплатить с баланса · '+proxyShopMoney(q.totalMinor)}</button>${status.balanceMinor<q.totalMinor?'<button class="ps-text-button" type="button" data-ps-topup>Пополнить баланс через Platega</button>':''}${ui.unknown?'<button class="ps-text-button" type="button" data-ps-refresh>Проверить результат покупки</button><button class="ps-text-button" type="button" data-ps-repeat>Повторить тот же запрос</button>':''}</form>`:''}
 ${ui.error?`<p class="mp-error" role="alert">${proxyShopSafe(ui.error)}</p>`:''}
 ${status.operations?.length?`<details class="ps-history"><summary>История покупок · ${status.operations.length}</summary>${status.operations.slice(0,10).filter(o=>o.id!==pending?.id).map(proxyShopOperation).join('')}</details>`:''}
 <footer><button class="ps-text-button" type="button" data-ps-refresh ${ui.loading||ui.busy?'disabled':''}>Обновить покупки</button><a href="https://t.me/zetslaysupport" target="_blank" rel="noopener">Помощь с прокси ↗</a></footer></section>`;
}
async function proxyShopLoad({catalog=false}={}){
 const scope=proxyShopScope();if(!scope||proxyShopUi.resetting)return;
 if(proxyShopUi.scope&&proxyShopUi.scope!==scope)proxyShopReset();
 if(proxyShopUi.loading)return;
 const epoch=proxyShopUi.epoch,revision=++proxyShopUi.loadRevision;const current=()=>proxyShopCurrent(scope,epoch)&&revision===proxyShopUi.loadRevision;proxyShopUi.scope=scope;proxyShopUi.loading=true;
 try{
  const data=await apiRequest('/api/v1/proxy-shop',{authenticated:true});if(!current())return;
  if(!Array.isArray(data.operations)||!Number.isSafeInteger(data.balanceMinor)||typeof data.enabled!=='boolean')throw Error('Не удалось подтвердить покупки прокси');
  const trackedId=proxyShopUi.request?.requestId||proxyShopUi.modalOpId,previous=proxyShopUi.data?.operations?.find(o=>o.id===trackedId)?.status;
  proxyShopUi.data=data;
  if(trackedId){const o=data.operations.find(x=>x.id===trackedId);if(o){proxyShopUi.unknown=false;if(['delivered','refunded'].includes(o.status)){proxyShopUi.quote=null;proxyShopUi.request=null;if(previous!==o.status&&typeof managedProxyLoad==='function')void managedProxyLoad();}}}
  if(data.enabled&&(catalog||!proxyShopUi.catalog)){const list=await apiRequest('/api/v1/proxy-shop/catalog',{authenticated:true});if(!current())return;proxyShopUi.catalog=list;}
  if(!current())return;proxyShopUi.error='';
 }catch(e){if(current())proxyShopUi.error=e.code==='HTTP_404'?'Сначала установите серверное обновление продажи прокси.':e.message||'Покупки временно недоступны';}
 finally{if(current()){proxyShopUi.loading=false;proxyShopRender();proxyShopPoll();}}
}
function proxyShopPoll(){clearTimeout(proxyShopUi.poll);if(proxyShopUi.activeAction==='purchase'||proxyShopUi.unknown||proxyShopUi.data?.operations?.some(o=>!['delivered','refunded'].includes(o.status)))proxyShopUi.poll=setTimeout(()=>proxyShopLoad(),proxyShopUi.activeAction==='purchase'?2000:5000);}
async function proxyShopAction(action,body){
 const scope=proxyShopScope();if(!scope||proxyShopUi.busy)return;const epoch=proxyShopUi.epoch;
 proxyShopUi.loadRevision++;proxyShopUi.loading=false;proxyShopUi.busy=true;proxyShopUi.activeAction=action;if(action==='purchase')proxyShopUi.modalOpId=body.requestId;proxyShopUi.error='';proxyShopRender();proxyShopPoll();
 try{
  const result=await apiRequest('/api/v1/proxy-shop/'+action,{method:'POST',body,authenticated:true,signal:AbortSignal.timeout(200000)});
  if(!proxyShopCurrent(scope,epoch))return;
  if(action==='quote'){
   const q=result.quote; if(!q||!Number.isSafeInteger(q.totalMinor)||q.totalMinor<=0||q.currency!=='RUB'||!Number.isFinite(Date.parse(q.expiresAt)))throw Error('Не удалось подтвердить стоимость');
   proxyShopUi.quote=q;proxyShopUi.request={requestId:crypto.randomUUID(),quoteId:q.id,confirmed:true,legalVersion:result.publication?.version,publicationHash:result.publication?.hash};proxyShopUi.unknown=false;
   if(Number.isSafeInteger(result.balanceMinor)&&proxyShopUi.data)proxyShopUi.data.balanceMinor=result.balanceMinor;
  }else{
   if(result.operation&&proxyShopUi.data){const rows=proxyShopUi.data.operations||[],old=rows.find(o=>o.id===result.operation.id);if(!old||!['delivered','refunded'].includes(old.status))proxyShopUi.data.operations=[result.operation,...rows.filter(o=>o.id!==result.operation.id)];}
   if(typeof managedProxyLoad==='function')await managedProxyLoad();if(!proxyShopCurrent(scope,epoch))return;
   if(typeof paymentsRefresh==='function')void paymentsRefresh();
  }
 }catch(e){if(proxyShopCurrent(scope,epoch)){if(action==='purchase'&&proxyShopUi.data?.operations?.some(o=>o.id===body.requestId&&['delivered','refunded'].includes(o.status))){proxyShopUi.unknown=false;proxyShopUi.error='';}else if(action==='purchase'&&['INVALID_INPUT','PLAN_REQUIRED','INSUFFICIENT_BALANCE','PROXY_PRICE_CHANGED','PROXY_QUOTE_EXPIRED','PROXY_NODE_CHECKING','PROXY_PURCHASE_PENDING'].includes(e.code)){proxyShopUi.error=e.message||'Покупка не выполнена';proxyShopUi.unknown=false;proxyShopUi.modalOpId='';if(['PROXY_PRICE_CHANGED','PROXY_QUOTE_EXPIRED','INVALID_INPUT'].includes(e.code)){proxyShopUi.quote=null;proxyShopUi.request=null;}}else if(action==='purchase'){proxyShopUi.unknown=true;proxyShopUi.error='Ответ покупки не получен. Обновите покупки: проверим сохранённый результат.';}else proxyShopUi.error=e.message||'Не удалось выполнить действие';}}
 finally{if(proxyShopCurrent(scope,epoch)){proxyShopUi.busy=false;proxyShopUi.activeAction='';if(action!=='quote'){const message=proxyShopUi.error,uncertain=proxyShopUi.unknown;await proxyShopLoad();if(proxyShopCurrent(scope,epoch)&&message&&(!uncertain||proxyShopUi.unknown))proxyShopUi.error=message;}if(proxyShopCurrent(scope,epoch)){proxyShopRender();proxyShopPoll();}}}
}
function proxyShopAdminMarkup(data){
 if(!data)return '';
 const s=data.summary||{};return `<section class="mp-card proxy-shop-admin"><header><div><h2>Продажи прокси</h2><p>Последние 100 операций · без комиссий Platega и налогов</p></div><button class="ps-text-button" type="button" data-ps-admin-refresh>Обновить</button></header><div class="ps-admin-metrics"><div><span>Оплачено</span><strong>${proxyShopMoney(s.chargedMinor)}</strong></div><div><span>Известные расходы</span><strong>${proxyShopMoney(s.supplierSpentMinor)}</strong></div><div><span>Разница</span><strong>${proxyShopMoney(Number.isSafeInteger(s.chargedMinor)&&Number.isSafeInteger(s.supplierSpentMinor)?s.chargedMinor-s.supplierSpentMinor:null)}</strong></div><div><span>Зарезервировано</span><strong>${proxyShopMoney(s.reservedMinor)}</strong></div></div>${s.unknownSupplierCosts?`<p class="ps-hint">Расходы ещё по ${s.unknownSupplierCosts} операциям уточняются. Показанная разница предварительная.</p>`:''}${data.operations?.map(o=>`<article class="ps-admin-row"><div><strong>${proxyShopSafe(proxyShopLabels[o.status]||o.status)} · ${proxyShopMoney(o.priceMinor)}</strong><small>Кабинет ${proxyShopSafe(o.workspaceId)} · ${proxyShopSafe(o.id)} · ${proxyShopDate(o.createdAt)}</small></div><span>Поставщик: ${o.supplierCostMinor==null?'уточняется':proxyShopMoney(o.supplierCostMinor)}</span>${o.status==='review_required'?`<details class="ps-admin-recovery"><summary>Сверить или вернуть резерв</summary><form data-ps-admin-recover><input type="hidden" name="operationId" value="${proxyShopSafe(o.id)}"><label>ID заказа в SteelProxy<input type="number" name="providerOrderId" min="1" step="1" required></label><button class="button button--ghost">Сверить существующий заказ</button></form><form data-ps-admin-refund><input type="hidden" name="operationId" value="${proxyShopSafe(o.id)}"><label class="mp-confirm"><input type="checkbox" name="confirmed" required>Подтверждаю возврат суммы на баланс клиента. Возможный расход поставщика остаётся за сервисом.</label><button class="button button--ghost">Вернуть резерв</button></form><p class="ps-hint">Это административные финансовые действия. Используется штатное подтверждение защищённого доступа.</p><p data-ps-admin-result role="status"></p></details>`:''}</article>`).join('')||'<p>Покупок пока нет.</p>'}<p class="ps-hint">Неопределённые операции не перезапускаются. Владелец кабинета может проверить результат чтением заказа поставщика; при длительной неопределённости нужна сверка с поддержкой SteelProxy.</p></section>`;
}
(function installProxyShop(){
 if(typeof document==='undefined'||typeof managedProxyRender!=='function')return;
 proxyShopInstallPage();
 const render=managedProxyRender;managedProxyRender=function(...args){if(proxyShopUi.scope&&proxyShopUi.scope!==proxyShopScope())proxyShopReset();const result=render(...args);renderProxyShopModal();if(proxyShopDialog.node?.open&&!proxyShopUi.quote&&!proxyShopUi.busy&&!proxyShopUi.error)void proxyShopPrepareQuote();if(!proxyShopUi.resetting&&proxyShopScope()&&document.querySelector('[data-managed-proxy]')&&!proxyShopUi.data&&!proxyShopUi.loading&&!proxyShopUi.error)void proxyShopLoad();return result;};
 if(typeof renderProfileRoute==='function'){const route=renderProfileRoute;renderProfileRoute=function(view,...args){const result=route.call(this,view,...args);if(view==='profile'&&proxyShopScope()&&!proxyShopUi.busy&&!proxyShopUi.resetting)void proxyShopLoad();return result;};}
 if(typeof setModal==='function'){const modal=setModal;setModal=function(open,...args){const result=modal.call(this,open,...args);if(open&&proxyShopScope()&&!proxyShopUi.busy&&!proxyShopUi.resetting)void proxyShopLoad();return result;};}
 const reset=resetAccountData;resetAccountData=function(...args){proxyShopUi.resetting=true;proxyShopReset();try{return reset.apply(this,args);}finally{proxyShopUi.resetting=false;}};
 const admin=renderAdminPanel;renderAdminPanel=function(...args){const result=admin.apply(this,args),root=document.querySelector('[data-admin-root]');if(root&&adminAllowed()&&!root.querySelector('[data-proxy-shop-admin]')){const panel=document.createElement('div');panel.dataset.proxyShopAdmin='';root.append(panel);void proxyShopAdminLoad(panel);}return result;};
 document.addEventListener('change',e=>{const form=e.target.closest?.('[data-ps-selection]');if(!form||proxyShopUi.busy)return;proxyShopUi.quote=null;proxyShopUi.request=null;proxyShopUi.unknown=false;const fields=new FormData(form);proxyShopUi.nodeId=String(fields.get('nodeId')||'');proxyShopUi.resourceId=String(fields.get('resourceId')||'');proxyShopUi.months=Number(fields.get('months'));proxyShopRender();void proxyShopPrepareQuote();});
 document.addEventListener('submit',e=>{const recovery=e.target.closest?.('[data-ps-admin-recover],[data-ps-admin-refund]');if(recovery){e.preventDefault();void proxyShopAdminAction(recovery);return;}const form=e.target.closest?.('[data-ps-selection],[data-ps-purchase]');if(!form)return;e.preventDefault();if(proxyShopUi.busy)return;
  if(form.hasAttribute('data-ps-selection')){const values=new FormData(form),data=managedProxyUi.data,kind=proxyShopUi.kind==='renew'&&proxyShopResources(data).length?'renew':data?.current||data?.configured?'replace':'issue';void proxyShopAction('quote',{kind,months:Number(values.get('months')),...(kind==='renew'?{resourceId:String(values.get('resourceId'))}:{nodeId:Number(values.get('nodeId'))})});}
  else if(form.querySelector('[name="confirmed"]')?.checked&&proxyShopUi.request&&!proxyShopUi.unknown)void proxyShopAction('purchase',proxyShopUi.request);
 });
 document.addEventListener('click',e=>{const dismiss=e.target.closest?.('[data-proxy-invite-dismiss]');if(dismiss){const invite=dismiss.closest('[data-proxy-invite]'),heading=invite?.closest('[data-view]')?.querySelector('h1');if(invite)invite.hidden=true;if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}return;}const close=e.target.closest?.('[data-ps-close]');if(close){proxyShopClose();return;}const wizard=e.target.closest?.('[data-ps-wizard]');if(wizard){proxyShopClose(false);setModal(true);return;}if(e.target.closest?.('[data-ps-plan]')){proxyShopClose(false);setView('billing');return;}if(e.target.closest?.('[data-ps-new]')){proxyShopUi.modalOpId='';proxyShopUi.quote=null;proxyShopUi.request=null;proxyShopUi.error='';proxyShopRender();void proxyShopPrepareQuote();return;}const open=e.target.closest?.('[data-proxy-open]');if(open){e.preventDefault();void proxyShopOpen(open);return;}const b=e.target.closest?.('[data-ps-refresh],[data-ps-reconcile],[data-ps-kind],[data-ps-topup],[data-ps-admin-refresh],[data-ps-repeat]');if(!b||b.disabled)return;
  if(b.hasAttribute('data-ps-repeat')&&proxyShopUi.request&&proxyShopUi.unknown){void proxyShopAction('purchase',proxyShopUi.request);return;}
  if(b.hasAttribute('data-ps-refresh')){void proxyShopLoad({catalog:true});return;}
  if(b.dataset.psReconcile){void proxyShopAction('reconcile',{operationId:b.dataset.psReconcile});return;}
  if(b.dataset.psKind&&!proxyShopUi.busy){proxyShopUi.kind=b.dataset.psKind;proxyShopUi.quote=null;proxyShopUi.request=null;proxyShopUi.unknown=false;proxyShopUi.modalOpId='';proxyShopRender();void proxyShopPrepareQuote();return;}
  if(b.hasAttribute('data-ps-topup')){proxyShopClose(false);if(typeof setModal==='function')setModal(false);setView('billing');void openBillingDialog('topup',document.querySelector('[data-billing-open="topup"]'));return;}
  if(b.hasAttribute('data-ps-admin-refresh'))void proxyShopAdminLoad(b.closest('[data-proxy-shop-admin]'));
 });
 managedProxyRender();
})();
async function proxyShopAdminLoad(panel){if(!panel||!adminAllowed())return;const scope=proxyShopScope();try{const data=await apiRequest('/api/v1/admin/proxy-shop',{authenticated:true});if(scope===proxyShopScope()&&panel.isConnected&&adminAllowed())panel.innerHTML=proxyShopAdminMarkup(data);}catch{if(scope===proxyShopScope()&&panel.isConnected)panel.textContent='История продажи прокси временно недоступна.';}}

async function proxyShopAdminAction(form){
 if(!adminAllowed()||form.dataset.pending==='true')return;
 const scope=proxyShopScope(),values=new FormData(form),refund=form.hasAttribute('data-ps-admin-refund');
 const body={operationId:String(values.get('operationId')),...(refund?{confirmed:values.get('confirmed')==='on'}:{providerOrderId:Number(values.get('providerOrderId'))})};
 const output=form.closest('.ps-admin-recovery')?.querySelector('[data-ps-admin-result]'),button=form.querySelector('button');form.dataset.pending='true';if(button)button.disabled=true;
 try{await apiRequest('/api/v1/admin/proxy-shop/'+(refund?'refund':'recover'),{method:'POST',body,authenticated:true,signal:AbortSignal.timeout(200000)});if(scope===proxyShopScope()&&form.isConnected)await proxyShopAdminLoad(form.closest('[data-proxy-shop-admin]'));}
 catch(e){if(scope===proxyShopScope()&&form.isConnected&&output)output.textContent=e.code==='MFA_STEP_UP'?'Подтвердите защищённый доступ в профиле → Защита аккаунта, затем повторите сверку.':e.message||'Действие не выполнено';}
 finally{if(scope===proxyShopScope()&&form.isConnected){form.dataset.pending='false';if(button)button.disabled=false;}}
}
