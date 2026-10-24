import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./payments.js',import.meta.url),'utf8');
function harness(){const listeners={},nodes=new Map(),calls=[],pending=new Map(),authState={user:{id:'u'},workspace:{id:'w',plan:{active:false}},token:null};let data={balanceMinor:14900,payments:[],ledger:[],enabled:true,methods:[2],publication:{version:'2026-10-16-v1',hash:'a'.repeat(64)}};const root={hidden:false,querySelector:s=>nodes.get(s)||null,append(n){nodes.set('[data-payments-history]',n);}};
 function node(){return {dataset:{},innerHTML:'',textContent:'',isConnected:true};}for(const s of ['[data-service-wallet]','[data-payments-state]','[data-payments-history]'])nodes.set(s,node());
 const context=vm.createContext({URL,Date,Intl,JSON,AbortController,AbortSignal,setTimeout,clearTimeout,setInterval:()=>1,document:{hidden:false,querySelector:s=>s==='[data-billing]'?root:null,createElement:node,addEventListener:(type,fn)=>{listeners[type]=fn;}},window:{},sessionStorage:{setItem:(k,v)=>pending.set(k,v),getItem:k=>pending.get(k),removeItem:k=>pending.delete(k)},authState,apiRequest:async(path,options)=>{calls.push({path,options});return data;},humanError:e=>e.message,renderBilling:()=>true,setView:()=>{},resetAccountData:()=>{},openBillingDialog:()=>{},BILLING_PLAN_NAMES:{start:'Старт'},subscriptionLoad:async()=>{},subscriptionApply:()=>{},loadPluginCatalog:async()=>{}});
 vm.runInContext(source,context);authState.token='t';const run=s=>vm.runInContext(s,context);return {context,authState,nodes,calls,root,run,setData:v=>data=v,listen:listeners};
}
test('topup parse uses exact kopecks and max 10,000 without coercion',()=>{const h=harness();for(const [v,n] of [['149',14900],['1,01',101],['10000',1000000]]){h.context.value=v;assert.equal(h.run('paymentsParseAmount(value)'),n);}for(const value of ['0.99','10000.01','1e3','-1','1.001','',null]){h.context.value=value;assert.equal(h.run('paymentsParseAmount(value)'),null);}});
test('only HTTPS Platega links may be rendered as a payment link',()=>{const h=harness();for(const value of ['javascript:alert(1)','https://platega.io.evil.test/','https://u@pay.platega.io','http://pay.platega.io']){h.context.value=value;assert.equal(h.run('paymentsLink(value)'),null);}assert.equal(h.run("paymentsLink('https://pay.platega.io/?id=one')"),'https://pay.platega.io/?id=one');});
test('auth changes discard stale balance, payment history, errors and pending requests',async()=>{const h=harness();await h.run('paymentsLoad(true)');assert.match(h.nodes.get('[data-service-wallet]').textContent,/149/);h.run("paymentsPending({requestId:'12345678-1234-1234-1234-123456789abc',kind:'subscription'})");h.authState.user={id:'other'};h.authState.token='new';h.run('paymentsReset()');assert.equal(h.run('paymentsUi.pendingPurchase'),null);assert.equal(h.nodes.get('[data-service-wallet]').textContent,'—');});
test('late read cannot expose the preceding account balance',async()=>{const h=harness();let resolve;h.context.apiRequest=()=>new Promise(r=>resolve=r);const task=h.run('paymentsLoad(true)');h.authState.user={id:'other'};h.authState.token='new';h.run('paymentsReset()');resolve({balanceMinor:9900,payments:[],ledger:[]});await task;assert.equal(h.nodes.get('[data-service-wallet]').textContent,'—');});
test('history escapes provider fields and never trusts an arbitrary redirect',async()=>{const h=harness();h.setData({balanceMinor:0,enabled:true,ledger:[{kind:'plugin',deltaMinor:-1,pluginId:'<img src=x onerror=alert(1)>',at:'bad'}],payments:[{id:'<img src=x>',amountMinor:10000,status:'pending',redirect:'javascript:alert(1)',createdAt:'bad'}]});await h.run('paymentsLoad(true)');const html=h.nodes.get('[data-payments-history]').innerHTML;assert.doesNotMatch(html,/<img|javascript:/);assert.match(html,/&lt;img/);assert.equal(h.nodes.get('[data-service-wallet]').textContent,'0,00 ₽');});
test('no return URL parameter can activate a plan or credit a wallet',()=>{const h=harness();assert.equal(h.authState.workspace.plan.active,false);assert.equal(h.calls.some(c=>c.path.includes('purchase')||c.path.includes('topup')),false);h.context.location={search:'?payment=one&status=confirmed&paid=true'};assert.equal(h.authState.workspace.plan.active,false);});
test('uncertain purchase persists its idempotency key and definite refusal can be cleared',()=>{const h=harness();h.run("paymentsPending({kind:'plugin',requestId:'12345678-1234-1234-1234-123456789abc'})");h.run('paymentsUi.pendingPurchase=null;paymentsRestorePending()');assert.equal(h.run('paymentsUi.pendingPurchase.kind'),'plugin');assert.equal(h.run("paymentsDefiniteFailure({code:'INSUFFICIENT_BALANCE'})"),true);assert.equal(h.run("paymentsDefiniteFailure({code:'REQUEST_RESULT_UNKNOWN'})"),false);});
test('entry points pay subscription and plugin only through wallet; provider endpoint only tops up',()=>{assert.match(source,/\/api\/v1\/payments\/topup/);assert.match(source,/\/api\/v1\/payments\/purchase/);assert.match(source,/kind:pluginId\?'plugin':'subscription'/);const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');assert.equal((html.match(/src="payments\.js\?/g)||[]).length,1);assert.match(html,/data-service-wallet/);assert.match(html,/data-payments-state/);const plugin=readFileSync(new URL('./plugin-purchase-options.js',import.meta.url),'utf8');assert.match(plugin,/data-plugin-buy=/);assert.match(plugin,/только через Platega/);});
test('unpaid topups offer abandonment in history; abandoned links stay hidden and late paid receipts stay visible',async()=>{
 const h=harness(),p={id:'11111111-1111-1111-1111-111111111111',amountMinor:14900,status:'pending',redirect:'https://pay.platega.io/?id=one',createdAt:'2030-01-01'};
 const data={balanceMinor:0,enabled:true,payments:[p],ledger:[]};h.setData(data);await h.run('paymentsLoad(true)');
 let html=h.nodes.get('[data-payments-history]').innerHTML;assert.match(html,/data-payment-abandon=/);assert.match(html,/Не буду оплачивать/);
 h.setData({...data,payments:[{...p,abandonedAt:'2030-01-02'}]});await h.run('paymentsLoad(true)');html=h.nodes.get('[data-payments-history]').innerHTML;
 assert.match(html,/Закрыт вами/);assert.doesNotMatch(html,/data-payment-abandon=|href="https:\/\/pay\.platega/);
 h.setData({...data,payments:[{...p,status:'confirmed',abandonedAt:'2030-01-02',receipt:{}}]});await h.run('paymentsLoad(true)');html=h.nodes.get('[data-payments-history]').innerHTML;
 assert.match(html,/Зачислен/);assert.match(html,/data-payment-confirmation=/);
});
test('unfinished modal handles unknown creation without an unsafe link and escapes fields',()=>{
 const h=harness();h.context.rows=[{id:'<img src=x>',amountMinor:14900,status:'creation_unknown',redirect:'javascript:alert(1)',createdAt:'bad'}];
 const html=h.run('paymentsUnfinishedMarkup(rows)');assert.match(html,/Не буду оплачивать/);assert.match(html,/Требует проверки/);assert.doesNotMatch(html,/<img|javascript:/);
});
test('abandon posts only the selected intent, reloads server balance and never purchases',async()=>{
 const h=harness();await h.run('paymentsLoad(true)');const id='11111111-1111-1111-1111-111111111111';
 h.context.button={disabled:false,isConnected:true};h.context.apiRequest=async(path,options)=>{
  h.calls.push({path,options});return path.endsWith('/abandon')?{payment:{id,status:'pending',abandonedAt:'2030-01-02'}}:{balanceMinor:14900,payments:[],ledger:[],enabled:true};
 };
 await h.run(`paymentsAbandon('${id}',button)`);
 const call=h.calls.find(c=>c.path.endsWith('/abandon'));assert.ok(call);assert.equal(call.options.method,'POST');assert.equal(Object.keys(call.options.body).length,0);
 assert.equal(h.calls.some(c=>c.path.endsWith('/purchase')||c.path.endsWith('/topup')),false);assert.match(h.nodes.get('[data-service-wallet]').textContent,/149/);
});
test('late abandon result cannot expose or reopen the previous account',async()=>{
 const h=harness();await h.run('paymentsLoad(true)');let resolve;h.context.apiRequest=()=>new Promise(r=>resolve=r);h.context.button={disabled:false,isConnected:true};
 const task=h.run("paymentsAbandon('11111111-1111-1111-1111-111111111111',button)");h.authState.user={id:'other'};h.authState.token='other';h.run('paymentsReset()');
 resolve({payment:{id:'11111111-1111-1111-1111-111111111111',status:'pending',abandonedAt:'2030-01-02'}});await task;
 assert.equal(h.run('paymentsUi.data'),null);assert.equal(h.nodes.get('[data-service-wallet]').textContent,'—');
});
