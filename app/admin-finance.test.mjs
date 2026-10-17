import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./admin-finance.js',import.meta.url),'utf8');
const panel=readFileSync(new URL('./admin-panel.js',import.meta.url),'utf8');
function report(){return {range:{dateFrom:'2026-10-01',dateTo:'2026-10-17',bucket:'day'},observedAt:'2026-10-17T12:00:00Z',metrics:{profitMinor:-5000,salesMinor:10000,expensesMinor:15000,purchasesCount:2,buyers:1,subscriptionCount:1,subscriptionMinor:4000,pluginCount:1,pluginMinor:6000,topupsMinor:100000,chargebacksMinor:2000,cashFlowMinor:83000,eventsCount:151,unclassifiedCount:0},series:[{day:'2026-10-01',salesMinor:10000,expensesMinor:15000,profitMinor:-5000}],wallets:{unspentMinor:88000,debtMinor:0},payments:{pending:1,uncertain:1,failed:0},expenses:[],events:[]};}
function harness(){
 const root={innerHTML:''},nav={hidden:false},listeners={},calls=[];
 const c=vm.createContext({Intl,Date,URLSearchParams,crypto:{randomUUID:()=> 'a0000000-0000-4000-8000-000000000001'},FormData:class{constructor(form){this.values=form.values;}get(key){return this.values[key];}},authState:{token:'owner',user:{telegramUserId:'5062414502'}},sessionGeneration:1,state:{plugins:[]},location:{hash:'#admin'},escapeHtml:v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]),humanError:e=>e.message,setView(){},document:{querySelector:()=>root,querySelectorAll:()=>[nav],addEventListener:(kind,listener)=>(listeners[kind]||=[]).push(listener)},apiRequest:async(path,options)=>{calls.push({path,options});return report();}});
 vm.runInContext(panel,c);vm.runInContext(source,c);
 return {c,root,calls,run:text=>vm.runInContext(text,c),submit:async form=>{for(const listener of listeners.submit||[])await listener({target:{closest:selector=>selector===form.selector?form:null},preventDefault(){}});}};
}
test('finance tab fetches the owner endpoint with the selected period, without changing balances',async()=>{
 const h=harness();await h.run("adminUi.tab='finance';adminFinanceUi.period='7d';adminLoad()");
 assert.equal(h.calls[0].path,'/api/v1/admin/finance?period=7d');assert.equal(h.calls[0].options.authenticated,true);assert.equal(h.calls[0].options.method,undefined);assert.match(h.root.innerHTML,/Прибыль по учтённым расходам/);assert.match(h.root.innerHTML,/Денежный поток/);assert.match(h.root.innerHTML,/0 из 151/);
 assert.match(h.root.innerHTML,/Средства пользователей сейчас/);assert.match(h.root.innerHTML,/Комиссии и налоги не подставляются автоматически/);
});
test('negative profit and genuine zero stay visible; all provider text is escaped',()=>{
 const h=harness();h.c.fixture=report();h.c.fixture.expenses=[{id:'one',note:'<img src=x onerror=alert(1)>',amountMinor:15000,category:'hosting',incurredAt:'2026-10-16T21:00:00Z',voided:false}];h.c.fixture.events=[{id:'event',kind:'expense',note:'<script>secret</script>',deltaMinor:-15000,at:'2026-10-17T12:00:00Z'}];
 h.run('adminFinanceUi.report=fixture');const html=h.run('adminFinanceMarkup()');assert.match(html,/is-negative/);assert.match(html,/−50|\-50/);assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);assert.doesNotMatch(html,/<img|<script|NaN|Infinity/);
 assert.equal(h.run('adminFinanceMoney(0)').replaceAll('\u00a0',' '),'0,00 ₽');assert.equal(h.run('adminFinanceMoney(null)'),'—');assert.doesNotMatch(h.run('adminFinanceChart([{day:"2026-10-17",salesMinor:0,profitMinor:0,expensesMinor:0}])'),/NaN|Infinity/);
});
test('period/account switches discard old private results and reset pending expense data',async()=>{
 const h=harness();let resolve;h.c.apiRequest=()=>new Promise(r=>resolve=r);const pending=h.run("adminUi.tab='finance';adminLoad()");
 h.run("adminFinanceUi.expenseRequest={note:'PRIVATE_EXPENSE'};authState.token='other';authState.user={telegramUserId:'123'};sessionGeneration++;adminReset()");resolve(report());await pending;
 assert.equal(h.run('adminFinanceUi.report'),null);assert.equal(h.run('adminFinanceUi.expenseRequest'),null);assert.doesNotMatch(h.root.innerHTML,/PRIVATE_EXPENSE|Прибыль по/);
});
test('a lost expense response retains the same UUID and exact kopecks for safe retry',async()=>{
 const h=harness(),requests=[];h.run("adminUi.tab='finance'");h.c.apiRequest=async(path,options)=>{if(options?.method==='POST'){requests.push(structuredClone(options.body));if(requests.length===1)throw Error('Network timeout');return {expense:{}};}return report();};
 const form={selector:'[data-admin-finance-expense]',values:{amount:'499,90',category:'hosting',date:'2026-10-17',note:'VPS October'}};
 await h.submit(form);assert.equal(h.run('adminFinanceUi.expenseRequest.amountMinor'),49990);assert.equal(h.run('adminFinanceUi.posting'),false);
 await h.submit(form);assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);assert.equal(h.run('adminFinanceUi.expenseRequest'),null);assert.equal(h.run('adminFinanceUi.report.metrics.salesMinor'),10000);
});
test('MFA rejection leaves an editable expense and cannot claim it was saved',async()=>{
 const h=harness();h.run("adminUi.tab='finance'");h.c.apiRequest=async()=>{throw Object.assign(Error('Enable 2FA'),{code:'MFA_ENROLL_REQUIRED'});};
 await h.submit({selector:'[data-admin-finance-expense]',values:{amount:'1',category:'hosting',date:'2026-10-17',note:'VPS October'}});
 assert.equal(h.run('adminFinanceUi.expenseRequest'),null);assert.equal(h.run('adminFinanceUi.message'),'Enable 2FA');assert.equal(h.run('adminFinanceUi.posting'),false);
 assert.doesNotMatch(source,/localStorage|sessionStorage/);
});
