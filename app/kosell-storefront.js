// Category-based catalogue. Existing template tools remain available below.
const kosellLegacyCatalogMarkup=kosellCatalogMarkup;
let kosellStorefrontUi={};
const sfQueuePoll={timer:null,scope:"",reading:false};
// Keep each submitted plan within the existing server limit; selection spans the full catalogue.
const SF_BATCH_SIZE=50;
const SF_READ_LIMITS={requestMs:90000,maxStalledSteps:3};
function sfAbortReads(u){for(const flight of u?.readFlights||[])flight.cancel(Object.assign(Error('Ожидание подготовки остановлено.'),{code:'SF_READ_CANCELLED'}));}
async function sfBoundedRead(path,options,u){
 const controller=new AbortController();let timer,rejectWait;
 const stopped=new Promise((_,reject)=>{rejectWait=reject;});
 const flight={cancel(error){if(controller.signal.aborted)return;controller.abort(error);rejectWait(error);}};
 u.readFlights??=new Set();u.readFlights.add(flight);
 timer=setTimeout(()=>flight.cancel(Object.assign(Error('Сервер не ответил вовремя. Проверьте сохранённый прогресс или повторите загрузку параметров.'),{code:'SF_READ_TIMEOUT'})),SF_READ_LIMITS.requestMs);
 try{return await Promise.race([apiRequest(path,{...options,signal:controller.signal}),stopped]);}
 finally{clearTimeout(timer);controller.abort();u.readFlights.delete(flight);}
}
const sfBatch=()=>sfState().entries.slice(0,SF_BATCH_SIZE);
const sfAvailableProducts=()=>{const seen=new Set();return (sfState().sources?.products||[]).filter(p=>Number.isSafeInteger(p.id)&&p.id>0&&Number.isSafeInteger(p.availableAccounts)&&p.availableAccounts>0&&!seen.has(p.id)&&seen.add(p.id));};
const sfEntry=product=>({productId:product.id,productName:product.name,nodeId:product.nodeId,fields:{},form:null,error:'',expanded:false});
const sfEscape=value=>escapeHtml(String(value??''));
const sfScope=()=>[authState.token,kosellUi.status?.storeId||'',typeof sessionGeneration==='undefined'?'':sessionGeneration].join(':');
function sfState(){const scope=sfScope();if(kosellStorefrontUi.scope!==scope){sfAbortReads(kosellStorefrontUi);kosellStorefrontUi={scope,sources:null,entries:[],query:'',limit:40,durations:'1, 3, 24, 72',activate:false,reviewed:false,error:'',message:'',busy:false,wait:null,preparation:kosellUi.status?.storefrontPreparation||null,plan:null,run:0};}return kosellStorefrontUi;}
const sfCategoryLabel=c=>`${c.game} · ${c.name} (#${c.nodeId})`;
const sfRequired=c=>c.required===true||['server_id','fields[game]','fields[platform]','fields[type]'].includes(c.name)&&c.kind==='select'&&c.options.some(o=>o.value.trim());
const sfEntryReady=e=>!!e.form&&!e.loading&&!e.error&&e.form.controls.every(c=>{const v=e.fields[c.name]??'';return (!sfRequired(c)||!!v.trim())&&(c.kind!=='select'||c.options.some(o=>o.value===v));});
function sfInvalidate(){const u=sfState();sfMessage('');u.plan=null;u.reviewed=false;if(u.preparation?.state==='ready')u.preparation.state='edited';u.message='';const review=document.querySelector('[data-sf-reviewed]');if(review)review.checked=false;document.querySelector('[data-kosell-storefront] .sf-plan')?.remove?.();}
function sfControl(c,e){const v=e.fields[c.name]??'',base=`data-sf-field="${sfEscape(c.name)}" data-sf-product="${e.productId}" ${sfState().busy?'disabled':''}`;if(c.hidden)return '';if(c.kind==='checkbox')return `<label class="sf-check"><input type="checkbox" ${base} value="${sfEscape(c.checkedValue)}" ${v?'checked':''}>${sfEscape(c.label)}</label>`;return `<label>${sfEscape(c.label)}${sfRequired(c)?' <span aria-label="обязательное поле">*</span>':''}${c.kind==='select'?`<select ${base}><option value="" ${v===''?'selected':''}>Выберите значение</option>${c.options.filter(o=>o.value).map(o=>`<option value="${sfEscape(o.value)}" ${o.value===v?'selected':''}>${sfEscape(o.label)}</option>`).join('')}</select>`:`<input ${base} type="${c.kind==='number'?'number':'text'}" maxlength="${c.maxLength||2000}" value="${sfEscape(v)}">`}</label>`;}
function sfProducts(){const u=sfState();if(!u.sources)return '';const found=u.sources.products.filter(p=>p.name.toLocaleLowerCase().includes(u.query.toLocaleLowerCase())),selected=new Set(u.entries.map(e=>e.productId));return `<div class="sf-product-list">${found.slice(0,u.limit).map(p=>{const c=u.sources.categories.find(c=>c.nodeId===p.nodeId);return `<label class="sf-product"><input type="checkbox" data-sf-select="${p.id}" ${selected.has(p.id)?'checked':''} ${u.busy?'disabled':''}><span><strong>${sfEscape(p.name)}</strong><small>${c?sfEscape(c.game+' · '+c.name):'Выберите категорию после добавления'}</small></span><span class="sf-stock">${Number.isInteger(p.availableAccounts)?p.availableAccounts+' в наличии':'—'}</span></label>`;}).join('')||'<p class="kosell-hint">Игр по этому запросу нет.</p>'}</div>${found.length>u.limit?'<button type="button" class="button button--ghost" data-sf-action="more">Показать ещё</button>':''}`;}
function sfSelections(){const u=sfState();return sfBatch().map(e=>{const ready=sfEntryReady(e),c=u.sources?.categories.find(c=>c.nodeId===e.nodeId),label=c?sfCategoryLabel(c):'';return `<article class="sf-selection ${ready?'is-ready':'needs-review'}"><header><div><strong>${sfEscape(e.productName)}</strong><small>${e.loading?'Читаем параметры FunPay…':e.error?sfEscape(e.error):ready?'Параметры готовы':'Уточните категорию или параметры'}</small></div><button type="button" class="sf-remove" data-sf-remove="${e.productId}" aria-label="Убрать ${sfEscape(e.productName)}" ${u.busy?'disabled':''}>×</button></header><label>Категория FunPay<input list="sf-categories" data-sf-category="${e.productId}" value="${sfEscape(label)}" placeholder="Начните вводить название игры или категории" ${u.busy?'disabled':''}></label>${e.nodeId&&!e.form&&!e.loading?`<button class="button button--ghost" type="button" data-sf-read="${e.productId}" ${u.busy?'disabled':''}>Загрузить параметры</button>`:''}${e.form?`<button type="button" class="sf-parameters" data-sf-expand="${e.productId}" ${u.busy?'disabled':''}>${e.expanded?'Скрыть параметры':'Параметры категории'} · ${e.form.controls.filter(c=>!c.hidden).length}</button>${e.expanded||!ready?`<div class="sf-fields">${e.form.controls.map(c=>sfControl(c,e)).join('')}</div>`:`<p class="sf-values">${e.form.controls.filter(c=>!c.hidden).map(c=>sfEscape(c.kind==='select'?c.options.find(o=>o.value===e.fields[c.name])?.label:e.fields[c.name])).filter(Boolean).join(' · ')||'Дополнительных полей нет'}</p>`}`:''}</article>`;}).join('');}
function sfPlan(p){const u=sfState(),expired=u.preparation?.approvalExpired===true,draftExpired=u.preparation?.draftExpired===true;return `<section class="sf-plan"><h4>Проверьте витрину перед созданием</h4><p>Новых лотов: ${p.items.length} · пропущено: ${p.skipped.length} · ${p.activate?'активация после проверки':'создание выключенными'}</p><div class="sf-plan-list">${p.items.slice(0,u.planLimit||50).map(i=>`<article><span><strong>${sfEscape(i.productName)} · ${i.hours} ч</strong><small>${sfEscape(i.categoryTitle||'Категория #'+i.nodeId)}</small></span><strong>${kosellMoney(i.priceMinor,p.currency)}</strong></article>`).join('')}</div>${p.items.length>(u.planLimit||50)?'<button type="button" class="button button--ghost" data-sf-more-plan>Показать ещё строки плана</button>':''}${p.skipped.length?`<details><summary>Пропущенные сроки (${p.skipped.length})</summary>${p.skipped.map(i=>`<p>Игра #${sfEscape(i.productId)} · ${sfEscape(i.hours)} ч — ${sfEscape({exists:'уже есть привязка или задание',duration:'срок недоступен',archived:'привязка в архиве',section_limit:'лимит категории',spend_limit:'себестоимость выше лимита одной покупки'}[i.reason]||'пропущено')}</p>`).join('')}</details>`:''}<p class="kosell-hint">План хранится 24 часа после готовности. На подтверждение — 30 минут после готовности или обновления. Перед созданием повторно проверяются себестоимость и категория. Покупка аренды не выполняется. ${p.activate?'Новые лоты включатся после проверки создания.':'Новые лоты будут выключены.'}</p>${p.items.length?`${expired?'<p class="sf-error">Срок подтверждения закончился. Сам план сохранён — обновите подтверждение без повторного расчёта.</p>':''}${draftExpired?'<p class="sf-error">Срок хранения плана закончился. Нужен новый расчёт.</p>':`${!expired?`<button type="button" class="button button--primary" data-sf-action="confirm">Создать лоты (${p.items.length})</button>`:''}<button type="button" class="button button--ghost" data-sf-action="renew">Обновить подтверждение без пересчёта</button>`}`:`<p>Новых лотов нет — измените игры или сроки.</p>${sfState().entries.length>SF_BATCH_SIZE?'<button type="button" class="button button--ghost" data-sf-action="next-batch">Перейти к следующим играм</button>':''}`}</section>`;}
function sfCategoryReadError(error){
 if(error?.code==='INVALID_STATE'){
  if(error.message==='Подключение временно занято')return 'Магазин занят другой операцией. Повторите загрузку параметров позже.';
  if(['Проверьте подключение магазина','Разрешение отозвано','Подключение магазина изменилось'].includes(error.message))return 'Подключение или разрешения магазина изменились. Проверьте подключение в настройках.';
  return 'Не удалось проверить форму этой категории FunPay. Нужна повторная загрузка или диагностика категории.';
 }
 return humanError(error);
}
function sfCatalogFallbacks(){
 const groups=new Map();for(const e of sfBatch())if(e.form&&!e.loading&&!e.error){
  for(const f of sfRepairFallbacks({form:e.form,gameFallbacks:e.form.gameFallbacks})){
   if(!sfFallbackEligible({fields:e.fields,gameMatches:e.form.gameMatches},f))continue;
   const key=JSON.stringify([e.nodeId,f.name,f.value,f.label]);if(!groups.has(key))groups.set(key,{...f,nodeId:e.nodeId,entries:[]});groups.get(key).entries.push(e);
  }
 }return [...groups.values()];
}
function sfApplyCatalogFallback(index){
 const u=sfState();if(u.busy||!Number.isInteger(index))return;const group=sfCatalogFallbacks()[index];if(!group)return;
 sfInvalidate();for(const e of group.entries){e.fields[group.name]=group.value;e.expanded=!sfEntryReady(e);}
 u.message=`Для ${group.entries.length} игр выбран общий вариант «${group.label}». Проверьте сводку перед подготовкой.`;sfRefresh();
}
function sfBlockers(){
 const u=sfState(),batch=sfBatch(),pending=batch.filter(e=>!sfEntryReady(e));if(!pending.length)return '';
 const unloaded=pending.filter(e=>e.nodeId&&!e.form&&!e.loading).length,manual=pending.filter(e=>!e.nodeId).length,fields=pending.filter(e=>e.form&&!e.loading).length;
 return `<div class="sf-blockers" role="status"><strong>План пока не готов: проверьте ${pending.length} из ${batch.length} игр${u.entries.length>SF_BATCH_SIZE?' текущей партии':''}</strong><p>${[unloaded?`Не загружены параметры: ${unloaded}`:'',manual?`Не выбрана категория: ${manual}`:'',fields?`Не заполнены поля: ${fields}`:'',pending.some(e=>e.loading)?'Параметры загружаются':'' ].filter(Boolean).join(' · ')}. Запуск станет доступен после проверки игр текущей партии.</p>${sfCatalogFallbacks().map((g,i)=>`<p>FunPay предлагает общий вариант «${sfEscape(g.label)}» для игр без совпадения. Полные названия останутся в лотах.</p><button type="button" class="button button--ghost" data-sf-catalog-fallback="${i}" ${u.busy?'disabled':''}>Для ${g.entries.length} игр выбрать «${sfEscape(g.label)}»</button>`).join('')}${unloaded?`<button type="button" class="button button--ghost" data-sf-action="retry-fields" ${u.busy?'disabled':''}>Загрузить недостающие параметры (${unloaded})</button>`:''}</div>`;
}
async function sfRetryFields(){
 const u=sfState();if(u.busy)return;const scope=u.scope,run=++u.run,entries=sfBatch().filter(e=>e.nodeId&&!e.form&&!e.loading);let stopped='';sfInvalidate();u.busy=true;sfRefresh();
 try{for(const e of entries){if(scope!==sfScope()||run!==u.run||!document.querySelector('[data-kosell-storefront]'))break;if(u.entries.includes(e)){await sfRead(e);if(e.retryExhausted){stopped=e.error;break;}}}}
 finally{if(scope===sfScope()&&run===u.run){u.busy=false;sfMessage(stopped||`Параметры готовы: ${sfBatch().filter(sfEntryReady).length} из ${sfBatch().length}. Проверьте категории и оставшиеся поля.`,Boolean(stopped));sfRefresh();}}
}
const sfRepairOption=(o,c)=>{const label=o.label.trim()||o.value;return c?.options.filter(x=>x.value&&(x.label.trim()||x.value)===label).length>1?`${label} · ${o.value}`:label;};
const sfRepairEntryReady=(p,e)=>p.form.controls.every(c=>{const v=e.fields[c.name]??'';return (!sfRequired(c)||!!v.trim())&&(c.kind!=='select'||c.options.some(o=>o.value===v));});
function sfRepairControl(c,e,i){
 if(c.hidden)return '';const value=e.fields[c.name]??'',base=`data-sf-repair-field="${sfEscape(c.name)}" data-sf-repair-product="${e.productId}" ${sfState().busy?'disabled':''}`,label=`${sfEscape(c.label)}${sfRequired(c)?' *':''}`;
 if(c.kind==='checkbox')return `<label class="sf-check"><input type="checkbox" ${base} value="${sfEscape(c.checkedValue)}" ${value?'checked':''}>${label}</label>`;
 if(c.kind==='select'){
  if(c.options.length<=30)return `<label>${label}<select ${base}><option value="">Выберите значение</option>${c.options.filter(o=>o.value).map(o=>`<option value="${sfEscape(o.value)}" ${o.value===value?'selected':''}>${sfEscape(o.label.trim()||o.value)}</option>`).join('')}</select></label>`;
  const selected=value?c.options.find(o=>o.value===value):null;
  return `<label>${label}<input ${base} list="sf-repair-options-${i}" placeholder="Найти и выбрать игру" autocomplete="off" maxlength="2300" value="${sfEscape(selected?sfRepairOption(selected,c):'')}"></label>`;
 }
 return `<label>${label}<input ${base} type="${c.kind==='number'?'number':'text'}" maxlength="${c.maxLength||2000}" value="${sfEscape(value)}"></label>`;
}
function sfRepairFallbacks(p){
 return (Array.isArray(p.gameFallbacks)?p.gameFallbacks:[]).filter(f=>f&&['server_id','fields[game]'].includes(f.name)&&p.form.controls.some(c=>c.name===f.name&&c.kind==='select'&&c.options.some(o=>o.value===f.value&&o.label===f.label)));
}
const sfFallbackEligible=(e,f)=>!e.fields[f.name]&&e.gameMatches?.[f.name]?.status==='missing';
function sfApplyGameFallback(name){
 const u=sfState(),p=u.repair;if(u.busy||!p)return;const f=sfRepairFallbacks(p).find(f=>f.name===name);if(!f)return;
 let changed=0;for(const e of p.entries)if(sfFallbackEligible(e,f)){e.fields[f.name]=f.value;e.gameMatches[f.name]={status:'generic',value:f.value,label:f.label};changed++;}
 if(changed){p.reviewed=false;u.error='';u.message=`Для ${changed} игр выбран общий вариант FunPay «${f.label}». Названия игр в лотах сохранятся. Проверьте сводку и подтвердите сохранение.`;sfRefresh();}
}
function sfRepairGameRow(p,e){
 const matches=Object.values(e.gameMatches||{}),generic=matches.some(m=>m.status==='generic'),edition=matches.some(m=>m.status==='edition'),ambiguous=matches.some(m=>m.status==='ambiguous');
 const info=generic?'Общий вариант FunPay':edition?'Сопоставлено с учётом издания и нумерации':ambiguous?'Несколько вариантов — проверьте игру':'';
 return `<div class="sf-queue-fields-game"><header><strong>${sfEscape(e.productName)}</strong><span>${e.jobs} заданий</span></header>${info?`<p class="sf-match-note">${info}</p>`:''}<div class="sf-fields">${p.form.controls.map((c,i)=>sfRepairControl(c,e,i)).join('')}</div></div>`;
}
function sfQueueFieldsMarkup(h){
 const u=sfState(),p=u.repair;if(h.probePending)return '';
 if(!p||p.nodeId!==h.nodeId||p.afterJobId!==h.afterJobId)return `<button type="button" class="button button--primary sf-queue-fields-button" data-sf-queue-fields="${sfEscape(h.nodeId)}" data-after="${sfEscape(h.afterJobId)}" ${u.busy?'disabled':''}>Проверить и исправить параметры очереди</button>`;
 const complete=p.entries.filter(e=>sfRepairEntryReady(p,e)),pending=p.entries.filter(e=>!sfRepairEntryReady(p,e)),ready=complete.length;
 const fallbacks=sfRepairFallbacks(p).map(f=>({f,count:p.entries.filter(e=>sfFallbackEligible(e,f)).length})).filter(x=>x.count);
 return `<form data-sf-queue-fields-save class="sf-queue-fields"><h5>Сопоставление игр</h5><p>${sfEscape(p.form.categoryTitle)} · ${p.jobs} заданий. Цены и сроки сохранятся. Совпадения уже заполнены; проверьте общую сводку.</p>${fallbacks.map(({f,count})=>`<div class="sf-match-fallback"><p>Для ${count} игр нет однозначного совпадения по названию. В списке FunPay есть «${sfEscape(f.label)}»: этот вариант можно применить ко всем оставшимся играм. Полное название каждой игры останется в её лоте.</p><button type="button" class="button button--ghost" data-sf-game-fallback="${sfEscape(f.name)}" ${u.busy?'disabled':''}>Для ${count} игр выбрать «${sfEscape(f.label)}»</button></div>`).join('')}${p.form.controls.map((c,i)=>c.kind==='select'&&c.options.length>30?`<datalist id="sf-repair-options-${i}">${c.options.filter(o=>o.value).map(o=>`<option value="${sfEscape(sfRepairOption(o,c))}"></option>`).join('')}</datalist>`:'').join('')}<div class="sf-queue-fields-list">${pending.map(e=>sfRepairGameRow(p,e)).join('')}${complete.length?`<details class="sf-matched-games"><summary>Готово к сохранению: ${complete.length} из ${p.entries.length} игр · посмотреть соответствия</summary>${complete.map(e=>sfRepairGameRow(p,e)).join('')}</details>`:''}</div><p role="status">Параметры готовы: ${ready} из ${p.entries.length} игр</p><label class="sf-check"><input type="checkbox" name="confirm" data-sf-repair-review ${p.reviewed?'checked':''} ${u.busy?'disabled':''}>Параметры проверены — сохранить для ожидающих заданий</label><div class="sf-queue-fields-actions"><button type="submit" class="button button--primary" ${u.busy||ready!==p.entries.length||!p.reviewed?'disabled':''}>Сохранить параметры очереди</button><button type="button" class="button button--ghost" data-sf-repair-close ${u.busy?'disabled':''}>Закрыть</button></div><small>Выбор сохранится для следующих запусков. После сохранения можно отдельно проверить создание одного лота.</small></form>`;
}
async function sfLoadQueueFields(button){
 const u=sfState();if(u.busy)return;const hold=kosellUi.status?.offerCreationQueue?.holds?.find(h=>h.nodeId===button.dataset.sfQueueFields&&h.afterJobId===button.dataset.after&&!h.probePending);if(!hold)return;
 const scope=u.scope,run=++u.run;u.busy=true;u.error='';u.repair=null;u.openHold=hold.nodeId;sfRefresh();
 try{
  const p=await sfReadRequest('/api/v1/plugins/kosell-rent/storefront/queue-fields',{method:'POST',authenticated:true,body:{nodeId:hold.nodeId,afterJobId:hold.afterJobId}},u,()=>scope===sfScope()&&run===u.run&&!!document.querySelector('[data-kosell-storefront]'));
  if(scope!==sfScope()||run!==u.run)return;
  if(p?.nodeId!==hold.nodeId||p.afterJobId!==hold.afterJobId||!Array.isArray(p.form?.controls)||p.form.controls.length>40||!p.form.controls.every(c=>c&&typeof c.name==='string'&&['select','text','number','checkbox'].includes(c.kind)&&(c.kind!=='select'||Array.isArray(c.options)&&c.options.length<=10000&&c.options.every(o=>o&&typeof o.value==='string'&&typeof o.label==='string')))||!Array.isArray(p.entries)||!p.entries.length||p.entries.length>1000||!p.entries.every(e=>e&&Number.isSafeInteger(e.productId)&&e.productId>0&&Number.isSafeInteger(e.jobs)&&e.jobs>0&&e.fields&&typeof e.fields==='object'&&!Array.isArray(e.fields)&&Object.values(e.fields).every(v=>typeof v==='string'))||new Set(p.entries.map(e=>e.productId)).size!==p.entries.length||!Number.isSafeInteger(p.jobs)||p.jobs<1||p.jobs>1000||p.entries.reduce((n,e)=>n+e.jobs,0)!==p.jobs||!/^[a-f0-9]{64}$/.test(p.queueFingerprint||'')||!/^[a-f0-9]{64}$/.test(p.form.fingerprint||''))throw Error('Параметры очереди не подтверждены. Обновите данные.');
  u.repair={...p,entries:p.entries.map(e=>({...e,fields:{...e.fields}})),reviewed:false};u.message='Проверьте соответствие игр FunPay перед сохранением параметров.';
 }catch(error){if(scope===sfScope()&&run===u.run)u.error=humanError(error);}
 finally{if(scope===sfScope()&&run===u.run){u.busy=false;sfRefresh();}}
}
async function sfSaveQueueFields(form){
 const u=sfState(),p=u.repair;if(u.busy||!p)return;
 if(!p.reviewed||form.querySelector('[name="confirm"]')?.checked!==true||!p.entries.every(e=>sfRepairEntryReady(p,e))){sfMessage('Выберите параметры всех игр и подтвердите проверку.',true);return;}
 const scope=u.scope,run=++u.run;u.busy=true;u.error='';sfRefresh();
 try{
  const result=await apiRequest('/api/v1/plugins/kosell-rent/storefront/queue-fields/save',{method:'POST',authenticated:true,body:{nodeId:p.nodeId,afterJobId:p.afterJobId,queueFingerprint:p.queueFingerprint,formFingerprint:p.form.fingerprint,entries:p.entries.map(e=>({productId:e.productId,fields:{...e.fields}})),confirm:true}});
  if(scope!==sfScope()||run!==u.run)return;
  if(result?.saved!==true||result.nodeId!==p.nodeId||!Number.isSafeInteger(result.updated)||result.updated<1||result.updated>p.jobs)throw Error('Сохранение не подтверждено. Загрузите состояние очереди.');
  u.repair=null;await loadKosellStatus(true);if(scope!==sfScope()||run!==u.run)return;u.message=`Параметры исправлены в ${result.updated} заданиях. Теперь разрешите проверку на одном лоте.`;
 }catch(error){if(scope===sfScope()&&run===u.run)u.error=humanError(error);}
 finally{if(scope===sfScope()&&run===u.run){u.busy=false;sfRefresh();}}
}
function sfCreationQueue(s){
 const holds=s.offerCreationQueue?.holds;if(!Array.isArray(holds)||!holds.length)return '';
 const u=sfState(),opened=Object.hasOwn(u,'openHold')?u.openHold:u.repair?.nodeId||holds[0].nodeId,probing=holds.some(h=>h.probePending);
 return `<section class="sf-creation-holds" aria-label="Пауза создания лотов"><h4>${probing?'Пробное создание лота':'Создание требует проверки'}</h4><p>${probing?'Разрешение на пробу получено. Результат создания ещё не подтверждён.':'FunPay отклонил параметры. Категорий на проверке: '+holds.length+'. Выберите категорию, исправьте поля и проверьте создание одного лота. Сохранённые цены и сроки остаются прежними.'}</p>${holds.map(h=>{
  const open=opened===h.nodeId,missing=h.missingParameterValues||h.missingGameValues||0;
  return `<article class="sf-creation-hold ${open?'is-open':''}"><button type="button" class="sf-hold-toggle" data-sf-hold="${sfEscape(h.nodeId)}" aria-expanded="${open}" aria-controls="sf-hold-${sfEscape(h.nodeId)}" ${u.busy?'disabled':''}><span><strong>${sfEscape(h.title||'Категория #'+h.nodeId)}</strong>${h.games?.length?`<small>${h.games.map(sfEscape).join(' · ')}</small>`:''}</span><span class="sf-hold-count">${Number.isSafeInteger(h.pending)?h.pending:0} в очереди <span aria-hidden="true">${open?'−':'+'}</span></span></button>${open?`<div id="sf-hold-${sfEscape(h.nodeId)}" class="sf-hold-body">${h.probePending?`<details class="sf-previous-failure"><summary>Предыдущая ошибка</summary><p>${sfEscape(h.message||'Проверьте параметры категории.')}</p></details>`:`<p>${sfEscape(h.message||'Проверьте параметры категории.')}</p>`}<a href="https://funpay.com/lots/${sfEscape(h.nodeId)}/trade" target="_blank" rel="noopener noreferrer">Открыть свои лоты в категории</a>${sfQueueFieldsMarkup(h)}${h.probePending?'<p class="sf-probe-pending" role="status">Один лот ожидает пробного создания. После успешной проверки очередь категории продолжится.</p>':missing>0?(u.repair?.nodeId===h.nodeId?'':`<p class="sf-queue-missing">Нужно заполнить параметры для ${missing} заданий.</p>`):`<form data-sf-creation-resume data-node="${sfEscape(h.nodeId)}" data-after="${sfEscape(h.afterJobId)}"><label class="sf-check"><input name="confirm" type="checkbox" required ${u.busy?'disabled':''}>Я проверил категорию и разрешаю пробное создание одного оставшегося лота</label><button type="submit" class="button button--ghost" ${u.busy?'disabled':''}>Проверить на одном лоте</button></form>`}</div>`:''}</article>`;
 }).join('')}<p class="sf-queue-footnote">Пробная проверка использует ещё не отправленное задание. Предыдущие неопределённые операции сохраняются отдельно.</p></section>`;
}
async function sfResumeCreation(form){
 const u=sfState();if(u.busy)return;
 if(form.querySelector('[name="confirm"]')?.checked!==true){sfMessage('Подтвердите проверку категории перед пробным запуском.',true);return;}
 const hold=kosellUi.status?.offerCreationQueue?.holds?.find(h=>h.nodeId===form.dataset.node&&h.afterJobId===form.dataset.after);
 if(!hold||hold.probePending||hold.missingParameterValues>0||hold.missingGameValues>0){sfMessage('Обновите состояние очереди перед пробным запуском.',true);return;}
 const scope=u.scope;u.busy=true;u.error='';sfRefresh();
 try{
  const result=await apiRequest('/api/v1/plugins/kosell-rent/offer-creation-resume',{method:'POST',authenticated:true,body:{nodeId:hold.nodeId,afterJobId:hold.afterJobId,confirm:true}});
  if(scope!==sfScope())return;if(result?.accepted!==true||result.nodeId!==hold.nodeId)throw Error('Разрешение не подтверждено. Обновите очередь перед новой попыткой.');
  await loadKosellStatus(true);if(scope!==sfScope())return;u.message='Разрешено пробное создание одного оставшегося лота. Следите за результатом в заданиях.';
 }catch(error){if(scope===sfScope())u.error=humanError(error);}
 finally{if(scope===sfScope()){u.busy=false;sfRefresh();}}
}
function sfInner(s){const u=sfState(),p=u.preparation,plan=u.plan||(p?.state==='ready'?p.plan:null),batch=sfBatch(),ready=batch.filter(sfEntryReady).length,available=sfAvailableProducts(),selected=new Set(u.entries.map(e=>e.productId));return `<div class="sf-wizard" data-sf-current="${sfStage()}"><div class="sf-heading"><div><span class="sf-eyebrow">АССОРТИМЕНТ KOSELL</span><h3>Массовая витрина</h3><p>Выберите игры. Категории и параметры загрузятся из FunPay — создавать лоты-образцы больше не нужно.</p></div><span class="sf-count">${u.entries.length||s.offerCreationQueue?.pending||0}<small>${u.entries.length?'выбрано игр':s.offerCreationQueue?.pending?'лотов в очереди':'выбрано игр'}</small></span></div><nav class="sf-wizard-nav" aria-label="Шаги создания витрины">${[['1','Игры'],['2','Параметры и сроки'],['3','План и создание']].map(([step,label])=>`<button type="button" data-sf-stage="${step}" aria-current="${sfStage()===step?'step':'false'}" ${u.busy||step==='2'&&!u.entries.length||step==='3'&&!p?'disabled':''}><span>${step}</span>${label}</button>`).join('')}</nav><p class="sf-feedback" data-sf-feedback role="${u.error?'alert':'status'}" aria-live="polite">${sfEscape(u.error||u.message)}</p>${u.wait?'<p class="sf-wait" data-sf-wait role="status" aria-live="polite">'+sfEscape(sfWaitText(u.wait))+'</p>':''}${u.error&&!u.busy?'<button type="button" class="button button--ghost" data-sf-action="recover">Проверить сохранённый прогресс</button>':''}${sfCreationQueue(s)}${sfQueueRefreshMarkup(s)}${u.busy&&!['preparing','confirming'].includes(u.preparation?.state)?'<button type="button" class="button button--ghost" data-sf-action="cancel">Прервать загрузку</button>':''}${!u.sources?`<div class="sf-load"><p>Загрузим доступные игры Kosell и категории FunPay вашего подключения.</p><button type="button" class="button button--primary" data-sf-action="load" ${u.busy?'disabled':''}>${u.busy?'Загружаем…':'Выбрать игры'}</button></div>`:`<div class="sf-columns"><section class="sf-games"><div class="sf-section-heading"><h4>Игры Kosell</h4><span>${u.sources.products.length}</span></div><input type="search" data-sf-search ${u.busy?'disabled':''} placeholder="Найти игру" aria-label="Найти игру Kosell" value="${sfEscape(u.query)}"><div class="sf-game-actions"><button type="button" class="sf-select-all" data-sf-action="select-all" ${u.busy||!available.some(p=>!selected.has(p.id))?'disabled':''}>Выбрать все доступные (${available.length})</button><button type="button" data-sf-action="select-found" ${u.busy?'disabled':''}>Добавить найденные</button><button type="button" data-sf-action="clear" ${u.busy?'disabled':''}>Снять выбор</button></div><p class="sf-selection-hint">Все доступные — игры с аккаунтами в наличии во всём каталоге, независимо от поиска. Один план включает до ${SF_BATCH_SIZE} игр.</p><div data-sf-products>${sfProducts()}</div><div class="sf-stage-footer"><span>Выбрано игр: ${u.entries.length}</span><button type="button" class="button button--primary" data-sf-stage="2" ${u.busy||!u.entries.length?'disabled':''}>Далее: параметры и сроки →</button></div></section><section class="sf-settings"><div class="sf-section-heading"><h4>Категории и параметры</h4><span>${ready}/${batch.length} готово${u.entries.length>SF_BATCH_SIZE?' · текущая партия':''}</span></div><datalist id="sf-categories">${u.sources.categories.map(c=>`<option value="${sfEscape(sfCategoryLabel(c))}"></option>`).join('')}</datalist><div class="sf-selections">${sfSelections()||'<div class="sf-empty">Добавьте игры из списка слева. Для каждой покажем категорию создания.</div>'}</div><div class="sf-common"><label>Сроки аренды, в часах<input data-sf-durations value="${sfEscape(u.durations)}" maxlength="100" ${u.busy?'disabled':''}></label><div class="sf-presets"><button type="button" data-sf-preset="1, 3, 6, 12" ${u.busy?'disabled':''}>1–12 часов</button><button type="button" data-sf-preset="1, 3, 24, 72" ${u.busy?'disabled':''}>Час / день / 3 дня</button><button type="button" data-sf-preset="1, 3, 24, 72, 168, 720" ${u.busy?'disabled':''}>До месяца</button></div><p class="kosell-hint">Цены рассчитываются по серверной себестоимости Kosell и вашей общей наценке ${Number(s.config?.markupPercent)||0}%. Комиссия FunPay не включена. RU/EN тексты берутся из настроек «Тексты новых предложений». Новые лоты создаются без изображений; они доступны в обычном редакторе FunPay.</p><label class="sf-check"><input type="checkbox" data-sf-activate ${u.activate?'checked':''} ${u.busy?'disabled':''}>Активировать после проверки создания</label><label class="sf-check"><input type="checkbox" data-sf-reviewed ${u.reviewed?'checked':''} ${u.busy?'disabled':''}>Категории и параметры ${u.entries.length>SF_BATCH_SIZE?'текущей партии':'выбранных игр'} проверены</label>${u.entries.length>SF_BATCH_SIZE?`<p class="sf-batch-note">В текущем плане — первые ${batch.length} игр. Ещё ${u.entries.length-batch.length} останутся выбранными для следующих партий. Каждая партия создаётся после отдельного подтверждения.</p>`:''}${sfBlockers()}<button type="button" class="button button--primary" data-sf-action="prepare" ${u.busy||!batch.length||ready!==batch.length||!u.reviewed?'disabled':''}>Подготовить план${u.entries.length>SF_BATCH_SIZE?' ('+batch.length+' игр)':''}</button></div></section></div>`}${p?.state==='preparing'?`<div class="sf-progress"><div><strong>Подготовка плана · ${p.completed}/${p.total}</strong><span>${sfEscape(p.game||'Завершаем расчёт')}</span></div><progress max="${p.total}" value="${p.completed}"></progress><p>Проверяем формы категорий и рассчитываем цены. Лоты ещё не создаются.</p>${!u.busy?'<button class="button button--ghost" type="button" data-sf-action="resume">Продолжить подготовку</button>':''}<button class="button button--ghost" type="button" data-sf-action="cancel">Остановить подготовку</button></div>`:''}${p?.state==='failed'?`<p class="sf-error">${sfEscape(p.error||'Подготовка остановлена. Проверьте параметры и начните заново.')}</p>`:''}${plan?sfPlan(plan):''}${sfQueueResults(s)}<p class="kosell-hint">Неоднозначные категории выбираются вручную. Существующие привязки и задания пропускаются.</p></div>`;}
function sfRefresh(){const root=document.querySelector('[data-kosell-storefront]');if(root)root.innerHTML=sfInner(kosellUi.status||{});sfWatchQueue();}
function sfMessage(message,error=false){const u=sfState();u.error=error?message:'';u.message=error?'':message;const node=document.querySelector('[data-sf-feedback]');if(node){node.textContent=message;node.setAttribute('role',error?'alert':'status');}}
kosellCatalogMarkup=function(s){sfWatchQueue();const legacy=kosellLegacyCatalogMarkup(s).replace('<h3>Массовая витрина</h3>','<h3>Создание по своим шаблонам</h3>');return `<section class="kosell-storefront" data-kosell-storefront>${sfInner(s)}</section><details class="sf-advanced"><summary>Дополнительно · использовать свои лоты-шаблоны</summary>${legacy}</details>`;};
async function sfLoad(){
 const u=sfState();if(u.busy)return;const scope=u.scope,run=++u.run,active=()=>sfScope()===scope&&run===u.run&&!!document.querySelector('[data-kosell-storefront]');
 u.busy=true;u.error='';sfRefresh();
 try{const data=await sfReadRequest('/api/v1/plugins/kosell-rent/storefront',{authenticated:true},u,active);if(!active())return;if(!data||!Array.isArray(data.products)||!Array.isArray(data.categories))throw Error('Не удалось получить полный каталог.');u.sources=data;u.preparation=data.preparation;u.entries=[];u.message='Выберите нужные игры. Параметры категории подберём при добавлении.';}
 catch(e){if(active())u.error=humanError(e);}
 finally{if(sfScope()===scope&&run===u.run){u.busy=false;u.wait=null;sfRefresh();}}
}
async function sfRecoverPreparation(){
 const u=sfState();if(u.busy)return;const scope=u.scope,run=++u.run,storeId=kosellUi.status?.storeId,active=()=>scope===sfScope()&&run===u.run&&!!document.querySelector('[data-kosell-storefront]');
 u.busy=true;u.error='';u.message='Проверяем сохранённый прогресс…';sfRefresh();
 try{
  const status=await sfReadRequest('/api/v1/plugins/kosell-rent/status',{authenticated:true},u,active);if(!active())return;
  if(!status||status.storeId!==storeId)throw Error('Сервис не подтвердил магазин сохранённого плана.');
  const p=status.storefrontPreparation;
  if(p!=null&&(!['preparing','ready','failed','cancelled','confirmed'].includes(p.state)||typeof p.token!=='string'||!Number.isSafeInteger(p.revision)||p.revision<0||p.state==='ready'&&!validateKosellCatalogPlan(p.plan)))throw Error('Сервис не подтвердил сохранённый прогресс.');
  u.preparation=p||null;u.plan=p?.state==='ready'?p.plan:null;if(p)u.stage='3';
  u.message=p?.state==='preparing'?'Сохранённый прогресс получен. Нажмите «Продолжить подготовку».':p?.state==='ready'?'Сохранённый план получен. Проверьте его перед созданием.':p?.state==='failed'?'Подготовка остановлена сервером: '+(p.error||'проверьте параметры и подготовьте план заново.'):p?'Состояние подготовки обновлено.':'На сервере пока нет сохранённой подготовки. Выбранные игры и параметры сохранены в этой вкладке.';
 }catch(error){if(active())u.error=humanError(error);}
 finally{if(scope===sfScope()&&run===u.run){u.busy=false;u.wait=null;sfRefresh();}}
}

