import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const scripts = ['messages.js', 'app.js'].map(name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, '')).join('\n');
const at = '2026-10-03T12:00:00Z';
const msg = (threadId, text = 'Здравствуйте', sender = 'buyer', extra = {}) => ({ id: `${threadId}-${text}`, threadId, text, sender, buyer: `Игрок ${threadId}`, ...extra });

function workspace() {
  const listeners = new Map(), nodes = new Map();
  const node = name => {
    if (!nodes.has(name)) nodes.set(name, { textContent: '', innerHTML: '', value: '', hidden: false, disabled: false, dataset: {}, attributes: {}, scrollTop: 0, scrollHeight: 600, clientHeight: 200, focused: false, renders: 0, classList: { toggle() {} },
      setAttribute(key, value) { this.attributes[key] = value; }, focus() { this.focused = true; }, querySelector: () => null, querySelectorAll: () => [] });
    return nodes.get(name);
  };
  const filters = ['all', 'buyer', 'seller'].map(actor => { const n = node(`filter-${actor}`); n.dataset.messagesFilter = actor; return n; });
  const counts = filters.map(button => { const n = node(`count-${button.dataset.messagesFilter}`); n.dataset.messagesFilterCount = button.dataset.messagesFilter; return n; });
  const matches = ['prev', 'next'].map(direction => { const n = node(`match-${direction}`); n.dataset.messagesMatch = direction; return n; });
  const root = { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, querySelector: selector => selector === '[data-messages-dialog]' ? dialog : node(selector), querySelectorAll: selector => ({ '[data-messages-filter]': filters, '[data-messages-filter-count]': counts, '[data-messages-match]': matches }[selector] || []) };
  const dialog = { open: false, opens: 0, querySelector: node, showModal() { this.open = true; this.opens++; }, close() { this.open = false; } };
  const body = node('[data-messages-body]');
  let html = '';
  Object.defineProperty(body, 'innerHTML', { get: () => html, set: value => { html = value; body.renders++; } });
  const document = {
    querySelector(selector) { if (selector === '[data-messages-workspace]') return root; if (selector === '[data-messages-dialog]') return dialog; if (selector === 'meta[name="zetslay-api-base-url"]') return { content: 'https://api.zetslay.pro' }; return null; },
    querySelectorAll: () => [], getElementById: () => null,
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) || []), listener]); }
  };
  const context = vm.createContext({ document, URL, URLSearchParams, location: { hostname: 'zetslay.pro', hash: '#messages', search: '' }, sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, removeItem() {} }, window: {} });
  vm.runInContext(scripts, context);
  const run = code => vm.runInContext(code, context);
  const model = (messages, filters = {}, observedAt = at) => { context.input = { observedAt, messages }; context.inputFilters = filters; return JSON.parse(JSON.stringify(run('buildMessagesWorkspace(input, inputFilters)'))); };
  const render = (messages = [], { observedAt = at, connected = true } = {}) => {
    context.input = { observedAt, messages, orders: [], lots: [] }; context.connected = connected;
    run("state.storeContent=input; authState.user={}; state.storeFleet={stores:[{id:'store',status:connected?'connected_read_only':'attention'}],selectedStoreId:'store'}; renderMessagesWorkspace();");
  };
  const event = (type, selector, { value = '', dataset = {}, disabled = false, key = '' } = {}) => {
    const target = { value, dataset, disabled, hasAttribute: s => `[${s}]` === selector, matches: s => s === selector,
      closest: s => s === 'button' ? target : s === '[data-messages-workspace]' ? root : s === selector ? target : null };
    for (const listener of listeners.get(type) || []) listener({ target, key });
  };
  return { context, run, model, render, event, root, node, dialog, matches, body };
}

test('inbox reads actual adapter fields and never fabricates unread, presence or dates', () => {
  const app = workspace();
  const model = app.model([msg('42'), msg('42', 'Спасибо', 'seller', { fromSeller: true })]);
  assert.equal(model.threads.length, 1);
  assert.equal(model.totalMessages, 2);
  assert.equal(model.threads[0].date, null);
  assert.equal(model.threads[0].lastSender, 'seller');
  assert.equal(model.threads[0].unread, undefined);
  app.render([msg('42')]);
  assert.doesNotMatch(app.body.innerHTML, /datetime=|прочитано|онлайн/i);
  assert.match(app.node('[data-messages-date-note]').textContent, /не передал дату/);
});

test('inbox refuses malformed rows and unavailable snapshots without inventing thread IDs', () => {
  const app = workspace();
  const rows = [null, {}, { text: 'private' }, { threadId: 42, text: 'invalid' }, msg('  '), msg('real')];
  assert.equal(app.model(rows).threads.length, 1);
  assert.equal(app.model(rows, {}, null).threads.length, 0);
  assert.equal(app.model(rows, {}, 'not a date').loaded, false);
  const fallback = app.model([{ threadId: 'actual', text: 'Hi' }]);
  assert.equal(fallback.threads[0].name, 'Диалог actual');
  assert.equal(fallback.threads[0].lastSender, 'unknown');
});

