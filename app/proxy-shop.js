/* Purchases use the ZetSlay wallet. Supplier credentials never enter this module. */
const proxyShopUi={scope:'',epoch:0,loadRevision:0,data:null,catalog:null,loading:false,busy:false,error:'',quote:null,request:null,unknown:false,kind:'issue',nodeId:'',resourceId:'',months:1,poll:null};
const proxyShopScope=()=>authState.user?.id&&authState.token?`${authState.user.id}:${authState.token}:${typeof sessionGeneration==='number'?sessionGeneration:0}`:'';
const proxyShopMoney=n=>Number.isSafeInteger(n)?new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(n/100):'—';
const proxyShopSafe=v=>escapeHtml(String(v??''));
const proxyShopDate=v=>Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'Уточняется';
const proxyShopLabels={reserved:'Средства зарезервированы',ordering:'Получаем адрес',extending:'Продлеваем срок',supplier_received:'Прокси получен',checking:'Проверяем FunPay',review_required:'Уточняем результат',delivered:'Готово',refunded:'Средства возвращены'};
function proxyShopReset(){clearTimeout(proxyShopUi.poll);proxyShopUi.epoch++;Object.assign(proxyShopUi,{scope:'',data:null,catalog:null,loading:false,busy:false,error:'',quote:null,request:null,unknown:false,kind:'issue',nodeId:'',resourceId:'',months:1,poll:null});}
function proxyShopCurrent(scope,epoch){return scope===proxyShopScope()&&epoch===proxyShopUi.epoch;}
function proxyShopResources(data){return [data?.current,...(data?.candidates||[])].filter(r=>r?.supplier==='steelproxy'&&r.state!=='retired');}
function proxyShopRender(){if(typeof managedProxyRender==='function')managedProxyRender();}
function proxyShopOperation(o){
 const pending=!['delivered','refunded'].includes(o.status),success=o.status==='delivered';
 return `<article class="ps-operation ${success?'is-complete':''}"><header><strong>${proxyShopSafe(proxyShopLabels[o.status]||'Уточняем результат')}</strong><span>${proxyShopMoney(o.priceMinor)}</span></header><p>${o.kind==='renew'?'Продление':o.kind==='replace'?'Новый адрес':'Покупка прокси'} · ${proxyShopSafe(o.country)} · ${o.months*30} дней${o.expiresAt?' · до '+proxyShopDate(o.expiresAt):''}</p>${success?`<small>${o.kind==='renew'?'Срок продлён у поставщика. Дата в кабинете обновлена.':'FunPay доступен с сервера ZetSlay. Для подключения нажмите «Проверить и подключить» выше — авторизация магазина проверяется отдельно.'}</small>`:o.status==='refunded'?'<small>Сумма возвращена на внутренний баланс ZetSlay. Повторного списания нет.</small>':'<small>Повторная покупка не запускается. Сумма зарезервирована до подтверждения результата.</small>'}${pending?`<button type="button" class="ps-text-button" data-ps-reconcile="${proxyShopSafe(o.id)}" ${proxyShopUi.busy?'disabled':''}>Проверить результат</button>`:''}<span class="ps-operation-id">№ ${proxyShopSafe(o.id.slice(0,8))} · ${proxyShopDate(o.createdAt)}</span></article>`;
}
function proxyShopMarkup(data){
 const ui=proxyShopUi,status=ui.data;if(!proxyShopScope())return '';
 if(!status)return `<section class="proxy-shop"><header><h3>Купить прокси</h3></header><p>${proxyShopSafe(ui.error||'Проверяем доступность покупки…')}</p>${ui.error?'<button type="button" class="ps-text-button" data-ps-refresh>Повторить проверку</button>':''}</section>`;
 const pending=status.operations?.find(o=>!['delivered','refunded'].includes(o.status));
 const resources=proxyShopResources(data),locations=ui.catalog?.locations||[],canRenew=resources.length>0;
 const kind=ui.kind==='renew'&&canRenew?'renew':data.current?'replace':'issue';
 const q=ui.quote,locked=ui.busy||!!pending||ui.unknown,price=locations.find(l=>String(l.nodeId)===ui.nodeId)?.monthlyPriceMinor??locations[0]?.monthlyPriceMinor;
 return `<section class="proxy-shop" aria-label="Покупка прокси"><header><div><h3>${kind==='renew'?'Продлить прокси':'Прокси для вашего магазина'}</h3><p>Оплата с внутреннего баланса ZetSlay. Автопродления нет.</p></div><span class="ps-wallet">Баланс <strong>${proxyShopMoney(status.balanceMinor)}</strong></span></header>
 ${!status.enabled?'<p class="ps-hint">Продажа временно недоступна. История покупок и срок уже выданного прокси сохраняются.</p>':pending?proxyShopOperation(pending):`<form data-ps-selection><fieldset ${locked?'disabled':''}>${canRenew?`<div class="ps-kind" role="group" aria-label="Действие с прокси"><button type="button" data-ps-kind="renew" aria-pressed="${kind==='renew'}">Продлить</button><button type="button" data-ps-kind="${data.current?'replace':'issue'}" aria-pressed="${kind!=='renew'}">Купить ${data.current?'новый адрес':'прокси'}</button></div>`:''}<div class="ps-fields">${kind==='renew'?`<label>Ваш прокси<select name="resourceId">${resources.map(r=>`<option value="${proxyShopSafe(r.id)}" ${ui.resourceId===r.id?'selected':''}>${proxyShopSafe(r.label)} · до ${proxyShopDate(r.expiresAt)}</option>`).join('')}</select></label>`:`<label>Локация<select name="nodeId" ${!locations.length?'disabled':''}>${locations.map(l=>`<option value="${l.nodeId}" ${String(l.nodeId)===ui.nodeId?'selected':''}>${proxyShopSafe(l.title)} · сервер ${l.nodeId}</option>`).join('')||'<option>Нет доступных адресов</option>'}</select></label>`}<label>Срок<select name="months">${[1,2,3,6].map(n=>`<option value="${n}" ${ui.months===n?'selected':''}>${n*30} дней${kind==='renew'?' к текущему сроку':''}</option>`).join('')}</select></label></div>
 ${kind==='renew'?'<p class="ps-hint">Продлевается тот же прокси. Дата окончания изменится после подтверждения поставщика.</p>':'<p class="ps-hint">Перед выдачей дважды проверим доступность FunPay с нашего сервера. Если проверка не пройдёт, сумма вернётся на ваш баланс.</p>'}
 ${kind==='replace'?'<p class="ps-hint">Новый адрес оплачивается отдельно. Текущее подключение сохранится до проверки и подключения нового.</p>':''}
 <div class="ps-selection-footer"><span>${Number.isSafeInteger(price)&&kind!=='renew'?proxyShopMoney(price)+' / 30 дней':'Сумма появится в расчёте'}</span><button class="button button--ghost" type="submit" ${locked||kind!=='renew'&&!locations.length||kind!=='renew'&&!data.activePlan?'disabled':''}>${ui.busy?'Проверяем…':q?'Обновить расчёт':'Рассчитать стоимость'}</button></div>${!data.activePlan&&kind!=='renew'?'<p class="ps-hint">Для нового подключения активируйте пробный период или подписку.</p>':''}</fieldset></form>`}
 ${q&&!pending&&status.enabled?`<form class="ps-quote" data-ps-purchase><div><span>${q.kind==='renew'?'Продление':'Новый прокси'} · ${proxyShopSafe(q.country)} · ${q.termDays} дней</span><strong>${proxyShopMoney(q.totalMinor)}</strong></div>${q.extendedExpiresAt?`<p>Новый срок: до ${proxyShopDate(q.extendedExpiresAt)}</p>`:''}<p>Расчёт действует до ${proxyShopDate(q.expiresAt)}. Оплата только с баланса ZetSlay.</p><label class="ps-consent"><input type="checkbox" name="confirmed" required ${ui.busy?'disabled':''}><span>Подтверждаю покупку и принимаю <a href="../legal/terms.html" target="_blank" rel="noopener">условия сервиса</a> и <a href="../legal/refunds.html" target="_blank" rel="noopener">правила оплаты и возвратов</a>.</span></label><button class="button button--primary" type="submit" ${locked||ui.unknown||status.balanceMinor<q.totalMinor?'disabled':''}>${ui.busy?'Выполняем покупку…':'Оплатить с баланса · '+proxyShopMoney(q.totalMinor)}</button>${status.balanceMinor<q.totalMinor?'<button class="ps-text-button" type="button" data-ps-topup>Пополнить баланс через Platega</button>':''}${ui.unknown?'<button class="ps-text-button" type="button" data-ps-refresh>Проверить результат покупки</button><button class="ps-text-button" type="button" data-ps-repeat>Повторить тот же запрос</button>':''}</form>`:''}
 ${ui.error?`<p class="mp-error" role="alert">${proxyShopSafe(ui.error)}</p>`:''}
 ${status.operations?.length?`<details class="ps-history"><summary>История покупок · ${status.operations.length}</summary>${status.operations.slice(0,10).filter(o=>o.id!==pending?.id).map(proxyShopOperation).join('')}</details>`:''}
 <footer><button class="ps-text-button" type="button" data-ps-refresh ${ui.loading||ui.busy?'disabled':''}>Обновить покупки</button><a href="https://t.me/zetslaysupport" target="_blank" rel="noopener">Помощь с прокси ↗</a></footer></section>`;
}
async function proxyShopLoad({catalog=false}={}){
 const scope=proxyShopScope();if(!scope)return;
 if(proxyShopUi.scope&&proxyShopUi.scope!==scope)proxyShopReset();
 if(proxyShopUi.loading)return;
 const epoch=proxyShopUi.epoch,revision=++proxyShopUi.loadRevision;const current=()=>proxyShopCurrent(scope,epoch)&&revision===proxyShopUi.loadRevision;proxyShopUi.scope=scope;proxyShopUi.loading=true;
 try{
  const data=await apiRequest('/api/v1/proxy-shop',{authenticated:true});if(!current())return;
  if(!Array.isArray(data.operations)||!Number.isSafeInteger(data.balanceMinor)||typeof data.enabled!=='boolean')throw Error('Не удалось подтвердить покупки прокси');
  proxyShopUi.data=data;
  if(proxyShopUi.request){const o=data.operations.find(x=>x.id===proxyShopUi.request.requestId);if(o){proxyShopUi.unknown=false;if(['delivered','refunded'].includes(o.status)){proxyShopUi.quote=null;proxyShopUi.request=null;}}}
  if(data.enabled&&(catalog||!proxyShopUi.catalog)){const list=await apiRequest('/api/v1/proxy-shop/catalog',{authenticated:true});if(!current())return;proxyShopUi.catalog=list;}
  if(!current())return;proxyShopUi.error='';
 }catch(e){if(current())proxyShopUi.error=e.code==='HTTP_404'?'Сначала установите серверное обновление продажи прокси.':e.message||'Покупки временно недоступны';}
 finally{if(current()){proxyShopUi.loading=false;proxyShopRender();proxyShopPoll();}}
}
function proxyShopPoll(){clearTimeout(proxyShopUi.poll);if(proxyShopUi.data?.operations?.some(o=>!['delivered','refunded'].includes(o.status)))proxyShopUi.poll=setTimeout(()=>void proxyShopLoad(),5000);}
async function proxyShopAction(action,body){
 const scope=proxyShopScope();if(!scope||proxyShopUi.busy)return;const epoch=proxyShopUi.epoch;
 proxyShopUi.loadRevision++;proxyShopUi.loading=false;proxyShopUi.busy=true;proxyShopUi.error='';proxyShopRender();
 try{
  const result=await apiRequest('/api/v1/proxy-shop/'+action,{method:'POST',body,authenticated:true,signal:AbortSignal.timeout(200000)});
  if(!proxyShopCurrent(scope,epoch))return;
  if(action==='quote'){
   const q=result.quote; if(!q||!Number.isSafeInteger(q.totalMinor)||q.totalMinor<=0||q.currency!=='RUB'||!Number.isFinite(Date.parse(q.expiresAt)))throw Error('Не удалось подтвердить стоимость');
   proxyShopUi.quote=q;proxyShopUi.request={requestId:crypto.randomUUID(),quoteId:q.id,confirmed:true,legalVersion:result.publication?.version,publicationHash:result.publication?.hash};proxyShopUi.unknown=false;
   if(Number.isSafeInteger(result.balanceMinor)&&proxyShopUi.data)proxyShopUi.data.balanceMinor=result.balanceMinor;
  }else{
   if(typeof managedProxyLoad==='function')await managedProxyLoad();if(!proxyShopCurrent(scope,epoch))return;
   if(typeof paymentsRefresh==='function')void paymentsRefresh();
  }
 }catch(e){if(proxyShopCurrent(scope,epoch)){if(action==='purchase'&&['INVALID_INPUT','PLAN_REQUIRED','INSUFFICIENT_BALANCE','PROXY_PRICE_CHANGED','PROXY_QUOTE_EXPIRED','PROXY_NODE_CHECKING','PROXY_PURCHASE_PENDING'].includes(e.code)){proxyShopUi.error=e.message||'Покупка не выполнена';proxyShopUi.unknown=false;if(['PROXY_PRICE_CHANGED','PROXY_QUOTE_EXPIRED','INVALID_INPUT'].includes(e.code)){proxyShopUi.quote=null;proxyShopUi.request=null;}}else if(action==='purchase'){proxyShopUi.unknown=true;proxyShopUi.error='Ответ покупки не получен. Обновите покупки: проверим сохранённый результат.';}else proxyShopUi.error=e.message||'Не удалось выполнить действие';}}
 finally{if(proxyShopCurrent(scope,epoch)){proxyShopUi.busy=false;if(action!=='quote'){const message=proxyShopUi.error,uncertain=proxyShopUi.unknown;await proxyShopLoad();if(proxyShopCurrent(scope,epoch)&&message&&(!uncertain||proxyShopUi.unknown))proxyShopUi.error=message;}if(proxyShopCurrent(scope,epoch))proxyShopRender();}}
}
function proxyShopAdminMarkup(data){
 if(!data)return '';
 const s=data.summary||{};return `<section class="mp-card proxy-shop-admin"><header><div><h2>Продажи прокси</h2><p>Последние 100 операций · без комиссий Platega и налогов</p></div><button class="ps-text-button" type="button" data-ps-admin-refresh>Обновить</button></header><div class="ps-admin-metrics"><div><span>Оплачено</span><strong>${proxyShopMoney(s.chargedMinor)}</strong></div><div><span>Известные расходы</span><strong>${proxyShopMoney(s.supplierSpentMinor)}</strong></div><div><span>Разница</span><strong>${proxyShopMoney(Number.isSafeInteger(s.chargedMinor)&&Number.isSafeInteger(s.supplierSpentMinor)?s.chargedMinor-s.supplierSpentMinor:null)}</strong></div><div><span>Зарезервировано</span><strong>${proxyShopMoney(s.reservedMinor)}</strong></div></div>${s.unknownSupplierCosts?`<p class="ps-hint">Расходы ещё по ${s.unknownSupplierCosts} операциям уточняются. Показанная разница предварительная.</p>`:''}${data.operations?.map(o=>`<article class="ps-admin-row"><div><strong>${proxyShopSafe(proxyShopLabels[o.status]||o.status)} · ${proxyShopMoney(o.priceMinor)}</strong><small>Кабинет ${proxyShopSafe(o.workspaceId)} · ${proxyShopSafe(o.id)} · ${proxyShopDate(o.createdAt)}</small></div><span>Поставщик: ${o.supplierCostMinor==null?'уточняется':proxyShopMoney(o.supplierCostMinor)}</span>${o.status==='review_required'?`<details class="ps-admin-recovery"><summary>Сверить или вернуть резерв</summary><form data-ps-admin-recover><input type="hidden" name="operationId" value="${proxyShopSafe(o.id)}"><label>ID заказа в SteelProxy<input type="number" name="providerOrderId" min="1" step="1" required></label><button class="button button--ghost">Сверить существующий заказ</button></form><form data-ps-admin-refund><input type="hidden" name="operationId" value="${proxyShopSafe(o.id)}"><label class="mp-confirm"><input type="checkbox" name="confirmed" required>Подтверждаю возврат суммы на баланс клиента. Возможный расход поставщика остаётся за сервисом.</label><button class="button button--ghost">Вернуть резерв</button></form><p class="ps-hint">Это административные финансовые действия. Используется штатное подтверждение защищённого доступа.</p><p data-ps-admin-result role="status"></p></details>`:''}</article>`).join('')||'<p>Покупок пока нет.</p>'}<p class="ps-hint">Неопределённые операции не перезапускаются. Владелец кабинета может проверить результат чтением заказа поставщика; при длительной неопределённости нужна сверка с поддержкой SteelProxy.</p></section>`;
}
(function installProxyShop(){
 if(typeof document==='undefined'||typeof managedProxyRender!=='function')return;
 const render=managedProxyRender;managedProxyRender=function(...args){if(proxyShopUi.scope&&proxyShopUi.scope!==proxyShopScope())proxyShopReset();const result=render(...args);if(proxyShopScope()&&document.querySelector('[data-managed-proxy]')&&!proxyShopUi.data&&!proxyShopUi.loading&&!proxyShopUi.error)void proxyShopLoad();return result;};
 const reset=resetAccountData;resetAccountData=function(...args){proxyShopReset();return reset.apply(this,args);};
 const admin=renderAdminPanel;renderAdminPanel=function(...args){const result=admin.apply(this,args),root=document.querySelector('[data-admin-root]');if(root&&adminAllowed()&&!root.querySelector('[data-proxy-shop-admin]')){const panel=document.createElement('div');panel.dataset.proxyShopAdmin='';root.append(panel);void proxyShopAdminLoad(panel);}return result;};
 document.addEventListener('change',e=>{const form=e.target.closest?.('[data-ps-selection]');if(!form||proxyShopUi.busy)return;proxyShopUi.quote=null;proxyShopUi.request=null;proxyShopUi.unknown=false;const fields=new FormData(form);proxyShopUi.nodeId=String(fields.get('nodeId')||'');proxyShopUi.resourceId=String(fields.get('resourceId')||'');proxyShopUi.months=Number(fields.get('months'));proxyShopRender();});
 document.addEventListener('submit',e=>{const recovery=e.target.closest?.('[data-ps-admin-recover],[data-ps-admin-refund]');if(recovery){e.preventDefault();void proxyShopAdminAction(recovery);return;}const form=e.target.closest?.('[data-ps-selection],[data-ps-purchase]');if(!form)return;e.preventDefault();if(proxyShopUi.busy)return;
  if(form.hasAttribute('data-ps-selection')){const values=new FormData(form),data=managedProxyUi.data,kind=proxyShopUi.kind==='renew'&&proxyShopResources(data).length?'renew':data?.current?'replace':'issue';void proxyShopAction('quote',{kind,months:Number(values.get('months')),...(kind==='renew'?{resourceId:String(values.get('resourceId'))}:{nodeId:Number(values.get('nodeId'))})});}
  else if(form.querySelector('[name="confirmed"]')?.checked&&proxyShopUi.request&&!proxyShopUi.unknown)void proxyShopAction('purchase',proxyShopUi.request);
 });
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-ps-refresh],[data-ps-reconcile],[data-ps-kind],[data-ps-topup],[data-ps-admin-refresh],[data-ps-repeat]');if(!b||b.disabled)return;
  if(b.hasAttribute('data-ps-repeat')&&proxyShopUi.request&&proxyShopUi.unknown){void proxyShopAction('purchase',proxyShopUi.request);return;}
  if(b.hasAttribute('data-ps-refresh')){void proxyShopLoad({catalog:true});return;}
  if(b.dataset.psReconcile){void proxyShopAction('reconcile',{operationId:b.dataset.psReconcile});return;}
  if(b.dataset.psKind&&!proxyShopUi.busy){proxyShopUi.kind=b.dataset.psKind;proxyShopUi.quote=null;proxyShopUi.request=null;proxyShopUi.unknown=false;proxyShopRender();return;}
  if(b.hasAttribute('data-ps-topup')){if(typeof setModal==='function')setModal(false);setView('billing');void openBillingDialog('topup',document.querySelector('[data-billing-open="topup"]'));return;}
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
