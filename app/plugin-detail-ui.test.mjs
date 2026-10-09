import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const addon = ['plugin-cover.js', 'plugin-rarity.js', 'plugin-page.js'].map(name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')).join('\n');
const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, '');
const ui = readFileSync(new URL('./plugin-detail-ui.js', import.meta.url), 'utf8');
const fixture = (patch = {}) => ({ id: 'zetslay.test-plugin', name: 'Тестовый модуль', category: 'sales',
  description: 'Краткое описание.\n\n**Первая возможность**\nВажный текст.\n\n**Как начать**\n1. Включите модуль.\n2. Настройте.',
  price: 'Бесплатно', permissions: ['orders:read', 'replies:queue'], events: ['order.paid'],
  published: true, planned: false, installed: false, active: false, ...patch });

function cabinet({ admin = false, entry = fixture() } = {}) {
  const page = { innerHTML: '', contains: node => allowed.has(node) };
  const allowed = new Set();
  const targets = new Map();
  const listeners = {};
  const location = { hash: '#plugins/' + entry.id, search: '', hostname: 'zetslay.pro' };
  const document = { body: { classList: { toggle() {} } }, title: '',
    querySelector: selector => selector === '[data-plugin-page]' ? page : selector === 'meta[name="zetslay-api-base-url"]' ? { content: 'https://api.zetslay.pro' } : null,
    querySelectorAll: () => [], getElementById: id => targets.get(id) || null,
    addEventListener: (type, listener) => { (listeners[type] ||= []).push(listener); } };
  const context = vm.createContext({ document, location, URL, URLSearchParams,
    localStorage: { getItem: () => null, removeItem() {} }, sessionStorage: { getItem: () => 'session', removeItem() {} },
    window: { setTimeout() {}, matchMedia: () => ({ matches: true }) }, history: { replaceState() {} } });
  const run = code => vm.runInContext(code, context);
  run(addon + '\n' + source);
  context.entry = entry;
  run(`authState.user={telegramUserId:'${admin ? '5062414502' : '123456789'}'}; state.pluginCanManage=${admin}; state.plugins=[entry]; pluginPageState.loaded=true; pluginPageState.generation=sessionGeneration;`);
  run(ui);
  return { context, page, run, location, listeners, targets, allowed };
}