test('message identity is scoped to each thread, duplicates are removed and ID-less messages retained', () => {
  const app = workspace();
  const rows = [msg('a', 'One', 'buyer', { id: '1' }), msg('a', 'One', 'buyer', { id: '1' }), msg('b', 'Two', 'buyer', { id: '1' }), msg('a', 'Unknown ID', 'buyer', { id: null }), msg('a', 'Unknown ID', 'buyer', { id: null })];
  assert.equal(app.model(rows).totalMessages, 4);
  assert.equal(app.model(rows).threads[0].messages.length, 3);
});

test('known message dates are sorted; missing or future dates retain source order', () => {
  const app = workspace();
  const dated = [msg('a', 'New', 'seller', { createdAt: '2026-10-03T11:00:00Z' }), msg('a', 'Old', 'buyer', { createdAt: '2026-10-01T09:00:00Z' })];
  const before = JSON.stringify(dated);
  assert.deepEqual(app.model(dated).threads[0].messages.map(message => message.text), ['Old', 'New']);
  assert.equal(JSON.stringify(dated), before);
  assert.deepEqual(app.model([...dated, msg('a', 'No date')]).threads[0].messages.map(message => message.text), ['New', 'Old', 'No date']);
  const future = app.model([msg('a', 'Future', 'buyer', { createdAt: '2030-10-03T11:00:00Z' })]);
  assert.equal(future.threads[0].date, null);
  assert.equal(app.model([msg('a', 'Invalid calendar', 'buyer', { createdAt: '2026-02-30T09:00:00Z' })]).threads[0].date, null);
  assert.equal(app.model([msg('a', 'Ambiguous local date', 'buyer', { createdAt: '2026-10-01T09:00:00' })]).threads[0].date, null);
});

test('search matches buyer, real thread ID and message text with case-insensitive Cyrillic', () => {
  const app = workspace();
  const rows = [msg('a', 'КЛЮЧ получен'), msg('b', 'Спасибо', 'seller')];
  assert.equal(app.model(rows, { query: '  ключ  ' }).filtered[0].id, 'a');
  assert.equal(app.model(rows, { query: 'Игрок B' }).filtered[0].id, 'b');
  assert.equal(app.model(rows, { query: 'a' }).filtered.length, 1);
  assert.equal(app.model(rows, { query: 'missing' }).filtered.length, 0);
});

test('sender filters use the last message and counts respect search without changing snapshot totals', () => {
  const app = workspace();
  const rows = [msg('a'), msg('a', 'Answer', 'seller'), msg('b'), msg('c', 'System', 'system')];
  assert.deepEqual(app.model(rows).counts, { all: 3, buyer: 1, seller: 1 });
  assert.equal(app.model(rows, { actor: 'buyer' }).filtered[0].id, 'b');
  assert.equal(app.model(rows, { query: 'Answer', actor: 'buyer' }).counts.seller, 1);
  app.render(rows);
  app.event('click', '[data-messages-filter]', { dataset: { messagesFilter: 'seller' } });
  assert.equal(app.node('[data-messages-total]').textContent, '3');
  assert.doesNotMatch(app.node('[data-messages-list]').innerHTML, /data-messages-thread="b"/);
  app.event('input', '[data-messages-search]', { value: 'No such text' });
  assert.match(app.node('[data-messages-list]').innerHTML, /Диалогов не найдено/);
  app.event('click', '[data-messages-reset]');
  assert.equal(app.run('messagesPageState.query'), '');
  assert.equal(app.run('messagesPageState.actor'), 'all');
});

test('all untrusted names, IDs and message text are escaped in list, chat and info', () => {
  const app = workspace();
  const id = '" autofocus <img>';
  app.render([msg(id, '<script>attack</script>\nHello', 'buyer', { buyer: '<svg onload=attack>' })]);
  assert.doesNotMatch(app.node('[data-messages-list]').innerHTML, /<img>|<svg onload/);
  assert.match(app.node('[data-messages-list]').innerHTML, /&quot; autofocus/);
  assert.doesNotMatch(app.body.innerHTML, /<script>|<svg onload/);
  app.event('click', '[data-messages-info]');
  assert.equal(app.dialog.open, true);
  assert.doesNotMatch(app.node('[data-messages-info-body]').innerHTML, /<img>|<svg onload/);
  assert.match(app.node('[data-messages-info-body]').innerHTML, /&lt;svg/);
});

