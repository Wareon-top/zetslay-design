import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const scripts = ['overview.js', 'orders.js', 'app.js'].map(name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8').replace(/^init\(\);[ \t]*$/m, '')).join('\n');
const at = '2026-10-03T12:00:00Z';
const row = (id, status = 'completed', amount = 1000, currency = 'RUB', createdAt) => ({ id, status, totalMinor: amount, currency, createdAt, product: `Товар ${id}`, buyer: `buyer_${id}` });

function workspace() {
  const listeners = new Map();
  const windowListeners = new Map();
  const nodes = new Map();
  const listen = (map, type, callback) => map.set(type, [...(map.get(type) || []), callback]);
  const node = name => {
    if (!nodes.has(name)) nodes.set(name, { textContent: '', innerHTML: '', value: '', hidden: false, disabled: false, attributes: {}, dataset: {}, closest: () => null, classList: { toggle() {} }, setAttribute(key, value) { this.attributes[key] = value; }, querySelectorAll: () => [] });
    return nodes.get(name);
  };
  const filters = ['all', 'active', 'completed', 'refunded'].map(value => { const n = node(`filter-${value}`); n.dataset.ordersFilter = value; return n; });
  const periods = ['all','today','yesterday','last7','last30','week','month','custom','undated'].map(value=>{const n=node('period-'+value);n.dataset.ordersPeriod=value;return n;});
  const counts = filters.map(button => { const n = node(`count-${button.dataset.ordersFilter}`); n.dataset.ordersFilterCount = button.dataset.ordersFilter; return n; });
  const pages = ['prev', 'next'].map(value => { const n = node(`page-${value}`); n.dataset.ordersPage = value; return n; });
  const options = ['source', 'newest', 'oldest', 'amount-asc', 'amount-desc'].map(value => ({ value, disabled: false }));
  node('[data-orders-sort]').querySelectorAll = () => options;
  const root = {
    setAttribute() {}, querySelector: node,
    querySelectorAll(selector) {
      return { '[data-orders-period]':periods, '[data-orders-filter]': filters, '[data-orders-filter-count]': counts, '[data-orders-page]': pages, '[data-orders-reset-filters]': [node('[data-orders-reset-filters]')] }[selector] || [];
    }
  };
  const closeListeners = [];
  const dialog = {
    open: false, opens: 0, querySelector: node,
    showModal() { this.open = true; this.opens++; },
    close() { this.open = false; closeListeners.forEach(callback => callback()); },
    addEventListener(type, callback) { if (type === 'close') closeListeners.push(callback); }
  };
  const document = {
    querySelector(selector) {
      if (selector === '[data-orders-workspace]') return root;
      if (selector === '[data-order-dialog]') return dialog;
      if (selector === 'meta[name="zetslay-api-base-url"]') return { content: 'https://api.zetslay.pro' };
      return null;
    },
    querySelectorAll: () => [], getElementById: id => id === 'orders-table-body' ? node('#orders-table-body') : null,
    addEventListener: (type, callback) => listen(listeners, type, callback)
  };
  const context = vm.createContext({ document, AbortController, setTimeout, clearTimeout, URL, URLSearchParams, location: { hostname: 'zetslay.pro', hash: '#orders', search: '' },
    sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, removeItem() {} },
    window: { addEventListener: (type, callback) => listen(windowListeners, type, callback) } });
  vm.runInContext(scripts, context);
  const run = code => vm.runInContext(code, context);
  const model = (orders, filters = {}, observedAt = at) => { context.input = { observedAt, orders }; context.inputFilters = filters; return JSON.parse(JSON.stringify(run('buildOrdersWorkspace(input, inputFilters)'))); };
  const render = (orders = [], { observedAt = at, connected = true } = {}) => {
    context.input = { observedAt, orders, messages: [], lots: [] };
    context.connected = connected;
    run("state.storeContent=input; authState.user={}; state.storeFleet={stores:[{id:'store',status:connected?'connected_read_only':'attention'}],selectedStoreId:'store'}; renderOrderWorkspace();");
  };
  const event = (type, selector, { value = '', dataset = {}, disabled = false } = {}) => {
    const target = { value, dataset, disabled, matches: s => s === selector, closest: s => s === selector ? target : s === '[data-orders-workspace]' ? root : null };
    for (const callback of listeners.get(type) || []) callback({ target });
  };
  const stubContentRenderers = () => { for (const name of ['renderStoreFleet', 'renderAnalytics', 'renderConversations', 'renderLots']) context[name] = () => {}; };
  return { run, context, node, options, counts, pages, filters, dialog, model, render, event, windowListeners, stubContentRenderers };
}

