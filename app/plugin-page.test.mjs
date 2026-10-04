import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const addon = ['plugin-cover.js', 'plugin-page.js'].map(name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')).join('\n');
const cabinet = readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, '');
const entry = (patch = {}) => ({ id: 'zetslay.auto-reply', name: 'Автоответчик', category: 'chat', price: 'от 490 ₽', priceRub: 490, published: true, description: '**Ответы**\n> Ваша очередь', permissions: ['messages:read', 'replies:queue'], events: ['message.received'], planned: false, installed: false, active: false, ...patch });

function harness({ admin = false, hash = '#plugins/zetslay.auto-reply', loaded = true } = {}) {
  const listeners = new Map();
  const node = (dataset = {}) => ({ dataset, innerHTML: '', textContent: '', hidden: false, disabled: false, classList: { toggle() {} }, setAttribute() {}, closest: () => null });
  const page = node(), grid = node(), controls = node();
  const views = [node({ view: 'plugins' }), node({ view: 'plugin' })];
  const nav = [node({ viewTarget: 'plugins' })];
  const label = node();
  const location = { hash, hostname: 'zetslay.pro', search: '', href: `https://zetslay.pro/app/${hash}` };
  const document = {
    title: '', body: { classList: { toggle() {} } },
    querySelector(selector) {
      if (selector === 'meta[name="zetslay-api-base-url"]') return { content: 'https://api.zetslay.pro' };
      if (selector === '[data-plugin-page]') return page;
      if (selector === '[data-plugin-admin-controls]') return controls;
      return null;
    },
    getElementById: id => id === 'plugin-grid' ? grid : id === 'current-view-label' ? label : null,
    querySelectorAll: selector => selector === '[data-view]' ? views : selector === '[data-view-target]' ? nav : [],
    addEventListener: (type, callback) => listeners.set(type, [...(listeners.get(type) || []), callback])
  };
  const context = vm.createContext({ document, location, URL, URLSearchParams,
    sessionStorage: { getItem: () => 'session', removeItem() {} }, localStorage: { getItem: () => null, removeItem() {} },
    window: { setTimeout: callback => callback(), scrollTo() {} },
    history: { replaceState: (_, __, hash) => { location.hash = hash; } }
  });
  vm.runInContext(addon + '\n' + cabinet, context);
  const run = code => vm.runInContext(code, context);
  context.input = entry();
  run(`authState.user={id:'user',telegramUserId:'${admin ? '5062414502' : '123456789'}'}; state.plugins=[input]; state.pluginCanManage=${admin}; pluginPageState.loaded=${loaded}; pluginPageState.generation=sessionGeneration; showToast=()=>{};`);
  return { page, grid, controls, views, nav, label, document, location, context, run, listeners };
}

test('dedicated route opens the page on a direct URL and retains normal catalog navigation', () => {
  const app = harness();
  app.run("setView(location.hash.slice(1),false)");
  assert.equal(app.views[1].hidden, false);
  assert.equal(app.views[0].hidden, true);
  assert.match(app.page.innerHTML, /Возможности плагина/);
  assert.match(app.document.title, /Автоответчик/);
  assert.match(app.page.innerHTML, /href="#plugins"/);
  app.location.hash = '#plugins';
  app.run("setView('plugins',false)");
  assert.equal(app.views[0].hidden, false);
  assert.equal(app.views[1].hidden, true);
  assert.equal(app.page.innerHTML, '');
});

test('Details is a native page link and no detail modal or whole-card click hijacks it', () => {
  const app = harness();
  app.run('renderPlugins()');
  assert.match(app.grid.innerHTML, /href="#plugins\/zetslay.auto-reply" data-plugin-page-link>Подробнее/);
  assert.doesNotMatch(app.grid.innerHTML, /data-plugin-details=/);
  app.run("showPluginDialog=()=>{throw Error('unexpected modal')}; openPluginDetails('zetslay.auto-reply')");
  assert.equal(app.location.hash, '#plugins/zetslay.auto-reply');
});

test('route parsing rejects malformed encoding, selectors and non-manifest IDs', () => {
  const app = harness();
  for (const id of ['%E0%A4%A', '../x', '%22%3E%3Cscript%3E', 'abc/' ]) {
    app.location.hash = `#plugins/${id}`;
    app.run('renderPluginPage()');
    assert.match(app.page.innerHTML, /Плагин не найден/);
  }
  assert.equal(app.run("parsePluginPageRoute('orders')"), null);
});

