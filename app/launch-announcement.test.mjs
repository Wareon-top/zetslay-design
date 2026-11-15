// The launch announcement was retired at the owner's request (13.11.2026, commit b8d1510).
// launch-announcement.js stays only as an inert file for HTML pages cached before the removal.
// These checks keep it retired instead of testing the old weekly-card behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the cabinet page no longer loads the launch announcement', () => {
  const html = read('./index.html');
  assert.doesNotMatch(html, /launch-announcement\.js/);
  assert.doesNotMatch(html, /launch-announcement\.css/);
  assert.doesNotMatch(html, /class="launch-notice/);
});

test('the cached script is inert: no controller, timers, storage, DOM or listeners', () => {
  const source = read('./launch-announcement.js');
  const calls = [];
  const spy = name => (...args) => { calls.push(name); return undefined; };
  const storage = new Map();
  const context = {
    console,
    window: {localStorage: {getItem: k => storage.get(k) ?? null, setItem: (k, v) => { calls.push('setItem'); storage.set(k, v); }}, setTimeout: spy('setTimeout'), setInterval: spy('setInterval'), addEventListener: spy('window.addEventListener')},
    document: {body: {append: spy('append')}, createElement: spy('createElement'), addEventListener: spy('document.addEventListener'), querySelector: () => null},
    setTimeout: spy('setTimeout'), setInterval: spy('setInterval'),
    renderAuthState() {}, renderDashboard() {}, setView() {}, resetAccountData() {}
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(context.window.ZetSlayLaunchAnnouncement, undefined);
  assert.deepEqual(calls, []);
  assert.equal(storage.size, 0);
});

test('the inert script does not wrap host functions', () => {
  const source = read('./launch-announcement.js');
  const original = {renderAuthState() {}, renderDashboard() {}, setView() {}, resetAccountData() {}};
  const context = {...original, window: {}, document: {}};
  vm.createContext(context);
  vm.runInContext(source, context);
  for (const name of Object.keys(original)) assert.equal(context[name], original[name], name + ' was replaced');
  // Comment-only body: nothing executable is left in the retired file.
  assert.equal(source.replace(/\/\*[\s\S]*?\*\//g, '').trim(), '');
});
