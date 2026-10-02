import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, '');

test('curl diagnostics names the connector client and does not invent a CONNECT stage', () => {
  const app = cabinet();
  const html = app.run(`formatProxyDiagnostics({endpoint:'proxy.test:8000',configuredProtocol:'http',client:'curl',results:[{protocol:'http',client:'curl',target:'funpay.com',ok:false,stage:'curl_request',code:'TIMEOUT'}]})`);
  assert.match(html, /Клиент коннектора: curl/);
  assert.match(html, /HTTP · curl · funpay.com/);
  assert.match(html, /этап не подтверждён/);
  assert.ok(!html.includes('Туннель CONNECT'));
  assert.ok(!html.includes('SOCKS5 отвечает'));
});

test('curl diagnostic preserves non-success HTTP status and escapes diagnostic text', () => {
  const app = cabinet();
  const html = app.run(`formatProxyDiagnostics({endpoint:'<private>',configuredProtocol:'https',client:'curl',results:[{protocol:'https',client:'curl',target:'funpay.com',ok:false,stage:'target_http',code:'HTTP_STATUS',targetStatus:403}]})`);
  assert.match(html, /Ответ сайта: HTTP 403/);
  assert.match(html, /&lt;private&gt;/);
  assert.ok(!html.includes('<private>'));
});

function cabinet({ search = '', token = '', modal = null } = {}) {
  const calls = [];
  const history = [];
  const storage = new Map(token ? [['zetslay_session', token]] : []);
  const location = { hostname: 'zetslay.pro', search, href: `https://zetslay.pro/app/${search}`, hash: '' };
  const document = {
    querySelector(selector) {
      if (selector === 'meta[name="zetslay-api-base-url"]') return { content: 'https://api.zetslay.pro' };
      if (selector === '.connect-modal') return modal;
      return null;
    },
    querySelectorAll() { return []; },
    body: { classList: { toggle() {} } }
  };
  const context = vm.createContext({
    URL, URLSearchParams, location, document,
    sessionStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    localStorage: { getItem: () => null, removeItem() {} },
    history: { replaceState: (_state, _title, url) => history.push(url) },
    requestAnimationFrame: (callback) => callback(),
    setInterval: () => 1,
    clearInterval: () => {},
    window: { setTimeout() {} },
    calls
  });
  vm.runInContext(source, context);
  return { context, calls, history, run: (code) => vm.runInContext(code, context) };
}

function fakeModal() {
  const body = { innerHTML: '' };
  const action = { innerHTML: '', disabled: false };
  const error = { textContent: '', hidden: true };
  const mode = { textContent: '' };
  const back = { hidden: true, disabled: false };
  const fields = new Map();
  const elements = {
    '.connect-modal__body': body,
    '[data-connect-next]': action,
    '[data-connect-error]': error,
    '[data-connection-mode]': mode,
    '[data-connect-back]': back
  };
  return { body, action, error, back, hidden: false, fields, classList: { toggle() {}, contains: () => false },
    querySelector: (selector) => elements[selector] ?? fields.get(selector) ?? null, querySelectorAll: () => [] };
}

test('existing session returns from landing to cabinet without showing the sign-in panel', async () => {
  const app = cabinet({ search: '?auth=login', token: 'existing-session' });
  app.context.apiRequest = async (path) => {
    assert.equal(path, '/api/v1/me');
    return { user: { email: 'seller@example.com' }, workspace: { plan: { active: false } } };
  };
  app.context.renderAuthState = () => {};
  app.context.loadAccountData = async () => {};
  app.context.setAuthModal = (open) => app.calls.push(['modal', open]);
  app.context.verifyEmailFromUrl = async () => {};
  await app.run('initializeAuthFlow()');
  assert.deepEqual(app.calls, [['modal', false]]);
  assert.deepEqual(app.history, ['/app/']);
  assert.equal(app.run('authState.user.email'), 'seller@example.com');
});

test('registration link opens registration when there is no saved session', async () => {
  const app = cabinet({ search: '?auth=register' });
  app.context.renderAuthState = () => {};
  app.context.setAuthModal = (open) => app.calls.push(['modal', open]);
  app.context.setAuthMode = (mode) => app.calls.push(['mode', mode]);
  app.context.verifyEmailFromUrl = async () => {};
  await app.run('initializeAuthFlow()');
  assert.deepEqual(app.calls, [['modal', true], ['mode', 'register'], ['modal', true]]);
});

