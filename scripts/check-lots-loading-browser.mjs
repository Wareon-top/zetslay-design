// Real DOM/read-only UI scenario, synthetic API only. No live FunPay requests.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../',import.meta.url),index=await readFile(new URL('app/index.html',root),'utf8');
const begin=index.indexOf('<section class="view inventory"'),end=index.indexOf('<section class="view plugin-catalog"',begin);
assert.ok(begin>=0&&end>begin);
const section=index.slice(begin,end),script=await readFile(new URL('app/lots.js',root),'utf8'),css=await readFile(new URL('app/lots.css',root),'utf8');
const browser=await chromium.launch({headless:true,...(process.env.LOTS_CHROME?{executablePath:process.env.LOTS_CHROME}:{})});
try{
 const context=await browser.newContext({viewport:{width:1200,height:900}}),page=await context.newPage();page.setDefaultTimeout(15000);
 let mode='first',catalogCalls=0,releaseSecond,releaseStalled;const requests=[];
 const data=(nodeId,id)=>({storeId:'123',nodeId,observedAt:'2026-10-26T10:00:01Z',lots:[{id,nodeId,title:'Товар '+id,status:'active',priceMinor:12000,currency:'RUB',stock:3,category:'Аккаунты'}]});
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>:root{--text:#eee;--muted:#aaa;--border:#333;--panel:#15171b;--accent:#f78940}*{box-sizing:border-box}body{background:#0c0d10;color:#eee;font:15px system-ui;margin:20px}.button{padding:10px 15px;background:#20242b;color:inherit;border:1px solid #444;border-radius:10px}button,select,input{font:inherit}svg{width:20px;height:20px;flex-shrink:0}${css}</style></head><body>${section}<script>
 const authState={token:'synthetic-token',user:{id:'owner'},workspace:{id:'workspace'}};let sessionGeneration=1;
 const state={storeContent:{storeId:'123',observedAt:null,lots:null,availableResources:{lots:false}}};
 const selectedStore=()=>({id:'123',status:'connected_read_only'});const icon=()=>'';const escapeHtml=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');const humanError=e=>e.message;function setView(){}function showToast(){}
 async function apiRequest(path,options={}){const response=await fetch('https://api.zetslay.pro'+path,{headers:{authorization:'Bearer '+authState.token},signal:options.signal});const body=await response.json();if(!response.ok){const e=Error(body.error.message);e.code=body.error.code;throw e;}return body.data;}
 </script><script src="/lots.js"></script><script>LOTS_READ_LIMITS.backoffMs=1;</script></body></html>`;
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.href==='https://zetslay.pro/app/')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
  if(url.href==='https://zetslay.pro/lots.js')return route.fulfill({contentType:'text/javascript; charset=utf-8',body:script});
  if(url.origin!=='https://api.zetslay.pro')return route.abort();
  const headers={'access-control-allow-origin':'https://zetslay.pro','access-control-allow-headers':'authorization','access-control-allow-methods':'GET,OPTIONS'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
  assert.equal(request.method(),'GET');assert.equal(url.pathname,'/api/v1/funpay/inventory');assert.equal(url.searchParams.get('storeId'),'123');requests.push(request.url());
  const respond=async(value,status=200)=>{try{await route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(value)});}catch{/* A deliberately cancelled synthetic fetch may already be gone. */}};
  const nodeId=url.searchParams.get('nodeId');
  if(!nodeId){
   catalogCalls++;
   if(mode==='stall')return new Promise(resolve=>{releaseStalled=()=>respond({data:{storeId:'123',observedAt:'2026-10-26T10:00:00Z',categories:[]}}).then(resolve);});
   if(catalogCalls===1)return respond({error:{code:'SYNC_BUSY',message:'Подключение занято'}},409);
   return respond({data:{storeId:'123',observedAt:'2026-10-26T10:00:00Z',categories:[{nodeId:'3'},{nodeId:'4'}]}});
  }
  if(nodeId==='3')return respond({data:data('3','12')});
  return new Promise(resolve=>{releaseSecond=()=>respond({data:data('4','13')}).then(resolve);});
 });
 await page.goto('https://zetslay.pro/app/');await page.evaluate(()=>renderLotWorkspace());
 await page.getByRole('button',{name:'Товар 12',exact:true}).waitFor();
 assert.equal(await page.locator('[data-lots-all]').textContent(),'—');assert.match(await page.locator('[data-lots-list-count]').textContent(),/категорий 1 из 2/);assert.ok(catalogCalls===2);
 await releaseSecond();await page.waitForFunction(()=>!lotsPageState.busy);assert.equal(await page.locator('[data-lots-all]').textContent(),'2');
 await page.getByRole('searchbox',{name:'Поиск лотов'}).fill('13');await page.getByRole('button',{name:'Товар 13',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Товар 12',exact:true}).count(),0);await page.getByRole('searchbox',{name:'Поиск лотов'}).fill('');
 mode='stall';await page.getByRole('button',{name:'Обновить данные',exact:true}).click();await page.getByRole('button',{name:'Остановить загрузку',exact:true}).click();
 await page.waitForFunction(()=>!lotsPageState.busy);assert.match(await page.locator('[data-lots-alert-copy]').textContent(),/Загрузка остановлена/);assert.equal(await page.locator('[data-lots-all]').textContent(),'2');if(releaseStalled)await releaseStalled();
 await page.evaluate(()=>{LOTS_READ_LIMITS.requestMs=25;});await page.getByRole('button',{name:'Обновить данные',exact:true}).click();await page.waitForFunction(()=>!lotsPageState.busy);assert.match(await page.locator('[data-lots-alert-copy]').textContent(),/FunPay не ответил вовремя/);assert.equal(await page.locator('[data-lots-refresh]').isEnabled(),true);if(releaseStalled)await releaseStalled();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log(JSON.stringify({progressiveInventory:true,busyRetry:true,cancel:true,timeout:true,previousInventoryRetained:true,mobileNoOverflow:true,onlyGet:true,realAccountsUsed:false}));
 await context.close();
}finally{await browser.close();}