test('orders totals use canonical statuses and never count refunds or unknowns as work', () => {
  const app = workspace();
  const orders = ['paid', 'processing', 'delivered', 'completed', 'refunded', 'cancelled', 'surprise'].map((status, index) => row(String(index), status));
  const model = app.model(orders);
  assert.deepEqual(model.totals, { all: 7, active: 3, completed: 1, refunded: 1 });
  assert.equal(app.model(orders, { status: 'active' }).filtered.length, 3);
  app.render(orders);
  assert.equal(app.node('[data-orders-active]').textContent, '3');
  assert.equal(app.node('[data-orders-refunded]').textContent, '1');
  assert.match(app.node('#orders-table-body').innerHTML, /Возвращён/);
  assert.doesNotMatch(app.node('#orders-table-body').innerHTML, /Спор/);
});

test('orders distinguishes unavailable data, a loaded empty shop and no filter matches', () => {
  const app = workspace();
  app.render([], { observedAt: null, connected: false });
  assert.equal(app.node('[data-orders-total]').textContent, '—');
  assert.match(app.node('#orders-table-body').innerHTML, /Подключите ваш магазин/);
  assert.equal(app.node('[data-orders-refresh]').disabled, true);
  app.render([]);
  assert.equal(app.node('[data-orders-total]').textContent, '0');
  assert.match(app.node('#orders-table-body').innerHTML, /В снимке пока нет заказов/);
  app.render([row('a')]);
  app.event('input', '[data-orders-search]', { value: 'нет совпадений' });
  assert.match(app.node('#orders-table-body').innerHTML, /Ничего не найдено/);
  assert.match(app.node('#orders-table-body').innerHTML, /data-orders-reset-filters/);
});

test('orders search matches number, Cyrillic product and buyer without mutating source order', () => {
  const app = workspace();
  const rows = [{ ...row('A123', 'paid'), product: 'Золотая подписка', buyer: 'PlayerOne' }, row('b', 'refunded')];
  const original = JSON.stringify(rows);
  assert.equal(app.model(rows, { query: '#a123' }).filtered.length, 1);
  assert.equal(app.model(rows, { query: '  ЗОЛОТАЯ  ' }).filtered.length, 1);
  assert.equal(app.model(rows, { query: 'playerone', status: 'refunded' }).filtered.length, 0);
  assert.equal(app.model(rows, { query: 'playerone', currency: 'USD' }).filtered.length, 1);
  assert.equal(JSON.stringify(rows), original);
});

test('orders search and currency filters update tab counts while KPI totals stay scoped to the snapshot', () => {
  const app = workspace();
  app.render([row('a', 'paid'), row('b', 'completed'), row('c', 'refunded', 1000, 'USD')]);
  app.event('change', '[data-orders-currency]', { value: 'USD' });
  assert.equal(app.node('[data-orders-total]').textContent, '3');
  assert.equal(app.node('count-all').textContent, '1');
  assert.equal(app.node('count-refunded').textContent, '1');
  app.event('click', '[data-orders-filter]', { dataset: { ordersFilter: 'refunded' } });
  assert.match(app.node('#orders-table-body').innerHTML, /buyer_c/);
  assert.doesNotMatch(app.node('#orders-table-body').innerHTML, /buyer_a/);
  assert.equal(app.node('[data-orders-reset-filters]').hidden, false);
  app.event('click', '[data-orders-reset-filters]');
  assert.equal(app.run('ordersPageState.currency'), 'all');
  assert.equal(app.node('count-all').textContent, '3');
});

