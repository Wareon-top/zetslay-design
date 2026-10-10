import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, '');
const rarity = readFileSync(new URL('./plugin-rarity.js', import.meta.url), 'utf8');
function harness() {
  const grid = { innerHTML: '' }, sort = { value: 'default' }, category = { value: 'all' };
  const context = vm.createContext({
    URL, URLSearchParams,
    location: { hostname: 'zetslay.pro', search: '', hash: '' },
    document: {
      querySelector: selector => selector === '[data-plugin-sort]' ? sort : selector === '[data-plugin-category]' ? category : null,
      querySelectorAll: () => [], getElementById: id => id === 'plugin-grid' ? grid : null,
      body: { classList: { toggle() {} } }
    },
    localStorage: { getItem: () => null, removeItem() {} },
    sessionStorage: { getItem: () => null }, window: {},
  });
  vm.runInContext(rarity + '\n' + source, context);
  return { context, grid, sort, category, run: code => vm.runInContext(code, context) };
}
function sorted(entries, sort = 'default', filter = {}) {
  const h = harness(); h.context.entries = entries; h.context.filter = { cat: 'all', query: '', sort, ...filter };
  return JSON.parse(h.run('JSON.stringify(filterPluginCatalog(entries, filter).map(p => p.id))'));
}
const levels = [
  { id: 'zetslay.robux-relay', name: 'Robux Relay' },
  { id: 'zetslay.kosell-rent', name: 'Kosell Rent' },
  { id: 'zetslay.review-reminder', name: 'Review Reminder' },
  { id: 'zetslay.mass-price-editor', name: 'Mass Price Editor' },
  { id: 'zetslay.confirm-reminder', name: 'Confirm Reminder' },
];

test('default order follows badge rarity and is independent of API insertion order', () => {
  const expected = ['zetslay.confirm-reminder', 'zetslay.review-reminder', 'zetslay.mass-price-editor', 'zetslay.kosell-rent', 'zetslay.robux-relay'];
  assert.deepEqual(sorted(levels), expected);
  assert.deepEqual(sorted([...levels].reverse()), expected);
  assert.deepEqual(sorted(levels, 'rarity-asc'), expected);
  assert.deepEqual(sorted(levels, 'unrecognized'), expected);
});

test('descending rarity uses actual badge levels and sorts names within a level', () => {
  assert.deepEqual(sorted(levels, 'rarity-desc'), ['zetslay.robux-relay', 'zetslay.kosell-rent', 'zetslay.mass-price-editor', 'zetslay.confirm-reminder', 'zetslay.review-reminder']);
  const h = harness();
  for (const plugin of [...levels, { id: 'zetslay.auto-review-bonus' }, { id: 'zetslay.sales-pause' }]) {
    h.context.plugin = plugin;
    const key = h.run('pluginRarity(plugin).key');
    assert.equal(h.run('pluginCatalogRarityRank(plugin)'), { common: 0, advanced: 1, ultra: 2, legendary: 3 }[key]);
  }
});

test('prices retain decimals, thousands separators and numeric source over stale text', () => {
  const entries = [
    { id: 'unknown', name: 'Unknown', price: 'Уточняется' },
    { id: 'high', price: 'от 1\u202f299,50 ₽' },
    { id: 'source', priceRub: 149, price: 'от 999 ₽' },
    { id: 'low', price: 'от 129,90 ₽ / мес.' },
    { id: 'free', price: 'Бесплатно' },
    { id: 'zero', priceRub: 0, price: 'от 500 ₽' },
  ];
  assert.deepEqual(sorted(entries, 'price-asc'), ['free', 'zero', 'low', 'source', 'high', 'unknown']);
  assert.deepEqual(sorted(entries, 'price-desc'), ['high', 'source', 'low', 'free', 'zero', 'unknown']);
});

test('missing, foreign and invalid source prices remain unknown in both directions', () => {
  const h = harness();
  for (const entry of [{}, { price: '$9' }, { price: '1 2 ₽' }, { price: '249 ₽ и ещё 50 ₽' },
    ...[null, undefined, '99', NaN, Infinity, -1].map(priceRub => ({ priceRub, price: '99 ₽' }))]) {
    h.context.entry = entry;
    assert.equal(h.run('pluginCatalogPrice(entry)'), null);
  }
  for (const direction of ['price-asc', 'price-desc']) {
    assert.deepEqual(sorted([{ id: 'unknown' }, { id: 'paid', priceRub: 10 }, { id: 'free', priceRub: 0 }], direction),
      direction === 'price-asc' ? ['free', 'paid', 'unknown'] : ['paid', 'free', 'unknown']);
  }
});

