import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const overview = readFileSync(new URL('./overview.js', import.meta.url), 'utf8');
const cabinetSource = readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, '');
const at = '2026-10-03T12:00:00.000Z';
const order = (id, amount, status = 'completed', currency = 'RUB', createdAt) => ({ id, totalMinor: amount, currency, status, createdAt });

function harness() {
  const listeners = new Map();
  const nodes = new Map();
  const node = name => {
    if (!nodes.has(name)) nodes.set(name, { textContent: '', innerHTML: '', hidden: false, disabled: false, value: '', attributes: {}, dataset: {}, classList: { toggle() {} }, setAttribute(key, value) { this.attributes[key] = value; } });
    return nodes.get(name);
  };
  const modes = ['orders', 'days'].map(value => { const button = node(`mode-${value}`); button.dataset.overviewMode = value; return button; });
  const root = { setAttribute() {}, querySelector: node, querySelectorAll: selector => selector === '[data-overview-mode]' ? modes : [] };
  const document = {
    querySelector: selector => selector === '[data-overview]' ? root : selector === 'meta[name="zetslay-api-base-url"]' ? { content: 'https://api.zetslay.pro' } : selector === '[data-topbar-balance]' ? node(selector) : null,
    querySelectorAll: () => [], getElementById: id => node(`#${id}`),
    addEventListener: (type, callback) => listeners.set(type, callback)
  };
  const context = vm.createContext({ document, URL, URLSearchParams, location: { hostname: 'zetslay.pro', search: '' },
    sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, removeItem() {} }, window: {} });
  vm.runInContext(overview + '\n' + cabinetSource, context);
  const run = source => vm.runInContext(source, context);
  const model = (orders = [], currency = '', extra = {}) => { context.input = { observedAt: at, orders, ...extra }; context.currency = currency; return JSON.parse(JSON.stringify(run('buildOverview(input, currency)'))); };
  const render = (content = { observedAt: at, orders: [] }, connected = true) => {
    context.input = content;
    context.connected = connected;
    run("state.storeContent=input; authState.user={}; authState.workspace={plan:{active:true,id:'demo'}}; state.storeFleet.stores=[{id:'store',status:connected?'connected_read_only':'attention'}]; state.storeFleet.selectedStoreId='store'; renderOverview();");
  };
  return { context, run, node, modes, model, render, listeners };
}

test('overview distinguishes a missing snapshot from a synced empty shop', () => {
  const app = harness();
  app.render({ orders: [] });
  assert.equal(app.node('[data-overview-orders]').textContent, '—');
  assert.match(app.node('[data-overview-chart]').innerHTML, /Начните с подключения/);
  app.render();
  assert.equal(app.node('[data-overview-orders]').textContent, '0');
  assert.equal(app.node('[data-overview-dialogs]').textContent, '0');
  assert.equal(app.node('[data-overview-refund-rate]').textContent, '—');
  assert.match(app.node('[data-overview-chart]').innerHTML, /Продаж пока нет/);
});

test('overview separates currencies and excludes refunds, cancellations and duplicate IDs from sales', () => {
  const app = harness();
  const orders = [order('a', 101), order('b', 202, 'paid'), order('c', 500, 'refunded'), order('d', 900, 'cancelled'), order('usd', 10000, 'completed', 'USD'), order('a', 999999)];
  const rub = app.model(orders);
  assert.equal(rub.count, 5);
  assert.equal(rub.salesCount, 3);
  assert.equal(rub.totalMinor, 303);
  assert.equal(rub.averageMinor, 152);
  assert.equal(rub.refundMinor, 500);
  assert.equal(rub.refundRate, 20);
  const usd = app.model(orders, 'USD');
  assert.equal(usd.totalMinor, 10000);
  assert.equal(usd.averageMinor, 10000);
  assert.equal(usd.refundMinor, null);
  assert.deepEqual(rub.currencies, ['RUB', 'USD']);
});