test('orders sorting refuses cross-currency price comparisons and places unknown amounts last', () => {
  const app = workspace();
  const rows = [row('rub-low', 'paid', 100, 'RUB'), row('usd', 'paid', 5000, 'USD'), row('missing', 'paid', null, 'RUB'), row('rub-high', 'paid', 900, 'RUB')];
  const mixed = app.model(rows, { sort: 'amount-desc' });
  assert.equal(mixed.sort, 'newest');
  assert.equal(mixed.canSortAmount, false);
  assert.deepEqual(app.model(rows, { sort: 'amount-desc', currency: 'RUB' }).filtered.map(order => order.id), ['rub-high', 'rub-low', 'missing']);
  assert.deepEqual(app.model(rows, { sort: 'amount-asc', currency: 'RUB' }).filtered.map(order => order.id), ['rub-low', 'rub-high', 'missing']);
  app.render(rows);
  assert.equal(app.options.find(option => option.value === 'amount-desc').disabled, true);
  assert.match(app.node('[data-orders-filter-hint]').textContent, /выберите одну валюту/);
});

test('orders date sorting uses actual timestamps and never substitutes sync time', () => {
  const app = workspace();
  const rows = [row('missing'), row('old', 'paid', 100, 'RUB', '2026-10-01T10:00:00Z'), row('new', 'paid', 100, 'RUB', '2026-10-02T10:00:00Z')];
  assert.deepEqual(app.model(rows, { sort: 'newest' }).filtered.map(order => order.id), ['new', 'old', 'missing']);
  assert.deepEqual(app.model(rows, { sort: 'oldest' }).filtered.map(order => order.id), ['old', 'new', 'missing']);
  assert.equal(app.model([row('a')], { sort: 'newest' }).sort, 'newest');
  app.render([row('a')]);
  assert.equal(app.options.find(option => option.value === 'newest').disabled, false);
  assert.match(app.node('#orders-table-body').innerHTML, /Не передана/);
  assert.doesNotMatch(app.node('#orders-table-body').innerHTML, /datetime=/);
});

test('orders pagination clamps invalid or stale pages and keeps all records reachable', () => {
  const app = workspace();
  const rows = Array.from({ length: 23 }, (_, index) => row(String(index)));
  assert.equal(app.model(rows, { page: 3 }).rows.length, 3);
  assert.equal(app.model(rows, { page: 99 }).page, 3);
  assert.equal(app.model(rows, { page: -1, size: 'bad' }).rows.length, 10);
  assert.equal(app.model(rows, { size: '20' }).rows.length, 20);
  app.render(rows);
  app.event('click', '[data-orders-page]', { dataset: { ordersPage: 'next' } });
  assert.equal(app.node('[data-orders-page-label]').textContent, '2 / 3');
  app.event('input', '[data-orders-search]', { value: 'buyer_22' });
  assert.equal(app.node('[data-orders-page-label]').textContent, '1 / 1');
  assert.equal(app.pages[1].disabled, true);
});