test('expired session opens login instead of keeping a stale account panel', async () => {
  const app = cabinet({ search: '?auth=login', token: 'expired-session' });
  app.context.apiRequest = async () => { throw new Error('expired'); };
  app.context.resetAccountData = () => {};
  app.context.renderAuthState = () => {};
  app.context.setAuthModal = (open) => app.calls.push(['modal', open]);
  app.context.setAuthMode = (mode) => app.calls.push(['mode', mode]);
  app.context.verifyEmailFromUrl = async () => {};
  await app.run('initializeAuthFlow()');
  assert.equal(app.run('authState.user'), null);
  assert.equal(app.context.sessionStorage.getItem('zetslay_session'), null);
  assert.deepEqual(app.calls.at(-2), ['mode', 'login']);
  assert.deepEqual(app.calls.at(-1), ['modal', true]);
});

test('demo activation uses the API response to advance directly to the bot step', async () => {
  const modal = fakeModal();
  const app = cabinet({ token: 'session', modal });
  app.run('authState.user = { email: "seller@example.com" }; serviceBotUsername = "zetslay_bot"');
  app.context.renderTelegramOnboarding = () => {};
  app.context.renderDashboard = () => {};
  app.context.showToast = () => {};
  app.context.apiRequest = async (path) => {
    if (path === '/api/v1/onboarding') return { state: 'plan_required', demoPlanAvailable: true, telegram: {}, funPay: {} };
    assert.equal(path, '/api/v1/onboarding/demo-plan');
    return {
      workspace: { plan: { id: 'pro_demo', active: true } },
      onboarding: { state: 'telegram_bot_pending', demoPlanAvailable: true, telegram: {}, funPay: {} }
    };
  };
  await app.run('refreshConnectionWizard()');
  assert.match(modal.action.innerHTML, /Активировать демо-тариф/);
  await app.run('advanceConnectionWizard()');
  assert.equal(app.run('authState.workspace.plan.active'), true);
  assert.equal(app.run('state.onboarding.state'), 'telegram_bot_pending');
  assert.match(modal.action.innerHTML, /Сохранить Bot Token/);
  assert.equal(modal.error.hidden, true);
});

test('failed onboarding status provides a retry instead of a disabled tariff button', async () => {
  const modal = fakeModal();
  const app = cabinet({ token: 'session', modal });
  app.run('authState.user = { email: "seller@example.com" }; serviceBotUsername = "zetslay_bot"');
  app.context.renderTelegramOnboarding = () => {};
  let requests = 0;
  app.context.apiRequest = async () => {
    if (++requests === 1) throw new Error('Временная ошибка API');
    return { state: 'plan_required', demoPlanAvailable: true, telegram: {}, funPay: {} };
  };
  await app.run('refreshConnectionWizard()');
  assert.equal(modal.action.disabled, false);
  assert.match(modal.action.innerHTML, /Повторить загрузку/);
  assert.match(modal.error.textContent, /Временная ошибка API/);
  await app.run('advanceConnectionWizard()');
  assert.match(modal.action.innerHTML, /Активировать демо-тариф/);
  assert.equal(modal.error.hidden, true);
});

test('demo activation failure remains visible inside the connection wizard', async () => {
  const modal = fakeModal();
  const app = cabinet({ token: 'session', modal });
  app.run('authState.user = { email: "seller@example.com" }; state.onboarding = { state: "plan_required", demoPlanAvailable: true, telegram: {}, funPay: {} }');
  app.context.showToast = () => {};
  app.context.apiRequest = async () => { throw new Error('Демо-активация отключена на сервере'); };
  await app.run('advanceConnectionWizard()');
  assert.equal(app.run('state.onboarding.state'), 'plan_required');
  assert.match(modal.error.textContent, /Демо-активация отключена/);
  assert.equal(modal.error.hidden, false);
  assert.equal(modal.action.disabled, false);
});

