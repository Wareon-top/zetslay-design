import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../landing-features.js', import.meta.url), 'utf8');

function page({ reduced = false, observerAvailable = true, present = true } = {}) {
  const delays = [];
  const grid = { dataset: {}, querySelectorAll: () => Array.from({ length: 9 }, () => ({ style: { setProperty: (name, value) => delays.push([name, value]) } })) };
  let callback, options, observed, disconnected = 0;
  const window = { matchMedia: () => ({ matches: reduced }) };
  const Observer = class {
    constructor(cb, opts) { callback = cb; options = opts; }
    observe(node) { observed = node; }
    disconnect() { disconnected++; }
  };
  if (observerAvailable) window.IntersectionObserver = Observer;
  vm.runInNewContext(source, { window, IntersectionObserver: Observer, document: { querySelector: () => present ? grid : null } });
  return { grid, delays, options, observed, signal: entries => callback(entries), disconnected: () => disconnected };
}

test('reveal waits for intersection, staggers all nine cards and disconnects once visible', () => {
  const p = page();
  assert.equal(p.observed, p.grid);
  assert.equal(p.options.rootMargin, '0px 0px -50px 0px');
  assert.equal(p.grid.dataset.bentoReveal, 'pending');
  p.signal([{ isIntersecting: false }]);
  assert.equal(p.grid.dataset.bentoReveal, 'pending');
  p.signal([{ isIntersecting: true }]);
  assert.equal(p.grid.dataset.bentoReveal, 'visible');
  assert.equal(p.disconnected(), 1);
  assert.deepEqual(p.delays.map(x => x[1]), [0,1,2,3,4,5,6,7,8]);
});

test('reduced motion and unsupported observers leave every card visible without enhancement', () => {
  for (const options of [{ reduced: true }, { observerAvailable: false }]) {
    const p = page(options);
    assert.equal(p.grid.dataset.bentoReveal, undefined);
    assert.equal(p.observed, undefined);
    assert.equal(p.delays.length, 0);
  }
});

test('landing enhancer does nothing on pages without its section', () => {
  assert.doesNotThrow(() => page({ present: false }));
});
