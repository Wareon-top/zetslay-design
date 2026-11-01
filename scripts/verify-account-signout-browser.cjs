const {chromium}=require(process.env.ZETSLAY_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseline=process.env.ZETSLAY_SIGNOUT_BASELINE||path.join(root,'app'),stage=fs.mkdtempSync(path.join(os.tmpdir(),'zetslay-signout-')),out=process.env.ZETSLAY_BROWSER_OUTPUT||'/tmp/zetslay-signout-previews';
fs.mkdirSync(out,{recursive:true});
execFileSync('python3',[path.join(root,'deploy/stage-account-signout.py'),baseline,path.join(root,'app'),stage]);
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://fixture').pathname);let file=pathname==='/app/'?path.join(stage,'index.html'):pathname==='/app/account-signout.css'?path.join(stage,'account-signout.css'):pathname==='/app/app.js'?path.join(baseline,'app.js'):path.join(root,pathname);if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}res.setHeader('content-type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
try{for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}],['compact',{width:320,height:700}]]){
 const context=await browser.newContext({viewport,reducedMotion:'reduce'}),errors=[],requests=[];let mode='error',complete;
 await context.route('**/*',async route=>{
  const req=route.request();if(req.url().startsWith(base))return route.continue();
  if(new URL(req.url()).pathname==='/api/v1/auth/logout'){
   requests.push({method:req.method(),authorization:req.headers().authorization});
   if(mode==='hold')await new Promise(resolve=>complete=resolve);
   return route.fulfill({status:mode==='error'?503:200,contentType:'application/json',body:mode==='error'?'{}':'{"data":{"loggedOut":true,"browserLoggedOut":true}}'});
  }
  return route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"INVALID_SESSION"}}'});
 });
 const page=await context.newPage(),other=await context.newPage();
 async function signedIn(tab){
  tab.on('pageerror',error=>errors.push(error.message));await tab.goto(base+'/app/');await tab.waitForFunction(()=>document.querySelector('.auth-modal.is-open')&&typeof logoutSession==='function');
  await tab.evaluate(()=>{
   sessionGeneration++;resetAccountData();authState.user={id:'fixture-user',email:'seller@example.invalid'};authState.token='signout-fixture';authState.workspace={id:'fixture-shop',plan:{active:false},pluginLicenses:[]};
   const request=apiRequest;apiRequest=async(p,o={})=>p==='/api/v1/auth/logout'?request(p,o):p==='/api/v1/onboarding'?{state:'telegram_required',activePlan:false,telegram:{linked:false},funPay:{}}:p==='/api/v1/proxy-shop'?{enabled:false,balanceMinor:0,operations:[]}:{};
   state.storeContent={observedAt:null,orders:[],messages:[],lots:[]};profileState.data={profile:{displayName:'Продавец'},identity:{email:'seller@example.invalid',role:'user'},plan:{active:false}};
   if(typeof learningUi!=='undefined')learningUi.data={version:1,revision:1,welcomeSeen:true,status:'completed',step:5};renderAuthState();setAuthModal(false);setView('guide');
   sessionStorage.setItem('zetslay_session','legacy-fixture');
  });
  await tab.waitForFunction(()=>!document.querySelector('.auth-modal.is-open'));
 }
 try{
  await signedIn(page);await signedIn(other);
  async function reveal(){if(viewport.width<=980)await page.locator('[data-sidebar-open]').click();await page.locator('[data-account-signout]').scrollIntoViewIfNeeded();}
  await reveal();const button=page.locator('[data-account-signout]');assert.equal(await button.count(),1);assert.match(await button.innerText(),/Выйти из аккаунта/);
  assert.ok(await button.evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&r.height>=44;}),'logout is reachable and fits screen');
  await page.screenshot({path:path.join(out,name+'-button.png')});
  await button.click();await page.waitForFunction(()=>!logoutBusy);assert.equal(requests.length,1);assert.equal(await page.evaluate(()=>authState.token),'signout-fixture');assert.equal(await other.evaluate(()=>authState.token),'signout-fixture');assert.match(await page.locator('.toast-region').innerText(),/Выход не подтверждён/);
  mode='hold';await button.click();await page.waitForFunction(()=>logoutBusy);assert.equal(await button.isDisabled(),true);await page.evaluate(()=>logoutSession(document.querySelector('[data-account-signout]')));assert.equal(requests.length,2,'repeat clicks do not duplicate logout');
  mode='success';complete();await page.waitForFunction(()=>!authState.user&&!logoutBusy);await other.waitForFunction(()=>!authState.user);await page.locator('[data-auth-form]').waitFor({state:'visible'});
  assert.equal(await page.locator('.app-shell').isVisible(),false);assert.equal(await page.evaluate(()=>sessionStorage.getItem('zetslay_session')),null);assert.equal(await other.evaluate(()=>sessionStorage.getItem('zetslay_session')),null);assert.equal(await page.evaluate(()=>location.hash),'#dashboard');
  assert.ok(requests.every(r=>r.method==='POST'&&r.authorization==='Bearer signout-fixture'));
  await page.screenshot({path:path.join(out,name+'-logged-out.png')});assert.deepEqual(errors,[]);
 }catch(error){await page.screenshot({path:path.join(out,name+'-failure.png')});throw error;}finally{await context.close();}
}
console.log('Logout button Chrome: desktop/mobile/320px, existing handler sends POST, failure is retryable, duplicate clicks blocked, confirmed logout hides cabinet and opens login, second tab and legacy storage cleared. No live account changes.');
}finally{await browser.close();server.close();fs.rmSync(stage,{recursive:true,force:true});}})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