test('late onboarding response cannot roll back an activated plan', async () => {
  const app = cabinet({ token: 'session', modal: fakeModal() });
  app.run('authState.user = { email: "seller@example.com" }; serviceBotUsername = "zetslay_bot"; state.onboarding = { state: "plan_required", demoPlanAvailable: true, telegram: {}, funPay: {} }');
  app.context.renderTelegramOnboarding = () => {};
  app.context.renderDashboard = () => {};
  app.context.showToast = () => {};
  let resolveOldStatus;
  const oldStatus = new Promise((resolve) => { resolveOldStatus = resolve; });
  app.context.apiRequest = async (path) => path === '/api/v1/onboarding' ? oldStatus : {
    workspace: { plan: { active: true } },
    onboarding: { state: 'telegram_bot_required', demoPlanAvailable: true, telegram: {}, funPay: {} }
  };
  const pending = app.run('loadOnboarding()');
  await app.run('advanceConnectionWizard()');
  resolveOldStatus({ state: 'plan_required', demoPlanAvailable: true, telegram: {}, funPay: {} });
  await pending;
  assert.equal(app.run('state.onboarding.state'), 'telegram_bot_required');
  assert.equal(app.run('authState.workspace.plan.active'), true);
});

test('failed Bot Token save stays on the first step and displays the cause', async () => {
  const modal = fakeModal();
  modal.fields.set('input[name="botToken"]', { value: 'example-bot-token' });
  const app = cabinet({ token: 'session', modal });
  app.run('authState.user = { email: "seller@example.com" }; state.onboarding = { state: "telegram_bot_required", telegram: {}, funPay: {} }');
  app.context.showToast = () => {};
  app.context.apiRequest = async () => { throw new Error('Telegram отклонил регистрацию webhook'); };
  await app.run('advanceConnectionWizard()');
  assert.equal(app.run('connectionStep'), 0);
  assert.match(modal.error.textContent, /webhook/);
  assert.equal(modal.back.hidden, true);
});

test('issuing a code repairs webhook first and retains the code after closing', async () => {
  const modal = fakeModal();
  const app = cabinet({ token: 'session', modal });
  app.run('authState.user = { email: "seller@example.com" }; state.onboarding = { workspaceId: "w1", state: "telegram_link_pending", telegram: { botConfigured: true, bot: { username: "seller_bot" } }, funPay: {} }; connectionStep = 1');
  app.context.showToast = () => {};
  app.context.apiRequest = async (path) => {
    app.calls.push(path);
    if (path.endsWith('/webhook')) return app.run('state.onboarding');
    if (path === '/api/v1/onboarding') return app.run('state.onboarding');
    assert.equal(path, '/api/v1/onboarding/telegram/link-code');
    return { code: '167057', expiresAt: new Date(Date.now() + 600000).toISOString(), onboarding: app.run('state.onboarding') };
  };
  await app.run('advanceConnectionWizard()');
  assert.deepEqual(app.calls, ['/api/v1/onboarding/telegram/webhook', '/api/v1/onboarding/telegram/link-code']);
  assert.match(modal.body.innerHTML, /\/start 167057/);
  assert.match(modal.body.innerHTML, /t\.me\/seller_bot\?start=167057/);
  app.run('setModal(false)');
  app.run('setModal(true)');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.run('connectionStatus.linkCode'), '167057');
  assert.equal(modal.back.hidden, false);
});

test('Back goes to bot replacement and lets the user return to the same code', () => {
  const modal = fakeModal();
  const app = cabinet({ token: 'session', modal });
  app.run(`authState.user = { email: "seller@example.com" }; state.onboarding = { workspaceId: "w1", state: "telegram_link_pending", telegram: { botConfigured: true, bot: { username: "seller_bot" } }, funPay: {} }; connectionStep = 1; connectionStatus = { workspaceId: "w1", linkCode: "167057", expiresAt: new Date(Date.now() + 600000).toISOString() }`);
  app.run('backConnectionWizard()');
  assert.equal(app.run('connectionStep'), 0);
  assert.match(modal.body.innerHTML, /Заменить Telegram-бота/);
  assert.match(modal.body.innerHTML, /data-connect-return/);
  app.run('connectionStep = 1; renderConnectionWizard()');
  assert.match(modal.body.innerHTML, /\/start 167057/);
});

test('an expired code is hidden and the next click requests a new one', async () => {
  const modal = fakeModal();
  const app = cabinet({ token: 'session', modal });
  app.run('authState.user = { email: "seller@example.com" }; state.onboarding = { workspaceId: "w1", state: "telegram_link_pending", telegram: { botConfigured: true }, funPay: {} }; connectionStep = 1; connectionStatus = { workspaceId: "w1", linkCode: "167057", expiresAt: "2000-01-01T00:00:00.000Z" }');
  app.context.showToast = () => {};
  app.context.apiRequest = async (path) => {
    app.calls.push(path);
    if (path.endsWith('/webhook')) return app.run('state.onboarding');
    return { code: '837462', expiresAt: new Date(Date.now() + 600000).toISOString(), onboarding: app.run('state.onboarding') };
  };
  app.run('renderConnectionWizard()');
  assert.doesNotMatch(modal.body.innerHTML, /167057/);
  await app.run('advanceConnectionWizard()');
  assert.equal(app.run('connectionStatus.linkCode'), '837462');
  assert.deepEqual(app.calls, ['/api/v1/onboarding/telegram/webhook', '/api/v1/onboarding/telegram/link-code']);
});