test('orders table and detail dialog escape all untrusted IDs, products and buyers', () => {
  const app = workspace();
  const id = '\" autofocus onfocus=attack <img>';
  app.render([{ ...row(id), product: '<script>attack</script>', buyer: '<svg onload=attack>' }]);
  const html = app.node('#orders-table-body').innerHTML;
  assert.doesNotMatch(html, /<img>|<script>|<svg onload/);
  assert.match(html, /&quot; autofocus/);
  app.event('click', '[data-order-open]', { dataset: { orderOpen: id } });
  assert.equal(app.dialog.open, true);
  assert.match(app.node('[data-order-detail-body]').innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(app.node('[data-order-detail-body]').innerHTML, /<script>/);
  app.event('click', '[data-order-close]');
  assert.equal(app.dialog.open, false);
  assert.equal(app.node('[data-order-detail-body]').innerHTML, '');
});

test('orders native dialog refuses unknown rows and clears disappeared records after sync', () => {
  const app = workspace();
  app.render([row('a')]);
  app.event('click', '[data-order-open]', { dataset: { orderOpen: 'unknown' } });
  assert.equal(app.dialog.opens, 0);
  app.event('click', '[data-order-open]', { dataset: { orderOpen: 'a' } });
  assert.equal(app.dialog.opens, 1);
  app.render([row('b')]);
  assert.equal(app.dialog.open, false);
  assert.equal(app.run('ordersPageState.detailId'), null);
});

test('orders resets filters and clears the order dialog immediately after an account change', () => {
  const app = workspace();
  app.render([row('private')]);
  app.event('input', '[data-orders-search]', { value: 'private' });
  app.event('click', '[data-order-open]', { dataset: { orderOpen: 'private' } });
  app.run('sessionGeneration++');
  app.render([], { observedAt: null, connected: false });
  assert.equal(app.node('[data-orders-search]').value, '');
  assert.equal(app.dialog.open, false);
  assert.doesNotMatch(app.node('#orders-table-body').innerHTML, /buyer_private/);
  assert.equal(app.node('[data-orders-total]').textContent, '—');
});

test('orders refresh suppresses duplicate clicks and preserves the snapshot on failure', async () => {
  const app = workspace();
  app.render([row('old')]);
  let reject;
  let calls = 0;
  app.context.syncStoreContent = () => { calls++; return new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }); };
  const pending = app.run('refreshOrderWorkspace()');
  await app.run('refreshOrderWorkspace()');
  assert.equal(calls, 1);
  assert.equal(app.node('[data-orders-refresh]').disabled, true);
  reject(new Error('Сбой соединения'));
  await pending;
  assert.match(app.node('[data-orders-notice]').textContent, /Сбой соединения.*предыдущий снимок/);
  assert.match(app.node('#orders-table-body').innerHTML, /buyer_old/);
  assert.equal(app.node('[data-orders-refresh]').disabled, false);
});

test('orders ignores a late refresh error after switching accounts', async () => {
  const app = workspace();
  app.render([row('old')]);
  let reject;
  app.context.syncStoreContent = () => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; });
  const pending = app.run('refreshOrderWorkspace()');
  app.run('sessionGeneration++');
  app.render([], { observedAt: null, connected: false });
  reject(new Error('private previous account error'));
  await pending;
  assert.doesNotMatch(app.node('[data-orders-notice]').textContent, /private previous/);
  assert.equal(app.node('[data-orders-total]').textContent, '—');
});

test('orders update calls only the existing authenticated read-only content API', async () => {
  const app = workspace();
  app.render([]);
  app.stubContentRenderers();
  const calls = [];
  app.context.apiRequest = async (path, options) => {
    calls.push(path);
    assert.equal(path, '/api/v1/funpay/content');
    assert.equal(options.authenticated, true);
    assert.equal(options.method, undefined);
    return { observedAt: at, orders: [row('new')], messages: [], lots: [] };
  };
  await app.run('refreshOrderWorkspace()');
  assert.deepEqual(calls, ['/api/v1/funpay/content']);
  assert.match(app.node('#orders-table-body').innerHTML, /buyer_new/);
  assert.equal(app.node('[data-orders-total]').textContent, '1');
});

