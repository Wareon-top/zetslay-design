/* ZetSlay overview: derived only from the existing read-only content snapshot. */
const overviewState = { period: 'day', currency: '', mode: 'days', busy: false, error: '', snapshot: null, chartWidth: 1000, observer: null };
const OVERVIEW_STATUSES = Object.freeze({
  paid: { label: 'Оплачен', color: 'var(--yellow)' },
  processing: { label: 'В работе', color: 'var(--violet)' },
  delivered: { label: 'Выдан', color: 'var(--blue)' },
  completed: { label: 'Завершён', color: 'var(--green)' },
  refunded: { label: 'Возвращён', color: 'var(--red)' },
  cancelled: { label: 'Отменён', color: 'var(--muted)' },
  unknown: { label: 'Без статуса', color: 'var(--muted-2)' }
});
const OVERVIEW_SALES = new Set(['paid', 'processing', 'delivered', 'completed']);
const overviewEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const overviewDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const overviewMoney = (minor, currency) => minor == null ? '—' : new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(minor / 100);
const overviewPercent = value => value == null ? '—' : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)}%`;

const OVERVIEW_PERIODS = Object.freeze({ day: { label:'Сегодня', days:1 }, week: { label:'7 дней', days:7 }, month: { label:'30 дней', days:30 }, all: { label:'Все данные' } });
const OVERVIEW_MOSCOW_OFFSET = 3 * 60 * 60 * 1000;
const overviewDayKey = timestamp => new Date(timestamp + OVERVIEW_MOSCOW_OFFSET).toISOString().slice(0,10);
function overviewPeriodRange(period, now = Date.now()) {
  const key = Object.hasOwn(OVERVIEW_PERIODS, period) ? period : 'all';
  if (key === 'all' || !Number.isFinite(now)) return { key:'all', start:null, end:null, label:'Все загруженные данные', days:null };
  const days = OVERVIEW_PERIODS[key].days;
  const midnight = Date.parse(overviewDayKey(now) + 'T00:00:00+03:00');
  const start = midnight - (days - 1) * 86400000;
  const format = timestamp => new Date(timestamp).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short'});
  return { key, start, end:now, days, label:days === 1 ? format(now) + ' · с 00:00 МСК' : format(start) + ' — ' + format(now) + ' · МСК' };
}

function buildOverview(content, preferredCurrency = '', options = {}) {
  const snapshot = content || {};
  const observedAt = overviewDate(snapshot.observedAt);
  const range = overviewPeriodRange(options.period || 'all', options.now ?? Date.now());
  const seen = new Set();
  const sourceOrders = (Array.isArray(snapshot.orders) ? snapshot.orders : []).filter(order => {
    if (!order || typeof order !== 'object') return false;
    const id = typeof order.id === 'string' && order.id ? order.id : null;
    if (id && seen.has(id)) return false;
    if (id) seen.add(id);
    return true;
  }).map((order, index) => {
    const rawStatus = String(order.status || '').toLowerCase();
    const status = Object.hasOwn(OVERVIEW_STATUSES, rawStatus) ? rawStatus : 'unknown';
    const currency = typeof order.currency === 'string' && /^[A-Z]{3}$/.test(order.currency) ? order.currency : null;
    const amount = Number.isSafeInteger(order.totalMinor) && order.totalMinor >= 0 && currency ? order.totalMinor : null;
    const date = overviewDate(order.createdAt);
    return { id: String(order.id || `Заказ ${index + 1}`), product: String(order.product || order.title || 'Заказ FunPay'), buyer: String(order.buyer || order.buyerName || 'Покупатель FunPay'), sourceDateLabel: typeof order.sourceDateLabel === 'string' ? order.sourceDateLabel.slice(0,240) : '', status, currency, amount, date: date != null && (observedAt == null || date <= observedAt) ? date : null };
  });
  const undatedOrders = sourceOrders.filter(order => order.date == null).length;
  const orders = range.key === 'all' ? sourceOrders : sourceOrders.filter(order => order.date != null && order.date >= range.start && order.date <= range.end);
  const periodUnavailable = range.key !== 'all' && orders.length === 0 && undatedOrders > 0;
  const currencies = [...new Set(sourceOrders.filter(order => order.amount != null).map(order => order.currency))].sort();
  const currency = currencies.includes(preferredCurrency) ? preferredCurrency : currencies.includes('RUB') ? 'RUB' : currencies[0] || 'RUB';
  const sales = orders.filter(order => OVERVIEW_SALES.has(order.status));
  const moneyOrders = sales.filter(order => order.amount != null && order.currency === currency);
  const refunded = orders.filter(order => order.status === 'refunded');
  const moneyRefunds = refunded.filter(order => order.amount != null && order.currency === currency);
  const sum = list => {
    const total = list.reduce((value, order) => value + order.amount, 0);
    return Number.isSafeInteger(total) ? total : null;
  };
  const totalMinor = periodUnavailable ? null : moneyOrders.length ? sum(moneyOrders) : sales.length === 0 && !orders.some(order => order.status === 'unknown') ? 0 : null;
  const refundMinor = periodUnavailable ? null : moneyRefunds.length ? sum(moneyRefunds) : refunded.length === 0 ? 0 : null;
  const statuses = Object.entries(OVERVIEW_STATUSES).map(([id, meta]) => ({ id, ...meta, count: orders.filter(order => order.status === id).length })).filter(item => item.count);
  const unknownCount = orders.filter(order => order.status === 'unknown').length;
  const dated = moneyOrders.length > 0 && moneyOrders.every(order => order.date != null);
  const dayMap = new Map();
  if (dated) moneyOrders.forEach(order => {
    const key = overviewDayKey(order.date);
    const entry = dayMap.get(key) || { label: key, amount: 0, count: 0 };
    entry.amount += order.amount;
    entry.count++;
    dayMap.set(key, entry);
  });
  const messages = (Array.isArray(snapshot.messages) ? snapshot.messages : []).filter(message => message && typeof message.threadId === 'string' && message.threadId);
  const messageDate = message => { const at = overviewDate(message.createdAt); return at != null && (observedAt == null || at <= observedAt) ? at : null; };
  const undatedMessages = messages.filter(message => messageDate(message) == null).length;
  const selectedMessages = range.key === 'all' ? messages : messages.filter(message => { const at = messageDate(message); return at != null && at >= range.start && at <= range.end; });
  const threads = new Set(selectedMessages.map(message => message.threadId));
  return {
    loaded: observedAt != null, observedAt, range, undatedOrders, undatedMessages, periodUnavailable, sourceCount:sourceOrders.length, orders, count: orders.length, salesCount: sales.length,
    moneyOrders, currencies, currency, totalMinor, averageMinor: totalMinor != null && moneyOrders.length ? Math.round(totalMinor / moneyOrders.length) : null,
    refundedCount: refunded.length, refundMinor, moneyRefundCount: moneyRefunds.length,
    refundRate: orders.length && !unknownCount ? refunded.length / orders.length * 100 : null,
    unknownCount, statuses, dialogs: range.key !== 'all' && threads.size === 0 && undatedMessages > 0 ? null : threads.size, dated,
    days: [...dayMap.values()].sort((a, b) => a.label.localeCompare(b.label))
  };
}

function overviewChartMarkup(model, mode, availableWidth = 1000) {
  if (model.loaded && model.periodUnavailable) return { rows:[], html:'<div class="overview-empty"><strong>Недостаточно данных о датах</strong><p>Заказы без даты не включены в период. Выберите «Все данные», чтобы посмотреть их суммы.</p></div>' };
  const dated = mode === 'days' && model.dated;
  const rows = dated ? model.days : model.moneyOrders.map((order, index) => ({ label: order.id, amount: order.amount, count: 1, index: index + 1 }));
  if (!model.loaded || !rows.length || model.totalMinor == null) return { rows: [], html: `<div class="overview-empty"><span class="overview-icon overview-icon--amber"><svg><use href="#i-chart"/></svg></span><strong>${!model.loaded ? 'Начните с подключения магазина' : model.totalMinor == null ? 'Недостаточно данных о суммах' : 'Продаж пока нет'}</strong><p>${!model.loaded ? 'После синхронизации здесь появятся ваши продажи.' : 'Нужны заказы с суммой, валютой и статусом оплаты.'}</p></div>` };
  const width = Math.max(260, Math.min(1000, availableWidth)), height = width < 500 ? 210 : 254, left = width < 500 ? 54 : 78, right = 20, top = 20, bottom = 38;
  const plotWidth = width - left - right, base = height - bottom, plotHeight = base - top;
  const max = Math.max(...rows.map(row => row.amount), 100);
  const y = amount => base - amount / max * plotHeight;
  const axisValue = value => new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value / 100);
  const labelCount = Math.min(rows.length, width < 600 ? 4 : 6);
  const labels = new Set(Array.from({ length: labelCount }, (_, index) => Math.round(index * (rows.length - 1) / Math.max(labelCount - 1, 1))));
  const dateSpan = dated && rows.length > 1 ? Date.parse(rows.at(-1).label) - Date.parse(rows[0].label) : 0;
  const x = index => dateSpan ? left + (Date.parse(rows[index].label) - Date.parse(rows[0].label)) * plotWidth / dateSpan : left + (index + .5) * plotWidth / rows.length;
  const grid = [0, .5, 1].map(ratio => `<line x1="${left}" x2="${width - right}" y1="${y(max * ratio)}" y2="${y(max * ratio)}" class="overview-chart-grid"/><text x="${left - 14}" y="${y(max * ratio) + 4}" text-anchor="end">${axisValue(max * ratio)}</text>`).join('');
  const dates = [...labels].map(index => `<text x="${x(index)}" y="${height - 10}" text-anchor="middle">${dated ? overviewEscape(rows[index].label.slice(8) + '.' + rows[index].label.slice(5, 7)) : rows[index].index}</text>`).join('');
  const describe = row => `${dated ? row.label : row.label}: ${overviewMoney(row.amount, model.currency)}${dated ? ` · заказов: ${row.count}` : ''}`;
  let plot;
  if (dated) {
    const consecutive = (row, index) => index > 0 && Date.parse(row.label) - Date.parse(rows[index - 1].label) === 86400000;
    const path = rows.map((row, index) => `${consecutive(row, index) ? 'L' : 'M'}${x(index)},${y(row.amount)}`).join(' ');
    const area = `${path} L${x(rows.length - 1)},${base} L${x(0)},${base} Z`;
    plot = `${rows.every((row, index) => !index || consecutive(row, index)) ? `<path d="${area}" class="overview-chart-area"/>` : ''}<path d="${path}" class="overview-chart-line"/>` + rows.map((row, index) => `<circle cx="${x(index)}" cy="${y(row.amount)}" r="3.5" class="overview-chart-dot"><title>${overviewEscape(describe(row))}</title></circle>`).join('');
  } else {
    const barWidth = Math.min(34, plotWidth / rows.length * .58);
    plot = rows.map((row, index) => `<rect x="${x(index) - barWidth / 2}" y="${y(row.amount)}" width="${barWidth}" height="${Math.max(base - y(row.amount), 0)}" rx="${Math.min(4, barWidth / 3)}" class="overview-chart-bar"><title>${overviewEscape(describe(row))}</title></rect>`).join('');
  }
  return { rows, html: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${dated ? 'Суммы продаж по датам заказов, МСК' : 'Суммы продаж по заказам в порядке списка FunPay'}; ${overviewEscape(model.currency)}. Точные значения доступны под графиком.">${grid}${plot}${dates}</svg>` };
}