test('literal in-chat search escapes regex metacharacters and matches safe markup', () => {
  const app = workspace();
  const highlighted = app.run(`highlightMessageText('<img> [a.*] [A.*]', '[a.*]', 3, 4)`);
  assert.equal(highlighted.count, 2);
  assert.match(highlighted.html, /data-message-match="3"/);
  assert.match(highlighted.html, /data-message-match="4" class="is-current"/);
  assert.match(highlighted.html, /&lt;img&gt;/);
  assert.doesNotMatch(highlighted.html, /<img>/);
  assert.equal(app.run(`highlightMessageText('abc', '   ').count`), 0);
  assert.equal(app.run(`messagesTranscript({name:'Test',messages:[{text:'',sender:'unknown',date:null}]}, 'Текст').count`), 0);
});

test('in-chat search navigates occurrences, wraps and closes without changing messages', () => {
  const app = workspace();
  app.render([msg('a', 'Ключ и ключ'), msg('a', 'Ещё ключ', 'seller')]);
  app.event('click', '[data-messages-find-toggle]');
  assert.equal(app.node('[data-messages-findbar]').hidden, false);
  app.event('input', '[data-messages-find]', { value: 'КЛЮЧ' });
  assert.equal(app.node('[data-messages-matches]').textContent, '1 / 3');
  app.event('click', '[data-messages-match]', { dataset: { messagesMatch: 'prev' } });
  assert.equal(app.node('[data-messages-matches]').textContent, '3 / 3');
  app.event('click', '[data-messages-match]', { dataset: { messagesMatch: 'next' } });
  assert.equal(app.node('[data-messages-matches]').textContent, '1 / 3');
  app.event('input', '[data-messages-find]', { value: 'absent' });
  assert.equal(app.node('[data-messages-matches]').textContent, 'Нет совпадений');
  assert.equal(app.matches[0].disabled, true);
  app.event('click', '[data-messages-find-close]');
  assert.equal(app.node('[data-messages-findbar]').hidden, true);
  assert.doesNotMatch(app.body.innerHTML, /<mark/);
});

test('selected thread survives refresh reordering and list filtering', () => {
  const app = workspace();
  app.render([msg('a'), msg('b')]);
  app.event('click', '[data-messages-thread]', { dataset: { messagesThread: 'b' } });
  app.render([msg('b', 'new'), msg('a')]);
  assert.equal(app.run('messagesPageState.selectedId'), 'b');
  assert.equal(app.node('[data-messages-name]').textContent, 'Игрок b');
  app.event('input', '[data-messages-search]', { value: 'Игрок a' });
  assert.equal(app.node('[data-messages-name]').textContent, 'Игрок b');
  app.event('click', '[data-messages-thread]', { dataset: { messagesThread: 'made-up' } });
  assert.equal(app.run('messagesPageState.selectedId'), 'b');
});

test('mobile navigation begins at list, opens chat and returns while preserving selection', () => {
  const app = workspace();
  app.render([msg('a'), msg('b')]);
  assert.equal(app.root.attributes['data-chat-selected'], 'false');
  app.event('click', '[data-messages-thread]', { dataset: { messagesThread: 'b' } });
  assert.equal(app.root.attributes['data-chat-selected'], 'true');
  app.event('click', '[data-messages-back]');
  assert.equal(app.root.attributes['data-chat-selected'], 'false');
  assert.equal(app.run('messagesPageState.selectedId'), 'b');
});

test('a disappeared selected thread returns mobile to list and clears its info and search', () => {
  const app = workspace();
  app.render([msg('a'), msg('b')]);
  app.event('click', '[data-messages-thread]', { dataset: { messagesThread: 'b' } });
  app.event('click', '[data-messages-info]');
  app.event('input', '[data-messages-find]', { value: 'secret' });
  app.render([msg('a')]);
  assert.equal(app.dialog.open, false);
  assert.equal(app.run('messagesPageState.findQuery'), '');
  assert.equal(app.root.attributes['data-chat-selected'], 'false');
  assert.doesNotMatch(app.body.innerHTML, /Игрок b/);
});

test('dialog contains only known snapshot information and clears its body when closed', () => {
  const app = workspace();
  app.render([msg('a')]);
  app.event('click', '[data-messages-info]');
  const html = app.node('[data-messages-info-body]').innerHTML;
  assert.match(html, /ID диалога/);
  assert.match(html, /Дата не передана FunPay/);
  assert.doesNotMatch(html, /email|Заказ №|онлайн/i);
  app.event('click', '[data-messages-info-close]');
  assert.equal(app.dialog.open, false);
  assert.equal(app.node('[data-messages-info-body]').innerHTML, '');
});

