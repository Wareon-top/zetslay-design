import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const addon = ['plugin-cover.js', 'plugin-rarity.js', 'plugin-page.js'].map(name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')).join('\n');
const cabinet = readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, '');
const entry = (patch = {}) => ({ id: 'zetslay.test-plugin', name: 'Тестовый модуль', category: 'chat', price: 'от 490 ₽', priceRub: 490, published: true, description: '**Ответы**\n> Ваша очередь', permissions: ['messages:read', 'replies:queue'], permissionsRaw: ['messages:read', 'replies:queue'], events: ['message.received'], planned: false, installed: false, active: false, ...patch });

function harness({ admin = false, hash = '#plugins/zetslay.test-plugin', loaded = true } = {}) {
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
  assert.match(app.document.title, /Тестовый модуль/);
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
  assert.match(app.grid.innerHTML, /href="#plugins\/zetslay.test-plugin" data-plugin-page-link>Подробнее/);
  assert.doesNotMatch(app.grid.innerHTML, /data-plugin-details=/);
  app.run("showPluginDialog=()=>{throw Error('unexpected modal')}; openPluginDetails('zetslay.test-plugin')");
  assert.equal(app.location.hash, '#plugins/zetslay.test-plugin');
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
  assert.match(app.page.innerHTML, /data-plugin-edit="zetslay.test-plugin"/);
  assert.match(app.page.innerHTML, /data-cover-plugin="zetslay.test-plugin"/);
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
  assert.match(app.page.innerHTML, /data-plugin-id="zetslay.test-plugin" disabled/);
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
  assert.doesNotMatch(app.page.innerHTML, /<img data-plugin-cover|plugin-page-cover/);
  app.run('renderPlugins()');
  assert.match(app.grid.innerHTML, /<img data-plugin-cover.*assets\/plugin-covers\/chat.svg/);
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
  const first = app.run("changePluginState('zetslay.test-plugin')");
  await app.run("changePluginState('zetslay.test-plugin')");
  assert.equal(calls.length, 1);
  assert.match(app.page.innerHTML, /Сохраняем…/);
  assert.equal(calls[0].options.authenticated, true);
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options.body.permissions)), ['messages:read', 'replies:queue']);
  finishInstall(); await first;
  assert.equal(calls[1].path, '/api/v1/plugins/zetslay.test-plugin/enable');
  assert.equal(app.run('pluginPageState.busyId'), null);
});

test('action failures are visible and permit retry without changing the plugin state', async () => {
  const app = harness();
  app.context.apiRequest = async () => { throw new Error('Нужен тариф'); };
  await app.run("changePluginState('zetslay.test-plugin')");
  assert.match(app.page.innerHTML, /Нужен тариф/);
  assert.equal(app.run('state.plugins[0].installed'), false);
  assert.equal(app.run('pluginPageState.busyId'), null);
  app.context.nextPlugin = entry({ id: 'zetslay.second-test-plugin', name: 'Уведомления' });
  app.run('state.plugins.push(nextPlugin)');
  app.location.hash = '#plugins/zetslay.second-test-plugin';
  app.run('renderPluginPage()');
  assert.doesNotMatch(app.page.innerHTML, /Нужен тариф/);
});

test('switching accounts during install prevents enabling in another account and clears old details', async () => {
  const app = harness({ admin: true });
  const calls = [];
  let finish;
  app.context.apiRequest = path => { calls.push(path); return new Promise(resolve => { finish = resolve; }); };
  const first = app.run("changePluginState('zetslay.test-plugin')");
  app.run("sessionGeneration++; authState.token='another-session'; state.pluginCanManage=false; resetPluginPageState(); renderPlugins()");
  assert.match(app.page.innerHTML, /Загружаем плагин/);
  assert.equal(app.controls.innerHTML, '');
  finish(); await first;
  assert.equal(calls.length, 1);
  assert.equal(app.run('pluginPageState.busyId'), null);
});

test('planned plugins stay out of the catalog and direct pages for every role and never call install API', async () => {
  const app = harness();
  app.run('state.plugins[0].planned=true; renderPlugins()');
  assert.match(app.page.innerHTML, /Плагин не найден/);
  assert.doesNotMatch(app.grid.innerHTML, /Тестовый модуль|Подробнее/);
  app.run("authState.user.telegramUserId='5062414502'; state.pluginCanManage=true; renderPlugins()");
  assert.match(app.page.innerHTML, /Плагин не найден/);
  assert.doesNotMatch(app.grid.innerHTML, /Тестовый модуль|Подробнее/);
  app.context.apiRequest = () => { throw new Error('unexpected request'); };
  await app.run("changePluginState('zetslay.test-plugin')");
});

test('unavailable legacy plugins are hidden for users and admins, including direct links and stale install controls', async () => {
  for (const admin of [false, true]) {
    const app = harness({ admin });
    app.context.blocked = [entry({ id: 'zetslay.auto-reply', name: 'Автоответчик', installed: true }), entry({ id: 'zetslay.telegram-notifications', name: 'Telegram-уведомления', installed: true })];
    app.run('state.plugins.push(...blocked); renderPlugins()');
    assert.match(app.grid.innerHTML, /Тестовый модуль/);
    assert.doesNotMatch(app.grid.innerHTML, /Автоответчик|Telegram-уведомления/);
    app.context.apiRequest = () => { throw Error('unexpected install request'); };
    for (const id of ['zetslay.auto-reply', 'zetslay.telegram-notifications']) {
      app.location.hash = `#plugins/${id}`;
      app.run('renderPluginPage()');
      assert.match(app.page.innerHTML, /Плагин не найден/);
      await app.run(`changePluginState('${id}')`);
    }
  }
});

