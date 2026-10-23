const {chromium}=require(process.env.ZETSLAY_PLAYWRIGHT_MODULE||'playwright');
const {execFileSync}=require('node:child_process'),os=require('node:os');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.ZETSLAY_BROWSER_OUTPUT||'/tmp/proxy-shop-previews';fs.mkdirSync(out,{recursive:true});
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'zetslay-proxy-stage-'));execFileSync('python3',[path.join(root,'deploy/stage-proxy-sales-ui.py'),path.join(root,'app'),path.join(root,'app'),stage]);
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://fixture');let file=path.join(root,decodeURIComponent(u.pathname));if(u.pathname.endsWith('/'))file=path.join(file,'index.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}res.setHeader('content-type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(u.pathname==='/app/'?path.join(stage,'index.html'):file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}],['compact',{width:320,height:700}]]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];
  try{
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"UNAUTHORIZED"}}'}));
  await page.route('**/legal/publication.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({version:'fixture',hash:'fixture-publication',status:'active'})}));
  await page.clock.install();await page.goto(base+'/app/#proxy-shop');await page.waitForFunction(()=>typeof proxyShopMarkup==='function'&&typeof storeToolsRoute==='function');
  assert.equal(await page.evaluate(()=>location.hash),'#proxy-shop','deep link survives initial routing');
  await page.evaluate(()=>{
   sessionGeneration++;resetAccountData();authState.user={id:'proxy-test-user',email:'proxy@example.invalid'};authState.token='proxy-fixture';authState.workspace={id:'proxy-test-workspace',plan:{id:'start',active:true,activatedAt:'2026-01-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z'},pluginLicenses:[]};
   state.storeContent={observedAt:null,orders:[],messages:[],lots:[]};
   window.proxyFixture={calls:[],resolve:null,quotes:new Map(),lostRenewal:false,managed:{source:'none',configured:false,activePlan:true,credentialConfigured:true,canActivate:true,current:null,candidates:[],requests:[],operation:null},shop:{enabled:true,balanceMinor:10000,operations:[],currency:'RUB'},publication:{version:'fixture',hash:'fixture-publication'},profile:{profile:{authorId:'author_fixture',displayName:'Тестовый продавец',bio:'',publicVisible:false},identity:{email:'proxy@example.invalid',role:'user'},plan:authState.workspace.plan},onboarding:{state:'proxy_required',activePlan:true,telegram:{linked:true,botConfigured:true,bot:{username:'proxy_fixture_bot'}},funPay:{credentialConfigured:true,proxyConfigured:false,store:null}}};
   state.onboarding=structuredClone(proxyFixture.onboarding);
   apiRequest=async(p,o={})=>{
    const f=proxyFixture;f.calls.push({path:p,method:o.method||'GET',body:o.body});
    if(p==='/api/v1/learning')return{version:1,revision:1,welcomeSeen:true,status:'completed',step:5};
    if(p.startsWith('/api/v1/legal/requests'))return{requests:[],nextOffset:null,admin:false};
    if(p==='/api/v1/legal/acceptance')return{required:false,publication:{state:'published',...f.publication},acceptance:null};
    if(p==='/api/v1/account/security')return{enabled:false,sessions:[]};
    if(p==='/api/v1/account/sync-health')return{status:'not_observed'};
    if(p==='/api/v1/profile')return structuredClone(f.profile);
    if(p==='/api/v1/onboarding')return structuredClone(f.onboarding);
    if(p==='/api/v1/managed-proxy')return structuredClone(f.managed);
    if(p==='/api/v1/proxy-shop')return structuredClone({...f.shop,publication:f.publication});
    if(p==='/api/v1/proxy-shop/catalog')return{enabled:true,locations:[{nodeId:35,title:'DE_ISP01',country:'DE',monthlyPriceMinor:5000}]};
    if(p==='/api/v1/proxy-shop/quote'){
     const b=o.body,id=crypto.randomUUID(),q={id,kind:b.kind,nodeId:35,resourceId:b.resourceId||null,country:'DE',months:b.months,termDays:b.months*30,totalMinor:5000*b.months,currency:'RUB',expiresAt:new Date(Date.now()+600000).toISOString(),...(b.kind==='renew'?{extendedExpiresAt:new Date(Date.parse(f.managed.current.expiresAt)+b.months*30*86400000).toISOString()}:{})};f.quotes.set(id,q);return{quote:q,balanceMinor:f.shop.balanceMinor,publication:f.publication};
    }
    if(p==='/api/v1/proxy-shop/purchase'){
     const q=f.quotes.get(o.body.quoteId);return new Promise((resolve,reject)=>f.resolve=()=>{
      f.shop.balanceMinor-=q.totalMinor;
      const op={id:o.body.requestId,kind:q.kind,status:f.lostRenewal?'review_required':'delivered',walletState:f.lostRenewal?'reserved':'charged',priceMinor:q.totalMinor,country:'DE',months:q.months,resourceId:q.resourceId||'mpx_00000000-0000-4000-8000-000000000005',expiresAt:q.extendedExpiresAt||new Date(Date.now()+30*86400000).toISOString(),createdAt:new Date().toISOString(),checks:{availability:{status:'passed',httpStatus:200,attempts:2},authorization:{status:'not_checked'},readAccess:{status:'not_checked'}}};
      f.shop.operations.unshift(op);
      if(q.kind==='renew'){if(!f.lostRenewal)f.managed.current.expiresAt=op.expiresAt;}
      else f.managed.candidates=[{id:op.resourceId,label:'Германия · Серверный',supplier:'steelproxy',country:'DE',state:'assigned',remainingDays:30,expiresAt:op.expiresAt,availability:op.checks.availability}];
      if(f.lostRenewal)reject(Error('Lost fixture response'));else resolve({operation:structuredClone(op)});
     });
    }
    if(p==='/api/v1/proxy-shop/reconcile'){const op=f.shop.operations.find(x=>x.id===o.body.operationId);op.status='delivered';op.walletState='charged';f.managed.current.expiresAt=op.expiresAt;return{operation:structuredClone(op)};}
    if(p==='/api/v1/managed-proxy/activate'){
     const resource=f.managed.candidates[0];f.managed.current=resource;f.managed.candidates=[];f.managed.configured=true;f.managed.operation={id:o.body.actionId,status:'complete',installed:true,checks:{availability:{status:'passed',httpStatus:200,latencyMs:200},authorization:{status:'passed',storeId:'42'},readAccess:{status:'passed'}},updatedAt:new Date().toISOString()};f.onboarding.state='connected_read_only';f.onboarding.funPay={...f.onboarding.funPay,proxyConfigured:true,store:{id:'42'}};return{operation:structuredClone(f.managed.operation)};
    }
    if(p==='/api/v1/subscription/status')return{workspace:structuredClone(authState.workspace),trial:{state:'plan_active'},discounts:[]};
    if(p==='/api/v1/subscription/trial')return{state:'plan_active',durationHours:72,serverNow:new Date().toISOString(),remainingSeconds:0};
    if(p==='/api/v1/plugins')return{entries:[],canManage:false};
    if(p==='/api/v1/payments')return{enabled:true,methods:[2],balanceMinor:f.shop.balanceMinor,payments:[],ledger:[],publication:f.publication};
    if(p==='/api/v1/funpay/connection')return{};
    return{};
   };
   renderAuthState();setAuthModal(false);learningUi.data={version:1,revision:1,welcomeSeen:true,status:'completed',step:5};profileState.data=proxyFixture.profile;setView('profile');renderProfile();
  });
  await page.locator('[data-profile] [data-proxy-entry] a').waitFor();
  if(viewport.width<1000)await page.evaluate(()=>setSidebar(true));
  const nav=page.locator('[data-view-target="proxy-shop"]');await nav.click();await page.clock.runFor(300);
  const store=page.locator('[data-proxy-store]'),panel=store.locator('[data-managed-proxy]');
  await panel.locator('[data-ps-selection]').waitFor();
  assert.equal(await nav.getAttribute('aria-current'),'page');assert.equal(await page.title(),'Прокси — ZetSlay Control');
  assert.match(await store.locator('.ps-offer').innerText(),/Германия/);assert.doesNotMatch(await store.locator('.ps-offer').innerText(),/DE_ISP01/);
  assert.match(await store.locator('.ps-offer-price').innerText(),/50.*₽/);
  assert.ok(await store.evaluate(n=>{const r=n.getBoundingClientRect();return r.width<=innerWidth+1&&r.right<=innerWidth+1;}),'store fits viewport');
  await page.evaluate(()=>document.querySelector('.toast-region')?.replaceChildren());await page.screenshot({path:path.join(out,name+'-store.png'),fullPage:false});
  await store.locator('[data-ps-topup]:visible').first().click();await page.locator('dialog [data-payment-form] [name=amount]').waitFor();assert.equal(await page.evaluate(()=>location.hash),'#billing');
  await page.locator('dialog [data-billing-close]').click();await page.evaluate(()=>setView('proxy-shop'));await page.clock.runFor(300);await panel.locator('[data-ps-selection]').waitFor();
  assert.equal(await page.evaluate(()=>proxyFixture.calls.filter(c=>c.method==='POST').length),0,'opening store and topup never charges the wallet');
  await page.evaluate(()=>{setModal(true);connectionStep=3;connectionLoading=false;connectionLoadFailed=false;renderConnectionWizard();});await page.clock.runFor(400);
  await page.locator('.connect-modal [data-ps-selection]').waitFor();await page.evaluate(()=>document.querySelector('.toast-region')?.replaceChildren());await page.screenshot({path:path.join(out,name+'-wizard.png'),fullPage:false});await page.locator('.connect-modal [data-proxy-open]').click();await page.clock.runFor(300);assert.equal(await page.evaluate(()=>location.hash),'#proxy-shop');assert.equal(await page.locator('.connect-modal').evaluate(n=>n.classList.contains('is-open')),false);
  await panel.locator('[data-ps-selection] [type=submit]').click();await panel.locator('[data-ps-purchase]').waitFor();
  assert.equal(await page.evaluate(()=>proxyFixture.calls.filter(c=>c.path.endsWith('/purchase')).length),0,'quote does not debit');
  await panel.locator('[data-ps-purchase]').scrollIntoViewIfNeeded();await page.evaluate(()=>document.querySelector('.toast-region')?.replaceChildren());await page.screenshot({path:path.join(out,name+'-quote.png'),fullPage:false});
  await panel.locator('[name=confirmed]').check();await panel.locator('[data-ps-purchase] [type=submit]').click();await page.waitForFunction(()=>!!proxyFixture.resolve);
  assert.equal(await panel.locator('[data-ps-purchase] [type=submit]').isDisabled(),true);
  await page.evaluate(()=>document.querySelector('[data-proxy-store] [data-ps-purchase] [type=submit]').click());
  assert.equal(await page.evaluate(()=>proxyFixture.calls.filter(c=>c.path==='/api/v1/proxy-shop/purchase').length),1);
  await page.evaluate(()=>proxyFixture.resolve());await page.waitForFunction(()=>!proxyShopUi.busy&&proxyShopUi.data?.operations[0]?.status==='delivered');
  assert.equal(await panel.locator('[data-mp-action=activate]').count(),1);assert.equal(await page.evaluate(()=>proxyFixture.managed.current),null,'delivery does not silently replace route');assert.equal(await page.evaluate(()=>proxyShopUi.data.balanceMinor),5000);
  await panel.locator('[data-mp-action=activate]').click();await page.waitForFunction(()=>managedProxyUi.data?.operation?.installed&&!managedProxyUi.busy);
  assert.match(await panel.innerText(),/Магазин #42/);await panel.locator('[data-ps-kind=renew]').click();await panel.locator('[data-ps-selection] [type=submit]').click();await panel.locator('[data-ps-purchase]').waitFor();
  await page.evaluate(()=>{proxyFixture.lostRenewal=true;proxyFixture.resolve=null;});await panel.locator('[name=confirmed]').check();await panel.locator('[data-ps-purchase] [type=submit]').click();await page.waitForFunction(()=>!!proxyFixture.resolve);await page.evaluate(()=>proxyFixture.resolve());await page.waitForFunction(()=>!proxyShopUi.busy&&proxyShopUi.data?.operations[0]?.status==='review_required');
  await panel.locator('[data-ps-reconcile]').waitFor();await panel.locator('[data-ps-reconcile]').click();await page.waitForFunction(()=>!proxyShopUi.busy&&proxyShopUi.data?.operations[0]?.status==='delivered');
  assert.equal(await page.evaluate(()=>proxyFixture.calls.filter(c=>c.path==='/api/v1/proxy-shop/purchase').length),2,'lost renewal is read back, not purchased twice');
  assert.equal(await page.evaluate(()=>proxyShopUi.data.balanceMinor),0);await panel.locator('.proxy-shop>.ps-operation').scrollIntoViewIfNeeded();await page.evaluate(()=>document.querySelector('.toast-region')?.replaceChildren());await page.screenshot({path:path.join(out,name+'-renewed.png'),fullPage:false});
  assert.ok(await panel.evaluate(n=>{const r=n.getBoundingClientRect();return r.width<=innerWidth+1&&r.right<=innerWidth+1;}),'shop panel fits viewport');
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('sp_live_')),false);
  await page.evaluate(()=>clearSession());assert.equal(await store.innerHTML(),'','private proxy page is cleared on logout');assert.equal(await page.evaluate(()=>proxyShopUi.data),null);assert.equal(await page.evaluate(()=>proxyShopUi.quote),null);assert.deepEqual(errors,[]);
  }catch(error){await page.screenshot({path:path.join(out,name+'-failure.png'),fullPage:false});console.log('Fixture state',name,JSON.stringify(await page.evaluate(()=>({shopBusy:typeof proxyShopUi!=='undefined'&&proxyShopUi.busy,connectionStep,connectionLoading,connectionLoadFailed,connectionError,modalOpen:document.querySelector('.connect-modal')?.className,selectionCount:document.querySelectorAll('.connect-modal [data-ps-selection]').length,hiddenParents:Array.from(document.querySelectorAll('.connect-modal [data-ps-selection]')).map(n=>{const rows=[];for(;n;n=n.parentElement)rows.push([n.tagName,n.className,n.hidden,getComputedStyle(n).display,getComputedStyle(n).visibility,n.getBoundingClientRect().width]);return rows;})}))));throw error;}finally{await page.close();}
 }
 console.log('Proxy shop Chrome: desktop/mobile/320px, dedicated menu page, direct link, profile shortcut and connection wizard, quote consent, wallet-only purchase, double-click protection, separate activation, lost renewal recovery and account reset passed. No live supplier or marketplace requests.');
 }finally{await browser.close();server.close();fs.rmSync(stage,{recursive:true,force:true});}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
