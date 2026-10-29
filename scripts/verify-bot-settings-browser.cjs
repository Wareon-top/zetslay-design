const {chromium}=require(process.env.ZETSLAY_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=process.env.ZETSLAY_BROWSER_OUTPUT||'/tmp/zetslay-bot-settings-previews',stage=fs.mkdtempSync(path.join(os.tmpdir(),'zetslay-bot-ui-'));
fs.mkdirSync(out,{recursive:true});const baseline=process.env.ZETSLAY_BOT_UI_BASELINE||path.join(root,'app');
execFileSync('python3',[path.join(root,'deploy/stage-bot-settings-ui.py'),baseline,path.join(root,'app'),stage]);
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://fixture').pathname;let file=pathname==='/app/'?path.join(stage,'index.html'):pathname==='/app/profile.js'?path.join(stage,'profile.js'):pathname==='/app/app.js'?path.join(baseline,'app.js'):path.join(root,decodeURIComponent(pathname));if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}res.setHeader('content-type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
try{for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}],['compact',{width:320,height:700}]]){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"UNAUTHORIZED"}}'}));await page.clock.install();
 try{
 await page.goto(base+'/app/?settings=bot#profile');await page.waitForFunction(()=>typeof botSettingsOpen==='function');
 await page.evaluate(()=>{
  sessionGeneration++;resetAccountData();authState.user={id:'bot-owner',email:'owner@example.invalid'};authState.token='bot-owner-fixture';authState.workspace={id:'owner-workspace',plan:{active:false},pluginLicenses:[]};
  state.storeContent={observedAt:null,orders:[],messages:[],lots:[]};state.onboarding={state:'telegram_linked',activePlan:false,telegram:{linked:true,botConfigured:true,bot:{username:'test_working_bot'}},funPay:{credentialConfigured:false,proxyConfigured:false,store:null}};
  window.botFixture={calls:[],fail:false,hold:false,resolve:null,status:{required:true,botConfigured:true,configured:false,authenticatedUntil:null}};
  apiRequest=async(p,o={})=>{const f=botFixture;f.calls.push({path:p,method:o.method||'GET'});
   if(p==='/api/v1/bot-access/password'){if(f.hold)return new Promise(resolve=>f.resolve=()=>{f.status.configured=true;resolve(structuredClone(f.status));});if(f.fail)throw Error('Private backend error');f.status.configured=true;return structuredClone(f.status);}
   if(p==='/api/v1/bot-access')return structuredClone(f.status);
   if(p==='/api/v1/profile')return profileState.data;
   if(p==='/api/v1/onboarding')return structuredClone(state.onboarding);
   if(p==='/api/v1/proxy-shop')return {enabled:false,balanceMinor:0,operations:[]};
   if(p==='/api/v1/managed-proxy')return {source:'none',configured:false,activePlan:false,current:null,candidates:[],requests:[]};
   if(p==='/api/v1/account/security')return {enabled:false,sessions:[]};if(p==='/api/v1/account/sync-health')return{status:'not_observed'};
   if(p==='/api/v1/legal/acceptance')return{required:false,publication:{state:'published'},acceptance:null};if(p.startsWith('/api/v1/legal/requests'))return{requests:[],nextOffset:null,admin:false};
   if(p==='/api/v1/payments')return{enabled:false,balanceMinor:0,payments:[],ledger:[]};return{};
  };
  profileState.data={profile:{authorId:'author_fixture',displayName:'Владелец',bio:'',publicVisible:false,version:0},identity:{email:'owner@example.invalid',role:'user'},plan:{active:false}};
  if(typeof learningUi!=='undefined')learningUi.data={version:1,revision:1,welcomeSeen:true,status:'completed',step:5};renderAuthState();setAuthModal(false);setView('profile');renderProfile();
 });
 const dialog=page.locator('.bot-settings-dialog'),form=dialog.locator('[data-bot-settings-form]');await form.waitFor();
 assert.equal(await page.locator('.connect-modal').evaluate(n=>n.classList.contains('is-open')),false,'deep link opens existing-bot settings, not onboarding');
 if(process.env.ZETSLAY_BOT_UI_BASELINE)assert.equal(await page.locator('.sidebar-nav [data-view-target="store-tools"]').count(),0,'does not add automation');
 assert.equal(await page.evaluate(()=>botFixture.calls.filter(c=>c.method==='POST').length),0);
 assert.equal(await dialog.locator('[name=botToken],[name=token]').count(),0);assert.match(await dialog.innerText(),/@test_working_bot/);
 await page.screenshot({path:path.join(out,name+'-settings.png'),fullPage:false});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.bot-settings-dialog'));
 const configure=page.locator('[data-profile] [data-bot-settings-open]');await configure.click();await form.waitFor();
 assert.equal(await page.locator('.connect-modal').evaluate(n=>n.classList.contains('is-open')),false,'profile configure does not replace bot');
 await form.locator('[name=password]').fill('OwnerPassword123');await form.locator('[name=confirmPassword]').fill('AnotherPassword123');await form.locator('[type=submit]').click();await dialog.locator('[data-bs-error]:not([hidden])').waitFor();assert.equal(await page.evaluate(()=>botFixture.calls.filter(c=>c.method==='POST').length),0);
 await form.locator('[name=confirmPassword]').fill('OwnerPassword123');await page.evaluate(()=>botFixture.fail=true);await form.locator('[type=submit]').click();await dialog.locator('[data-bs-error]:not([hidden])').waitFor();assert.equal(await form.locator('[name=password]').inputValue(),'OwnerPassword123');
 await page.evaluate(()=>{botFixture.fail=false;botFixture.hold=true;});await form.locator('[type=submit]').click();await page.waitForFunction(()=>!!botFixture.resolve);
 await page.evaluate(()=>botSettingsSave(document.querySelector('[data-bot-settings-form]')));assert.equal(await page.evaluate(()=>botFixture.calls.filter(c=>c.path==='/api/v1/bot-access/password').length),2,'double click does not duplicate save');
 await page.evaluate(()=>botFixture.resolve());await dialog.locator('[data-bs-saved]:not([hidden])').waitFor();assert.match(await dialog.innerText(),/Пароль сохранён/);assert.equal(await form.locator('[name=password]').inputValue(),'');assert.match(await dialog.innerText(),/\/login/);
 assert.ok(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'dialog fits narrow viewport');await dialog.evaluate(n=>n.scrollTop=0);await page.screenshot({path:path.join(out,name+'-saved.png'),fullPage:false});
 await page.keyboard.press('Escape');assert.equal(await configure.evaluate(n=>n===document.activeElement),true);await configure.click();await form.waitFor();assert.match(await dialog.innerText(),/Сменить пароль/);
 await form.locator('[name=password]').fill('PrivateDraft123');await page.evaluate(()=>clearSession());assert.equal(await page.locator('.bot-settings-dialog').count(),0);assert.equal(await page.evaluate(()=>botSettingsUi.data),null);assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('PrivateDraft')),false);
 assert.equal(await page.evaluate(()=>botFixture.calls.some(c=>c.path==='/api/v1/onboarding/telegram/bot'&&c.method==='POST')),false,'never re-registers bot');assert.deepEqual(errors,[]);
 }catch(error){await page.screenshot({path:path.join(out,name+'-failure.png'),fullPage:false});throw error;}finally{await page.close();}
}
console.log('Bot settings Chrome: profile/deep link, no onboarding or automation added, independent of FunPay/plan, password validation, retry, duplicate protection, clear-on-save/close/logout; desktop/mobile/320px passed. No live bot or password changes.');
}finally{await browser.close();server.close();fs.rmSync(stage,{recursive:true,force:true});}})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