test('page waits for authenticated catalog instead of presenting seeded or stale metadata', () => {
  const app = harness({ loaded: false });
  app.run('renderPluginPage()');
  assert.match(app.page.innerHTML, /Загружаем плагин/);
  assert.doesNotMatch(app.page.innerHTML, /Возможности плагина/);
  app.run("authState.user=null; renderPluginPage()");
  assert.match(app.page.innerHTML, /Войдите в кабинет/);
});

test('ordinary users have no administrative buttons in the catalog or detail markup', () => {
  const app = harness();
  app.run('state.pluginCoverAdmin=true; renderPlugins()');
  assert.equal(app.controls.innerHTML, '');
  assert.equal(app.controls.hidden, true);
  assert.doesNotMatch(app.grid.innerHTML + app.page.innerHTML, /data-plugin-(?:publish|edit|cover-admin)|data-cover-plugin/);
  app.run('state.pluginCanManage="true"; renderPlugins()');
  assert.equal(app.controls.innerHTML, '');
  app.run('state.pluginCanManage=true; authState.token=""; renderPlugins()');
  assert.equal(app.controls.innerHTML, '');
});

test('verified admins can edit metadata and covers; revocation clears those controls', () => {
  const app = harness({ admin: true });
  app.run('renderPlugins()');
  assert.match(app.controls.innerHTML, /data-plugin-publish/);
  assert.match(app.page.innerHTML, /data-plugin-edit="zetslay.auto-reply"/);
  assert.match(app.page.innerHTML, /data-cover-plugin="zetslay.auto-reply"/);
  app.run('state.pluginCanManage=false; renderPlugins()');
  assert.equal(app.controls.innerHTML, '');
  assert.doesNotMatch(app.page.innerHTML, /data-plugin-edit|data-cover-plugin/);
});

test('drafts cannot be opened by a user even if stale entries remain in memory', () => {
  const app = harness();
  app.run('state.plugins[0].published=false; renderPlugins()');
  assert.doesNotMatch(app.grid.innerHTML, /Подробнее/);
  assert.match(app.page.innerHTML, /Плагин не найден/);
  app.run("authState.user.telegramUserId='5062414502'; state.pluginCanManage=true; renderPlugins()");
  assert.match(app.page.innerHTML, /Черновик/);
  assert.match(app.page.innerHTML, /data-plugin-id="zetslay.auto-reply" disabled/);
});

test('all pages get a safe image; SVG, external and script covers use the category fallback', () => {
  const app = harness();
  for (const cover of ['', 'javascript:alert(1)', 'https://tracker.test/pixel', 'data:image/svg+xml;base64,AA==']) {
    app.context.cover = cover;
    assert.equal(app.run("pluginCoverSource({cover,category:'chat'})"), 'assets/plugin-covers/chat.svg');
  }
  const raster = 'data:image/webp;base64,AA==';
  app.context.cover = raster;
  assert.equal(app.run("pluginCoverSource({cover,category:'chat'})"), raster);
  app.run('renderPluginPage()');
  assert.match(app.page.innerHTML, /<img data-plugin-cover.*assets\/plugin-covers\/chat.svg/);
  assert.equal(app.run("pluginCoverSource({category:'../../../secret'})"), 'assets/plugin-covers/control.svg');
});

test('broken cover falls back once without an infinite error loop', () => {
  const app = harness();
  const image = { dataset: { coverCategory: 'chat' }, matches: () => true, src: 'bad' };
  app.listeners.get('error')[0]({ target: image });
  assert.equal(image.src, 'assets/plugin-covers/chat.svg');
  image.src = 'kept';
  app.listeners.get('error')[0]({ target: image });
  assert.equal(image.src, 'kept');
});

test('detail description formats bold and quotes while names and metadata remain escaped', () => {
  const app = harness();
  app.context.input = entry({ name: '<img src=x>', description: '**Возможность**\n> Цитата <script>\n<img onerror=x>' });
  app.run('state.plugins=[input]; renderPlugins()');
  assert.match(app.page.innerHTML, /<strong>Возможность<\/strong>/);
  assert.match(app.page.innerHTML, /<blockquote>Цитата &lt;script&gt;<\/blockquote>/);
  assert.doesNotMatch(app.page.innerHTML + app.grid.innerHTML, /<img src=x>|<script>|<img onerror=/);
});