test('cabinet views share one content read request and render the newest response together', async () => {
  const app = workspace();
  app.render([]);
  app.stubContentRenderers();
  let resolve;
  let calls = 0;
  app.context.apiRequest = () => { calls++; return new Promise(resolvePromise => { resolve = resolvePromise; }); };
  const first = app.run('syncStoreContent({silent:true})');
  const second = app.run('syncStoreContent({silent:true})');
  assert.equal(first, second);
  assert.equal(calls, 1);
  resolve({ observedAt: at, orders: [row('shared')], messages: [], lots: [] });
  await Promise.all([first, second]);
  assert.match(app.node('#orders-table-body').innerHTML, /buyer_shared/);
  assert.equal(app.run('storeContentSyncFlight'), null);
});

test('failed shared read releases its request and permits a retry', async () => {
  const app = workspace();
  app.render([]);
  app.stubContentRenderers();
  app.context.apiRequest = async () => { throw new Error('offline'); };
  await assert.rejects(app.run('syncStoreContent({silent:true})'), /offline/);
  assert.equal(app.run('storeContentSyncFlight'), null);
  app.context.apiRequest = async () => ({ observedAt: at, orders: [row('retry')], messages: [], lots: [] });
  await app.run('syncStoreContent({silent:true})');
  assert.match(app.node('#orders-table-body').innerHTML, /buyer_retry/);
});

test('an old account request cannot block a new account sync or replace its rows', async () => {
  const app = workspace();
  app.render([]);
  app.stubContentRenderers();
  const resolves = [];
  app.context.apiRequest = () => new Promise(resolve => resolves.push(resolve));
  const old = app.run('syncStoreContent({silent:true})');
  app.run('sessionGeneration++');
  app.render([]);
  const current = app.run('syncStoreContent({silent:true})');
  assert.equal(resolves.length, 2);
  resolves[0]({ observedAt: at, orders: [row('old-account')], messages: [], lots: [] });
  await old;
  assert.notEqual(app.run('storeContentSyncFlight'), null);
  resolves[1]({ observedAt: at, orders: [row('current-account')], messages: [], lots: [] });
  await current;
  assert.doesNotMatch(app.node('#orders-table-body').innerHTML, /old-account/);
  assert.match(app.node('#orders-table-body').innerHTML, /current-account/);
});

test('orders retain the FunPay date label when a complete timestamp is unavailable and escape it',()=>{
 const app=workspace();
 const html=app.run(`orderDateMarkup(null,'4 октября, 12:00 <img src=x>')`);
 assert.match(html,/4 октября, 12:00/);assert.match(html,/&lt;img/);assert.ok(!html.includes('<img'));
 const model=app.run(`buildOrdersWorkspace({observedAt:'2026-10-04T12:00:00Z',orders:[{id:'A',sourceDateLabel:'4 октября, 12:00',status:'paid'}]})`);
 assert.equal(model.rows[0].sourceDateLabel,'4 октября, 12:00');assert.equal(model.rows[0].date,null);
});

