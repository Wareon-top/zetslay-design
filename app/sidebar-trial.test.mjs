import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('./sidebar-trial.js',import.meta.url),'utf8');
const available={state:'available',durationHours:72,startedAt:null,expiresAt:null,remainingSeconds:0,serverNow:'2030-01-01T00:00:00Z'};
const active={...available,state:'active',startedAt:'2030-01-01T00:00:00Z',expiresAt:'2030-01-04T00:00:00Z',remainingSeconds:259200};
function harness(api=async()=>available,{signedIn=true,missing=false}={}) {
 const nodes=new Map(),calls=[],events=new Map();
 const node=key=>{if(!nodes.has(key))nodes.set(key,{textContent:'',hidden:false,disabled:false,dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v},replaceChildren(value){this.textContent=value},addEventListener(type,fn){events.set(key+':'+type,fn)}});return nodes.get(key)};
 const root={dataset:{},querySelector:node};
 const context=vm.createContext({Date,document:{hidden:false,querySelector:s=>missing?null:s==='[data-sidebar-trial]'?root:node(s),createTextNode:String,addEventListener(type,fn){events.set(type,fn)}},setInterval(fn){events.set('timer',fn)},authState:{user:signedIn?{id:'u'}:null,token:signedIn?'token':'',workspace:{id:'w',plan:{id:null,active:false}}},sessionGeneration:1,state:{onboarding:{state:'plan_required'}},onboardingRevision:0,apiRequest:async(path,options)=>{calls.push([path,options]);return api(path,options)},renderDashboard(){},renderTelegramOnboarding(){},renderBilling(){},setView(view){calls.push(['route',view])},setAuthModal(open){calls.push(['auth',open])},showToast(...args){calls.push(['toast',...args])}});
 const run=code=>vm.runInContext(code,context);run(source);
 return {run,context,calls,node,root,events,click:()=>run('sidebarTrialClick()'),async ready(){for(let i=0;i<10;i++)await Promise.resolve()}};
}
test('card follows the reference design and replaces only the support promotion',()=>{
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8'),css=readFileSync(new URL('./sidebar-trial.css',import.meta.url),'utf8');
 assert.doesNotMatch(html,/class="support-card"/);assert.match(html,/data-sidebar-trial/);assert.match(html,/data-trial-metric>3/);
 assert.match(html,/class="user-card"/);assert.match(css,/radial-gradient/);assert.match(css,/clip-path: polygon/);assert.match(css,/prefers-reduced-motion/);
});
test('startup checks eligibility with GET only; activation requires an explicit click',async()=>{
 const app=harness(async(_path,options)=>options.method==='POST'?{trial:active,workspace:{id:'w',plan:{id:'trial_3d',active:true}},onboarding:{state:'telegram_bot_required'}}:available);
 await app.ready();assert.equal(app.calls.length,1);assert.equal(app.calls[0][1].method,undefined);assert.equal(app.node('[data-trial-action]').textContent,'Начать бесплатно');
 app.click();app.click();await app.ready();assert.equal(app.calls.filter(c=>c[1]?.method==='POST').length,1);
 assert.equal(app.context.authState.workspace.plan.id,'trial_3d');assert.equal(app.context.state.onboarding.state,'telegram_bot_required');assert.equal(app.node('[data-trial-label]').textContent,'часов осталось');
 assert.equal(app.calls.filter(c=>c[0]==='/api/v1/subscription/trial').length,2);
});
test('countdown uses server remaining time; expired and paid plans navigate without writes',async()=>{
 const app=harness(async()=>active);await app.ready();
 app.context.data=active;const model=ms=>JSON.parse(JSON.stringify(app.run(`sidebarTrialModel(data,${ms})`)));
 assert.equal(model(0).metric,'72');assert.equal(model(71*3600000+60000).label,'минут осталось');assert.equal(model(72*3600000).destination,'finance');
 const used=harness(async()=>({...available,state:'used'}));await used.ready();used.click();assert.deepEqual(used.calls.at(-1),['route','finance']);assert.equal(used.calls.filter(c=>c[1]?.method==='POST').length,0);
 const paid=harness(async()=>({...available,state:'plan_active'}));await paid.ready();paid.click();assert.deepEqual(paid.calls.at(-1),['route','finance']);
});
test('failed activation is verified by GET before a second POST; recovery updates the workspace',async()=>{
 let bought=false;const app=harness(async(_path,options)=>{if(options.method==='POST'){bought=true;throw Error('lost response')}return bought?{...active,onboarding:{state:'telegram_bot_required'}}:available});
 await app.ready();app.click();await app.ready();assert.match(app.node('[data-trial-status]').textContent,/перед повтором/);
 app.click();await app.ready();assert.equal(app.calls.filter(c=>c[1]?.method==='POST').length,1);assert.equal(app.context.authState.workspace.plan.active,true);assert.equal(app.context.state.onboarding.state,'telegram_bot_required');
});
test('late activation cannot write into a signed-out or different account',async()=>{
 let finish;const app=harness(async(_path,options)=>options.method==='POST'?new Promise(resolve=>{finish=resolve}):available);
 await app.ready();app.click();await app.ready();app.run("authState.token='other';authState.workspace={id:'other',plan:{active:false}};sessionGeneration++;renderDashboard()");
 finish({trial:active,workspace:{id:'w',plan:{id:'trial_3d',active:true}}});await app.ready();assert.equal(app.context.authState.workspace.id,'other');assert.equal(app.context.authState.workspace.plan.active,false);assert.equal(app.calls.filter(c=>c[0]==='toast').length,0);
 app.run("authState.token='';authState.user=null;renderDashboard()");app.click();assert.deepEqual(app.calls.at(-1),['auth',true]);
});
test('unavailable or malformed responses show a retry without claiming active access',async()=>{
 for(const data of [null,{...active,durationHours:999},{...active,expiresAt:'2035-01-01'},{...active,remainingSeconds:999999999}]){
  const app=harness(async()=>data);await app.ready();assert.equal(app.root.dataset.state,'error');assert.equal(app.node('[data-trial-action]').textContent,'Повторить проверку');assert.equal(app.context.authState.workspace.plan.active,false);
 }
 const failed=harness(async()=>{throw Error('HTTP_404')});await failed.ready();assert.equal(failed.calls.length,1);failed.events.get('timer')();await failed.ready();assert.equal(failed.calls.length,1);
});
test('logout clears account data; a missing mount makes no requests',async()=>{
 const app=harness(async()=>active);await app.ready();app.run("authState.token='';authState.user=null;renderDashboard()");
 assert.equal(app.run('sidebarTrialUi.data'),null);assert.equal(app.node('[data-trial-action]').textContent,'Войти и попробовать');
 const absent=harness(async()=>{throw Error('must not request')},{missing:true});await absent.ready();assert.equal(absent.calls.length,0);
});
