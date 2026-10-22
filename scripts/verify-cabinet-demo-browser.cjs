const {chromium}=require(process.env.ZETSLAY_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.ZETSLAY_BROWSER_OUTPUT||'/tmp/cabinet-demo-previews';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://fixture');let file=path.join(root,decodeURIComponent(u.pathname));if(u.pathname.endsWith('/'))file=path.join(file,'index.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}res.setHeader('content-type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const [name,viewport]of [['desktop',{width:1440,height:1100}],['mobile',{width:390,height:844}]]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"UNAUTHORIZED"}}'}));
  await page.clock.install();await page.goto(base+'/app/');await page.waitForFunction(()=>typeof cabinetDemoExperience==='function'&&typeof storeToolsRoute==='function');
  await page.evaluate(()=>{
   authState.user={id:'demo-browser-user',email:'demo@example.invalid'};authState.token='fixture';authState.workspace={id:'demo-browser-workspace',plan:{active:false},pluginLicenses:[]};
   state.onboarding={state:'plan_required',activePlan:false};state.storeContent={observedAt:null,orders:[],messages:[],lots:[]};
   window.demoFixture={calls:[],active:false,fail:false,activationResolve:null};
   const trial=()=>({state:demoFixture.active?'active':'available',durationHours:72,serverNow:new Date().toISOString(),remainingSeconds:demoFixture.active?259200:0,...(demoFixture.active?{startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+259200000).toISOString()}:{})});
   apiRequest=async(p,o={})=>{demoFixture.calls.push({path:p,method:o.method||'GET'});if(p==='/api/v1/subscription/trial'&&o.method==='POST'){if(demoFixture.fail)throw Error('Test activation failure');return new Promise(resolve=>demoFixture.activationResolve=()=>{demoFixture.active=true;authState.workspace.plan={id:'trial_3d',active:true,expiresAt:new Date(Date.now()+259200000).toISOString()};resolve({workspace:structuredClone(authState.workspace),trial:trial()});});}if(p==='/api/v1/subscription/trial')return trial();if(p==='/api/v1/subscription/status')return{workspace:structuredClone(authState.workspace),trial:trial(),discounts:[]};if(p==='/api/v1/plugins')return{plugins:[]};return {};};
   renderAuthState();setAuthModal(false);subscriptionUi.data={trial:{state:'available'}};subscriptionUi.dataScope=subscriptionScope();subscriptionUi.scope=subscriptionScope();setView('dashboard');
  });
  const gate=view=>page.locator(`[data-view="${view}"] [data-access-gate]`);
  await gate('dashboard').getByText('Nova Store',{exact:false}).waitFor();
  assert.equal(await page.locator('[data-view="dashboard"] .overview-context').isVisible(),false,'real shop controls hidden');
  const before=await gate('dashboard').locator('.demo-metric-primary strong').innerText();await gate('dashboard').locator('[data-demo-period=month]').click();assert.notEqual(await gate('dashboard').locator('.demo-metric-primary strong').innerText(),before);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,name+'-dashboard.png'),fullPage:true});
  await gate('dashboard').locator('.demo-nav [data-demo-view=orders]').click();await gate('orders').locator('[data-demo-search]').fill('Игрок_02');assert.equal(await gate('orders').locator('tbody tr').count(),1);assert.match(await gate('orders').locator('tbody').innerText(),/DEMO-011/);
  await gate('orders').locator('[data-demo-status]').selectOption('paid');assert.match(await gate('orders').locator('tbody').innerText(),/учебных заказов нет/);
  await gate('orders').locator('[data-demo-search]').fill('');await gate('orders').locator('[data-demo-status]').selectOption('all');
  await gate('orders').locator('.demo-nav [data-demo-view=messages]').click();await gate('messages').locator('[data-demo-template]').click();await gate('messages').locator('[data-demo-draft]').fill('Здравствуйте! Учебный ответ <img src=x onerror=alert(1)>');
  await gate('messages').locator('[data-demo-draft]').focus();await page.evaluate(()=>subscriptionApply());assert.equal(await gate('messages').locator('[data-demo-draft]').evaluate(n=>n===document.activeElement),true,'background status refresh preserves editing');
  await gate('messages').locator('[type=submit]').click();assert.equal(await gate('messages').locator('.demo-bubble--mine').count(),1);assert.equal(await gate('messages').locator('.demo-chat-log img').count(),0,'HTML reply remains text');
  await gate('messages').locator('[data-demo-thread="1"]').click();assert.equal(await gate('messages').locator('.demo-bubble--mine').count(),0);await gate('messages').locator('[data-demo-thread="0"]').click();assert.equal(await gate('messages').locator('.demo-bubble--mine').count(),1);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,name+'-messages.png'),fullPage:true});
  await gate('messages').locator('.demo-nav [data-demo-view=lots]').click();await gate('lots').locator('[data-demo-lot="0"]').click();assert.match(await gate('lots').locator('.demo-lot').first().innerText(),/На паузе/);assert.equal(await page.evaluate(()=>cabinetDemoData().completed.length),3);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,name+'-lots.png'),fullPage:true});
  await gate('lots').locator('.demo-nav [data-demo-view=finance]').click();assert.ok(await gate('finance').locator('tbody tr').count()>1,'order search does not leak into finance');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,name+'-finance.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>demoFixture.calls.filter(c=>c.method==='POST').length),0,'trying the demo never sends a POST');
  assert.equal(await page.evaluate(()=>authState.workspace.plan.active),false);
  assert.ok(await gate('finance').evaluate(n=>{const r=n.getBoundingClientRect();return r.right<=innerWidth+1&&r.width<=innerWidth+1;}),'preview fits viewport');
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].filter(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width&&r.right>innerWidth+1&&s.visibility!=='hidden'&&s.display!=='none';}).slice(0,10).map(n=>({tag:n.tagName,cls:n.className,right:n.getBoundingClientRect().right}))}));
  assert.ok(overflow.scroll<=overflow.width+1,'no page horizontal overflow: '+JSON.stringify(overflow));
  await gate('finance').locator('[data-access-billing]').click();await page.waitForFunction(()=>!document.querySelector('[data-view="billing"]').hidden);
  await page.evaluate(()=>setView('dashboard'));await gate('dashboard').locator('[data-access-trial]').click();await page.waitForFunction(()=>!!demoFixture.activationResolve);assert.equal(await gate('dashboard').locator('[data-access-trial]').isDisabled(),true);await page.evaluate(()=>document.querySelector('[data-view="dashboard"] [data-access-trial]').click());assert.equal(await page.evaluate(()=>demoFixture.calls.filter(c=>c.path==='/api/v1/subscription/trial'&&c.method==='POST').length),1);
  await page.evaluate(()=>demoFixture.activationResolve());await page.waitForFunction(()=>!document.querySelector('[data-view="dashboard"]').hasAttribute('data-access-blocked'));assert.equal(await gate('dashboard').count(),0);assert.equal(await page.evaluate(()=>cabinetDemoSession),null);assert.equal(await page.locator('[data-view="dashboard"] .overview-context').isVisible(),true);
  await page.evaluate(()=>{resetAccountData();authState.user={id:'different-user'};authState.token='different-token';authState.workspace={id:'different-workspace',plan:{active:false}};subscriptionUi.scope=subscriptionScope();subscriptionUi.dataScope=subscriptionScope();subscriptionUi.data={trial:{state:'used'}};setView('messages');});assert.equal(await gate('messages').locator('.demo-bubble--mine').count(),0);assert.equal(await gate('messages').locator('[data-access-trial]').count(),0);assert.equal(await gate('messages').locator('[data-access-billing]').count(),1);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Cabinet demo Chrome: desktop/mobile, periods, filters, safe chat, local lot controls, scope isolation, no demo POSTs, trial double-click protection, real activation and access restoration passed.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
