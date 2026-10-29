import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const script=await readFile(new URL('../app/kosell-storefront.js',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,...process.env.KOSELL_CHROME?{executablePath:process.env.KOSELL_CHROME}:{}});
try{
 const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(15000);
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 const html=`<!doctype html><html><head><meta charset="utf-8"></head><body><main></main><script>
 const authState={token:'synthetic'};let sessionGeneration=1;
 const kosellUi={status:{storeId:'42',config:{markupPercent:20,manageOffers:true},offerCreationQueue:{pending:0}}};
 let kosellCatalogMarkup=()=>'<section>Шаблоны</section>';
 const escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const kosellMoney=(n,c)=>(n/100).toFixed(2)+' '+c,humanError=e=>e.message;
 const validateKosellCatalogPlan=p=>p&&Array.isArray(p.items)&&typeof p.token==='string';
 async function loadKosellStatus(){}
 async function apiRequest(path,options={}){const r=await fetch(path,{method:options.method||'GET',body:options.body?JSON.stringify(options.body):undefined,signal:options.signal});const body=await r.json();if(!r.ok)throw Object.assign(Error(body.error.message),{code:body.error.code});return body.data;}
 </script><script src="/kosell-storefront.js"></script><script>SF_READ_LIMITS.requestMs=300;document.querySelector('main').innerHTML=kosellCatalogMarkup(kosellUi.status);</script></body></html>`;
 const form={nodeId:'2500',categoryTitle:'Game · Аккаунты',fingerprint:'a'.repeat(64),currency:'RUB',fields:{'fields[platform]':'steam'},missing:[],controls:[{name:'fields[platform]',label:'Платформа',kind:'select',required:true,options:[{value:'steam',label:'Steam'}]}]};
 const plan={token:'plan',expiresAt:Date.now()+300000,currency:'RUB',activate:false,items:[1,2].map(productId=>({productId,productName:'Game '+productId,nodeId:'2500',categoryTitle:'Game · Аккаунты',hours:24,costMinor:100,priceMinor:120})),skipped:[]};
 const prep=revision=>({token:'saved',state:'preparing',revision,completed:revision,total:2});
 let categoryCalls=0,steps=0;const calls=[];
 await context.route('**/*',async route=>{
  const r=route.request(),url=new URL(r.url());
  if(url.pathname==='/app/')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
  if(url.pathname==='/kosell-storefront.js')return route.fulfill({contentType:'text/javascript; charset=utf-8',body:script});
  assert.ok(url.pathname.startsWith('/api/v1/plugins/kosell-rent/'));const action=url.pathname.split('/').at(-1);calls.push({action,method:r.method(),body:r.postDataJSON()});
  assert.ok(['storefront','category','start','step','status'].includes(action),'Unexpected write '+action);
  const respond=data=>route.fulfill({contentType:'application/json',body:JSON.stringify({data})});
  if(action==='storefront')return respond({products:[1,2].map(id=>({id,name:'Game '+id,nodeId:'2500',availableAccounts:2})),categories:[{nodeId:'2500',game:'Game',name:'Аккаунты'}],preparation:null});
  if(action==='category'){categoryCalls++;if(categoryCalls===1)return;return respond(form);}
  if(action==='start')return respond(prep(0));
  if(action==='step'){steps++;if(steps===1)return respond(prep(1));return;}
  if(action==='status'){assert.equal(r.method(),'GET');return respond({storeId:'42',storefrontPreparation:{...prep(2),state:'ready',plan}});}
 });
 await page.goto('https://zetslay.pro/app/');
 await page.locator('[data-sf-action="load"]').click();await page.locator('[data-sf-action="select-all"]').click();
 await page.waitForFunction(()=>!sfState().busy&&!!sfState().error);
 assert.equal(categoryCalls,1);assert.equal(await page.evaluate(()=>sfState().entries.length),2);
 assert.match(await page.locator('[data-sf-feedback]').textContent(),/не ответил вовремя/);
 await page.locator('[data-sf-action="retry-fields"]').click();
 await page.waitForFunction(()=>!sfState().busy&&sfState().entries.every(sfEntryReady));assert.equal(categoryCalls,3);
 await page.locator('[data-sf-reviewed]').check();await page.locator('[data-sf-action="prepare"]').click();
 await page.waitForFunction(()=>!sfState().busy&&!!sfState().error);
 assert.equal(await page.evaluate(()=>sfState().preparation.revision),1);assert.equal(await page.evaluate(()=>sfState().entries.length),2);
 await page.locator('[data-sf-action="resume"]').waitFor();await page.locator('[data-sf-action="recover"]').click();
 await page.getByRole('heading',{name:'Проверьте витрину перед созданием',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>sfState().plan.token),'plan');assert.equal(await page.evaluate(()=>sfState().entries.length),2);
 assert.equal(calls.filter(c=>c.action==='start').length,1);assert.equal(steps,2);assert.equal(calls.filter(c=>c.action==='status').length,1);assert.deepEqual(pageErrors,[]);
 console.log(JSON.stringify({categoryTimeout:true,batchPaused:true,selectedGamesRetained:true,missingFieldsRetry:true,planStepTimeout:true,revisionRetained:true,recoveredReadyPlanWithGet:true,creationPerformed:false,realAccountsUsed:false}));
 await context.close();
}finally{await browser.close();}
