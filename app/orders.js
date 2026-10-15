/* Orders workspace: local views over the existing read-only snapshot. */
const ordersPageState = { query: '', status: 'all', currency: 'all', sort: 'newest', page: 1, size: 10, period:'all', from:'', to:'', scopeKey:null, generation: null, snapshot: null, busy: false, request: null, error: '', detailId: null };
const ORDER_ACTIVE_STATUSES = new Set(['paid', 'processing', 'delivered']);
const ORDER_FILTERS = ['all', 'active', 'completed', 'refunded'];
const ORDER_SORTS = ['newest', 'oldest', 'source', 'amount-asc', 'amount-desc'];
const ORDER_PERIODS = Object.freeze({all:'Вся история',today:'Сегодня',yesterday:'Вчера',last7:'7 дней',last30:'30 дней',week:'Эта неделя',month:'Этот месяц',custom:'Свои даты',undated:'Без точной даты'});
const ORDER_MOSCOW_OFFSET=3*60*60*1000;
const orderDayKey=ms=>new Date(ms+ORDER_MOSCOW_OFFSET).toISOString().slice(0,10);
function orderCalendarDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value))return null;
 const [y,m,d]=value.split('-').map(Number),day=Date.UTC(y,m-1,d);
 if(y<2000||y>2100||new Date(day).toISOString().slice(0,10)!==value)return null;
 return day-ORDER_MOSCOW_OFFSET;
}
function orderPeriodRange(filters={},now=Date.now()){
 const key=Object.hasOwn(ORDER_PERIODS,filters.period)?filters.period:'all',label=ORDER_PERIODS[key];
 if(key==='all'||key==='undated')return {key,label,start:null,end:null,error:''};
 const day=orderCalendarDate(orderDayKey(now)),shifted=new Date(day+ORDER_MOSCOW_OFFSET);
 let start=day,end=day+86400000,error='';
 if(key==='yesterday'){start=day-86400000;end=day;}
 if(key==='last7')start=day-6*86400000;
 if(key==='last30')start=day-29*86400000;
 if(key==='week')start=day-((shifted.getUTCDay()+6)%7)*86400000;
 if(key==='month')start=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),1)-ORDER_MOSCOW_OFFSET;
 if(key==='custom'){
  start=orderCalendarDate(filters.from);const last=orderCalendarDate(filters.to);end=last===null?null:last+86400000;
  if(start===null||end===null)error='Выберите начальную и конечную дату.';
  else if(start>=end)error='Начальная дата должна быть не позже конечной.';
 }
 return {key,label,start,end,error};
}
const orderStableId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
const orderStatusMatches = (order, status) => status === 'all' || (status === 'active' ? ORDER_ACTIVE_STATUSES.has(order.status) : order.status === status);

