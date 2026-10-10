import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./kosell-rent.js',import.meta.url),'utf8');
function app(){const handlers={},calls=[],authState={token:'owner-session'},status={installation:{enabled:true},config:{automatic:false,currency:'RUB',maxSpendMinor:10000,guardEnabled:true,deliveryTemplate:'$login $password'},keyConfigured:true,workerEnabled:true,purchaseEnabled:true,deliveryEnabled:true,mappings:[],tasks:[],providerAccount:{username:'<script>bad</script>',balanceRubMinor:20000,balanceUsdMinor:400}};
 const ctx=vm.createContext({authState,console,queueMicrotask,structuredClone,FormData:class{constructor(form){this.data=form.values;}get(key){return this.data.get(key)??null;}has(key){return this.data.has(key);}},document:{addEventListener:(name,handler)=>{const previous=handlers[name];handlers[name]=async(...args)=>{if(previous)await previous(...args);await handler(...args);};},querySelector:()=>null},escapeHtml:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),humanError:e=>e.message,renderPluginPage:()=>{},apiRequest:async(path,options)=>{calls.push({path,options:structuredClone(options)});return status;}});vm.runInContext(source,ctx);return {ctx,handlers,calls,status,authState,run:s=>vm.runInContext(s,ctx)};}
test('Kosell renders settings only for installed plugin; secret key is never prefilled',async()=>{const f=app();assert.match(f.run('kosellRentMarkup({installed:false})'),/Установите плагин/);await f.run('loadKosellStatus()');const html=f.run('kosellRentMarkup({installed:true})');assert.match(html,/type="password" name="apiKey"/);assert.match(html,/autocomplete="off"/);assert.match(html,/Лимит одной покупки/);assert.match(html,/data-kosell-mapping/);assert.doesNotMatch(html,/<script>bad/);assert.match(html,/&lt;script&gt;bad/);assert.doesNotMatch(source,/(?:localStorage|sessionStorage)\.(?:setItem|getItem)/);});
function settingsForm(overrides={}){
 const values=new Map(Object.entries({apiKey:'PRIVATE_KEY',currency:'RUB',maxSpend:'100,50',deliveryTemplate:'$login $password',guardEnabled:'on',...overrides}));
 const input={value:values.get('apiKey'),focus(){this.focused=true}},fieldset={disabled:false},feedback={textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v}};
 const fields=new Map([['apiKey',input]]);
 const form={values,elements:[],matches:s=>s.includes('data-kosell-settings'),setAttribute(){},removeAttribute(){},querySelector:s=>s==='fieldset'?fieldset:s==='[data-kosell-save-feedback]'?feedback:s.startsWith('[name=')?fields.get(s.replace(/.*name=["']?([^"'\]]+).*/, '$1'))||input:null};
 return {form,input,fieldset,feedback};
}
async function submitSettings(f,form){await f.handlers.submit({target:form,preventDefault(){}});}
test('API key uses a private POST, clears only after success and settings use the POST response without a second GET',async()=>{
 const f=app();await f.run('loadKosellStatus()');const {form,input}=settingsForm();await submitSettings(f,form);
 assert.equal(input.value,'');const post=f.calls.find(c=>c.path.endsWith('/settings'));assert.equal(post.options.method,'POST');assert.equal(post.options.body.apiKey,'PRIVATE_KEY');assert.equal(post.options.body.config.maxSpendMinor,10050);assert.ok(!post.path.includes('PRIVATE_KEY'));
 assert.equal(f.calls.filter(c=>c.path.endsWith('/status')).length,1);assert.equal(f.run('kosellUi.error'),'Настройки сохранены.');
});
test('Private response from a logged-out session cannot populate another account UI',async()=>{const f=app();let done;f.ctx.apiRequest=()=>new Promise(resolve=>done=resolve);const loading=f.run('loadKosellStatus()');f.authState.token='different-session';done(f.status);await loading;assert.equal(f.run('kosellUi.status'),null);});
test('Unknown purchase exposes reconciliation, not a second buy button; actions require a preview',async()=>{const f=app();f.status.tasks=[{orderId:'ABC',status:'purchase_unknown',productName:'<img src=x>'},{orderId:'BCD',status:'delivery_unknown',rentalUid:'uid_1',productName:'Game',hours:24}];await f.run('loadKosellStatus()');const html=f.run('kosellRentMarkup({installed:true})');assert.match(html,/data-kosell-reconcile/);assert.match(html,/data-kosell-op="deliver"/);assert.doesNotMatch(html,/data-kosell-op="rent"/);assert.doesNotMatch(html,/<img src=x>/);assert.match(source,/kosellAction\('preview'/);assert.match(source,/kosellUi\.preview\.token/);});
test('Kosell plugin is legendary and assets load before app; existing cover layout stays unchanged',()=>{const rarity=readFileSync(new URL('./plugin-rarity.js',import.meta.url),'utf8'),page=readFileSync(new URL('./plugin-page.js',import.meta.url),'utf8'),html=readFileSync(new URL('./index.html',import.meta.url),'utf8');assert.match(rarity,/'zetslay.kosell-rent':'legendary'/);assert.match(page,/typeof kosellRentMarkup/);assert.ok(html.indexOf('src="kosell-rent.js')<html.indexOf('src="app.js'));assert.ok(!source.includes('<figure'));assert.ok(!source.includes('data-cover-plugin'));});
test('Advanced controls, offer preview and costs are visible with every financial automation opt-in',async()=>{const f=app();f.status.analytics={currencies:{RUB:{orderAmountMinor:10000,refundedAmountMinor:0,providerCostMinor:2000,marginBeforeFeesMinor:8000,uncertain:1}},days:[],games:[]};f.status.offerJobs=[{id:'j',status:'unknown',productName:'<script>x</script>',hours:12,priceMinor:2904,currency:'RUB'}];await f.run('loadKosellStatus()');const html=f.run('kosellRentMarkup({installed:true})');assert.match(html,/name="autoHideStock"/);assert.match(html,/name="buyerExtensionEnabled"/);assert.match(html,/data-kosell-offers/);assert.match(html,/data-kosell-offer-resolve/);assert.match(html,/Разница до комиссий/);assert.doesNotMatch(html,/<script>x/);assert.doesNotMatch(html,/name="reviewBonusEnabled" checked/);assert.doesNotMatch(html,/name="manageOffers" checked/);});
test('Closing an offer asks before mutating FunPay and requires a second confirmation',async()=>{const f=app();await f.run('loadKosellStatus()');const el={dataset:{kosellCloseJob:'job-123'}};await f.handlers.click({target:{closest:()=>el}});assert.equal(f.calls.filter(c=>c.options?.method==='POST').length,0);assert.equal(f.run('kosellUi.confirmAction.path'),'offer-cancel');await f.handlers.click({target:{closest:()=>({dataset:{kosellAction:'confirm-action'}})}});assert.equal(f.calls.find(c=>c.path.endsWith('/offer-cancel')).options.body.confirm,true);});
test('Offer creation preview is separate from purchase and accepts a bounded explicit duration list',async()=>{const f=app();await f.run('loadKosellStatus()');const form={matches:s=>s.includes('data-kosell-offers'),values:new Map([['templateLotId','321'],['productId','1'],['durations','1, 12, 24']])};await f.handlers.submit({target:form,preventDefault(){}});const req=f.calls.find(c=>c.path.endsWith('/offer-preview'));assert.deepEqual(Array.from(req.options.body.durations),[1,12,24]);assert.equal(req.options.body.activate,false);assert.ok(!f.calls.some(c=>c.path.endsWith('/offer-confirm')));});
test('Bulk price preview is explicit, escaped and cannot send a write before confirmation',async()=>{const f=app();await f.run('loadKosellStatus()');f.run(`kosellUi.managementPreview={token:'approve',operation:'reprice',count:1,items:[{game:'<script>x</script>',hours:12,title:'Lot',oldMinor:100,newMinor:120,currency:'RUB'}],warning:'Check'};`);const html=f.run('kosellManagementMarkup(kosellUi.status)');assert.match(html,/1.00 RUB → 1.20 RUB/);assert.match(html,/data-kosell-manage="confirm"/);assert.doesNotMatch(html,/<script>x/);assert.equal(f.calls.filter(c=>c.options?.method==='POST').length,0);await f.handlers.click({target:{closest:selector=>selector.includes('data-kosell-manage')?{dataset:{kosellManage:'confirm'}}:null}});assert.equal(f.calls.find(c=>c.path.endsWith('/management-confirm')).options.body.token,'approve');});
test('Separate provider proxy is cleared before its private POST and never appears in UI state',async()=>{const f=app();await f.run('loadKosellStatus()');const input={value:'http://u:p@8.8.8.8:8080'},form={matches:s=>s.includes('data-kosell-provider-proxy'),values:new Map([['proxyUrl',input.value]]),querySelector:()=>input};await f.handlers.submit({target:form,preventDefault(){}});assert.equal(input.value,'');const req=f.calls.find(c=>c.path.endsWith('/provider-proxy'));assert.equal(req.options.body.proxyUrl,'http://u:p@8.8.8.8:8080');assert.ok(!req.path.includes('u:p'));assert.ok(!f.run('JSON.stringify(kosellUi)').includes('u:p'));});
test('Archive restoration and drafts remain separate from live bindings and are escaped',async()=>{const f=app();f.status.mappingArchive=[{lotId:'3',nodeId:'9',productName:'<img>',title:'Archived',hours:24}];f.status.mappingDrafts=[{id:'draft',productName:'<img>',hours:12}];await f.run('loadKosellStatus()');const html=f.run('kosellManagementMarkup(kosellUi.status)+kosellDraftMarkup(kosellUi.status)');assert.match(html,/data-kosell-restore="9:3"/);assert.match(html,/Черновики ассортимента/);assert.doesNotMatch(html,/<img>/);await f.handlers.click({target:{closest:selector=>selector.includes('data-kosell-restore')?{dataset:{kosellRestore:'9:3'}}:null}});const req=f.calls.find(c=>c.path.endsWith('/management-preview'));assert.equal(req.options.body.operation,'restore');assert.deepEqual(Array.from(req.options.body.keys),['9:3']);});
test('Late reports cannot populate a different logged-in account',async()=>{const f=app();await f.run('loadKosellStatus()');let done;f.ctx.apiRequest=()=>new Promise(r=>done=r);const p=f.handlers.click({target:{closest:selector=>selector.includes('data-kosell-report')?{dataset:{kosellReport:'7'}}:null}});await new Promise(setImmediate);f.authState.token='someone-else';done({currencies:{RUB:{orders:99}}});await p;assert.equal(f.run('kosellUi.report'),null);});
test('Report compares a chosen currency without mixing dollars and rubles, renders empty lots and escapes buyer names',async()=>{const f=app();await f.run('loadKosellStatus()');f.run(`kosellUi.report={currencies:{RUB:{orders:2,orderAmountMinor:10000,providerCostMinor:2000,refundedAmountMinor:0,marginBeforeFeesMinor:8000,averageOrderMinor:5000,marginPercent:80}},change:{RUB:{revenue:null}},games:[{name:'<img onerror=x>',orders:2,hours:24,currencies:{RUB:{orderAmountMinor:10000,providerCostMinor:2000,marginBeforeFeesMinor:8000},USD:{orderAmountMinor:99999}}}],durations:[],days:[],buyers:[{name:'<script>bad</script>',orders:2,repeatBuyer:true}],mappings:[{lotId:'321',productName:'Game',orders:0}],heatmap:Array.from({length:7},()=>Array(24).fill(0)),buyerCount:1,repeatBuyerCount:1,uncertain:0,partialRefunds:0};`);const html=f.run('kosellReportMarkup()');assert.match(html,/data-kosell-report-sort/);assert.match(html,/100.00 RUB/);assert.ok(!html.includes('999.99'));assert.doesNotMatch(html,/<script>|<img /);assert.match(html,/Аудит лотов/);assert.match(html,/исходному заказу/);});

test('Failed save keeps the live form and key, displays the server reason at the button and allows retry',async()=>{
 const f=app();await f.run('loadKosellStatus()');let renders=0;f.ctx.renderPluginPage=()=>renders++;
 const {form,input,feedback,fieldset}=settingsForm();f.ctx.apiRequest=async()=>{throw Error('Неверный API-ключ Kosell')};
 await submitSettings(f,form);assert.equal(input.value,'PRIVATE_KEY');assert.equal(renders,0);assert.equal(fieldset.disabled,false);assert.equal(feedback.textContent,'Неверный API-ключ Kosell');assert.equal(feedback.attributes.role,'alert');assert.equal(f.run('kosellUi.busy'),false);assert.ok(!f.run('JSON.stringify(kosellUi)').includes('PRIVATE_KEY'));
 f.ctx.apiRequest=async()=>f.status;await submitSettings(f,form);assert.equal(input.value,'');assert.equal(renders,1);
});
test('Pending save does not erase values, prevents duplicate POST and exposes saving feedback',async()=>{
 const f=app();await f.run('loadKosellStatus()');let resolve,requests=0;f.ctx.apiRequest=()=>{requests++;return new Promise(r=>resolve=r)};const {form,input,feedback,fieldset}=settingsForm();
 const pending=submitSettings(f,form);await new Promise(setImmediate);assert.equal(input.value,'PRIVATE_KEY');assert.equal(fieldset.disabled,true);assert.match(feedback.textContent,/Сохраняем/);await submitSettings(f,form);assert.equal(requests,1);resolve(f.status);await pending;assert.equal(input.value,'');assert.equal(fieldset.disabled,false);
});
test('Zero spend is allowed for manual settings but automatic purchases and bonuses explain the required limit without discarding input',async()=>{
 for(const option of ['automatic','reviewBonusEnabled','buyerExtensionEnabled']){const f=app();await f.run('loadKosellStatus()');const {form,input,feedback}=settingsForm({maxSpend:'0.00',[option]:'on'});await submitSettings(f,form);assert.ok(!f.calls.some(c=>c.options?.method==='POST'));assert.match(feedback.textContent,/лимит расходов больше 0/);assert.equal(input.value,'PRIVATE_KEY');}
 const f=app();await f.run('loadKosellStatus()');const {form}=settingsForm({maxSpend:'0.00'});await submitSettings(f,form);assert.equal(f.calls.find(c=>c.path.endsWith('/settings')).options.body.config.maxSpendMinor,0);
});
test('Invalid decimals, oversize spend, bonus table and templates fail locally without losing the draft',async()=>{
 for(const [values,expected] of [[{maxSpend:'15.999'},/Лимит/],[{maxSpend:'1000000.01'},/1 000 000/],[{reviewBonusByHours:'0:1'},/1–720/],[{reviewBonusByHours:'24:1,24:2'},/один раз/],[{deliveryTemplate:'Only $login'},/\$password/],[{warningTemplate:'Secret $password'},/логин и пароль/],[{offerTitleEnTemplate:'x'.repeat(151)},/шаблон/],[{extensionTemplate:'No payment link'},/\$link/],[{buyerCooldownSeconds:'1.5'},/целое число/],[{passwordCommand:'!steamcode'},/Команда/]]){
  const f=app();await f.run('loadKosellStatus()');const {form,input,feedback}=settingsForm(values);await submitSettings(f,form);assert.ok(!f.calls.some(c=>c.options?.method==='POST'));assert.match(feedback.textContent,expected);assert.equal(input.value,'PRIVATE_KEY');
 }
});
test('Missing first key is explained, surrounding whitespace is trimmed and existing key may be left blank',async()=>{
 const f=app();await f.run('loadKosellStatus()');f.status.keyConfigured=false;let x=settingsForm({apiKey:''});await submitSettings(f,x.form);assert.match(x.feedback.textContent,/Введите API-ключ/);assert.ok(!f.calls.some(c=>c.options?.method==='POST'));
 f.status.keyConfigured=true;x=settingsForm({apiKey:'  PRIVATE_KEY\n'});await submitSettings(f,x.form);assert.equal(f.calls.find(c=>c.options?.method==='POST').options.body.apiKey,'PRIVATE_KEY');
 const g=app();await g.run('loadKosellStatus()');await submitSettings(g,settingsForm({apiKey:''}).form);assert.ok(!Object.hasOwn(g.calls.find(c=>c.options?.method==='POST').options.body,'apiKey'));
});
test('A malformed successful API response cannot falsely announce saving or clear the key',async()=>{
 for(const result of [undefined,{}, {config:{},keyConfigured:false}]){const f=app();await f.run('loadKosellStatus()');f.ctx.apiRequest=async()=>result;const x=settingsForm();await submitSettings(f,x.form);assert.match(x.feedback.textContent,/не подтвердил сохранение/);assert.equal(x.input.value,'PRIVATE_KEY');}
});
test('Late status response cannot overwrite the saved settings or success feedback',async()=>{
 const f=app();await f.run('loadKosellStatus()');let completeRead;const saved={...f.status,config:{...f.status.config,maxSpendMinor:10050}};
 f.ctx.apiRequest=async(path)=>path.endsWith('/status')?new Promise(r=>completeRead=r):saved;
 const read=f.run('loadKosellStatus()');await submitSettings(f,settingsForm().form);completeRead(f.status);await read;assert.equal(f.run('kosellUi.status.config.maxSpendMinor'),10050);assert.equal(f.run('kosellUi.error'),'Настройки сохранены.');
});
test('Save completion after logout cannot populate another session, including reuse of the same token',async()=>{
 for(const sameToken of [false,true]){const f=app();f.ctx.sessionGeneration=1;await f.run('loadKosellStatus()');let done;f.ctx.apiRequest=()=>new Promise(r=>done=r);const x=settingsForm(),pending=submitSettings(f,x.form);await new Promise(setImmediate);if(!sameToken)f.authState.token='other-session';f.ctx.sessionGeneration=2;done({...f.status,config:{maxSpendMinor:99000}});await pending;assert.notEqual(f.run('kosellUi.status.config.maxSpendMinor'),99000);assert.equal(x.input.value,'PRIVATE_KEY');}
});
test('Invalid field in a collapsed settings group opens that group and reports next to save without rerendering',()=>{
 const f=app();let renders=0;f.ctx.renderPluginPage=()=>renders++;const x=settingsForm(),details={tagName:'DETAILS',open:false,parentElement:x.form};x.input.parentElement=details;x.input.name='apiKey';x.input.form=x.form;x.input.validationMessage='Проверьте поле';
 return f.handlers.invalid({target:x.input}).then(()=>{assert.equal(details.open,true);assert.equal(x.input.focused,true);assert.equal(x.feedback.textContent,'Проверьте поле');assert.equal(renders,0)});
});

function catalogForm(values={}){
 const fieldset={disabled:false},button={textContent:'Показать план недостающих лотов'},feedback={textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v}},plan={focused:false,scrolled:false,focus(){this.focused=true},scrollIntoView(){this.scrolled=true}},result={innerHTML:'',querySelector:()=>plan};
 const form={values:new Map(Object.entries({templates:'1:73160726',durations:'1, 3, 24',...values})),matches:selector=>selector.includes('[data-kosell-catalog]'),attributes:{},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]},querySelector:selector=>({'fieldset':fieldset,'[type="submit"]':button,'[data-kosell-catalog-feedback]':feedback,'[data-kosell-catalog-result]':result})[selector]||null};
 return {form,fieldset,button,feedback,plan,result};
}
const catalogPlan=patch=>({token:'plan-token',currency:'RUB',activate:false,expiresAt:Date.now()+300000,multi:true,items:[{productId:1,productName:'<img onerror=x>',hours:24,costMinor:1000,priceMinor:1200}],skipped:[],warning:'Проверьте <script>категорию</script>',...patch});
async function catalogApp(){const f=app();f.status.config.manageOffers=true;await f.run('loadKosellStatus()');let renders=0;f.ctx.renderPluginPage=()=>renders++;f.renders=()=>renders;return f;}
const submitCatalog=(f,x)=>f.handlers.submit({target:x.form,preventDefault(){}});
function catalogButton(x,action){const el={dataset:{kosellCatalogAction:action},closest:()=>x.form};return {target:{closest:selector=>selector==='[data-kosell-catalog-action]'?el:null}};}

test('Catalog preparation keeps live inputs, renders the plan beside its form and never starts creation',async()=>{
 const f=await catalogApp(),x=catalogForm();f.ctx.apiRequest=async(path,options)=>{f.calls.push({path,options});return catalogPlan();};
 await submitCatalog(f,x);assert.equal(f.renders(),0);assert.equal(x.form.values.get('templates'),'1:73160726');
 assert.match(x.feedback.textContent,/План готов: 1/);assert.match(x.result.innerHTML,/План массовой витрины/);assert.match(x.result.innerHTML,/12.00 RUB/);assert.match(x.result.innerHTML,/data-kosell-catalog-action="confirm"/);
 assert.doesNotMatch(x.result.innerHTML,/<img|<script>/);assert.ok(x.plan.focused);assert.ok(x.plan.scrolled);assert.equal(x.fieldset.disabled,false);
 const req=f.calls.find(c=>c.path.endsWith('/catalog-plan'));assert.deepEqual(Array.from(req.options.body.durations),[1,3,24]);assert.equal(req.options.body.templates[0].templateLotId,'73160726');assert.equal(req.options.body.activate,false);
 assert.ok(!f.calls.some(c=>c.path.endsWith('/offer-confirm')));
 const html=f.run('kosellRentMarkup({installed:true})');assert.equal(html.split('План массовой витрины').length-1,1);assert.ok(html.indexOf('План массовой витрины')>html.indexOf('Массовая витрина'));assert.match(html,/value="1, 3, 24"/);
});

test('Pending catalog plan exposes loading feedback and blocks duplicate requests without rerendering',async()=>{
 const f=await catalogApp(),x=catalogForm();let finish,count=0;f.ctx.apiRequest=()=>{count++;return new Promise(r=>finish=r)};
 const pending=submitCatalog(f,x);await new Promise(setImmediate);assert.equal(count,1);assert.equal(x.fieldset.disabled,true);assert.equal(x.button.textContent,'Готовим план…');assert.match(x.feedback.textContent,/Лоты ещё не создаются/);
 await submitCatalog(f,x);assert.equal(count,1);assert.equal(f.renders(),0);finish(catalogPlan());await pending;assert.equal(x.fieldset.disabled,false);assert.equal(f.run('kosellUi.busy'),false);
});

test('Catalog validation explains blank, duplicate, invalid and oversized inputs locally and preserves the draft',async()=>{
 for(const [values,reason] of [[{templates:''},/хотя бы одну пару/],[{templates:'https://funpay.com/lots/offer?id=1'},/Строка 1/],[{templates:'1:2\n1:3'},/Каждая игра/],[{templates:'9007199254740993:2'},/Строка 1/],[{templates:Array.from({length:51},(_,i)=>(i+1)+':2').join('\n')},/до 50 игр/],[{durations:''},/до 12/],[{durations:'1,1'},/разных/],[{durations:'1.5'},/целых/],[{durations:'0,721'},/720/],[{durations:Array.from({length:13},(_,i)=>i+1).join(',')},/до 12/]]){
  const f=await catalogApp(),x=catalogForm(values);await submitCatalog(f,x);
  assert.match(x.feedback.textContent,reason);assert.equal(x.feedback.attributes.role,'alert');assert.equal(f.calls.filter(c=>c.options?.method==='POST').length,0);assert.equal(f.renders(),0);assert.equal(f.run('kosellUi.catalogDraft.templates'),x.form.values.get('templates'));
 }
 const f=await catalogApp(),x=catalogForm();f.status.config.manageOffers=false;await submitCatalog(f,x);assert.match(x.feedback.textContent,/включите управление/);assert.equal(f.calls.filter(c=>c.options?.method==='POST').length,0);
});

test('Catalog accepts blank separator lines and retains an explicit activation choice',async()=>{
 const f=await catalogApp(),x=catalogForm({templates:'1:73160726\n\n2:73160727\n',durations:'1 12 24',activate:'on'});let payload;
 f.ctx.apiRequest=async(path,options)=>{payload=options.body;return catalogPlan({activate:true})};await submitCatalog(f,x);
 assert.equal(payload.templates.length,2);assert.deepEqual(Array.from(payload.durations),[1,12,24]);assert.equal(payload.activate,true);assert.match(x.result.innerHTML,/активация после проверки/);
});

test('Catalog API errors remain beside the button and allow retry without erasing input',async()=>{
 const f=await catalogApp(),x=catalogForm();f.ctx.apiRequest=async()=>{throw Error('Валюта шаблона отличается')};await submitCatalog(f,x);
 assert.equal(x.feedback.textContent,'Валюта шаблона отличается');assert.equal(x.feedback.attributes.role,'alert');assert.equal(x.form.values.get('templates'),'1:73160726');assert.equal(f.run('kosellUi.offerPreview'),null);assert.equal(x.fieldset.disabled,false);assert.equal(f.renders(),0);
 f.ctx.apiRequest=async()=>catalogPlan();await submitCatalog(f,x);assert.match(x.feedback.textContent,/План готов/);assert.equal(x.feedback.attributes.role,'status');
});

test('Empty catalog plan displays skip reasons and offers no create confirmation',async()=>{
 const f=await catalogApp(),x=catalogForm();f.ctx.apiRequest=async()=>catalogPlan({items:[],skipped:[{productId:1,hours:24,reason:'exists'},{productId:1,hours:720,reason:'duration'}]});await submitCatalog(f,x);
 assert.match(x.result.innerHTML,/Новых лотов для создания нет/);assert.match(x.result.innerHTML,/Уже есть привязка/);assert.match(x.result.innerHTML,/Срок недоступен/);assert.doesNotMatch(x.result.innerHTML,/data-kosell-catalog-action="confirm"/);
});

test('Malformed catalog responses never enable creation or silently show an empty plan',async()=>{
 for(const p of [undefined,{},catalogPlan({token:''}),catalogPlan({items:[{productName:'Game',hours:24,priceMinor:-1}]}),catalogPlan({skipped:null})]){
  const f=await catalogApp(),x=catalogForm();f.ctx.apiRequest=async()=>p;await submitCatalog(f,x);assert.match(x.feedback.textContent,/не вернул полный план/);assert.equal(f.run('kosellUi.offerPreview'),null);assert.equal(x.result.innerHTML,'');
 }
});

test('Catalog plan from a former session cannot populate a new account, even with token reuse',async()=>{
 for(const sameToken of [false,true]){
  const f=await catalogApp(),x=catalogForm();f.ctx.sessionGeneration=1;let finish;f.ctx.apiRequest=()=>new Promise(r=>finish=r);const pending=submitCatalog(f,x);await new Promise(setImmediate);if(!sameToken)f.authState.token='other';f.ctx.sessionGeneration=2;finish(catalogPlan());await pending;assert.equal(f.run('kosellUi.offerPreview'),null);assert.equal(x.result.innerHTML,'');
 }
});

test('Catalog create is sent only on explicit confirmation, blocks duplicates and reports queue acceptance locally',async()=>{
 const f=await catalogApp(),x=catalogForm();f.ctx.apiRequest=async()=>catalogPlan();await submitCatalog(f,x);let finish,count=0;
 f.ctx.apiRequest=(path,options)=>{assert.ok(path.endsWith('/offer-confirm'));assert.equal(options.body.token,'plan-token');count++;return new Promise(r=>finish=r)};
 const pending=f.handlers.click(catalogButton(x,'confirm'));await new Promise(setImmediate);await f.handlers.click(catalogButton(x,'confirm'));assert.equal(count,1);assert.match(x.feedback.textContent,/Подтверждаем очередь/);
 finish({queued:1});await pending;assert.match(x.feedback.textContent,/Создание принято в очередь: 1/);assert.equal(f.run('kosellUi.offerPreview'),null);assert.equal(f.renders(),0);assert.equal(f.run('kosellUi.busy'),false);
});

test('Expired, edited or cancelled catalog plans cannot create offers',async()=>{
 for(const mode of ['expired','edited','cancelled']){
  const f=await catalogApp(),x=catalogForm();f.ctx.apiRequest=async()=>catalogPlan();await submitCatalog(f,x);let writes=0;f.ctx.apiRequest=async()=>{writes++;return {queued:1}};
  if(mode==='expired')f.run('kosellUi.offerPreview.expiresAt=1');
  if(mode==='edited'){x.form.values.set('durations','48');await f.handlers.input({target:{form:x.form,matches:()=>false}});assert.match(x.feedback.textContent,/Параметры изменены/);}
  if(mode==='cancelled')await f.handlers.click(catalogButton(x,'cancel'));
  await f.handlers.click(catalogButton(x,'confirm'));assert.equal(writes,0);assert.equal(f.run('kosellUi.offerPreview'),null);
 }
});

test('Failed catalog confirmation asks to check the queue and cannot automatically replay the consumed plan',async()=>{
 const f=await catalogApp(),x=catalogForm();f.ctx.apiRequest=async()=>catalogPlan();await submitCatalog(f,x);let writes=0;f.ctx.apiRequest=async()=>{writes++;throw Error('Соединение прервано')};
 await f.handlers.click(catalogButton(x,'confirm'));assert.match(x.feedback.textContent,/проверьте очередь/);assert.equal(x.feedback.attributes.role,'alert');await f.handlers.click(catalogButton(x,'confirm'));assert.equal(writes,1);assert.equal(f.run('kosellUi.offerPreview'),null);
});

test('Native invalid catalog fields report next to their form without rerendering',async()=>{
 const f=await catalogApp(),x=catalogForm();await f.handlers.invalid({target:{form:x.form,validationMessage:'Заполните пары игр и лотов'}});
 assert.equal(x.feedback.textContent,'Заполните пары игр и лотов');assert.equal(x.feedback.attributes.role,'alert');assert.equal(f.renders(),0);
});

test('Missing queue acknowledgement does not falsely announce creation or permit a replay',async()=>{
 const f=await catalogApp(),x=catalogForm();f.ctx.apiRequest=async()=>catalogPlan();await submitCatalog(f,x);let count=0;f.ctx.apiRequest=async()=>{count++;return {}};
 await f.handlers.click(catalogButton(x,'confirm'));assert.match(x.feedback.textContent,/не подтвердил количество/);assert.match(x.feedback.textContent,/проверьте очередь/);assert.equal(x.feedback.attributes.role,'alert');assert.equal(x.fieldset.disabled,false);assert.equal(f.run('kosellUi.offerPreview'),null);
 await f.handlers.click(catalogButton(x,'confirm'));assert.equal(count,1);
});

test('automatic flag alone cannot claim delivery readiness and pending reasons are readable',async()=>{
 const f=app();await f.run('loadKosellStatus()');f.status.config.automatic=true;
 f.status.automaticReadiness={ready:false,reasons:['MAPPINGS_MISSING','BASELINE_PENDING']};
 let html=f.run('kosellRentMarkup({installed:true})');assert.match(html,/Добавьте привязку лота/);assert.match(html,/Ожидается первый успешный опрос/);assert.match(html,/Нужна проверка/);assert.doesNotMatch(html,/Готова к новым заказам/);
 f.status.automaticReadiness={ready:true,reasons:[]};html=f.run('kosellRentMarkup({installed:true})');assert.match(html,/Готова к новым заказам/);
});
