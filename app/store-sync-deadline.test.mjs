import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./store-sync-deadline.js',import.meta.url),'utf8');
const base=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const sync=base.slice(base.indexOf('// Share one read request'),base.indexOf('function renderTelegramOnboarding'));
const overview=readFileSync(new URL('./overview.js',import.meta.url),'utf8');
const refresh=overview.slice(overview.indexOf('async function refreshOverview()'),overview.indexOf("document.addEventListener('click'"));
function harness(fetch,{addon=true}={}){const timeouts=new Map(),intervals=new Map(),calls=[],labels=new Map();let time=0,index=0;
 const authState={user:{id:'a'},token:'token-a',workspace:{id:'w'}},state={storeContent:{observedAt:'previous'},onboarding:{state:'connected_read_only'}};
 const c=vm.createContext({authState,state,API_BASE_URL:'https://api.zetslay.pro',sessionGeneration:1,AbortController,Set,Date:{now:()=>time},Promise,console,window:{},
  overviewState:{busy:false,error:''},renderOverview:()=>{},humanError:e=>e.message,
  fetch:async(url,options)=>{calls.push([url,options]);return fetch(url,options);},apiRequest:(...args)=>({original:args}),
  setTimeout:(fn,delay)=>{const id=++index;timeouts.set(id,{fn,delay});return id;},clearTimeout:id=>timeouts.delete(id),setInterval:fn=>{const id=++index;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
  document:{querySelector:s=>labels.get(s)||null},selectedStore:()=>({status:'connected_read_only'}),setAuthModal:()=>{},
  normalizeStoreContent:data=>state.storeContent=data,formatMinor:()=>'',renderStoreFleet:()=>{},renderOrders:()=>{},renderConversations:()=>{},renderLots:()=>{},showToast:()=>{},loadOnboarding:async()=>{},loadStoreFleet:async()=>{},
  resetAccountData:()=>{c.sessionGeneration++;authState.token='token-b';state.storeContent={observedAt:'new-account'};}
 });vm.runInContext(sync,c);vm.runInContext(refresh,c);if(addon)vm.runInContext(source,c);
 return{c,authState,state,calls,labels,timeouts,intervals,run:s=>vm.runInContext(s,c),expire(){const timer=[...timeouts.values()].find(t=>t.delay===125000);assert.ok(timer);timer.fn();},tick(t){time=t;for(const fn of intervals.values())fn();}};
}
const content={workspaceId:'w',storeId:'s',observedAt:'fresh',orders:[],messages:[],lots:[]};
const response=(data=content)=>({ok:true,status:200,json:async()=>({data})});
test('stalled fetch ends refresh, clears shared flight, preserves previous snapshot and permits a fresh retry',async()=>{
 let finish;const f=harness(()=>new Promise(r=>finish=r));const work=f.run('refreshOverview()');await f.run('refreshOverview()');await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,1);assert.equal(f.run('overviewState.busy'),true);f.expire();await work;assert.equal(f.run('overviewState.busy'),false);assert.equal(f.run('storeContentSyncFlight'),null);assert.equal(f.state.storeContent.observedAt,'previous');assert.match(f.run('overviewState.error'),/слишком много времени/);assert.equal(f.calls[0][1].signal.aborted,true);assert.equal(f.timeouts.size,0);assert.equal(f.intervals.size,0);
 finish(response({...content,observedAt:'late'}));await new Promise(r=>setImmediate(r));assert.equal(f.state.storeContent.observedAt,'previous');
 f.c.fetch=async()=>response();await f.run('refreshOverview()');assert.equal(f.state.storeContent.observedAt,'fresh');assert.equal(f.run('overviewState.error'),'');
});
test('the deadline also bounds a hung JSON body after successful HTTP headers',async()=>{
 let finish;const f=harness(async()=>({ok:true,status:200,json:()=>new Promise(r=>finish=r)}));const work=f.run('refreshOverview()');await new Promise(r=>setImmediate(r));f.expire();await work;assert.equal(f.state.storeContent.observedAt,'previous');assert.equal(f.run('storeContentSyncFlight'),null);finish({data:{...content,observedAt:'late-body'}});await new Promise(r=>setImmediate(r));assert.equal(f.state.storeContent.observedAt,'previous');
});
test('all views share one authenticated read and server busy/timeout errors restore controls',async()=>{
 let finish;const f=harness(()=>new Promise(r=>finish=r));const a=f.run('syncStoreContent({silent:true})'),b=f.run('syncStoreContent({silent:true})');assert.equal(a,b);const rejected=assert.rejects(a,e=>e.code==='SYNC_BUSY');await new Promise(r=>setImmediate(r));finish({ok:false,status:409,json:async()=>({error:{code:'SYNC_BUSY',message:'Текущая операция ещё выполняется'}})});await rejected;assert.equal(f.run('storeContentSyncFlight'),null);assert.equal(f.state.storeContent.observedAt,'previous');assert.equal(f.calls[0][1].headers.authorization,'Bearer token-a');assert.equal(f.calls[0][1].method,'GET');
});
test('logout cancels even an abort-ignoring read immediately and late data never reaches the next account',async()=>{
 let finish;const f=harness(()=>new Promise(r=>finish=r));const work=f.run('syncStoreContent({silent:true})');const rejected=assert.rejects(work,{code:'SYNC_CANCELLED'});await new Promise(r=>setImmediate(r));f.run('resetAccountData()');await rejected;assert.equal(f.timeouts.size,0);finish(response());await new Promise(r=>setImmediate(r));assert.equal(f.state.storeContent.observedAt,'new-account');f.c.fetch=async()=>response();await f.run('syncStoreContent({silent:true})');assert.equal(f.state.storeContent.observedAt,'fresh');
});
test('malformed JSON and foreign workspace snapshots never replace saved data',async()=>{
 for(const r of [{ok:true,json:async()=>{throw Error('private response');}},response({...content,workspaceId:'other'})]){const f=harness(async()=>r);await f.run('refreshOverview()');assert.equal(f.state.storeContent.observedAt,'previous');assert.match(f.run('overviewState.error'),/Последние данные сохранены/);assert.equal(f.run('overviewState.busy'),false);assert.ok(!f.run('overviewState.error').includes('private'));}
});
test('writes and other endpoints retain their original API behaviour and are never replayed',()=>{
 const f=harness(()=>assert.fail('read wrapper must not send a write'));for(const expression of ["apiRequest('/api/v1/plugins/kosell/rent',{method:'POST',body:{id:1}})","apiRequest('/api/v1/funpay/content',{method:'POST'})","apiRequest('/api/v1/subscription/status',{authenticated:true})"]){assert.ok(f.run(expression).original);}assert.equal(f.calls.length,0);
});
test('elapsed indicator labels only genuinely busy refresh buttons and stops after completion',async()=>{
 let finish;const f=harness(()=>new Promise(r=>finish=r)),label={textContent:'Обновить',closest:()=>({getAttribute:()=> 'true'})},idle={textContent:'Обновить',closest:()=>({getAttribute:()=> 'false'})};f.labels.set('[data-overview-refresh-label]',label);f.labels.set('[data-billing-refresh-label]',idle);const work=f.run('refreshOverview()');await new Promise(r=>setImmediate(r));f.tick(15000);assert.equal(label.textContent,'Обновляем… 0:15');assert.equal(idle.textContent,'Обновить');finish(response());await work;assert.equal(f.intervals.size,0);
});