async function sfRead(e){const u=sfState(),scope=u.scope,revision=(e.revision||0)+1;e.revision=revision;sfInvalidate();e.loading=true;e.error='';e.retryExhausted=false;sfRefresh();try{const run=u.run,active=()=>scope===sfScope()&&run===u.run&&u.entries.includes(e)&&e.revision===revision&&!!document.querySelector('[data-kosell-storefront]');const form=await sfReadRequest('/api/v1/plugins/kosell-rent/storefront/category',{method:'POST',authenticated:true,body:{productId:e.productId,nodeId:e.nodeId}},u,active);if(!active())return;if(scope!==sfScope()||!u.entries.includes(e)||e.revision!==revision)return;if(!form||!Array.isArray(form.controls)||!form.fields||typeof form.fingerprint!=='string')throw Error('FunPay не вернул параметры категории.');e.form=form;e.fields={...form.fields};e.expanded=form.missing?.length>0;}catch(error){if(scope===sfScope()&&e.revision===revision){e.form=null;e.error=sfCategoryReadError(error);e.retryExhausted=sfRetrySeconds(error)>0||['SF_READ_TIMEOUT','AUTH_REJECTED','INVALID_SESSION','PLAN_REQUIRED','NOT_FOUND','HTTP_404'].includes(error?.code)||String(error?.code||'').startsWith('KOSELL_');}}finally{if(scope===sfScope()&&e.revision===revision){e.loading=false;sfRefresh();}}}
async function sfSelectProducts(availableOnly=false){
 const u=sfState();if(u.busy||!u.sources)return;
 const candidates=availableOnly?sfAvailableProducts():u.sources.products.filter(p=>p.name.toLocaleLowerCase().includes(u.query.toLocaleLowerCase()));
 const selected=new Set(u.entries.map(e=>e.productId)),added=[];
 for(const product of candidates)if(!selected.has(product.id)){selected.add(product.id);added.push(sfEntry(product));}
 if(!added.length){sfMessage(availableOnly?'Все доступные игры уже выбраны.':'Найденные игры уже выбраны.');return;}
 const scope=u.scope;u.entries.push(...added);sfInvalidate();sfRefresh();
 const pending=sfRetryFields(),run=u.run;await pending;
 if(scope===sfScope()&&run===u.run&&!u.error){sfMessage(`Добавлено игр: ${added.length}. Всего выбрано: ${u.entries.length}. ${u.entries.length>SF_BATCH_SIZE?`Текущая партия — ${sfBatch().length} игр; остальные останутся выбранными для следующих планов.`:'Проверьте категории и параметры.'}`);sfRefresh();}
}
async function sfSelect(pid,selected,batch=false){const u=sfState();if(u.busy&&!batch)return;if(!selected){u.entries=u.entries.filter(e=>e.productId!==pid);sfInvalidate();sfRefresh();return;}if(u.entries.some(e=>e.productId===pid))return;const product=u.sources?.products.find(p=>p.id===pid);if(!product)return;const e=sfEntry(product);u.entries.push(e);sfInvalidate();sfRefresh();if(e.nodeId&&sfBatch().includes(e))await sfRead(e);}
async function sfNextBatch(){
 const u=sfState(),plan=u.plan||(u.preparation?.state==='ready'?u.preparation.plan:null);if(u.busy||!plan||plan.items.length||u.entries.length<=SF_BATCH_SIZE)return;
 u.entries=u.entries.slice(SF_BATCH_SIZE);sfInvalidate();sfRefresh();await sfRetryFields();
}
function sfInput(){const u=sfState(),batch=sfBatch(),durations=u.durations.trim().split(/[\s,]+/).map(Number);if(!u.reviewed)throw Error('Проверьте категории и отметьте подтверждение перед расчётом.');if(!batch.length||batch.some(e=>!sfEntryReady(e)))throw Error('Выберите игры и заполните параметры каждой категории.');if(!durations.length||durations.length>12||new Set(durations).size!==durations.length||durations.some(h=>!Number.isInteger(h)||h<1||h>720))throw Error('Укажите до 12 разных целых сроков от 1 до 720 часов.');return {entries:batch.map(e=>({productId:e.productId,nodeId:e.nodeId,fields:{...e.fields},fingerprint:e.form.fingerprint,categoryTitle:e.form.categoryTitle})),durations,activate:u.activate,reviewed:true};}
const sfPause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sfWaitText=wait=>`Запросы временно ограничены. Продолжим автоматически через ${wait.seconds} с. Уже выполненные шаги сохранены.`;
function sfRetrySeconds(error){
 if(['RATE_LIMITED','KOSELL_RATE_LIMITED'].includes(error?.code))return 60;
 if(error?.code==='SYNC_BUSY'||error?.code==='INVALID_STATE'&&error.message==='Подключение временно занято')return 5;
 return 0;
}
async function sfWait(u,seconds,active){
 const wait={seconds};if(!active())return false;u.wait=wait;sfRefresh();
 try{
  while(wait.seconds>0){await sfPause(1000);if(!active())return false;wait.seconds--;const node=document.querySelector('[data-sf-wait]');if(node)node.textContent=sfWaitText(wait);}
  return active();
 }finally{if(u.wait===wait){u.wait=null;if(active())sfRefresh();}}
}
// Only preparation reads use this retry policy. Creation confirmation never does.
async function sfReadRequest(path,options,u,active){
 for(let retries=0;active();){
  try{const result=await sfBoundedRead(path,options,u);return active()?result:null;}
  catch(error){
   if(!active())return null;
   const seconds=sfRetrySeconds(error);
   if(!seconds||retries++>=5)throw error;
   if(!await sfWait(u,seconds,active))return null;
  }
 }
 return null;
}
async function sfPrepare(resume=false){
 const u=sfState();if(u.busy)return;let body;
 if(!resume){try{body=sfInput();}catch(e){sfMessage(e.message,true);return;}}
 const scope=u.scope,run=++u.run,active=()=>scope===sfScope()&&run===u.run&&!!document.querySelector('[data-kosell-storefront]');
 u.busy=true;u.error='';u.message='';u.plan=null;u.wait=null;sfRefresh();
 try{
  if(!resume){const p=await sfReadRequest('/api/v1/plugins/kosell-rent/storefront/start',{method:'POST',authenticated:true,body},u,active);if(!active())return;u.preparation=p;u.stage='3';}
  let stalled=0;
  while(active()&&u.preparation?.state==='preparing'){
   sfRefresh();await sfPause(1200);if(!active())return;
   const p=await sfReadRequest('/api/v1/plugins/kosell-rent/storefront/step',{method:'POST',authenticated:true,body:{token:u.preparation.token,revision:u.preparation.revision}},u,active);
   if(!active())return;
   if(!p||typeof p.state!=='string'||!Number.isSafeInteger(p.revision))throw Error('Сервер не подтвердил прогресс подготовки.');
   if(p.revision<u.preparation.revision||p.token!==u.preparation.token)throw Error('Сервер вернул другой или устаревший прогресс подготовки. Проверьте сохранённый план.');
   stalled=p.state==='preparing'&&p.revision===u.preparation.revision?stalled+1:0;
   u.preparation=p;
   if(stalled>=SF_READ_LIMITS.maxStalledSteps)throw Error('Текущий шаг пока не продвинулся. Проверьте сохранённый прогресс и повторите продолжение позже.');
  }
  if(active()){
   if(u.preparation?.state==='ready'){
    if(!validateKosellCatalogPlan(u.preparation.plan))throw Error('Сервер не вернул полный план создания.');
    u.plan=u.preparation.plan;u.message='План готов. Проверьте категории, сроки и цены.';
   }else if(u.preparation?.state==='failed')u.error=u.preparation.error;
  }
 }catch(e){if(active())u.error=humanError(e)+(u.preparation?.state==='preparing'?' Прогресс сохранён. Нажмите «Продолжить подготовку», чтобы вернуться к этому шагу.':'');}
 finally{if(scope===sfScope()&&run===u.run){u.busy=false;u.wait=null;sfRefresh();}}
}
async function sfConfirm(){const u=sfState(),plan=u.plan||(u.preparation?.state==='ready'?u.preparation.plan:null);if(u.busy||!plan||u.preparation?.approvalExpired||u.preparation?.draftExpired)return;const scope=u.scope,batchIds=new Set(sfBatch().map(e=>e.productId));u.busy=true;u.plan=null;if(u.preparation){u.preparation.plan=null;u.preparation.state='confirming';}sfRefresh();try{const result=await apiRequest('/api/v1/plugins/kosell-rent/offer-confirm',{method:'POST',authenticated:true,body:{token:plan.token}});if(sfScope()!==scope)return;if(result?.queued!==plan.items.length)throw Error('Сервер не подтвердил очередь. Проверьте задания перед новым запуском.');u.entries=u.entries.filter(e=>!batchIds.has(e.productId));u.reviewed=false;u.stage='1';u.queueOpen=true;u.message=`В очередь добавлено лотов: ${result.queued}. Ход создания показан ниже в заданиях.${u.entries.length?' Осталось выбранных игр: '+u.entries.length+'. Загрузите параметры следующей партии.':''}`;if(u.preparation)u.preparation.state='confirmed';await loadKosellStatus(true);}catch(e){if(sfScope()===scope){if(e.code==='KOSELL_OFFER_PLAN_EXPIRED'){u.plan=plan;u.preparation={...u.preparation,state:'ready',plan,approvalExpired:true};u.error='Срок подтверждения закончился. План сохранён. Обновите подтверждение без повторного расчёта.';}else u.error=humanError(e)+' Проверьте очередь перед повторным созданием.';}}finally{if(sfScope()===scope){u.busy=false;sfRefresh();}}}
async function sfRenew(){
 const u=sfState(),plan=u.plan||(u.preparation?.state==='ready'?u.preparation.plan:null);
 if(u.busy||!plan||u.preparation&&u.preparation.state!=='ready')return;
 const scope=u.scope,run=++u.run,active=()=>scope===sfScope()&&run===u.run&&!!document.querySelector('[data-kosell-storefront]');
 u.busy=true;u.error='';u.message='Обновляем подтверждение сохранённого плана…';sfRefresh();
 try{
  const p=await sfReadRequest('/api/v1/plugins/kosell-rent/storefront/renew',{method:'POST',authenticated:true,body:{token:plan.token}},u,active);
  if(!active())return;
  if(p?.state!=='ready'||!validateKosellCatalogPlan(p.plan))throw Error('Сервер не подтвердил сохранённый план. Откройте витрину заново.');
  u.preparation=p;u.plan=p.plan;u.message='Подтверждение обновлено без пересчёта. Проверьте план и нажмите «Создать лоты».';
 }catch(e){if(active())u.error=humanError(e);}
 finally{if(scope===sfScope()&&run===u.run){u.busy=false;u.wait=null;sfRefresh();}}
}
async function sfCancel(){const u=sfState(),p=u.preparation;u.run++;sfAbortReads(u);u.busy=false;u.wait=null;u.plan=null;for(const e of u.entries){if(e.loading){e.revision++;e.loading=false;}}if(p)p.state='cancelled';sfRefresh();if(p?.token)try{await apiRequest('/api/v1/plugins/kosell-rent/storefront/cancel',{method:'POST',authenticated:true,body:{token:p.token}});}catch(e){sfMessage(humanError(e),true);}}
document.addEventListener('click',async event=>{const el=event.target.closest('[data-sf-action],[data-sf-remove],[data-sf-read],[data-sf-expand],[data-sf-preset]');if(!el)return;const u=sfState(),action=el.dataset.sfAction;if(action==='cancel'){await sfCancel();return;}if(u.busy)return;if(action==='load')await sfLoad();else if(action==='recover')await sfRecoverPreparation();else if(action==='retry-fields')await sfRetryFields();else if(action==='prepare')await sfPrepare();else if(action==='resume')await sfPrepare(true);else if(action==='confirm')await sfConfirm();else if(action==='renew')await sfRenew();else if(action==='more'){u.limit+=40;const root=document.querySelector('[data-sf-products]');if(root)root.innerHTML=sfProducts();}else if(action==='clear'){u.run++;u.entries=[];sfInvalidate();sfRefresh();}else if(action==='select-all')await sfSelectProducts(true);else if(action==='select-found')await sfSelectProducts();else if(action==='next-batch')await sfNextBatch();else if(el.dataset.sfRemove)await sfSelect(Number(el.dataset.sfRemove),false);else if(el.dataset.sfRead){const e=u.entries.find(e=>e.productId===Number(el.dataset.sfRead));if(e)await sfRead(e);}else if(el.dataset.sfExpand){const e=u.entries.find(e=>e.productId===Number(el.dataset.sfExpand));if(e){e.expanded=!e.expanded;sfRefresh();}}else if(el.dataset.sfPreset){u.durations=el.dataset.sfPreset;sfInvalidate();sfRefresh();}});
document.addEventListener('change',async event=>{const el=event.target,u=sfState();if(u.busy)return;if(el.dataset?.sfSelect){await sfSelect(Number(el.dataset.sfSelect),el.checked);return;}if(el.dataset?.sfCategory){const e=u.entries.find(e=>e.productId===Number(el.dataset.sfCategory)),c=u.sources?.categories.find(c=>sfCategoryLabel(c)===el.value.trim());if(e){e.nodeId=c?.nodeId||null;e.form=null;e.error=c?'':'Выберите категорию из списка FunPay.';sfInvalidate();sfRefresh();if(c)await sfRead(e);}return;}if(el.dataset?.sfField){const e=u.entries.find(e=>e.productId===Number(el.dataset.sfProduct));if(e){e.fields[el.dataset.sfField]=el.type==='checkbox'?(el.checked?el.value:''):el.value;sfInvalidate();sfRefresh();}return;}if(el.hasAttribute?.('data-sf-activate')){u.activate=el.checked;sfInvalidate();}if(el.hasAttribute?.('data-sf-reviewed')){u.reviewed=el.checked;sfRefresh();}});
document.addEventListener('input',event=>{const el=event.target,u=sfState();if(u.busy)return;if(el.hasAttribute?.('data-sf-search')){u.query=el.value;u.limit=40;const root=document.querySelector('[data-sf-products]');if(root)root.innerHTML=sfProducts();}if(el.hasAttribute?.('data-sf-durations')){u.durations=el.value;sfInvalidate();}});

