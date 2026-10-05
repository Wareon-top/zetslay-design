/* Inventory presentation reads the existing snapshot; it never writes to FunPay. */
const lotsPageState={query:'',status:'all',category:'all',currency:'all',sort:'source',page:1,size:10,busy:false,error:'',request:null,generation:null,detailId:null};
const LOT_STATUSES={active:{label:'Активен',tone:'green'},paused:{label:'На паузе',tone:'muted'},unknown:{label:'Статус не передан',tone:'unknown'}};
const lotEscape=value=>escapeHtml(value??'');
const lotNumber=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const lotOfferUrl=id=>/^[1-9][0-9]{0,19}$/.test(id)?`https://funpay.com/lots/offer?id=${id}`:'';
function buildLotsWorkspace(content,filters={},expectedStoreId=null) {
  const observedAt=typeof content?.observedAt==='string'&&Number.isFinite(Date.parse(content.observedAt))?content.observedAt:null;
  const sourceId=content?.storeId??content?.profile?.id;
  const matches=expectedStoreId!=null&&(sourceId==null||String(sourceId)===String(expectedStoreId));
  const unavailable=matches&&observedAt&&content?.availableResources?.lots===false;
  const loaded=Boolean(matches&&observedAt&&!unavailable&&Array.isArray(content?.lots));
  const seen=new Set();
  const lots=loaded?content.lots.flatMap(raw=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.id!=='string'&&typeof raw.id!=='number')return [];
    const id=String(raw.id);if(!id||id.length>128||seen.has(id))return [];seen.add(id);
    const status=['active','paused'].includes(raw.status)?raw.status:'unknown';
    const category=typeof raw.category==='string'&&raw.category.trim()?raw.category.trim().slice(0,160):'';
    const currency=['RUB','USD','EUR'].includes(raw.currency)?raw.currency:null;
    return [{id,title:typeof raw.title==='string'&&raw.title.trim()?raw.title.slice(0,1000):'Лот FunPay',category,status,price:currency?lotNumber(raw.priceMinor):null,currency,stock:lotNumber(raw.stock),sales:lotNumber(raw.sales),position:lotNumber(raw.position),url:lotOfferUrl(id)}];
  }):[];
  const categories=[...new Set(lots.map(lot=>lot.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
  const currencies=[...new Set(lots.map(lot=>lot.currency).filter(Boolean))].sort();
  const category=categories.includes(filters.category)?filters.category:'all',currency=currencies.includes(filters.currency)?filters.currency:'all';
  const query=String(filters.query||'').trim().toLocaleLowerCase('ru-RU');
  const status=['all','active','paused','empty','unknown'].includes(filters.status)?filters.status:'all';
  const matching=lot=>status==='all'||status==='empty'&&lot.stock===0||lot.status===status;
  const base=lots.filter(lot=>(category==='all'||lot.category===category)&&(currency==='all'||lot.currency===currency)&&(!query||`${lot.id} #${lot.id} ${lot.title} ${lot.category}`.toLocaleLowerCase('ru-RU').includes(query)));
  const counts=Object.fromEntries(['all','active','paused','empty','unknown'].map(key=>[key,base.filter(lot=>key==='all'||key==='empty'&&lot.stock===0||lot.status===key).length]));
  const filtered=base.filter(matching);
  const priceCurrencies=new Set(filtered.filter(lot=>lot.price!=null).map(lot=>lot.currency));
  const canSortPrice=filtered.some(lot=>lot.price!=null)&&priceCurrencies.size===1;
  let sort=['source','name','price-asc','price-desc','stock-asc'].includes(filters.sort)?filters.sort:'source';
  if(sort.startsWith('price-')&&!canSortPrice)sort='source';
  if(sort==='name')filtered.sort((a,b)=>a.title.localeCompare(b.title,'ru'));
  if(sort.startsWith('price-')||sort==='stock-asc')filtered.sort((a,b)=>{const key=sort==='stock-asc'?'stock':'price';if(a[key]==null||b[key]==null)return a[key]==null?(b[key]==null?0:1):-1;return sort==='price-desc'?b[key]-a[key]:a[key]-b[key];});
  const size=[10,20,50].includes(Number(filters.size))?Number(filters.size):10;
  const pages=Math.max(1,Math.ceil(filtered.length/size)),page=Math.min(pages,Math.max(1,Number.isSafeInteger(Number(filters.page))?Number(filters.page):1)),start=(page-1)*size;
  const totals={all:lots.length,active:lots.filter(lot=>lot.status==='active').length,paused:lots.filter(lot=>lot.status==='paused').length,empty:lots.filter(lot=>lot.stock===0).length};
  return {loaded,unavailable:Boolean(unavailable),observedAt:matches?observedAt:null,lots,categories,currencies,query,status,category,currency,sort,canSortPrice,counts,totals,filtered,rows:filtered.slice(start,start+size),page,size,pages,start};
}
function lotPrice(lot){return lot.price==null?'Не передана':new Intl.NumberFormat('ru-RU',{style:'currency',currency:lot.currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(lot.price/100);}
function lotStatus(lot){return `<span class="inventory-status inventory-status--${LOT_STATUSES[lot.status].tone}"><i></i>${LOT_STATUSES[lot.status].label}</span>`;}
function lotRowsMarkup(rows){return rows.map(lot=>`<tr><td data-label="Лот"><div class="inventory-product"><span class="inventory-product__icon">${icon('box')}</span><div><button type="button" class="inventory-product__name" data-lot-open="${lotEscape(lot.id)}">${lotEscape(lot.title)}</button><span>ID ${lotEscape(lot.id)} · ${lotEscape(lot.category||'Категория не передана')}</span></div></div></td><td data-label="Статус">${lotStatus(lot)}</td><td data-label="Цена" class="inventory-price">${lotEscape(lotPrice(lot))}${lot.currency?`<small>${lot.currency}</small>`:''}</td><td data-label="Остаток"><span class="inventory-stock${lot.stock===0?' is-empty':''}">${lot.stock==null?'Не передан':lot.stock===0?'Нет в наличии':lot.stock}</span></td><td class="inventory-row-actions"><button type="button" data-lot-open="${lotEscape(lot.id)}" aria-label="Подробнее о лоте ${lotEscape(lot.id)}">${icon('chevron-right')}</button>${lot.url?`<a href="${lot.url}" target="_blank" rel="noopener noreferrer" aria-label="Открыть лот ${lotEscape(lot.id)} на FunPay">${icon('external')}</a>`:''}</td></tr>`).join('');}
function lotsEmptyMarkup(model,connected){
  const title=!connected&&!model.loaded?'Подключите ваш магазин':model.unavailable?'Список лотов пока недоступен':!model.loaded?'Лоты ещё не загружены':!model.lots.length?'В снимке нет лотов':'Ничего не найдено';
  const copy=model.unavailable?'Подключение пока не передаёт список лотов. Вы можете открыть свой магазин на FunPay.':!model.loaded?'Данные появятся после подключения и успешной синхронизации списка лотов.':!model.lots.length?'В последнем полученном списке нет товаров.':'Измените поиск или сбросьте фильтры.';
  const action=!connected&&!model.loaded?'<button class="button button--primary" type="button" data-open-connect>Подключить FunPay</button>':model.lots.length?'<button class="button button--ghost" type="button" data-lots-reset>Сбросить фильтры</button>':'';
  return `<tr><td colspan="5"><div class="inventory-empty"><span>${icon('box')}</span><h3>${title}</h3><p>${copy}</p>${action}</div></td></tr>`;
}
function closeLotDetail(){lotsPageState.detailId=null;const dialog=document.querySelector('[data-lot-dialog]');if(dialog?.open)dialog.close();const body=dialog?.querySelector('[data-lot-detail-body]');if(body)body.innerHTML='';}
function resetLotsWorkspace(){Object.assign(lotsPageState,{query:'',status:'all',category:'all',currency:'all',sort:'source',page:1,size:10,busy:false,error:'',request:null,generation:sessionGeneration,detailId:null});closeLotDetail();}
function currentLotsModel(){return buildLotsWorkspace(authState.user?state.storeContent:null,lotsPageState,authState.user?selectedStore()?.id:null);}
function renderLotDetail(model){
  if(lotsPageState.detailId==null)return;
  const lot=model.lots.find(row=>row.id===lotsPageState.detailId),dialog=document.querySelector('[data-lot-dialog]');
  if(!lot||!dialog){closeLotDetail();return;}
  const title=dialog.querySelector('[data-lot-detail-title]');if(title)title.textContent=lot.title;
  const body=dialog.querySelector('[data-lot-detail-body]');if(body)body.innerHTML=`<div class="inventory-detail-top">${lotStatus(lot)}<span>ID ${lotEscape(lot.id)}</span></div><div class="inventory-detail-price">${lotEscape(lotPrice(lot))}</div><dl class="inventory-detail-facts">${[['Категория',lot.category||'Не передана'],['Остаток',lot.stock??'Не передан'],['Продажи',lot.sales??'Не переданы'],['Позиция',lot.position??'Не передана']].map(([label,value])=>`<div><dt>${label}</dt><dd>${lotEscape(value)}</dd></div>`).join('')}</dl><p class="inventory-detail-note">Данные последней синхронизации. Изменения товара выполняйте на FunPay или через настроенные плагины.</p>${lot.url?`<a class="button button--primary button--wide" href="${lot.url}" target="_blank" rel="noopener noreferrer">Открыть на FunPay ${icon('external')}</a>`:''}`;
}
function renderLotWorkspace(){
  const root=document.querySelector('[data-lots-workspace]');if(!root)return false;
  if(lotsPageState.generation!==sessionGeneration)resetLotsWorkspace();
  const model=currentLotsModel(),connected=Boolean(authState.user&&selectedStore()?.status==='connected_read_only');
  Object.assign(lotsPageState,{page:model.page,size:model.size,category:model.category,currency:model.currency,sort:model.sort});
  const set=(name,value)=>{const node=root.querySelector(`[data-lots-${name}]`);if(node)node.textContent=value;};
  for(const key of ['all','active','paused','empty'])set(key,model.loaded?String(model.totals[key]):'—');
  const time=model.observedAt?new Date(model.observedAt).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Ещё не синхронизировано';set('updated',time);
  const refresh=root.querySelector('[data-lots-refresh]');if(refresh){refresh.disabled=!connected||lotsPageState.busy;refresh.setAttribute('aria-busy',String(lotsPageState.busy));refresh.innerHTML=`${icon('refresh-cw')} ${lotsPageState.busy?'Обновляем…':'Обновить данные'}`;}
  const alert=root.querySelector('[data-lots-alert]');if(alert){alert.hidden=false;alert.classList.toggle('inventory-alert--error',Boolean(lotsPageState.error));const message=lotsPageState.error?lotsPageState.error+(model.loaded?' Показан предыдущий список.':''):model.unavailable?'Лоты пока недоступны в синхронизации этого магазина.':model.loaded?'Цены, остатки и статусы показаны по последней синхронизации.':connected?'Синхронизируйте магазин, чтобы проверить доступность списка лотов.':'Подключите магазин FunPay для получения данных.';alert.querySelector('[data-lots-alert-title]').textContent=lotsPageState.error?'Не удалось обновить данные':model.unavailable?'Список не получен':model.loaded?'Данные магазина':'Подключение магазина';alert.querySelector('[data-lots-alert-copy]').textContent=message;}
  const search=root.querySelector('[data-lots-search]');if(search&&search.value!==lotsPageState.query)search.value=lotsPageState.query;
  for(const [key,options,label] of [['category',model.categories,'Все категории'],['currency',model.currencies,'Все валюты']]){const select=root.querySelector(`[data-lots-${key}]`);if(select){select.innerHTML=`<option value="all">${label}</option>`+options.map(value=>`<option value="${lotEscape(value)}">${lotEscape(value)}</option>`).join('');select.value=model[key];select.disabled=!options.length;}}
  const sort=root.querySelector('[data-lots-sort]');if(sort){sort.value=model.sort;sort.querySelectorAll('option').forEach(option=>{option.disabled=option.value.startsWith('price-')&&!model.canSortPrice;});}
  root.querySelectorAll('[data-lots-status]').forEach(button=>{const active=button.dataset.lotsStatus===model.status;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));const count=button.querySelector('[data-lots-tab-count]');if(count)count.textContent=model.loaded?String(model.counts[button.dataset.lotsStatus]):'—';});
  const hint=root.querySelector('[data-lots-sort-hint]');if(hint){hint.hidden=!model.loaded||model.canSortPrice||!model.filtered.some(lot=>lot.price!=null);hint.textContent='Для сравнения цен выберите одну валюту. Суммы в разных валютах не смешиваются.';}
  const filtered=Boolean(model.query||model.category!=='all'||model.currency!=='all'||model.status!=='all');
  const reset=root.querySelector('[data-lots-reset]');if(reset)reset.hidden=!filtered;
  set('list-count',!model.loaded?'Ожидает данных':filtered?`Найдено ${model.filtered.length} из ${model.lots.length}`:`${model.lots.length} лотов в снимке`);
  const rows=root.querySelector('[data-lots-rows]');if(rows)rows.innerHTML=model.rows.length?lotRowsMarkup(model.rows):lotsEmptyMarkup(model,connected);
  set('page-label',`${model.page} / ${model.pages}`);set('range',model.filtered.length?`${model.start+1}–${model.start+model.rows.length} из ${model.filtered.length}`:'Нет лотов для отображения');
  const size=root.querySelector('[data-lots-size]');if(size)size.value=String(model.size);
  root.querySelectorAll('[data-lots-page]').forEach(button=>{button.disabled=button.dataset.lotsPage==='prev'?model.page<=1:model.page>=model.pages;});
  const storeLink=root.querySelector('[data-lots-store-link]');const storeId=selectedStore()?.id;const safe=authState.user&&/^[1-9][0-9]{0,19}$/.test(String(storeId||''));if(storeLink){storeLink.hidden=!safe;if(safe)storeLink.href=`https://funpay.com/users/${storeId}/`;else storeLink.removeAttribute('href');}
  renderLotDetail(model);return true;
}
async function refreshLotsWorkspace(){
  if(lotsPageState.busy||!authState.user||selectedStore()?.status!=='connected_read_only')return;
  if(lotsPageState.generation!==sessionGeneration)resetLotsWorkspace();
  const request={},generation=sessionGeneration;lotsPageState.request=request;lotsPageState.busy=true;lotsPageState.error='';renderLotWorkspace();
  try{await syncStoreContent({silent:true});}catch(error){if(generation===sessionGeneration&&lotsPageState.request===request)lotsPageState.error=humanError(error);}
  finally{if(generation===sessionGeneration&&lotsPageState.request===request){lotsPageState.busy=false;lotsPageState.request=null;renderLotWorkspace();}}
}
document.addEventListener('input',event=>{if(event.target.matches?.('[data-lots-search]')){lotsPageState.query=event.target.value;lotsPageState.page=1;renderLotWorkspace();}});
document.addEventListener('change',event=>{for(const key of ['category','currency','sort','size'])if(event.target.matches?.(`[data-lots-${key}]`)){lotsPageState[key]=event.target.value;lotsPageState.page=1;renderLotWorkspace();return;}});
document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-lot-close]')){closeLotDetail();return;}
  const root=event.target.closest?.('[data-lots-workspace]');if(!root)return;
  const status=event.target.closest('[data-lots-status]');if(status){lotsPageState.status=status.dataset.lotsStatus;lotsPageState.page=1;renderLotWorkspace();return;}
  if(event.target.closest('[data-lots-reset]')){Object.assign(lotsPageState,{query:'',status:'all',category:'all',currency:'all',sort:'source',page:1});renderLotWorkspace();return;}
  if(event.target.closest('[data-lots-refresh]')){refreshLotsWorkspace();return;}
  const page=event.target.closest('[data-lots-page]');if(page&&!page.disabled){lotsPageState.page+=page.dataset.lotsPage==='next'?1:-1;renderLotWorkspace();return;}
  const detail=event.target.closest('[data-lot-open]');if(detail){lotsPageState.detailId=detail.dataset.lotOpen;renderLotDetail(currentLotsModel());const dialog=document.querySelector('[data-lot-dialog]');if(lotsPageState.detailId&&dialog&&!dialog.open)dialog.showModal();return;}
  const plugin=event.target.closest('[data-lots-plugin]');if(plugin){event.preventDefault();setView(`plugins/${plugin.dataset.lotsPlugin}`);}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')lotsPageState.detailId=null;});