test('catalog failure removes admin rights and the page offers a bounded retry', async () => {
  const app = harness({ admin: true });
  app.context.apiRequest = async () => { throw new Error('Backend недоступен'); };
  await assert.rejects(app.run('loadPluginCatalog()'));
  assert.equal(app.run('state.pluginCanManage'), false);
  assert.equal(app.controls.innerHTML, '');
  assert.match(app.page.innerHTML, /data-plugin-page-retry/);
  assert.match(app.page.innerHTML, /Backend недоступен/);
  app.context.apiRequest = async () => ({ canManage: false, entries: [entry({ installation: null })] });
  await app.run('loadPluginCatalog()');
  assert.match(app.page.innerHTML, /Возможности плагина/);
  assert.doesNotMatch(app.page.innerHTML, /data-plugin-page-retry/);
});

test('first catalog failure remains visible before any successful catalog response', async () => {
  const app = harness({ loaded: false });
  app.run('pluginPageState.generation=null');
  app.context.apiRequest = async () => { throw new Error('Первый запрос не прошёл'); };
  await assert.rejects(app.run('loadPluginCatalog()'));
  assert.match(app.page.innerHTML, /Первый запрос не прошёл/);
  assert.match(app.page.innerHTML, /data-plugin-page-retry/);
});

test('plugin actions use existing API permissions and suppress repeated clicks until completion', async () => {
  const app = harness();
  const calls = [];
  let finishInstall;
  app.context.apiRequest = async (path, options) => {
    calls.push({ path, options });
    if (path.endsWith('/install')) await new Promise(resolve => { finishInstall = resolve; });
  };
  app.context.loadPluginCatalog = async () => {};
  app.context.loadPluginAudit = async () => {};
  const first = app.run("changePluginState('zetslay.auto-reply')");
  await app.run("changePluginState('zetslay.auto-reply')");
  assert.equal(calls.length, 1);
  assert.match(app.page.innerHTML, /Сохраняем…/);
  assert.equal(calls[0].options.authenticated, true);
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options.body.permissions)), ['messages:read', 'replies:queue']);
  finishInstall(); await first;
  assert.equal(calls[1].path, '/api/v1/plugins/zetslay.auto-reply/enable');
  assert.equal(app.run('pluginPageState.busyId'), null);
});

test('action failures are visible and permit retry without changing the plugin state', async () => {
  const app = harness();
  app.context.apiRequest = async () => { throw new Error('Нужен тариф'); };
  await app.run("changePluginState('zetslay.auto-reply')");
  assert.match(app.page.innerHTML, /Нужен тариф/);
  assert.equal(app.run('state.plugins[0].installed'), false);
  assert.equal(app.run('pluginPageState.busyId'), null);
  app.context.nextPlugin = entry({ id: 'zetslay.telegram-notifications', name: 'Уведомления' });
  app.run('state.plugins.push(nextPlugin)');
  app.location.hash = '#plugins/zetslay.telegram-notifications';
  app.run('renderPluginPage()');
  assert.doesNotMatch(app.page.innerHTML, /Нужен тариф/);
});

test('switching accounts during install prevents enabling in another account and clears old details', async () => {
  const app = harness({ admin: true });
  const calls = [];
  let finish;
  app.context.apiRequest = path => { calls.push(path); return new Promise(resolve => { finish = resolve; }); };
  const first = app.run("changePluginState('zetslay.auto-reply')");
  app.run("sessionGeneration++; authState.token='another-session'; state.pluginCanManage=false; resetPluginPageState(); renderPlugins()");
  assert.match(app.page.innerHTML, /Загружаем плагин/);
  assert.equal(app.controls.innerHTML, '');
  finish(); await first;
  assert.equal(calls.length, 1);
  assert.equal(app.run('pluginPageState.busyId'), null);
});

test('planned plugins have disabled actions and never call install API', async () => {
  const app = harness();
  app.run('state.plugins[0].planned=true; renderPluginPage()');
  assert.match(app.page.innerHTML, /Пока недоступен/);
  app.context.apiRequest = () => { throw new Error('unexpected request'); };
  await app.run("changePluginState('zetslay.auto-reply')");
});
