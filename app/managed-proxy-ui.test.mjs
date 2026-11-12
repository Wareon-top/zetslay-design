import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('./managed-proxy-ui.js',import.meta.url),'utf8');
function fixture(extra={}){const context=vm.createContext({Intl,Date,AbortSignal,AbortController,setTimeout,clearTimeout,crypto:{randomUUID:()=> 'test-id'},escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),...extra});vm.runInContext(source,context);return expression=>vm.runInContext(expression,context);}
const data={source:'managed',configured:true,activePlan:true,canActivate:true,current:{id:'mpx_one',label:'<img onerror=alert(1)>',state:'assigned',expiresAt:'2030-01-01T00:00:00Z',remainingDays:3,availability:{status:'passed',httpStatus:200,latencyMs:100}},candidates:[],requests:[]};
test('a stalled read stops loading even when the transport ignores abort; its late response is ignored',async()=>{
 let deadline,release,signal;
 const run=fixture({document:{querySelectorAll:()=>[]},renderConnectionWizard:undefined,authState:{user:{id:'one'},token:'one'},sessionGeneration:1,clearInterval,setInterval,setTimeout:fn=>(deadline=fn,1),clearTimeout:()=>{},apiRequest:(path,options)=>{signal=options.signal;return new Promise(r=>release=r);}});
 const pending=run('managedProxyLoad()');assert.equal(run('managedProxyUi.loading'),true);deadline();await pending;
 assert.equal(signal.aborted,true);assert.equal(run('managedProxyUi.loading'),false);assert.match(run('managedProxyUi.error'),/25 секунд/);
 release(data);await Promise.resolve();assert.equal(run('managedProxyUi.data'),null);
});
test('customer sees expiry and separate FunPay, authorization and read checks, without inferring login from HTTP 200',()=>{const run=fixture({data});const html=run('managedProxyMarkup(data)');assert.match(html,/Доступность FunPay/);assert.match(html,/Авторизация магазина/);assert.match(html,/Заказы и чаты/);assert.equal((html.match(/Ещё не проверено/g)||[]).length,2);assert.match(html,/3 дн/);assert.match(html,/срок скоро/i);assert.doesNotMatch(html,/<img onerror/);assert.match(html,/&lt;img/);});
test('failed authorization explains key recovery and blocked reads while preserving network success and renewal',()=>{const d={...data,current:{...data.current,expired:true,state:'expired'},operation:{status:'failed',checks:{availability:{status:'passed',httpStatus:200},authorization:{status:'failed',code:'AUTH_REJECTED'}},updatedAt:'2030-01-01'}};const run=fixture({data:d}),html=run('managedProxyMarkup(data)');assert.match(html,/HTTP 200/);assert.match(html,/Не удалось войти в аккаунт FunPay/);assert.match(html,/Скопируйте актуальный ключ/);assert.match(html,/Проверка остановлена/);assert.match(html,/<details[^>]*><summary>Код для поддержки<\/summary><code>AUTH_REJECTED<\/code><\/details>/);assert.match(html,/Продлить/);assert.match(html,/data-mp-action="check" disabled/);});

test('store mismatch explains the pinned account without recommending an automatic reset or blaming the proxy',()=>{
 const d={...data,operation:{status:'failed',code:'STORE_CHANGED',checks:{availability:{status:'passed',httpStatus:200},authorization:{status:'failed',code:'STORE_CHANGED'}},updatedAt:'2030-01-01'}};
 const run=fixture({data:d}),html=run('managedProxyMarkup(data)');
 const visible=html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g,'');
 assert.match(visible,/Аккаунт FunPay не совпадает с подключённым/);
 assert.match(visible,/Golden Key взят из нужного аккаунта/);
 assert.match(visible,/Если аккаунт не меняли/);
 assert.doesNotMatch(visible,/STORE_CHANGED|Сбросьте|Купите другой/);
 assert.equal((html.match(/<code>STORE_CHANGED<\/code>/g)||[]).length,1);
});

