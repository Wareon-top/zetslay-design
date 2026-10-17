const http=require('node:http');
const {readFileSync,mkdirSync}=require('node:fs');
const {join,resolve}=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.ZETSLAY_PLAYWRIGHT_MODULE||'playwright');
const root=resolve(__dirname,'..'),output=process.env.ZETSLAY_BROWSER_OUTPUT||'/tmp/zetslay-storefront-previews';
mkdirSync(output,{recursive:true});
let creations=0,steps=0;
const category={nodeId:'2500',categoryTitle:'Bodycam · Аккаунты',currency:'RUB',fingerprint:'a'.repeat(64),fields:{'fields[platform]':'steam'},missing:[],controls:[{name:'fields[platform]',label:'Платформа',kind:'select',required:true,options:[{value:'',label:'Выберите платформу'},{value:'steam',label:'Steam'},{value:'ps',label:'PlayStation'}]}]};
const plan={token:'approved',expiresAt:Date.now()+300000,currency:'RUB',activate:false,items:[{productId:86,productName:'Bodycam',hours:24,costMinor:1000,priceMinor:1200,nodeId:'2500',categoryTitle:'Bodycam · Аккаунты'}],skipped:[]};
const html=`<!doctype html><html data-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app/styles.css"><link rel="stylesheet" href="/app/kosell-rent.css"><link rel="stylesheet" href="/app/kosell-storefront.css"><style>body{margin:0;background:#111216;color:#ededf2;font-family:Arial,sans-serif}main{width:min(1100px,calc(100% - 32px));margin:32px auto}h1{font-size:18px;font-weight:500}body.light{background:#f5f5f8;color:#25262d}</style><body><main><h1>Kosell Rent</h1><div id="fixture" class="kosell-panel"></div></main><script>
const authState={token:'fixture'},sessionGeneration=1,kosellUi={status:{storeId:'42',config:{markupPercent:20,manageOffers:true}}};
function escapeHtml(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function kosellMoney(n,c){return (n/100).toFixed(2)+' '+c}function humanError(e){return e.message}function kosellCatalogMarkup(){return '<p>Создание по своим лотам-шаблонам</p>'}function validateKosellCatalogPlan(p){return p&&Array.isArray(p.items)&&typeof p.token==='string'}async function loadKosellStatus(){}async function apiRequest(path,options={}){const r=await fetch(path,{method:options.method||'GET',headers:{'content-type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})});return (await r.json()).data}
</script><script src="/app/kosell-storefront.js"></script><script>document.querySelector('#fixture').innerHTML=kosellCatalogMarkup(kosellUi.status);</script></body></html>`;
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('content-type','text/html; charset=utf-8');return res.end(html);}
 if(req.url.startsWith('/api/')){let data;if(req.url.endsWith('/category'))data=category;else if(req.url.endsWith('/start')){steps=0;data={token:'preparing',revision:0,state:'preparing',completed:0,total:2};}else if(req.url.endsWith('/step'))data=++steps===1?{token:'preparing',revision:1,state:'preparing',completed:1,total:2}:{token:'preparing',revision:2,state:'ready',completed:2,total:2,plan};else if(req.url.endsWith('/offer-confirm')){creations++;data={queued:1};}else data={products:[{id:86,name:'Bodycam',nodeId:'2500',availableAccounts:115},{id:279,name:'MECCHA CHAMELEON',nodeId:null,availableAccounts:9}],categories:[{nodeId:'2500',game:'Bodycam',name:'Аккаунты'},{nodeId:'451',game:'Прочие игры',name:'Аккаунты'}],preparation:null};res.setHeader('content-type','application/json');return res.end(JSON.stringify({data}));}
 const path=join(root,req.url.split('?')[0]);if(!path.startsWith(root+'/')){res.statusCode=404;return res.end();}try{res.setHeader('content-type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'application/octet-stream');res.end(readFileSync(path));}catch{res.statusCode=404;res.end();}
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH||undefined,headless:true,args:['--no-sandbox']});try{
 for(const [name,viewport,theme]of [['desktop',{width:1440,height:1100},'dark'],['mobile',{width:390,height:844},'dark'],['light',{width:1440,height:1100},'light']]){
  const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);if(theme==='light')await page.evaluate(()=>{document.documentElement.dataset.theme='light';document.body.classList.add('light');});
  await page.getByRole('button',{name:'Выбрать игры',exact:true}).click();await page.locator('[data-sf-search]').waitFor();
  await page.locator('[data-sf-search]').fill('Body');assert.equal(await page.locator('.sf-product').count(),1);assert.equal(await page.locator('.sf-product').evaluate(el=>getComputedStyle(el).display),'flex','Game rows retain layout under existing Kosell label styles');
  if(theme==='light')assert.equal(await page.locator('.sf-product strong').evaluate(el=>getComputedStyle(el).color),'rgb(34, 35, 43)','Game names remain readable in light theme');await page.locator('[data-sf-select="86"]').check();await page.getByText('Параметры готовы',{exact:true}).waitFor();
  await page.locator('[data-sf-durations]').fill('24');await page.locator('[data-sf-reviewed]').check();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No horizontal overflow on '+name);
  await page.screenshot({path:join(output,name+'.png'),fullPage:true});
  await page.getByRole('button',{name:'Подготовить план',exact:true}).click();await page.getByRole('button',{name:'Создать лоты (1)',exact:true}).waitFor();
  const before=creations;await page.getByRole('button',{name:'Создать лоты (1)',exact:true}).click();await page.getByText(/В очередь добавлено лотов: 1/).waitFor();assert.equal(creations,before+1);assert.equal(await page.locator('[data-sf-action="confirm"]').count(),0);
  await page.evaluate(form=>{const u=sfState();u.entries=Array.from({length:49},(_,i)=>({productId:i+1,productName:'Игра '+(i+1),nodeId:'2500',form:i<22?form:null,fields:i<22?{...form.fields}:{},error:i<22?'':'Не удалось проверить форму этой категории FunPay.'}));u.preparation=null;sfInvalidate();sfRefresh();},category);
  assert.equal(await page.getByRole('button',{name:'Подготовить план',exact:true}).isDisabled(),true);await page.getByText('План пока не готов: проверьте 27 из 49 игр',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Blocker explanation fits on '+name);await page.screenshot({path:join(output,name+'-blocked.png'),fullPage:true});
  await page.getByRole('button',{name:'Загрузить недостающие параметры (27)',exact:true}).click();await page.getByText('49/49 готово',{exact:true}).waitFor();assert.equal(await page.locator('[data-sf-reviewed]').isChecked(),false);assert.equal(creations,before+1,'Retrying category reads never creates lots');assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Real Chromium: storefront search, category fields, plan, one confirmation, dark/light desktop and mobile overflow checks passed. No live API calls.');
}finally{await browser.close();server.close();}})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