document.addEventListener('submit',async event=>{const form=event.target;if(!form.matches?.('[data-sf-creation-resume]'))return;event.preventDefault();await sfResumeCreation(form);});
document.addEventListener('click',async event=>{const button=event.target.closest('[data-sf-queue-fields],[data-sf-repair-close]');if(!button||sfState().busy)return;if(button.hasAttribute('data-sf-repair-close')){sfState().repair=null;sfRefresh();}else await sfLoadQueueFields(button);});
document.addEventListener('change',event=>{
 const el=event.target,u=sfState(),p=u.repair;if(u.busy||!p)return;
 if(el.hasAttribute?.('data-sf-repair-review')){p.reviewed=el.checked;sfRefresh();return;}
 if(!el.dataset?.sfRepairField)return;const e=p.entries.find(e=>e.productId===Number(el.dataset.sfRepairProduct)),c=p.form.controls.find(c=>c.name===el.dataset.sfRepairField);if(!e||!c)return;
 const selected=c.kind==='select'?c.options.find(o=>o.value&&(el.tagName==='SELECT'?o.value===el.value:sfRepairOption(o,c)===el.value)):null;
 e.fields[c.name]=c.kind==='select'?selected?.value||'':c.kind==='checkbox'?el.checked?c.checkedValue:'':el.value;if(e.gameMatches?.[c.name])e.gameMatches[c.name]={status:'manual'};p.reviewed=false;u.error=c.kind==='select'&&el.value&&!selected?'Выберите значение из списка FunPay.':'';sfRefresh();
});
document.addEventListener('submit',async event=>{const form=event.target;if(!form.matches?.('[data-sf-queue-fields-save]'))return;event.preventDefault();await sfSaveQueueFields(form);});