test('overview does not coerce strings, missing amounts, unknown statuses or invalid currencies into revenue', () => {
  const app = harness();
  const result = app.model([order('string', '10000'), order('negative', -100), order('fraction', 1.2), order('no-currency', 900, 'paid', ''), order('unknown', 12345, 'surprise'), order('good', 123, 'paid')]);
  assert.equal(result.totalMinor, 123);
  assert.equal(result.moneyOrders.length, 1);
  assert.equal(result.refundRate, null);
  assert.equal(app.model([order('unknown', 123, 'surprise')]).totalMinor, null);
  assert.equal(app.model([order('broken', null)]).averageMinor, null);
  assert.equal(app.model([order('zero', 0)]).averageMinor, 0);
  assert.equal(app.model([order('overflow1', Number.MAX_SAFE_INTEGER), order('overflow2', Number.MAX_SAFE_INTEGER)]).totalMinor, null);
});

test('overview counts distinct real threads without claiming they are unread', () => {
  const result = harness().model([], '', { messages: [{ threadId: 'a', sender: 'buyer' }, { threadId: 'a', sender: 'seller' }, { threadId: 'b' }, {}, null] });
  assert.equal(result.dialogs, 2);
});

test('overview never substitutes the sync time for missing order dates', () => {
  const app = harness();
  const orders = [order('a', 100), order('b', 200, 'paid', 'RUB', 'invalid')];
  app.render({ observedAt: at, orders });
  assert.equal(app.modes[1].disabled, true);
  app.run("overviewState.mode='days'; renderOverview()");
  assert.equal(app.run('overviewState.mode'), 'orders');
  assert.match(app.node('[data-overview-chart]').innerHTML, /порядке списка FunPay/);
  assert.match(app.node('[data-overview-chart-note]').textContent, /без временной шкалы/);
});

test('overview groups actual dates in UTC and rejects future dates without inventing zero-sales days', () => {
  const app = harness();
  const result = app.model([order('a', 100, 'paid', 'RUB', '2026-10-01T23:00:00-02:00'), order('b', 200, 'paid', 'RUB', '2026-10-02T03:00:00Z'), order('c', 300, 'paid', 'RUB', '2026-09-28T10:00:00Z')]);
  assert.deepEqual(result.days, [{ label: '2026-09-28', amount: 300, count: 1 }, { label: '2026-10-02', amount: 300, count: 2 }]);
  app.context.result = result;
  const html = app.run("overviewChartMarkup(result, 'days').html");
  assert.doesNotMatch(html, /overview-chart-area/);
  assert.match(html, /d="M[^"L]+ M/);
  assert.equal(app.model([order('future', 200, 'paid', 'RUB', '2027-01-01T00:00:00Z')]).dated, false);
});