const octoberNow=Date.parse('2026-10-15T12:00:00Z'),octoberSnapshot='2026-10-15T12:30:00Z';
test('default order chronology puts October ahead of July, undated last and equal instants in stable order',()=>{
 const app=workspace(),rows=[{...row('JULY','paid',1,'RUB','2026-07-18T10:00:00Z'),statusObservedAt:octoberSnapshot},row('UNKNOWN'),row('B','paid',1,'RUB','2026-10-15T13:00:00+03:00'),row('A','paid',1,'RUB','2026-10-15T10:00:00Z')],before=JSON.stringify(rows);
 assert.deepEqual(app.model(rows,{},octoberSnapshot).filtered.map(x=>x.id),['A','B','JULY','UNKNOWN']);
 assert.equal(JSON.stringify(rows),before);
});
test('today and yesterday use Moscow midnight with exact non-overlapping boundaries',()=>{
 const app=workspace(),rows=[row('BEFORE','paid',1,'RUB','2026-10-14T20:59:59.999Z'),row('MIDNIGHT','completed',1,'RUB','2026-10-14T21:00:00Z'),row('TODAY','refunded',1,'RUB','2026-10-15T10:00:00Z'),row('UNKNOWN')];
 assert.deepEqual(app.model(rows,{period:'today',now:octoberNow},octoberSnapshot).filtered.map(x=>x.id),['TODAY','MIDNIGHT']);
 assert.deepEqual(app.model(rows,{period:'yesterday',now:octoberNow},octoberSnapshot).filtered.map(x=>x.id),['BEFORE']);
 assert.equal(app.model(rows,{period:'undated'},octoberSnapshot).filtered[0].id,'UNKNOWN');
});
test('7 and 30 day periods include today and the correct calendar start day',()=>{
 const app=workspace(),rows=[row('OCT8','paid',1,'RUB','2026-10-08T20:59:59Z'),row('OCT9','paid',1,'RUB','2026-10-08T21:00:00Z'),row('SEP15','paid',1,'RUB','2026-09-15T20:59:59Z'),row('SEP16','paid',1,'RUB','2026-09-15T21:00:00Z')];
 assert.deepEqual(app.model(rows,{period:'last7',now:octoberNow},octoberSnapshot).filtered.map(x=>x.id),['OCT9']);
 assert.deepEqual(app.model(rows,{period:'last30',now:octoberNow},octoberSnapshot).filtered.map(x=>x.id),['OCT9','OCT8','SEP16']);
});
test('calendar week starts Monday and month handles year transitions',()=>{
 const app=workspace();
 app.context.dateFilters={period:'week'};app.context.nowMs=octoberNow;
 assert.equal(app.run('new Date(orderPeriodRange(dateFilters,nowMs).start).toISOString()'),'2026-10-11T21:00:00.000Z');
 app.context.nowMs=Date.parse('2027-01-01T00:00:00Z');app.context.dateFilters={period:'month'};
 assert.equal(app.run('new Date(orderPeriodRange(dateFilters,nowMs).start).toISOString()'),'2026-12-31T21:00:00.000Z');
 app.context.dateFilters={period:'week'};
 assert.equal(app.run('new Date(orderPeriodRange(dateFilters,nowMs).start).toISOString()'),'2026-12-27T21:00:00.000Z');
});
test('custom dates include the final Moscow day and reject incomplete, reversed or impossible dates',()=>{
 const app=workspace(),rows=[row('START','paid',1,'RUB','2026-10-08T21:00:00Z'),row('END','paid',1,'RUB','2026-10-10T20:59:59.999Z'),row('AFTER','paid',1,'RUB','2026-10-10T21:00:00Z')];
 assert.deepEqual(app.model(rows,{period:'custom',from:'2026-10-09',to:'2026-10-10'},octoberSnapshot).filtered.map(x=>x.id),['END','START']);
 for(const [from,to] of [['','2026-10-10'],['2026-10-11','2026-10-10'],['2026-02-30','2026-10-10'],['bad','bad']]){
  const model=app.model(rows,{period:'custom',from,to},octoberSnapshot);assert.ok(model.range.error);assert.equal(model.filtered.length,0);
 }
 assert.equal(app.run("orderCalendarDate('2024-02-29')"),Date.parse('2024-02-28T21:00:00Z'));
 assert.equal(app.run("orderCalendarDate('2025-02-29')"),null);
});
test('period totals and status counts use the same selected period while preserving search and currency semantics',()=>{
 const app=workspace(),rows=[row('TODAY','paid',1,'RUB','2026-10-15T10:00:00Z'),row('REFUND','refunded',1,'USD','2026-10-15T09:00:00Z'),row('OLD','completed',1,'RUB','2026-07-01T09:00:00Z'),row('UNKNOWN')];
 const model=app.model(rows,{period:'today',now:octoberNow,currency:'USD',status:'refunded'},octoberSnapshot);
 assert.deepEqual(model.totals,{all:2,active:1,completed:0,refunded:1});assert.equal(model.counts.all,1);assert.equal(model.counts.refunded,1);assert.equal(model.rows[0].id,'REFUND');
 assert.equal(model.unknownDates,1);
});
test('period and native calendar controls update immediately, reset pagination and make no requests',()=>{
 const app=workspace();app.run('Date.now=()=>'+octoberNow);
 app.render([row('TODAY','paid',1,'RUB','2026-10-15T09:00:00Z'),row('OLD','paid',1,'RUB','2026-07-01T09:00:00Z'),row('UNKNOWN')],{observedAt:octoberSnapshot});
 app.context.apiRequest=()=>{throw Error('Filters must remain local');};
 app.run('ordersPageState.page=8');
 app.event('click','[data-orders-period]',{dataset:{ordersPeriod:'today'}});
 assert.equal(app.node('period-today').attributes['aria-pressed'],'true');
 assert.equal(app.node('[data-orders-total]').textContent,'1');assert.equal(app.run('ordersPageState.page'),1);
 assert.match(app.node('[data-orders-filter-hint]').textContent,/Без точной даты/);
 app.event('click','[data-orders-period]',{dataset:{ordersPeriod:'custom'}});
 assert.equal(app.node('[data-orders-date-range]').hidden,false);
 app.event('change','[data-orders-from]',{value:'2026-07-01'});
 app.event('change','[data-orders-to]',{value:'2026-07-01'});
 assert.equal(app.node('[data-orders-total]').textContent,'1');
 assert.match(app.node('#orders-table-body').innerHTML,/buyer_OLD/);
 assert.doesNotMatch(app.node('#orders-table-body').innerHTML,/buyer_TODAY/);
 app.event('click','[data-orders-reset-filters]');
 assert.equal(app.run('ordersPageState.period'),'all');assert.equal(app.run('ordersPageState.sort'),'newest');assert.equal(app.node('[data-orders-total]').textContent,'3');assert.equal(app.node('[data-orders-date-range]').hidden,true);
});
test('archive coverage and loaded-part limits are visible rather than claiming complete history',()=>{
 const app=workspace();
 app.render([row('A')]);
 app.context.archiveMeta={total:6000,returned:1,truncated:true,complete:false};
 app.run('state.storeContent.orderArchive=archiveMeta;renderOrderWorkspace()');
 assert.match(app.node('[data-orders-coverage]').textContent,/6000/);
 assert.match(app.node('[data-orders-filter-hint]').textContent,/Загружено 1 из 6000/);
});
test('changing account or selected store clears date filters, stale errors and detail',()=>{
 const app=workspace();app.render([row('A')]);
 app.event('click','[data-orders-period]',{dataset:{ordersPeriod:'custom'}});
 app.event('change','[data-orders-from]',{value:'2026-07-01'});
 app.run("state.storeFleet={stores:[{id:'different',status:'connected_read_only'}],selectedStoreId:'different'};renderOrderWorkspace()");
 assert.equal(app.run('ordersPageState.period'),'all');assert.equal(app.run('ordersPageState.from'),'');
 app.event('click','[data-orders-period]',{dataset:{ordersPeriod:'undated'}});
 app.run('sessionGeneration++');app.render([]);
 assert.equal(app.run('ordersPageState.period'),'all');assert.equal(app.run('ordersPageState.to'),'');
});
test('table and details display exact creation in Moscow time, never browser-local time',()=>{
 const app=workspace();app.render([row('MIDNIGHT','paid',1,'RUB','2026-10-14T21:01:00Z')],{observedAt:octoberSnapshot});
 const table=app.node('#orders-table-body').innerHTML;assert.match(table,/15 окт/);assert.match(table,/00:01/);
 app.event('click','[data-order-open]',{dataset:{orderOpen:'MIDNIGHT'}});
 assert.match(app.node('[data-order-detail-body]').innerHTML,/15\.10\.2026, 00:01/);
});