test('unrecognized check errors have useful fallback text and never expose arbitrary server content',()=>{
 const run=fixture({data});
 for(const code of ['UNKNOWN_CHECK','<img src=x onerror=alert(1)>','https://login:secret@example.invalid',null,'__proto__']){
  const html=run(`managedProxyChecks({authorization:{status:'failed',code:${JSON.stringify(code)}}})`);
  assert.match(html,/Не удалось завершить проверку/);
  assert.match(html,/передайте код из подробностей/);
  assert.doesNotMatch(html,/<img|login:secret|__proto__/);
 }
 const html=run("managedProxyMarkup({...data,operation:{status:'failed',code:'PROXY_EXPIRED',checks:{},updatedAt:'2030-01-01'}})");
 assert.match(html,/Срок действия прокси закончился/);
 assert.match(html,/Продлите прокси/);
});
test('candidate activation displays confirmed supplier expiry; online charges and upstream renewal are not invented',()=>{const run=fixture({data:{...data,current:null,candidates:[data.current]}}),html=run('managedProxyMarkup(data)');assert.match(html,/Проверить и подключить/);assert.match(html,/Онлайн-оплата прокси пока не подключена/);assert.match(html,/после трёх успешных проверок/);assert.doesNotMatch(html,/secret|vault:|account:password/);});
test('in-flight check disables duplicate mutations but keeps status refresh available',()=>{const run=fixture({data:{...data,operation:{status:'checking'},candidates:[data.current]}}),html=run('managedProxyMarkup(data)');assert.match(html,/data-mp-action="activate"[^>]*disabled/);assert.doesNotMatch(html,/data-mp-action="refresh"[^>]*disabled/);});
test('admin shows dedicated IP, actual upstream confirmation and only never-assigned available proxies',()=>{const admin={resources:[{...data.current,state:'available',dedicatedIp:'8.8.8.8',everAssigned:true}],requests:[{id:'a',workspaceId:'one',workspaceName:'<unsafe>',kind:'issue',status:'pending',days:30}]};const run=fixture({data:admin}),html=run('managedProxyAdminMarkup(data)');assert.match(html,/Выделенный IPv4/);assert.match(html,/уже продлён у поставщика/);assert.match(html,/data-mp-admin-assign/);assert.match(html,/&lt;unsafe>/);assert.doesNotMatch(html,/<option value="mpx_one"/);});
test('late request cannot inject another account data, and generation changes also invalidate it',async()=>{let resolve;const promise=new Promise(r=>resolve=r);const document={querySelectorAll:()=>[]};const run=fixture({document,renderConnectionWizard:undefined,authState:{user:{id:'one'},token:'one'},sessionGeneration:1,apiRequest:()=>promise,clearInterval,setInterval});const pending=run('managedProxyLoad()');run("authState.token='two';sessionGeneration=2");resolve(data);await pending;assert.equal(run('managedProxyUi.data'),null);assert.equal(run("managedProxyCurrent('one',1,managedProxyUi.revision)"),false);});
test('an invalidated startup read releases loading after the session refreshes', async () => {
 let finish;
 const run = fixture({document:{querySelectorAll:()=>[]},authState:{user:{id:'one'},token:'one'},sessionGeneration:1,
  apiRequest:()=>new Promise(resolve=>{finish=resolve;})});
 const pending=run('managedProxyLoad()');
 run('sessionGeneration++');
 finish(data);
 await pending;
 assert.equal(run('managedProxyUi.data'),null);
 assert.equal(run('managedProxyUi.loading'),false);
});
test('checkout can load the new session generation before the old request settles', async () => {
 const finish=[];
 const run = fixture({document:{querySelectorAll:()=>[]},authState:{user:{id:'one'},token:'one'},sessionGeneration:1,
  apiRequest:()=>new Promise(resolve=>finish.push(resolve))});
 const old=run('managedProxyLoad()');
 run('sessionGeneration++');
 const current=run('managedProxyLoad()');
 const started=finish.length;
 finish[0](data);
 await old;
 const stillLoading=run('managedProxyUi.loading');
 const stale=run('managedProxyUi.data');
 finish[1]?.({...data,activePlan:false});
 await current;
 assert.equal(started,2);
 assert.equal(stillLoading,true);
 assert.equal(stale,null);
 assert.equal(run('managedProxyUi.loading'),false);
 assert.equal(run('managedProxyUi.data.activePlan'),false);
});
test('all network actions are authenticated and bounded, and provider passwords are input-only',()=>{assert.match(source,/authenticated:true,signal:AbortSignal.timeout\(200000\)/);assert.match(source,/managedProxyCurrent\(token,generation,revision\)/);assert.match(source,/input.value=''/);assert.match(source,/admin&&!adminAllowed\(\)/);});
test('older progress snapshot cannot overwrite final activation status within the same session',async()=>{const resolvers=[];const run=fixture({document:{querySelectorAll:()=>[]},renderConnectionWizard:undefined,authState:{user:{id:'one'},token:'one'},sessionGeneration:1,apiRequest:()=>new Promise(resolve=>resolvers.push(resolve)),clearInterval,setInterval});const first=run('managedProxyLoad()');run('managedProxyUi.loadRevision++;managedProxyUi.loading=false');const final=run('managedProxyLoad()');resolvers[0]({operation:{status:'checking'}});await first;assert.equal(run('managedProxyUi.data'),null);resolvers[1]({activePlan:true,operation:{status:'complete',installed:true}});await final;assert.equal(run('managedProxyUi.data.operation.installed'),true);});
