import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('./kosell-storefront.js',import.meta.url),'utf8');
const form={nodeId:'2500',categoryTitle:'Game · Аккаунты',fingerprint:'a'.repeat(64),currency:'RUB',fields:{'fields[platform]':'steam'},missing:[],controls:[{name:'fields[platform]',label:'Платформа',kind:'select',required:true,options:[{value:'',label:'Выбрать'},{value:'steam',label:'Steam'}]}]};
const sources={products:[{id:1,name:'<img onerror=x>',nodeId:'2500',availableAccounts:5},{id:2,name:'Unmatched game',nodeId:null}],categories:[{nodeId:'2500',game:'Game',name:'Аккаунты'}],preparation:null};
function fixture(){const root={innerHTML:''},feedback={textContent:'',setAttribute(){}},handlers={},calls=[];const ctx=vm.createContext({console,Date,Set,Map,Promise,Number,Object,String,Array,Math,setTimeout:fn=>{queueMicrotask(fn);return 1;},authState:{token:'account-one'},sessionGeneration:1,kosellUi:{status:{storeId:'42',config:{markupPercent:20,manageOffers:true}}},kosellCatalogMarkup:()=>'<section>legacy template editor</section>',escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),kosellMoney:(n,c)=>(n/100).toFixed(2)+' '+c,humanError:e=>e.message,validateKosellCatalogPlan:p=>p&&Array.isArray(p.items)&&typeof p.token==='string',loadKosellStatus:async()=>{},document:{addEventListener:(type,fn)=>(handlers[type]||=[]).push(fn),querySelector:selector=>selector==='[data-kosell-storefront]'?root:selector==='[data-sf-feedback]'?feedback:null},apiRequest:async(path,options)=>{calls.push({path,options});return path.endsWith('/category')?structuredClone(form):structuredClone(sources);}});vm.runInContext(code,ctx);return{ctx,root,feedback,handlers,calls,run:s=>vm.runInContext(s,ctx)};}
async function selected(){const f=fixture();await f.run('sfLoad()');await f.run('sfSelect(1,true)');f.run('sfState().reviewed=true');return f;}
const plan={token:'confirmed-plan',expiresAt:Date.now()+300000,currency:'RUB',activate:false,items:[{productId:1,productName:'<svg onload=x>',nodeId:'2500',categoryTitle:'Game · Аккаунты',hours:24,costMinor:100,priceMinor:120}],skipped:[]};
test('new catalogue offers searchable game selection, exact categories and optional legacy templates',async()=>{const f=await selected(),html=f.run('kosellCatalogMarkup(kosellUi.status)');assert.match(html,/создавать лоты-образцы больше не нужно/);assert.match(html,/data-sf-search/);assert.match(html,/data-sf-category="1"/);assert.match(html,/Game · Аккаунты/);assert.match(html,/legacy template editor/);assert.doesNotMatch(html,/<img onerror/);assert.equal(f.run('sfEntryReady(sfState().entries[0])'),true);assert.equal(f.calls.some(c=>/offer-preview/.test(c.path)),false);});
test('unmatched games and incomplete fields cannot start preparation, and review is required',async()=>{const f=fixture();await f.run('sfLoad()');await f.run('sfSelect(2,true)');await f.run('sfPrepare()');assert.match(f.feedback.textContent,/Проверьте категории/);f.run('sfState().reviewed=true');await f.run('sfPrepare()');assert.match(f.feedback.textContent,/заполните параметры/);assert.equal(f.calls.some(c=>c.path.endsWith('/start')),false);});
test('bounded step preparation shows progress and only prepares; confirmation is separate',async()=>{const f=await selected();let steps=0;f.ctx.apiRequest=async(path,options)=>{f.calls.push({path,options});if(path.endsWith('/start'))return{token:'preparation',state:'preparing',revision:0,completed:0,total:2};if(path.endsWith('/step'))return ++steps===1?{token:'preparation',state:'preparing',revision:1,completed:1,total:2}:{token:'preparation',state:'ready',revision:2,completed:2,total:2,plan};throw Error('unexpected');};await f.run('sfPrepare()');assert.equal(steps,2);assert.match(f.root.innerHTML,/Проверьте витрину/);assert.match(f.root.innerHTML,/1.20 RUB/);assert.doesNotMatch(f.root.innerHTML,/<svg onload/);assert.equal(f.calls.some(c=>c.path.endsWith('/offer-confirm')),false);const body=f.calls.find(c=>c.path.endsWith('/start')).options.body;assert.equal(body.entries[0].nodeId,'2500');assert.equal(body.entries[0].fields['fields[platform]'],'steam');assert.equal(body.reviewed,true);});
test('editing invalidates the visible approval; server expiry preserves the draft without resubmitting',async()=>{
 const f=await selected();f.ctx.example=structuredClone(plan);f.run('sfState().plan=example;sfState().preparation={state:"ready",plan:example};sfInvalidate()');await f.run('sfConfirm()');assert.equal(f.calls.some(c=>c.path.endsWith('/offer-confirm')),false);
 f.run('sfState().plan=example;sfState().preparation={state:"ready",plan:example}');let attempts=0;f.ctx.apiRequest=async()=>{attempts++;throw Object.assign(Error('Expired'),{code:'KOSELL_OFFER_PLAN_EXPIRED'});};
 await f.run('sfConfirm()');await f.run('sfConfirm()');assert.equal(attempts,1);assert.equal(f.run('sfState().plan.token'),plan.token);assert.equal(f.run('sfState().preparation.approvalExpired'),true);assert.match(f.root.innerHTML,/Обновить подтверждение без пересчёта/);assert.doesNotMatch(f.root.innerHTML,/data-sf-action="confirm"/);
});
test('a lost creation acknowledgement consumes client approval and cannot replay automatically',async()=>{const f=await selected();f.ctx.example=structuredClone(plan);f.run('sfState().plan=example');let writes=0;f.ctx.apiRequest=async()=>{writes++;throw Error('Ответ потерян');};await f.run('sfConfirm()');await f.run('sfConfirm()');assert.equal(writes,1);assert.match(f.root.innerHTML,/Проверьте очередь/);});
test('late category response after sign-out cannot populate a different account',async()=>{const f=fixture();await f.run('sfLoad()');let finish;f.ctx.apiRequest=()=>new Promise(r=>finish=r);const request=f.run('sfSelect(1,true)');await new Promise(setImmediate);f.ctx.authState.token='other-account';f.ctx.sessionGeneration=2;finish(form);await request;assert.equal(f.run('sfState().entries.length'),0);assert.equal(f.run('sfState().sources'),null);});
test('49 selected games show the actual missing parameters and clear a stale limit warning',async()=>{
 const f=fixture();await f.run('sfLoad()');f.ctx.entries=Array.from({length:50},(_,i)=>({productId:i+1,productName:'Game '+(i+1),nodeId:'2500',form:i<22?structuredClone(form):null,fields:i<22?{'fields[platform]':'steam'}:{},error:i<22?'':'old generic error'}));
 f.run('sfState().entries=entries;sfState().error="В одном плане можно выбрать до 50 игр."');await f.run('sfSelect(50,false)');
 assert.equal(f.run('sfState().entries.length'),49);assert.equal(f.run('sfState().error'),'');assert.match(f.root.innerHTML,/проверьте 27 из 49 игр/);assert.match(f.root.innerHTML,/Не загружены параметры: 27/);assert.match(f.root.innerHTML,/data-sf-action="retry-fields"/);assert.match(f.root.innerHTML,/data-sf-action="prepare" disabled/);assert.doesNotMatch(f.root.innerHTML,/В одном плане можно выбрать до 50 игр/);
});
test('retry reads only missing forms sequentially, preserves filled forms and never prepares or creates',async()=>{
 const f=fixture();await f.run('sfLoad()');f.ctx.entries=[{productId:1,productName:'Ready',nodeId:'2500',form:structuredClone(form),fields:{'fields[platform]':'ps'}},{productId:2,productName:'Retry',nodeId:'2500',form:null,fields:{},error:'failed'},{productId:3,productName:'Retry 2',nodeId:'2500',form:null,fields:{}},{productId:4,productName:'Manual',nodeId:null,form:null,fields:{}}];f.run('sfState().entries=entries;sfState().reviewed=true');let active=0,max=0;
 f.ctx.apiRequest=async(path,options)=>{f.calls.push({path,options});active++;max=Math.max(max,active);await new Promise(setImmediate);active--;return structuredClone(form);};
 await f.run('sfRetryFields()');assert.equal(max,1);assert.equal(f.calls.filter(c=>c.path.endsWith('/category')).length,2);assert.equal(f.run('sfState().entries[0].fields["fields[platform]"]'),'ps');assert.equal(f.run('sfState().reviewed'),false);assert.equal(f.run('sfState().busy'),false);assert.match(f.root.innerHTML,/Не выбрана категория: 1/);assert.equal(f.calls.some(c=>/\/(start|step|offer-confirm)$/.test(c.path)),false);
});
test('category read failures distinguish a busy connection and never claim every form failure is a disconnected shop',async()=>{
 const f=fixture();f.ctx.failure={code:'INVALID_STATE',message:'Подключение временно занято'};assert.match(f.run('sfCategoryReadError(failure)'),/занят другой операцией/);
 f.ctx.failure={code:'INVALID_STATE',message:'PRIVATE_OR_UNKNOWN'};const text=f.run('sfCategoryReadError(failure)');assert.match(text,/форму этой категории FunPay/);assert.doesNotMatch(text,/PRIVATE_OR_UNKNOWN|текущем состоянии магазина/);
});
test('cancelling a retry stops the remaining reads and ignores its late response',async()=>{
 const f=fixture();await f.run('sfLoad()');f.ctx.entries=[1,2].map(productId=>({productId,productName:'Game',nodeId:'2500',form:null,fields:{}}));f.run('sfState().entries=entries');let finish,calls=0;f.ctx.apiRequest=()=>{calls++;return new Promise(r=>finish=r);};
 const pending=f.run('sfRetryFields()');await new Promise(setImmediate);await f.run('sfCancel()');finish(structuredClone(form));await pending;assert.equal(calls,1);assert.equal(f.run('sfState().entries[0].form'),null);assert.equal(f.run('sfState().busy'),false);
});
function allGames(f,count=65){f.ctx.catalog={products:Array.from({length:count},(_,i)=>({id:i+1,name:'Game '+(i+1),nodeId:'2500',availableAccounts:2})),categories:structuredClone(sources.categories),preparation:null};f.run('sfState().sources=catalog');}
test('one click selects every in-stock game beyond search and pagination, with no duplicates or creation',async()=>{
 const f=fixture();await f.run('sfLoad()');allGames(f);f.ctx.catalog.products.push({id:100,name:'No stock',availableAccounts:0},{id:101,name:'Unknown stock'},{...f.ctx.catalog.products[0]});f.run("sfState().query='Game 1';sfState().limit=1");
 const button={dataset:{sfAction:'select-all'}};await f.handlers.click[0]({target:{closest:()=>button}});
 assert.equal(f.run('sfState().entries.length'),65);assert.equal(f.run('new Set(sfState().entries.map(e=>e.productId)).size'),65);assert.equal(f.run('sfState().entries.at(-1).productId'),65);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/category')).length,50);assert.equal(f.calls.some(c=>/\/(start|step|offer-confirm)$/.test(c.path)),false);
 assert.match(f.root.innerHTML,/Выбрать все доступные \(65\)/);assert.match(f.root.innerHTML,/Ещё 15 останутся выбранными/);
 assert.match(f.root.innerHTML,/data-sf-action="select-all" disabled/);
 await f.run('sfSelectProducts(true)');assert.equal(f.run('sfState().entries.length'),65);assert.equal(f.calls.filter(c=>c.path.endsWith('/category')).length,50);
});
test('large selection submits only the ready first batch and confirmed batches leave the remaining games selected',async()=>{
 const f=fixture();await f.run('sfLoad()');allGames(f);await f.run('sfSelectProducts(true)');f.run('sfState().reviewed=true');
 assert.equal(f.run('sfInput().entries.length'),50);assert.equal(f.run('sfInput().entries.at(-1).productId'),50);
 let queued=50;f.ctx.apiRequest=async(path,options)=>{f.calls.push({path,options});return path.endsWith('/offer-confirm')?{queued}:structuredClone(form);};
 f.ctx.example={...structuredClone(plan),items:Array.from({length:50},(_,i)=>({...plan.items[0],productId:i+1}))};f.run('sfState().plan=example');await f.run('sfConfirm()');
 assert.equal(f.run('sfState().entries.length'),15);assert.equal(f.run('sfState().entries[0].productId'),51);assert.equal(f.run('sfState().reviewed'),false);assert.match(f.root.innerHTML,/Загрузите параметры следующей партии/);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/category')).length,50,'later forms wait for an explicit request');
 await f.run('sfRetryFields()');f.run('sfState().reviewed=true');assert.equal(f.run('sfInput().entries.length'),15);assert.equal(f.calls.filter(c=>c.path.endsWith('/category')).length,65);
 queued=15;f.ctx.example={...structuredClone(plan),items:Array.from({length:15},(_,i)=>({...plan.items[0],productId:51+i}))};f.run('sfState().plan=example');await f.run('sfConfirm()');assert.equal(f.run('sfState().entries.length'),0);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/offer-confirm')).length,2);
});
test('selecting all preserves existing fields and manually selected out-of-stock games',async()=>{
 const f=await selected();f.run("sfState().entries[0].fields.custom='KEEP';sfState().entries.push({productId:99,productName:'Manual no-stock',nodeId:null,fields:{}})");
 await f.run('sfSelectProducts(true)');assert.equal(f.run('sfState().entries.length'),2);assert.equal(f.run('sfState().entries[0].fields.custom'),'KEEP');assert.equal(f.calls.filter(c=>c.path.endsWith('/category')).length,1);
});
test('an unknown batch creation result does not advance or drop any selected games',async()=>{
 const f=fixture();await f.run('sfLoad()');allGames(f);await f.run('sfSelectProducts(true)');f.ctx.example=structuredClone(plan);f.run('sfState().plan=example');let writes=0;f.ctx.apiRequest=async()=>{writes++;throw Error('Ответ потерян');};
 await f.run('sfConfirm()');await f.run('sfConfirm()');assert.equal(writes,1);assert.equal(f.run('sfState().entries.length'),65);assert.equal(f.run('sfState().entries[0].productId'),1);assert.match(f.root.innerHTML,/Проверьте очередь/);
});
test('an empty plan can advance to the remaining selection without creating offers',async()=>{
 const f=fixture();await f.run('sfLoad()');allGames(f);await f.run('sfSelectProducts(true)');f.ctx.empty={...structuredClone(plan),items:[]};f.run('sfState().plan=empty');
 assert.match(f.run('sfPlan(empty)'),/Перейти к следующим играм/);await f.run('sfNextBatch()');assert.equal(f.run('sfState().entries.length'),15);assert.equal(f.run('sfState().entries[0].productId'),51);assert.equal(f.run('sfState().reviewed'),false);assert.equal(f.calls.some(c=>c.path.endsWith('/offer-confirm')),false);
});
test('cancelling bulk selection stops form reads while retaining the selected games',async()=>{
 const f=fixture();await f.run('sfLoad()');allGames(f);let finish,reads=0;f.ctx.apiRequest=()=>{reads++;return new Promise(r=>finish=r);};const pending=f.run('sfSelectProducts(true)');await new Promise(setImmediate);
 assert.equal(f.run('sfState().entries.length'),65);await f.run('sfCancel()');finish(structuredClone(form));await pending;assert.equal(reads,1);assert.equal(f.run('sfState().busy'),false);assert.equal(f.run('sfState().entries[0].form'),null);
});
test('switching account during bulk selection discards the old catalogue and late forms',async()=>{
 const f=fixture();await f.run('sfLoad()');allGames(f);let finish;f.ctx.apiRequest=()=>new Promise(r=>finish=r);const pending=f.run('sfSelectProducts(true)');await new Promise(setImmediate);f.ctx.authState.token='account-two';f.ctx.sessionGeneration++;finish(structuredClone(form));await pending;
 assert.equal(f.run('sfState().sources'),null);assert.equal(f.run('sfState().entries.length'),0);assert.equal(f.run('sfState().busy'),false);
});

