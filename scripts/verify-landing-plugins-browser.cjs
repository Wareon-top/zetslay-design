const {chromium}=require(process.env.ZETSLAY_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),stage=fs.mkdtempSync(path.join(os.tmpdir(),'zetslay-public-plugins-')),out=process.env.ZETSLAY_BROWSER_OUTPUT||'/tmp/zetslay-landing-plugins-previews';
fs.mkdirSync(out,{recursive:true});
const args=[path.join(root,'deploy/stage-landing-plugins.py'),process.env.ZETSLAY_LANDING_BASELINE||root,root,stage];
if(process.env.ZETSLAY_PUBLIC_PLUGIN_EXPORT)args.push(process.env.ZETSLAY_PUBLIC_PLUGIN_EXPORT);
execFileSync('python3',args);
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff':'font/woff'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://fixture').pathname),relative=pathname==='/'?'index.html':pathname.slice(1);let file=path.join(stage,relative);if(!fs.existsSync(file))file=path.join(root,relative);if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
try{for(const [name,viewport,columns]of [['desktop',{width:1440,height:1000},4],['tablet',{width:900,height:1000},3],['mobile',{width:390,height:844},1],['compact',{width:320,height:700},1]]){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"UNAUTHORIZED"}}'}));
 try{
  await page.goto(base+'/');await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});await page.evaluate(()=>document.fonts.ready);
  const showcase=page.locator('[data-landing-plugin-showcase]'),cards=showcase.locator('[data-public-plugin]');assert.equal(await cards.count(),15);assert.equal(await showcase.locator('[data-public-plugin-count]').innerText(),'15');
  const ids=await cards.evaluateAll(nodes=>nodes.map(node=>node.dataset.publicPlugin));assert.equal(new Set(ids).size,15);assert.deepEqual(ids.slice(0,4),['zetslay.steam-rent','zetslay.robux-relay','zetslay.stars-relay','zetslay.ai-reviews']);
  assert.equal(await showcase.locator('button,a,input,form').count(),0);
  assert.equal(await showcase.locator('.landing-plugins__grid').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length),columns);
  for(const card of await cards.all()){
   await card.scrollIntoViewIfNeeded();
   await card.locator('img').evaluateAll(async images=>{await Promise.all(images.map(image=>image.decode()));});
   assert.ok(await card.evaluate(node=>{const rect=node.getBoundingClientRect();return rect.left>=0&&rect.right<=innerWidth+1&&node.scrollWidth<=node.clientWidth+1;}),'card fits '+name);
  }
  await page.evaluate(()=>window.scrollTo(0,document.querySelector('[data-landing-plugin-showcase]').offsetTop-70));await page.screenshot({path:path.join(out,name+'.png')});
  assert.ok(await showcase.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'showcase has no horizontal overflow');
  assert.deepEqual(errors,[]);
 }catch(error){await page.screenshot({path:path.join(out,name+'-failure.png')});throw error;}finally{await page.close();}
}
console.log('Public landing showcase Chrome: 15 unique catalog plugins; 4/3/1-column desktop/tablet/mobile/320px layouts, all cards and covers fit, no install controls or browser errors.');
}finally{await browser.close();server.close();fs.rmSync(stage,{recursive:true,force:true});}})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
