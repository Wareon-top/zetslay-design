const {chromium}=require(process.env.ZETSLAY_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=process.env.ZETSLAY_BROWSER_OUTPUT||'/tmp/zetslay-bot-connection-previews',stage=fs.mkdtempSync(path.join(os.tmpdir(),'zetslay-bot-connect-'));
fs.mkdirSync(out,{recursive:true});execFileSync('python3',[path.join(root,'deploy/stage-bot-connection.py'),path.join(root,'app'),path.join(root,'app'),stage]);
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://fixture').pathname;const selected=name==='/app/'?'index.html':name.startsWith('/app/')?name.slice(5):null;const file=selected&&fs.existsSync(path.join(stage,selected))?path.join(stage,selected):path.join(root,decodeURIComponent(name));if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}res.setHeader('content-type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
try{for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}],['compact',{width:320,height:700}]]){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"UNAUTHORIZED"}}'}));
 try{
 await page.goto(base+'/app/');await page.waitForFunction(()=>typeof setModal==='function');
 await page.evaluate(()=>{
  sessionGeneration++;authState.user={id:'fixture-owner',email:'owner@example.invalid'};authState.token='fixture-session';authState.workspace={id:'fixture-workspace',plan:{active:true},pluginLicenses:[]};
  window.connectFixture={calls:[],failPassword:true,snapshot:{workspaceId:'fixture-workspace',state:'telegram_bot_required',activePlan:true,telegram:{botConfigured:false,linked:false,passwordRequired:true,passwordConfigured:false},funPay:{}}};
  apiRequest=async(p,o={})=>{const f=connectFixture;f.calls.push({path:p,body:o.body});
   if(p==='/api/v1/onboarding/telegram/bot'){f.snapshot.state='telegram_link_pending';Object.assign(f.snapshot.telegram,{botConfigured:true,bot:{id:123,username:'fixture_working_bot'}});return structuredClone(f.snapshot);}
   if(p==='/api/v1/bot-access/password'){if(f.failPassword){f.failPassword=false;throw Error('Проверочная ошибка сохранения');}f.snapshot.telegram.passwordConfigured=true;return{required:true,botConfigured:true,configured:true};}
   if(p==='/api/v1/onboarding/telegram/link-code')return{code:'123456',expiresAt:new Date(Date.now()+600000).toISOString(),onboarding:structuredClone(f.snapshot)};
   if(p.startsWith('/api/v1/onboarding'))return structuredClone(f.snapshot);return{};
  };
  state.onboarding=structuredClone(connectFixture.snapshot);connectionStep=0;connectionBusy=false;connectionLoading=false;connectionLoadFailed=false;serviceBotUsername='fixture_service_bot';
  if(typeof learningUi!=='undefined')learningUi.data={version:1,revision:1,welcomeSeen:true,status:'completed',step:5};renderAuthState();setAuthModal(false);setModal(true);
 });
 const modal=page.locator('.connect-modal'),next=modal.locator('[data-connect-next]');
 await modal.locator('[name=botToken]').waitFor();assert.equal(await modal.locator('[name=botPassword]').count(),0);
 await modal.locator('[name=botToken]').fill('FAKE_BOT_TOKEN_FOR_BROWSER');await next.click();await modal.locator('[name=botPassword]').waitFor();
 assert.equal(await modal.locator('[name=botToken]').count(),0);assert.match(await modal.innerText(),/Токен уже сохранён/);assert.equal(await modal.locator('[data-connection-step="2"]').isDisabled(),true);
 assert.deepEqual(await page.evaluate(()=>connectFixture.calls.filter(c=>c.path.endsWith('/telegram/bot')).map(c=>c.body)),[{token:'FAKE_BOT_TOKEN_FOR_BROWSER'}]);
 await modal.locator('[name=botPassword]').fill('DraftBotPassword123');await page.evaluate(()=>setModal(false));await modal.waitFor({state:'hidden'});await page.evaluate(()=>setModal(true));await modal.locator('[name=botPassword]').waitFor();assert.equal(await modal.locator('[name=botPassword]').inputValue(),'');
 await modal.locator('[name=botPassword]').fill('NewBotPassword123');await modal.locator('[name=botPasswordConfirm]').fill('different');await next.click();assert.match(await modal.locator('[data-connect-error]').innerText(),/Пароли не совпадают/);assert.equal(await modal.locator('[name=botPassword]').inputValue(),'NewBotPassword123');
 await modal.locator('[name=botPasswordConfirm]').fill('NewBotPassword123');await next.click();await modal.locator('[data-connect-error]:not([hidden])').waitFor();assert.match(await modal.locator('[data-connect-error]').innerText(),/Проверочная ошибка/);
 await modal.locator('[name=botPassword]').fill('NewBotPassword123');await modal.locator('[name=botPasswordConfirm]').fill('NewBotPassword123');
 assert.ok(await modal.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'password dialog fits viewport');await page.screenshot({path:path.join(out,name+'-password.png')});
 await next.click();await page.waitForFunction(()=>state.onboarding.telegram.passwordConfigured===true);assert.equal(await modal.locator('[name=botPassword]').count(),0);await next.click();await page.waitForFunction(()=>Boolean(connectionStatus?.linkCode));assert.match(await modal.innerText(),/\/start 123456/);
 const calls=await page.evaluate(()=>connectFixture.calls);assert.equal(calls.filter(c=>c.path.endsWith('/telegram/bot')).length,1);const passwordCalls=calls.filter(c=>c.path==='/api/v1/bot-access/password');assert.equal(passwordCalls.length,2);assert.deepEqual(passwordCalls[1].body,{password:'NewBotPassword123',confirmPassword:'NewBotPassword123'});
 assert.ok(await modal.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'link dialog fits viewport');await page.screenshot({path:path.join(out,name+'-link.png')});assert.deepEqual(errors,[]);
 }catch(e){console.error('Fixture state:',await page.evaluate(()=>({user:!!authState.user,step:connectionStep,loading:connectionLoading,busy:connectionBusy,error:connectionError,snapshot:state.onboarding,hidden:document.querySelector('.connect-modal').hidden,classes:document.querySelector('.connect-modal').className,fields:[...document.querySelectorAll('.connect-modal input')].map(n=>n.name),calls:connectFixture.calls.map(c=>c.path)})));await page.screenshot({path:path.join(out,name+'-failure.png')});throw e;}finally{await page.close();}
}console.log('Bot connection Chrome: token-only save, separate password, mismatch, retry, close/reopen, Telegram link and desktop/390/320px passed. Only local fixtures used.');
}finally{await browser.close();server.close();fs.rmSync(stage,{recursive:true,force:true});}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