test('account reset clears previous buyer data, dialog, search and selection', () => {
  const app = workspace();
  app.render([msg('private')]);
  app.event('input', '[data-messages-search]', { value: 'private' });
  app.event('click', '[data-messages-info]');
  app.run('sessionGeneration++');
  app.render([], { observedAt: null, connected: false });
  assert.equal(app.node('[data-messages-search]').value, '');
  assert.equal(app.run('messagesPageState.selectedId'), null);
  assert.equal(app.dialog.open, false);
  assert.doesNotMatch(app.body.innerHTML, /private/);
  assert.equal(app.node('[data-messages-total]').textContent, '—');
});

test('loaded empty snapshot differs from unavailable and filtered-empty states', () => {
  const app = workspace();
  app.render([], { observedAt: null, connected: false });
  assert.match(app.node('[data-messages-list]').innerHTML, /Подключите магазин/);
  assert.equal(app.node('[data-messages-refresh]').disabled, true);
  app.render([]);
  assert.match(app.node('[data-messages-list]').innerHTML, /В снимке нет сообщений/);
  assert.equal(app.node('[data-messages-total]').textContent, '0');
  app.render([], { observedAt: null });
  assert.match(app.node('[data-messages-list]').innerHTML, /ещё не загружена/);
});

test('body preserves scroll position on refresh and is not recreated by list filtering', () => {
  const app = workspace();
  app.render([msg('a', 'One')]);
  app.body.scrollTop = 30;
  const renders = app.body.renders;
  app.event('input', '[data-messages-search]', { value: 'a' });
  assert.equal(app.body.renders, renders);
  app.render([msg('a', 'One'), msg('a', 'Two')]);
  assert.equal(app.body.scrollTop, 30);
  app.body.scrollTop = 400;
  app.render([msg('a', 'One'), msg('a', 'Two'), msg('a', 'Three')]);
  assert.equal(app.body.scrollTop, app.body.scrollHeight);
});

test('refresh suppresses duplicate clicks and preserves snapshot on failure', async () => {
  const app = workspace();
  app.render([msg('old')]);
  let reject, calls = 0;
  app.context.syncStoreContent = () => { calls++; return new Promise((_resolve, fail) => { reject = fail; }); };
  const pending = app.run('refreshMessagesWorkspace()');
  await app.run('refreshMessagesWorkspace()');
  assert.equal(calls, 1);
  assert.equal(app.node('[data-messages-refresh]').disabled, true);
  reject(new Error('Сбой соединения'));
  await pending;
  assert.match(app.node('[data-messages-notice]').textContent, /Сбой соединения.*предыдущий снимок/);
  assert.match(app.body.innerHTML, /Игрок old/);
  assert.equal(app.node('[data-messages-refresh]').disabled, false);
});

test('late refresh error cannot enter another account session', async () => {
  const app = workspace();
  app.render([msg('old')]);
  let reject;
  app.context.syncStoreContent = () => new Promise((_resolve, fail) => { reject = fail; });
  const pending = app.run('refreshMessagesWorkspace()');
  app.run('sessionGeneration++');
  app.render([], { observedAt: null, connected: false });
  reject(new Error('private old error'));
  await pending;
  assert.equal(app.node('[data-messages-notice]').hidden, true);
  assert.doesNotMatch(app.node('[data-messages-notice]').textContent, /private/);
});

test('refresh uses only the existing authenticated GET and both legacy render hooks delegate', async () => {
  const app = workspace();
  app.render([]);
  const calls = [];
  for (const name of ['renderStoreFleet', 'renderOrders', 'renderAnalytics', 'renderLots']) app.context[name] = () => {};
  app.context.apiRequest = async (path, options) => { calls.push(path); assert.equal(options.authenticated, true); assert.ok(!options.method || options.method === 'GET'); return { observedAt: at, messages: [msg('a')], orders: [], lots: [] }; };
  await app.run('refreshMessagesWorkspace()');
  assert.deepEqual(calls, ['/api/v1/funpay/content']);
  assert.match(app.body.innerHTML, /Игрок a/);
  app.run("messagesPageState.selectedId='a'; renderActiveConversation(); renderConversations();");
  assert.equal(app.node('[data-messages-name]').textContent, 'Игрок a');
});

test('read-only composer has no write controls or fake AI and all new assets load before app', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const section = html.slice(html.indexOf('data-messages-workspace'), html.indexOf('data-view="lots"'));
  assert.match(section, /<textarea[^>]+disabled/);
  assert.match(section, /aria-label="Отправка недоступна[^>]+disabled/);
  assert.doesNotMatch(section, /data-quick-reply|ai-compose|id="send-message"|data-toast|data-chat="/);
  assert.ok(html.indexOf('src="messages.js') < html.indexOf('src="app.js'));
  assert.equal((html.match(/src="messages\.js/g) || []).length, 1);
  assert.equal((html.match(/href="messages\.css/g) || []).length, 1);
});
