import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./billing.js', import.meta.url), 'utf8');
const at = '2026-10-06T18:00:00.000Z';
const connected = { id:'42', displayName:'Shop', status:'connected_read_only' };
const content = { profile:{id:'42',displayName:'My Shop'}, observedAt:at, balance:{totalMinor:12345,availableMinor:10000,pendingMinor:2345,currency:'RUB'} };
const money = value => value.replace(/\s/g, '');

function harness({ present=true, sync=async () => {}, boot=false } = {}) {
  let enabled = boot;
  const nodes = new Map(), dialogs = [], listeners = {};
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { textContent:'', innerHTML:'', hidden:false, disabled:false, attributes:{}, classList:{toggle(){}}, setAttribute(name,value){this.attributes[name]=value;} });
    return nodes.get(selector);
  };
  const cards = [{ dataset:{pricingPlan:'start'}, querySelector: selector => ({textContent:selector==='h3'?'Старт':selector==='[data-pricing-price]'?'119,20 ₽':'1 430,40 ₽ за год · скидка 20%'}) }];
  const root = { hidden:false, querySelector:node, querySelectorAll: selector => selector==='[data-pricing-plan]'?cards:[], contains:()=>true, append(dialog){dialogs.push(dialog);} };
  const document = {
    querySelector:()=> enabled && present ? root : null,
    addEventListener(type, callback){listeners[type]=callback;},
    createElement(){return {open:false,removed:false,attributes:{},events:{},setAttribute(key,value){this.attributes[key]=value;},addEventListener(type,callback){this.events[type]=callback;},showModal(){this.open=true;},close(){if(!this.open)return;this.open=false;this.events.close?.();},remove(){this.removed=true;}};}
  };
  const legacy={finance:0,identity:0,routes:0};
  const context=vm.createContext({ document, authState:{token:'a',user:{id:'u'},workspace:{plan:{id:'pro_demo',active:true}}}, state:{storeContent:structuredClone(content),plugins:[]}, sessionGeneration:1,
    selectedStore:()=>context.store, store:structuredClone(connected), syncStoreContent:sync, humanError:()=> 'Ошибка соединения.', icon:()=>'<svg></svg>',
    renderFinance(){legacy.finance++;return 'finance';},renderStoreIdentity(){legacy.identity++;return 'identity';},setView(view){legacy.routes++;root.hidden=view!=='billing';return view;},
    apiRequest(){throw Error('No payment calls allowed');}
  });
  vm.runInContext(source,context);
  enabled=true;
  const run=code=>vm.runInContext(code,context);
  const model=(options={})=>{
    context.input={user:{id:'u'},workspace:{plan:{active:true,id:'pro_demo'}},store:connected,content,...options};
    return JSON.parse(JSON.stringify(run('billingModel(input.user,input.workspace,input.store,input.content)')));
  };
  return {context,run,node,root,dialogs,cards,model,legacy,disableRoot(){enabled=false;}};
}

test('finance shows the selected shop snapshot and recognizes the existing demo plan',()=>{
  const app=harness(), model=app.model();
  assert.equal(money(model.amount),'123,45₽');
  assert.equal(money(model.available),'100,00₽');
  assert.equal(money(model.pending),'23,45₽');
  assert.equal(model.planName,'Демо-тариф');
  assert.equal(model.currentPlan,null);
  assert.equal(model.observedAt,at);
  app.run('renderBilling()');
  assert.equal(app.node('[data-billing-store-name]').textContent,'My Shop');
  assert.equal(app.node('[data-billing-refresh]').disabled,false);
});

test('zero balance is real data; missing, malformed and mismatched amounts stay unknown',()=>{
  const app=harness();
  const zero=app.model({content:{...content,balance:{totalMinor:0,currency:'RUB'}}});
  assert.equal(money(zero.amount),'0,00₽');
  assert.equal(zero.balanceKnown,true);
  assert.equal(zero.pending,null);
  for (const balance of [null,{totalMinor:-1,currency:'RUB'},{totalMinor:'12345',currency:'RUB'},{totalMinor:1.5,currency:'RUB'},{totalMinor:12345,currency:'BAD'}]) {
    assert.equal(app.model({content:{...content,balance}}).amount,'—');
  }
  assert.equal(app.model({content:{...content,profile:{id:'another'}}}).amount,'—');
  assert.equal(app.model({user:null}).amount,'—');
  assert.equal(app.model({store:{}}).amount,'—');
});

test('rounded source, independent currencies and real plan IDs are retained',()=>{
  const app=harness();
  assert.match(app.model({content:{...content,balance:{totalMinor:1200,currency:'USD',approximate:true}}}).amount,/^≈ /);
  assert.equal(app.model({workspace:{plan:{active:true,id:'pro'}}}).currentPlan,'pro');
  assert.equal(app.model({workspace:{plan:{active:false,id:'pro'}}}).planName,'Не активен');
  assert.equal(app.model({workspace:{plan:{active:true,id:'unknown'}}}).planName,'Активный тариф');
  assert.equal(app.model({content:{...content,observedAt:'bad date'}}).observedAt,null);
});