test('rarity on cards remains stable when enabling, pausing or changing price and the detail has no banner',()=>{
  const app=harness();app.context.input=entry({id:'zetslay.mass-price-editor'});app.location.hash='#plugins/zetslay.mass-price-editor';
  app.run('state.plugins=[input];renderPlugins()');assert.match(app.grid.innerHTML,/data-plugin-rarity="ultra"/);assert.doesNotMatch(app.grid.innerHTML,/plugin-card__badge/);assert.doesNotMatch(app.page.innerHTML,/<figure|<img|plugin-page-cover/);
  app.run('state.plugins[0].active=true;state.plugins[0].installed=true;state.plugins[0].price="999 ₽";renderPlugins()');assert.match(app.grid.innerHTML,/data-plugin-rarity="ultra"/);assert.match(app.grid.innerHTML,/Отключить/);assert.match(app.page.innerHTML,/Контроль остаётся у вас/);
});

test('rarity labels cover all four built-in levels and ignore arbitrary metadata',()=>{
  const app=harness();
  for(const [id,key,label] of [['zetslay.confirm-reminder','common','Обычный'],['zetslay.review-reminder','advanced','Продвинутый'],['zetslay.mass-price-editor','ultra','Ультра'],['zetslay.auto-review-bonus','legendary','Легендарный'],['__proto__','common','Обычный']]){
    app.context.rarityInput={id,rarity:'<img onerror=x>',active:true,priceRub:10000};
    const html=app.run('pluginRarityMarkup(rarityInput)');assert.ok(html.includes(`data-plugin-rarity="${key}"`));assert.ok(html.includes(label));assert.ok(!html.includes('<img'));
  }
});

test('focused rarity deployment preserves local account and plugin changes and remains repeatable',async()=>{
  const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');const {join}=await import('node:path');const {spawnSync}=await import('node:child_process');
  const root=mkdtempSync(new URL('./rarity-stage-',import.meta.url).pathname);
  try{
    const local=join(root,'local'),out=join(root,'out');mkdirSync(local);
    const oldFragment=`</a></div><div class="plugin-card__cover-meta">\$\{adminMark\}<span class="plugin-card__badge \$\{tone === 'green' ? 'plugin-card__badge--work' : tone === 'blue' ? 'plugin-card__badge--pause' : 'plugin-card__badge--soon'\}">\$\{status\}</span></div>`;
    const newFragment=`</a>\$\{typeof pluginRarityMarkup === 'function' ? pluginRarityMarkup(plugin) : ''\}</div>\$\{adminMark ? \`<div class="plugin-card__cover-meta">\$\{adminMark\}</div>\` : ''\}`;
    writeFileSync(join(local,'app.js'),cabinet.replace(newFragment,oldFragment)+'\n// LOCAL_AUTH_AND_PROXY_CHANGES\n');
    const source=readFileSync(new URL('./plugin-page.js',import.meta.url),'utf8');
    writeFileSync(join(local,'plugin-page.js'),source.replace('<div class="plugin-page-layout"><div class="plugin-page-main">','<div class="plugin-page-layout"><div class="plugin-page-main">\n<figure class="plugin-page-cover"><img src="cover.png"></figure>')+'\n// LOCAL_PLUGIN_GUIDE\n');
    writeFileSync(join(local,'index.html'),'<head><meta name="zetslay-api-base-url" content="https://api.zetslay.pro"></head><script src="plugin-page.js?v=old" defer></script><script src="app.js?v=old" defer></script>');
    const stage=new URL('../deploy/stage-plugin-rarity-ui.py',import.meta.url).pathname,incoming=new URL('./',import.meta.url).pathname;
    let r=spawnSync('python3',[stage,local,incoming,out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
    const app=readFileSync(join(out,'app.js'),'utf8'),page=readFileSync(join(out,'plugin-page.js'),'utf8');assert.match(app,/LOCAL_AUTH_AND_PROXY_CHANGES/);assert.match(app,/zetslay\.auto-reply.*zetslay\.telegram-notifications/);assert.match(page,/LOCAL_PLUGIN_GUIDE/);assert.match(page,/massPriceGuideMarkup/);assert.doesNotMatch(page,/<figure class="plugin-page-cover"/);
    r=spawnSync('python3',[stage,out,incoming,out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(readFileSync(join(out,'app.js'),'utf8'),app);assert.equal(readFileSync(join(out,'plugin-page.js'),'utf8'),page);
    const html=readFileSync(join(out,'index.html'),'utf8');assert.equal(html.split('src="plugin-rarity.js').length,2);assert.equal(html.split('href="plugin-rarity.css').length,2);assert.ok(html.indexOf('plugin-rarity.js')<html.indexOf('plugin-page.js'));assert.match(html,/https:\/\/api.zetslay.pro/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