test('a 250-step plan waits a full minute at step 15 and resumes the same revision without restarting or creating',async()=>{
 const f=await selected();let revision=0,limited=false,waitTicks=0;const sent=[];
 f.ctx.setTimeout=(fn,ms)=>{if(ms===1000){waitTicks++;assert.match(f.root.innerHTML,/Продолжим автоматически через/);}queueMicrotask(fn);return 1;};
 f.ctx.apiRequest=async(path,options)=>{
  sent.push({path,body:structuredClone(options?.body)});
  if(path.endsWith('/start'))return{token:'saved-250',state:'preparing',revision:0,completed:0,total:250};
  assert.ok(path.endsWith('/step'));
  assert.equal(options.body.token,'saved-250');assert.equal(options.body.revision,revision);
  if(revision===15&&!limited){limited=true;throw Object.assign(Error('Limit'),{code:'RATE_LIMITED'});}
  revision++;return{token:'saved-250',state:revision===250?'ready':'preparing',revision,completed:revision,total:250,...revision===250?{plan}:{}};
 };
 await f.run('sfPrepare()');assert.equal(revision,250);assert.equal(waitTicks,60);assert.equal(sent.filter(c=>c.path.endsWith('/start')).length,1);assert.equal(sent.filter(c=>c.path.endsWith('/step')&&c.body.revision===15).length,2);assert.equal(f.run('sfState().busy'),false);assert.equal(f.run('sfState().wait'),null);assert.equal(f.run('sfState().plan.token'),plan.token);assert.equal(sent.some(c=>c.path.endsWith('/offer-confirm')),false);
});
test('persistent limits stop after five waits and retain a resumable preparation',async()=>{
 const f=await selected();let attempts=0,ticks=0;f.ctx.setTimeout=(fn,ms)=>{if(ms===1000)ticks++;queueMicrotask(fn);return 1;};
 f.ctx.apiRequest=async path=>{if(path.endsWith('/start'))return{token:'saved',state:'preparing',revision:15,completed:15,total:250};attempts++;throw Object.assign(Error('Limit'),{code:'RATE_LIMITED'});};
 await f.run('sfPrepare()');assert.equal(attempts,6);assert.equal(ticks,300);assert.equal(f.run('sfState().preparation.revision'),15);assert.equal(f.run('sfState().busy'),false);assert.match(f.root.innerHTML,/Прогресс сохранён/);assert.match(f.root.innerHTML,/data-sf-action="resume"/);
});
test('cancelling during the limit countdown sends no further preparation steps',async()=>{
 const f=await selected();let stepCalls=0,release;f.ctx.setTimeout=(fn,ms)=>{if(ms===1000)release=fn;else queueMicrotask(fn);return 1;};
 f.ctx.apiRequest=async path=>{if(path.endsWith('/start'))return{token:'saved',state:'preparing',revision:15,completed:15,total:250};if(path.endsWith('/cancel'))return{};stepCalls++;throw Object.assign(Error('Limit'),{code:'RATE_LIMITED'});};
 const pending=f.run('sfPrepare()');await new Promise(setImmediate);assert.match(f.root.innerHTML,/Продолжим автоматически через 60 с/);await f.run('sfCancel()');release();await pending;assert.equal(stepCalls,1);assert.equal(f.run('sfState().preparation.state'),'cancelled');assert.equal(f.run('sfState().wait'),null);assert.doesNotMatch(f.root.innerHTML,/Продолжим автоматически/);
});
test('changing account during a limit wait discards old progress without further API requests',async()=>{
 const f=await selected();let stepCalls=0,release;f.ctx.setTimeout=(fn,ms)=>{if(ms===1000)release=fn;else queueMicrotask(fn);return 1;};
 f.ctx.apiRequest=async path=>{if(path.endsWith('/start'))return{token:'old',state:'preparing',revision:15,completed:15,total:250};stepCalls++;throw Object.assign(Error('Limit'),{code:'RATE_LIMITED'});};
 const pending=f.run('sfPrepare()');await new Promise(setImmediate);f.ctx.authState.token='new-account';f.ctx.sessionGeneration++;release();await pending;assert.equal(stepCalls,1);assert.equal(f.run('sfState().preparation'),null);assert.equal(f.run('sfState().entries.length'),0);
});
test('category limits and busy preparation are retried, while authentication and unknown results stop immediately',async()=>{
 for(const failure of [{code:'RATE_LIMITED',message:'Limit'},{code:'SYNC_BUSY',message:'Busy'},{code:'INVALID_STATE',message:'Подключение временно занято'}]){
  const f=fixture();await f.run('sfLoad()');let attempts=0;f.ctx.apiRequest=async()=>{if(++attempts===1)throw Object.assign(Error(failure.message),failure);return structuredClone(form);};await f.run('sfSelect(1,true)');assert.equal(attempts,2);assert.equal(f.run('sfEntryReady(sfState().entries[0])'),true);
 }
 for(const code of ['AUTH_REJECTED','INVALID_SESSION','REQUEST_RESULT_UNKNOWN','INTERNAL_ERROR']){
  const f=await selected();let attempts=0;f.ctx.apiRequest=async()=>{attempts++;throw Object.assign(Error(code),{code});};await f.run('sfPrepare()');assert.equal(attempts,1);assert.equal(f.run('sfState().busy'),false);
 }
});
test('a persistent category limit pauses the batch instead of exhausting retries for every selected game',async()=>{
 const f=fixture();await f.run('sfLoad()');f.ctx.entries=[1,2].map(productId=>({productId,productName:'Game',nodeId:'2500',form:null,fields:{}}));f.run('sfState().entries=entries');let attempts=0;
 f.ctx.apiRequest=async()=>{attempts++;throw Object.assign(Error('Limit'),{code:'RATE_LIMITED'});};await f.run('sfRetryFields()');assert.equal(attempts,6);assert.equal(f.run('sfState().entries[0].retryExhausted'),true);assert.equal(f.run('sfState().entries[1].loading'),undefined);assert.equal(f.run('sfState().busy'),false);assert.match(f.root.innerHTML,/Загрузить недостающие параметры/);
});