test('Telegram page links to the seller bot only after a valid code is issued', () => {
  const app = cabinet({ token: 'session' });
  const codeNode = { textContent: '' };
  const deepLink = { href: '', style: {} };
  app.context.document.querySelector = (selector) => ({
    '[data-tg-code]': codeNode,
    '[data-tg-deep-link]': deepLink
  })[selector] ?? null;
  app.run('state.onboarding = { workspaceId: "w1", telegram: { botConfigured: true, bot: { username: "seller_bot" } } }; serviceBotUsername = "zetslay_service_bot"');
  app.run('renderTelegramOnboarding()');
  assert.equal(codeNode.textContent, '——');
  assert.equal(deepLink.style.display, 'none');
  app.run('connectionStatus = { workspaceId: "w1", linkCode: "167057", expiresAt: new Date(Date.now() + 600000).toISOString() }; renderTelegramOnboarding()');
  assert.equal(deepLink.href, 'https://t.me/seller_bot?start=167057');
  assert.equal(deepLink.style.display, '');
});


test('changing proxy requires confirmation and returns to an editable proxy step', async () => {
  const modal = fakeModal();
  const app = cabinet({ token: 'session', modal });
  app.run('authState.user = { email: "seller@example.com" }; state.onboarding = { state: "verifying_read_only", telegram: { botConfigured: true, linked: true }, funPay: { credentialConfigured: true, proxyConfigured: true } }; connectionStep = 4');
  app.context.showToast = () => {};
  app.context.apiRequest = async (path, options) => {
    app.calls.push(path);
    assert.equal(path, '/api/v1/onboarding/reset');
    assert.equal(options.body.target, 'proxy');
    assert.equal(options.body.confirmed, true);
    return { state: 'proxy_required', telegram: { botConfigured: true, linked: true }, funPay: { credentialConfigured: true, proxyConfigured: false } };
  };
  app.run('renderConnectionWizard()');
  assert.match(modal.body.innerHTML, /data-connect-edit="proxy"/);
  app.run('beginConnectionReset("proxy")');
  assert.equal(app.calls.length, 0);
  assert.match(modal.body.innerHTML, /Golden Key и привязка Telegram сохранятся/);
  await app.run('advanceConnectionWizard()');
  assert.equal(app.run('connectionStep'), 3);
  assert.match(modal.body.innerHTML, /name="proxyUrl"/);
});

test('Back cancels reset and failed reset retains confirmation with an inline error', async () => {
  const modal = fakeModal();
  const app = cabinet({ token: 'session', modal });
  app.run('authState.user = {}; state.onboarding = { state: "verifying_read_only", telegram: { linked: true }, funPay: { credentialConfigured: true, proxyConfigured: true } }; connectionStep = 4');
  app.run('beginConnectionReset("all"); backConnectionWizard()');
  assert.equal(app.run('connectionResetTarget'), null);
  assert.equal(app.run('connectionStep'), 4);
  app.context.apiRequest = async () => { throw new Error('Удаление не выполнено'); };
  app.run('beginConnectionReset("all")');
  await app.run('advanceConnectionWizard()');
  assert.equal(app.run('connectionResetTarget'), 'all');
  assert.match(modal.error.textContent, /Удаление не выполнено/);
  assert.equal(app.run('state.onboarding.funPay.proxyConfigured'), true);
});

test('plugin category, search and numeric price sorting work together without changing source order', () => {
  const app = cabinet();
  app.run(`state.plugins = [
    {id:'a',name:'Первый',description:'ответ',category:'chat',priceRub:900},
    {id:'b',name:'Второй',description:'ответ',category:'chat',priceRub:100},
    {id:'c',name:'Третий',description:'заказ',category:'sales',priceRub:0}
  ]`);
  assert.equal(app.run(`filterPluginCatalog(state.plugins,{cat:'chat',query:'ОТВЕТ',sort:'price-asc'}).map(p=>p.id).join(',')`), 'b,a');
  assert.equal(app.run(`filterPluginCatalog(state.plugins,{cat:'all',query:'',sort:'price-desc'}).map(p=>p.id).join(',')`), 'a,b,c');
  assert.equal(app.run('state.plugins.map(p=>p.id).join(",")'), 'a,b,c');
});

