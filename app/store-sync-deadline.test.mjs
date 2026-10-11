import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./store-sync-deadline.js',import.meta.url),'utf8');
const base=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const sync=base.slice(base.indexOf('// Share one read request'),base.indexOf('function renderTelegramOnboarding'));
const overview=readFileSync(new URL('./overview.js',import.meta.url),'utf8');
const refresh=overview.slice(overview.indexOf('async function refreshOverview()'),overview.indexOf("document.addEventListener('click'"));
function harness(fetch){const timeouts=new Map(),intervals=new Map(),calls=[],labels=new Map();let time=0,index=0;
 const authState={user:{id:'a'},token:'token-a',workspace:{id:'w'}},state={storeContent:{observedAt:'previous'},onboarding:{state:'connected_read_only'}};
 const c=vm.createContext({authState,state,API_BASE_URL:'https://api.zetslay.pro',sessionGeneration:1,AbortController,Set,Date:{now:()=>time},Promise,console,
  overviewState:{busy:false,error:''},renderOverview:()=>{},humanError:e=>e.message,
  fetch:async(url,options)=>{calls.push([url,options]);return fetch(url,options);},apiRequest:(...args)=>({original:args}),
  setTimeout:(fn,delay)=>{const id=++index;timeouts.set(id,{fn,delay});return id;},clearTimeout:id=>timeouts.delete(id),setInterval:fn=>{const id=++index;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
  document:{querySelector:s=>labels.get(s)||null},selectedStore:()=>({status:'connected_read_only'}),setAuthModal:()=>{},
  normalizeStoreContent:data=>state.storeContent=data,formatMinor:()=>'',renderStoreFleet:()=>{},renderOrders:()=>{},renderConversations:()=>{},renderLots:()=>{},showToast:()=>{},loadOnboarding:async()=>{},loadStoreFleet:async()=>{},
  resetAccountData:()=>{c.sessionGeneration++;authState.token='token-b';state.storeContent={observedAt:'new-account'};}
 });vm.runInContext(sync,c);vm.runInContext(refresh,c);vm.runInContext(source,c);
 return{c,authState,state,calls,labels,timeouts,intervals,run:s=>vm.runInContext(s,c),expire(){const timer=[...timeouts.values()].find(t=>t.delay===125000);assert.ok(timer);timer.fn();},tick(t){time=t;for(const fn of intervals.values())fn();}};
}
const content={workspaceId:'w',storeId:'s',observedAt:'fresh',orders:[],messages:[],lots:[]};
const response=(data=content)=>({ok:true,status:200,json:async()=>({data})});
test('stalled fetch ends refresh, clears shared flight, preserves previous snapshot and permits a fresh retry',async()=>{
 let finish;const f=harness(()=>new Promise(r=>finish=r));const work=f.run('refreshOverview()');await f.run('refreshOverview()');assert.equal(f.calls.length,1);assert.equal(f.run('overviewState.busy'),true);f.expire();await work;assert.equal(f.run('overviewState.busy'),false);assert.equal(f.run('storeContentSyncFlight'),null);assert.equal(f.state.storeContent.observedAt,'previous');assert.match(f.run('overviewState.error'),/слишком много времени/);assert.equal(f.calls[0][1].signal.aborted,true);assert.equal(f.timeouts.size,0);assert.equal(f.intervals.size,0);
 finish(response({...content,observedAt:'late'}));await new Promise(r=>setImmediate(r));assert.equal(f.state.storeContent.observedAt,'previous');
 f.c.fetch=async()=>response();await f.run('refreshOverview()');assert.equal(f.state.storeContent.observedAt,'fresh');assert.equal(f.run('overviewState.error'),'');
});
test('the deadline also bounds a hung JSON body after successful HTTP headers',async()=>{
 let finish;const f=harness(async()=>({ok:true,status:200,json:()=>new Promise(r=>finish=r)}));const work=f.run('refreshOverview()');await new Promise(r=>setImmediate(r));f.expire();await work;assert.equal(f.state.storeContent.observedAt,'previous');assert.equal(f.run('storeContentSyncFlight'),null);finish({data:{...content,observedAt:'late-body'}});await new Promise(r=>setImmediate(r));assert.equal(f.state.storeContent.observedAt,'previous');
});
test('all views share one authenticated read and server busy/timeout errors restore controls',async()=>{
 let finish;const f=harness(()=>new Promise(r=>finish=r));const a=f.run('syncStoreContent({silent:true})'),b=f.run('syncStoreContent({silent:true})');assert.equal(a,b);const rejected=assert.rejects(a,e=>e.code==='SYNC_BUSY');finish({ok:false,status:409,json:async()=>({error:{code:'SYNC_BUSY',message:'Текущая операция ещё выполняется'}})});await rejected;assert.equal(f.run('storeContentSyncFlight'),null);assert.equal(f.state.storeContent.observedAt,'previous');assert.equal(f.calls[0][1].headers.authorization,'Bearer token-a');assert.equal(f.calls[0][1].method,'GET');
});
test('logout cancels even an abort-ignoring read immediately and late data never reaches the next account',async()=>{
 let finish;const f=harness(()=>new Promise(r=>finish=r));const work=f.run('syncStoreContent({silent:true})');const rejected=assert.rejects(work,{code:'SYNC_CANCELLED'});f.run('resetAccountData()');await rejected;assert.equal(f.timeouts.size,0);finish(response());await new Promise(r=>setImmediate(r));assert.equal(f.state.storeContent.observedAt,'new-account');f.c.fetch=async()=>response();await f.run('syncStoreContent({silent:true})');assert.equal(f.state.storeContent.observedAt,'fresh');
});
test('malformed JSON and foreign workspace snapshots never replace saved data',async()=>{
 for(const r of [{ok:true,json:async()=>{throw Error('private response');}},response({...content,workspaceId:'other'})]){const f=harness(async()=>r);await f.run('refreshOverview()');assert.equal(f.state.storeContent.observedAt,'previous');assert.match(f.run('overviewState.error'),/Последние данные сохранены/);assert.equal(f.run('overviewState.busy'),false);assert.ok(!f.run('overviewState.error').includes('private'));}
});
test('writes and other endpoints retain their original API behaviour and are never replayed',()=>{
 const f=harness(()=>assert.fail('read wrapper must not send a write'));for(const expression of ["apiRequest('/api/v1/plugins/kosell/rent',{method:'POST',body:{id:1}})","apiRequest('/api/v1/funpay/content',{method:'POST'})","apiRequest('/api/v1/subscription/status',{authenticated:true})"]){assert.ok(f.run(expression).original);}assert.equal(f.calls.length,0);
});
test('elapsed indicator labels only genuinely busy refresh buttons and stops after completion',async()=>{
 let finish;const f=harness(()=>new Promise(r=>finish=r)),label={textContent:'Обновить',closest:()=>({getAttribute:()=> 'true'})},idle={textContent:'Обновить',closest:()=>({getAttribute:()=> 'false'})};f.labels.set('[data-overview-refresh-label]',label);f.labels.set('[data-billing-refresh-label]',idle);const work=f.run('refreshOverview()');f.tick(15000);assert.equal(label.textContent,'Обновляем… 0:15');assert.equal(idle.textContent,'Обновить');finish(response());await work;assert.equal(f.intervals.size,0);
});
