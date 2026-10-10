import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
function harness(input = {}) {
  const page = { innerHTML:'', contains:button => button.allowed === true };
  const listeners = [], calls = [];
  const month = { click:() => calls.push('month') };
  const location = { hash:'#plugins/zetslay.kosell-rent', hostname:'zetslay.pro', search:'' };
  const document = { title:'', body:{classList:{toggle(){}}},
    querySelector:selector => selector === '[data-plugin-page]' ? page : selector === '[data-billing-pricing] [data-pricing-period="month"]' ? month : null,
    querySelectorAll:() => [], getElementById:() => null,
    addEventListener:(type,listener) => { if(type === 'click') listeners.push(listener); } };
  const context = vm.createContext({ document, location, URL, URLSearchParams,
    localStorage:{getItem:()=>null,removeItem(){}},sessionStorage:{getItem:()=>null,removeItem(){}},
    window:{setTimeout(){},scrollTo(){}},history:{replaceState(){}} });
  const run = code => vm.runInContext(code,context);
  run(['plugin-cover.js','plugin-rarity.js','plugin-page.js'].map(read).join('\n')+'\n'+read('app.js').replace(/\ninit\(\);\s*$/,''));
  context.input = { id:'zetslay.kosell-rent', name:'Kosell Rent', priceRub:249.5, price:'от 999 ₽', category:'sales', description:'Описание', permissions:[], published:true, installed:true, active:true, ...input };
  run('authState.user={id:"user"}; authState.token="session"; state.plugins=[input]; pluginPageState.loaded=true; pluginPageState.generation=sessionGeneration;');
  run(read('billing-pricing.js'));
  run(read('plugin-purchase-options.js'));
  context.calls=calls;
  run('setView = value => calls.push(value); openBillingDialog = id => calls.push(id);');
  return {run,context,page,listeners,calls,month,document};
}
test('each rarity chooses the cheapest eligible monthly tariff from the actual catalogue',()=>{
  const h=harness();
  for(const [id,plan,amount] of [['confirm-reminder','start',14900],['mass-price-editor','growth',29900],['robux-relay','pro',49900],['kosell-rent','maximum',79900],['stars-relay','maximum',79900],['tiktok-lzt-market','maximum',79900],['roblox-lzt-market','maximum',79900]]){
    h.context.id='zetslay.'+id;
    const model=JSON.parse(h.run('JSON.stringify(pluginPurchaseModel({id,priceRub:490}))'));
    assert.equal(model.plan.id,plan);assert.equal(model.plan.price,amount/100+' ₽');
    const markup=h.run('pluginPurchaseOptionsMarkup({id,priceRub:490})');
    assert.match(markup,/Бессрочный доступ/);assert.match(markup,/один раз/);assert.match(markup,/за 1 месяц/);
  }
});
test('subscription states same rarity and lower levels, never promises higher ones',()=>{
  const h=harness({id:'zetslay.robux-relay'});
  const html=h.run('pluginPurchaseOptionsMarkup(input)');
  assert.match(html,/обычные, продвинутые, ультра/);assert.doesNotMatch(html,/легендарные/);
  assert.match(html,/Автоматических списаний нет/);
});
test('lifetime pricing is numeric and independent of stale text and install state',()=>{
  const h=harness();assert.match(h.page.innerHTML,/249,50 ₽/);assert.doesNotMatch(h.page.innerHTML,/999 ₽/);
  assert.match(h.page.innerHTML,/Купить навсегда · скоро/);assert.match(h.page.innerHTML,/после подключения оплаты/);
  assert.doesNotMatch(h.page.innerHTML,/Покупка подтверждена|Вы приобрели/);
  h.run('input.priceRub=null; input.price="999 ₽"; renderPluginPage()');assert.match(h.page.innerHTML,/Цена уточняется/);
});
test('zero price is free access without invented purchases; unavailable modules cannot be purchased',()=>{
  const h=harness({priceRub:0});assert.match(h.page.innerHTML,/Бесплатный доступ/);assert.doesNotMatch(h.page.innerHTML,/Купить навсегда/);
  h.run('input.planned=true; renderPluginPage()');assert.match(h.page.innerHTML,/Плагин не найден/);
  const pending=h.run('pluginPurchaseOptionsMarkup(input)');assert.match(pending,/Пока недоступен/);assert.doesNotMatch(pending,/data-plugin-subscription=/);
});
test('missing tariff data does not invent a plan, amount or purchase action',()=>{
  const h=harness();h.run('ZetSlayPricing=null; renderPluginPage()');
  assert.match(h.page.innerHTML,/Условия подписки сейчас не загружены/);assert.match(h.page.innerHTML,/href="#billing"/);assert.doesNotMatch(h.page.innerHTML,/data-plugin-subscription=/);
});
test('untrusted plan strings and plugin identifiers remain escaped',()=>{
  const h=harness();h.run('ZetSlayPricing={plans:[{id:"x"}],quote:()=>({months:1,totalKopecks:100,name:"<img onerror=x>",planId:"\\\" onclick=bad",includes:["legendary"]})}; input.id="zetslay.kosell-rent";');
  const html=h.run('pluginPurchaseOptionsMarkup(input)');assert.match(html,/&lt;img/);assert.match(html,/&quot; onclick/);assert.doesNotMatch(html,/<img|data-plugin-subscription=""/);
});
test('the original settings, enable controls and description remain intact',()=>{
  const h=harness();assert.match(h.page.innerHTML,/data-plugin-id="zetslay.kosell-rent"/);assert.match(h.page.innerHTML,/Отключить плагин/);assert.match(h.page.innerHTML,/Возможности плагина/);assert.match(h.page.innerHTML,/Описание/);
  assert.doesNotMatch(h.page.innerHTML,/data-plugin-edit|data-cover-plugin/);
});
test('subscription link opens the matching tariff with the monthly period and makes no financial requests',()=>{
  const h=harness();let prevented=0;
  const button={allowed:true,dataset:{pluginSubscription:'maximum',pluginSubscriptionId:'zetslay.kosell-rent'}};
  const event={target:{closest:selector=>selector === '[data-plugin-subscription]' ? button : null},preventDefault:()=>prevented++};
  h.listeners.at(-1)(event);assert.deepEqual(h.calls,['billing','month','maximum']);assert.equal(prevented,1);
  h.calls.length=0;button.dataset.pluginSubscription='start';h.listeners.at(-1)(event);assert.deepEqual(h.calls,[]);
  button.dataset.pluginSubscription='maximum';h.run('authState.token=null');h.listeners.at(-1)(event);assert.deepEqual(h.calls,[]);
});
test('loading order follows the shared commercial catalogue and existing page presentation',()=>{
  const html=read('index.html');
  assert.equal((html.match(/src="plugin-purchase-options.js/g)||[]).length,1);
  assert.ok(html.indexOf('src="plugin-purchase-options.js')>html.indexOf('src="billing-pricing.js'));
  assert.ok(html.indexOf('src="plugin-purchase-options.js')>html.indexOf('src="plugin-detail-ui.js'));
});
