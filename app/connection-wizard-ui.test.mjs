import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const ui = readFileSync(new URL('./connection-wizard-ui.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, '');
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const sourceModal = html.match(/<section class="connect-modal"[\s\S]*?<\/section>/)?.[0];
assert.ok(sourceModal, 'existing connection dialog must be present');

// Minimal deterministic DOM for exercising the real app renderer and presentation
// hooks. This tests transitions and API calls; it is not a visual browser test.
class Element {
  constructor(tag, document) { this.tagName = tag; this.ownerDocument = document; this.children = []; this.attributes = {}; this.style = {}; this.events = {}; this.value = ''; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  get content() { return this.attributes.content; }
  get dataset() { return new Proxy({}, { get: (_, key) => this.getAttribute('data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())), set: (_, key, value) => { this.setAttribute('data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), value); return true; } }); }
  get className() { return this.attributes.class || ''; }
  set className(value) { this.setAttribute('class', value); }
  get classList() {
    return { contains: value => this.className.split(/\s+/).includes(value), add: value => this.classList.toggle(value, true),
      toggle: (value, force) => { const classes = new Set(this.className.split(/\s+/).filter(Boolean)); const enabled = force ?? !classes.has(value); if (enabled) classes.add(value); else classes.delete(value); this.className = [...classes].join(' '); return enabled; } };
  }
  get hidden() { return 'hidden' in this.attributes; }
  set hidden(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  get disabled() { return 'disabled' in this.attributes; }
  set disabled(value) { if (value) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
  get isConnected() { return this === this.ownerDocument?.body || Boolean(this.parentElement?.isConnected); }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
  before(node) { node.remove(); const parent = this.parentElement; node.parentElement = parent; parent.children.splice(parent.children.indexOf(this), 0, node); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; }
  set innerHTML(value) {
    this.children.forEach(node => { node.parentElement = null; }); this.children = []; this.markup = value;
    const stack = [this];
    for (const part of value.matchAll(/<\/?[A-Za-z][^>]*>|[^<]+/g)) {
      const text = part[0];
      if (!text.startsWith('<')) continue;
      if (text.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      const tag = text.match(/^<(\w+)/)[1];
      const element = new Element(tag, this.ownerDocument);
      const attrs = text.slice(tag.length + 1).replace(/\/?\s*>$/, '');
      for (const match of attrs.matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)')?/g)) element.setAttribute(match[1], match[2] ?? match[3] ?? '');
      stack.at(-1).append(element);
      if (!['input', 'meta', 'link'].includes(tag) && !text.endsWith('/>')) stack.push(element);
    }
  }
  get innerHTML() { return this.markup || ''; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text || ''; }
  matches(selector) {
    if (selector.includes(' > ')) { const [parent, child] = selector.split(' > '); return this.matches(child) && this.parentElement?.matches(parent); }
    const not = [...selector.matchAll(/:not\(([^)]*)\)/g)].map(match => match[1]);
    if (not.some(item => this.matches(item))) return false;
    selector = selector.replace(/:not\([^)]*\)/g, '');
    const tag = selector.match(/^[\w-]+/)?.[0]; if (tag && tag !== this.tagName) return false;
    for (const match of selector.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(match[1])) return false;
    const id = selector.match(/#([\w-]+)/)?.[1]; if (id && this.getAttribute('id') !== id) return false;
    for (const match of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
      if (!(match[1] in this.attributes) || (match[2] !== undefined && this.attributes[match[1]] !== match[2])) return false;
    }
    return true;
  }
  querySelectorAll(selector) { return this.children.flatMap(node => [...(selector.split(',').some(item => node.matches(item.trim())) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  getClientRects() { return this.closest('[hidden]') ? [] : [{}]; }
  focus() { this.ownerDocument.activeElement = this; }
  addEventListener(event, listener) { (this.events[event] ||= []).push(listener); }
  dispatch(event, target = this, extra = {}) { const e = { target, preventDefault() { this.prevented = true; }, ...extra }; for (const listener of this.events[event] || []) listener(e); return e; }
}

function cabinet({ live = true, snapshot = null, step = 0 } = {}) {
  const document = { createElement: tag => new Element(tag, document), events: {},
    addEventListener(event, listener) { (this.events[event] ||= []).push(listener); },
    querySelector: selector => document.body.querySelector(selector), querySelectorAll: selector => document.body.querySelectorAll(selector) };
  document.body = new Element('body', document);
  document.body.innerHTML = `<meta name="zetslay-api-base-url" content="https://api.zetslay.pro"><button data-opener></button><div class="modal-backdrop"></div>${sourceModal}`;
  const modal = document.querySelector('.connect-modal');
  const context = vm.createContext({ document, location: { hostname: 'zetslay.pro', search: '', hash: '' }, URL, URLSearchParams,
    sessionStorage: { getItem: () => null, removeItem() {}, setItem() {} }, localStorage: { getItem: () => null, removeItem() {} },
    requestAnimationFrame: callback => callback(), setInterval: () => 1, clearInterval() {},
    window: { setTimeout() {}, matchMedia: () => ({ matches: true }) } });
  const run = code => vm.runInContext(code, context);
  run(app);
  context.savedSnapshot = snapshot;
  run(`authState.user=${live ? '{}' : 'null'}; state.onboarding=savedSnapshot; connectionStep=${step};`);
  run(ui);
  modal.hidden = false; modal.classList.add('is-open');
  run('renderConnectionWizard()');
  return { context, document, modal, run, buttons: () => modal.querySelectorAll('[data-connection-step]'),
    clickStep: index => modal.dispatch('click', modal.querySelectorAll('[data-connection-step]')[index]) };
}
const snapshot = (extra = {}) => ({ state: 'proxy_required', telegram: { botConfigured: true, linked: true },
  funPay: { credentialConfigured: true, proxyConfigured: false }, ...extra });

test('uses the screenshot-style stepper and wraps each renderer once', () => {
  const c = cabinet({ snapshot: snapshot(), step: 3 });
  assert.equal(c.buttons().length, 5);
  assert.equal(c.modal.querySelectorAll('.connection-visual').length, 1);
  c.run(ui); c.run('renderConnectionWizard()');
  assert.equal(c.modal.querySelectorAll('.connection-visual').length, 1);
  assert.equal(c.modal.querySelectorAll('[data-connect-next]').length, 1);
  assert.equal(c.modal.querySelectorAll('[data-connect-back]').length, 1);
  assert.equal(c.modal.querySelectorAll('[data-connect-reset]').length, 1);
});
test('completed markers come from saved state when returning to a previous step', () => {
  const c = cabinet({ snapshot: snapshot(), step: 0 });
  assert.deepEqual(c.buttons().map(button => button.classList.contains('is-saved')), [true, true, true, false, false]);
  assert.equal(c.buttons()[0].getAttribute('aria-current'), 'step');
  assert.equal(c.buttons()[3].disabled, false);
  assert.equal(c.buttons()[4].disabled, true);
  assert.equal(c.modal.querySelector('[data-connection-saved]').textContent, 'Сохранено 3 из 5');
});
test('future steps cannot bypass Telegram or the tariff', () => {
  for (const state of [null, { state: 'plan_required' }, { state: 'telegram_bot_pending', telegram: {}, funPay: {} }]) {
    const c = cabinet({ snapshot: state });
    c.clickStep(4);
    assert.equal(c.run('connectionStep'), 0);
    assert.ok(c.buttons().slice(1).every(button => button.disabled));
  }
});
test('busy, loading, failed status and reset confirmation disable every jump', () => {
  for (const assignment of ['connectionBusy=true', 'connectionLoading=true', 'connectionLoadFailed=true', "connectionResetTarget='proxy'"]) {
    const c = cabinet({ snapshot: snapshot(), step: 3 });
    c.run(assignment + '; renderConnectionWizard()');
    assert.ok(c.buttons().every(button => button.disabled));
    c.clickStep(0); assert.equal(c.run('connectionStep'), 3);
  }
});
test('unknown status never claims saved steps or an active connection', () => {
  const c = cabinet({ snapshot: snapshot({ state: 'connected_read_only', funPay: { credentialConfigured: true, proxyConfigured: true, store: { id: '1' } } }), step: 4 });
  c.run('connectionLoadFailed=true; renderConnectionWizard()');
  assert.ok(c.buttons().every(button => !button.classList.contains('is-saved')));
  assert.equal(c.modal.querySelector('[data-connection-summary]').textContent, 'Повторите загрузку');
});
test('saved proxy is not presented as successful shop verification', () => {
  const c = cabinet({ snapshot: snapshot({ funPay: { credentialConfigured: true, proxyConfigured: true } }), step: 4 });
  assert.equal(c.buttons()[4].classList.contains('is-saved'), false);
  assert.equal(c.modal.querySelector('[data-connection-summary]').textContent, 'Настройка подключения');
  assert.match(c.modal.querySelector('[data-connect-next]').innerHTML, /Запустить read-only проверку/);
});
test('a verified shop completes all five markers and keeps the saved secrets hidden', () => {
  const c = cabinet({ snapshot: snapshot({ state: 'connected_read_only', funPay: { credentialConfigured: true, proxyConfigured: true, store: { id: '1' } } }), step: 4 });
  assert.ok(c.buttons().every(button => button.classList.contains('is-saved')));
  assert.equal(c.modal.querySelector('[data-connection-summary]').textContent, 'Магазин подключён');
  c.clickStep(2);
  assert.equal(c.run('connectionStep'), 2);
  assert.equal(c.modal.querySelector('input[name="goldenKey"]'), null);
  assert.equal(c.buttons()[4].classList.contains('is-saved'), true);
});
test('blocked credentials restrict navigation to the backend-approved frontier', () => {
  const c = cabinet({ snapshot: snapshot({ state: 'blocked', funPay: { credentialConfigured: true, proxyConfigured: true, canRetryPreflight: false } }), step: 2 });
  assert.equal(c.buttons()[3].disabled, true);
  c.clickStep(4); assert.equal(c.run('connectionStep'), 2);
});
test('navigation and back do not send requests or reset stored settings', () => {
  const c = cabinet({ snapshot: snapshot(), step: 3 });
  c.context.apiRequest = () => { throw new Error('navigation must not contact API'); };
  c.clickStep(0); assert.equal(c.run('connectionStep'), 0);
  c.clickStep(3); c.run('backConnectionWizard()');
  assert.equal(c.run('connectionStep'), 2);
  assert.equal(c.run('state.onboarding.funPay.credentialConfigured'), true);
});
test('submitting the proxy still calls the existing authenticated route and clears the secret', async () => {
  const c = cabinet({ snapshot: snapshot(), step: 3 });
  c.context.showToast = () => {};
  const field = c.modal.querySelector('input[name="proxyUrl"]'); field.value = 'http://test:test@proxy.test:8000';
  const calls = [];
  c.context.apiRequest = async (path, options) => { calls.push({ path, options }); return snapshot({ state: 'verifying_read_only', funPay: { credentialConfigured: true, proxyConfigured: true } }); };
  await c.run('advanceConnectionWizard()');
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/api/v1/onboarding/funpay/proxy');
  assert.equal(calls[0].options.authenticated, true); assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.body.proxyUrl, 'http://test:test@proxy.test:8000');
  assert.equal(c.run('connectionStep'), 4); assert.equal(c.run('connectionBusy'), false);
  assert.equal(c.modal.querySelector('input'), null);
});
test('request failure preserves an actionable current step and a visible error', async () => {
  const c = cabinet({ snapshot: snapshot(), step: 3 });
  c.context.showToast = () => {};
  c.modal.querySelector('input[name="proxyUrl"]').value = 'http://proxy.test:8000';
  c.context.apiRequest = async () => { throw new Error('Прокси не ответил'); };
  await c.run('advanceConnectionWizard()');
  assert.equal(c.run('connectionStep'), 3); assert.equal(c.modal.querySelector('[data-connect-error]').hidden, false);
  assert.equal(c.modal.querySelector('[data-connect-error]').textContent, 'Прокси не ответил');
  assert.equal(c.modal.querySelector('[data-connect-next]').disabled, false);
});
test('closing wipes unsubmitted fields and returns focus to the opener', () => {
  const c = cabinet({ snapshot: snapshot(), step: 3 });
  const opener = c.document.querySelector('[data-opener]'); opener.focus();
  c.modal.hidden = true;
  c.context.loadOnboarding = async () => {};
  c.run('connectionLoading=true; setModal(true); connectionLoading=false; connectionStep=3; renderConnectionWizard()');
  const field = c.modal.querySelector('input'); field.value = 'not-to-be-retained'; field.focus();
  c.run('setModal(false)');
  assert.equal(field.value, ''); assert.equal(c.document.activeElement, opener);
});
test('keyboard focus stays in the dialog and Escape cannot interrupt an in-flight write', () => {
  const c = cabinet({ snapshot: snapshot(), step: 3 });
  const key = extra => { const event = { preventDefault() { this.prevented = true; }, ...extra }; for (const fn of c.document.events.keydown) fn(event); return event; };
  const focusables = c.modal.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]').filter(node => !node.closest('[hidden]'));
  focusables.at(-1).focus(); key({ key: 'Tab', shiftKey: false });
  assert.equal(c.document.activeElement, focusables[0]);
  key({ key: 'Tab', shiftKey: true }); assert.equal(c.document.activeElement, focusables.at(-1));
  c.run('connectionBusy=true; renderConnectionWizard()'); key({ key: 'Escape' });
  assert.equal(c.modal.classList.contains('is-open'), true);
  c.run('connectionBusy=false'); key({ key: 'Escape' });
  assert.equal(c.modal.classList.contains('is-open'), false);
});
test('demo keeps its four real demonstration stages, not five live form stages', () => {
  const c = cabinet({ live: false });
  assert.equal(c.buttons().length, 4);
  c.clickStep(3);
  assert.equal(c.run('connectionStep'), 3);
  assert.equal(c.modal.querySelector('input'), null);
  assert.match(c.modal.querySelector('[data-connect-next]').innerHTML, /Закрыть демонстрацию/);
});
test('step titles are fixed presentation text; account data cannot inject markup', () => {
  const c = cabinet({ snapshot: snapshot({ telegram: { botConfigured: true, linked: true, bot: { username: '<img onerror=attack>' } } }), step: 0 });
  assert.equal(c.modal.querySelector('[data-connection-visual-label]').textContent, 'Telegram-бот');
  assert.doesNotMatch(c.modal.querySelector('.connect-modal__body').innerHTML, /<img onerror/);
});