function renderOverview() {
  if (typeof state === 'undefined' || typeof selectedStore !== 'function') return;
  const root = document.querySelector('[data-overview]');
  if (!root) return;
  if (overviewState.snapshot !== state.storeContent) {
    overviewState.snapshot = state.storeContent;
    overviewState.error = '';
  }
  if (typeof renderStoreIdentity === 'function') renderStoreIdentity();
  const model = buildOverview(state.storeContent, overviewState.currency, { period:overviewState.period });
  const measurable = model.loaded && !model.periodUnavailable;
  root.querySelectorAll('[data-overview-period]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.overviewPeriod === model.range.key)));
  const periodLabel = root.querySelector('[data-overview-period-label]');
  if (periodLabel) periodLabel.textContent = model.range.label;
  const coverage = root.querySelector('[data-overview-period-note]');
  if (coverage) coverage.textContent = model.loaded ? `${model.range.key === 'all' ? 'Все загруженные заказы.' : 'Заказы выбраны по дате создания, по московскому времени.'} ${model.undatedOrders && model.range.key !== 'all' ? `Заказов без достоверной даты: ${model.undatedOrders}. Они не включены в период. ` : ''}Расчёт по загруженным данным FunPay; полная история может быть недоступна.` : 'Данные появятся после синхронизации магазина.';
  overviewState.currency = model.currency;
  if (!model.dated) overviewState.mode = 'orders';
  const setText = (name, value) => { const node = root.querySelector(`[data-overview-${name}]`); if (node) node.textContent = value; };
  const connected = selectedStore()?.status === 'connected_read_only';
  const connect = root.querySelector('[data-overview-connect]');
  const refresh = root.querySelector('[data-overview-refresh]');
  if (connect) connect.hidden = connected;
  if (refresh) { refresh.hidden = !connected; refresh.disabled = overviewState.busy; refresh.setAttribute('aria-busy', String(overviewState.busy)); }
  root.setAttribute('aria-busy', String(overviewState.busy));
  setText('refresh-label', overviewState.busy ? 'Обновляем…' : 'Обновить данные');
  setText('source', connected ? 'FunPay подключён · read-only' : 'Магазин не подключён');
  root.querySelector('[data-overview-source]')?.classList.toggle('is-connected', connected);
  setText('updated', model.loaded ? `Снимок от ${new Date(model.observedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Ожидает синхронизации');
  setText('plan', authState.workspace?.plan?.active ? `Тариф: ${authState.workspace.plan.id || 'активен'}` : 'Тариф не активен');
  const notice = root.querySelector('[data-overview-notice]');
  const noticeText = overviewState.error || (model.loaded && !connected ? 'Подключение требует проверки. Ниже сохранён последний загруженный снимок.' : connected && !model.loaded ? 'Магазин подключён. Нажмите «Обновить данные», чтобы загрузить показатели.' : '');
  if (notice) { notice.hidden = !noticeText; notice.textContent = noticeText; }
  setText('sales', model.loaded ? overviewMoney(model.totalMinor, model.currency) : '—');
  setText('orders', measurable ? String(model.count) : '—');
  setText('average', model.loaded ? overviewMoney(model.averageMinor, model.currency) : '—');
  setText('dialogs', model.loaded && model.dialogs != null ? String(model.dialogs) : '—');
  setText('dialogs-note', model.range.key === 'all' ? 'В синхронизированных сообщениях' : model.dialogs == null ? 'Нет достоверных дат сообщений' : `Диалоги с сообщениями за период${model.undatedMessages ? ' · часть сообщений без дат' : ''}`);
  setText('sales-note', model.loaded ? `${model.moneyOrders.length} заказов · ${model.currency} · до комиссий` : 'После синхронизации магазина');
  setText('orders-note', measurable ? `${model.salesCount} с оплатой · ${model.refundedCount} возвратов` : model.periodUnavailable ? 'Нет достоверных дат для периода' : 'В текущем снимке FunPay');
  setText('average-note', model.loaded ? `По ${model.moneyOrders.length} заказам · без возвратов` : 'Без возвращённых заказов');
  const currency = root.querySelector('[data-overview-currency]');
  if (currency) {
    currency.innerHTML = model.currencies.map(code => `<option value="${code}">${code}</option>`).join('');
    currency.value = model.currency;
  }
  const currencyLabel = root.querySelector('[data-overview-currency-label]');
  if (currencyLabel) currencyLabel.hidden = model.currencies.length < 2;
  root.querySelectorAll('[data-overview-mode]').forEach(button => {
    const days = button.dataset.overviewMode === 'days';
    button.disabled = days && !model.dated;
    button.title = days && !model.dated ? 'В снимке нет дат всех заказов с суммой в выбранной валюте' : '';
    button.setAttribute('aria-pressed', String(button.dataset.overviewMode === overviewState.mode));
  });
  const chartNode = root.querySelector('[data-overview-chart]');
  if (chartNode?.clientWidth) overviewState.chartWidth = chartNode.clientWidth;
  if (chartNode && !overviewState.observer && typeof ResizeObserver === 'function') {
    overviewState.observer = new ResizeObserver(entries => {
      const width = Math.round(entries[0]?.contentRect.width || 0);
      if (width > 0 && width !== Math.round(overviewState.chartWidth)) { overviewState.chartWidth = width; renderOverview(); }
    });
    overviewState.observer.observe(chartNode);
  }
  const chart = overviewChartMarkup(model, overviewState.mode, overviewState.chartWidth);
  if (chartNode) chartNode.innerHTML = chart.html;
  setText('chart-subtitle', overviewState.mode === 'days' ? `Суммы по датам заказов · ${model.currency} · МСК` : `Суммы заказов · ${model.currency} · без возвратов`);
  const partial = model.salesCount - model.moneyOrders.length;
  const note = overviewState.mode === 'days' ? 'Только дни с заказами в снимке. Дата заказа может отличаться от даты оплаты.' : 'Порядок списка FunPay, без временной шкалы.';
  setText('chart-note', model.loaded ? `${note}${partial ? ` Ещё ${partial} заказов: другая валюта или нет суммы.` : ''}` : 'График появится после синхронизации.');
  const chartData = root.querySelector('[data-overview-chart-data]');
  if (chartData) chartData.hidden = !chart.rows.length;
  const table = root.querySelector('[data-overview-chart-table]');
  if (table) table.innerHTML = chart.rows.length ? `<table><caption>Продажи из снимка · ${overviewEscape(model.currency)}</caption><thead><tr><th scope="col">${overviewState.mode === 'days' ? 'Дата (МСК)' : 'Заказ'}</th><th scope="col">Сумма до комиссий</th></tr></thead><tbody>${chart.rows.map(row => `<tr><td>${overviewEscape(row.label)}</td><td>${overviewEscape(overviewMoney(row.amount, model.currency))}</td></tr>`).join('')}</tbody></table>` : '';
  setText('refund-rate', measurable ? overviewPercent(model.refundRate) : '—');
  setText('refund-count', measurable ? `${model.refundedCount} из ${model.count} заказов` : 'Нет данных');
  setText('refund-amount', model.loaded ? overviewMoney(model.refundMinor, model.currency) : '—');
  setText('refund-currency', model.currency);
  setText('refund-note', model.loaded ? model.unknownCount ? `У ${model.unknownCount} заказов нет известного статуса — доля возвратов не рассчитана.` : `Учтены статусы заказов. Сумма: ${model.moneyRefundCount} возвратов в ${model.currency}.` : 'Статусы появятся после синхронизации.');
  const track = root.querySelector('[data-overview-refund-track]');
  if (track) track.innerHTML = model.loaded && model.refundRate != null ? `<i style="width:${model.refundRate}%"></i>` : '';
  const donut = root.querySelector('[data-overview-donut]');
  const circumference = 2 * Math.PI * 62;
  let offset = 0;
  if (donut) donut.innerHTML = '<circle cx="80" cy="80" r="62" class="overview-donut-track"/>' + (model.loaded ? model.statuses : []).map(item => {
    const size = item.count / model.count * circumference;
    const element = `<circle cx="80" cy="80" r="62" stroke="${item.color}" stroke-dasharray="${Math.max(0, size - Math.min(4, size / 3))} ${circumference}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"><title>${item.label}: ${item.count}</title></circle>`;
    offset += size;
    return element;
  }).join('');
  setText('donut-total', measurable ? String(model.count) : '—');
  const legend = root.querySelector('[data-overview-legend]');
  if (legend) legend.innerHTML = model.loaded && model.statuses.length ? model.statuses.map(item => `<div><span><i style="background:${item.color}"></i>${item.label}</span><b>${item.count}</b><small>${overviewPercent(item.count / model.count * 100)}</small></div>`).join('') : '<p class="overview-footnote">Нет синхронизированных заказов</p>';
  const orders = root.querySelector('#dash-orders-list');
  if (orders) orders.innerHTML = model.loaded && model.orders.length ? model.orders.slice(0, 4).map(order => {
    const status = OVERVIEW_STATUSES[order.status];
    const date = order.date != null ? new Date(order.date).toLocaleString('ru-RU', { timeZone:'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Дата не передана';
    return `<article><span class="dash-list__icon"><svg><use href="#i-bag"/></svg></span><div><strong>${overviewEscape(order.id)} · ${overviewEscape(order.product)}</strong><small>${overviewEscape(order.buyer)} · ${date}</small></div><span class="table-status" style="color:${status.color}">${status.label}</span><b>${overviewEscape(overviewMoney(order.amount, order.currency))}</b></article>`;
  }).join('') : `<div class="content-empty">${model.loaded ? model.periodUnavailable ? 'Заказы без даты доступны в режиме «Все данные».' : 'В загруженных данных нет заказов за этот период.' : 'Заказы появятся после синхронизации магазина.'}</div>`;
}

async function refreshOverview() {
  if (overviewState.busy) return;
  const generation = sessionGeneration;
  overviewState.busy = true;
  overviewState.error = '';
  renderOverview();
  try { await syncStoreContent({ silent: true }); }
  catch (error) {
    if (generation === sessionGeneration) overviewState.error = `${humanError(error)}${state.storeContent.observedAt ? ' Показан предыдущий снимок.' : ''}`;
  } finally {
    overviewState.busy = false;
    renderOverview();
  }
}

document.addEventListener('click', event => {
  if (typeof state === 'undefined') return;
  if (event.target.closest('[data-overview-refresh]')) { refreshOverview(); return; }
  const period = event.target.closest('[data-overview-period]');
  if (period && Object.hasOwn(OVERVIEW_PERIODS, period.dataset.overviewPeriod)) { overviewState.period = period.dataset.overviewPeriod; overviewState.mode = 'days'; renderOverview(); return; }
  const mode = event.target.closest('[data-overview-mode]');
  if (mode && !mode.disabled && ['orders', 'days'].includes(mode.dataset.overviewMode)) { overviewState.mode = mode.dataset.overviewMode; renderOverview(); }
});
document.addEventListener('change', event => {
  if (typeof state === 'undefined') return;
  if (event.target.matches('[data-overview-currency]')) { overviewState.currency = event.target.value; renderOverview(); }
});