function buildOrdersWorkspace(content, filters = {}) {
  const snapshot = buildOverview(content);
  const orders = snapshot.loaded ? snapshot.orders : [];
  const range=orderPeriodRange(filters,Number.isFinite(filters.now)?filters.now:Date.now());
  const periodOrders=range.error?[]:orders.filter(order=>range.key==='all'||(range.key==='undated'?order.date===null:order.date!==null&&order.date>=range.start&&order.date<range.end));
  const query = String(filters.query || '').trim().toLocaleLowerCase('ru-RU');
  const status = ORDER_FILTERS.includes(filters.status) ? filters.status : 'all';
  const currency = snapshot.currencies.includes(filters.currency) ? filters.currency : 'all';
  const base = periodOrders.filter(order => (currency === 'all' || order.currency === currency) && (!query || (order.id+' #'+order.id.replace(/^#/, '')+' '+order.product+' '+order.buyer).toLocaleLowerCase('ru-RU').includes(query)));
  const counts = Object.fromEntries(ORDER_FILTERS.map(key => [key, base.filter(order => orderStatusMatches(order, key)).length]));
  const filtered = base.filter(order => orderStatusMatches(order, status));
  const currencies = new Set(filtered.filter(order => order.amount != null).map(order => order.currency));
  const canSortAmount = filtered.some(order => order.amount != null) && currencies.size === 1;
  const canSortDate = filtered.some(order => order.date != null);
  let sort = ORDER_SORTS.includes(filters.sort) ? filters.sort : 'newest';
  if (sort.startsWith('amount-') && !canSortAmount) sort = 'newest';
  const sorted = [...filtered];
  if(sort!=='source')sorted.sort((a,b)=>{
    const key=sort.startsWith('amount-')?'amount':'date';
    if(a[key]===null||b[key]===null){if(a[key]!==b[key])return a[key]===null?1:-1;return orderStableId(a,b);}
    const difference=['amount-desc','newest'].includes(sort)?b[key]-a[key]:a[key]-b[key];
    return difference||orderStableId(a,b);
  });
  const size = [10, 20, 50].includes(Number(filters.size)) ? Number(filters.size) : 10;
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(Number(filters.page)) ? Number(filters.page) : 1));
  const start = (page - 1) * size;
  const totals = { all: periodOrders.length, active: periodOrders.filter(order => ORDER_ACTIVE_STATUSES.has(order.status)).length, completed: periodOrders.filter(order => order.status === 'completed').length, refunded: periodOrders.filter(order => order.status === 'refunded').length };
  const unknownDates=orders.filter(order=>order.date===null).length;
  const source=content?.orderArchive;
  const archive=source&&Number.isSafeInteger(source.total)&&source.total>=orders.length?{total:source.total,truncated:source.truncated===true,firstObservedAt:source.firstObservedAt}:null;
  return { snapshot, orders, periodOrders, range, archive, unknownDates, base, filtered: sorted, rows: sorted.slice(start, start + size), counts, totals, query, status, currency, sort, size, pages, page, start, canSortAmount, canSortDate, missingDates: filtered.filter(order => order.date == null).length, missingAmounts: filtered.filter(order => order.amount == null).length };
}

function orderBuyerTone(name) {
  const tones = ['amber', 'blue', 'violet', 'green', 'red'];
  let hash = 0;
  for (const character of name) hash = (hash + character.codePointAt(0)) % tones.length;
  return tones[hash];
}

function orderDateMarkup(date, sourceDateLabel = '') {
  if (date == null) return sourceDateLabel ? `<span>${overviewEscape(sourceDateLabel)}</span><small>Год или точное время не переданы</small>` : '<span class="orders-page-date--missing">Не передана</span>';
  const value = new Date(date);
  return `<time datetime="${value.toISOString()}"><span>${overviewEscape(value.toLocaleDateString('ru-RU', { timeZone:'Europe/Moscow', day: 'numeric', month: 'short', year: 'numeric' }))}</span><small>${overviewEscape(value.toLocaleTimeString('ru-RU', { timeZone:'Europe/Moscow', hour: '2-digit', minute: '2-digit' }))}</small></time>`;
}

function orderRowsMarkup(rows) {
  return rows.map(order => {
    const meta = OVERVIEW_STATUSES[order.status];
    const initials = Array.from(order.buyer).slice(0, 2).join('').toLocaleUpperCase('ru-RU');
    const id = order.id.startsWith('#') ? order.id : `#${order.id}`;
    return `<tr>
      <td class="orders-page-order-cell" data-label="Заказ / товар"><button class="orders-page-order" type="button" data-order-open="${overviewEscape(order.id)}" aria-label="Посмотреть заказ ${overviewEscape(id)}"><strong>${overviewEscape(id)}</strong><span title="${overviewEscape(order.product)}">${overviewEscape(order.product)}</span></button></td>
      <td class="orders-page-buyer-cell" data-label="Покупатель"><div class="orders-page-buyer"><span class="orders-page-avatar orders-page-avatar--${orderBuyerTone(order.buyer)}" aria-hidden="true">${overviewEscape(initials)}</span><span><strong title="${overviewEscape(order.buyer)}">${overviewEscape(order.buyer)}</strong><small>FunPay</small></span></div></td>
      <td data-label="Статус"><span class="orders-page-status orders-page-status--${order.status}"><i aria-hidden="true"></i>${meta.label}</span></td>
      <td class="orders-page-amount" data-label="Сумма"><strong>${overviewEscape(overviewMoney(order.amount, order.currency))}</strong></td>
      <td class="orders-page-date" data-label="Создан">${orderDateMarkup(order.date, order.sourceDateLabel)}</td>
      <td class="orders-page-row-arrow"><button class="orders-page-detail-button" type="button" data-order-open="${overviewEscape(order.id)}" aria-label="Подробнее о заказе ${overviewEscape(id)}"><svg aria-hidden="true"><use href="#i-chevron"/></svg></button></td>
    </tr>`;
  }).join('');
}

function orderEmptyMarkup(model, connected) {
  const emptySnapshot = model.snapshot.loaded && !model.orders.length;
  const title = !model.snapshot.loaded ? connected ? 'Заказы ещё не загружены' : 'Подключите ваш магазин' : emptySnapshot ? 'В снимке пока нет заказов' : 'Ничего не найдено';
  const description = !model.snapshot.loaded ? connected ? 'Нажмите «Обновить заказы», чтобы получить данные FunPay.' : 'Привяжите FunPay, чтобы видеть заказы и их статусы.' : emptySnapshot ? 'Обновите данные после появления новых заказов на FunPay.' : model.range.error || (model.range.key!=='all'?'В выбранном периоде нет подходящих заказов. Измените даты или другие фильтры.':'Измените запрос или сбросьте фильтры.');
  const button = !model.snapshot.loaded && !connected ? '<button class="button button--primary" type="button" data-open-connect>Подключить FunPay</button>' : model.orders.length ? '<button class="orders-page-empty__reset" type="button" data-orders-reset-filters>Сбросить фильтры</button>' : '';
  return `<tr class="orders-page-empty-row"><td colspan="6"><div class="orders-page-empty"><span class="orders-page-icon orders-page-icon--amber"><svg><use href="#i-bag"/></svg></span><strong>${title}</strong><p>${description}</p>${button}</div></td></tr>`;
}

function closeOrderDetail() {
  ordersPageState.detailId = null;
  const dialog = document.querySelector('[data-order-dialog]');
  if (!dialog) return;
  if (dialog.open) dialog.close();
  const body = dialog.querySelector('[data-order-detail-body]');
  if (body) body.innerHTML = '';
}

function renderOrderDetail(model) {
  const dialog = document.querySelector('[data-order-dialog]');
  const order = ordersPageState.detailId != null ? model.orders.find(item => item.id === ordersPageState.detailId) : null;
  if (!dialog || !order) { if (ordersPageState.detailId != null) closeOrderDetail(); return; }
  const title = dialog.querySelector('[data-order-detail-title]');
  const body = dialog.querySelector('[data-order-detail-body]');
  if (title) title.textContent = order.id.startsWith('#') ? order.id : `#${order.id}`;
  if (body) body.innerHTML = `<p class="orders-page-detail-product">${overviewEscape(order.product)}</p><dl class="orders-page-detail-fields"><div><dt>Покупатель</dt><dd>${overviewEscape(order.buyer)}</dd></div><div><dt>Статус</dt><dd><span class="orders-page-status orders-page-status--${order.status}"><i aria-hidden="true"></i>${OVERVIEW_STATUSES[order.status].label}</span></dd></div><div><dt>Сумма заказа</dt><dd>${overviewEscape(overviewMoney(order.amount, order.currency))}</dd></div><div><dt>Создан</dt><dd>${order.date == null ? overviewEscape(order.sourceDateLabel || 'FunPay не передал дату заказа') : overviewEscape(new Date(order.date).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}))}</dd></div><div><dt>Снимок получен</dt><dd>${overviewEscape(new Date(model.snapshot.observedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}))}</dd></div></dl><p class="orders-page-detail-note">Карточка показывает данные снимка. Изменение статуса и действия на FunPay здесь недоступны.</p>`;
}

function renderOrderWorkspace() {
  if (typeof state === 'undefined' || typeof buildOverview !== 'function') return false;
  const root = document.querySelector('[data-orders-workspace]');
  if (!root) return false;
  const scopeKey=String(selectedStore()?.id||'');
  if (ordersPageState.generation !== sessionGeneration || ordersPageState.scopeKey!==scopeKey) {
    Object.assign(ordersPageState, { query: '', status: 'all', currency: 'all', sort: 'newest', period:'all', from:'', to:'', page: 1, size: 10, scopeKey, generation: sessionGeneration, error: '', request: null, busy: false });
    closeOrderDetail();
  }
  if (ordersPageState.snapshot !== state.storeContent) { ordersPageState.snapshot = state.storeContent; ordersPageState.error = ''; }
  const model = buildOrdersWorkspace(state.storeContent, ordersPageState);
  Object.assign(ordersPageState, { currency: model.currency, sort: model.sort, page: model.page });
  const connected = selectedStore()?.status === 'connected_read_only';
  const setText = (name, value) => { const node = root.querySelector(`[data-orders-${name}]`); if (node) node.textContent = value; };
  const snapshot = model.snapshot;
  root.querySelectorAll('[data-orders-period]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.ordersPeriod===model.range.key)));
  const dates=root.querySelector('[data-orders-date-range]');if(dates)dates.hidden=model.range.key!=='custom';
  for(const [name,value] of [['from',ordersPageState.from],['to',ordersPageState.to]]){const field=root.querySelector('[data-orders-'+name+']');if(field&&field.value!==value)field.value=value;}
  setText('period-label',model.range.label+' · московское время');
  root.querySelectorAll('[data-orders-stat-period]').forEach(node=>{node.textContent=model.range.key==='all'?'В доступной истории':model.range.label;});
  setText('coverage',model.archive?'Сохранено '+model.archive.total+' заказов. История пополняется при синхронизации; заказы до начала наблюдения могут отсутствовать.':'Отображаются загруженные заказы. Просмотр и фильтры не изменяют данные FunPay.');
  setText('total', snapshot.loaded ? String(model.totals.all) : '—');
  setText('active', snapshot.loaded ? String(model.totals.active) : '—');
  setText('done', snapshot.loaded ? String(model.totals.completed) : '—');
  setText('refunded', snapshot.loaded ? String(model.totals.refunded) : '—');
  setText('source', connected ? 'FunPay подключён · read-only' : 'Магазин не подключён');
  root.querySelector('[data-orders-source]')?.classList.toggle('is-connected', connected);
  setText('snapshot-time', snapshot.loaded ? `Снимок от ${new Date(snapshot.observedAt).toLocaleString('ru-RU', { timeZone:'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Ожидает синхронизации');
  const refresh = root.querySelector('[data-orders-refresh]');
  if (refresh) { refresh.disabled = !connected || ordersPageState.busy; refresh.setAttribute('aria-busy', String(ordersPageState.busy)); }
  root.setAttribute('aria-busy', String(ordersPageState.busy));
  setText('refresh-label', ordersPageState.busy ? 'Обновляем…' : 'Обновить заказы');
  const connect = root.querySelector('[data-orders-connect]');
  if (connect) connect.hidden = connected;
  const notice = root.querySelector('[data-orders-notice]');
  const noticeText = ordersPageState.error || (snapshot.loaded && !connected ? 'Подключение требует проверки. Отображается последний загруженный снимок.' : '');
  if (notice) { notice.hidden = !noticeText; notice.textContent = noticeText; }
  const search = root.querySelector('[data-orders-search]');
  if (search && search.value !== ordersPageState.query) search.value = ordersPageState.query;
  const currency = root.querySelector('[data-orders-currency]');
  if (currency) { currency.innerHTML = '<option value="all">Все валюты</option>' + snapshot.currencies.map(code => `<option value="${code}">${code}</option>`).join(''); currency.value = model.currency; }
  const sort = root.querySelector('[data-orders-sort]');
  if (sort) {
    sort.value = model.sort;
    sort.querySelectorAll('option').forEach(option => { option.disabled = option.value.startsWith('amount-') ? !model.canSortAmount : false; });
  }
  root.querySelectorAll('[data-orders-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ordersFilter === model.status)));
  root.querySelectorAll('[data-orders-filter-count]').forEach(node => { node.textContent = snapshot.loaded ? String(model.counts[node.dataset.ordersFilterCount]) : '—'; });
  const isFiltered = model.query || model.status !== 'all' || model.currency !== 'all' || model.sort !== 'newest' || model.range.key !== 'all';
  root.querySelectorAll('[data-orders-reset-filters]').forEach(button => { if (!button.closest('.orders-page-empty')) button.hidden = !isFiltered; });
  const hints = [];
  if(model.range.error)hints.push(model.range.error);
  if(!['all','undated'].includes(model.range.key)&&model.unknownDates)hints.push(model.unknownDates+' заказов без точной даты не включены в период. Их можно посмотреть в фильтре «Без точной даты».');
  if(model.archive?.truncated)hints.push('Загружено '+model.orders.length+' из '+model.archive.total+' сохранённых заказов. Фильтры применяются к загруженной части истории.');
  if (snapshot.loaded && model.filtered.length && model.missingDates) hints.push(['newest', 'oldest'].includes(model.sort) ? `${model.missingDates} заказов без даты показаны в конце списка.` : `У ${model.missingDates} заказов FunPay не передал дату.`);
  if (snapshot.loaded && model.filtered.length && !model.canSortAmount && new Set(model.filtered.filter(order => order.amount != null).map(order => order.currency)).size > 1) hints.push('Для сортировки по сумме выберите одну валюту.');
  if (model.sort.startsWith('amount-') && model.missingAmounts) hints.push('Заказы без суммы показаны в конце списка.');
  const hint = root.querySelector('[data-orders-filter-hint]');
  if (hint) { hint.hidden = !hints.length; hint.textContent = hints.join(' '); }
  const table = root.querySelector('#orders-table-body');
  if (table) table.innerHTML = model.rows.length ? orderRowsMarkup(model.rows) : orderEmptyMarkup(model, connected);
  setText('list-total', !snapshot.loaded ? 'Ожидает синхронизации' : isFiltered ? `Найдено ${model.filtered.length} из ${model.orders.length}` : `${model.orders.length} заказов в доступной истории`);
  setText('count', !snapshot.loaded ? 'Заказы ещё не загружены' : model.filtered.length ? `${model.start + 1}–${model.start + model.rows.length} из ${model.filtered.length} заказов` : 'Нет заказов для отображения');
  setText('page-label', `${model.page} / ${model.pages}`);
  const size = root.querySelector('[data-orders-page-size]');
  if (size) size.value = String(model.size);
  root.querySelectorAll('[data-orders-page]').forEach(button => { button.disabled = button.dataset.ordersPage === 'prev' ? model.page <= 1 : model.page >= model.pages; });
  renderOrderDetail(model);
  return true;
}

async function refreshOrderWorkspace() {
  if (ordersPageState.busy || selectedStore()?.status !== 'connected_read_only') return;
  const generation = sessionGeneration;
  const request = {};
  ordersPageState.request = request;
  ordersPageState.busy = true;
  ordersPageState.error = '';
  renderOrderWorkspace();
  try { await syncStoreContent({ silent: true }); }
  catch (error) {
    if (generation === sessionGeneration && ordersPageState.request === request) ordersPageState.error = `${humanError(error)}${state.storeContent.observedAt ? ' Отображается предыдущий снимок.' : ''}`;
  } finally {
    if (ordersPageState.request === request) { ordersPageState.busy = false; ordersPageState.request = null; renderOrderWorkspace(); }
  }
}

document.addEventListener('input', event => {
  if (typeof state === 'undefined' || !event.target.matches('[data-orders-search]')) return;
  ordersPageState.query = event.target.value;
  ordersPageState.page = 1;
  renderOrderWorkspace();
});
document.addEventListener('change', event => {
  if (typeof state === 'undefined') return;
  for(const key of ['from','to'])if(event.target.matches('[data-orders-'+key+']')){ordersPageState[key]=event.target.value;ordersPageState.period='custom';ordersPageState.page=1;renderOrderWorkspace();return;}
  for (const [selector, key] of [['[data-orders-currency]', 'currency'], ['[data-orders-sort]', 'sort'], ['[data-orders-page-size]', 'size']]) {
    if (event.target.matches(selector)) { ordersPageState[key] = event.target.value; ordersPageState.page = 1; renderOrderWorkspace(); return; }
  }
});
document.addEventListener('click', event => {
  if (typeof state === 'undefined') return;
  if (event.target.closest('[data-order-close]')) { closeOrderDetail(); return; }
  const root = event.target.closest('[data-orders-workspace]');
  if (!root) return;
  if (event.target.closest('[data-orders-refresh]')) { refreshOrderWorkspace(); return; }
  const period=event.target.closest('[data-orders-period]');
  if(period&&Object.hasOwn(ORDER_PERIODS,period.dataset.ordersPeriod)){ordersPageState.period=period.dataset.ordersPeriod;ordersPageState.page=1;renderOrderWorkspace();return;}
  const filter = event.target.closest('[data-orders-filter]');
  if (filter) { ordersPageState.status = filter.dataset.ordersFilter; ordersPageState.page = 1; renderOrderWorkspace(); return; }
  if (event.target.closest('[data-orders-reset-filters]')) { Object.assign(ordersPageState, { query: '', status: 'all', currency: 'all', sort: 'newest', period:'all', from:'', to:'', page: 1 }); renderOrderWorkspace(); return; }
  const page = event.target.closest('[data-orders-page]');
  if (page && !page.disabled) { ordersPageState.page += page.dataset.ordersPage === 'prev' ? -1 : 1; renderOrderWorkspace(); return; }
  const open = event.target.closest('[data-order-open]');
  if (open) {
    const model = buildOrdersWorkspace(state.storeContent, ordersPageState);
    if (!model.orders.some(order => order.id === open.dataset.orderOpen)) return;
    ordersPageState.detailId = open.dataset.orderOpen;
    renderOrderDetail(model);
    const dialog = document.querySelector('[data-order-dialog]');
    if (dialog && !dialog.open) dialog.showModal();
  }
});
const orderDetailDialog = document.querySelector('[data-order-dialog]');
orderDetailDialog?.addEventListener('close', () => { ordersPageState.detailId = null; const body = orderDetailDialog.querySelector('[data-order-detail-body]'); if (body) body.innerHTML = ''; });
orderDetailDialog?.addEventListener('click', event => {
  if (event.target !== orderDetailDialog) return;
  const rect = orderDetailDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeOrderDetail();
});
window.addEventListener('hashchange', () => { if (location.hash !== '#orders') closeOrderDetail(); });
