// Category-based catalogue. Existing template tools remain available below.
const kosellLegacyCatalogMarkup=kosellCatalogMarkup;
let kosellStorefrontUi={};
// Keep each submitted plan within the existing server limit; selection spans the full catalogue.
const SF_BATCH_SIZE=50;
const sfBatch=()=>sfState().entries.slice(0,SF_BATCH_SIZE);
const sfAvailableProducts=()=>{const seen=new Set();return (sfState().sources?.products||[]).filter(p=>Number.isSafeInteger(p.id)&&p.id>0&&Number.isSafeInteger(p.availableAccounts)&&p.availableAccounts>0&&!seen.has(p.id)&&seen.add(p.id));};
const sfEntry=product=>({productId:product.id,productName:product.name,nodeId:product.nodeId,fields:{},form:null,error:'',expanded:false});
const sfEscape=value=>escapeHtml(String(value??''));
const sfScope=()=>[authState.token,kosellUi.status?.storeId||'',typeof sessionGeneration==='undefined'?'':sessionGeneration].join(':');
function sfState(){const scope=sfScope();if(kosellStorefrontUi.scope!==scope)kosellStorefrontUi={scope,sources:null,entries:[],query:'',limit:40,durations:'1, 3, 24, 72',activate:false,reviewed:false,error:'',message:'',busy:false,wait:null,preparation:kosellUi.status?.storefrontPreparation||null,plan:null,run:0};return kosellStorefrontUi;}
const sfCategoryLabel=c=>`${c.game} · ${c.name} (#${c.nodeId})`;
const sfRequired=c=>c.required===true||['server_id','fields[game]','fields[platform]','fields[type]'].includes(c.name)&&c.kind==='select'&&c.options.some(o=>o.value.trim());
const sfEntryReady=e=>!!e.form&&!e.loading&&!e.error&&e.form.controls.every(c=>{const v=e.fields[c.name]??'';return (!sfRequired(c)||!!v.trim())&&(c.kind!=='select'||c.options.some(o=>o.value===v));});
function sfInvalidate(){const u=sfState();sfMessage('');u.plan=null;u.reviewed=false;if(u.preparation?.state==='ready')u.preparation.state='edited';u.message='';const review=document.querySelector('[data-sf-reviewed]');if(review)review.checked=false;document.querySelector('[data-kosell-storefront] .sf-plan')?.remove?.();}
function sfControl(c,e){const v=e.fields[c.name]??'',base=`data-sf-field="${sfEscape(c.name)}" data-sf-product="${e.productId}" ${sfState().busy?'disabled':''}`;if(c.hidden)return '';if(c.kind==='checkbox')return `<label class="sf-check"><input type="checkbox" ${base} value="${sfEscape(c.checkedValue)}" ${v?'checked':''}>${sfEscape(c.label)}</label>`;return `<label>${sfEscape(c.label)}${sfRequired(c)?' <span aria-label="обязательное поле">*</span>':''}${c.kind==='select'?`<select ${base}><option value="" ${v===''?'selected':''}>Выберите значение</option>${c.options.filter(o=>o.value).map(o=>`<option value="${sfEscape(o.value)}" ${o.value===v?'selected':''}>${sfEscape(o.label)}</option>`).join('')}</select>`:`<input ${base} type="${c.kind==='number'?'number':'text'}" maxlength="${c.maxLength||2000}" value="${sfEscape(v)}">`}</label>`;}
function sfProducts(){const u=sfState();if(!u.sources)return '';const found=u.sources.products.filter(p=>p.name.toLocaleLowerCase().includes(u.query.toLocaleLowerCase())),selected=new Set(u.entries.map(e=>e.productId));return `<div class="sf-product-list">${found.slice(0,u.limit).map(p=>{const c=u.sources.categories.find(c=>c.nodeId===p.nodeId);return `<label class="sf-product"><input type="checkbox" data-sf-select="${p.id}" ${selected.has(p.id)?'checked':''} ${u.busy?'disabled':''}><span><strong>${sfEscape(p.name)}</strong><small>${c?sfEscape(c.game+' · '+c.name):'Выберите категорию после добавления'}</small></span><span class="sf-stock">${Number.isInteger(p.availableAccounts)?p.availableAccounts+' в наличии':'—'}</span></label>`;}).join('')||'<p class="kosell-hint">Игр по этому запросу нет.</p>'}</div>${found.length>u.limit?'<button type="button" class="button button--ghost" data-sf-action="more">Показать ещё</button>':''}`;}
function sfSelections(){const u=sfState();return u.entries.map(e=>{const ready=sfEntryReady(e),c=u.sources?.categories.find(c=>c.nodeId===e.nodeId),label=c?sfCategoryLabel(c):'';return `<article class="sf-selection ${ready?'is-ready':'needs-review'}"><header><div><strong>${sfEscape(e.productName)}</strong><small>${e.loading?'Читаем параметры FunPay…':e.error?sfEscape(e.error):ready?'Параметры готовы':'Уточните категорию или параметры'}</small></div><button type="button" class="sf-remove" data-sf-remove="${e.productId}" aria-label="Убрать ${sfEscape(e.productName)}" ${u.busy?'disabled':''}>×</button></header><label>Категория FunPay<input list="sf-categories" data-sf-category="${e.productId}" value="${sfEscape(label)}" placeholder="Начните вводить название игры или категории" ${u.busy?'disabled':''}></label>${e.nodeId&&!e.form&&!e.loading?`<button class="button button--ghost" type="button" data-sf-read="${e.productId}" ${u.busy?'disabled':''}>Загрузить параметры</button>`:''}${e.form?`<button type="button" class="sf-parameters" data-sf-expand="${e.productId}" ${u.busy?'disabled':''}>${e.expanded?'Скрыть параметры':'Параметры категории'} · ${e.form.controls.filter(c=>!c.hidden).length}</button>${e.expanded||!ready?`<div class="sf-fields">${e.form.controls.map(c=>sfControl(c,e)).join('')}</div>`:`<p class="sf-values">${e.form.controls.filter(c=>!c.hidden).map(c=>sfEscape(c.kind==='select'?c.options.find(o=>o.value===e.fields[c.name])?.label:e.fields[c.name])).filter(Boolean).join(' · ')||'Дополнительных полей нет'}</p>`}`:''}</article>`;}).join('');}
function sfPlan(p){const u=sfState(),expired=u.preparation?.approvalExpired===true,draftExpired=u.preparation?.draftExpired===true;return `<section class="sf-plan"><h4>Проверьте витрину перед созданием</h4><p>Новых лотов: ${p.items.length} · пропущено: ${p.skipped.length} · ${p.activate?'активация после проверки':'создание выключенными'}</p><div class="sf-plan-list">${p.items.map(i=>`<article><span><strong>${sfEscape(i.productName)} · ${i.hours} ч</strong><small>${sfEscape(i.categoryTitle||'Категория #'+i.nodeId)}</small></span><strong>${kosellMoney(i.priceMinor,p.currency)}</strong></article>`).join('')}</div>${p.skipped.length?`<details><summary>Пропущенные сроки (${p.skipped.length})</summary>${p.skipped.map(i=>`<p>Игра #${sfEscape(i.productId)} · ${sfEscape(i.hours)} ч — ${sfEscape({exists:'уже есть привязка или задание',duration:'срок недоступен',archived:'привязка в архиве',section_limit:'лимит категории',spend_limit:'себестоимость выше лимита одной покупки'}[i.reason]||'пропущено')}</p>`).join('')}</details>`:''}<p class="kosell-hint">План хранится 24 часа после готовности. На подтверждение — 30 минут после готовности или обновления. Перед созданием повторно проверяются себестоимость и категория. Покупка аренды не выполняется. ${p.activate?'Новые лоты включатся после проверки создания.':'Новые лоты будут выключены.'}</p>${p.items.length?`${expired?'<p class="sf-error">Срок подтверждения закончился. Сам план сохранён — обновите подтверждение без повторного расчёта.</p>':''}${draftExpired?'<p class="sf-error">Срок хранения плана закончился. Нужен новый расчёт.</p>':`${!expired?`<button type="button" class="button button--primary" data-sf-action="confirm">Создать лоты (${p.items.length})</button>`:''}<button type="button" class="button button--ghost" data-sf-action="renew">Обновить подтверждение без пересчёта</button>`}`:`<p>Новых лотов нет — измените игры или сроки.</p>${sfState().entries.length>SF_BATCH_SIZE?'<button type="button" class="button button--ghost" data-sf-action="next-batch">Перейти к следующим играм</button>':''}`}</section>`;}
function sfCategoryReadError(error){
 if(error?.code==='INVALID_STATE'){
  if(error.message==='Подключение временно занято')return 'Магазин занят другой операцией. Повторите загрузку параметров позже.';
  if(['Проверьте подключение магазина','Разрешение отозвано','Подключение магазина изменилось'].includes(error.message))return 'Подключение или разрешения магазина изменились. Проверьте подключение в настройках.';
  return 'Не удалось проверить форму этой категории FunPay. Нужна повторная загрузка или диагностика категории.';
 }
 return humanError(error);
}
function sfBlockers(){
 const u=sfState(),batch=sfBatch(),pending=batch.filter(e=>!sfEntryReady(e));if(!pending.length)return '';
 const unloaded=pending.filter(e=>e.nodeId&&!e.form&&!e.loading).length,manual=pending.filter(e=>!e.nodeId).length,fields=pending.filter(e=>e.form&&!e.loading).length;
 return `<div class="sf-blockers" role="status"><strong>План пока не готов: проверьте ${pending.length} из ${batch.length} игр${u.entries.length>SF_BATCH_SIZE?' текущей партии':''}</strong><p>${[unloaded?`Не загружены параметры: ${unloaded}`:'',manual?`Не выбрана категория: ${manual}`:'',fields?`Не заполнены поля: ${fields}`:'',pending.some(e=>e.loading)?'Параметры загружаются':'' ].filter(Boolean).join(' · ')}. Запуск станет доступен после проверки игр текущей партии.</p>${unloaded?`<button type="button" class="button button--ghost" data-sf-action="retry-fields" ${u.busy?'disabled':''}>Загрузить недостающие параметры (${unloaded})</button>`:''}</div>`;
}
async function sfRetryFields(){
 const u=sfState();if(u.busy)return;const scope=u.scope,run=++u.run,entries=sfBatch().filter(e=>e.nodeId&&!e.form&&!e.loading);sfInvalidate();u.busy=true;sfRefresh();
 try{for(const e of entries){if(scope!==sfScope()||run!==u.run||!document.querySelector('[data-kosell-storefront]'))break;if(u.entries.includes(e)){await sfRead(e);if(e.retryExhausted)break;}}}
 finally{if(scope===sfScope()&&run===u.run){u.busy=false;sfMessage(`Параметры готовы: ${sfBatch().filter(sfEntryReady).length} из ${sfBatch().length}. Проверьте категории и оставшиеся поля.`);sfRefresh();}}
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
function sfQueueFieldsMarkup(h){
 const u=sfState(),p=u.repair;if(h.probePending)return '';
 if(!p||p.nodeId!==h.nodeId||p.afterJobId!==h.afterJobId)return `<button type="button" class="button button--primary sf-queue-fields-button" data-sf-queue-fields="${sfEscape(h.nodeId)}" data-after="${sfEscape(h.afterJobId)}" ${u.busy?'disabled':''}>Проверить и исправить параметры очереди</button>`;
 const ready=p.entries.filter(e=>sfRepairEntryReady(p,e)).length;
 return `<form data-sf-queue-fields-save class="sf-queue-fields"><h5>Параметры сохранённой очереди</h5><p>${sfEscape(p.form.categoryTitle)} · ${p.jobs} заданий. Цены и сроки сохранятся. Проверьте подобранные значения и заполните оставшиеся поля.</p>${p.form.controls.map((c,i)=>c.kind==='select'&&c.options.length>30?`<datalist id="sf-repair-options-${i}">${c.options.filter(o=>o.value).map(o=>`<option value="${sfEscape(sfRepairOption(o,c))}"></option>`).join('')}</datalist>`:'').join('')}<div class="sf-queue-fields-list">${p.entries.map(e=>`<div class="sf-queue-fields-game"><header><strong>${sfEscape(e.productName)}</strong><span>${e.jobs} заданий</span></header><div class="sf-fields">${p.form.controls.map((c,i)=>sfRepairControl(c,e,i)).join('')}</div></div>`).join('')}</div><p role="status">Параметры готовы: ${ready} из ${p.entries.length} игр</p><label class="sf-check"><input type="checkbox" name="confirm" data-sf-repair-review ${p.reviewed?'checked':''} ${u.busy?'disabled':''}>Параметры проверены — сохранить для ожидающих заданий</label><div class="sf-queue-fields-actions"><button type="submit" class="button button--primary" ${u.busy||ready!==p.entries.length||!p.reviewed?'disabled':''}>Сохранить параметры очереди</button><button type="button" class="button button--ghost" data-sf-repair-close ${u.busy?'disabled':''}>Закрыть</button></div><small>После сохранения можно отдельно проверить создание одного лота.</small></form>`;
}
async function sfLoadQueueFields(button){
 const u=sfState();if(u.busy)return;const hold=kosellUi.status?.offerCreationQueue?.holds?.find(h=>h.nodeId===button.dataset.sfQueueFields&&h.afterJobId===button.dataset.after&&!h.probePending);if(!hold)return;
 const scope=u.scope,run=++u.run;u.busy=true;u.error='';u.repair=null;u.openHold=hold.nodeId;sfRefresh();
 try{
  const p=await apiRequest('/api/v1/plugins/kosell-rent/storefront/queue-fields',{method:'POST',authenticated:true,body:{nodeId:hold.nodeId,afterJobId:hold.afterJobId}});
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
 const u=sfState(),opened=Object.hasOwn(u,'openHold')?u.openHold:u.repair?.nodeId||holds[0].nodeId;
 return `<section class="sf-creation-holds" aria-label="Пауза создания лотов"><h4>Создание требует проверки</h4><p>FunPay отклонил параметры. Категорий на проверке: ${holds.length}. Выберите категорию, исправьте поля и проверьте создание одного лота. Сохранённые цены и сроки остаются прежними.</p>${holds.map(h=>{
  const open=opened===h.nodeId,missing=h.missingParameterValues||h.missingGameValues||0;
  return `<article class="sf-creation-hold ${open?'is-open':''}"><button type="button" class="sf-hold-toggle" data-sf-hold="${sfEscape(h.nodeId)}" aria-expanded="${open}" aria-controls="sf-hold-${sfEscape(h.nodeId)}" ${u.busy?'disabled':''}><span><strong>${sfEscape(h.title||'Категория #'+h.nodeId)}</strong>${h.games?.length?`<small>${h.games.map(sfEscape).join(' · ')}</small>`:''}</span><span class="sf-hold-count">${Number.isSafeInteger(h.pending)?h.pending:0} в очереди <span aria-hidden="true">${open?'−':'+'}</span></span></button>${open?`<div id="sf-hold-${sfEscape(h.nodeId)}" class="sf-hold-body"><p>${sfEscape(h.message||'Проверьте параметры категории.')}</p><a href="https://funpay.com/lots/${sfEscape(h.nodeId)}/trade" target="_blank" rel="noopener noreferrer">Открыть свои лоты в категории</a>${sfQueueFieldsMarkup(h)}${h.probePending?'<p class="sf-probe-pending" role="status">Один лот ожидает пробного создания. После успешной проверки очередь категории продолжится.</p>':missing>0?(u.repair?.nodeId===h.nodeId?'':`<p class="sf-queue-missing">Нужно заполнить параметры для ${missing} заданий.</p>`):`<form data-sf-creation-resume data-node="${sfEscape(h.nodeId)}" data-after="${sfEscape(h.afterJobId)}"><label class="sf-check"><input name="confirm" type="checkbox" required ${u.busy?'disabled':''}>Я проверил категорию и разрешаю пробное создание одного оставшегося лота</label><button type="submit" class="button button--ghost" ${u.busy?'disabled':''}>Проверить на одном лоте</button></form>`}</div>`:''}</article>`;
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
function sfInner(s){const u=sfState(),p=u.preparation,plan=u.plan||(p?.state==='ready'?p.plan:null),batch=sfBatch(),ready=batch.filter(sfEntryReady).length,available=sfAvailableProducts(),selected=new Set(u.entries.map(e=>e.productId));return `<div class="sf-heading"><div><span class="sf-eyebrow">АССОРТИМЕНТ KOSELL</span><h3>Массовая витрина</h3><p>Выберите игры. Категории и параметры загрузятся из FunPay — создавать лоты-образцы больше не нужно.</p></div><span class="sf-count">${u.entries.length||s.offerCreationQueue?.pending||0}<small>${u.entries.length?'игр выбрано':s.offerCreationQueue?.pending?'лотов в очереди':'игр выбрано'}</small></span></div><ol class="sf-steps"><li>1 <span>Игры</span></li><li>2 <span>Категории и сроки</span></li><li>3 <span>План и создание</span></li></ol><p class="sf-feedback" data-sf-feedback role="${u.error?'alert':'status'}" aria-live="polite">${sfEscape(u.error||u.message)}</p>${u.wait?'<p class="sf-wait" data-sf-wait role="status" aria-live="polite">'+sfEscape(sfWaitText(u.wait))+'</p>':''}${sfCreationQueue(s)}${u.busy&&!['preparing','confirming'].includes(u.preparation?.state)?'<button type="button" class="button button--ghost" data-sf-action="cancel">Прервать загрузку</button>':''}${!u.sources?`<div class="sf-load"><p>Загрузим доступные игры Kosell и категории FunPay вашего подключения.</p><button type="button" class="button button--primary" data-sf-action="load" ${u.busy?'disabled':''}>${u.busy?'Загружаем…':'Выбрать игры'}</button></div>`:`<div class="sf-columns"><section class="sf-games"><div class="sf-section-heading"><h4>Игры Kosell</h4><span>${u.sources.products.length}</span></div><input type="search" data-sf-search ${u.busy?'disabled':''} placeholder="Найти игру" aria-label="Найти игру Kosell" value="${sfEscape(u.query)}"><div class="sf-game-actions"><button type="button" class="sf-select-all" data-sf-action="select-all" ${u.busy||!available.some(p=>!selected.has(p.id))?'disabled':''}>Выбрать все доступные (${available.length})</button><button type="button" data-sf-action="select-found" ${u.busy?'disabled':''}>Добавить найденные</button><button type="button" data-sf-action="clear" ${u.busy?'disabled':''}>Снять выбор</button></div><p class="sf-selection-hint">Все доступные — игры с аккаунтами в наличии во всём каталоге, независимо от поиска. Один план включает до ${SF_BATCH_SIZE} игр.</p><div data-sf-products>${sfProducts()}</div></section><section class="sf-settings"><div class="sf-section-heading"><h4>Категории и параметры</h4><span>${ready}/${batch.length} готово${u.entries.length>SF_BATCH_SIZE?' · текущая партия':''}</span></div><datalist id="sf-categories">${u.sources.categories.map(c=>`<option value="${sfEscape(sfCategoryLabel(c))}"></option>`).join('')}</datalist><div class="sf-selections">${sfSelections()||'<div class="sf-empty">Добавьте игры из списка слева. Для каждой покажем категорию создания.</div>'}</div><div class="sf-common"><label>Сроки аренды, в часах<input data-sf-durations value="${sfEscape(u.durations)}" maxlength="100" ${u.busy?'disabled':''}></label><div class="sf-presets"><button type="button" data-sf-preset="1, 3, 6, 12" ${u.busy?'disabled':''}>Короткие</button><button type="button" data-sf-preset="1, 3, 24, 72" ${u.busy?'disabled':''}>Основные</button><button type="button" data-sf-preset="1, 3, 24, 72, 168, 720" ${u.busy?'disabled':''}>Все сроки</button></div><p class="kosell-hint">Цены рассчитываются по серверной себестоимости Kosell и вашей общей наценке ${Number(s.config?.markupPercent)||0}%. Комиссия FunPay не включена. RU/EN тексты берутся из настроек «Тексты новых предложений». Новые лоты создаются без изображений; они доступны в обычном редакторе FunPay.</p><label class="sf-check"><input type="checkbox" data-sf-activate ${u.activate?'checked':''} ${u.busy?'disabled':''}>Активировать после проверки создания</label><label class="sf-check"><input type="checkbox" data-sf-reviewed ${u.reviewed?'checked':''} ${u.busy?'disabled':''}>Категории и параметры ${u.entries.length>SF_BATCH_SIZE?'текущей партии':'выбранных игр'} проверены</label>${u.entries.length>SF_BATCH_SIZE?`<p class="sf-batch-note">В текущем плане — первые ${batch.length} игр. Ещё ${u.entries.length-batch.length} останутся выбранными для следующих партий. Каждая партия создаётся после отдельного подтверждения.</p>`:''}${sfBlockers()}<button type="button" class="button button--primary" data-sf-action="prepare" ${u.busy||!batch.length||ready!==batch.length?'disabled':''}>Подготовить план${u.entries.length>SF_BATCH_SIZE?' ('+batch.length+' игр)':''}</button></div></section></div>`}${p?.state==='preparing'?`<div class="sf-progress"><div><strong>Подготовка плана · ${p.completed}/${p.total}</strong><span>${sfEscape(p.game||'Завершаем расчёт')}</span></div><progress max="${p.total}" value="${p.completed}"></progress><p>Проверяем формы категорий и рассчитываем цены. Лоты ещё не создаются.</p>${!u.busy?'<button class="button button--ghost" type="button" data-sf-action="resume">Продолжить подготовку</button>':''}<button class="button button--ghost" type="button" data-sf-action="cancel">Остановить подготовку</button></div>`:''}${p?.state==='failed'?`<p class="sf-error">${sfEscape(p.error||'Подготовка остановлена. Проверьте параметры и начните заново.')}</p>`:''}${plan?sfPlan(plan):''}<p class="kosell-hint">Неоднозначные категории выбираются вручную. Существующие привязки и задания пропускаются.</p>`;}
function sfRefresh(){const root=document.querySelector('[data-kosell-storefront]');if(root)root.innerHTML=sfInner(kosellUi.status||{});}
function sfMessage(message,error=false){const u=sfState();u.error=error?message:'';u.message=error?'':message;const node=document.querySelector('[data-sf-feedback]');if(node){node.textContent=message;node.setAttribute('role',error?'alert':'status');}}
kosellCatalogMarkup=function(s){const legacy=kosellLegacyCatalogMarkup(s).replace('<h3>Массовая витрина</h3>','<h3>Создание по своим шаблонам</h3>');return `<section class="kosell-storefront" data-kosell-storefront>${sfInner(s)}</section><details class="sf-advanced"><summary>Дополнительно · использовать свои лоты-шаблоны</summary>${legacy}</details>`;};
async function sfLoad(){const u=sfState(),scope=u.scope,run=++u.run;u.busy=true;u.error='';sfRefresh();try{const data=await apiRequest('/api/v1/plugins/kosell-rent/storefront',{authenticated:true});if(sfScope()!==scope||run!==u.run)return;if(!data||!Array.isArray(data.products)||!Array.isArray(data.categories))throw Error('Не удалось получить полный каталог.');u.sources=data;u.preparation=data.preparation;u.entries=[];u.message='Выберите нужные игры. Параметры категории подберём при добавлении.';}catch(e){if(sfScope()===scope&&run===u.run)u.error=humanError(e);}finally{if(sfScope()===scope&&run===u.run){u.busy=false;sfRefresh();}}}
async function sfRead(e){const u=sfState(),scope=u.scope,revision=(e.revision||0)+1;e.revision=revision;sfInvalidate();e.loading=true;e.error='';e.retryExhausted=false;sfRefresh();try{const run=u.run,active=()=>scope===sfScope()&&run===u.run&&u.entries.includes(e)&&e.revision===revision&&!!document.querySelector('[data-kosell-storefront]');const form=await sfReadRequest('/api/v1/plugins/kosell-rent/storefront/category',{method:'POST',authenticated:true,body:{productId:e.productId,nodeId:e.nodeId}},u,active);if(!active())return;if(scope!==sfScope()||!u.entries.includes(e)||e.revision!==revision)return;if(!form||!Array.isArray(form.controls)||!form.fields||typeof form.fingerprint!=='string')throw Error('FunPay не вернул параметры категории.');e.form=form;e.fields={...form.fields};e.expanded=form.missing?.length>0;}catch(error){if(scope===sfScope()&&e.revision===revision){e.form=null;e.error=sfCategoryReadError(error);e.retryExhausted=sfRetrySeconds(error)>0;}}finally{if(scope===sfScope()&&e.revision===revision){e.loading=false;sfRefresh();}}}
async function sfSelectProducts(availableOnly=false){
 const u=sfState();if(u.busy||!u.sources)return;
 const candidates=availableOnly?sfAvailableProducts():u.sources.products.filter(p=>p.name.toLocaleLowerCase().includes(u.query.toLocaleLowerCase()));
 const selected=new Set(u.entries.map(e=>e.productId)),added=[];
 for(const product of candidates)if(!selected.has(product.id)){selected.add(product.id);added.push(sfEntry(product));}
 if(!added.length){sfMessage(availableOnly?'Все доступные игры уже выбраны.':'Найденные игры уже выбраны.');return;}
 const scope=u.scope;u.entries.push(...added);sfInvalidate();sfRefresh();
 const pending=sfRetryFields(),run=u.run;await pending;
 if(scope===sfScope()&&run===u.run){sfMessage(`Добавлено игр: ${added.length}. Всего выбрано: ${u.entries.length}. ${u.entries.length>SF_BATCH_SIZE?`Текущая партия — ${sfBatch().length} игр; остальные останутся выбранными для следующих планов.`:'Проверьте категории и параметры.'}`);sfRefresh();}
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
  try{const result=await apiRequest(path,options);return active()?result:null;}
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
  if(!resume){const p=await sfReadRequest('/api/v1/plugins/kosell-rent/storefront/start',{method:'POST',authenticated:true,body},u,active);if(!active())return;u.preparation=p;}
  while(active()&&u.preparation?.state==='preparing'){
   sfRefresh();await sfPause(1200);if(!active())return;
   const p=await sfReadRequest('/api/v1/plugins/kosell-rent/storefront/step',{method:'POST',authenticated:true,body:{token:u.preparation.token,revision:u.preparation.revision}},u,active);
   if(!active())return;
   if(!p||typeof p.state!=='string'||!Number.isSafeInteger(p.revision))throw Error('Сервер не подтвердил прогресс подготовки.');
   u.preparation=p;
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
async function sfConfirm(){const u=sfState(),plan=u.plan||(u.preparation?.state==='ready'?u.preparation.plan:null);if(u.busy||!plan||u.preparation?.approvalExpired||u.preparation?.draftExpired)return;const scope=u.scope,batchIds=new Set(sfBatch().map(e=>e.productId));u.busy=true;u.plan=null;if(u.preparation){u.preparation.plan=null;u.preparation.state='confirming';}sfRefresh();try{const result=await apiRequest('/api/v1/plugins/kosell-rent/offer-confirm',{method:'POST',authenticated:true,body:{token:plan.token}});if(sfScope()!==scope)return;if(result?.queued!==plan.items.length)throw Error('Сервер не подтвердил очередь. Проверьте задания перед новым запуском.');u.entries=u.entries.filter(e=>!batchIds.has(e.productId));u.reviewed=false;u.message=`В очередь добавлено лотов: ${result.queued}. Ход создания показан ниже в заданиях.${u.entries.length?' Осталось выбранных игр: '+u.entries.length+'. Загрузите параметры следующей партии.':''}`;if(u.preparation)u.preparation.state='confirmed';await loadKosellStatus(true);}catch(e){if(sfScope()===scope){if(e.code==='KOSELL_OFFER_PLAN_EXPIRED'){u.plan=plan;u.preparation={...u.preparation,state:'ready',plan,approvalExpired:true};u.error='Срок подтверждения закончился. План сохранён. Обновите подтверждение без повторного расчёта.';}else u.error=humanError(e)+' Проверьте очередь перед повторным созданием.';}}finally{if(sfScope()===scope){u.busy=false;sfRefresh();}}}
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
async function sfCancel(){const u=sfState(),p=u.preparation;u.run++;u.busy=false;u.wait=null;u.plan=null;for(const e of u.entries){if(e.loading){e.revision++;e.loading=false;}}if(p)p.state='cancelled';sfRefresh();if(p?.token)try{await apiRequest('/api/v1/plugins/kosell-rent/storefront/cancel',{method:'POST',authenticated:true,body:{token:p.token}});}catch(e){sfMessage(humanError(e),true);}}
document.addEventListener('click',async event=>{const el=event.target.closest('[data-sf-action],[data-sf-remove],[data-sf-read],[data-sf-expand],[data-sf-preset]');if(!el)return;const u=sfState(),action=el.dataset.sfAction;if(action==='cancel'){await sfCancel();return;}if(u.busy)return;if(action==='load')await sfLoad();else if(action==='retry-fields')await sfRetryFields();else if(action==='prepare')await sfPrepare();else if(action==='resume')await sfPrepare(true);else if(action==='confirm')await sfConfirm();else if(action==='renew')await sfRenew();else if(action==='more'){u.limit+=40;const root=document.querySelector('[data-sf-products]');if(root)root.innerHTML=sfProducts();}else if(action==='clear'){u.run++;u.entries=[];sfInvalidate();sfRefresh();}else if(action==='select-all')await sfSelectProducts(true);else if(action==='select-found')await sfSelectProducts();else if(action==='next-batch')await sfNextBatch();else if(el.dataset.sfRemove)await sfSelect(Number(el.dataset.sfRemove),false);else if(el.dataset.sfRead){const e=u.entries.find(e=>e.productId===Number(el.dataset.sfRead));if(e)await sfRead(e);}else if(el.dataset.sfExpand){const e=u.entries.find(e=>e.productId===Number(el.dataset.sfExpand));if(e){e.expanded=!e.expanded;sfRefresh();}}else if(el.dataset.sfPreset){u.durations=el.dataset.sfPreset;sfInvalidate();sfRefresh();}});
document.addEventListener('change',async event=>{const el=event.target,u=sfState();if(u.busy)return;if(el.dataset?.sfSelect){await sfSelect(Number(el.dataset.sfSelect),el.checked);return;}if(el.dataset?.sfCategory){const e=u.entries.find(e=>e.productId===Number(el.dataset.sfCategory)),c=u.sources?.categories.find(c=>sfCategoryLabel(c)===el.value.trim());if(e){e.nodeId=c?.nodeId||null;e.form=null;e.error=c?'':'Выберите категорию из списка FunPay.';sfInvalidate();sfRefresh();if(c)await sfRead(e);}return;}if(el.dataset?.sfField){const e=u.entries.find(e=>e.productId===Number(el.dataset.sfProduct));if(e){e.fields[el.dataset.sfField]=el.type==='checkbox'?(el.checked?el.value:''):el.value;sfInvalidate();sfRefresh();}return;}if(el.hasAttribute?.('data-sf-activate')){u.activate=el.checked;sfInvalidate();}if(el.hasAttribute?.('data-sf-reviewed'))u.reviewed=el.checked;});
document.addEventListener('input',event=>{const el=event.target,u=sfState();if(u.busy)return;if(el.hasAttribute?.('data-sf-search')){u.query=el.value;u.limit=40;const root=document.querySelector('[data-sf-products]');if(root)root.innerHTML=sfProducts();}if(el.hasAttribute?.('data-sf-durations')){u.durations=el.value;sfInvalidate();}});

document.addEventListener('submit',async event=>{const form=event.target;if(!form.matches?.('[data-sf-creation-resume]'))return;event.preventDefault();await sfResumeCreation(form);});
document.addEventListener('click',async event=>{const button=event.target.closest('[data-sf-queue-fields],[data-sf-repair-close]');if(!button||sfState().busy)return;if(button.hasAttribute('data-sf-repair-close')){sfState().repair=null;sfRefresh();}else await sfLoadQueueFields(button);});
document.addEventListener('change',event=>{
 const el=event.target,u=sfState(),p=u.repair;if(u.busy||!p)return;
 if(el.hasAttribute?.('data-sf-repair-review')){p.reviewed=el.checked;sfRefresh();return;}
 if(!el.dataset?.sfRepairField)return;const e=p.entries.find(e=>e.productId===Number(el.dataset.sfRepairProduct)),c=p.form.controls.find(c=>c.name===el.dataset.sfRepairField);if(!e||!c)return;
 const selected=c.kind==='select'?c.options.find(o=>o.value&&(el.tagName==='SELECT'?o.value===el.value:sfRepairOption(o,c)===el.value)):null;
 e.fields[c.name]=c.kind==='select'?selected?.value||'':c.kind==='checkbox'?el.checked?c.checkedValue:'':el.value;p.reviewed=false;u.error=c.kind==='select'&&el.value&&!selected?'Выберите значение из списка FunPay.':'';sfRefresh();
});
document.addEventListener('submit',async event=>{const form=event.target;if(!form.matches?.('[data-sf-queue-fields-save]'))return;event.preventDefault();await sfSaveQueueFields(form);});

document.addEventListener('click',event=>{const button=event.target.closest('[data-sf-hold]'),u=sfState();if(!button||u.busy)return;u.openHold=button.getAttribute('aria-expanded')==='true'?'':button.dataset.sfHold;sfRefresh();});
