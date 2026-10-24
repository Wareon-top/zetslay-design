import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./landing-hero.js', import.meta.url), 'utf8');
function page({ reduced = false, saveData = false, present = true, rect = {width:1200,height:900,left:0,top:0} } = {}) {
  const frames = new Map(), events = new Map(), heroEvents = new Map(), windowEvents = new Map(), timers = new Map(), glyphs = [];
  let sequence = 0, intersection, motionChange, resizeChange;
  const media = { matches: reduced, addEventListener: (_, fn) => { motionChange = fn; } };
  const context = { clearRect() {}, setTransform() {}, fillText(glyph,x,y) { glyphs.push({glyph,x,y,alpha:this.globalAlpha}); } };
  const canvas = { getContext: () => context };
  const hero = { querySelector: () => canvas, getBoundingClientRect: () => rect, addEventListener:(name,fn)=>heroEvents.set(name,fn) };
  const ribbon = { dataset: {} };
  const document = { hidden: false, documentElement:{}, body: { dataset: {} }, addEventListener: (name, fn) => events.set(name, fn), querySelector: s => s === '[data-platform-ribbon]' ? ribbon : s === '[data-landing-hero="orderflow"]' && present ? hero : null };
  const window = { navigator: { connection: { saveData } }, devicePixelRatio: 3,
    getComputedStyle:()=>({color:'#d6c4ba'}), matchMedia: () => media, addEventListener:(name,fn)=>windowEvents.set(name,fn),
    setTimeout:fn=>{timers.set(++sequence,fn);return sequence;},clearTimeout:id=>timers.delete(id),
    requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence; }, cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { constructor(fn){resizeChange=fn;} observe() {} },
    IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} }
  };
  vm.runInNewContext(source, { window, document, Math });
  return { frames, glyphs, canvas, document, ribbon, media, timers, context,
    tick(now) { const [id, fn] = [...frames][0]; frames.delete(id); fn(now); },
    hide(value) { document.hidden = value; events.get('visibilitychange')(); },
    intersect(value) { intersection([{ isIntersecting: value }]); },
    reduce(value) { media.matches = value; motionChange(); },
    pointer(x,y,type='mouse') {heroEvents.get('pointermove')({clientX:x,clientY:y,pointerType:type});},
    leave(){heroEvents.get('pointerleave')();},
    resize(value){Object.assign(rect,value);resizeChange();},
    flush(){for(const [id,fn]of timers){timers.delete(id);fn();}},
    pageEvent(name){windowEvents.get(name)();}
  };
}
test('ASCII field uses the supplied ramp, stays below the coin silhouettes and bounds pixel/glyph work', () => {
  for(const rect of [{width:1200,height:900},{width:390,height:844},{width:3840,height:2160}]){
    const p = page({rect});
    assert.equal(p.canvas.width,Math.round(rect.width*1.5));
    assert.equal(p.canvas.height,Math.round(rect.height*1.5));
    assert.ok(p.glyphs.length>0&&p.glyphs.length<9000);
    assert.ok(p.glyphs.every(g=>' .:-=+*#%@'.includes(g.glyph)&&g.y<rect.height*.74&&g.alpha>=0&&g.alpha<=1));
    assert.equal(p.frames.size,1);
  }
});
test('flow changes over time, caps drawing at 30fps and never starts a second loop',()=>{
  const p=page();p.tick(100);const before=p.glyphs.length;
  p.tick(110);assert.equal(p.glyphs.length,before);
  p.tick(164);assert.ok(p.glyphs.length>before);assert.equal(p.frames.size,1);
});
test('hidden tabs, page cache and offscreen hero suspend motion and resume one loop', () => {
  const p = page(); p.hide(true);
  assert.equal(p.frames.size, 0);assert.equal(p.ribbon.dataset.suspended, 'true');
  p.hide(false); assert.equal(p.frames.size, 1);
  p.intersect(false); assert.equal(p.frames.size, 0);assert.equal(p.document.body.dataset.heroSuspended, 'true');
  p.intersect(true); assert.equal(p.frames.size, 1);
  p.pageEvent('pagehide');assert.equal(p.frames.size,0);p.pageEvent('pageshow');assert.equal(p.frames.size,1);
});
test('reduced motion and save-data paint a static ASCII background without animation', () => {
  const p=page({reduced:true});assert.equal(p.frames.size,0);assert.ok(p.glyphs.length>0);
  p.reduce(false);assert.equal(p.frames.size,1);p.reduce(true);assert.equal(p.frames.size,0);
  const low=page({saveData:true});assert.equal(low.frames.size,0);assert.ok(low.glyphs.length>0);assert.equal(low.document.body.dataset.heroSuspended,'true');
});
test('resizes are coalesced and static mode repaints at the new size',()=>{
  const p=page({reduced:true});const before=p.glyphs.length;
  p.resize({width:390,height:844});p.resize({width:320,height:790});assert.equal(p.timers.size,1);
  p.flush();assert.equal(p.canvas.width,480);assert.equal(p.canvas.height,1185);assert.ok(p.glyphs.length>before);assert.equal(p.frames.size,0);
});
test('pointer resolve does not capture clicks; reduced-motion and touch do not animate',()=>{
  const p=page();p.pointer(100,100);p.tick(100);p.leave();p.tick(164);assert.equal(p.frames.size,1);
  const still=page({reduced:true});still.pointer(100,100);still.pointer(100,100,'touch');assert.equal(still.frames.size,0);
  const old=page({present:false});old.hide(true);assert.equal(old.ribbon.dataset.suspended,'true');assert.equal(old.frames.size,0);
});
