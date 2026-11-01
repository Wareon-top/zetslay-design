import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./auto-refresh.js',import.meta.url),'utf8'),flush=()=>new Promise(r=>setImmediate(r));
function fixture(){
 let time=Date.parse('2026-10-16T10:01:00Z'),route='dashboard',editing=false,seq=0,active=true;const timers=new Map(),events={},calls=[],node={dataset:{},textContent:'',removeAttribute(){}};
 const store={id:'42',status:'connected_read_only',metrics:{}},state={storeContent:{observedAt:null,orders:[],messages:[]}},authState={user:{id:'u'},workspace:{id:'w',plan:{active:true}},token:'token'};
 const handlers={},c={console,Date:class extends Date{static now(){return time;}},AbortController,navigator:{onLine:true},authState,state,sessionGeneration:1,selectedStore:()=>store,subscriptionActive:()=>active,storeContentSyncFlight:null,overviewState:{error:'old error'},messagesPageState:{error:'old error',selectedId:'buyer',query:'search'},messagesActions:{drafts:new Map([['buyer','draft']])},financeUi:{dialog:null,saving:false,busy:false,loadedAt:time},
 document:{hidden:false,querySelector:s=>s==='[data-view].is-active'?{dataset:{view:route}}:s==='.topbar-context small'?node:s==='dialog[open], .modal.is-open'?editing?{}:null:null,addEventListener:(k,fn)=>events[k]=fn},
 window:{setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),addEventListener:(k,fn)=>handlers[k]=fn,zetslaySyncDiagnostics:()=>({version:'old'})},
 apiRequest:async(path,options)=>{calls.push({path,options});return{schema:1,workspaceId:'w',storeId:'42',observedAt:null,content:null,sync:{status:'ok'}};},
 normalizeStoreContent:content=>{state.storeContent=content;},renderOrders(){},renderConversations(){},renderLots(){},renderOverview(){},renderBilling(){},formatMinor:n=>String(n),stopMessagesPolling:()=>c.stopped=true,updateMessagesPolling(){},resetAccountData:()=>{state.storeContent={observedAt:null,orders:[],messages:[]};},setView:v=>route=v,renderStoreFleet(){},subscriptionLoad:async()=>{},loadOnboarding:async()=>{},loadStoreFleet:async()=>{},loadFinanceWorkspace:async()=>{c.financeCalls=(c.financeCalls||0)+1;}};
 vm.createContext(c);vm.runInContext(source,c);return{c,calls,timers,events,handlers,node,store,state,authState,api:()=>c.window.ZetSlayAutoRefresh,advance:ms=>time+=ms,active:v=>active=v,route:v=>route=v,editing:v=>editing=v};
}
const content=at=>({workspaceId:'w',storeId:'42',observedAt:at,profile:{id:'42'},orders:[{id:'new'}],messages:[],lots:[],balance:{availableMinor:100,currency:'RUB'}});
const envelope=c=>({schema:1,workspaceId:'w',storeId:'42',observedAt:c.observedAt,content:c,sync:{status:'ok'}});
test('automatic refresh uses only cache GETs, never live sync; unchanged snapshots avoid rendering',async()=>{
 const f=fixture();await flush();assert.equal(f.calls.length,1);assert.match(f.calls[0].path,/content\/latest\?storeId=42/);assert.equal(f.calls[0].options.authenticated,true);assert.ok(!f.calls[0].options.method);assert.equal(f.c.stopped,true);await f.api().refresh();assert.equal(f.calls.length,1);f.advance(15000);await f.api().refresh();assert.equal(f.calls.length,2);assert.equal(f.state.storeContent.observedAt,null);assert.match(f.node.textContent,/Ожидаем/);
});
test('new snapshots appear without clicking and preserve conversation, filters and drafts',async()=>{
 const f=fixture();await flush();f.c.apiRequest=async()=>envelope(content('2026-10-16T10:01:01Z'));f.advance(15000);await f.api().refresh();assert.equal(f.state.storeContent.orders[0].id,'new');assert.equal(f.store.metrics.balance,'100');assert.equal(f.c.messagesPageState.selectedId,'buyer');assert.equal(f.c.messagesPageState.query,'search');assert.equal(f.c.messagesActions.drafts.get('buyer'),'draft');assert.equal(f.c.overviewState.error,'');assert.match(f.node.textContent,/включено/);assert.match(f.node.title,/МСК/);
});
test('hidden tabs, offline sessions, inactive plans, disconnected stores and irrelevant views do not poll',async()=>{
 const f=fixture();await flush();f.advance(15000);
 for(const [off,on] of [[()=>f.c.document.hidden=true,()=>f.c.document.hidden=false],[()=>f.c.navigator.onLine=false,()=>f.c.navigator.onLine=true],[()=>f.active(false),()=>f.active(true)],[()=>f.store.status='blocked',()=>f.store.status='connected_read_only'],[()=>f.route('plugins'),()=>f.route('dashboard')]]){off();await f.api().refresh();assert.equal(f.calls.length,1);on();}
 await f.api().refresh();assert.equal(f.calls.length,2);
});
test('returning to a visible tab resumes once; concurrent triggers share the request',async()=>{
 const f=fixture();await flush();let finish;f.c.apiRequest=async()=>{f.calls.push({});return new Promise(r=>finish=r);};f.advance(15000);f.c.document.hidden=true;f.events.visibilitychange();f.c.document.hidden=false;f.events.visibilitychange();const pending=f.api().refresh();const another=f.api().refresh();assert.equal(f.calls.length,2);
 finish?.({schema:1,workspaceId:'w',storeId:'42',content:null});await pending;await another;
});
test('errors keep old data and retry with bounded backoff without a blocking spinner',async()=>{
 const f=fixture();await flush();f.state.storeContent=content('2026-10-16T10:00:00Z');f.c.apiRequest=async()=>{f.calls.push({});throw Error('network');};f.advance(15000);await f.api().refresh();assert.equal(f.api().diagnostics().failures,1);assert.equal(f.state.storeContent.orders[0].id,'new');assert.match(f.node.textContent,/задерживается/);f.advance(15000);await f.api().refresh();assert.equal(f.calls.length,2);f.advance(15000);f.c.apiRequest=async()=>envelope(content('2026-10-16T10:01:30Z'));await f.api().refresh();assert.equal(f.api().diagnostics().failures,0);assert.equal(f.state.storeContent.observedAt,'2026-10-16T10:01:30Z');
});
test('a hanging cache read has a whole-request deadline even if abort is ignored',async()=>{
 const f=fixture();await flush();f.c.apiRequest=()=>new Promise(()=>{});f.advance(15000);const pending=f.api().refresh();await flush();const deadline=[...f.timers.values()].find(t=>t.ms===12000);assert.ok(deadline);deadline.fn();await pending;assert.equal(f.api().diagnostics().pending,false);assert.equal(f.api().diagnostics().failures,1);
});
test('logout cancels waiting and late data cannot reach a new account',async()=>{
 const f=fixture();await flush();let finish;f.c.apiRequest=()=>new Promise(r=>finish=r);f.advance(15000);const pending=f.api().refresh();await flush();f.c.resetAccountData();f.c.sessionGeneration++;f.authState.workspace.id='other';f.authState.token='other-token';await pending;finish(envelope(content('2026-10-16T10:01:30Z')));await flush();assert.equal(f.state.storeContent.observedAt,null);assert.equal(f.api().diagnostics().pending,false);
});
test('foreign or malformed cache responses and slower snapshots never overwrite current data',async()=>{
 for(const change of [d=>d.workspaceId='other',d=>d.content.storeId='other',d=>d.content.messages=null,d=>d.content.observedAt='invalid']){const f=fixture();await flush();f.state.storeContent=content('2026-10-16T10:01:00Z');f.c.apiRequest=async()=>{const d=envelope(content('2026-10-16T10:01:30Z'));change(d);return d;};f.advance(15000);await f.api().refresh();assert.equal(f.state.storeContent.observedAt,'2026-10-16T10:01:00Z');assert.equal(f.api().diagnostics().failures,1);}
 const f=fixture();await flush();f.state.storeContent=content('2026-10-16T10:01:00Z');f.c.apiRequest=async()=>envelope(content('2026-10-16T10:00:00Z'));f.advance(15000);await f.api().refresh();assert.equal(f.state.storeContent.observedAt,'2026-10-16T10:01:00Z');
});
test('open editors and a manual live refresh defer cache application',async()=>{
 const f=fixture();await flush();f.advance(15000);f.editing(true);await f.api().refresh();assert.equal(f.calls.length,1);f.editing(false);f.c.storeContentSyncFlight={};await f.api().refresh();assert.equal(f.calls.length,1);f.c.storeContentSyncFlight=null;
 let finish;f.c.apiRequest=()=>new Promise(r=>finish=r);const pending=f.api().refresh();await flush();f.editing(true);finish(envelope(content('2026-10-16T10:01:01Z')));await pending;assert.equal(f.state.storeContent.observedAt,null);
});
test('finance reloads at most once per minute and never interrupts expense editing',async()=>{
 const f=fixture();await flush();f.route('finance');f.advance(60000);await f.api().refresh();assert.equal(f.c.financeCalls,1);f.advance(15000);await f.api().refresh();assert.equal(f.c.financeCalls,1);f.advance(60000);f.c.financeUi.dialog={};await f.api().refresh();assert.equal(f.c.financeCalls,1);f.c.financeUi.dialog=null;f.advance(15000);await f.api().refresh();assert.equal(f.c.financeCalls,2);
});
test('diagnostics extend existing diagnostics without exposing token or buyer data',async()=>{
 const f=fixture();await flush();const d=f.c.window.zetslaySyncDiagnostics();assert.equal(d.version,'old');assert.equal(d.automatic.intervalSeconds,15);assert.ok(!JSON.stringify(d).includes('token'));assert.ok(!JSON.stringify(d).includes('buyer'));
});
