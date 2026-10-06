import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../landing-pricing.js', import.meta.url), 'utf8');

function page({ amounts = [149,299,499,799], present = true } = {}) {
  const picker = { hidden: true };
  const announcement = { textContent: '' };
  const buttons = ['month','quarter','year'].map(period => ({
    dataset: { pricingPeriod: period }, events: {}, attributes: {}, focused: false,
    addEventListener(type, handler) { this.events[type] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { this.focused = true; }
  }));
  const cards = amounts.map(amount => {
    const fields = { '[data-pricing-price]': { textContent: '' }, '[data-pricing-original]': { hidden: true, textContent: '' }, '[data-pricing-note]': { textContent: '' } };
    return { dataset: { monthlyRub: String(amount) }, fields, querySelector: selector => fields[selector] };
  });
  const root = {
    querySelector: selector => selector === '[data-pricing-periods]' ? picker : announcement,
    querySelectorAll: selector => selector === '[data-pricing-period]' ? buttons : cards
  };
  vm.runInNewContext(source, { document: { querySelector: () => present ? root : null }, Intl });
  return { picker, announcement, cards, buttons, choose: index => buttons[index].events.click() };
}
const value = (p, index, field) => p.cards[index].fields[`[data-pricing-${field}]`];
const money = text => text.replace(/\s/g,'');

test('monthly prices match all four plans and have no artificial crossed-out discount', () => {
  const p=page();
  assert.equal(p.picker.hidden,false);
  assert.deepEqual(p.cards.map((_,i)=>money(value(p,i,'price').textContent)),['149₽','299₽','499₽','799₽']);
  assert.ok(p.cards.every((_,i)=>value(p,i,'original').hidden));
  assert.equal(p.buttons[0].attributes['aria-pressed'],'true');
  assert.equal(p.announcement.textContent,'');
});

test('quarter and annual discounts show exact monthly prices and complete period totals', () => {
  const p=page();
  p.choose(1);
  assert.deepEqual(p.cards.map((_,i)=>money(value(p,i,'price').textContent)),['134,10₽','269,10₽','449,10₽','719,10₽']);
  assert.deepEqual(p.cards.map((_,i)=>money(value(p,i,'note').textContent).split('за')[0]),['402,30₽','807,30₽','1347,30₽','2157,30₽']);
  assert.ok(p.cards.every((_,i)=>!value(p,i,'original').hidden));
  assert.equal(p.buttons.filter(b=>b.attributes['aria-pressed']==='true').length,1);
  p.choose(2);
  assert.deepEqual(p.cards.map((_,i)=>money(value(p,i,'price').textContent)),['119,20₽','239,20₽','399,20₽','639,20₽']);
  assert.deepEqual(p.cards.map((_,i)=>money(value(p,i,'note').textContent).split('за')[0]),['1430,40₽','2870,40₽','4790,40₽','7670,40₽']);
  assert.match(p.announcement.textContent,/Скидка 20%/);
  p.choose(0);
  assert.ok(p.cards.every((_,i)=>value(p,i,'original').hidden));
});

test('keyboard arrows, Home and End move focus and select the matching period', () => {
  const p=page();
  let prevented=0;
  p.buttons[0].events.keydown({key:'ArrowLeft',preventDefault(){prevented++;}});
  assert.equal(p.buttons[2].attributes['aria-pressed'],'true');
  assert.equal(p.buttons[2].focused,true);
  p.buttons[2].events.keydown({key:'Home',preventDefault(){prevented++;}});
  assert.equal(p.buttons[0].attributes['aria-pressed'],'true');
  p.buttons[0].events.keydown({key:'End',preventDefault(){prevented++;}});
  assert.equal(p.buttons[2].attributes['aria-pressed'],'true');
  assert.equal(prevented,3);
});

test('unknown periods and malformed prices cannot render an incorrect quote', () => {
  const p=page();
  p.buttons[1].dataset.pricingPeriod='invalid';
  p.choose(1);
  assert.equal(money(value(p,0,'price').textContent),'149₽');
  for(const bad of [0,-1,'invalid',1.5,100001]) {
    const p=page({amounts:[149,bad,499,799]});
    assert.equal(p.picker.hidden,true);
    assert.equal(p.buttons[0].events.click,undefined);
  }
  assert.doesNotThrow(()=>page({present:false}));
});
