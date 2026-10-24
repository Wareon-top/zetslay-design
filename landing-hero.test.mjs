import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./landing-hero.js', import.meta.url), 'utf8');
function page({ reduced = false, saveData = false, present = true } = {}) {
  const frames = new Map(), events = new Map(), points = [];
  let sequence = 0, intersection, motionChange;
  const media = { matches: reduced, addEventListener: (_, fn) => { motionChange = fn; } };
  const context = { clearRect() {}, setTransform() {}, beginPath() {}, fill() {}, arc: (x,y,r) => points.push({x,y,r}) };
  const canvas = { getContext: () => context };
  const hero = { querySelector: () => canvas, getBoundingClientRect: () => ({ width: 1200, height: 900 }) };
  const ribbon = { dataset: {} };
  const document = { hidden: false, body: { dataset: {} }, addEventListener: (name, fn) => events.set(name, fn), querySelector: s => s === '[data-platform-ribbon]' ? ribbon : s === '[data-landing-hero="orderflow"]' && present ? hero : null };
  const window = { navigator: { connection: { saveData } }, devicePixelRatio: 3,
    matchMedia: () => media, addEventListener() {},
    requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { observe() {} },
    IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} }
  };
  const math = Object.create(Math); math.random = () => .5;
  vm.runInNewContext(source, { window, document, Math: math });
  return { frames, points, canvas, document, ribbon, media,
    tick(now) { const [id, fn] = [...frames][0]; frames.delete(id); fn(now); },
    hide(value) { document.hidden = value; events.get('visibilitychange')(); },
    intersect(value) { intersection([{ isIntersecting: value }]); },
    reduce(value) { media.matches = value; motionChange(); }
  };
}
test('particles move slowly upward with bounded count and pixel ratio', () => {
  const p = page();
  assert.equal(p.canvas.width, 1800);
  assert.equal(p.canvas.height, 1350);
  assert.equal(p.points.length, 50);
  p.tick(100); const y = p.points.at(-1).y;
  p.tick(164);
  assert.ok(p.points.at(-1).y < y);
  assert.ok(y - p.points.at(-1).y < 2);
  assert.equal(p.frames.size, 1);
});
test('hidden tabs and offscreen hero cancel animation; returning starts one loop', () => {
  const p = page(); p.hide(true);
  assert.equal(p.frames.size, 0);
  assert.equal(p.ribbon.dataset.suspended, 'true');
  p.hide(false); assert.equal(p.frames.size, 1);
  p.intersect(false); assert.equal(p.frames.size, 0);
  assert.equal(p.document.body.dataset.heroSuspended, 'true');
  p.intersect(true); assert.equal(p.frames.size, 1);
  p.hide(false); assert.equal(p.frames.size, 1);
});
test('reduced motion renders a static frame and responds to live preference changes', () => {
  const p = page({ reduced: true }); assert.equal(p.frames.size, 0);
  assert.ok(p.points.length > 0);
  p.reduce(false); assert.equal(p.frames.size, 1);
  p.reduce(true); assert.equal(p.frames.size, 0);
});
test('save-data disables decorative particles and legacy pages retain ribbon behavior', () => {
  const p = page({ saveData: true }); assert.equal(p.frames.size, 0); assert.equal(p.points.length, 0);
  const old = page({ present: false }); old.hide(true);
  assert.equal(old.ribbon.dataset.suspended, 'true'); assert.equal(old.frames.size, 0);
});