test('overview chart keeps a readable coordinate system on narrow screens', () => {
  const app = harness();
  app.context.result = app.model(Array.from({ length: 100 }, (_, index) => order(String(index), 500 + index)));
  const html = app.run("overviewChartMarkup(result, 'orders', 280).html");
  assert.match(html, /viewBox="0 0 280 210"/);
  assert.equal((html.match(/class="overview-chart-bar"/g) || []).length, 100);
  assert.equal((html.match(/text-anchor="middle"/g) || []).length, 4);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('overview escapes order and chart data, and uses returned status instead of dispute', () => {
  const app = harness();
  app.render({ observedAt: at, orders: [{ ...order('<img src=x onerror=alert(1)>', 100), product: '<script>attack</script>', buyer: '<private>' }, order('return', 500, 'refunded')] });
  const chart = app.node('[data-overview-chart]').innerHTML;
  const table = app.node('[data-overview-chart-table]').innerHTML;
  const recent = app.node('#dash-orders-list').innerHTML;
  for (const html of [chart, table, recent]) { assert.doesNotMatch(html, /<img|<script>|<private>/); assert.match(html, /&lt;img/); }
  assert.match(recent, /Возвращён/);
  assert.doesNotMatch(recent, /Спор/);
});

test('overview currency and chart controls work through delegated events without changing the source', () => {
  const app = harness();
  const content = { observedAt: at, orders: [order('rub', 10000, 'paid', 'RUB', '2026-10-01T12:00:00Z'), order('usd', 500, 'paid', 'USD', '2026-10-02T12:00:00Z')] };
  const original = JSON.stringify(content);
  app.render(content);
  const before = app.node('[data-overview-sales]').textContent;
  app.listeners.get('change')({ target: { matches: selector => selector === '[data-overview-currency]', value: 'USD' } });
  assert.equal(app.run('overviewState.currency'), 'USD');
  assert.notEqual(app.node('[data-overview-sales]').textContent, before);
  app.listeners.get('click')({ target: { closest: selector => selector === '[data-overview-mode]' ? app.modes[1] : null } });
  assert.equal(app.run('overviewState.mode'), 'days');
  assert.match(app.node('[data-overview-chart-subtitle]').textContent, /UTC/);
  assert.equal(JSON.stringify(content), original);
});

test('overview refresh suppresses duplicate calls, displays errors and retains the previous snapshot', async () => {
  const app = harness();
  app.render({ observedAt: at, orders: [order('old', 15000)] });
  let reject;
  let calls = 0;
  app.context.syncStoreContent = () => { calls++; return new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }); };
  const pending = app.run('refreshOverview()');
  await app.run('refreshOverview()');
  assert.equal(calls, 1);
  assert.equal(app.node('[data-overview-refresh]').disabled, true);
  reject(new Error('Сбой соединения'));
  await pending;
  assert.equal(app.node('[data-overview-refresh]').disabled, false);
  assert.match(app.node('[data-overview-notice]').textContent, /Сбой соединения.*предыдущий снимок/);
  assert.equal(app.node('[data-overview-orders]').textContent, '1');
});

test('overview ignores an error from an old session and clears the prior account snapshot', async () => {
  const app = harness();
  app.render({ observedAt: at, orders: [order('old', 15000)] });
  let reject;
  app.context.syncStoreContent = () => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; });
  const pending = app.run('refreshOverview()');
  app.run('sessionGeneration++; state.storeContent={observedAt:null,orders:[],messages:[]};');
  reject(new Error('private old account error'));
  await pending;
  assert.equal(app.node('[data-overview-sales]').textContent, '—');
  assert.doesNotMatch(app.node('[data-overview-notice]').textContent, /private old account/);
});

test('overview renders after the cabinet sync and keeps the topbar balance integration', () => {
  const app = harness();
  app.render({ observedAt: at, orders: [order('before', 100)] });
  app.run("state.storeContent={observedAt:'2026-10-03T12:01:00Z',orders:[{id:'after',totalMinor:200,currency:'RUB',status:'completed'}]}; state.storeFleet.stores[0].metrics={balance:'123 ₽'}; renderDashboard();");
  assert.equal(app.node('[data-overview-sales]').textContent, app.run("overviewMoney(200,'RUB')"));
  assert.match(app.node('#dash-orders-list').innerHTML, /after/);
  assert.equal(app.node('[data-topbar-balance]').textContent, '123 ₽');
  assert.equal(app.node('[data-overview-notice]').hidden, true);
});

test('overview refresh uses the existing authenticated read-only content API', async () => {
  const app = harness();
  app.render();
  const calls = [];
  app.context.apiRequest = async (path, options) => {
    calls.push(path);
    assert.equal(options.authenticated, true);
    assert.equal(options.method, undefined);
    return { observedAt: at, orders: [order('new', 500)], messages: [], lots: [] };
  };
  for (const name of ['renderAnalytics', 'renderStoreFleet', 'renderOrders', 'renderConversations', 'renderLots']) app.context[name] = () => {};
  await app.run('refreshOverview()');
  assert.deepEqual(calls, ['/api/v1/funpay/content']);
  assert.match(app.node('#dash-orders-list').innerHTML, /new/);
  assert.equal(app.node('[data-overview-refresh]').disabled, false);
});
