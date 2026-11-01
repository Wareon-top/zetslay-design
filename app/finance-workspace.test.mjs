import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const files=['finance-model.js','finance-workspace.js'];const scripts=files.map(f=>readFileSync(new URL('./'+f,import.meta.url),'utf8')).join('\n');
const at='2026-10-15T12:00:00Z';
const row=(id,extra={})=>({id,product:'Товар '+id,buyer:'Player',status:'completed',currency:'RUB',createdAt:'2026-10-15T09:00:00Z',sourceDateLabel:'',included:true,amountMinor:10000,grossMinor:10000,refundMinor:0,revenueMinor:10000,costMinor:3000,feeMinor:500,otherMinor:100,taxMinor:400,knownExpensesMinor:4000,expensesMinor:4000,profitMinor:6000,autoCostMinor:null,costSource:'manual',manualCostMinor:3000,version:1,reasons:[],...extra});
const report=orders=>({schema:1,storeId:'42',generatedAt:at,observedAt:at,orders,archive:{total:orders.length,truncated:false}});
function harness(){
 let mounted=false;const nodes=new Map(),listeners=new Map();const node=name=>{if(!nodes.has(name))nodes.set(name,{hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},classList:{toggle(){}},querySelectorAll(){return[];}});return nodes.get(name);};
 const periods=['today','yesterday','last7','last30','week','month','all','custom','undated'].map(p=>{const n=node('period-'+p);n.dataset.financePeriod=p;return n;});
 const root={hidden:false,setAttribute(){},querySelector:node,querySelectorAll:s=>s==='[data-finance-period]'?periods:[]};
 const document={querySelector:s=>mounted&&s==='[data-finance-workspace]'?root:null,querySelectorAll:()=>[],addEventListener:(type,fn)=>{listeners.set(type,[...(listeners.get(type)||[]),fn]);}};
 const authState={user:{id:'one'},workspace:{id:'w',plan:{active:true}},token:'one'},store={id:'42',displayName:'Shop'};
 const context=vm.createContext({document,window:{addEventListener(){}},location:{hash:'#finance'},Date:class extends Date{static now(){return Date.parse(at);}},setTimeout,clearTimeout,AbortController,URL,Blob,authState,sessionGeneration:1,selectedStore:()=>store,subscriptionActive:()=>authState.workspace.plan.active,apiRequest:async()=>report([]),humanError:e=>e.message,icon:()=>'<svg></svg>'});
 vm.runInContext(scripts,context);mounted=true;const run=code=>vm.runInContext(code,context);
 const model=(rows,filters={})=>{context.input=report(rows);context.filters=filters;return JSON.parse(JSON.stringify(run('buildFinanceModel(input,filters)')));};
 return {context,run,node,root,authState,store,listeners,model,load:()=>run('loadFinanceWorkspace({force:true})'),render(rows){context.reportInput=report(rows);run('financeUi.scope=financeScope();financeUi.data=reportInput;renderFinanceWorkspace()');}};
}
test('income, refunds, all costs and losses remain exact integer minor units without mixing currencies',()=>{
 const f=harness(),m=f.model([row('A'),row('REFUND',{status:'refunded',refundMinor:10000,revenueMinor:0,profitMinor:-4000}),row('USD',{currency:'USD',profitMinor:999})]);
 assert.equal(m.stats.gross,20000);assert.equal(m.stats.income,10000);assert.equal(m.stats.refundAmount,10000);assert.equal(m.stats.expenses,8000);assert.equal(m.stats.profit,2000);assert.equal(m.stats.orders,2);assert.equal(f.model([row('USD',{currency:'USD'})],{currency:'USD'}).currency,'USD');
});
test('incomplete costs never show full profit as zero and coverage reports the computed subset',()=>{
 const f=harness(),m=f.model([row('A'),row('UNKNOWN',{expensesMinor:null,profitMinor:null,costMinor:null,knownExpensesMinor:1000,reasons:['COST_MISSING']})]);
 assert.equal(m.stats.profit,null);assert.equal(m.stats.expenses,null);assert.equal(m.stats.knownProfit,6000);assert.equal(m.stats.knownExpenses,5000);assert.equal(m.stats.profitKnownCount,1);assert.equal(m.stats.missing,1);
 f.render(m.orders);assert.equal(f.node('[data-finance-profit]').textContent,'—');assert.match(f.node('[data-finance-profit-note]').textContent,/1 из 2/);
});
test('Moscow daily and weekly boundaries exclude the prior instant, include today and keep undated separate',()=>{
 const f=harness(),rows=[row('BEFORE',{createdAt:'2026-10-14T20:59:59Z'}),row('START',{createdAt:'2026-10-14T21:00:00Z'}),row('UNKNOWN',{createdAt:null})];
 assert.deepEqual(f.model(rows,{period:'today'}).filtered.map(r=>r.id),['START']);assert.deepEqual(f.model(rows,{period:'yesterday'}).filtered.map(r=>r.id),['BEFORE']);assert.equal(f.model(rows,{period:'undated'}).stats.orders,1);
 const week=f.model([row('SUNDAY',{createdAt:'2026-10-11T20:59:59Z'}),row('MONDAY',{createdAt:'2026-10-11T21:00:00Z'})],{period:'week'});assert.deepEqual(week.filtered.map(r=>r.id),['MONDAY']);
});
test('custom range includes the final day, invalid ranges stay empty and calendar month crosses a year',()=>{
 const f=harness(),rows=[row('END',{createdAt:'2026-10-10T20:59:59Z'}),row('AFTER',{createdAt:'2026-10-10T21:00:00Z'})];
 assert.deepEqual(f.model(rows,{period:'custom',from:'2026-10-10',to:'2026-10-10'}).filtered.map(r=>r.id),['END']);assert.equal(f.model(rows,{period:'custom',from:'2026-10-11',to:'2026-10-10'}).stats.orders,0);
 f.context.input={...report([row('DEC',{createdAt:'2026-12-31T20:59:59Z'}),row('JAN',{createdAt:'2026-12-31T21:00:00Z'})]),generatedAt:'2027-01-02T12:00:00Z'};assert.equal(f.run("buildFinanceModel(input,{period:'month'}).filtered[0].id"),'JAN');
});
test('day, week and month aggregation preserves totals, fills empty days and keeps missing profit gaps',()=>{
 const f=harness(),rows=[row('A',{createdAt:'2026-10-12T10:00:00Z'}),row('B',{createdAt:'2026-10-13T10:00:00Z',profitMinor:null,expensesMinor:null})];
 const daily=f.model(rows,{period:'week'});assert.equal(daily.series.length,4);assert.equal(daily.series[2].orders,0);assert.equal(daily.series[1].profit,null);assert.equal(daily.series[2].profit,0);
 const weekly=f.model(rows,{period:'week',group:'week'});assert.equal(weekly.series.length,1);assert.equal(weekly.series[0].income,20000);assert.equal(weekly.series[0].profit,null);
 assert.equal(f.model(rows,{period:'month',group:'month'}).series[0].income,20000);
});
test('search and status affect the table, not period totals; pagination never drops matching orders',()=>{
 const f=harness(),rows=Array.from({length:26},(_,i)=>row('A'+i));
 const m=f.model(rows,{query:'A25',status:'completed'});assert.equal(m.filtered.length,1);assert.equal(m.stats.orders,26);
 assert.equal(f.model(rows,{page:3}).rows.length,6);assert.equal(f.model(rows,{page:99}).page,3);assert.equal(f.model(rows,{size:25}).rows.length,25);
});
test('order rows escape product, buyer, source dates and identifiers, including negative profit',()=>{
 const f=harness();f.render([row('A<svg>',{buyer:'<script>x</script>',product:'<img src=x>',createdAt:null,sourceDateLabel:'<img onerror=x>',profitMinor:-1})]);f.run("financeUi.period='undated';renderFinanceWorkspace()");
 const html=f.node('[data-finance-rows]').innerHTML;assert.doesNotMatch(html,/<script>|<img |<svg>/);assert.match(html,/&lt;img/);assert.match(html,/fin-negative/);assert.match(html,/A%3Csvg%3E/);
});
test('money input rejects signs, exponent notation, fractions over cents and unsafe values, accepting explicit zero',()=>{
 const f=harness();for(const value of ['-1','1e2','NaN','1.001','','999999999999999']){f.context.value=value;assert.equal(f.run('financeParseMoney(value)'),null);}
 for(const [value,expected] of [['0',0],['12,34',1234],['1.2',120]]){f.context.value=value;assert.equal(f.run('financeParseMoney(value)'),expected);}
});
test('CSV uses the same filtered rows, leaves unknown amounts empty and neutralizes spreadsheet formulas',()=>{
 const f=harness();f.context.rows=f.model([row('=HYPERLINK(1)',{buyer:' +cmd',product:'@SUM(A1)',profitMinor:null})]).filtered;
 const csv=f.run("financeCsv(rows,'RUB')");assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"\'=HYPERLINK(1)"'));assert.ok(csv.includes('"\' +cmd"'));assert.ok(csv.endsWith(';'));assert.ok(csv.includes('"\'@SUM(A1)"'));
});
test('report request is authenticated, duplicate loads share the active read, and a failure preserves the prior report',async()=>{
 const f=harness();let resolve,calls=0;f.context.apiRequest=(path,options)=>{calls++;assert.equal(path,'/api/v1/finance/report?storeId=42');assert.equal(options.authenticated,true);assert.equal(options.method,undefined);return new Promise(r=>resolve=r);};const first=f.load();await f.load();assert.equal(calls,1);resolve(report([row('A')]));await first;assert.equal(f.node('[data-finance-count]').textContent,'1');
 f.context.apiRequest=async()=>{throw Error('offline');};await f.load();assert.match(f.node('[data-finance-notice]').textContent,/offline.*предыдущий отчёт/);assert.equal(f.node('[data-finance-count]').textContent,'1');
});
test('late report cannot populate a changed account or store, and expired access clears private data',async()=>{
 const f=harness();let resolve;f.context.apiRequest=()=>new Promise(r=>resolve=r);const work=f.load();f.authState.user={id:'two'};f.authState.token='two';f.render([]);resolve(report([row('PRIVATE')]));await work;assert.ok(!f.node('[data-finance-rows]').innerHTML.includes('PRIVATE'));
 f.render([row('SECOND')]);f.store.id='99';f.run('renderFinanceWorkspace()');assert.equal(f.run('financeUi.data'),null);
 f.render([row('THIRD')]);f.authState.workspace.plan.active=false;f.run('renderFinanceWorkspace()');assert.equal(f.run('financeUi.data'),null);assert.equal(f.node('[data-finance-income]').textContent,'—');
});
test('wrong-store and malformed responses are rejected instead of replacing a valid report',async()=>{
 const f=harness();f.render([row('A')]);f.context.apiRequest=async()=>({...report([row('PRIVATE')]),storeId:'99'});await f.load();assert.ok(!f.node('[data-finance-rows]').innerHTML.includes('PRIVATE'));assert.match(f.node('[data-finance-notice]').textContent,/подтвердить/);
});
test('financial controls remain read-only except an explicit bookkeeping save; history limits and unknown dates are visible',()=>{
 const f=harness();f.render([row('A',{createdAt:null})]);f.run('financeUi.data.archive={total:6000,truncated:true};renderFinanceWorkspace()');assert.match(f.node('[data-finance-filter-note]').textContent,/6000/);assert.match(f.node('[data-finance-filter-note]').textContent,/без точной даты/);
 const source=readFileSync(new URL('./finance-workspace.js',import.meta.url),'utf8');assert.doesNotMatch(source,/apiRequest\(['"][^'"]*(?:purchase|rent|refund|withdraw|checkout)/);assert.match(source,/method:'POST',body:payload/);
});