test('plugin description supports bold and quotes but escapes HTML and script attributes', () => {
  const app = cabinet();
  const html = app.run(`formatPluginDescription('**Важно**\\n> Цитата\\n<img src=x onerror=alert(1)>')`);
  assert.ok(html.includes('<strong>Важно</strong>'));
  assert.ok(html.includes('<blockquote>Цитата</blockquote>'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
});

test('non-admin cannot open publishing editor or save metadata through UI', async () => {
  const app = cabinet();
  app.run(`apiRequest = async () => { calls.push('write'); }; state.pluginCanManage = false;`);
  app.run('openPluginEditor()');
  await assert.rejects(app.run(`saveCatalogEntry({id:'test'})`), /администратору/);
  assert.equal(app.calls.length, 0);
});

test('catalog capabilities and runtime state are loaded from the backend', async () => {
  const app = cabinet({ token: 'test-token' });
  app.run(`renderPlugins = () => {};
    apiRequest = async () => ({canManage:true,entries:[
      {id:'zetslay.test',name:'Тест',category:'chat',priceRub:99,description:'Описание',permissions:['messages:read'],planned:true,published:true,installation:null}
    ]});`);
  await app.run('loadPluginCatalog()');
  assert.equal(app.run('state.pluginCanManage'), true);
  assert.equal(app.run('state.plugins[0].id'), 'zetslay.test');
  assert.equal(app.run('state.plugins[0].planned'), true);
  assert.equal(app.run('state.plugins[0].installed'), false);
});

test('late catalog response cannot restore admin capabilities after session change', async () => {
  const app = cabinet({ token: 'admin-token' });
  app.run(`renderPlugins = () => {};
    apiRequest = () => new Promise(resolve => { globalThis.resolveCatalog = resolve; });`);
  const pending = app.run('loadPluginCatalog()');
  app.run(`authState.token = 'user-token'; state.pluginCanManage = false; resolveCatalog({canManage:true,entries:[]});`);
  await pending;
  assert.equal(app.run('state.pluginCanManage'), false);
});

test('admin controls are hidden for users and names remain escaped in card HTML', () => {
  const app = cabinet();
  app.run(`globalThis.grid = {innerHTML:''}; globalThis.controls = [{hidden:false},{hidden:false}];
    document.getElementById = id => id === 'plugin-grid' ? grid : null;
    document.querySelectorAll = selector => selector.includes('data-plugin-cover-admin') ? controls : [];
    state.plugins = [{id:'test',name:'<img src=x>',description:'**Текст**',permissions:[],category:'chat',price:'Бесплатно',planned:true}];
    state.pluginCanManage = false; renderPlugins();`);
  assert.equal(app.run('controls.every(button=>button.hidden)'), true);
  assert.ok(app.run('grid.innerHTML').includes('&lt;img src=x&gt;'));
  assert.ok(!app.run('grid.innerHTML').includes('<img src=x>'));
  app.run('state.pluginCanManage = true; renderPlugins()');
  assert.equal(app.run('controls.every(button=>!button.hidden)'), true);
});

test('latest catalog request wins when responses arrive out of order', async () => {
  const app = cabinet({ token: 'test-token' });
  app.run(`renderPlugins = () => {}; globalThis.pendingCatalog = [];
    apiRequest = () => new Promise(resolve=>pendingCatalog.push(resolve));`);
  const first = app.run('loadPluginCatalog()');
  const second = app.run('loadPluginCatalog()');
  app.run(`pendingCatalog[1]({canManage:false,entries:[{id:'new',name:'Новое',description:'',permissions:[],priceRub:0}]});`);
  await second;
  app.run('pendingCatalog[0]({canManage:true,entries:[]})');
  await first;
  assert.equal(app.run('state.plugins[0].id'), 'new');
  assert.equal(app.run('state.pluginCanManage'), false);
});

test('proxy diagnostics shows stages without claiming the store is authenticated', () => {
  const app = cabinet();
  const html = app.run(`formatProxyDiagnostics({endpoint:'proxy.test:8000',results:[
    {protocol:'http',target:'funpay.com',ok:false,stage:'proxy_connect',code:'TIMEOUT'},
    {protocol:'https',target:'example.com',ok:true,targetStatus:200}
  ]})`);
  assert.match(html, /Туннель CONNECT: таймаут/);
  assert.match(html, /HTTP 200/);
  assert.match(html, /ещё не означает, что магазин привязан/);
  assert.match(html, /без Golden Key/);
});

test('proxy diagnostics cannot mutate onboarding and suppresses duplicate requests', async () => {
  const modal = fakeModal();
  const app = cabinet({ token: 'session', modal });
  app.run(`authState.user = {}; state.onboarding = {state:'verifying_read_only',funPay:{proxyConfigured:true,credentialConfigured:true},telegram:{linked:true}}; connectionStep = 4;
    apiRequest = (path, options) => { calls.push({path,options}); return new Promise(resolve=>{globalThis.resolveProbe=resolve;}); };`);
  const pending = app.run('diagnoseConnectionProxy()');
  await app.run('diagnoseConnectionProxy()');
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].path, '/api/v1/onboarding/proxy-diagnostics');
  app.run(`resolveProbe({endpoint:'proxy.test:8000',results:[{protocol:'http',target:'funpay.com',ok:false,stage:'proxy_connect',code:'TIMEOUT'}]})`);
  await pending;
  assert.equal(app.run('state.onboarding.state'), 'verifying_read_only');
  assert.equal(app.run('connectionBusy'), false);
  assert.match(modal.body.innerHTML, /Диагностика прокси/);
  assert.match(modal.body.innerHTML, /Туннель CONNECT: таймаут/);
});

