import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./launch-announcement.js',import.meta.url),'utf8');
const WEEK=7*86400000,flush=()=>new Promise(r=>setImmediate(r));
function fixture(storage=new Map()) {
 let time=Date.parse('2026-10-16T18:00:00Z'),route='dashboard',blocked=false,editing=false,sequence=0;
 const timers=new Map(),events={},windowEvents={},children=[];
 function node(){const handlers={};return{handlers,isConnected:true,innerHTML:'',setAttribute(){},querySelector:s=>({addEventListener:(k,fn)=>handlers[s+':'+k]=fn}),querySelectorAll(){return[];},contains(){return false;},remove(){this.isConnected=false;const i=children.indexOf(this);if(i>=0)children.splice(i,1);}};}
 const authState={user:{id:'user'},workspace:{id:'workspace'},token:'secret-token'};
 const c={console,Map,Date:class extends Date{static now(){return time;}},navigator:{},authState,sessionGeneration:1,learningUi:{data:{welcomeSeen:true},loading:false},
  document:{hidden:false,activeElement:{matches:()=>editing},body:{append:n=>children.push(n)},createElement:node,querySelector:s=>s==='[data-view].is-active'?{dataset:{view:route}}:s==='.app-shell'?{hidden:false,inert:false}:blocked?{}:null,addEventListener:(k,fn)=>events[k]=fn},
  window:{localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id),addEventListener:(k,fn)=>windowEvents[k]=fn},
  renderAuthState(){},renderDashboard(){},setView:v=>route=v,resetAccountData(){}};
 vm.createContext(c);vm.runInContext(source,c);
 return{c,storage,timers,children,events,windowEvents,authState,api:c.window.ZetSlayLaunchAnnouncement,advance:ms=>time+=ms,route:v=>route=v,blocked:v=>blocked=v,editing:v=>editing=v,async fire(){const entry=timers.entries().next().value;if(entry){timers.delete(entry[0]);entry[1].fn();}await flush();}};
}
test('waits for quiet delay and counts an actual show; dismissal survives reload for exactly seven days',async()=>{
 const f=fixture();assert.equal(f.api.diagnostics().visible,false);assert.equal(f.storage.size,0);assert.equal([...f.timers.values()][0].ms,3000);
 await f.fire();assert.equal(f.api.diagnostics().visible,true);assert.equal(f.storage.size,1);assert.ok(![...f.storage.values()][0].includes('secret-token'));
 f.children[0].handlers['.launch-close:click']();assert.equal(f.api.diagnostics().visible,false);
 const reload=fixture(f.storage);assert.equal(reload.timers.size,0);reload.advance(WEEK-1);reload.api.refresh();assert.equal(reload.timers.size,0);reload.advance(1);reload.api.refresh();await reload.fire();assert.equal(reload.api.diagnostics().visible,true);
});
test('hidden pages, non-dashboard routes, input and learning or payment overlays do not consume the announcement',async()=>{
 for(const change of [f=>f.c.document.hidden=true,f=>f.route('messages'),f=>f.blocked(true),f=>f.editing(true),f=>f.c.learningUi.loading=true,f=>{f.c.learningUi.data=null;}]){
  const f=fixture();change(f);await f.fire();assert.equal(f.children.length,0);assert.equal(f.storage.size,0);
  f.c.document.hidden=false;f.route('dashboard');f.blocked(false);f.editing(false);f.c.learningUi={data:{welcomeSeen:true},loading:false};f.api.refresh();await f.fire();assert.equal(f.children.length,1);
 }
});
test('rendering does not postpone the pending card; leaving the dashboard removes it without an early repeat',async()=>{
 const f=fixture(),first=[...f.timers.keys()][0];for(let i=0;i<20;i++)f.c.renderDashboard();assert.equal([...f.timers.keys()][0],first);
 await f.fire();f.c.setView('orders');assert.equal(f.children.length,0);f.c.setView('dashboard');assert.equal(f.timers.size,0);
});
test('a rotated token retains cadence; another account gets its own announcement and logout removes it',async()=>{
 const f=fixture();await f.fire();f.c.resetAccountData();f.authState.token='new-secret';f.c.sessionGeneration++;f.c.renderAuthState();assert.equal(f.timers.size,0);
 f.authState.user.id='second';f.c.renderAuthState();await f.fire();assert.equal(f.children.length,1);assert.equal(f.storage.size,2);
 f.c.resetAccountData();f.authState.user=null;f.authState.token='';f.c.renderAuthState();assert.equal(f.children.length,0);assert.equal(f.timers.size,0);
});
test('an account switch during an asynchronous cross-tab lock cannot show or mark the old account',async()=>{
 const f=fixture();let release;f.c.navigator.locks={request:(_,__,fn)=>new Promise(r=>{release=()=>{fn({});r();};})};await f.fire();assert.ok(release);
 f.c.resetAccountData();f.authState.user.id='other';f.c.sessionGeneration++;release();await flush();assert.equal(f.storage.size,0);assert.equal(f.children.length,0);
});
test('another tab cannot show the same announcement in the current week',async()=>{
 const storage=new Map(),first=fixture(storage),second=fixture(storage);await first.fire();await second.fire();assert.equal(first.children.length,1);assert.equal(second.children.length,0);
});
test('corrupt and far-future records do not hide the card; blocked storage uses per-page memory',async()=>{
 for(const raw of ['bad-json',JSON.stringify({campaign:'official-launch-2026-10',seenAt:Date.parse('2030-01-01')}),JSON.stringify({campaign:'old',seenAt:Date.parse('2026-10-16')})]){
  const f=fixture();f.storage.set('zetslay.announcement.official-launch-2026-10.["user","workspace"]',raw);await f.fire();assert.equal(f.children.length,1);
 }
 const f=fixture();f.c.window.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};await f.fire();f.children[0].handlers['.launch-close:click']();f.api.refresh();assert.equal(f.timers.size,0);
});
test('page suspension removes the card and cancels timers without erasing cadence',async()=>{
 const f=fixture();await f.fire();f.windowEvents.pagehide();assert.equal(f.children.length,0);f.windowEvents.pageshow();assert.equal(f.timers.size,0);assert.equal(f.storage.size,1);
});