test('incorrect computer time cannot reject a server-valid plan before confirmation',async()=>{
 for(const shift of [-2*86400000,2*86400000]){
  const f=await selected(),realNow=Date.now();f.ctx.Date=class extends Date{static now(){return realNow+shift;}};f.ctx.example=structuredClone(plan);f.run('sfState().plan=example;sfState().preparation={state:"ready",plan:example}');let writes=0;
  f.ctx.apiRequest=async path=>{assert.ok(path.endsWith('/offer-confirm'));writes++;return{queued:1};};await f.run('sfConfirm()');assert.equal(writes,1);assert.equal(f.run('sfState().preparation.state'),'confirmed');assert.doesNotMatch(f.root.innerHTML,/План истёк/);
 }
});
test('renewal retains 197 saved items and selection, never starts preparation or creates lots',async()=>{
 const f=await selected();f.ctx.saved={...structuredClone(plan),expiresAt:1,items:Array.from({length:197},(_,i)=>({...plan.items[0],productId:i+1}))};f.run('sfState().plan=saved;sfState().preparation={token:"draft",state:"ready",plan:saved,approvalExpired:true}');let writes=0;
 f.ctx.apiRequest=async(path,options)=>{f.calls.push({path,options});assert.ok(path.endsWith('/renew'));writes++;return{token:'draft',state:'ready',approvalExpired:false,plan:{...f.ctx.saved,token:'renewed',expiresAt:Date.now()+1800000}};};
 await f.run('sfRenew()');assert.equal(writes,1);assert.equal(f.run('sfState().entries.length'),1);assert.equal(f.run('sfState().plan.items.length'),197);assert.equal(f.run('sfState().plan.token'),'renewed');assert.equal(f.calls.some(c=>/\/(start|step|offer-confirm)$/.test(c.path)),false);assert.match(f.root.innerHTML,/Создать лоты \(197\)/);assert.match(f.root.innerHTML,/Подтверждение обновлено без пересчёта/);
});
test('renewal is single-flight and a lost renewal response preserves the draft without creating anything',async()=>{
 const f=await selected();f.ctx.example=structuredClone(plan);f.run('sfState().plan=example;sfState().preparation={token:"draft",state:"ready",plan:example,approvalExpired:true}');let reject,calls=0;f.ctx.apiRequest=()=>{calls++;return new Promise((r,j)=>reject=j);};
 const pending=f.run('sfRenew()');await f.run('sfRenew()');assert.equal(calls,1);reject(Object.assign(Error('Unknown read result'),{code:'REQUEST_RESULT_UNKNOWN'}));await pending;assert.equal(f.run('sfState().plan.token'),plan.token);assert.equal(f.run('sfState().preparation.state'),'ready');assert.match(f.root.innerHTML,/data-sf-action="renew"/);assert.equal(f.run('sfState().busy'),false);
});
test('a renewal response from another session or after cancellation cannot restore a plan',async()=>{
 for(const changed of ['account','cancel']){
  const f=await selected();f.ctx.example=structuredClone(plan);f.run('sfState().plan=example;sfState().preparation={token:"draft",state:"ready",plan:example,approvalExpired:true}');let resolve;
  f.ctx.apiRequest=path=>path.endsWith('/cancel')?Promise.resolve({}):new Promise(r=>resolve=r);const pending=f.run('sfRenew()');await new Promise(setImmediate);
  if(changed==='account'){f.ctx.authState.token='other-account';f.ctx.sessionGeneration++;}else await f.run('sfCancel()');
  resolve({token:'draft',state:'ready',plan:{...plan,token:'late'}});await pending;assert.equal(f.run('sfState().plan'),null);assert.notEqual(f.run('sfState().preparation?.state'),'ready');
 }
});
const hold={nodeId:'451',afterJobId:'00000000-0000-0000-0000-000000000002',pending:12,failures:2,message:'Проверьте <img onerror=x>',probePending:false};
function held(f){f.ctx.hold=structuredClone(hold);f.run('kosellUi.status.offerCreationQueue={pending:12,holds:[hold]}');return{dataset:{node:'451',after:hold.afterJobId},querySelector:()=>({checked:true})};}
test('creation holds explain a saved queue, escape diagnostics and require explicit review before one new probe',async()=>{
 const f=fixture(),form=held(f);let markup=f.run('sfInner(kosellUi.status)');assert.match(markup,/Создание требует проверки/);assert.match(markup,/data-sf-creation-resume/);assert.match(markup,/ещё не отправленного задания/);assert.doesNotMatch(markup,/<img onerror/);assert.equal(f.calls.length,0);
 form.querySelector=()=>({checked:false});await f.run('sfResumeCreation').call(null,form);assert.equal(f.calls.length,0);assert.match(f.feedback.textContent,/Подтвердите/);
 form.querySelector=()=>({checked:true});f.ctx.apiRequest=async(path,options)=>{f.calls.push({path,options});return{accepted:true,nodeId:'451',jobId:'queued-new'};};f.ctx.loadKosellStatus=async()=>{f.run('kosellUi.status.offerCreationQueue.holds[0].probePending=true')};await f.run('sfResumeCreation').call(null,form);
 assert.equal(f.calls.length,1);assert.ok(f.calls[0].path.endsWith('/offer-creation-resume'));assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].options.body)),{nodeId:'451',afterJobId:hold.afterJobId,confirm:true});assert.match(f.root.innerHTML,/Один лот ожидает пробного создания/);assert.doesNotMatch(f.root.innerHTML,/data-sf-creation-resume/);
});
test('a duplicate click or a late probe response cannot populate another session or send another authorization',async()=>{
 const f=fixture(),form=held(f);let done;f.ctx.apiRequest=(path,options)=>{f.calls.push({path,options});return new Promise(resolve=>done=resolve)};const run=f.run('sfResumeCreation'),pending=run(form);await new Promise(setImmediate);await run(form);assert.equal(f.calls.length,1);f.ctx.authState.token='other';f.ctx.sessionGeneration=2;done({accepted:true,nodeId:'451',jobId:'new'});await pending;assert.equal(f.run('sfState().message'),'');assert.equal(f.run('sfState().busy'),false);
});
test('a rejected or malformed probe approval reports an error and does not submit creation confirmation',async()=>{
 for(const reply of [{accepted:false},{accepted:true,nodeId:'999'}]){const f=fixture(),form=held(f);f.ctx.apiRequest=async(path,options)=>{f.calls.push({path,options});return reply};await f.run('sfResumeCreation')(form);assert.equal(f.calls.length,1);assert.match(f.root.innerHTML,/Разрешение не подтверждено/);assert.ok(!f.calls.some(call=>call.path.endsWith('/offer-confirm')));}
});
const queueFields={nodeId:'451',afterJobId:hold.afterJobId,queueFingerprint:'b'.repeat(64),jobs:8,form:{nodeId:'451',categoryTitle:'Прочие игры',fingerprint:'c'.repeat(64),controls:[{name:'server_id',label:'Игра',kind:'select',required:false,options:[{value:'',label:'Выберите'},{value:'17',label:'Game 1'},{value:'18',label:'Game 2 <svg onload=x>'}]}]},entries:[{productId:1,productName:'Game 1',jobs:4,fields:{server_id:'17'}},{productId:2,productName:'Game 2 <img onerror=x>',jobs:4,fields:{server_id:''}}]};
test('native optional game selectors require a value in the ordinary catalogue too',()=>{
 const f=fixture();f.ctx.example={form:queueFields.form,fields:{server_id:''}};assert.equal(f.run('sfEntryReady(example)'),false);f.run('example.fields.server_id="17"');assert.equal(f.run('sfEntryReady(example)'),true);
});
test('queue field review escapes game names, shares one options list and blocks empty-game probes',async()=>{
 const f=fixture();held(f);f.run('kosellUi.status.offerCreationQueue.holds[0].missingGameValues=8');let html=f.run('sfInner(kosellUi.status)');assert.match(html,/Проверить и исправить параметры очереди/);assert.doesNotMatch(html,/data-sf-creation-resume/);
 f.ctx.apiRequest=async(path,options)=>{f.calls.push({path,options});return structuredClone(queueFields);};await f.run('sfLoadQueueFields')({dataset:{sfQueueFields:'451',after:hold.afterJobId}});html=f.root.innerHTML;
 assert.match(html,/Параметры готовы: 1 из 2 игр/);assert.match(html,/Цены и сроки сохранятся/);assert.doesNotMatch(html,/<img onerror|<svg onload/);assert.equal((html.match(/<datalist id="sf-repair-options-0"/g)||[]).length,1);assert.match(html,/Сохранить параметры очереди/);
 const target={dataset:{sfRepairField:'server_id',sfRepairProduct:'2'},value:'Game 2 <svg onload=x> (#18)',hasAttribute:()=>false};for(const fn of f.handlers.change)await fn({target});assert.equal(f.run('sfState().repair.entries[1].fields.server_id'),'18');assert.match(f.root.innerHTML,/Параметры готовы: 2 из 2 игр/);assert.equal(f.calls.length,1);
});
test('saving repaired fields requires review, sends only field selections, and never starts creation or price preparation',async()=>{
 const f=fixture();held(f);f.ctx.preview=structuredClone(queueFields);f.run('sfState().repair={...preview,reviewed:false};sfState().repair.entries[1].fields.server_id="18"');const node={querySelector:()=>({checked:true})};await f.run('sfSaveQueueFields')(node);assert.equal(f.calls.length,0);
 f.run('sfState().repair.reviewed=true');f.ctx.apiRequest=async(path,options)=>{f.calls.push({path,options});return{saved:true,nodeId:'451',updated:8};};await f.run('sfSaveQueueFields')(node);assert.equal(f.calls.length,1);assert.ok(f.calls[0].path.endsWith('/queue-fields/save'));assert.equal(f.calls[0].options.body.entries[1].fields.server_id,'18');assert.equal(Object.hasOwn(f.calls[0].options.body.entries[0],'priceMinor'),false);assert.equal(f.run('sfState().repair'),null);assert.match(f.root.innerHTML,/Параметры исправлены в 8 заданиях/);assert.equal(f.calls.some(c=>/offer-confirm|offer-creation-resume|\/step|\/start/.test(c.path)),false);
});
test('queue parameter reads and saves are single-flight and discard results from another account',async()=>{
 for(const mode of ['read','save']){
  const f=fixture();held(f);let resolve;f.ctx.apiRequest=(path,options)=>{f.calls.push({path,options});return new Promise(r=>resolve=r);};
  if(mode==='save'){f.ctx.preview=structuredClone(queueFields);f.run('sfState().repair={...preview,reviewed:true};sfState().repair.entries[1].fields.server_id="18"');}
  const fn=f.run(mode==='read'?'sfLoadQueueFields':'sfSaveQueueFields'),input=mode==='read'?{dataset:{sfQueueFields:'451',after:hold.afterJobId}}:{querySelector:()=>({checked:true})},request=fn(input);await fn(input);assert.equal(f.calls.length,1);f.ctx.authState.token='other';f.ctx.sessionGeneration++;resolve(mode==='read'?queueFields:{saved:true,nodeId:'451',updated:8});await request;assert.equal(f.run('sfState().repair'),undefined);assert.equal(f.run('sfState().message'),'');
 }
});
test('malformed queue previews and arbitrary datalist values do not authorize a mutation',async()=>{
 const f=fixture();held(f);f.ctx.apiRequest=async()=>({...structuredClone(queueFields),form:{...queueFields.form,controls:[{name:'server_id',kind:'select'}]}});await f.run('sfLoadQueueFields')({dataset:{sfQueueFields:'451',after:hold.afterJobId}});assert.match(f.root.innerHTML,/Параметры очереди не подтверждены/);assert.equal(f.run('sfState().repair'),null);
 f.ctx.preview=structuredClone(queueFields);f.run('sfState().repair={...preview,reviewed:true}');const target={dataset:{sfRepairField:'server_id',sfRepairProduct:'2'},value:'Invented game',hasAttribute:()=>false};for(const fn of f.handlers.change)await fn({target});assert.equal(f.run('sfState().repair.entries[1].fields.server_id'),'');assert.equal(f.run('sfState().repair.reviewed'),false);assert.match(f.root.innerHTML,/Выберите значение из списка FunPay/);
});