test('proxy diagnostic errors stay inside the wizard and release the busy state', async () => {
  const app = cabinet({ token: 'session', modal: fakeModal() });
  app.run(`authState.user={}; state.onboarding={funPay:{proxyConfigured:true}}; apiRequest=async()=>{throw new Error('Проверка временно недоступна');};`);
  await app.run('diagnoseConnectionProxy()');
  assert.equal(app.run('connectionBusy'), false);
  assert.equal(app.run('connectionError'), 'Проверка временно недоступна');
});

test('late proxy diagnostic response is ignored after account change', async () => {
  const app = cabinet({ token: 'session', modal: fakeModal() });
  app.run(`authState.user={}; state.onboarding={funPay:{proxyConfigured:true}}; apiRequest=()=>new Promise(resolve=>{globalThis.resolveProbe=resolve;});`);
  const pending = app.run('diagnoseConnectionProxy()');
  app.run(`authState.token='other-session'; state.proxyDiagnostics=null; resolveProbe({endpoint:'old-proxy:8000',results:[]});`);
  await pending;
  assert.equal(app.run('state.proxyDiagnostics'), null);
});


test('diagnostics suggests explicit SOCKS5 selection without changing saved credentials or scheme', () => {
  const app = cabinet();
  const html = app.run(`formatProxyDiagnostics({endpoint:'proxy.test:8000',configuredProtocol:'http',results:[{protocol:'socks5',target:'funpay.com',ok:true,targetStatus:200}]})`);
  assert.match(html, /SOCKS5 отвечает/);
  assert.match(html, /Изменить прокси/);
  assert.match(html, /socks5:\/\//);
  const alreadySelected = app.run(`formatProxyDiagnostics({endpoint:'proxy.test:8000',configuredProtocol:'socks5',results:[{protocol:'socks5',target:'funpay.com',ok:true,targetStatus:200}]})`);
  assert.ok(!alreadySelected.includes('SOCKS5 отвечает'));
});


test('diagnostics keeps a working saved protocol and does not recommend SOCKS solely from example.com', () => {
  const app=cabinet();
  const working=app.run(`formatProxyDiagnostics({endpoint:'proxy.test:8000',configuredProtocol:'http',results:[{protocol:'http',target:'funpay.com',ok:true,targetStatus:200},{protocol:'socks5',target:'funpay.com',ok:true,targetStatus:200}]})`);
  assert.match(working,/Сохранённый протокол: HTTP/);
  assert.ok(!working.includes('SOCKS5 отвечает'));
  const partial=app.run(`formatProxyDiagnostics({endpoint:'proxy.test:8000',configuredProtocol:'http',results:[{protocol:'socks5',target:'example.com',ok:true,targetStatus:200}]})`);
  assert.ok(!partial.includes('SOCKS5 отвечает'));
});