document.addEventListener('click',event=>{const button=event.target.closest('[data-sf-hold]'),u=sfState();if(!button||u.busy)return;u.openHold=button.getAttribute('aria-expanded')==='true'?'':button.dataset.sfHold;sfRefresh();});

document.addEventListener('click',event=>{const button=event.target.closest('[data-sf-game-fallback]');if(button)sfApplyGameFallback(button.dataset.sfGameFallback);});

document.addEventListener('click',event=>{const button=event.target.closest('[data-sf-catalog-fallback]');if(button)sfApplyCatalogFallback(Number(button.dataset.sfCatalogFallback));});

const sfQueuePending=s=>Number.isSafeInteger(s?.offerCreationQueue?.pending)&&s.offerCreationQueue.pending>0;
const sfQueueVisible=()=>!!authState.token&&document.visibilityState==='visible'&&(typeof kosellSectionName!=='function'||kosellSectionName()==='storefront');
const sfQueueEditing=()=>sfState().busy||kosellUi.busy||kosellUi.saving||kosellUi.loading||document.activeElement?.matches?.('input,select,textarea,[contenteditable="true"]');
function sfQueueRefreshMarkup(s){
 if(!sfQueuePending(s))return '';const u=sfState();return `<div class="sf-queue-refresh"><p role="status">${sfEscape(u.queueReadError||'Состояние очереди обновляется автоматически каждые 15 секунд, пока этот раздел открыт.')}</p><button type="button" class="button button--ghost" data-sf-queue-refresh ${u.busy||sfQueuePoll.reading?'disabled':''}>Проверить результат сейчас</button></div>`;
}
function sfWatchQueue(){
 const scope=sfScope();if(!sfQueueVisible()||!sfQueuePending(kosellUi.status)){
  if(sfQueuePoll.timer!==null)clearTimeout(sfQueuePoll.timer);sfQueuePoll.timer=null;sfQueuePoll.scope='';return;
 }
 if(sfQueuePoll.timer!==null&&sfQueuePoll.scope===scope||sfQueuePoll.reading)return;
 if(sfQueuePoll.timer!==null)clearTimeout(sfQueuePoll.timer);sfQueuePoll.scope=scope;
 sfQueuePoll.timer=setTimeout(async()=>{sfQueuePoll.timer=null;if(scope!==sfScope()||!sfQueueVisible()||!document.querySelector('[data-kosell-storefront]'))return;await sfReadQueueStatus();},15000);
}
async function sfReadQueueStatus(){
 if(sfQueuePoll.reading||!sfQueueVisible()||!document.querySelector('[data-kosell-storefront]'))return;
 if(sfQueueEditing()){sfWatchQueue();return;}
 const scope=sfScope(),before=kosellUi.status,revision=kosellUi.statusRevision,u=sfState();sfQueuePoll.reading=true;sfRefresh();
 try{
  const status=await sfBoundedRead('/api/v1/plugins/kosell-rent/status',{authenticated:true},u);
  if(scope!==sfScope()||!sfQueueVisible()||!document.querySelector('[data-kosell-storefront]')||revision!==kosellUi.statusRevision||before!==kosellUi.status||sfQueueEditing())return;
  if(!status||status.storeId!==before?.storeId||!Number.isSafeInteger(status.offerCreationQueue?.pending)||status.offerCreationQueue.pending<0||!Array.isArray(status.offerCreationQueue.holds))throw Error('INVALID_QUEUE_STATUS');
  const wasProbing=before.offerCreationQueue?.holds?.some(h=>h.probePending),probing=status.offerCreationQueue.holds.some(h=>h.probePending);
  kosellUi.status=status;u.queueReadError='';if(wasProbing&&!probing)u.message='Статус пробного создания обновлён. Результат — в заданиях ниже.';
  if(typeof renderPluginPage==='function')renderPluginPage();else sfRefresh();
 }catch{
  if(scope===sfScope()&&before===kosellUi.status){u.queueReadError='Не удалось обновить очередь. Повторим автоматически; сохранённый статус может быть устаревшим.';if(!sfQueueEditing()&&document.querySelector('[data-kosell-storefront]'))sfRefresh();}
 }finally{sfQueuePoll.reading=false;if(scope===sfScope()&&sfQueueVisible()&&!sfQueueEditing()&&document.querySelector('[data-kosell-storefront]'))sfRefresh();else sfWatchQueue();}
}
document.addEventListener('visibilitychange',()=>sfWatchQueue());
document.addEventListener('click',event=>{if(event.target.closest('[data-sf-queue-refresh]'))void sfReadQueueStatus();});