test('failed refresh keeps the old balance and exposes an actionable error',async()=>{
  const app=harness({sync:async()=>{throw Error('timeout');}});
  app.run('renderBilling()');
  await app.run('refreshBilling()');
  assert.equal(money(app.node('[data-billing-funpay-balance]').textContent),'123,45₽');
  assert.equal(app.node('[data-billing-error]').hidden,false);
  assert.match(app.node('[data-billing-error]').textContent,/последний доступный снимок/);
  assert.equal(app.node('[data-billing-refresh]').disabled,false);
});

test('repeated refresh shares one action and a late failure cannot affect the next account',async()=>{
  let reject, calls=0;
  const pending=new Promise((_,r)=>{reject=r;});
  const app=harness({sync:()=>{calls++;return pending;}});
  app.run('renderBilling()');
  const first=app.run('refreshBilling()');
  await app.run('refreshBilling()');
  assert.equal(calls,1);
  app.run("authState.token='b';sessionGeneration++;state.storeContent={};renderBilling();");
  reject(Error('old failure'));await first;
  assert.equal(app.node('[data-billing-error]').hidden,true);
  assert.equal(app.node('[data-billing-funpay-balance]').textContent,'—');
  assert.equal(app.run('billingUi.busy'),false);
});

test('topup and promotion dialogs truthfully show API availability and send no financial requests',()=>{
  const app=harness();app.run('renderBilling()');
  app.run("openBillingDialog('topup')");
  assert.match(app.dialogs.at(-1).innerHTML,/Приём платежей ещё не подключён/);
  app.run("openBillingDialog('promo')");
  assert.equal(app.dialogs[0].removed,true);
  assert.match(app.dialogs.at(-1).innerHTML,/проверка кодов недоступна/);
  assert.ok(!app.dialogs.at(-1).innerHTML.includes('<form'));
  assert.equal(app.context.authState.workspace.plan.id,'pro_demo');
});

test('selected plan modal uses the current period quote, escapes content and preserves access',()=>{
  const app=harness();app.run('renderBilling()');app.run("openBillingDialog('start')");
  assert.match(app.dialogs.at(-1).innerHTML,/119,20 ₽/);
  assert.match(app.dialogs.at(-1).innerHTML,/1 430,40 ₽ за год/);
  assert.equal(app.context.authState.workspace.plan.id,'pro_demo');
  app.cards[0].querySelector=()=>({textContent:'<img src=x onerror=alert(1)>'});
  app.run("openBillingDialog('start')");
  assert.ok(!app.dialogs.at(-1).innerHTML.includes('<img'));
  assert.match(app.dialogs.at(-1).innerHTML,/&lt;img/);
  app.run("openBillingDialog('unknown')");
  assert.equal(app.dialogs.length,2);
});

test('sign-out closes open finance dialogs and clears visible account-specific data',()=>{
  const app=harness();app.run('renderBilling()');app.run("openBillingDialog('promo')");
  app.run("authState.user=null;authState.token='';authState.workspace=null;sessionGeneration++;renderBilling();");
  assert.equal(app.dialogs[0].removed,true);
  assert.equal(app.node('[data-billing-funpay-balance]').textContent,'—');
  assert.equal(app.node('[data-billing-plan-name]').textContent,'Не активен');
  assert.equal(app.node('[data-billing-refresh]').disabled,true);
});

test('integration preserves existing identity and routing; leaving finance closes the modal',()=>{
  const app=harness({boot:true});
  assert.equal(app.run('renderStoreIdentity()'),'identity');
  assert.equal(app.legacy.identity,1);
  app.run('renderFinance()');
  assert.equal(app.legacy.finance,0);
  app.run("openBillingDialog('promo')");
  assert.equal(app.run("setView('orders')"),'orders');
  assert.equal(app.dialogs[0].removed,true);
  assert.equal(app.legacy.routes,1);
  app.disableRoot();
  assert.equal(app.run('renderFinance()'),'finance');
  assert.equal(app.legacy.finance,1);
});

test('cabinet tariffs exactly duplicate landing names, prices and benefits without registration links',()=>{
  const landing=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const billing=readFileSync(new URL('./billing-section.html',import.meta.url),'utf8');
  const cards=html=>[...html.matchAll(/<article\b[^>]*data-pricing-plan="([^"]+)"[^>]*data-monthly-rub="(\d+)"[^>]*>(.*?)<\/article>/gs)].map(([,id,price,body])=>({id,price,title:body.match(/<h3[^>]*>(.*?)<\/h3>/s)[1],features:body.match(/<ul class="pricing-card__features"[^>]*>(.*?)<\/ul>/s)[1]}));
  assert.deepEqual(cards(billing),cards(landing));
  assert.equal(cards(billing).length,4);
  assert.ok(!billing.includes('auth=register'));
  for (const ext of ['css','js']) assert.equal(readFileSync(new URL(`./billing-pricing.${ext}`,import.meta.url),'utf8'),readFileSync(new URL(`../landing-pricing.${ext}`,import.meta.url),'utf8'));
});
