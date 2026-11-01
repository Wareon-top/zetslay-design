const http=require('node:http');
const {readFileSync,mkdirSync}=require('node:fs');
const {resolve,join}=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.ZETSLAY_PLAYWRIGHT_MODULE||'playwright');
const root=resolve(__dirname,'..'),output=process.env.ZETSLAY_BROWSER_OUTPUT||'/tmp/zetslay-admin-finance-previews';
mkdirSync(output,{recursive:true});
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app/styles.css"><link rel="stylesheet" href="/app/cabinet-ui.css"><link rel="stylesheet" href="/app/admin-panel.css"><link rel="stylesheet" href="/app/admin-finance.css"><style>main.admin-page{width:min(1320px,100%);padding:28px;margin:auto}.light{--bg:#f5f6f8;--surface:#fff;--white:#20232b;--muted:#687180;--line:#dfe3e9;--green:#19825c;--red:#c94656;--violet:#7860c8;color-scheme:light}@media(max-width:600px){main.admin-page{padding:16px}}</style></head><body><div class="app-shell"><main class="admin-page"><div data-admin-root></div></main></div><script>
const authState={token:'owner-fixture',user:{telegramUserId:'5062414502'}},state={plugins:[]};let sessionGeneration=1;
function escapeHtml(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
function setView(){}function humanError(e){return e.message}async function apiRequest(path,options={}){const r=await fetch(path,{method:options.method||'GET',headers:{'content-type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error?.message||'Request failed');return data.data;}
</script><script src="/app/admin-finance.js"></script><script src="/app/admin-panel.js"></script><script>adminUi.tab='finance';adminLoad();</script></body></html>`;
let expenses=[],posts=0,queries=[];
function report(period){
 const sales=period==='today'?14900:178700,expense=expenses.filter(e=>!e.voided).reduce((n,e)=>n+e.amountMinor,0),profit=sales-expense;
 return {range:{dateFrom:'2026-10-01',dateTo:'2026-10-17',bucket:'day'},observedAt:'2026-10-17T12:00:00Z',metrics:{salesMinor:sales,profitMinor:profit,expensesMinor:expense,purchasesCount:9,buyers:7,subscriptionCount:6,subscriptionMinor:118700,pluginCount:3,pluginMinor:60000,topupsMinor:250000,chargebacksMinor:10000,cashFlowMinor:240000-expense,eventsCount:15,unclassifiedCount:0},wallets:{unspentMinor:61300,debtMinor:0},payments:{pending:1,uncertain:0,failed:2},series:Array.from({length:17},(_,i)=>({day:'2026-10-'+String(i+1).padStart(2,'0'),salesMinor:i%3?14900:49900,expensesMinor:i===12?expense:0,profitMinor:(i%3?14900:49900)-(i===12?expense:0)})),events:[{id:'purchase-one',kind:'subscription',deltaMinor:-14900,at:'2026-10-17T12:00:00Z',userId:'usr_00000000-0000-4000-8000-000000000001',planId:'start'}],expenses};
}
const server=http.createServer(async(req,res)=>{
 if(req.url==='/'){res.setHeader('content-type','text/html; charset=utf-8');return res.end(html);}
 if(req.url.startsWith('/api/')){
  const url=new URL(req.url,'http://fixture'),chunks=[];for await(const chunk of req)chunks.push(chunk);let data;
  if(req.method==='POST'){
   const body=JSON.parse(Buffer.concat(chunks));
   if(url.pathname.endsWith('/void')){const e=expenses.find(e=>e.id===body.id);if(e)e.voided=true;data={expense:e};}
   else{posts++;if(!expenses.some(e=>e.id===body.id))expenses.push({...body,incurredAt:body.date+'T00:00:00+03:00',voided:false});data={expense:expenses.find(e=>e.id===body.id)};}
  }else{queries.push(url.searchParams.toString());data=report(url.searchParams.get('period'));}
  res.setHeader('content-type','application/json');return res.end(JSON.stringify({data}));
 }
 const path=join(root,req.url.split('?')[0]);if(!path.startsWith(root+'/')){res.statusCode=404;return res.end();}try{res.setHeader('content-type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'application/octet-stream');res.end(readFileSync(path));}catch{res.statusCode=404;res.end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const [name,viewport,light] of [['desktop',{width:1440,height:1100},false],['mobile',{width:390,height:844},false],['light',{width:1440,height:1100},true]]){
  expenses=[];posts=0;queries=[];const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('heading',{name:'Динамика выручки и прибыли',exact:true}).waitFor();if(light)await page.evaluate(()=>document.documentElement.classList.add('light'));
  assert.equal(await page.getByRole('button',{name:'Доходы проекта',exact:true}).getAttribute('aria-current'),'page');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Report fits '+name);
  await page.screenshot({path:join(output,name+'.png'),fullPage:true});
  await page.getByRole('button',{name:'Сегодня',exact:true}).click();await page.waitForFunction(()=>adminFinanceUi.report.metrics.salesMinor===14900);assert.equal(queries.at(-1),'period=today');
  const form=page.locator('[data-admin-finance-expense]');await form.locator('[name=amount]').fill('499,90');await form.locator('[name=note]').fill('VPS October');await form.getByRole('button',{name:'Добавить расход',exact:true}).click();await page.getByText('Расход сохранён.',{exact:false}).waitFor();
  assert.equal(posts,1);assert.equal(expenses[0].amountMinor,49990);assert.equal(await page.evaluate(()=>adminFinanceUi.report.metrics.profitMinor),-35090);
  await page.getByRole('button',{name:'Исключить',exact:true}).click();await page.getByText(/Исключён из расчёта/).waitFor();assert.equal(await page.evaluate(()=>adminFinanceUi.report.metrics.expensesMinor),0);
  const custom=page.locator('[data-admin-finance-period-form]');await custom.locator('[name=from]').fill('2026-10-01');await custom.locator('[name=to]').fill('2026-10-17');await custom.getByRole('button').click();await page.waitForFunction(()=>adminFinanceUi.report&&adminFinanceUi.period==='custom'&&!adminUi.busy);assert.match(queries.at(-1),/period=custom&from=2026-10-01&to=2026-10-17/);
  await page.evaluate(()=>{authState.token='';authState.user=null;sessionGeneration++;adminReset();});assert.equal(await page.locator('[data-admin-root]').textContent(),'');assert.deepEqual(errors,[]);await page.close();
 }console.log('Real Chromium: finance periods, exact expense saving, correction, logout and dark/light/mobile layouts passed. No external requests.');}
 finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
