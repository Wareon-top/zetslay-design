/* Cached server accounting; viewing and filtering never purchase or change FunPay orders. */
const financeUi={scope:'',data:null,request:0,read:null,write:null,busy:false,saving:false,error:'',dialog:null,loadedAt:0,period:'last30',from:'',to:'',currency:'',group:'day',query:'',status:'all',size:10,page:1};
const financeScope=()=>[authState.user?.id||'',authState.workspace?.id||'',authState.token||'',sessionGeneration,selectedStore()?.id||''].join(':');
const financeAllowed=()=>Boolean(authState.user&&authState.token&&typeof subscriptionActive==='function'&&subscriptionActive());
function financeCloseCosts(){const dialog=financeUi.dialog;financeUi.dialog=null;if(dialog?.open)dialog.close();dialog?.remove();}
function resetFinanceWorkspace(scope=''){
 financeUi.read?.abort();financeUi.write?.abort();financeCloseCosts();
 Object.assign(financeUi,{scope,data:null,request:financeUi.request+1,read:null,write:null,busy:false,saving:false,error:'',loadedAt:0,period:'last30',from:'',to:'',currency:'',group:'day',query:'',status:'all',size:10,page:1});
}
function financeChart(model){
 if(!model.loaded)return '<p>Загрузите отчёт, чтобы увидеть динамику.</p>';
 if(!model.series.length)return '<p>Для графика нет заказов с точной датой в выбранном периоде.</p>';
 const series=model.series,W=Math.max(300,Math.min(1200,document.querySelector('[data-finance-chart]')?.clientWidth||840)),H=230,left=70,right=18,top=14,bottom=35,points=series.flatMap(r=>[r.income,r.profit]).filter(financeSigned),low=Math.min(0,...points),rawHigh=Math.max(0,...points),high=rawHigh===0&&low===0?100:rawHigh,span=high-low||1,plotW=W-left-right,plotH=H-top-bottom,y=n=>top+(high-n)/span*plotH,slot=plotW/series.length,x=i=>left+slot*(i+.5),zero=y(0);
 const compact=n=>new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:1}).format(n/100);
 let html=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Доход и чистая прибыль в ${model.currency}. Пропуски означают неполные расходы."><title>Доход и прибыль · ${financeEscape(model.range.label)} · ${model.currency}</title>`;
 for(let i=0;i<4;i++){const value=high-span*i/3,py=y(value);html+=`<line class="fin-grid" x1="${left}" x2="${W-right}" y1="${py}" y2="${py}"/><text x="${left-9}" y="${py+3}" text-anchor="end">${financeEscape(compact(value))}</text>`;}
 html+=`<line x1="${left}" x2="${W-right}" y1="${zero}" y2="${zero}" stroke="#59606c" stroke-width=".7"/>`;
 let path='';const paths=[];
 series.forEach((r,i)=>{const px=x(i),label=financeDate(Date.parse(r.date+'T00:00:00+03:00'));
  if(financeSigned(r.income)){const py=y(r.income),height=Math.abs(zero-py);html+=`<rect x="${px-Math.max(1,slot*.44)/2}" y="${Math.min(zero,py)}" width="${Math.max(1,slot*.44)}" height="${height}" rx="2" fill="#f5ad72" opacity=".76"><title>${financeEscape(label)} · доход ${financeEscape(financeMoney(r.income,model.currency))}</title></rect>`;}
  if(financeSigned(r.profit)){path+=(path?' L':'M')+px.toFixed(2)+' '+y(r.profit).toFixed(2);html+=`<circle cx="${px}" cy="${y(r.profit)}" r="${series.length>60?1.4:2.4}" fill="#87ddb3"><title>${financeEscape(label)} · прибыль ${financeEscape(financeMoney(r.profit,model.currency))}</title></circle>`;}else if(path){paths.push(path);path='';}
  if(i===0||i===series.length-1||i%Math.max(1,Math.ceil(series.length/6))===0)html+=`<text x="${px}" y="${H-10}" text-anchor="middle">${financeEscape(label)}</text>`;
 });if(path)paths.push(path);for(const p of paths)html+=`<path d="${p}" fill="none" stroke="#87ddb3" stroke-width="2" stroke-linejoin="round"/>`;
 return html+'</svg>';
}
function financeRowsMarkup(model){
 return model.rows.map(r=>{const date=r.date===null?financeEscape(r.sourceDateLabel||'Не передана'):`<time datetime="${new Date(r.date).toISOString()}">${financeEscape(financeDate(r.date))}</time><small>${financeEscape(new Date(r.date).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}))}</small>`,reasons=(r.reasons||[]).map(key=>FINANCE_REASONS[key]||'Требуется проверка').join(' · '),tone=financeSigned(r.profitMinor)?r.profitMinor<0?'fin-negative':'fin-positive':'';
  return `<tr><td><a class="fin-order-id" href="https://funpay.com/orders/${encodeURIComponent(r.id)}/" target="_blank" rel="noopener noreferrer">#${financeEscape(r.id)}</a><span class="fin-product" title="${financeEscape(r.product)}">${financeEscape(r.product||'Заказ FunPay')}</span><small>${financeEscape(r.buyer)}</small></td><td>${date}</td><td><span class="fin-status fin-status--${Object.hasOwn(FINANCE_STATUS,r.status)?r.status:'unknown'}">${financeEscape(FINANCE_STATUS[r.status]||'Неизвестен')}</span></td><td><strong>${financeEscape(financeMoney(r.revenueMinor,model.currency))}</strong>${r.refundMinor?`<small>Возврат ${financeEscape(financeMoney(r.refundMinor,model.currency))}</small>`:''}</td><td><strong>${financeEscape(financeMoney(r.costMinor,model.currency))}</strong><small>${r.costSource==='kosell'?'Kosell · подтверждено':r.costSource==='manual'?'Указана вручную':'Не указана'}</small></td><td><strong>${financeEscape(financeMoney(r.expensesMinor,model.currency))}</strong>${r.expensesMinor===null&&r.knownExpensesMinor?`<small>Учтено ${financeEscape(financeMoney(r.knownExpensesMinor,model.currency))}</small>`:''}</td><td class="${tone}" title="${financeEscape(reasons)}"><strong>${financeEscape(financeMoney(r.profitMinor,model.currency))}</strong>${r.included&&r.profitMinor===null?'<small>Требует расчёта</small>':!r.included?'<small>Не участвует в доходе</small>':''}</td><td>${r.currency?`<button type="button" class="fin-cost-button" ${financeUi.busy||financeUi.saving?'disabled':''} data-finance-costs="${financeEscape(r.id)}">Расходы</button>`:'—'}</td></tr>`;
 }).join('');
}
function renderFinanceWorkspace(){
 const root=document.querySelector('[data-finance-workspace]');if(!root)return;
 const scope=financeScope();if(financeUi.scope!==scope)resetFinanceWorkspace(scope);
 if(!financeAllowed()){financeUi.data=null;financeUi.error='';financeCloseCosts();}
 const model=buildFinanceModel(financeUi.data,financeUi);financeUi.currency=model.currency;financeUi.page=model.page;
 const set=(key,value)=>{const n=root.querySelector('[data-finance-'+key+']');if(n)n.textContent=value;},money=n=>model.loaded?financeMoney(n,model.currency):'—',stats=model.stats;
 root.setAttribute('aria-busy',String(financeUi.busy));set('store',selectedStore()?.displayName||'Магазин не выбран');
 set('updated',financeUi.data?.observedAt?'Заказы обновлены '+new Date(financeUi.data.observedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'История заказов ещё не получена');
 set('period-label',model.range.label+' · '+model.currency);set('income',money(stats.income));set('expenses',money(stats.expenses));set('profit',money(stats.profit));set('gross',money(stats.gross));set('refunds',money(stats.refundAmount));set('average',money(stats.average));set('count',model.loaded?String(stats.orders):'—');
 set('count-note',model.loaded?stats.completed+' завершено · '+stats.awaiting+' ожидают завершения':'За выбранный период и валюту');
 set('expenses-note',model.loaded&&stats.expenses===null?'Подтверждённые расходы: '+financeMoney(stats.knownExpenses,model.currency):'Себестоимость, комиссии, прочие расходы и налог');
 set('profit-note',model.loaded&&stats.missing?`Рассчитано ${stats.profitKnownCount} из ${stats.accounted}. Учтённая прибыль: ${financeMoney(stats.knownProfit,model.currency)}`:'Доход за вычетом всех учтённых расходов');
 set('margin',model.loaded&&financeSigned(stats.profit)&&stats.income>0?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(stats.profit/stats.income*100)+'%':'—');
 const profit=root.querySelector('[data-finance-profit]');profit?.classList.toggle('fin-negative',financeSigned(stats.profit)&&stats.profit<0);profit?.classList.toggle('fin-positive',financeSigned(stats.profit)&&stats.profit>=0);
 for(const [key,value] of [['gross',stats.gross],['refund',stats.refundAmount],['income',stats.income],['expenses',stats.expenses],['profit',stats.profit]])set('result-'+key,money(value));
 set('coverage',!model.loaded?'Неизвестные расходы не считаются нулевыми.':stats.missing?`Не хватает данных для ${stats.missing} из ${stats.accounted} заказов. Укажите расходы, даже если они нулевые. При неопределённых операциях сначала проверьте поставщика.`:stats.accounted?'Расходы учтены для всех заказов в этом периоде.':'В этом периоде пока нет заказов для расчёта.');
 const notice=root.querySelector('[data-finance-notice]');if(notice){notice.textContent=financeUi.error;notice.hidden=!financeUi.error;}
 const refresh=root.querySelector('[data-finance-refresh]');if(refresh)refresh.disabled=!financeAllowed()||!selectedStore()?.id||financeUi.busy||financeUi.saving;
 set('refresh-label',financeUi.busy?'Загружаем…':'Обновить отчёт');
 const exportButton=root.querySelector('[data-finance-export]');if(exportButton)exportButton.disabled=!financeAllowed()||!model.loaded||!model.filtered.length;
 const currency=root.querySelector('[data-finance-currency]');if(currency){currency.innerHTML=(model.currencies.length?model.currencies:['RUB']).map(c=>`<option value="${c}">${c}</option>`).join('');currency.value=model.currency;}
 root.querySelectorAll('[data-finance-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.financePeriod===model.range.key)));
 root.querySelectorAll('[data-finance-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.financeGroup===model.group)));
 const custom=root.querySelector('[data-finance-custom]');if(custom)custom.hidden=model.range.key!=='custom';
 for(const key of ['from','to','search','status','size']){const n=root.querySelector('[data-finance-'+key+']'),value=key==='search'?financeUi.query:String(financeUi[key]);if(n&&n.value!==value)n.value=value;}
 const chart=root.querySelector('[data-finance-chart]');if(chart)chart.innerHTML=financeChart(model);
 set('chart-note',model.chartTruncated?'На графике последние 120 интервалов; итоговые суммы относятся ко всему выбранному периоду.':'Пропуски в линии прибыли означают неполные расходы. Дни без заказов показаны нулевыми.');
 const notes=[];if(model.range.error)notes.push(model.range.error);if(!['all','undated'].includes(model.range.key)&&model.undated)notes.push(model.undated+' заказов без точной даты не включены в период.');if(model.unknownCurrency)notes.push(model.unknownCurrency+' заказов без подтверждённой валюты не включены в суммы.');if(model.archive?.truncated)notes.push(`Загружено ${model.orders.length} из ${model.archive.total} сохранённых заказов. Итоги относятся к загруженной части истории.`);set('filter-note',notes.join(' '));
 const table=root.querySelector('[data-finance-rows]');if(table)table.innerHTML=model.rows.length?financeRowsMarkup(model):`<tr><td colspan="8" class="fin-empty">${!financeAllowed()?'Активируйте подписку или пробный период для просмотра финансов.':!selectedStore()?.id?'Подключите магазин FunPay, чтобы получить финансовый отчёт.':!model.loaded?'Нажмите «Обновить отчёт», чтобы загрузить сохранённую историю.':model.range.error?financeEscape(model.range.error):'По выбранным условиям заказов нет. Измените период или фильтры.'}</td></tr>`;
 set('table-count',model.loaded?`${model.filtered.length} заказов · ${model.currency}`:'Нет данных');set('page-label',model.page+' / '+model.pages);
 root.querySelectorAll('[data-finance-page]').forEach(b=>{b.disabled=b.dataset.financePage==='prev'?model.page<=1:model.page>=model.pages;});
 return model;
}
async function loadFinanceWorkspace({force=false}={}){
 renderFinanceWorkspace();if(!financeAllowed()||!selectedStore()?.id||financeUi.busy||financeUi.saving||!force&&financeUi.data&&Date.now()-financeUi.loadedAt<30000)return;
 const scope=financeScope(),request=++financeUi.request,controller=new AbortController();financeUi.read=controller;financeUi.busy=true;financeUi.error='';renderFinanceWorkspace();
 const timer=setTimeout(()=>controller.abort(),15000),current=()=>scope===financeScope()&&request===financeUi.request&&financeAllowed();
 try{const data=await apiRequest('/api/v1/finance/report?storeId='+encodeURIComponent(selectedStore().id),{authenticated:true,signal:controller.signal});if(!current())return;if(data?.schema!==1||data.storeId!==String(selectedStore()?.id)||!Array.isArray(data.orders)||data.orders.length>5000||!Number.isFinite(Date.parse(data.generatedAt)))throw Error('Не удалось подтвердить финансовый отчёт этого магазина.');financeUi.data=data;financeUi.loadedAt=Date.now();}
 catch(e){if(current()){if(e.code==='PLAN_REQUIRED'||e.code==='FINANCE_STORE_CHANGED')financeUi.data=null;financeUi.error=e.code==='HTTP_404'?'Обновите серверную часть ZetSlay для финансового отчёта.':controller.signal.aborted?'Истекло время загрузки отчёта. Повторите обновление.':humanError(e);if(financeUi.data)financeUi.error+=' Показан предыдущий отчёт.';}}
 finally{clearTimeout(timer);if(scope===financeScope()&&request===financeUi.request){financeUi.busy=false;financeUi.read=null;renderFinanceWorkspace();}}
}
function openFinanceCosts(id){
 if(!financeAllowed()||financeUi.busy||financeUi.saving)return;const row=financeUi.data?.orders.find(r=>r.id===id);if(!row||!FINANCE_CURRENCIES.includes(row.currency))return;
 financeCloseCosts();const d=document.createElement('dialog'),scope=financeScope(),auto=row.autoCostMinor!==null,format=v=>financeAmount(v)?(v/100).toFixed(2):'';d.className='fin-cost-dialog';d.setAttribute('aria-labelledby','fin-cost-title');
 const field=(name,label,value,required=true)=>`<label>${label}<input name="${name}" inputmode="decimal" autocomplete="off" value="${format(value)}" ${required?'required':''} placeholder="Если расхода нет — 0"></label>`;
 d.innerHTML=`<header><div><span class="fin-eyebrow">УЧЁТ · #${financeEscape(id)}</span><h2 id="fin-cost-title">Расходы по заказу</h2></div><button class="icon-button" type="button" data-finance-close aria-label="Закрыть">${icon('close')}</button></header><p>Все суммы в ${row.currency}. Это запись для расчёта прибыли: деньги не списываются, заказ FunPay не меняется. Если расхода нет, укажите 0.</p><form data-finance-cost-form><div class="fin-cost-fields"><label>Источник себестоимости<select name="source">${auto?`<option value="auto" ${row.manualCostMinor===null?'selected':''}>Подтверждённые расходы Kosell · ${financeEscape(financeMoney(row.autoCostMinor,row.currency))}</option>`:''}<option value="manual" ${!auto||row.manualCostMinor!==null?'selected':''}>Указать себестоимость вручную</option></select></label>${field('cost','Себестоимость',row.manualCostMinor??row.costMinor,!auto||row.manualCostMinor!==null)}${field('fee','Комиссия FunPay',row.feeMinor)}${field('other','Прочие расходы',row.otherMinor)}${field('tax','Налог по заказу',row.taxMinor)}${row.status==='partially_refunded'?field('refund','Сумма частичного возврата',row.refundMinor):''}</div><p>${auto?'При выборе Kosell подтверждённые дополнительные часы и бонусы добавляются к себестоимости автоматически.':'Себестоимость других поставщиков и собственного товара укажите вручную.'} Комиссии и налог не угадываются: используйте фактические данные своего магазина.</p><p data-finance-cost-result role="status" aria-live="polite"></p><footer><button type="button" class="button button--ghost" data-finance-close>Отмена</button><button type="submit" class="button button--primary">Сохранить расходы</button></footer></form>`;
 const form=d.querySelector('form'),source=form.elements.source,cost=form.elements.cost,update=()=>{cost.disabled=source.value==='auto';cost.required=source.value!=='auto';};source.addEventListener('change',update);update();
 form.addEventListener('submit',async e=>{e.preventDefault();if(financeUi.saving||financeUi.busy||scope!==financeScope()||!financeAllowed())return;const result=form.querySelector('[data-finance-cost-result]'),button=form.querySelector('[type="submit"]'),values=Object.fromEntries(new FormData(form));
  const payload={storeId:String(selectedStore().id),orderId:row.id,currency:row.currency,version:row.version,costMinor:values.source==='auto'?null:financeParseMoney(values.cost),feeMinor:financeParseMoney(values.fee),otherMinor:financeParseMoney(values.other),taxMinor:financeParseMoney(values.tax),refundMinor:row.status==='partially_refunded'?financeParseMoney(values.refund):null};
  if([payload.feeMinor,payload.otherMinor,payload.taxMinor].some(v=>v===null)||values.source!=='auto'&&payload.costMinor===null||row.status==='partially_refunded'&&payload.refundMinor===null){result.textContent='Заполните суммы: неотрицательное число, до двух знаков после запятой. Нулевые расходы укажите явно.';return;}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);financeUi.write=controller;financeUi.saving=true;button.disabled=true;result.textContent='Сохраняем расходы…';
  try{await apiRequest('/api/v1/finance/order-costs',{authenticated:true,method:'POST',body:payload,signal:controller.signal});if(scope!==financeScope()||!financeAllowed())return;financeCloseCosts();financeUi.loadedAt=0;financeUi.saving=false;await loadFinanceWorkspace({force:true});}
  catch(error){if(scope===financeScope()&&d.isConnected)result.textContent=controller.signal.aborted?'Ответ не получен. Обновите отчёт и проверьте сохранённые расходы перед повтором.':humanError(error);}
  finally{clearTimeout(timer);if(scope===financeScope()){financeUi.saving=false;financeUi.write=null;if(d.isConnected)button.disabled=false;renderFinanceWorkspace();}}
 });
 d.addEventListener('click',e=>{if(e.target.closest('[data-finance-close]'))financeCloseCosts();});d.addEventListener('close',()=>{if(financeUi.dialog===d)financeUi.dialog=null;d.remove();});document.querySelector('[data-finance-workspace]').append(d);financeUi.dialog=d;d.showModal();
}
document.addEventListener('click',event=>{
 const root=event.target.closest?.('[data-finance-workspace]');if(!root)return;const b=event.target.closest('button');if(!b||b.disabled)return;
 if(b.hasAttribute('data-finance-refresh')){void loadFinanceWorkspace({force:true});return;}
 if(b.hasAttribute('data-finance-costs')){openFinanceCosts(b.dataset.financeCosts);return;}
 if(b.hasAttribute('data-finance-period')){financeUi.period=b.dataset.financePeriod;financeUi.page=1;}
 else if(b.hasAttribute('data-finance-group'))financeUi.group=b.dataset.financeGroup;
 else if(b.hasAttribute('data-finance-missing')){financeUi.status='missing';financeUi.page=1;root.querySelector('[data-finance-status]')?.focus();}
 else if(b.hasAttribute('data-finance-page'))financeUi.page+=b.dataset.financePage==='next'?1:-1;
 else if(b.hasAttribute('data-finance-reset'))Object.assign(financeUi,{period:'last30',from:'',to:'',query:'',status:'all',page:1});
 else if(b.hasAttribute('data-finance-export')){const model=buildFinanceModel(financeUi.data,financeUi);if(!financeAllowed()||!model.filtered.length)return;const url=URL.createObjectURL(new Blob([financeCsv(model.filtered,model.currency)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='zetslay-finance-'+model.currency+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
 renderFinanceWorkspace();
});
for(const type of ['input','change'])document.addEventListener(type,e=>{if(!e.target.closest?.('[data-finance-workspace]'))return;for(const [selector,key] of [['[data-finance-search]','query'],['[data-finance-currency]','currency'],['[data-finance-status]','status'],['[data-finance-size]','size'],['[data-finance-from]','from'],['[data-finance-to]','to']])if(e.target.matches(selector)){financeUi[key]=e.target.value;if(['from','to'].includes(key))financeUi.period='custom';financeUi.page=1;renderFinanceWorkspace();return;}});
if(document.querySelector('[data-finance-workspace]')){
 const previousSetView=setView;setView=function(...args){const result=previousSetView.apply(this,args);renderFinanceWorkspace();if(!document.querySelector('[data-finance-workspace]').hidden)void loadFinanceWorkspace();else financeCloseCosts();return result;};
 const previousReset=resetAccountData;resetAccountData=function(...args){resetFinanceWorkspace();return previousReset.apply(this,args);};
 const previousFleet=renderStoreFleet;renderStoreFleet=function(...args){const result=previousFleet.apply(this,args);renderFinanceWorkspace();if(!document.querySelector('[data-finance-workspace]').hidden)void loadFinanceWorkspace();return result;};
 const previousAccess=subscriptionApply;subscriptionApply=function(...args){const result=previousAccess.apply(this,args);renderFinanceWorkspace();if(!document.querySelector('[data-finance-workspace]').hidden)void loadFinanceWorkspace();return result;};
 renderFinanceWorkspace();if(!document.querySelector('[data-finance-workspace]').hidden)void loadFinanceWorkspace();
}

window.addEventListener('resize',()=>{const root=document.querySelector('[data-finance-workspace]');if(root&&!root.hidden)renderFinanceWorkspace();});
