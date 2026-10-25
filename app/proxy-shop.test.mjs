import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./proxy-shop.js',import.meta.url),'utf8');
const managedSource=readFileSync(new URL('./managed-proxy-ui.js',import.meta.url),'utf8');
const q={id:'quote-one',kind:'issue',country:'DE',termDays:30,totalMinor:5000,currency:'RUB',expiresAt:'2030-01-01T12:10:00Z'};
const data={enabled:true,balanceMinor:10000,publication:{version:'v',hash:'h'},operations:[]};
const managed={source:'none',activePlan:true,configured:false,candidates:[],requests:[]};
function harness(extra={}){
 const calls=[],timers=new Map();let id=0;
 const context=vm.createContext({Intl,Date,AbortSignal,AbortController,console,authState:{user:{id:'one'},token:'one'},sessionGeneration:1,crypto:{randomUUID:()=> 'request-one'},escapeHtml:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),setTimeout:fn=>{const n=++id;timers.set(n,fn);return n;},clearTimeout:id=>timers.delete(id),apiRequest:async(p,o)=>{calls.push([p,o]);return p.endsWith('/catalog')?{locations:[{nodeId:5,title:'Германия',country:'DE',monthlyPriceMinor:5000}]}:data;},...extra});
 const run=s=>vm.runInContext(s,context);run(managedSource.slice(managedSource.indexOf('async function managedProxyRead('),managedSource.indexOf('async function managedProxyLoad(')));run(source);return {context,run,calls,timers};
}
test('purchase component shows server price, wallet, term, separate authorization and no automatic renewal',()=>{const h=harness({managed});h.context.data=data;h.run('proxyShopUi.data=data;proxyShopUi.catalog={locations:[{nodeId:5,title:"Германия",monthlyPriceMinor:5000}]}');const html=h.run('proxyShopCheckoutMarkup(managed)');assert.match(html,/50.*₽/);assert.match(html,/30 дней/);assert.match(html,/Автопродления нет/);assert.match(html,/Оплата с внутреннего баланса/);assert.doesNotMatch(html,/secret|vault:|X-API-Key/);});
test('provider disabled does not invent prices or a purchase form',()=>{const h=harness({data:{...data,enabled:false},managed});h.run('proxyShopUi.data=data');const html=h.run('proxyShopCheckoutMarkup(managed)');assert.doesNotMatch(html,/data-ps-selection|data-ps-purchase/);assert.match(html,/Продажа временно недоступна/);});
test('checkout requires a server quote and explicit consent; insufficient funds offer Platega topup',()=>{const h=harness({data:{...data,balanceMinor:4900},managed,q});h.run('proxyShopUi.data=data;proxyShopUi.quote=q');const html=h.run('proxyShopCheckoutMarkup(managed)');assert.match(html,/name="confirmed" required/);assert.match(html,/data-ps-purchase/);assert.match(html,/Оплатить с баланса[^<]+/);assert.match(html,/type="submit" disabled/);assert.match(html,/Пополнить баланс через Platega/);assert.match(html,/legal\/terms\.html/);});
test('pending result disables new purchases and shows reservation and safe reconciliation',()=>{const operation={id:'test-id',kind:'issue',status:'review_required',walletState:'reserved',priceMinor:5000,country:'DE',months:1,createdAt:'2030-01-01'};const h=harness({data:{...data,operations:[operation]},managed});h.run('proxyShopUi.data=data');const html=h.run('proxyShopCheckoutMarkup(managed)');assert.match(html,/зарезервирована/);assert.match(html,/data-ps-reconcile/);assert.doesNotMatch(html,/data-ps-selection/);assert.doesNotMatch(html,/type="submit"/);});
test('confirmed delivery never claims shop authorization and keeps connection explicit',()=>{const h=harness({operation:{id:'id',kind:'issue',status:'delivered',priceMinor:5000,country:'DE',months:1,createdAt:'2030-01-01'}});const html=h.run('proxyShopOperation(operation)');assert.match(html,/авторизация магазина проверяется отдельно/);assert.match(html,/Проверить и подключить/);assert.doesNotMatch(html,/Магазин подключён/);});
test('texts from provider and operations are escaped and cannot create markup',()=>{const h=harness({data:{...data,operations:[{id:'<script>',kind:'issue',status:'review_required',priceMinor:5000,country:'<img>',months:1,createdAt:'2030-01-01'}]},managed});h.run('proxyShopUi.data=data');const html=h.run('proxyShopCheckoutMarkup(managed)');assert.doesNotMatch(html,/<script>|<img>/);assert.match(html,/&lt;img&gt;/);});
test('loading the shop performs only authenticated GETs',async()=>{const h=harness();await h.run('proxyShopLoad()');assert.equal(h.calls.length,2);assert.ok(h.calls.every(([,o])=>o.authenticated===true&&!o.method));assert.equal(h.run('proxyShopUi.data.balanceMinor'),10000);});
test('late catalogue response cannot leak data across account change',async()=>{let release;const h=harness({apiRequest:async p=>p.endsWith('/catalog')?new Promise(r=>release=r):data});const pending=h.run('proxyShopLoad()');while(!release)await Promise.resolve();h.run("authState.token='two';sessionGeneration=2;proxyShopReset()");release({locations:[{title:'PRIVATE OTHER ACCOUNT'}]});await pending;assert.equal(h.run('proxyShopUi.catalog'),null);assert.equal(h.run('proxyShopUi.data'),null);});
test('late status refresh cannot overwrite newer final status in the same session',async()=>{const resolvers=[];const h=harness({apiRequest:()=>new Promise(r=>resolvers.push(r))});const old=h.run('proxyShopLoad()');h.run('proxyShopUi.loadRevision++;proxyShopUi.loading=false;proxyShopUi.catalog={locations:[]}');const final=h.run('proxyShopLoad()');resolvers[1]({...data,operations:[{status:'delivered'}]});await final;resolvers[0]({...data,operations:[{status:'checking'}]});await old;assert.equal(h.run('proxyShopUi.data.operations[0].status'),'delivered');});
test('quote creates one persistent request ID and does not purchase until explicit action',async()=>{const h=harness({apiRequest:async(p,o)=>({quote:q,balanceMinor:10000,publication:{version:'v',hash:'h'}})});await h.run("proxyShopAction('quote',{kind:'issue',nodeId:5,months:1})");assert.equal(h.run('proxyShopUi.quote.id'),'quote-one');assert.equal(h.run('proxyShopUi.request.requestId'),'request-one');assert.equal(h.run('proxyShopUi.request.confirmed'),true);assert.equal(h.run('proxyShopUi.request.publicationHash'),'h');});
test('network uncertainty preserves the exact request and prevents creating another purchase',async()=>{const requests=[];const h=harness({apiRequest:async(p,o)=>{requests.push([p,o]);if(o?.method==='POST')throw Error('lost response');return {...data,enabled:false};}});h.context.request={requestId:'same-request',quoteId:'same-quote',confirmed:true};h.run('proxyShopUi.request=request');await h.run("proxyShopAction('purchase',proxyShopUi.request)");assert.equal(h.run('proxyShopUi.unknown'),true);assert.equal(h.run('proxyShopUi.request.requestId'),'same-request');await h.run("proxyShopAction('purchase',proxyShopUi.request)");const posts=requests.filter(([,o])=>o?.method==='POST');assert.equal(posts.length,2);assert.equal(posts[0][1].body.requestId,posts[1][1].body.requestId);});
test('definitive price failure clears stale checkout without claiming lost payment',async()=>{const h=harness({apiRequest:async(p,o)=>{if(o?.method==='POST')throw Object.assign(Error('Цена изменилась'),{code:'PROXY_PRICE_CHANGED'});return {...data,enabled:false};}});h.context.q=q;h.run('proxyShopUi.quote=q;proxyShopUi.request={requestId:"one"}');await h.run("proxyShopAction('purchase',proxyShopUi.request)");assert.equal(h.run('proxyShopUi.quote'),null);assert.equal(h.run('proxyShopUi.unknown'),false);});
test('automatic shop hides legacy request buttons and unavailable payment claim only after server confirmation',()=>{const h=harness({managed});h.run(managedSource);h.context.data=data;h.run('proxyShopUi.data=data;proxyShopUi.catalog={locations:[]}');const html=h.run('managedProxyMarkup(managed)');assert.match(html,/data-proxy-open/);assert.doesNotMatch(html,/data-mp-request|Онлайн-оплата прокси пока не подключена/);assert.match(html,/Авторизация магазина/i);});
test('admin summary labels limited scope and does not expose provider secrets',()=>{const h=harness({data:{summary:{chargedMinor:10000,supplierSpentMinor:4000,reservedMinor:5000},operations:[]}});const html=h.run('proxyShopAdminMarkup(data)');assert.match(html,/Последние 100 операций/);assert.match(html,/без комиссий Platega и налогов/);assert.match(html,/Известные расходы/);});
test('a rotated or switched session can load its own data while an older request is still pending',async()=>{const resolvers=[];const h=harness({apiRequest:()=>new Promise(r=>resolvers.push(r))});const old=h.run('proxyShopLoad()');h.run("authState.token='new-session';sessionGeneration++");const next=h.run('proxyShopLoad()');resolvers[1]({...data,enabled:false,balanceMinor:2500});await next;resolvers[0]({...data,enabled:false,balanceMinor:999999});await old;assert.equal(h.run('proxyShopUi.data.balanceMinor'),2500);assert.equal(h.run('proxyShopUi.loading'),false);});