const flush=()=>new Promise(r=>setImmediate(r));
test('failed FunPay response settles immediately even when terminal connection-state followups never settle',async()=>{
 for(const code of ['AUTH_REJECTED','CAPTCHA_REQUIRED','READ_ONLY_VIOLATION','PLATFORM_UNAVAILABLE']){
  const f=harness(async()=>({ok:false,status:503,json:async()=>({error:{code,message:'FunPay unavailable'}})}));let reloads=0;
  f.c.loadOnboarding=f.c.loadStoreFleet=()=>{reloads++;return new Promise(()=>{});};
  await f.run('refreshOverview()');await flush();
  assert.equal(f.run('overviewState.busy'),false);assert.equal(f.run('storeContentSyncFlight'),null);
  assert.equal(f.state.storeContent.observedAt,'previous');assert.equal(f.timeouts.size,0);
  assert.equal(reloads,code==='PLATFORM_UNAVAILABLE'?0:2);
  assert.equal(f.c.window.zetslaySyncDiagnostics().lastError,code);
 }
});
test('a request started before the optional deadline module loads is bounded and cannot apply late data',async()=>{
 let finish;const f=harness(()=>new Promise(r=>finish=r),{addon:false});
 // Use the actual base API, not the addon, for the initial request.
 const a=base.indexOf('async function apiRequest('),b=base.indexOf('function accountInitials',a);
 f.run(base.slice(a,b));
 const work=f.run('refreshOverview()');await flush();assert.equal(f.calls.length,1);
 f.run(source);f.expire();await work;
 assert.equal(f.run('overviewState.busy'),false);assert.equal(f.run('storeContentSyncFlight'),null);
 assert.equal(f.calls[0][1].signal.aborted,true);
 f.c.fetch=async()=>response({...content,observedAt:'retry'});
 await f.run('refreshOverview()');finish(response({...content,observedAt:'obsolete'}));await flush();
 assert.equal(f.state.storeContent.observedAt,'retry');assert.equal(f.timeouts.size,0);
});
test('a late overview finally cannot unlock an update in a different session',async()=>{
 let finish;const f=harness(()=>new Promise(r=>finish=r));const work=f.run('refreshOverview()');await flush();
 f.run('resetAccountData(); overviewState.busy=true; overviewState.request={};');await work;
 assert.equal(f.run('overviewState.busy'),true);finish(response());await flush();assert.equal(f.run('overviewState.busy'),true);
});
test('safe diagnostics expose the installed version and waiting state without credentials',async()=>{
 const f=harness(()=>new Promise(()=>{}));const work=f.run('refreshOverview()');await flush();f.tick(12000);
 const d=f.c.window.zetslaySyncDiagnostics();assert.equal(d.version,'20261011-sync-pipeline-v2');assert.equal(d.waitingSeconds,12);assert.equal(d.sharedRead,true);
 assert.ok(!JSON.stringify(d).includes('token-a'));assert.ok(!JSON.stringify(d).includes('https://'));f.expire();await work;
 assert.equal(f.c.window.zetslaySyncDiagnostics().sharedRead,false);
});

test('periodic refresh cannot hide a failure with another spinner, while a manual retry remains available',async()=>{
 const f=harness(async()=>response(),{addon:false});let polls=0;
 f.c.refreshVisibleStore=()=>{polls++;return Promise.resolve();};f.run(source);
 f.run("overviewState.error='Previous timeout'");await f.run('refreshVisibleStore()');assert.equal(polls,0);
 await f.run('refreshOverview()');assert.equal(f.run('overviewState.error'),'');await f.run('refreshVisibleStore()');assert.equal(polls,1);
});