test('name sorting supports both directions, natural numbers and the legacy name option', () => {
  const entries = [{ id: 'ten', name: 'Модуль 10' }, { id: 'two', name: 'Модуль 2' }, { id: 'one', name: 'Модуль 1' }];
  assert.deepEqual(sorted(entries, 'name-asc'), ['one', 'two', 'ten']);
  assert.deepEqual(sorted(entries, 'name'), ['one', 'two', 'ten']);
  assert.deepEqual(sorted(entries, 'name-desc'), ['ten', 'two', 'one']);
});

test('search, category and sorting combine without mutating entries or their input order', () => {
  const entries = levels.map(p => Object.freeze({ ...p, category: p.id === 'zetslay.kosell-rent' ? 'sales' : 'chat', description: 'НАПОМИНАНИЕ' }));
  Object.freeze(entries);
  const snapshot = JSON.stringify(entries);
  assert.deepEqual(sorted(entries, 'rarity-desc', { cat: 'chat', query: ' напоминание ' }),
    ['zetslay.robux-relay', 'zetslay.mass-price-editor', 'zetslay.confirm-reminder', 'zetslay.review-reminder']);
  assert.deepEqual(sorted(entries, 'price-asc', { cat: 'sales', query: 'kosell' }), ['zetslay.kosell-rent']);
  assert.equal(JSON.stringify(entries), snapshot);
  assert.deepEqual(sorted(entries, 'active', { query: 'несуществующий' }), []);
});

test('installed and active ordering retain deterministic rarity and name ties', () => {
  const entries = levels.map(p => ({ ...p, installed: p.id.includes('kosell') || p.id.includes('mass-price'), active: p.id.includes('kosell') }));
  assert.deepEqual(sorted(entries, 'installed'), ['zetslay.mass-price-editor', 'zetslay.kosell-rent', 'zetslay.confirm-reminder', 'zetslay.review-reminder', 'zetslay.robux-relay']);
  assert.deepEqual(sorted(entries, 'active'), ['zetslay.kosell-rent', 'zetslay.confirm-reminder', 'zetslay.review-reminder', 'zetslay.mass-price-editor', 'zetslay.robux-relay']);
});

test('rendered order and selected controls survive refresh while retired and private cards stay hidden', () => {
  const h = harness();
  h.context.entries = [...levels, { id: 'zetslay.auto-reply', name: 'Удалён' },
    { id: 'zetslay.telegram-notifications', name: 'Удалён' }, { id: 'planned.hidden', name: 'Будущий' },
    { id: 'private', name: 'Приватный', published: false }];
  h.run("state.plugins = entries; state.pluginFilter.sort = 'rarity-desc'; renderPlugins();");
  assert.equal(h.sort.value, 'rarity-desc');
  assert.equal(h.category.value, 'all');
  const names = [...h.grid.innerHTML.matchAll(/class="plugin-card__title-link"[^>]*>(.*?)<\/a>/g)].map(m => m[1]);
  assert.deepEqual(names, ['Robux Relay', 'Kosell Rent', 'Mass Price Editor', 'Confirm Reminder', 'Review Reminder']);
  assert.doesNotMatch(h.grid.innerHTML, /Удалён|Будущий|Приватный|plugin-cover__edit/);
  h.run('state.plugins.reverse(); renderPlugins();');
  assert.equal(h.sort.value, 'rarity-desc');
  assert.deepEqual([...h.grid.innerHTML.matchAll(/class="plugin-card__title-link"[^>]*>(.*?)<\/a>/g)].map(m => m[1]), names);
});

test('all sort options are available in the existing labelled filter', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const match = html.match(/<select\b[^>]*data-plugin-sort[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(match);
  assert.deepEqual([...match[1].matchAll(/value="([^"]+)"/g)].map(m => m[1]),
    ['default', 'rarity-asc', 'rarity-desc', 'price-asc', 'price-desc', 'name-asc', 'name-desc', 'installed', 'active']);
  assert.equal((html.match(/data-plugin-sort/g) || []).length, 1);
});