test('detail view adds catalog-derived facts, structured sections and contents without a banner', () => {
  const c = cabinet();
  assert.match(c.page.innerHTML, /plugin-detail-facts/);
  assert.match(c.page.innerHTML, /2 разрешения/);
  assert.match(c.page.innerHTML, /plugin-detail-toc/);
  assert.match(c.page.innerHTML, /<h3[^>]+>Первая возможность<\/h3>/);
  assert.match(c.page.innerHTML, /<ol>/);
  assert.doesNotMatch(c.page.innerHTML, /<figure|plugin-page-cover/);
  assert.match(c.page.innerHTML, /Краткое описание\./);
});
test('ordinary users never gain catalog administration through the new presentation', () => {
  const c = cabinet();
  assert.doesNotMatch(c.page.innerHTML, /data-plugin-edit|data-cover-plugin|data-plugin-publish/);
  const owner = cabinet({ admin: true });
  assert.match(owner.page.innerHTML, /data-plugin-edit/);
  assert.match(owner.page.innerHTML, /data-cover-plugin/);
});
test('install, enable, disable, pending state and action errors remain owned by the original page', () => {
  for (const [patch, label] of [[{}, 'Установить и включить'], [{ installed: true }, 'Включить плагин'], [{ installed: true, active: true }, 'Отключить плагин']]) {
    const c = cabinet({ entry: fixture(patch) });
    assert.match(c.page.innerHTML, new RegExp(label));
    c.run("pluginPageState.busyId=entry.id; pluginPageState.actionErrorId=entry.id; pluginPageState.actionError='Ошибка проверки'; renderPluginPage()");
    assert.match(c.page.innerHTML, /aria-busy="true"/);
    assert.match(c.page.innerHTML, /disabled/);
    assert.match(c.page.innerHTML, /Ошибка проверки/);
  }
});
test('existing reminder settings markup and settings button are preserved', () => {
  const c = cabinet({ entry: fixture({ id: 'zetslay.confirm-reminder', installed: true }) });
  c.run(`reminderSettingsMarkup=()=>'<section data-reminder-settings><form data-reminder-form><textarea name="firstText">Сохранённый текст</textarea></form></section>'; renderPluginPage()`);
  assert.match(c.page.innerHTML, /data-reminder-form/);
  assert.match(c.page.innerHTML, /Сохранённый текст/);
  assert.match(c.page.innerHTML, /data-reminder-open-settings/);
});
test('Kosell settings remain a separate unmodified operational panel', () => {
  const c = cabinet({ entry: fixture({ id: 'zetslay.kosell-rent', installed: true }) });
  c.run(`kosellRentMarkup=()=>'<section data-kosell-panel><form data-kosell-settings><input type="password" name="apiKey"><button data-kosell-action="status">Обновить</button></form></section>'; renderPluginPage()`);
  assert.match(c.page.innerHTML, /data-kosell-settings/);
  assert.match(c.page.innerHTML, /name="apiKey"/);
  assert.match(c.page.innerHTML, /data-kosell-action="status"/);
  assert.match(c.page.innerHTML, /Ультра/);
});
test('headings, quotes, lists, code and HTML-like strings render as safe text', () => {
  const c = cabinet();
  c.context.text = '# Заголовок <img>\n**Жирный** текст\n> Цитата <script>\n> Продолжение\n- Пункт **один**\n- Пункт `два`\n3. Шаг три\n4. Шаг четыре\n```js\n<script>alert(1)</script>\n```';
  const markup = c.run("pluginDetailDescription(text,'safe').markup");
  assert.match(markup, /<h3[^>]*>Заголовок &lt;img&gt;<\/h3>/);
  assert.match(markup, /<strong>Жирный<\/strong>/);
  assert.match(markup, /<blockquote><p>Цитата &lt;script&gt;\nПродолжение<\/p><\/blockquote>/);
  assert.match(markup, /<ul>/); assert.match(markup, /<li value="3">Шаг три<\/li>/);
  assert.match(markup, /<code>два<\/code>/);
  assert.match(markup, /<pre><code>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/code><\/pre>/);
  assert.doesNotMatch(markup, /<script>|<img>/);
});
test('unclosed code fence is displayed rather than losing the final lines', () => {
  const c = cabinet();
  const markup = c.run("pluginDetailDescription('```\\n**literal**\\nlast line','safe').markup");
  assert.match(markup, /<code>\*\*literal\*\*\nlast line<\/code>/);
});
test('short and empty descriptions avoid a fake contents list and invented version information', () => {
  const c = cabinet({ entry: fixture({ description: 'Одна строка.' }) });
  assert.doesNotMatch(c.page.innerHTML, /class="plugin-detail-toc"/);
  assert.doesNotMatch(c.page.innerHTML, /Версия|API v1/);
  assert.match(c.run("pluginDetailDescription('','safe').markup"), /Описание пока не добавлено/);
});
test('description formatting does not mutate the catalog or the administrator preview formatter', () => {
  const c = cabinet();
  const before = c.run('JSON.stringify(state.plugins)');
  const preview = c.run("formatPluginDescription('**Текст**\\n> Цитата')");
  c.run('renderPluginPage()');
  assert.equal(c.run('JSON.stringify(state.plugins)'), before);
  assert.equal(c.run("formatPluginDescription('**Текст**\\n> Цитата')"), preview);
});
test('contents navigation scrolls and focuses a heading without changing the plugin route or rerendering settings', () => {
  const c = cabinet(); const scroll = [], focus = [];
  const target = { scrollIntoView: value => scroll.push(value), setAttribute() {}, focus: value => focus.push(value) };
  const link = { dataset: { pluginDetailJump: 'heading-test' } };
  c.targets.set('heading-test', target); c.allowed.add(link); c.allowed.add(target);
  const event = { target: { closest: () => link }, preventDefault() { this.prevented = true; } };
  const html = c.page.innerHTML;
  for (const listener of c.listeners.click) listener(event);
  assert.equal(event.prevented, true); assert.equal(scroll.length, 1); assert.equal(scroll[0].behavior, 'auto');
  assert.equal(focus.length, 1); assert.equal(c.location.hash, '#plugins/zetslay.test-plugin');
  assert.equal(c.page.innerHTML, html);
});
test('contents links cannot focus a target outside the authenticated plugin page', () => {
  const c = cabinet(); let called = false;
  const link = { dataset: { pluginDetailJump: 'outside' } }; c.allowed.add(link);
  c.targets.set('outside', { scrollIntoView() { called = true; } });
  const event = { target: { closest: () => link }, preventDefault() {} };
  for (const listener of c.listeners.click) listener(event);
  assert.equal(called, false);
});
test('loading, signed-out and error pages retain the existing guards and retry path', () => {
  const c = cabinet();
  c.run('pluginPageState.loaded=false; renderPluginPage()'); assert.match(c.page.innerHTML, /Загружаем плагин/);
  assert.doesNotMatch(c.page.innerHTML, /plugin-detail-facts/);
  c.run("pluginPageState.error='Каталог недоступен'; renderPluginPage()"); assert.match(c.page.innerHTML, /data-plugin-page-retry/);
  c.run('authState.user=null; renderPluginPage()'); assert.match(c.page.innerHTML, /Войдите в кабинет/);
});
test('reloading the presentation layer does not duplicate facts or wrap markup twice', () => {
  const c = cabinet();
  c.run(ui); c.run('renderPluginPage()');
  assert.equal(c.page.innerHTML.match(/class="plugin-detail-facts"/g).length, 1);
  assert.equal(c.page.innerHTML.match(/class="plugin-detail-navigation"/g).length, 1);
});