test('purchase modal uses actual catalogue price and friendly country',()=>{
 const h=harness({managed});h.run(managedSource);h.run('proxyShopUi.data={enabled:true,balanceMinor:12345,operations:[]};proxyShopUi.catalog={locations:[{nodeId:35,title:"DE_ISP01",country:"DE",monthlyPriceMinor:7300}]}');
 const html=h.run('proxyShopModalMarkup(managed)');assert.match(html,/Германия/);assert.match(html,/73.*₽/);assert.match(html,/123,45.*₽/);assert.doesNotMatch(html,/DE_ISP01|50.*₽/);assert.match(html,/data-ps-topup/);
 h.run('proxyShopUi.data.enabled=false');const disabled=h.run('proxyShopModalMarkup(managed)');assert.doesNotMatch(disabled,/73.*₽|data-ps-selection/);
});
test('all invitations open the checkout without inline payment controls',()=>{
 const h=harness({managed});for(const place of ['dashboard','guide']){h.context.place=place;const html=h.run('proxyShopInviteMarkup(place)');assert.match(html,/data-proxy-open/);assert.match(html,/Купить прокси/);assert.doesNotMatch(html,/data-view-target|data-ps-purchase/);}
 const inline=h.run('proxyShopMarkup(managed)');assert.match(inline,/data-proxy-open/);assert.doesNotMatch(inline,/data-ps-purchase|data-ps-selection/);
});
test('failed managed state has a visible error instead of an endless spinner; retry loads both dependencies without purchases',async()=>{
 const h=harness({apiRequest:async path=>path==='/api/v1/managed-proxy'?managed:path.endsWith('/catalog')?{locations:[{nodeId:5,country:'DE',monthlyPriceMinor:5000}]}:data});
 h.context.document={querySelectorAll:()=>[]};h.run(managedSource);h.run('managedProxyUi.error="Сбой чтения состояния";proxyShopUi.data={enabled:true,balanceMinor:10000,operations:[]}');
 const failed=h.run('proxyShopModalMarkup(null)');assert.match(failed,/Сбой чтения состояния/);assert.match(failed,/role="alert"/);assert.doesNotMatch(failed,/ps-step-spinner|Загружаем локации/);
 await h.run('proxyShopRefresh()');assert.equal(h.run('managedProxyUi.data.activePlan'),true);assert.equal(h.run('managedProxyUi.error'),'');assert.equal(h.run('proxyShopUi.loading'),false);assert.equal(h.run('proxyShopUi.catalog.locations.length'),1);
 const ready=h.run('proxyShopModalMarkup(managedProxyUi.data)');assert.match(ready,/Германия|50.*₽/);assert.doesNotMatch(ready,/ps-step-spinner|Сбой чтения/);
});
test('catalogue rejection is visible and an empty successful catalogue has a final empty state',async()=>{
 const h=harness({apiRequest:async path=>{if(path.endsWith('/catalog'))throw Error('Каталог недоступен');return data;}});h.context.document={querySelectorAll:()=>[]};h.run(managedSource);h.context.managed=managed;
 await h.run('proxyShopLoad()');let html=h.run('proxyShopModalMarkup(managed)');assert.match(html,/Каталог недоступен/);assert.doesNotMatch(html,/Загружаем локации|ps-step-spinner/);
 h.context.apiRequest=async path=>path.endsWith('/catalog')?{locations:[]}:data;await h.run('proxyShopLoad({catalog:true})');html=h.run('proxyShopModalMarkup(managed)');assert.match(html,/Нет доступных локаций/);assert.match(html,/Повторите загрузку позже/);assert.doesNotMatch(html,/Загружаем локации|ps-step-spinner/);
});
test('stalled price quote releases controls without claiming an uncertain purchase or retrying a POST',async()=>{
 let release;const h=harness({apiRequest:()=>new Promise(r=>release=r)});const pending=h.run("proxyShopAction('quote',{kind:'issue',nodeId:5,months:1})");
 assert.equal(h.run('proxyShopUi.busy'),true);[...h.timers.values()][0]();await pending;
 assert.equal(h.run('proxyShopUi.busy'),false);assert.equal(h.run('proxyShopUi.unknown'),false);assert.equal(h.run('proxyShopUi.quote'),null);assert.match(h.run('proxyShopUi.error'),/25 секунд/);
 release({quote:q});await Promise.resolve();assert.equal(h.run('proxyShopUi.quote'),null);
});
test('automatic quote waits for both loaders and does not retry a failed quote on redraw',async()=>{
 const h=harness();h.run(managedSource);h.context.managed=managed;h.run('managedProxyUi.data=managed;proxyShopDialog.node={open:true};proxyShopUi.data={enabled:true};proxyShopUi.catalog={locations:[{nodeId:5}]};proxyShopUi.loading=true');
 await h.run('proxyShopPrepareQuote()');assert.equal(h.calls.length,0);
 h.run('proxyShopUi.loading=false;proxyShopUi.error="Ошибка расчёта"');await h.run('proxyShopPrepareQuote()');assert.equal(h.calls.length,0);
});
test('a failed quote cannot leave an old payable quote or a partially created request',async()=>{
 const h=harness({crypto:{randomUUID:()=>{throw Error('Нет генератора номера запроса');}},apiRequest:async()=>({quote:q})});h.context.q=q;
 h.run('proxyShopUi.quote=q;proxyShopUi.request={requestId:"old-request"}');await h.run("proxyShopAction('quote',{kind:'issue',nodeId:5,months:1})");
 assert.equal(h.run('proxyShopUi.quote'),null);assert.equal(h.run('proxyShopUi.request'),null);assert.equal(h.run('proxyShopUi.busy'),false);assert.match(h.run('proxyShopUi.error'),/генератора/);
});
test('purchase stages advance only on observed backend status, not time or an HTTP response',()=>{
 const h=harness();const stage=status=>{h.context.op={status};return h.run('proxyShopProgressModel(op)');};
 assert.equal(stage('reserved').stage,1);assert.equal(stage('ordering').stage,1);assert.equal(stage('supplier_received').stage,2);assert.equal(stage('checking').stage,2);assert.equal(stage('delivered').done,true);
 assert.equal(stage('review_required').done,false);assert.equal(stage('review_required').uncertain,true);assert.equal(stage('refunded').done,false);assert.match(stage('refunded').detail,/возвращены/);
 assert.equal(h.run('proxyShopProgressModel(null,{sending:true}).stage'),0);assert.equal(h.run('proxyShopProgressModel(null,{unknown:true}).done'),false);
});
test('renewal progress does not invent a new connection check',()=>{
 const h=harness({op:{status:'delivered',kind:'renew'}});const model=h.run('proxyShopProgressModel(op)');assert.match(model.title,/продлён/);assert.doesNotMatch(model.stages.join(' '),/Проверяем доступность/);
});
test('confirmed delivery offers a separate activation and does not claim shop login',()=>{
 const op={id:'purchase-one',status:'delivered',kind:'issue',resourceId:'candidate',priceMinor:5000,country:'DE',months:1};
 const h=harness({op});h.run(managedSource);h.context.managed={...managed,canActivate:true,candidates:[{id:'candidate',state:'assigned'}]};h.run('managedProxyUi.data=managed');
 const html=h.run('proxyShopProgressMarkup(op)');assert.match(html,/Прокси куплен/);assert.match(html,/data-mp-action="activate"/);assert.match(html,/Авторизация|авторизацию/);assert.doesNotMatch(html,/Магазин подключён/);
});
test('progress polls authenticated status while purchase POST is still pending',async()=>{
 let release;const h=harness({apiRequest:async(p,o)=>{if(o?.method==='POST')return new Promise(r=>release=r);return {...data,operations:[{id:'request-one',status:'ordering'}]};}});
 h.run('proxyShopUi.data={enabled:true,balanceMinor:10000,operations:[]};proxyShopUi.catalog={locations:[]}');
 const pending=h.run("proxyShopAction('purchase',{requestId:'request-one'})");assert.ok(h.timers.size,'polling starts before POST returns');await [...h.timers.values()][0]();await Promise.resolve();
 assert.equal(h.run('proxyShopUi.data.operations[0].status'),'ordering');assert.equal(h.run('proxyShopUi.busy'),true);release({operation:{id:'request-one',status:'ordering'}});await pending;
});

test('a lost POST response cannot override delivery already confirmed by a live status read',async()=>{
 let rejectPost;const h=harness({apiRequest:async(p,o)=>{if(o?.method==='POST')return new Promise((resolve,reject)=>rejectPost=reject);return {...data,operations:[{id:'request-one',status:'delivered'}]};}});
 h.run('proxyShopUi.data={enabled:true,balanceMinor:10000,operations:[]};proxyShopUi.catalog={locations:[]};proxyShopUi.request={requestId:"request-one"}');
 const pending=h.run("proxyShopAction('purchase',proxyShopUi.request)");await h.run('proxyShopLoad()');assert.equal(h.run('proxyShopUi.request'),null);rejectPost(Error('response lost'));await pending;
 assert.equal(h.run('proxyShopUi.unknown'),false);assert.equal(h.run('proxyShopUi.error'),'');assert.equal(h.run('proxyShopUi.data.operations[0].status'),'delivered');
});