function sfStage(){const u=sfState();return ['1','2','3'].includes(u.stage)?u.stage:u.preparation?.state==='preparing'||u.plan||u.preparation?.state==='ready'?'3':'1';}
document.addEventListener('click',event=>{const button=event.target.closest('[data-sf-stage],[data-sf-more-plan]'),u=sfState();if(!button||u.busy)return;if(button.hasAttribute('data-sf-more-plan')){u.planLimit=(u.planLimit||50)+50;sfRefresh();return;}const stage=button.dataset.sfStage;if(!['1','2','3'].includes(stage)||stage==='2'&&!u.entries.length||stage==='3'&&!u.preparation)return;u.stage=stage;sfRefresh();document.querySelector('[data-sf-stage="'+stage+'"]')?.focus?.();});

function sfQueueResults(s){const jobs=(s.offerJobs||[]).filter(j=>!j.extensionFor),u=sfState();if(!jobs.length)return '';const counts={};for(const j of jobs)counts[j.status]=(counts[j.status]||0)+1;const names={queued:'В очереди',creating:'Создаётся',created:'Создан, выключен',active:'Включён',activating:'Включается',unknown:'Нужна проверка',failed:'Ошибка',cancelled:'Отменён'},ordered=[...jobs].reverse();return `<details class="sf-queue-results" data-sf-queue-results ${u.queueOpen?'open':''}><summary>Очередь и результаты · ${jobs.length}<span>В очереди: ${counts.queued||0} · создано: ${(counts.created||0)+(counts.active||0)} · проверить: ${(counts.failed||0)+(counts.unknown||0)}</span></summary><div class="sf-queue-jobs">${ordered.slice(0,u.queueLimit||10).map(j=>`<article><div><strong>${sfEscape(j.productName)} · ${j.hours} ч</strong><p>${sfEscape(names[j.status]||j.status)} · ${kosellMoney(j.priceMinor,j.currency)}</p>${j.failureMessage?`<p>${sfEscape(j.failureMessage)}</p>`:''}${j.status==='unknown'?'<p>Результат неизвестен. Проверьте FunPay перед новой попыткой; автоматический повтор заблокирован.</p>':''}${j.lotId?`<a href="https://funpay.com/lots/offer?id=${sfEscape(j.lotId)}" target="_blank" rel="noopener noreferrer">Открыть созданный лот ↗</a>`:''}</div>${j.status==='unknown'?`<form data-kosell-offer-resolve data-job-id="${sfEscape(j.id)}"><label>ID лота, который вы проверили на FunPay<input name="lotId" inputmode="numeric" required value="${sfEscape(j.lotId||'')}"></label><label class="sf-check"><input type="checkbox" name="confirm" required>Я проверил результат создания</label><button type="submit" class="button button--ghost">Проверить и связать существующий лот</button></form>`:''}</article>`).join('')}</div>${ordered.length>(u.queueLimit||10)?'<button type="button" class="button button--ghost" data-sf-queue-more>Показать ещё результаты</button>':''}<div class="kosell-buttons"><button type="button" class="button button--ghost" data-sf-queue-refresh>Обновить результаты</button>${counts.queued?'<button type="button" class="button button--ghost" data-sf-stop-ask>Остановить очередь</button>':''}</div>${u.stopQueueConfirm?'<div class="sf-stop-confirm" role="alert"><p>Отменить ещё не начатые задания? Уже созданные лоты сохранятся. Отправленный запрос может завершиться после остановки.</p><button type="button" class="button button--primary" data-sf-stop-yes>Да, остановить очередь</button><button type="button" class="button button--ghost" data-sf-stop-no>Вернуться</button></div>':''}</details>`;}
async function sfStopQueue(){const u=sfState();if(!u.stopQueueConfirm||u.busy)return;const scope=u.scope;u.stopQueueConfirm=false;u.busy=true;sfRefresh();try{const result=await apiRequest('/api/v1/plugins/kosell-rent/catalog-stop',{method:'POST',authenticated:true});if(scope!==sfScope())return;if(!Number.isSafeInteger(result?.cancelled)||result.cancelled<0)throw Error('Остановка не подтверждена. Обновите очередь.');await loadKosellStatus(true);if(scope===sfScope())u.message=`Очередь остановлена. Отменено заданий: ${result.cancelled}. Созданные лоты сохранены.`;}catch(error){if(scope===sfScope())u.error=humanError(error)+' Проверьте текущее состояние очереди.';}finally{if(scope===sfScope()){u.busy=false;sfRefresh();}}}
document.addEventListener('toggle',event=>{if(event.target.matches?.('[data-sf-queue-results]'))sfState().queueOpen=event.target.open;},true);
document.addEventListener('click',async event=>{const button=event.target.closest('[data-sf-queue-more],[data-sf-stop-ask],[data-sf-stop-yes],[data-sf-stop-no]'),u=sfState();if(!button||u.busy)return;if(button.hasAttribute('data-sf-stop-yes'))return sfStopQueue();if(button.hasAttribute('data-sf-queue-more'))u.queueLimit=(u.queueLimit||10)+10;else u.stopQueueConfirm=button.hasAttribute('data-sf-stop-ask');u.queueOpen=true;sfRefresh();});
