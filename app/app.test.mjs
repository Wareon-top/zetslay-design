import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, '');

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
  const elements = {
    '.connect-modal__body': body,
    '[data-connect-next]': action,
    '[data-connect-error]': error,
    '[data-connection-mode]': mode
  };
  return { body, action, error, querySelector: (selector) => elements[selector] ?? null, querySelectorAll: () => [] };
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
