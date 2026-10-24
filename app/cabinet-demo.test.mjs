import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./cabinet-demo.js',import.meta.url),'utf8');
function fixture(){
  const listeners={},calls=[];
  const authState={user:{id:'one'},token:'token-one',workspace:{id:'workspace-one',plan:{active:false}}};
  const gate={dataset:{accessView:'dashboard'},querySelector:selector=>selector==='.demo-experience'?{}:null};
  const context=vm.createContext({authState,Date,Intl,console,document:{addEventListener:(type,fn)=>listeners[type]=fn},icon:()=>'<svg></svg>',subscriptionActive:()=>authState.workspace.plan.active,subscriptionApply:()=>calls.push(['render']),setView:view=>calls.push(['view',view]),apiRequest:()=>{throw Error('Demo must never call the API');},state:{orders:[{id:'PRIVATE-ORDER'}],storeContent:{messages:[{text:'PRIVATE-MESSAGE'}]},plugins:[]}});
  vm.runInContext(source,context);
  const run=s=>vm.runInContext(s,context);
  const element=(key,value='')=>({dataset:{[key.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:value},id:'',value,disabled:false,hasAttribute:k=>k===key,closest:selector=>selector==='[data-access-gate]'?gate:selector.includes(key)?el:null});
  let el;
  return {authState,run,calls,gate,listeners,click(key,value=''){el=element(key,value);listeners.click({target:el});},input(key,value){el=element(key,value);listeners.input({target:el});},send(){el=element('data-demo-message');listeners.submit({target:el,preventDefault:()=>calls.push(['preventDefault'])});}};
}
test('period totals derive from the same orders, exclude refunds and subtract explicit costs and fees',()=>{
  const f=fixture();let previous=0;
  for(const period of ['day','week','month']){
    f.run(`cabinetDemoData().period='${period}'`);const t=f.run('cabinetDemoTotals()');assert.ok(t.revenue>previous);previous=t.revenue;
    assert.equal(t.profit,t.revenue-t.cost-t.fee);assert.equal(t.orders,f.run('cabinetDemoSelected().length'));
  }
  assert.equal(f.run('cabinetDemoData().period="day";cabinetDemoTotals().revenue'),297000);
  assert.equal(f.run('cabinetDemoData().period="month";cabinetDemoTotals().revenue'),1230000);
  const dates=f.run('cabinetDemoOrders().map(o=>o.date)');for(let i=1;i<dates.length;i++)assert.ok(dates[i-1]>=dates[i]);
});
test('all previews disclose sample data, use only local examples and never interpolate account business data',()=>{
  const f=fixture();for(const view of ['dashboard','orders','messages','lots','finance']){
    const html=f.run(`cabinetDemoExperience('${view}',{trial:'available',busy:false,error:''})`);
    assert.match(html,/Данные вымышлены и не связаны с вашим аккаунтом/);assert.doesNotMatch(html,/PRIVATE-/);assert.match(html,/data-access-trial/);
  }
  assert.doesNotMatch(source,/apiRequest\(|fetch\(|localStorage|sessionStorage|state\.(?:orders|storeContent)|workspace\s*=/);
});
test('trial availability, busy and failure copy respect current server eligibility',()=>{
  const f=fixture();const used=f.run("cabinetDemoExperience('dashboard',{trial:'used',busy:false,error:''})");assert.doesNotMatch(used,/data-access-trial|Попробовать бесплатно/);assert.match(used,/data-access-billing/);
  const pending=f.run("cabinetDemoExperience('dashboard',{trial:'available',busy:true,error:'<failure>'})");assert.match(pending,/data-access-trial disabled/);assert.match(pending,/&lt;failure&gt;/);
  const unknown=f.run("cabinetDemoExperience('dashboard',{trial:null,busy:false,error:''})");assert.match(unknown,/Проверить пробный доступ/);assert.doesNotMatch(unknown,/Попробовать бесплатно/);
});
test('demo reply, period and lot controls complete the three steps without granting a plan or editing real data',()=>{
  const f=fixture(),before=JSON.stringify(f.authState.workspace);f.click('data-demo-period','month');f.click('data-demo-template');assert.match(f.run('cabinetDemoData().drafts[0]'),/Игрок_01/);f.send();f.click('data-demo-lot','0');
  assert.equal(f.run('cabinetDemoData().completed.length'),3);assert.equal(f.run('cabinetDemoData().sent[0].length'),1);assert.equal(f.run('cabinetDemoData().drafts[0]'),'');assert.equal(f.run('cabinetDemoData().paused[0]'),0);assert.equal(JSON.stringify(f.authState.workspace),before);
  f.click('data-demo-lot','0');assert.equal(f.run('cabinetDemoData().paused.length'),0);assert.equal(f.run('cabinetDemoData().completed.length'),3);
});
test('search/status narrow orders and do not silently filter dashboard or finance',()=>{
  const f=fixture();f.run("cabinetDemoData().query='Игрок_02';cabinetDemoData().status='closed'");const rows=f.run('cabinetDemoOrderRows()');assert.match(rows,/DEMO-011/);assert.doesNotMatch(rows,/DEMO-012/);
  assert.match(f.run('cabinetDemoOrderRows(true)'),/DEMO-012/);assert.match(f.run('cabinetDemoOrderRows(false,3)'),/DEMO-012/);
  f.run("cabinetDemoData().query='nothing'");assert.match(f.run('cabinetDemoOrderRows()'),/учебных заказов нет/);
});
test('typed markup remains text and background rendering can preserve an edited draft',()=>{
  const f=fixture();f.input('data-demo-draft','<img src=x onerror=alert(1)>');f.send();const html=f.run('cabinetDemoMessages()');assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);
  f.input('data-demo-search','" onfocus="alert(1)');assert.match(f.run("cabinetDemoBody('orders')"),/&quot; onfocus=&quot;/);
  f.input('data-demo-draft','a'.repeat(600));assert.equal(f.run('cabinetDemoData().drafts[0].length'),500);
});
test('account switch and reset erase drafts, replies, local lot edits and learning progress',()=>{
  const f=fixture();f.input('data-demo-draft','My private draft');f.send();f.click('data-demo-lot','1');f.authState.token='token-two';f.authState.user={id:'two'};
  assert.equal(f.run('cabinetDemoData().sent[0].length'),0);assert.equal(f.run('cabinetDemoData().paused.length'),0);assert.equal(f.run('cabinetDemoData().completed.length'),0);
  f.input('data-demo-draft','another');f.click('data-demo-reset');assert.equal(f.run('cabinetDemoData().drafts[0]'),'');
});
test('active or signed-out accounts and invalid control values cannot trigger demo actions',()=>{
  const f=fixture();f.click('data-demo-period','invalid');f.click('data-demo-thread','-1');f.click('data-demo-lot','100');assert.equal(f.run('cabinetDemoData().completed.length'),0);
  f.authState.workspace.plan.active=true;f.click('data-demo-lot','0');assert.equal(f.run('cabinetDemoData().paused.length'),0);
  f.authState.workspace.plan.active=false;f.authState.token='';f.click('data-demo-view','orders');assert.equal(f.calls.length,0);
});
test('navigation is allowlisted and never activates a plugin or subscription',()=>{
  const f=fixture();f.click('data-demo-view','messages');assert.equal(f.calls.at(-1)[1],'messages');f.click('data-demo-link','plugins/zetslay.kosell-rent');assert.equal(f.calls.at(-1)[1],'plugins/zetslay.kosell-rent');const count=f.calls.length;f.click('data-demo-link','javascript:alert(1)');f.click('data-demo-view','admin');assert.equal(f.calls.length,count);
});
test('all simultaneously mounted preview IDs are unique, charts disclose totals and semantic inputs remain named',()=>{
  const f=fixture(),html=['dashboard','orders','messages','lots','finance'].map(view=>f.run(`cabinetDemoExperience('${view}',{trial:'available'})`)).join('');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  assert.match(html,/role="log"/);assert.match(html,/aria-live="polite"/);assert.match(html,/Поиск учебных заказов/);assert.match(html,/Статус учебных заказов/);
});
